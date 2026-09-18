import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import ClassCourseHistory from "../../pages/masters/classCourseHistory";

jest.mock("axios");
jest.mock("@mui/icons-material", () => new Proxy({}, { get: () => () => null }));
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });

const major = { id: "major-1", code: "CNT", name: "Công nghệ thông tin" };
const groups = [
  { id: "group-1", code: "CNT2027.01", majorId: major.id, academicYear: "2027" },
  { id: "group-2", code: "CNT2027.02", majorId: major.id, academicYear: "2027" },
];
const baseSummary = { totalSubjectCount: 2, completedSubjectCount: 0, inProgressSubjectCount: 1, scheduledSubjectCount: 0, notStartedSubjectCount: 1 };

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockImplementation(async (url) => {
    if (url.includes("/system/majors")) return { data: [major] };
    if (url.includes("/plan/classes")) return { data: groups };
    if (url.includes("/scheduling/class-curriculum-progress")) return { data: {
      scope: { major, academicYear: "2027" },
      classes: [
        { ...groups[0], memberCount: 31, major, curriculum: { code: "K67" }, summary: baseSummary, subjects: [
          { curriculumSubjectId: "subject-1", code: "NCKH01", name: "Phương pháp nghiên cứu khoa học", status: "in_progress", heldSessionCount: 3, sessionCount: 4, lecturer: { name: "TS. Trần Minh Bình" }, room: { code: "P.402" }, schedule: { sessionDate: "2027-09-20", startTime: "13:30:00", period: "AFTERNOON" } },
          { curriculumSubjectId: "subject-2", code: "HPT02", name: "Hệ phân tán", status: "not_started", heldSessionCount: 0, sessionCount: 0, lecturer: null, room: null, schedule: null },
        ] },
        { ...groups[1], memberCount: 28, major, curriculum: { code: "K67" }, summary: { ...baseSummary, inProgressSubjectCount: 0, notStartedSubjectCount: 2 }, subjects: [] },
      ],
    } };
    return { data: [] };
  });
});

it("shows class overview cards and the selected class progress table", async () => {
  render(<MemoryRouter><ClassCourseHistory /></MemoryRouter>);

  expect(await screen.findByText("Vui lòng chọn chuyên ngành và khóa / năm học để xem tiến độ.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Chuyên ngành"), { target: { value: major.id } });
  fireEvent.change(screen.getByLabelText("Khóa / năm học"), { target: { value: "2027" } });

  expect(await screen.findByRole("heading", { name: "CNT2027.01" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /CNT2027.02/ })).toBeInTheDocument();
  expect(screen.getByText("Phương pháp nghiên cứu khoa học")).toBeInTheDocument();
  expect(screen.getByText("NCKH01")).toBeInTheDocument();
  expect(screen.getByText("TS. Trần Minh Bình")).toBeInTheDocument();
  expect(screen.getByText("20/09 · Chiều")).toBeInTheDocument();
  expect(screen.getByText("P.402")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("row", { name: "Nhấn để xem chi tiết Phương pháp nghiên cứu khoa học" }));
  expect(screen.getByText(/Tổng lịch/)).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "not_started" } });
  expect(screen.getByText("Hệ phân tán")).toBeInTheDocument();
  expect(screen.queryByText("Phương pháp nghiên cứu khoa học")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "all" } });
  fireEvent.change(screen.getByPlaceholderText("Tìm mã, học phần, giảng viên..."), { target: { value: "NCKH01" } });
  expect(screen.getByText("Phương pháp nghiên cứu khoa học")).toBeInTheDocument();
  expect(screen.queryByText("Hệ phân tán")).not.toBeInTheDocument();
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/scheduling/class-curriculum-progress"), expect.objectContaining({
    params: { majorId: major.id, academicYear: "2027" }, withCredentials: true,
  })));
});
