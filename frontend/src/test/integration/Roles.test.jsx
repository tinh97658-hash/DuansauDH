import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import axios from "axios";
import Roles from "../../pages/system/roles";
import theme from "../../theme";
import { AuthSessionContext } from "../../context/AuthSession";
import AppToaster from "../../components/AppToaster";
import { toast } from "react-toastify";

vi.mock("axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(), defaults: {} },
}));
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });

const CATALOG = [
  {
    group: "Tài khoản & phân quyền",
    permissions: [
      {id:'perm-root',code:'module.administration',name:'Mở module Tài khoản & phân quyền',moduleId:'administration',kind:'module'},
      { id: "perm-view", code: "account.view", name: "Xem tài khoản",moduleId:'administration',kind:'read' },
      { id: "perm-manage", code: "account.manage", name: "Quản lý tài khoản",moduleId:'administration',kind:'write',requires:['account.view'] },
    ],
  },
];

const ROLES = [
  {
    id: "role-admin", code: "admin", name: "Quản trị hệ thống", description: null,
    isSystem: true, isSuperadmin: true, active: true, staffCount: 1,
    permissions: [{id:'perm-root',code:'module.administration'},{ id: "perm-view", code: "account.view", name: "Xem tài khoản" }, { id: "perm-manage", code: "account.manage", name: "Quản lý tài khoản" }],
  },
  {
    id: "role-supervisor", code: "supervisor", name: "Giảng viên hướng dẫn", description: "Theo dõi học viên",
    isSystem: true, isSuperadmin: false, active: true, staffCount: 0,
    permissions: [{id:'perm-root',code:'module.administration'},{ id: "perm-view", code: "account.view", name: "Xem tài khoản" }],
  },
];

it('allows all permissions including approval to be granted to any role', async () => {
  const permissions = [
    { id: 'root', code: 'module.learner-status', name: 'Mở module Bảo lưu', moduleId: 'learner-status', kind: 'module' },
    { id: 'request', code: 'studyleave.request', name: 'Tạo yêu cầu bảo lưu', moduleId: 'learner-status', kind: 'write' },
    { id: 'approve', code: 'studyleave.approve', name: 'Duyệt bảo lưu', moduleId: 'learner-status', kind: 'write' },
  ];
  axios.get.mockImplementation(url => Promise.resolve({ data: String(url).endsWith('/roles/permissions') ? [{ group: 'Bảo lưu', permissions }] : [{ ...ROLES[1], permissions: [permissions[0]] }] }));
  axios.put.mockResolvedValue({ data: { message: 'Đã lưu' } });
  mount(['role.view', 'role.manage']);
  const request = await screen.findByRole('checkbox', { name: 'Tạo yêu cầu bảo lưu' });
  const approve = screen.getByRole('checkbox', { name: 'Duyệt bảo lưu' });
  await waitFor(() => expect(request).toBeEnabled());
  expect(approve).toBeEnabled();
  fireEvent.click(request);
  fireEvent.click(approve);
  expect(request).toBeChecked();
  expect(approve).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/role-supervisor/permissions'), expect.objectContaining({ permissionIds: ['root', 'request', 'approve'] }), expect.any(Object)));
});

const mount = (permissions) => render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <AppToaster />
    <AuthSessionContext.Provider value={{ access: { superadmin: false, permissions, roles: [] } }}>
      <Roles />
    </AuthSessionContext.Provider>
  </ThemeProvider>,
);

beforeEach(() => {
  axios.get.mockImplementation((url) => {
    if (String(url).endsWith("/roles/permissions")) return Promise.resolve({ data: CATALOG });
    if (String(url).endsWith("/roles")) return Promise.resolve({ data: ROLES });
    return Promise.resolve({ data: [] });
  });
});
afterEach(() => { toast.dismiss(); toast.clearWaitingQueue(); });

it('disables child permissions when the module is off and never enables writes from a module toggle',async()=>{
  mount(['role.view','role.manage']);
  const root=await screen.findByRole('checkbox',{name:'Mở module Tài khoản & phân quyền'});
  await waitFor(()=>expect(root).toBeChecked());
  fireEvent.click(root);
  expect(screen.getByRole('checkbox',{name:'Xem tài khoản'})).toBeDisabled();
  expect(screen.getByRole('checkbox',{name:'Quản lý tài khoản'})).not.toBeChecked();
  fireEvent.click(root);
  const dialog=await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button',{name:'Bật các quyền xem này'}));
  await waitFor(()=>expect(screen.getByRole('checkbox',{name:'Xem tài khoản'})).toBeChecked());
  expect(screen.getByRole('checkbox',{name:'Quản lý tài khoản'})).not.toBeChecked();
});

