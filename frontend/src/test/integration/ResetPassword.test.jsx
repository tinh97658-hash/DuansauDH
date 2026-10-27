import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import ResetPassword from "../../pages/resetPassword";
import { vi } from "vitest";

vi.mock("axios", () => ({ default: { patch: vi.fn() } }));
const token = "a".repeat(64);
const open = hash => {
  window.history.replaceState(null, "", `/reset-password${hash}`);
  render(<MemoryRouter useTransitions={false}><ResetPassword /></MemoryRouter>);
};
afterEach(() => cleanup());
it("removes the recovery token from the address bar and submits it only to the reset API", async () => {
  axios.patch.mockResolvedValue({ data: {} });
  open(`#${token}`);
  expect(window.location.hash).toBe("");
  fireEvent.change(screen.getByLabelText(/Mật khẩu mới/), { target: { value: "new-password" } });
  fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu/), { target: { value: "new-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu" }));
  await waitFor(() => expect(axios.patch).toHaveBeenCalledWith(`/user/resetPassword/${token}`, { password: "new-password" }));
  expect(await screen.findByText("Đã đặt lại mật khẩu và đăng xuất các phiên cũ.")).toBeInTheDocument();
});
it("does not send a request for an invalid link", () => {
  open("#invalid");
  expect(screen.getByRole("button", { name: "Đặt lại mật khẩu" })).toBeDisabled();
});
it("keeps the form available and shows the API error when a token has expired", async () => {
  axios.patch.mockRejectedValue({ response: { data: { message: "Mã đã hết hạn" } } });
  open(`#${token}`);
  fireEvent.change(screen.getByLabelText(/Mật khẩu mới/), { target: { value: "new-password" } });
  fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu/), { target: { value: "new-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu" }));
  expect(await screen.findByText("Mã đã hết hạn")).toBeInTheDocument();
});
