import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import axios from "axios";
import CourseMatrixPage from "../../pages/masters/courseMatrix";

jest.mock("axios");
jest.mock("../../components/FeatureLayout", () => function FeatureLayout({ children }) { return <div>{children}</div>; });
jest.mock("../../features/scheduling/OfferingDetails", () => function OfferingDetails({ offering, onClose }) {
  return <div role="dialog" aria-label={`Chi tiết ${offering.name}`}><button type="button" onClick={onClose}>Đóng</button></div>;
});

const major = { id: "major-1", name: "Khai thác hàng hải", code: "KTHH" };

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Vị trí hiện tại">{`${location.pathname}${location.search}`}</output>;
}

function offering({
  id,
  cohort = "2030",
  subjectId = `subject-${id}`,
  subjectName = `Học phần ${id}`,
  credits = 3,
  totalCount = 0,
  status = "active",
  participantCount = 18,
  linkedCohorts = [cohort],
}) {
  return {
    id,
    name: `Lớp ${subjectName} ${id}`,
    subjectId,
    subject: { id: subjectId, code: subjectId.toUpperCase(), name: subjectName, credits },
    status,
    participantCount,
    groupLinks: linkedCohorts.map((academicYear, index) => ({
      classGroupId: `${id}-group-${academicYear}`,
      classGroup: {
        id: `${id}-group-${academicYear}`,
        code: `K${academicYear}-${index + 1}`,
        name: `Nhóm ${academicYear}`,
        academicYear,
        majorId: major.id,
      },
    })),
    sessionSummary: { totalCount, heldCount: 0, futurePlannedCount: totalCount },
  };
}

function mockRequests(offerings, user = { role: "admin", canManageScheduling: true }) {
  axios.get.mockImplementation(async (url) => ({
    data: url.endsWith("/auth/session") ? { user }
      : url.includes("/system/majors") ? [major, { id: "major-2", name: "Quản trị kinh doanh", code: "QTKD" }]
        : url.includes("/scheduling/course-offerings") ? offerings
          : [],
  }));
}

function renderMatrix(offerings, user) {
  mockRequests(offerings, user);
  return render(
    <MemoryRouter initialEntries={["/masters/course-matrix"]}>
      <CourseMatrixPage />
      <LocationProbe />
    </MemoryRouter>
  );
}

function cohortHeaders() {
  return screen.getAllByRole("columnheader")
    .map((header) => header.textContent.trim())
    .filter((name) => name.startsWith("KHÓA "));
}

async function openMatrix() {
  fireEvent.click(await screen.findByRole("button", { name: "Bảng ma trận môn" }));
  return screen.findByRole("table", { name: "Ma trận học phần theo khóa" });
}

beforeEach(() => jest.clearAllMocks());
afterEach(cleanup);