it('guards switching roles with unsaved changes and can discard without saving',async()=>{
  mount(['role.view','role.manage']);
  const manage=await screen.findByRole('checkbox',{name:'Quản lý tài khoản'});
  await waitFor(()=>expect(manage).toBeChecked());fireEvent.click(manage);
  fireEvent.click(screen.getByText('Giảng viên hướng dẫn'));
  const dialog=await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent('Bạn có thay đổi phân quyền chưa lưu');
  fireEvent.click(within(dialog).getByRole('button',{name:'Bỏ qua thay đổi'}));
  await waitFor(()=>expect(screen.getByRole('checkbox',{name:'Quản lý tài khoản'})).not.toBeChecked());
});

it("shows permission-save feedback once as a toast", async () => {
  mount(["role.view", "role.manage"]);
  await screen.findByRole("checkbox", { name: "Quản lý tài khoản" });
  fireEvent.click(screen.getByRole('checkbox',{name:'Quản lý tài khoản'}));
  axios.put.mockResolvedValueOnce({ data: { message: "Cập nhật quyền cho vai trò thành công." } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  const feedback = await screen.findByText("Cập nhật quyền cho vai trò thành công.");
  expect(feedback.closest(".Toastify__toast")).toHaveClass("Toastify__toast--success");
  expect(feedback.closest(".Toastify__toast")).toHaveClass("Toastify__toast-theme--light", "app-toast");
  expect(feedback.closest(".MuiAlert-root")).toBeNull();
  expect(screen.getAllByText("Cập nhật quyền cho vai trò thành công.")).toHaveLength(1);
});

it("hiển thị và lưu ma trận quyền admin như mọi vai trò khác", async () => {
  mount(["role.view", "role.manage"]);
  const manage = await screen.findByRole("checkbox", { name: "Quản lý tài khoản" });
  await waitFor(() => expect(manage).toBeChecked());
  fireEvent.click(manage);
  axios.put.mockResolvedValue({ data: { message: "Đã lưu" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  expect(screen.queryByText("XÁC NHẬN THAY ĐỔI QUYỀN")).not.toBeInTheDocument();
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
    expect.stringContaining("/roles/role-admin/permissions"),
    { permissionIds: ["perm-root", "perm-view"], restrictGroupView: false, restrictGroupEdit: false, groupReadOnly: false }, { withCredentials: true },
  ));
});

it("tick chọn quyền trong ma trận và lưu thay đổi theo mã quyền", async () => {
  mount(["role.view", "role.manage"]);
  await screen.findByText("Giảng viên hướng dẫn");

  fireEvent.click(screen.getByText("Giảng viên hướng dẫn"));

  const view = await screen.findByRole("checkbox", { name: "Xem tài khoản" });
  expect(view).toBeChecked();
  const manage = screen.getByRole("checkbox", { name: "Quản lý tài khoản" });
  expect(manage).not.toBeChecked();

  fireEvent.click(manage);
  axios.put.mockResolvedValue({ data: { message: "Cập nhật quyền cho vai trò thành công." } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
    expect.stringContaining("/roles/role-supervisor/permissions"),
    { permissionIds: ["perm-root", "perm-view", "perm-manage"], restrictGroupView: false, restrictGroupEdit: false, groupReadOnly: false },
    { withCredentials: true },
  ));
});

it("khóa ma trận và ẩn nút quản trị khi chỉ có quyền xem vai trò", async () => {
  mount(["role.view"]);
  await screen.findByText("Giảng viên hướng dẫn");

  fireEvent.click(screen.getByText("Giảng viên hướng dẫn"));

  expect(await screen.findByRole("checkbox", { name: "Quản lý tài khoản" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Lưu thay đổi" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Thêm vai trò" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Sửa" })).not.toBeInTheDocument();
});

it("tạo vai trò tùy chỉnh mới", async () => {
  mount(["role.view", "role.manage"]);
  await screen.findByText("Giảng viên hướng dẫn");

  axios.post.mockResolvedValue({ data: { message: "Tạo vai trò thành công.", data: { id: "role-clerk" } } });

  fireEvent.click(screen.getByRole("button", { name: "Thêm vai trò" }));
  fireEvent.change(screen.getByLabelText("Mã vai trò"), { target: { value: "thu_ky_khoa" } });
  fireEvent.change(screen.getByLabelText("Tên vai trò"), { target: { value: "Thư ký khoa" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/roles"),
    { code: "thu_ky_khoa", name: "Thư ký khoa", description: "" },
    { withCredentials: true },
  ));
});


it("các khóa mặc định tắt và lưu độc lập với quyền nghiệp vụ", async () => {
  mount(["role.view", "role.manage"]);
  const viewLock = await screen.findByRole("checkbox", { name: "Chỉ xem nhóm được phân công phụ trách" });
  const editLock = screen.getByRole("checkbox", { name: "Chỉ sửa nhóm được phân công phụ trách" });
  const readOnly = screen.getByRole("checkbox", { name: "Chỉ xem — khóa mọi thao tác sửa dữ liệu nhóm" });
  expect(viewLock).not.toBeChecked(); expect(editLock).not.toBeChecked(); expect(readOnly).not.toBeChecked();
  fireEvent.click(editLock); fireEvent.click(readOnly);
  axios.put.mockResolvedValue({ data: { message: "Đã lưu" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
    restrictGroupView: false, restrictGroupEdit: true, groupReadOnly: true,
  }), { withCredentials: true }));
});

const schedulingRole = (scopes) => {
  const permissions = [
    {id:'sr',code:'module.scheduling',name:'Module',moduleId:'scheduling',kind:'module'},
    { id: 'sv',moduleId:'scheduling',kind:'read', code: 'scheduling.view', name: 'Xem lịch' },
    { id: 'sw',moduleId:'scheduling',kind:'write',requires:['scheduling.view'], code: 'scheduling.write', name: 'Thao tác lịch' },
  ];
  axios.get.mockImplementation(url => Promise.resolve({ data: String(url).endsWith('/roles/permissions')
    ? [{ group: 'Lịch học', permissions }]
    : [{ id: 'scheduler', code: 'scheduler', name: 'Chuyên viên lịch', permissions, schedulingScopeVersion: 1, schedulingScopes: scopes }] }));
};

it('groups routes under the real menu and grants scheduling separately from offering creation',async()=>{
  const nav=path=>({section:'ĐÀO TẠO THẠC SĨ',group:'XẾP LỊCH HỌC',path,name:path.endsWith('/schedule')?'Lịch học':'Tạo lớp học phần'});
  const permissions=[
    {id:'root',code:'module.scheduling',moduleId:'scheduling',kind:'module',name:'Module'},
    {id:'view',code:'scheduling.view',moduleId:'scheduling',kind:'read',name:'Xem chung'},
    {id:'write',code:'scheduling.write',moduleId:'scheduling',kind:'write',name:'Xếp lịch',requires:['scheduling.view']},
    {id:'organize',code:'scheduling.organize',moduleId:'scheduling',kind:'write',name:'Tạo lớp',requires:['scheduling.view']},
    {id:'schedule-view',code:'route.masters.schedule.view',moduleId:'scheduling',kind:'read',name:'Xem lịch học',requires:['scheduling.view'],navigation:nav('/masters/schedule')},
    {id:'schedule-write',code:'route.masters.schedule.scheduling-write',moduleId:'scheduling',kind:'write',name:'Xếp lịch',requires:['route.masters.schedule.view','scheduling.write'],navigation:nav('/masters/schedule')},
    {id:'offering-view',code:'route.masters.course-offerings.view',moduleId:'scheduling',kind:'read',name:'Xem lớp',requires:['scheduling.view'],navigation:nav('/masters/course-offerings')},
    {id:'offering-write',code:'route.masters.course-offerings.scheduling-organize',moduleId:'scheduling',kind:'write',name:'Tạo lớp',requires:['route.masters.course-offerings.view','scheduling.organize'],navigation:nav('/masters/course-offerings')},
  ];
  axios.get.mockImplementation(url=>Promise.resolve({data:String(url).endsWith('/roles/permissions')?[{group:'Lịch',permissions}]:[{id:'scheduler',code:'scheduler',name:'Chuyên viên',permissions:permissions.slice(0,2)}]}));
  mount(['role.view','role.manage']);
  expect(await screen.findByRole('tree')).toHaveAttribute('aria-label','Cây phân quyền theo route');
  expect(screen.getByText('/masters/schedule')).toBeInTheDocument();
  expect(screen.getByRole('checkbox',{name:'Xếp lịch · Lịch học'})).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox',{name:'Xem Lịch học'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'Xếp lịch · Lịch học'}));
  expect(screen.getByRole('checkbox',{name:'Tạo lớp · Tạo lớp học phần'})).not.toBeChecked();
  axios.put.mockResolvedValue({data:{message:'Đã lưu'}});
  fireEvent.click(screen.getByRole('button',{name:'Lưu thay đổi'}));
  await waitFor(()=>expect(axios.put).toHaveBeenCalledWith(expect.any(String),expect.objectContaining({permissionIds:['root','view','write','schedule-view','schedule-write']}),expect.any(Object)));
});

it('tự động toàn viện và bỏ lựa chọn phạm vi cũ', async () => {
  schedulingRole({ 'scheduling.view': 'related_offerings', 'scheduling.write': 'related_offerings' });
  mount(['role.view', 'role.manage']);
  await screen.findByRole('tree');
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Xem lịch' })).toBeChecked());
  expect(screen.queryByLabelText('Phạm vi: Xem lịch')).not.toBeInTheDocument();
  axios.put.mockResolvedValue({ data: { message: 'Đã lưu' } });
  fireEvent.click(screen.getByRole('checkbox',{name:'Thao tác lịch'}));
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ permissionIds: ['sr','sv'] }), { withCredentials: true }));
  expect(axios.put.mock.calls[0][1]).not.toHaveProperty('schedulingScopes');
});
