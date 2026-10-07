import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import Lecturers from "../../pages/system/lecturers";

jest.mock("axios");
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });
jest.mock("@mui/icons-material", () => ({ AddRounded: () => null, DeleteRounded: () => null, EditRounded: () => null, SearchRounded: () => null }));
jest.mock("react-toastify", () => ({ toast: { success: jest.fn(), error: jest.fn() }, ToastContainer: () => null }));

const lecturer = {
  id: "lecturer-53", code: "53", name: "Nguyễn Đại An", faculty: "Khoa Máy tàu biển",
  academicRank: "Phó Giáo sư", academicDegree: "Tiến sĩ", teachingType: "Thỉnh giảng", active: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith("/auth/isStaff") ? { message: "admin" } : [lecturer] }));
  axios.put.mockResolvedValue({ data: lecturer });
  axios.post.mockResolvedValue({ data: lecturer });
});

it("shows the imported unit in the table and edit form and saves it without requiring a discipline", async () => {
  render(<Lecturers />);
  expect(await screen.findByText("Khoa Máy tàu biển")).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "Đơn vị" })).toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: "Ngành" })).not.toBeInTheDocument();
  const row = screen.getByText("Khoa Máy tàu biển").closest("tr");
  await waitFor(() => expect(row).toHaveAttribute("title", "Nhấp đúp để sửa"));
  fireEvent.doubleClick(row);
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByRole("textbox", { name: "Đơn vị" })).toHaveValue("Khoa Máy tàu biển");
  expect(within(dialog).queryByLabelText("Ngành")).not.toBeInTheDocument();
  expect(within(dialog).queryByLabelText("Chuyên ngành")).not.toBeInTheDocument();
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Đơn vị" }), { target: { value: "Viện Cơ khí" } });
  await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Lưu" })); });
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/system/lecturers/lecturer-53"), expect.objectContaining({ faculty: "Viện Cơ khí" }), { withCredentials: true }));
  expect(axios.put.mock.calls[0][1]).not.toHaveProperty("disciplineId");
  expect(axios.put.mock.calls[0][1]).not.toHaveProperty("majorId");
});

it("adds a lecturer with a unit", async () => {
  render(<Lecturers />);
  fireEvent.click(await screen.findByRole("button", { name: "Thêm mới" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Mã giảng viên" }), { target: { value: "53" } });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Họ và tên" }), { target: { value: "Nguyễn Đại An" } });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Đơn vị" }), { target: { value: "Khoa Máy tàu biển" } });
  await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Lưu" })); });
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/system/lecturers"), expect.objectContaining({ code: "53", name: "Nguyễn Đại An", faculty: "Khoa Máy tàu biển" }), { withCredentials: true }));
});
