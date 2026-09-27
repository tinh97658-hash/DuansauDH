import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import CreateClassGroups from "../../pages/masters/createClassGroups";

jest.mock("axios");

const year = String(new Date().getFullYear());
const major = { id: "major-1", code: "CNTT", name: "Công nghệ thông tin" };
const curriculum = { id: "curriculum-1", code: `CT-CNTT-${year}`, name: "CTĐT CNTT", applicableFromYear: year, active: true };
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
    if (url.includes("/plan/curriculums")) return { data: [curriculum] };
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
  const createButton = await screen.findByRole("button", { name: "Tạo 3 nhóm" });
  await waitFor(() => expect(createButton).toBeEnabled());
  fireEvent.click(createButton);

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/masters/class-groups/batch"),
    expect.objectContaining({ count: 3, autoAssign: false }),
    { withCredentials: true },
  ));
});

test("opens edit dialog with Image 2 compact layout and updates class group", async () => {
  const existingGroup = {
    id: "group-1",
    code: `CNTT${year}.01`,
    name: `Lớp Thạc sĩ CNTT Khóa ${year} - Lớp 01`,
    majorId: "major-1",
    curriculumId: "curriculum-1",
    academicYear: year,
    maxStudents: 40,
    status: "open",
    note: "Ghi chú ban đầu",
    memberCount: 0,
    major,
    curriculum,
  };
  axios.get.mockImplementation(async (url) => {
    if (url.includes("/system/majors")) return { data: [major] };
    if (url.includes("/auth/isStaff")) return { data: { message: "admin" } };
    if (url.includes("/eligible-students")) return { data: eligibleStudents };
    if (url.includes("/plan/curriculums")) return { data: [curriculum] };
    if (url.includes("/masters/class-groups")) return { data: [existingGroup] };
    return { data: [] };
  });
  axios.put = jest.fn().mockResolvedValue({ data: { success: true } });

  renderPage();
  const editButton = await screen.findByRole("button", { name: "Chỉnh sửa" });
  fireEvent.click(editButton);

  expect(await screen.findByText("CHỈNH SỬA NHÓM HỌC VIÊN")).toBeInTheDocument();
  expect(screen.getByLabelText("Mã nhóm")).toHaveValue(`CNTT${year}.01`);
  expect(screen.getByLabelText("Tên nhóm học viên")).toHaveValue(`Lớp Thạc sĩ CNTT Khóa ${year} - Lớp 01`);
  expect(screen.getByLabelText("Sĩ số tối đa / nhóm")).toHaveValue(40);

  fireEvent.change(screen.getByLabelText("Tên nhóm học viên"), { target: { value: "Lớp Thạc sĩ CNTT - Nhóm A" } });
  const saveButton = screen.getByRole("button", { name: "Lưu nhóm" });
  fireEvent.click(saveButton);

  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
    expect.stringContaining("/masters/class-groups/group-1"),
    expect.objectContaining({
      code: `CNTT${year}.01`,
      name: "Lớp Thạc sĩ CNTT - Nhóm A",
      maxStudents: 40,
    }),
    { withCredentials: true },
  ));
});
