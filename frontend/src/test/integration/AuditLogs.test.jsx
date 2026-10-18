import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import axios from "axios";
import AuditLogs from "../../pages/system/auditLogs";
import theme from "../../theme";

vi.mock("axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(), defaults: {} },
}));
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });

const AUDIT_ROWS = [
  {
    id: "log-1",
    action: "account.create",
    metadata: { email: "an@example.com" },
    ip: "127.0.0.1",
    userAgent: "test",
    createdAt: "2026-01-02T08:00:00Z",
    actor: { id: "s1", name: "Administrator", email: "admin@example.com" },
    target: { id: "s2", name: "Nguyễn Văn An", email: "an@example.com" },
  },
];

const CHANGE_ROWS = [
  {
    id: 10,
    tableName: "staff",
    operation: "UPDATE",
    rowPk: '{"id":"s2"}',
    oldData: { name: "Cũ" },
    newData: { name: "Mới" },
    changedColumns: ["name"],
    actorStaffId: null,
    actorEmail: "admin@example.com",
    requestId: "req-1",
    ip: null,
    userAgent: null,
    changedAt: "2026-01-03T09:30:00Z",
  },
];

beforeEach(() => {
  axios.get.mockImplementation((url) => {
    const value = String(url);
    if (value.endsWith("/accounts/change-logs/tables")) return Promise.resolve({ data: ["staff", "roles"] });
    if (value.endsWith("/accounts/change-logs")) return Promise.resolve({ data: { rows: CHANGE_ROWS, total: 1, page: 1, pageSize: 25 } });
    if (value.endsWith("/accounts/audit-logs")) return Promise.resolve({ data: { rows: AUDIT_ROWS, total: 1, page: 1, pageSize: 25 } });
    return Promise.resolve({ data: { rows: [], total: 0 } });
  });
});

const mount = () => render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <AuditLogs />
  </ThemeProvider>,
);

it("hiển thị nhật ký thao tác quản lý ở tab mặc định", async () => {
  mount();

  expect(await screen.findByText("Tạo tài khoản")).toBeInTheDocument();
  expect(screen.getByRole("table", { name: "Nhật ký thao tác" })).toBeInTheDocument();
  expect(screen.getByText("Administrator (admin@example.com)")).toBeInTheDocument();
});

it("chuyển sang tab thay đổi dữ liệu và hiển thị vết thay đổi", async () => {
  mount();
  await screen.findByText("Tạo tài khoản");

  fireEvent.click(screen.getByRole("tab", { name: "Thay đổi dữ liệu" }));

  expect(await screen.findByText("Cập nhật")).toBeInTheDocument();
  expect(screen.getByRole("table", { name: "Nhật ký thay đổi dữ liệu" })).toBeInTheDocument();
  expect(screen.getByText("Nhân sự")).toBeInTheDocument();
  expect(screen.getByText('{"id":"s2"}')).toBeInTheDocument();
  expect(screen.getByText("admin@example.com")).toBeInTheDocument();
});
