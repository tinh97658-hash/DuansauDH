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

it.each([1, 2, 3, 4])("shows and evenly fills only %i actual cohort columns", async (count) => {
  const offerings = Array.from({ length: count }, (_, index) => offering({
    id: String(2030 - index),
    cohort: String(2030 - index),
  }));
  renderMatrix(offerings);

  await screen.findByRole("region", { name: "Khóa 2030" });
  const matrix = await openMatrix();

  expect(cohortHeaders()).toEqual(
    Array.from({ length: count }, (_, index) => `KHÓA ${2030 - index}`)
  );
  expect(within(matrix).queryAllByText("—")).toHaveLength(count * (count - 1));
  expect(screen.queryByRole("button", { name: "Xem khóa mới hơn" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Xem khóa cũ hơn" })).not.toBeInTheDocument();
  expect(within(matrix).getAllByRole("button", { name: /Xem chi tiết Lớp Học phần 20/ })).toHaveLength(count);
});

it("omits missing years from sparse history and hides unavailable window directions", async () => {
  const offerings = ["2026", "2025", "2022"].map((cohort) => offering({ id: `offering-${cohort}`, cohort }));
  renderMatrix(offerings);

  await openMatrix();
  expect(cohortHeaders()).toEqual(["KHÓA 2026", "KHÓA 2025", "KHÓA 2022"]);
  expect(screen.queryByRole("button", { name: "Xem khóa mới hơn" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Xem khóa cũ hơn" })).not.toBeInTheDocument();
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
  fireEvent.change(screen.getByLabelText("Tình trạng lịch"), { target: { value: "scheduled" } });
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
  expect(within(emptySubjectRow).getAllByText("—")).toHaveLength(1);

  fireEvent.click(screen.getByRole("button", { name: "Dạng cột theo khóa" }));
  expect(screen.getAllByText("GHÉP 2028 · 2027")).toHaveLength(2);
});

it("keeps a selected year as a real filter and presents its offerings in the single-year grid", async () => {
  const sharedSubject = "subject-selected-year";
  const active2026 = [
    offering({ id: "selected-first", cohort: "2026", subjectId: sharedSubject, subjectName: "Học phần năm đã chọn" }),
    offering({ id: "selected-second", cohort: "2026", subjectId: sharedSubject, subjectName: "Học phần năm đã chọn", totalCount: 2 }),
  ];
  const active2025 = offering({ id: "other-year", cohort: "2025", subjectId: sharedSubject, subjectName: "Học phần năm đã chọn" });
  const completed2026 = offering({ id: "selected-completed", cohort: "2026", subjectId: sharedSubject, subjectName: "Học phần năm đã chọn", status: "completed" });
  renderMatrix([...active2026, active2025, completed2026]);

  await openMatrix();
  expect(cohortHeaders()).toEqual(["KHÓA 2026", "KHÓA 2025"]);

  fireEvent.change(screen.getByLabelText("Khóa / năm học"), { target: { value: "2026" } });
  const selectedYearMatrix = screen.getByRole("table", { name: "Ma trận học phần theo khóa" });
  expect(cohortHeaders()).toEqual(["KHÓA 2026"]);
  expect(selectedYearMatrix).toHaveClass("sl-matrix-pivot-table-selected-year");
  expect(within(selectedYearMatrix).getByText(active2026[0].name)).toBeInTheDocument();
  expect(within(selectedYearMatrix).getByText(active2026[1].name)).toBeInTheDocument();
  const selectedYearGrid = within(selectedYearMatrix).getByRole("group", { name: "Lưới lớp học phần khóa 2026" });
  expect(selectedYearGrid).toHaveClass("sl-pivot-cell-offerings-single-year");
  expect(within(selectedYearGrid).getAllByRole("button", { name: /Xem chi tiết Lớp Học phần năm đã chọn/ })).toHaveLength(2);
  expect(within(selectedYearMatrix).getAllByText("K2026-1")).toHaveLength(2);
  expect(within(selectedYearMatrix).queryByText(active2025.name)).not.toBeInTheDocument();
  expect(within(selectedYearMatrix).queryByText(completed2026.name)).not.toBeInTheDocument();
});

it("excludes completed offerings from the active board, matrix, KPIs, filters, and cohort scope", async () => {
  const activeUnscheduled = offering({ id: "unscheduled", cohort: "2028", totalCount: 0 });
  const activeScheduled = offering({ id: "scheduled", cohort: "2028", totalCount: 3 });
  const activeOtherCohortSubject = offering({
    id: "active-other-cohort",
    cohort: "2028",
    subjectId: "subject-completed-cell",
    subjectName: "Học phần có lịch sử hoàn thành",
  });
  const completedOnlySubject = offering({ id: "completed-only", cohort: "2029", totalCount: 4, status: "completed" });
  const completedOnlyCell = offering({
    id: "completed-only-cell",
    cohort: "2027",
    subjectId: activeOtherCohortSubject.subjectId,
    subjectName: activeOtherCohortSubject.subject.name,
    totalCount: 4,
    status: "completed",
  });
  const completedSameCell = offering({
    id: "completed-same-cell",
    cohort: "2028",
    subjectId: activeScheduled.subjectId,
    subjectName: activeScheduled.subject.name,
    totalCount: 4,
    status: "completed",
  });
  renderMatrix([activeUnscheduled, activeScheduled, activeOtherCohortSubject, completedOnlySubject, completedOnlyCell, completedSameCell]);

  await screen.findByRole("region", { name: "Khóa 2028" });
  expect(screen.queryByRole("region", { name: "Khóa 2029" })).not.toBeInTheDocument();
  expect(screen.getByText(activeUnscheduled.name)).toBeInTheDocument();
  expect(screen.getByText(activeScheduled.name)).toBeInTheDocument();
  expect(screen.queryByText(completedOnlySubject.name)).not.toBeInTheDocument();
  expect(screen.queryByText(completedOnlyCell.name)).not.toBeInTheDocument();
  expect(screen.queryByText(completedSameCell.name)).not.toBeInTheDocument();

  const kpis = screen.getByRole("region", { name: "Chỉ số tổng quan" });
  expect(within(kpis).getByText("3", { selector: "strong" })).toBeInTheDocument();
  expect(within(kpis).getByText("2", { selector: "strong" })).toBeInTheDocument();
  expect(within(kpis).getByText("1", { selector: "strong" })).toBeInTheDocument();
  expect(within(kpis).queryByText("ĐÃ HOÀN THÀNH")).not.toBeInTheDocument();
  const scheduleFilter = screen.getByLabelText("Tình trạng lịch");
  expect(scheduleFilter).not.toHaveDisplayValue("Đã hoàn thành");
  expect(screen.queryByRole("option", { name: "Đã hoàn thành" })).not.toBeInTheDocument();

  const matrix = await openMatrix();
  expect(cohortHeaders()).toEqual(["KHÓA 2028"]);
  expect(within(matrix).getAllByText("Chưa xếp lịch")).toHaveLength(2);
  expect(within(matrix).getByText("3 buổi")).toBeInTheDocument();
  expect(within(matrix).queryByText("Hoàn thành")).not.toBeInTheDocument();
  expect(within(matrix).queryByText(completedOnlySubject.subject.name)).not.toBeInTheDocument();
  const historicalSubjectRow = within(matrix).getByRole("row", { name: /SUBJECT-COMPLETED-CELL.*Học phần có lịch sử hoàn thành/ });
  expect(within(historicalSubjectRow).queryAllByText("—")).toHaveLength(0);
  expect(within(matrix).queryByText(completedSameCell.name)).not.toBeInTheDocument();
  expect(within(matrix).getAllByRole("button", { name: `Xem chi tiết ${activeScheduled.name}` })).toHaveLength(1);

  fireEvent.change(screen.getByLabelText("Tình trạng lịch"), { target: { value: "scheduled" } });
  expect(within(matrix).queryByText("Chưa xếp lịch")).not.toBeInTheDocument();
  expect(within(matrix).getByText("3 buổi")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Tình trạng lịch"), { target: { value: "all" } });

  const unscheduledRow = within(matrix).getByRole("row", { name: /SUBJECT-UNSCHEDULED.*Học phần unscheduled/ });
  const schedule = within(unscheduledRow).getByRole("button", { name: "Xếp lịch →" });
  fireEvent.click(schedule);
  expect(screen.getByLabelText("Vị trí hiện tại")).toHaveTextContent("/masters/schedule?offeringId=unscheduled");
  const addSchedule = screen.getByRole("button", { name: "Xếp thêm →" });
  fireEvent.click(addSchedule);
  expect(screen.getByLabelText("Vị trí hiện tại")).toHaveTextContent("/masters/schedule?offeringId=scheduled");

  fireEvent.click(screen.getByRole("button", { name: `Xem chi tiết ${activeScheduled.name}` }));
  expect(await screen.findByRole("dialog", { name: `Chi tiết ${activeScheduled.name}` })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Đóng" }));

  cleanup();
  renderMatrix([activeScheduled, completedOnlySubject], { role: "supervisor", canManageScheduling: false });
  await openMatrix();
  expect(screen.queryByRole("button", { name: "Xếp thêm →" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Xếp lịch →" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Dạng cột theo khóa" }));
  expect(screen.queryByRole("button", { name: "Xếp lịch →" })).not.toBeInTheDocument();
});

it("uses the existing empty state when every fetched offering is completed", async () => {
  const completed = offering({ id: "completed", cohort: "2031", status: "completed" });
  renderMatrix([completed]);

  expect(await screen.findByText("Không tìm thấy lớp học phần phù hợp với bộ lọc hiện tại.")).toBeInTheDocument();
  expect(screen.queryByText(completed.name)).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Khóa 2031" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Bảng ma trận môn" }));
  expect(screen.queryByRole("table", { name: "Ma trận học phần theo khóa" })).not.toBeInTheDocument();
  expect(screen.getByText("Không tìm thấy lớp học phần phù hợp với bộ lọc hiện tại.")).toBeInTheDocument();
});
