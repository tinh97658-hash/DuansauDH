import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import Users from "../../pages/system/users";

jest.mock("axios");
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });

it("lets the administrator review the transfer before assigning a real account", async () => {
  axios.get.mockResolvedValue({ data: [
    { id: "old", name: "Người cũ", email: "old@example.com", role: "supervisor", canManageScheduling: true },
    { id: "new", name: "Người mới", email: "new@example.com", role: "supervisor", canManageScheduling: false },
  ] });
  axios.put.mockResolvedValue({ data: { id: "new" } });
  render(<Users />);
  fireEvent.click(await screen.findByRole("button", { name: "Phân công phụ trách" }));
  expect(screen.getByText(/Quyền phụ trách của Người cũ/)).toBeInTheDocument();
  expect(axios.put).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận phân công" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/scheduling/assignee"), { staffId: "new" }, { withCredentials: true }));
  expect(await screen.findByText(/Đã phân công Người mới/)).toBeInTheDocument();
});

it("does not expose assignment controls when the server denies access", async () => {
  axios.get.mockRejectedValue({ response: { status: 403 } });
  render(<Users />);
  expect(await screen.findByText("Chỉ quản trị viên được xem và phân công quyền người dùng.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Phân công phụ trách" })).not.toBeInTheDocument();
});
