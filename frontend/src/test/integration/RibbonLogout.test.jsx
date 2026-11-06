import { act, fireEvent, render as baseRender, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import RibbonHeader from "../../components/RibbonHeader";
import { AuthSessionContext } from "../../context/AuthSession";
import { API_BASE_URL } from "../../config/http";
import UnsavedChangesGuard, { useUnsavedGrades } from "../../components/UnsavedChangesGuard";

jest.mock("axios", () => ({ post: jest.fn(), defaults: {} }));
const Location = () => <output data-testid="route">{useLocation().pathname}</output>;
const RibbonPage = ({ forced, dirty }) => {
  useUnsavedGrades(dirty);
  return <AuthSessionContext.Provider value={{ authenticated: true, user: { role: "custom", mustChangePassword: forced }, access: { permissions: [], roles: [] } }}><RibbonHeader /></AuthSessionContext.Provider>;
};
const renderPage = (forced = false, dirty = false) => render(<RouterProvider router={createMemoryRouter([{
  element: <><Location /><UnsavedChangesGuard /></>, children: [
    { path: "/login", element: <h1>Login page</h1> },
    { path: "*", element: <RibbonPage forced={forced} dirty={dirty} /> },
  ],
}], { initialEntries: ["/system/change-password"] })} />);

const render = (...args) => {
  const result = baseRender(...args);
  const toggle = screen.queryByRole("button", { name: "Mở menu tác vụ" });
  if (toggle) fireEvent.click(toggle);
  return result;
};
describe("Ribbon current-session POST logout", () => {
  beforeEach(() => { jest.clearAllMocks(); sessionStorage.removeItem('sdh.sidebar.open'); });
  it.each(['button', 'svg'])('logs out directly from the compact footer when clicking its %s', async target => {
    axios.post.mockResolvedValue({ status: 204 });
    renderPage();
    fireEvent.keyDown(document, { key: 'Escape' });
    const button = screen.getByRole('button', { name: 'Đăng xuất' });
    fireEvent.click(target === 'svg' ? button.querySelector('svg') : button);
    expect(document.querySelector('.ribbon-sidebar')).toHaveClass('is-compact');
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(`${API_BASE_URL}/user/logout`, {}, { withCredentials: true }));
    expect(await screen.findByRole('heading', { name: 'Login page' })).toBeInTheDocument();
  });
  it.each([
    ["Thông tin về đơn vị", "/system/unit-info"], ["Về trang chủ", "/"],
  ])("confirms unsaved grades before navigating with %s", async (label, destination) => {
    renderPage(false, true); fireEvent.click(screen.getByRole("button", { name: label }));
    fireEvent.click(await screen.findByText("Ở lại")); expect(screen.getByTestId("route")).toHaveTextContent("/system/change-password");
    fireEvent.click(await screen.findByRole("button", { name: "Mở menu tác vụ" }));
    fireEvent.click(await screen.findByRole("button", { name: label })); fireEvent.click(await screen.findByText("Bỏ thay đổi và tiếp tục"));
    await waitFor(() => expect(screen.getByTestId("route").textContent).toBe(destination));
  });
  it.each(["Thoát chương trình", "Đăng xuất"])("confirms unsaved changes before logout from %s", async (label) => {
    axios.post.mockResolvedValue({ status: 204 }); renderPage(false, true);
    fireEvent.click(screen.getByRole("button", { name: label })); fireEvent.click(await screen.findByText("Ở lại")); expect(axios.post).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Mở menu tác vụ" }));
    fireEvent.click(await screen.findByRole("button", { name: label })); fireEvent.click(await screen.findByText("Bỏ thay đổi và tiếp tục"));
    expect(await screen.findByRole("heading", { name: "Login page" })).toBeInTheDocument();
  });
  it.each([false, true])("permissionless Staff, forced password=%s, POSTs with credentials before navigation", async forced => {
    let complete;
    axios.post.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    renderPage(forced);const button = screen.getByRole("button", { name: "Thoát chương trình" });
    fireEvent.click(button);
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(`${API_BASE_URL}/user/logout`, {}, { withCredentials: true }));
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
