import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";
import axios from "axios";
import ChangePassword from "../../pages/system/changePassword";
import theme from "../../theme";
import { AuthSessionContext } from "../../context/AuthSession";

vi.mock("axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(), defaults: {} },
}));
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });

const mount = (session) => render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <AuthSessionContext.Provider value={session}>
      <MemoryRouter>
        <ChangePassword />
      </MemoryRouter>
    </AuthSessionContext.Provider>
  </ThemeProvider>,
);
beforeEach(() => { axios.post.mockReset(); axios.patch.mockReset(); });

it("keeps voluntary password changes on a navigable page", () => {
  mount({ user: { mustChangePassword: false }, refresh: vi.fn() });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("form", { name: "ĐỔI MẬT KHẨU" }).closest(".password-settings-page")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Đăng xuất" })).not.toBeInTheDocument();
});

it("keeps the forced dialog open on Escape and backdrop click, with POST logout available", async () => {
  axios.post.mockResolvedValueOnce({});
  mount({ user: { mustChangePassword: true }, refresh: vi.fn() });
  const dialog = screen.getByRole("dialog", { name: "ĐỔI MẬT KHẨU" });
  expect(within(dialog).queryByRole("button", { name: /Đóng|Hủy/ })).not.toBeInTheDocument();
  fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
  fireEvent.click(document.querySelector(".MuiBackdrop-root"));
  expect(dialog).toBeInTheDocument();
  expect(dialog).toHaveAttribute("aria-modal", "true");
  fireEvent.click(within(dialog).getByRole("button", { name: "Đăng xuất" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/user/logout"), {}, { withCredentials: true }));
  expect(axios.get).not.toHaveBeenCalled();
});

it("leaves forced logout retryable if the backend rejects it", async () => {
  axios.post.mockRejectedValueOnce(new Error("offline"));
  mount({ user: { mustChangePassword: true }, refresh: vi.fn() });
  fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  expect(await screen.findByText("Không thể đăng xuất. Vui lòng thử lại.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Đăng xuất" })).toBeEnabled();
});

it.each([
  ["", "NewPass456", "NewPass456", "Vui lòng nhập mật khẩu hiện tại."],
  ["OldPass123", "short", "short", "Mật khẩu mới phải có ít nhất 8 ký tự."],
  ["OldPass123", "OldPass123", "OldPass123", "Mật khẩu mới phải khác mật khẩu hiện tại."],
])("preserves validation for current=%s new=%s", async (current, next, confirm, message) => {
  mount({ user: {}, refresh: vi.fn() });
  fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới"), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));
  expect(await screen.findByText(message)).toBeInTheDocument();
  expect(axios.patch).not.toHaveBeenCalled();
});

it("shows backend errors, associates the helper and resets the form", async () => {
  axios.patch.mockRejectedValueOnce({ response: { data: { message: "Mật khẩu hiện tại không đúng." } } });
  mount({ user: {}, refresh: vi.fn() });
  const fields = [screen.getByLabelText("Mật khẩu hiện tại"), screen.getByLabelText("Mật khẩu mới"), screen.getByLabelText("Xác nhận mật khẩu mới")];
  expect(fields[1]).toHaveAccessibleDescription("Tối thiểu 8 ký tự.");
  fields.forEach((field, index) => fireEvent.change(field, { target: { value: index ? "NewPass456" : "WrongPass123" } }));
  fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));
  expect(await screen.findByText("Mật khẩu hiện tại không đúng.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Nhập lại" }));
  fields.forEach(field => expect(field).toHaveValue(""));
  expect(screen.queryByText("Mật khẩu hiện tại không đúng.")).not.toBeInTheDocument();
});

it("cảnh báo và đổi mật khẩu cho nhân sự còn mật khẩu khởi tạo", async () => {
  const refresh = vi.fn().mockResolvedValue(true);
  axios.patch.mockResolvedValue({ data: { message: "Đổi mật khẩu thành công." } });

  mount({ user: { mustChangePassword: true }, refresh });

  expect(screen.getByText(/Vui lòng đổi mật khẩu trước khi sử dụng các chức năng khác/)).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), { target: { value: "OldPass123" } });
  fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: "NewPass456" } });
  fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới"), { target: { value: "NewPass456" } });
  fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));

  await waitFor(() => expect(axios.patch).toHaveBeenCalledWith(
    expect.stringContaining("/accounts/me/password"),
    { currentPassword: "OldPass123", newPassword: "NewPass456" },
    { withCredentials: true },
  ));
  await waitFor(() => expect(refresh).toHaveBeenCalled());
});

it("chặn gửi khi xác nhận mật khẩu không khớp", async () => {
  mount({ user: {}, refresh: vi.fn() });

  fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), { target: { value: "OldPass123" } });
  fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: "NewPass456" } });
  fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới"), { target: { value: "Different1" } });
  fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));

  expect(await screen.findByText("Xác nhận mật khẩu không khớp.")).toBeInTheDocument();
  expect(axios.patch).not.toHaveBeenCalled();
});
