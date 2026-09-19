import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import ClassCourseHistory from "../../pages/masters/classCourseHistory";

jest.mock("axios");
jest.mock("@mui/icons-material", () => new Proxy({}, { get: () => () => null }));
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });

const major = { id: "major-1", name: "Công nghệ thông tin" };
const subjects = [
  { curriculumSubjectId: "subject-1", code: "NCKH01", name: "Phương pháp nghiên cứu khoa học", credits: 5, status: "in_progress", heldSessionCount: 1, sessionCount: 4,
    sessions: [
      { id: "session-held", sessionDate: "2026-09-10", period: "AFTERNOON", status: "held", startTime: "13:00", endTime: "16:00", lecturer: { name: "TS. Trần Minh Bình" }, room: { code: "P.402" } },
      { id: "session-pending", sessionDate: "2020-01-10", period: "MORNING", status: "planned", startTime: "08:00", endTime: "11:00", lecturer: { name: "PGS. Lê An" }, room: { code: "P.201" } },
      { id: "session-future", sessionDate: "2999-01-10", period: "AFTERNOON", status: "planned", startTime: "13:00", endTime: "16:00", lecturer: { name: "TS. Hoàng Hà" }, room: { code: "P.305" } },
      { id: "session-not-held", sessionDate: "2020-01-11", period: "MORNING", status: "not_held", startTime: "08:00", endTime: "11:00", lecturer: { name: "TS. Vũ Nam" }, room: { code: "P.101" } },
    ] },
  { curriculumSubjectId: "subject-2", code: "HPT02", name: "Hệ phân tán", credits: 2, status: "not_started", heldSessionCount: 0,
    sessions: [{ id: "session-other", sessionDate: "2999-02-10", period: "MORNING", status: "planned", startTime: "08:00", endTime: "11:00", lecturer: { name: "TS. Nguyễn Mai" }, room: { code: "P.501" } }] },
];
const makeClasses = (count, year = "2027") => Array.from({ length: count }, (_, index) => ({
  id: `group-${year}-${index + 1}`, code: `CNT${year}.${String(index + 1).padStart(2, "0")}`,
  majorId: major.id, academicYear: year, memberCount: 31, curriculum: { code: "K67" },
  summary: { totalSubjectCount: 2, completedSubjectCount: 0, inProgressSubjectCount: 1, scheduledSubjectCount: 0, notStartedSubjectCount: 1 },
  subjects: index === 0 ? subjects : [{ ...subjects[1], name: `Học phần lớp ${index + 1}` }],
}));

function mockReports(reports) {
  const catalog = Object.entries(reports).flatMap(([year, classes]) => classes.length ? classes : makeClasses(1, year));
  axios.get.mockImplementation(async (url, options) => {
    if (url.includes("/system/majors")) return { data: [major] };
    if (url.includes("/plan/classes")) return { data: catalog };
    if (url.includes("/scheduling/class-curriculum-progress")) return { data: { classes: reports[options.params.academicYear] } };
    return { data: [] };
  });
}
function mount(query = "") {
  return render(<MemoryRouter initialEntries={[`/masters/class-course-history${query}`]}><ClassCourseHistory /></MemoryRouter>);
}
async function chooseScope() {
  await screen.findByText("Vui lòng chọn chuyên ngành và khóa / năm học để xem tiến độ.");
  fireEvent.change(screen.getByLabelText("Chuyên ngành"), { target: { value: major.id } });
  // Await Axios resolution and the subsequent class/URL effects before interacting.
  // fireEvent's synchronous act alone does not flush this asynchronous chain.
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Khóa / năm học"), { target: { value: "2027" } });
  });
}
const overview = () => screen.getByRole("region", { name: "Tổng quan lớp" });
const classButtons = () => within(overview()).getAllByRole("button", { name: /CNT/ });

beforeEach(() => { jest.clearAllMocks(); mockReports({ "2027": makeClasses(2) }); });

