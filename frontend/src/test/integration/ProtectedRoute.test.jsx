import { render, screen } from "@testing-library/react";
import axios from "axios";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { act, fireEvent } from "@testing-library/react";
import { useAuthSession } from "../../context/AuthSession";
import ProtectedRoute from "../../components/ProtectedRoute";

jest.mock("axios");

it('requires selecting a working profile before rendering business pages',async()=>{
  let selected=false;
  axios.get.mockImplementation(url=>Promise.resolve({data:url==='/auth/session'?{
    authenticated:true,user:{name:'Người dùng',role:'admin'},profiles:[{id:'viewer',name:'Xem điểm',scopeLabel:'Lớp phụ trách'},{id:'admin',name:'Quản trị',scopeLabel:'Toàn viện'}],
    activeProfile:selected?{id:'viewer',name:'Xem điểm'}:null,profileSelectionRequired:!selected,
  }:{permissions:['module.assessment','gradebook.view'],roles:['viewer']}}));
  axios.post.mockImplementation(async()=>{selected=true;return {data:{}};});
  render(<MemoryRouter useTransitions={false} initialEntries={['/private']}><Routes><Route element={<ProtectedRoute/>}>
    <Route path="/private" element={<h1>Nghiệp vụ riêng</h1>}/><Route path="/" element={<h1>Hồ sơ đã chọn</h1>}/>
  </Route></Routes></MemoryRouter>);
  expect(await screen.findByRole('dialog')).toHaveTextContent('CHỌN HỒ SƠ LÀM VIỆC');
  expect(screen.queryByText('Nghiệp vụ riêng')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Làm việc với Xem điểm'}));
  expect(await screen.findByText('Hồ sơ đã chọn')).toBeInTheDocument();
  expect(axios.post).toHaveBeenCalledWith('/auth/profiles/select',{profileId:'viewer'},{withCredentials:true});
});

function renderRoute() {
  return render(
    <MemoryRouter useTransitions={false} initialEntries={["/private"]}>
      <Routes>
        <Route path="/login" element={<h1>Login page</h1>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/private" element={<h1>Private page</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

it('blocks a direct page URL when only another route has been granted',async()=>{
  axios.get.mockImplementation(url=>Promise.resolve({data:url==='/auth/session'?{authenticated:true}:{
    permissions:['scheduling.view','route.masters.schedule.view'],
    routeCatalog:[{path:'/masters/schedule',actions:[]},{path:'/masters/course-offerings',actions:[]}],
  }}));
  render(<MemoryRouter initialEntries={['/masters/course-offerings']}><Routes><Route element={<ProtectedRoute/>}>
    <Route path='/masters/course-offerings' element={<h1>Tạo lớp bí mật</h1>}/>
  </Route></Routes></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('không có quyền xem trang này');
  expect(screen.queryByText('Tạo lớp bí mật')).not.toBeInTheDocument();
});

describe("ProtectedRoute", () => {
  const permissionsResponse = { data: { superadmin: false, permissions: [], roles: [] } };
  it("shares the verified session while navigating between protected pages", async () => {
    axios.get.mockClear();
    axios.get.mockImplementation((url) => url === "/auth/session"
      ? Promise.resolve({ data: { authenticated: true, user: { role: 'examiner' } } })
      : Promise.resolve(permissionsResponse));
    const Page = ({ name }) => <><p>{name}: {useAuthSession().user.role}</p><Link to='/second'>Next</Link></>;
    await act(async () => { render(<MemoryRouter useTransitions={false} initialEntries={['/first']}><Routes><Route element={<ProtectedRoute />}>
      <Route path='/first' element={<Page name='First' />} /><Route path='/second' element={<Page name='Second' />} />
    </Route></Routes></MemoryRouter>); });
    await screen.findByText('First: examiner');
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Next' })); });
    expect(await screen.findByText('Second: examiner')).toBeInTheDocument();
    expect(axios.get.mock.calls.filter(([url]) => url === "/auth/session")).toHaveLength(1);
  });
  it("renders protected content for an authenticated session", async () => {
    axios.get.mockImplementation((url) => url === "/auth/session"
      ? Promise.resolve({ data: { authenticated: true } })
      : Promise.resolve(permissionsResponse));

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

  it("forces a staff member with an initial password to change it first", async () => {
    axios.get.mockImplementation((url) => url === "/auth/session"
      ? Promise.resolve({ data: { authenticated: true, user: { role: "supervisor", mustChangePassword: true },profileSelectionRequired:true,profiles:[{id:'a'},{id:'b'}] } })
      : Promise.resolve(permissionsResponse));

    render(
      <MemoryRouter useTransitions={false} initialEntries={["/private"]}>
        <Routes>
          <Route path="/login" element={<h1>Login page</h1>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/private" element={<h1>Private page</h1>} />
            <Route path="/system/change-password" element={<h1>Change password page</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Change password page" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Private page" })).not.toBeInTheDocument();
  });
});
