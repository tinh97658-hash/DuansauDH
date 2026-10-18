import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import axios from "axios";
import Accounts from "../../pages/system/accounts";
import theme from "../../theme";
import { AuthSessionContext } from "../../context/AuthSession";

vi.mock("axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(), defaults: {} },
}));
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });

const ROLES = [
  { id: "role-admin", code: "admin", name: "Quản trị hệ thống", active: true, isSystem: true, isSuperadmin: true },
  { id: "role-examiner", code: "examiner", name: "Giám khảo chấm thi", active: true, isSystem: true, isSuperadmin: false },
];

const ACCOUNTS = [
  {
    id: "acc-1", name: "Nguyễn Văn An", email: "an@example.com", role: "admin", status: "active",
    roles: [ROLES[0]], canManageScheduling: false,
  },
  {
    id: "acc-2", name: "Trần Thị Bình", email: "binh@example.com", role: "examiner", status: "disabled",
    roles: [ROLES[1]], canManageScheduling: true,
  },
];

const ALL_PERMISSIONS = ["account.view", "account.manage", "account.password.reset", "scheduling.assign"];

const mount = (permissions) => render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <AuthSessionContext.Provider value={{ access: { superadmin: false, permissions, roles: [] } }}>
      <Accounts />
    </AuthSessionContext.Provider>
  </ThemeProvider>,
);

beforeEach(() => {
  axios.get.mockImplementation((url) => {
    if (String(url).endsWith("/roles")) return Promise.resolve({ data: ROLES });
    if (String(url).endsWith("/accounts")) return Promise.resolve({ data: ACCOUNTS });
    return Promise.resolve({ data: [] });
  });
});

it("liệt kê tài khoản nhân sự và mở các thao tác quản trị cho người có quyền", async () => {
  mount(ALL_PERMISSIONS);

  expect(await screen.findByText("an@example.com")).toBeInTheDocument();
  expect(screen.getByRole("table", { name: "Tài khoản nhân sự" })).toBeInTheDocument();
  expect(screen.getByText("binh@example.com")).toBeInTheDocument();

  expect(screen.getByRole("button", { name: "Thêm tài khoản" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Sửa an@example.com" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Khóa an@example.com" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Mở khóa binh@example.com" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Đặt lại mật khẩu an@example.com" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Phân công xếp lịch an@example.com" })).toBeInTheDocument();
});

it("ẩn toàn bộ điều khiển quản trị khi tài khoản chỉ có quyền xem", async () => {
  mount(["account.view"]);

  await screen.findByText("an@example.com");

  expect(screen.queryByRole("button", { name: "Thêm tài khoản" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Sửa / })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Đặt lại mật khẩu / })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Phân công xếp lịch / })).not.toBeInTheDocument();
  expect(screen.queryByText(/Người phụ trách tổ chức lớp và xếp lịch hiện tại/)).not.toBeInTheDocument();
});

it("đặt lại mật khẩu và chỉ hiển thị mật khẩu sinh tự động một lần", async () => {
  mount(ALL_PERMISSIONS);
  await screen.findByText("binh@example.com");

  axios.post.mockResolvedValue({ data: { message: "Đặt lại mật khẩu thành công.", generatedPassword: "Temp-9xQ2z7" } });

  fireEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu binh@example.com" }));
  fireEvent.click(screen.getByRole("button", { name: "Đặt lại" }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/accounts/acc-2/reset-password"),
    {},
    { withCredentials: true },
  ));
  expect(await screen.findByDisplayValue("Temp-9xQ2z7")).toBeInTheDocument();
});

it("tạo tài khoản mới với vai trò chính và mật khẩu sinh tự động", async () => {
  mount(ALL_PERMISSIONS);
  await screen.findByText("an@example.com");

  axios.post.mockResolvedValue({ data: { message: "Tạo tài khoản thành công.", generatedPassword: "Init-1a2b3c" } });

  fireEvent.click(screen.getByRole("button", { name: "Thêm tài khoản" }));
  fireEvent.change(screen.getByLabelText("Họ và tên"), { target: { value: "Lê Văn Cường" } });
  fireEvent.change(screen.getByLabelText("Email công vụ"), { target: { value: "cuong@example.com" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Giám khảo chấm thi (hệ thống)" }));
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/accounts"),
    expect.objectContaining({ name: "Lê Văn Cường", email: "cuong@example.com", roleIds: ["role-examiner"], primaryRoleId: "role-examiner" }),
    { withCredentials: true },
  ));
  expect(await screen.findByDisplayValue("Init-1a2b3c")).toBeInTheDocument();
});

it("lọc danh sách theo từ khóa họ tên hoặc email", async () => {
  mount(ALL_PERMISSIONS);
  await screen.findByText("an@example.com");

  fireEvent.change(screen.getByRole("textbox", { name: "Tìm kiếm" }), { target: { value: "Bình" } });

  expect(screen.queryByText("an@example.com")).not.toBeInTheDocument();
  expect(screen.getByText("binh@example.com")).toBeInTheDocument();
});
