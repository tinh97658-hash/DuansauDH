import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import CreateClassGroups from "../../pages/masters/createClassGroups";

jest.mock("axios");

const year = String(new Date().getFullYear());
const major = { id: "major-1", code: "CNTT", name: "Công nghệ thông tin" };
const eligibleStudents = Array.from({ length: 50 }, (_, index) => ({
  id: `student-${index + 1}`,
  fullName: `Học viên ${index + 1}`,
  assignedGroup: null,
}));

const mockRequests = () => {
  axios.get.mockImplementation(async (url) => {
    if (url.includes("/system/majors")) return { data: [major] };
    if (url.includes("/auth/isStaff")) return { data: { message: "admin" } };
    if (url.includes("/eligible-students")) return { data: eligibleStudents };
    if (url.includes("/masters/class-groups")) return { data: [] };
    return { data: [] };
  });
  axios.post.mockResolvedValue({ data: { success: true } });
};

const renderPage = () => render(
  <MemoryRouter>
    <CreateClassGroups />
  </MemoryRouter>,
);

const openCreateDialog = async () => {
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "Thêm nhóm mới" }));
  return screen.getByRole("dialog");
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRequests();
});

test("auto assignment is off by default and progressively reveals its controls", async () => {
  await openCreateDialog();
  const checkbox = screen.getByRole("checkbox", { name: /Phân học viên tự động/ });

  expect(checkbox).not.toBeChecked();
  expect(screen.queryByRole("button", { name: "Cân bằng sĩ số" })).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Số nhóm cần tạo"), { target: { value: "2" } });
  fireEvent.click(checkbox);
  expect(await screen.findByRole("button", { name: "Cân bằng sĩ số" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Theo địa bàn" })).toBeDisabled();

  fireEvent.click(checkbox);
  expect(screen.queryByRole("button", { name: "Cân bằng sĩ số" })).not.toBeInTheDocument();
});

test("changing group count refreshes names and the auto action summary", async () => {
  await openCreateDialog();
  fireEvent.change(screen.getByLabelText("Số nhóm cần tạo"), { target: { value: "3" } });

  expect(await screen.findByText(`CNTT${year}.01`)).toBeInTheDocument();
  expect(screen.getByText(`CNTT${year}.02`)).toBeInTheDocument();
  expect(screen.getByText(`CNTT${year}.03`)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("checkbox", { name: /Phân học viên tự động/ }));
  expect(await screen.findByRole("button", { name: "Tạo 3 nhóm & phân 50 học viên" })).toBeEnabled();
});

test("shell creation stays available when auto assignment is off", async () => {
  await openCreateDialog();
  fireEvent.change(screen.getByLabelText("Số nhóm cần tạo"), { target: { value: "3" } });
  fireEvent.click(await screen.findByRole("button", { name: "Tạo 3 nhóm" }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/masters/class-groups/batch"),
    expect.objectContaining({ count: 3, autoAssign: false }),
    { withCredentials: true },
  ));
});
