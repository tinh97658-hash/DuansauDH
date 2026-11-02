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
      { id: "perm-view", code: "account.view", name: "Xem tài khoản" },
      { id: "perm-manage", code: "account.manage", name: "Quản lý tài khoản" },
    ],
  },
];

const ROLES = [
  {
    id: "role-admin", code: "admin", name: "Quản trị hệ thống", description: null,
    isSystem: true, isSuperadmin: true, active: true, staffCount: 1,
    permissions: [{ id: "perm-view", code: "account.view", name: "Xem tài khoản" }, { id: "perm-manage", code: "account.manage", name: "Quản lý tài khoản" }],
  },
  {
    id: "role-supervisor", code: "supervisor", name: "Giảng viên hướng dẫn", description: "Theo dõi học viên",
    isSystem: true, isSuperadmin: false, active: true, staffCount: 0,
    permissions: [{ id: "perm-view", code: "account.view", name: "Xem tài khoản" }],
  },
];

it('lets admin grant request permissions to supervisor while reserving approvals for admin', async () => {
  const permissions = [
    { id: 'request', code: 'studyleave.request', name: 'Tạo yêu cầu bảo lưu' },
    { id: 'approve', code: 'studyleave.approve', name: 'Duyệt bảo lưu', assignableRoleCodes: ['admin'] },
  ];
  axios.get.mockImplementation(url => Promise.resolve({ data: String(url).endsWith('/roles/permissions') ? [{ group: 'Bảo lưu', permissions }] : [ROLES[1]] }));
  axios.put.mockResolvedValue({ data: { message: 'Đã lưu' } });
  mount(['role.view', 'role.manage']);
  const request = await screen.findByRole('checkbox', { name: 'Tạo yêu cầu bảo lưu' });
  expect(request).toBeEnabled();
  expect(screen.getByRole('checkbox', { name: 'Duyệt bảo lưu' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn tất cả Bảo lưu' }));
  expect(request).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Lưu quyền' }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/role-supervisor/permissions'), expect.objectContaining({ permissionIds: ['request'] }), expect.any(Object)));
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

it("shows permission-save feedback once as a toast", async () => {
  mount(["role.view", "role.manage"]);
  await screen.findByRole("checkbox", { name: "Quản lý tài khoản" });
  axios.put.mockResolvedValueOnce({ data: { message: "Cập nhật quyền cho vai trò thành công." } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu quyền" }));
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
  fireEvent.click(screen.getByRole("button", { name: "Lưu quyền" }));
  expect(screen.queryByText("XÁC NHẬN THAY ĐỔI QUYỀN")).not.toBeInTheDocument();
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
    expect.stringContaining("/roles/role-admin/permissions"),
    { permissionIds: ["perm-view"], restrictGroupView: false, restrictGroupEdit: false, groupReadOnly: false }, { withCredentials: true },
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
  fireEvent.click(screen.getByRole("button", { name: "Lưu quyền" }));

  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
    expect.stringContaining("/roles/role-supervisor/permissions"),
    { permissionIds: ["perm-view", "perm-manage"], restrictGroupView: false, restrictGroupEdit: false, groupReadOnly: false },
    { withCredentials: true },
  ));
});

it("khóa ma trận và ẩn nút quản trị khi chỉ có quyền xem vai trò", async () => {
  mount(["role.view"]);
  await screen.findByText("Giảng viên hướng dẫn");

  fireEvent.click(screen.getByText("Giảng viên hướng dẫn"));

  expect(await screen.findByRole("checkbox", { name: "Quản lý tài khoản" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Lưu quyền" })).not.toBeInTheDocument();
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
  fireEvent.click(screen.getByRole("button", { name: "Lưu quyền" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
    restrictGroupView: false, restrictGroupEdit: true, groupReadOnly: true,
  }), { withCredentials: true }));
});

const schedulingRole = (scopes) => {
  const permissions = [
    { id: 'sv', code: 'scheduling.view', name: 'Xem lịch' },
    { id: 'sw', code: 'scheduling.write', name: 'Thao tác lịch' },
  ];
  axios.get.mockImplementation(url => Promise.resolve({ data: String(url).endsWith('/roles/permissions')
    ? [{ group: 'Lịch học', permissions }]
    : [{ id: 'scheduler', code: 'scheduler', name: 'Chuyên viên lịch', permissions, schedulingScopeVersion: 1, schedulingScopes: scopes }] }));
};

it('tự động toàn viện và bỏ lựa chọn phạm vi cũ', async () => {
  schedulingRole({ 'scheduling.view': 'related_offerings', 'scheduling.write': 'related_offerings' });
  mount(['role.view', 'role.manage']);
  await screen.findByText(/tự động có phạm vi Toàn viện/);
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Xem lịch' })).toBeChecked());
  expect(screen.queryByLabelText('Phạm vi: Xem lịch')).not.toBeInTheDocument();
  axios.put.mockResolvedValue({ data: { message: 'Đã lưu' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu quyền' }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ permissionIds: ['sv', 'sw'] }), { withCredentials: true }));
  expect(axios.put.mock.calls[0][1]).not.toHaveProperty('schedulingScopes');
});
