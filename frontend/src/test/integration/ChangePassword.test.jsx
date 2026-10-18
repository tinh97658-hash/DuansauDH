import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
