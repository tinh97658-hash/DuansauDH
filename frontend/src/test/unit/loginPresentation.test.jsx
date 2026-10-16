import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import axios from "axios";
import { toast } from "react-toastify";
import Login from "../../components/login";

const mockNavigate = jest.fn();
jest.mock("axios");
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }));
jest.mock("react-toastify", () => ({ ToastContainer: () => null, toast: { success: jest.fn(), error: jest.fn() } }));

it("keeps the typed email and the existing login submission/navigation contract", async () => {
  axios.get.mockResolvedValue({ data: { googleAuthEnabled: false } });
  let completeLogin;
  axios.post.mockImplementation(() => new Promise(resolve => { completeLogin = resolve; }));
  render(<Login />);
  await act(async () => {});
  fireEvent.change(screen.getByLabelText("Địa chỉ email công vụ"), { target: { value: "admin@example.com" } });
  const password = screen.getByLabelText("Mật khẩu quản trị");
  fireEvent.change(password, { target: { value: "Demo-password-123" } });
  fireEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu" }));
  expect(password).toHaveAttribute("type", "text");
  fireEvent.click(screen.getByRole("button", { name: "Ẩn mật khẩu" }));
  expect(password).toHaveAttribute("type", "password");
  fireEvent.submit(screen.getByRole("button", { name: "Đăng nhập hệ thống" }).closest("form"));
  expect(axios.post).toHaveBeenCalledWith("/user/login", { email: "admin@example.com", password: "Demo-password-123" }, { withCredentials: true });
  expect(screen.getByRole("button", { name: "Đang đăng nhập..." })).toBeDisabled();
  await act(async () => { completeLogin({ data: {} }); });
  expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  expect(toast.success).toHaveBeenCalled();
});
