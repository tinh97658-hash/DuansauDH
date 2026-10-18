import { render, screen } from "@testing-library/react";
import axios from "axios";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { act, fireEvent } from "@testing-library/react";
import { useAuthSession } from "../../context/AuthSession";
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
  it("shares the verified session while navigating between protected pages", async () => {
    axios.get.mockClear();
    axios.get.mockResolvedValueOnce({ data: { authenticated: true, user: { role: 'examiner' } } });
    const Page = ({ name }) => <><p>{name}: {useAuthSession().user.role}</p><Link to='/second'>Next</Link></>;
    await act(async () => { render(<MemoryRouter initialEntries={['/first']}><Routes><Route element={<ProtectedRoute />}>
      <Route path='/first' element={<Page name='First' />} /><Route path='/second' element={<Page name='Second' />} />
    </Route></Routes></MemoryRouter>); });
    await screen.findByText('First: examiner');
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Next' })); });
    expect(await screen.findByText('Second: examiner')).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
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