it("uses the compact page layout, API credits, filters, and no inline session details", async () => {
  mount();
  expect(screen.queryByRole("heading", { name: "Theo dõi tiến độ" })).not.toBeInTheDocument();
  expect(screen.queryByText("Theo dõi tiến độ giảng dạy theo lớp và học phần")).not.toBeInTheDocument();
  await chooseScope();
  await screen.findByRole("heading", { name: "CNT2027.01" });
  expect(screen.getByRole("columnheader", { name: "Tín chỉ" })).toBeInTheDocument();
  const row = screen.getByRole("row", { name: `Xem chi tiết học phần ${subjects[0].name}` });
  expect(within(row).getByRole("cell", { name: "5" })).toBeInTheDocument();
  expect(within(row).queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getAllByRole("table")).toHaveLength(1);
  expect(screen.queryByText("P.402")).not.toBeInTheDocument();
  expect(screen.queryByText("TS. Trần Minh Bình")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "not_started" } });
  expect(screen.getByText("Hệ phân tán")).toBeInTheDocument();
  expect(screen.queryByText(subjects[0].name)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "all" } });
  for (const search of ["NCKH01", "nghien cuu", "tran minh binh"]) {
    fireEvent.change(screen.getByLabelText("Tìm kiếm"), { target: { value: search } });
    expect(screen.getByText(subjects[0].name)).toBeInTheDocument();
    expect(screen.queryByText("Hệ phân tán")).not.toBeInTheDocument();
  }
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/scheduling/class-curriculum-progress"), {
    params: { majorId: major.id, academicYear: "2027" }, withCredentials: true,
  });
});

it("opens a single subject drawer with summary counts and the complete session timeline", async () => {
  mount(); await chooseScope();
  const row = await screen.findByRole("row", { name: `Xem chi tiết học phần ${subjects[0].name}` });
  fireEvent.click(row);

  const drawer = screen.getByRole("dialog", { name: subjects[0].name });
  expect(row).toHaveClass("tp-subject-selected");
  expect(within(drawer).getByText("CHI TIẾT HỌC PHẦN")).toBeInTheDocument();
  expect(within(drawer).getByText("NCKH01")).toBeInTheDocument();
  expect(within(drawer).getByText("Đang học")).toBeInTheDocument();
  expect(within(drawer).getByText("1 đã diễn ra")).toBeInTheDocument();
  expect(within(drawer).getByText("1 chờ xác nhận")).toBeInTheDocument();
  expect(within(drawer).getByText("1 sắp tới")).toBeInTheDocument();
  expect(within(drawer).getByText("CNT2027.01 · 31 học viên")).toBeInTheDocument();
  expect(within(drawer).getAllByText(/Buổi [1-4]/)).toHaveLength(4);
  for (const label of ["Đã diễn ra", "Chờ xác nhận", "Sắp tới", "Không diễn ra"]) {
    expect(within(drawer).getByText(label)).toBeInTheDocument();
  }
  expect(within(drawer).getByText("10/09/2026 · Chiều")).toBeInTheDocument();
  expect(within(drawer).getByText("10/01/2020 · Sáng")).toBeInTheDocument();
  expect(within(drawer).getByText("P.402 · TS. Trần Minh Bình")).toBeInTheDocument();
  expect(within(drawer).queryByText(/08:00|11:00|13:00|16:00/)).not.toBeInTheDocument();
  expect(screen.getAllByRole("table")).toHaveLength(1);
});

