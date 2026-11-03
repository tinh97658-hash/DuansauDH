import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import Login from "../../components/login";

vi.mock("axios", () => ({ default: { defaults: {}, get: vi.fn(), post: vi.fn() } }));

beforeEach(() => {
  axios.get.mockResolvedValue({ data: { googleAuthEnabled: false } });
  axios.post.mockRejectedValue({ response: { status: 401, data: { message: "Invalid credentials" } } });
});

function autofill(input, value) {
  // Simulate a password manager changing the DOM without an input/change event.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
}

it("submits autofilled DOM values even when React state has not received change events", async () => {
  render(<MemoryRouter><Login /></MemoryRouter>);
  autofill(screen.getByLabelText("Địa chỉ email công vụ"), " admin@example.com ");
  autofill(screen.getByLabelText("Mật khẩu quản trị"), " password with spaces ");
  fireEvent.submit(screen.getByRole("button", { name: "Đăng nhập hệ thống" }).closest("form"));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith("/user/login", {
    email: "admin@example.com", password: " password with spaces ",
  }, { withCredentials: true }));
  expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
  expect(screen.queryByText("400_BAD_INPUT")).not.toBeInTheDocument();
});

it("still blocks submission when the password input is actually empty", async () => {
  render(<MemoryRouter><Login /></MemoryRouter>);
  autofill(screen.getByLabelText("Địa chỉ email công vụ"), "admin@example.com");
  fireEvent.submit(screen.getByRole("button", { name: "Đăng nhập hệ thống" }).closest("form"));
  expect(await screen.findByText("400_BAD_INPUT")).toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
});
