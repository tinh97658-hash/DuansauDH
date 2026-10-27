import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import RibbonHeader from "../../components/RibbonHeader";
import { AuthSessionContext } from "../../context/AuthSession";
import { API_BASE_URL } from "../../config/http";

jest.mock("axios", () => ({ post: jest.fn(), defaults: {} }));
const Location = () => <output data-testid="route">{useLocation().pathname}</output>;
const renderPage = (forced = false) => render(<MemoryRouter useTransitions={false} initialEntries={["/system/change-password"]}><Location /><Routes>
  <Route path="/login" element={<h1>Login page</h1>} />
  <Route path="*" element={<AuthSessionContext.Provider value={{ authenticated: true, user: { role: "custom", mustChangePassword: forced }, access: { permissions: [], roles: [] } }}><RibbonHeader /></AuthSessionContext.Provider>} />
</Routes></MemoryRouter>);

describe("Ribbon current-session POST logout", () => {
  beforeEach(() => { jest.clearAllMocks(); });
  it.each([false, true])("permissionless Staff, forced password=%s, POSTs with credentials before navigation", async forced => {
    let complete;
    axios.post.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    renderPage(forced);const button = screen.getByRole("button", { name: "Thoát chương trình" });
    fireEvent.click(button);
    expect(axios.post).toHaveBeenCalledWith(`${API_BASE_URL}/user/logout`, {}, { withCredentials: true });
    expect(button).toBeDisabled();expect(screen.getByTestId("route")).toHaveTextContent("/system/change-password");
    await act(async () => { complete({ status: 204 }); });
    expect(await screen.findByRole("heading", { name: "Login page" })).toBeInTheDocument();
    expect(screen.getByTestId("route")).toHaveTextContent("/login");
  });
  it.each([new Error("Network unavailable"), { response: { status: 500 } }, { response: { status: 403 } }])("keeps the page and permits retry after failure %p", async error => {
    axios.post.mockRejectedValueOnce(error).mockResolvedValueOnce({ status: 204 });renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Thoát chương trình" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể đăng xuất");
    expect(screen.getByTestId("route")).toHaveTextContent("/system/change-password");
    const retry = screen.getByRole("button", { name: "Thoát chương trình" });await waitFor(() => expect(retry).not.toBeDisabled());
    fireEvent.click(retry);expect(await screen.findByRole("heading", { name: "Login page" })).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(2);
  });
});