it("opens from row click, Enter, and Space while preserving close and focus behavior", async () => {
  mount(); await chooseScope();
  const row = await screen.findByRole("row", { name: `Xem chi tiết học phần ${subjects[0].name}` });
  fireEvent.click(row);
  const close = within(screen.getByRole("dialog")).getByRole("button", { name: "Đóng chi tiết học phần" });
  expect(close).toHaveFocus();
  fireEvent.click(close);
  await waitFor(() => expect(row).toHaveFocus());

  fireEvent.keyDown(row, { key: "Enter" });
  expect(screen.getByRole("dialog", { name: subjects[0].name })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Đóng lớp phủ chi tiết học phần" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await waitFor(() => expect(row).toHaveFocus());

  fireEvent.keyDown(row, { key: " " });
  expect(screen.getByRole("dialog", { name: subjects[0].name })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("updates one drawer when another subject is selected and closes when filtering invalidates it", async () => {
  mount(); await chooseScope();
  const firstRow = await screen.findByRole("row", { name: `Xem chi tiết học phần ${subjects[0].name}` });
  const secondRow = screen.getByRole("row", { name: `Xem chi tiết học phần ${subjects[1].name}` });
  fireEvent.click(firstRow);
  const close = within(screen.getByRole("dialog")).getByRole("button", { name: "Đóng chi tiết học phần" });
  expect(close).toHaveFocus();

  secondRow.focus();
  fireEvent.click(secondRow);
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(screen.getByRole("dialog", { name: subjects[1].name })).toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: subjects[0].name })).not.toBeInTheDocument();
  expect(close).not.toHaveFocus();
  expect(secondRow).toHaveFocus();

  fireEvent.click(close);
  await waitFor(() => expect(secondRow).toHaveFocus());

  fireEvent.click(secondRow);

  fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "in_progress" } });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it.each([1, 2, 3, 4, 5])("renders %i classes with one selected-class summary", async (count) => {
  mockReports({ "2027": makeClasses(count) });
  mount();
  await chooseScope();
  await screen.findByRole("heading", { name: "CNT2027.01" });
  const detailHeader = screen.getByRole("group", { name: "Tổng quan lớp đang chọn" });
  const summary = screen.getByRole("group", { name: "Thống kê tiến độ lớp" });
  expect(within(overview()).getByText(`${count} lớp`)).toBeInTheDocument();
  expect(classButtons()).toHaveLength(Math.min(count, 4));
  expect(classButtons()[0]).toHaveAttribute("aria-pressed", "true");
  expect(classButtons()[0]).toHaveClass("selected");
  expect(within(overview()).queryAllByRole("group", { name: "Thống kê tiến độ lớp" })).toHaveLength(count === 1 ? 1 : 0);
  expect(within(detailHeader).queryAllByRole("group", { name: "Thống kê tiến độ lớp" })).toHaveLength(count === 1 ? 0 : 1);
  expect(summary).toHaveClass(count === 1 ? "tp-summary-full" : "tp-summary-compact");
  expect(summary).toHaveTextContent("0Hoàn thành");
  expect(summary).toHaveTextContent("1Đang học");
  expect(summary).toHaveTextContent("1Chưa tổ chức");
  expect(screen.getAllByRole("group", { name: "Thống kê tiến độ lớp" })).toHaveLength(1);
  expect(screen.queryAllByRole("button", { name: "Các lớp tiếp theo" })).toHaveLength(count > 4 ? 1 : 0);
});