it.each([1, 2, 3, 4])("fills a four-year matrix window from %i actual cohorts", async (count) => {
  const offerings = Array.from({ length: count }, (_, index) => offering({
    id: String(2030 - index),
    cohort: String(2030 - index),
  }));
  renderMatrix(offerings);

  await screen.findByRole("region", { name: "Khóa 2030" });
  const matrix = await openMatrix();

  expect(cohortHeaders()).toEqual(["KHÓA 2030", "KHÓA 2029", "KHÓA 2028", "KHÓA 2027"]);
  expect(within(matrix).getAllByText("—")).toHaveLength(count * 3);
  expect(screen.queryByRole("button", { name: "Xem khóa mới hơn" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Xem khóa cũ hơn" })).not.toBeInTheDocument();
  expect(within(matrix).getAllByRole("button", { name: /Xem chi tiết Lớp Học phần 20/ })).toHaveLength(count);
});

it("uses consecutive years for sparse history and hides unavailable window directions", async () => {
  const offerings = ["2026", "2025", "2022"].map((cohort) => offering({ id: `offering-${cohort}`, cohort }));
  renderMatrix(offerings);

  await openMatrix();
  expect(cohortHeaders()).toEqual(["KHÓA 2026", "KHÓA 2025", "KHÓA 2024", "KHÓA 2023"]);
  expect(screen.queryByRole("button", { name: "Xem khóa mới hơn" })).not.toBeInTheDocument();
  const older = screen.getByRole("button", { name: "Xem khóa cũ hơn" });
  fireEvent.click(older);
  expect(cohortHeaders()).toEqual(["KHÓA 2025", "KHÓA 2024", "KHÓA 2023", "KHÓA 2022"]);
  expect(screen.queryByRole("button", { name: "Xem khóa cũ hơn" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Xem khóa mới hơn" })).toBeInTheDocument();
});

it("moves an eleven-year history by one year without refetching and keeps the window stable through filters", async () => {
  const offerings = Array.from({ length: 11 }, (_, index) => offering({
    id: `offering-${2026 - index}`,
    cohort: String(2026 - index),
  }));
  renderMatrix(offerings);

  await openMatrix();
  expect(cohortHeaders()).toEqual(["KHÓA 2026", "KHÓA 2025", "KHÓA 2024", "KHÓA 2023"]);
  const kpis = screen.getByRole("region", { name: "Chỉ số tổng quan" });
  expect(within(kpis).getAllByText("11")).toHaveLength(2);
  const requestsBeforeWindowChange = axios.get.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Xem khóa cũ hơn" }));
  expect(cohortHeaders()).toEqual(["KHÓA 2025", "KHÓA 2024", "KHÓA 2023", "KHÓA 2022"]);
  expect(axios.get).toHaveBeenCalledTimes(requestsBeforeWindowChange);
  expect(within(kpis).getAllByText("11")).toHaveLength(2);

  fireEvent.change(screen.getByLabelText("Tìm kiếm"), { target: { value: "không có kết quả" } });
  expect(cohortHeaders()).toEqual(["KHÓA 2025", "KHÓA 2024", "KHÓA 2023", "KHÓA 2022"]);
  expect(screen.getByText(/Không tìm thấy lớp học phần/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Tình trạng lịch"), { target: { value: "completed" } });
  fireEvent.change(screen.getByLabelText("Chuyên ngành"), { target: { value: "major-2" } });
  expect(cohortHeaders()).toEqual(["KHÓA 2025", "KHÓA 2024", "KHÓA 2023", "KHÓA 2022"]);
  expect(screen.getByRole("button", { name: "Xem khóa mới hơn" })).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Khóa / năm học"), { target: { value: "2025" } });
  expect(cohortHeaders()).toEqual(["KHÓA 2025"]);
  expect(screen.queryByRole("button", { name: "Xem khóa mới hơn" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Xem khóa cũ hơn" })).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Khóa / năm học"), { target: { value: "" } });
  expect(cohortHeaders()).toEqual(["KHÓA 2026", "KHÓA 2025", "KHÓA 2024", "KHÓA 2023"]);
  fireEvent.change(screen.getByLabelText("Tìm kiếm"), { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("Tình trạng lịch"), { target: { value: "all" } });
  fireEvent.change(screen.getByLabelText("Chuyên ngành"), { target: { value: "" } });

  for (let index = 0; index < 7; index += 1) {
    fireEvent.click(screen.getByRole("button", { name: "Xem khóa cũ hơn" }));
  }
  expect(cohortHeaders()).toEqual(["KHÓA 2019", "KHÓA 2018", "KHÓA 2017", "KHÓA 2016"]);
  expect(screen.queryByRole("button", { name: "Xem khóa cũ hơn" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Xem khóa mới hơn" })).toBeInTheDocument();
});

it("keeps empty cells, multiple offerings, and a repeated cross-cohort offering distinguishable in the matrix", async () => {
  const sharedSubject = "subject-shared";
  const offerings = [
    offering({ id: "first", cohort: "2028", subjectId: sharedSubject, subjectName: "Học phần chung" }),
    offering({ id: "second", cohort: "2028", subjectId: sharedSubject, subjectName: "Học phần chung", totalCount: 3 }),
    offering({ id: "cross", cohort: "2028", subjectId: "subject-cross", subjectName: "Học phần ghép", linkedCohorts: ["2028", "2027"] }),
    offering({ id: "only-2028", cohort: "2028", subjectId: "subject-empty", subjectName: "Học phần có ô trống" }),
    offering({ id: "year-2027", cohort: "2027" }),
  ];
  renderMatrix(offerings);

  const matrix = await openMatrix();
  expect(screen.getAllByText("GHÉP 2028 · 2027")).toHaveLength(2);
  expect(screen.getByText("Lớp Học phần chung first")).toBeInTheDocument();
  expect(screen.getByText("Lớp Học phần chung second")).toBeInTheDocument();
  const emptySubjectRow = within(matrix).getByRole("row", { name: /SUBJECT-EMPTY.*Học phần có ô trống/ });
  expect(within(emptySubjectRow).getAllByText("—")).toHaveLength(3);

  fireEvent.click(screen.getByRole("button", { name: "Dạng cột theo khóa" }));
  expect(screen.getAllByText("GHÉP 2028 · 2027")).toHaveLength(2);
});

it("keeps detail triggers and scheduling actions tied to the offering, with completed and read-only offerings non-actionable", async () => {
  const activeUnscheduled = offering({ id: "unscheduled", cohort: "2028", totalCount: 0 });
  const activeScheduled = offering({ id: "scheduled", cohort: "2028", totalCount: 3 });
  const completed = offering({ id: "completed", cohort: "2028", totalCount: 4, status: "completed" });
  renderMatrix([activeUnscheduled, activeScheduled, completed]);

  const matrix = await openMatrix();
  expect(within(matrix).getByText("Chưa xếp lịch")).toBeInTheDocument();
  expect(within(matrix).getByText("3 buổi")).toBeInTheDocument();
  expect(within(matrix).getByText("Hoàn thành")).toBeInTheDocument();
  const schedule = screen.getByRole("button", { name: "Xếp lịch →" });
  fireEvent.click(schedule);
  expect(screen.getByLabelText("Vị trí hiện tại")).toHaveTextContent("/masters/schedule?offeringId=unscheduled");
  const addSchedule = screen.getByRole("button", { name: "Xếp thêm →" });
  fireEvent.click(addSchedule);
  expect(screen.getByLabelText("Vị trí hiện tại")).toHaveTextContent("/masters/schedule?offeringId=scheduled");

  fireEvent.click(screen.getByRole("button", { name: `Xem chi tiết ${completed.name}` }));
  expect(await screen.findByRole("dialog", { name: `Chi tiết ${completed.name}` })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Đóng" }));

  cleanup();
  renderMatrix([activeScheduled, completed], { role: "supervisor", canManageScheduling: false });
  await openMatrix();
  expect(screen.queryByRole("button", { name: "Xếp thêm →" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Xếp lịch →" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Dạng cột theo khóa" }));
  expect(screen.queryByRole("button", { name: "Xếp lịch →" })).not.toBeInTheDocument();
});
