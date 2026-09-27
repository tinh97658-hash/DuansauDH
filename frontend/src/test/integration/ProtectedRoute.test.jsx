import { render, screen } from "@testing-library/react";
import axios from "axios";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "../../components/ProtectedRoute";

jest.mock("axios");

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={["/private"]}>
      <Routes>
        <Route path="/login" element={<h1>Login page</h1>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/private" element={<h1>Private page</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  it("renders protected content for an authenticated session", async () => {
    axios.get.mockResolvedValueOnce({ data: { authenticated: true } });

    renderRoute();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Private page" })).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith("/auth/session", { withCredentials: true });
  });

  it("redirects an anonymous session to login", async () => {
    axios.get.mockResolvedValueOnce({ data: { authenticated: false } });

    renderRoute();

    expect(await screen.findByRole("heading", { name: "Login page" })).toBeInTheDocument();
  });
});