it("changes the detail table and selected fill when another class is chosen", async () => {
  mount(); await chooseScope();
  fireEvent.click(await screen.findByRole("row", { name: `Xem chi tiết học phần ${subjects[0].name}` }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  fireEvent.click(classButtons()[1]);
  expect(screen.getByRole("heading", { name: "CNT2027.02" })).toBeInTheDocument();
  expect(screen.getByText("Học phần lớp 2")).toBeInTheDocument();
  expect(classButtons()[1]).toHaveClass("selected");
  expect(classButtons()[0]).toHaveAttribute("aria-pressed", "false");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("shows four classes per window, clamps arrows, and preserves selection while browsing", async () => {
  mockReports({ "2027": makeClasses(9) });
  mount(); await chooseScope();
  await screen.findByRole("heading", { name: "CNT2027.01" });
  const next = screen.getByRole("button", { name: "Các lớp tiếp theo" });
  const previous = screen.getByRole("button", { name: "Các lớp trước" });
  expect(previous).toBeDisabled();
  for (let index = 0; index < 5; index++) {
    fireEvent.click(next);
    expect(classButtons()).toHaveLength(4);
    expect(screen.getByRole("heading", { name: "CNT2027.01" })).toBeInTheDocument();
  }
  expect(next).toBeDisabled();
  expect(classButtons()[0]).toHaveTextContent("CNT2027.06");
  fireEvent.click(classButtons()[3]);
  expect(screen.getByRole("heading", { name: "CNT2027.09" })).toBeInTheDocument();
  fireEvent.click(previous);
  expect(classButtons()).toHaveLength(4);
  expect(classButtons()[0]).toHaveTextContent("CNT2027.05");
  expect(screen.getByRole("heading", { name: "CNT2027.09" })).toBeInTheDocument();
  expect(screen.queryByText(/1–4 \/ 9/)).not.toBeInTheDocument();
});

it("keeps a deep-linked class visible and reconciles a shorter scope", async () => {
  mockReports({ "2027": makeClasses(9), "2028": makeClasses(2, "2028") });
  mount("?majorId=major-1&year=2027&groupId=group-2027-9");
  await screen.findByRole("heading", { name: "CNT2027.09" });
  expect(await within(overview()).findByRole("button", { name: /CNT2027.09/ })).toHaveAttribute("aria-pressed", "true");
  fireEvent.change(screen.getByLabelText("Khóa / năm học"), { target: { value: "2028" } });
  await screen.findByRole("heading", { name: "CNT2028.01" });
  expect(classButtons()).toHaveLength(2);
  expect(screen.queryByRole("button", { name: "Các lớp tiếp theo" })).not.toBeInTheDocument();
});

it("shows the zero-class empty state and resets all filters", async () => {
  mockReports({ "2027": [] });
  mount(); await chooseScope();
  await screen.findByRole("heading", { name: "Không có lớp phù hợp" });
  expect(within(overview()).getByText("0 lớp")).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Tìm kiếm"), { target: { value: "test" } });
  fireEvent.click(screen.getByRole("button", { name: "Đặt lại bộ lọc" }));
  expect(screen.getByLabelText("Chuyên ngành")).toHaveValue("");
  expect(screen.getByLabelText("Khóa / năm học")).toHaveValue("");
  expect(screen.getByLabelText("Tìm kiếm")).toHaveValue("");
  expect(screen.queryByRole("heading", { name: "Không có lớp phù hợp" })).not.toBeInTheDocument();
});

it("distinguishes an existing class without curriculum subjects from zero classes", async () => {
  const classes = makeClasses(1);
  classes[0].subjects = [];
  classes[0].curriculum = null;
  classes[0].summary = { totalSubjectCount: 0, completedSubjectCount: 0, inProgressSubjectCount: 0, scheduledSubjectCount: 0, notStartedSubjectCount: 0 };
  mockReports({ "2027": classes });
  mount(); await chooseScope();
  await screen.findByRole("heading", { name: "CNT2027.01" });
  expect(screen.getByText("Chưa có dữ liệu học phần áp dụng cho lớp. Vui lòng kiểm tra chương trình đào tạo.")).toBeInTheDocument();
  expect(screen.queryByText("Không có lớp phù hợp")).not.toBeInTheDocument();
});

it("shows a loading indicator and reports a failed request without stale class content", async () => {
  axios.get.mockImplementation(async (url) => {
    if (url.includes("/system/majors")) return { data: [major] };
    if (url.includes("/plan/classes")) return { data: makeClasses(1) };
    throw new Error("unavailable");
  });
  mount();
  expect(screen.getByRole("progressbar")).toBeInTheDocument();
  await chooseScope();
  expect(await screen.findByText("Không thể tải dữ liệu theo dõi tiến độ.")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});
