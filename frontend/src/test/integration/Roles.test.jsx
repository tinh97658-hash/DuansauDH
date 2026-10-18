import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import axios from "axios";
import Roles from "../../pages/system/roles";
import theme from "../../theme";
import { AuthSessionContext } from "../../context/AuthSession";

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

const mount = (permissions) => render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
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

it("hiển thị vai trò hệ thống toàn quyền mà không cần ma trận", async () => {
  mount(["role.view", "role.manage"]);

  expect(await screen.findByText(/Vai trò quản trị có toàn quyền trên hệ thống/)).toBeInTheDocument();
  expect(screen.getByText("Giảng viên hướng dẫn")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Lưu quyền" })).not.toBeInTheDocument();
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
    { permissionIds: ["perm-view", "perm-manage"] },
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
