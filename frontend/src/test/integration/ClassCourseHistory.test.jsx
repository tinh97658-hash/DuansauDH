import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import axios from "axios";
import ClassCourseHistory from "../../pages/masters/classCourseHistory";

jest.mock("axios");
jest.mock("@mui/icons-material", () => new Proxy({}, { get: () => () => null }));
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });
jest.mock("../../features/scheduling/OfferingDetails", () => function Details({ offering, onClose }) {
  return <div role="dialog" aria-label="Chi tiết lớp học phần"><span>{offering.name}</span><button onClick={onClose}>Đóng</button></div>;
});

const discipline = { id: "discipline-1", name: "Khoa học máy tính" };
const major = { id: "major-1", name: "Công nghệ thông tin", disciplineId: discipline.id, discipline };
const baseSubjects = [
  { curriculumSubjectId: "subject-1", code: "NCKH01", name: "Phương pháp nghiên cứu khoa học", credits: 5, status: "in_progress", sessions: [{ lecturer: { name: "TS. Trần Minh Bình" } }] },
  { curriculumSubjectId: "subject-2", code: "HPT02", name: "Hệ phân tán", credits: 2, status: "not_started", sessions: [] },
];
const makeClasses = (year = "2027") => [
  { id: `group-${year}-1`, code: `CNT${year}.01`, majorId: major.id, academicYear: year, curriculumId: "curriculum-1", curriculum: { code: "K67" }, subjects: baseSubjects },
  { id: `group-${year}-2`, code: `CNT${year}.02`, majorId: major.id, academicYear: year, curriculumId: "curriculum-1", curriculum: { code: "K67" }, subjects: [
    { ...baseSubjects[0], status: "completed", sessions: [] },
    { ...baseSubjects[1], status: "scheduled", sessions: [] },
  ] },
];
const offering = {
  id: "offering-1", name: "Lớp NCKH", status: "active", subject: { code: "NCKH01", name: baseSubjects[0].name },
  groupLinks: [{ classGroup: { id: "group-2027-1", code: "CNT2027.01", academicYear: "2027" } }],
};

function mockData({ classes = makeClasses(), catalog = classes, offerings = [offering], majors = [major] } = {}) {
  axios.get.mockImplementation(async (url, options) => {
    if (url.includes("/system/majors")) return { data: majors };
    if (url.includes("/plan/classes")) return { data: catalog };
    if (url.includes("/class-curriculum-progress")) return { data: { classes: options.params.academicYear === "2027" ? classes : [] } };
    if (url.includes("/course-offerings")) return { data: offerings };
    return { data: [] };
  });
}

function CurrentLocation() {
  return <output data-testid="location">{useLocation().search}</output>;
}
function mount(query = "") {
  return render(<MemoryRouter initialEntries={[`/masters/class-course-history${query}`]}><ClassCourseHistory /><CurrentLocation /></MemoryRouter>);
}

async function chooseScope({ expectTable = true } = {}) {
  await waitFor(() => expect(screen.getByLabelText("Chuyên ngành")).toHaveValue(major.id));
  expect(screen.getByLabelText("Ngành")).toHaveValue(discipline.id);
  expect(screen.getByLabelText("Khóa / năm học")).toHaveTextContent("2027");
  if (expectTable) return screen.findByRole("table", { name: "Ma trận tiến độ học phần theo lớp" });
  return null;
}

beforeEach(() => { jest.clearAllMocks(); mockData(); });

it("shows a yellow grade reminder only for a completed class with missing grades, and reveals its text on hover", async () => {
  const classes = makeClasses();
  classes[0] = { ...classes[0], subjects: [
    { ...baseSubjects[0], status: "completed", needsGradeEntry: true },
    { ...baseSubjects[1], status: "scheduled", needsGradeEntry: true },
  ] };
  classes[1] = { ...classes[1], subjects: [
    { ...baseSubjects[0], status: "completed", needsGradeEntry: false },
    { ...baseSubjects[1], status: "in_progress", needsGradeEntry: true },
  ] };
  mockData({ classes });
  mount();
  const table = await chooseScope();
  const warnings = within(table).getAllByRole("img", { name: "Hãy nhập điểm môn học" });
  expect(warnings).toHaveLength(1);
  const cell = warnings[0].closest("td");
  expect(cell).toHaveTextContent("Hoàn thành");
  expect(cell.cellIndex).toBe(3);
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  fireEvent.mouseOver(warnings[0]);
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Hãy nhập điểm môn học");
  fireEvent.click(within(cell).getByRole("button", { name: "Xem chi tiết: Hoàn thành" }));
  expect(screen.getByRole("dialog", { name: "Chi tiết lớp học phần" })).toBeInTheDocument();
});

it("removes the reminder on the next visit after the class grades have been saved", async () => {
  const classes = makeClasses();
  classes[1] = { ...classes[1], subjects: [{ ...baseSubjects[0], status: "completed", needsGradeEntry: true }] };
  mockData({ classes });
  const view = mount();
  await chooseScope();
  expect(screen.getByRole("img", { name: "Hãy nhập điểm môn học" })).toBeInTheDocument();
  view.unmount();
  mockData({ classes: classes.map((group) => ({ ...group, subjects: group.subjects.map((subject) => ({ ...subject, needsGradeEntry: false })) })) });
  mount();
  await chooseScope();
  expect(screen.queryByRole("img", { name: "Hãy nhập điểm môn học" })).not.toBeInTheDocument();
});

it("selects a valid major and its newest available year on initial load", async () => {
  mount();
  expect(await chooseScope()).toBeInTheDocument();
  expect(screen.queryByText(/Vui lòng chọn/)).not.toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/class-curriculum-progress"), {
    params: { majorId: major.id, academicYear: "2027" }, withCredentials: true,
  });
});

it("skips parents without usable classes and uses catalog parent order rather than alphabet order", async () => {
  const empty = { ...major, id: "empty", disciplineId: "empty-parent", discipline: { id: "empty-parent", name: "A không có lớp" } };
  const first = { ...major, id: "first", disciplineId: "first-parent", discipline: { id: "first-parent", name: "Z có lớp" } };
  const later = { ...major, id: "later", disciplineId: "later-parent", discipline: { id: "later-parent", name: "B có lớp" } };
  const usable = { ...first, id: "first-usable" };
  mockData({ majors: [empty, first, later, usable], catalog: [
    { majorId: empty.id, academicYear: "2026", groupType: "NON_ADMINISTRATIVE" },
    { majorId: first.id, academicYear: "" },
    { majorId: later.id, academicYear: "2026" },
    { majorId: usable.id, academicYear: "2027" },
  ] });
  mount("?majorId=missing&year=1900");
  await waitFor(() => expect(screen.getByLabelText("Chuyên ngành")).toHaveValue(usable.id));
  expect(screen.getByLabelText("Ngành")).toHaveValue(first.disciplineId);
  expect(screen.getByLabelText("Khóa / năm học")).toHaveTextContent("2027");
  expect(screen.queryByRole("option", { name: "Tất cả ngành" })).not.toBeInTheDocument();
});

it("preserves a valid URL major and years and synchronizes its parent even when the URL parent differs", async () => {
  mockData({ catalog: [...makeClasses(), ...makeClasses("2028")] });
  mount(`?disciplineId=wrong-parent&majorId=${major.id}&year=2027,2028&context=keep`);
  await waitFor(() => expect(screen.getByLabelText("Ngành")).toHaveValue(discipline.id));
  await waitFor(() => expect(screen.getByLabelText("Chuyên ngành")).toHaveValue(major.id));
  expect(screen.getByLabelText("Khóa / năm học")).toHaveTextContent("2027, 2028");
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(`disciplineId=${discipline.id}`));
  expect(screen.getByTestId("location")).toHaveTextContent("context=keep");
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/class-curriculum-progress"), {
    params: { majorId: major.id, academicYear: "2028" }, withCredentials: true,
  }));
});

it("constrains majors when the parent changes and leaves a parent with no usable data empty", async () => {
  const other = { ...major, id: "other", disciplineId: "other-parent", discipline: { id: "other-parent", name: "Ngành khác" } };
  const empty = { ...major, id: "empty", disciplineId: "empty-parent", discipline: { id: "empty-parent", name: "Ngành trống" } };
  mockData({ majors: [major, other, empty], catalog: [...makeClasses(), { majorId: other.id, academicYear: "2029" }] });
  mount(); await chooseScope();
  fireEvent.change(screen.getByLabelText("Ngành"), { target: { value: other.disciplineId } });
  expect(screen.getByLabelText("Chuyên ngành")).toHaveValue(other.id);
  expect(screen.getByLabelText("Chuyên ngành").querySelector(`option[value="${major.id}"]`)).not.toBeInTheDocument();
  expect(screen.getByLabelText("Khóa / năm học")).toHaveTextContent("2029");
  fireEvent.change(screen.getByLabelText("Ngành"), { target: { value: empty.disciplineId } });
  await waitFor(() => expect(screen.getByLabelText("Chuyên ngành")).toHaveValue(""));
  expect(screen.getByLabelText("Ngành")).toHaveValue(empty.disciplineId);
  expect(screen.getByText("Chưa có dữ liệu phù hợp để theo dõi tiến độ.")).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

it("shows an empty state and makes no progress request when no parent-major pair has classes", async () => {
  mockData({ catalog: [] });
  mount("?majorId=missing&year=1900");
  expect(await screen.findByText("Chưa có dữ liệu phù hợp để theo dõi tiến độ.")).toBeInTheDocument();
  expect(screen.getByLabelText("Ngành")).toHaveValue("");
  expect(screen.getByLabelText("Chuyên ngành")).toHaveValue("");
  expect(axios.get.mock.calls.some(([url]) => url.includes("/class-curriculum-progress"))).toBe(false);
});

it("renders curriculum subjects once with one dynamic status column per class", async () => {
  mount();
  const table = await chooseScope();
  expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
    "Mã học phần", "Tên học phần", "Tín chỉ", "CNT2027.01", "CNT2027.02",
  ]);
  expect(within(table).getAllByText(baseSubjects[0].name)).toHaveLength(1);
  const row = within(table).getByRole("row", { name: /NCKH01/ });
  expect(within(row).getByText("Đang học")).toBeInTheDocument();
  expect(within(row).getByText("Hoàn thành")).toBeInTheDocument();
  expect(within(table).queryByRole("columnheader", { name: "Trạng thái" })).not.toBeInTheDocument();
  expect(within(table).queryByRole("columnheader", { name: /Buổi/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/\d+\s*\/\s*\d+\s*buổi/i)).not.toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/class-curriculum-progress"), {
    params: { majorId: major.id, academicYear: "2027" }, withCredentials: true,
  });
});

it("opens existing OfferingDetails from an organized status and leaves Chưa tổ chức non-interactive", async () => {
  mount();
  const table = await chooseScope();
  fireEvent.click(within(table).getByRole("button", { name: "Xem chi tiết: Đang học" }));
  expect(screen.getByRole("dialog", { name: "Chi tiết lớp học phần" })).toHaveTextContent("Lớp NCKH");
  fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
  const notStarted = within(table).getByText("Chưa tổ chức");
  expect(notStarted.tagName).toBe("SPAN");
  expect(within(table).queryByRole("button", { name: "Xem chi tiết: Chưa tổ chức" })).not.toBeInTheDocument();
});

it("filters matrix rows by any class status and normalized subject search", async () => {
  mount(); await chooseScope();
  fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "not_started" } });
  expect(screen.getByText("Hệ phân tán")).toBeInTheDocument();
  expect(screen.queryByText(baseSubjects[0].name)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "all" } });
  fireEvent.change(screen.getByLabelText("Tìm kiếm"), { target: { value: "nghien cuu" } });
  expect(screen.getByText(baseSubjects[0].name)).toBeInTheDocument();
  expect(screen.queryByText("Hệ phân tán")).not.toBeInTheDocument();
});

it("renders progress when classes in one major-year use different curriculums", async () => {
  const catalog = makeClasses();
  catalog[1] = { ...catalog[1], curriculumId: "curriculum-2" };
  mockData({ catalog });
  mount();
  expect(await screen.findByRole("table", { name: /Ma trận tiến độ học phần theo lớp/ })).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/class-curriculum-progress"), expect.anything());
});

it("allows selecting multiple academic years and combines their progress", async () => {
  const classes2028 = makeClasses("2028");
  const classes2026 = makeClasses("2026");
  mockData({ catalog: [...makeClasses(), ...classes2028, ...classes2026] });
  mount();
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/class-curriculum-progress"), {
    params: { majorId: major.id, academicYear: "2026" }, withCredentials: true,
  }));
  fireEvent.click(screen.getByLabelText("Khóa / năm học"));
  fireEvent.click(screen.getByLabelText("2027"));
  fireEvent.click(screen.getByLabelText("2028"));
  expect(screen.getByLabelText("Khóa / năm học")).toHaveTextContent("2026, 2027, 2028");
  expect(await screen.findByRole("table", { name: "Ma trận tiến độ học phần theo lớp" })).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
  expect(screen.queryByRole("columnheader", { name: "CNT2028.01" })).not.toBeInTheDocument();
});

it("prefers the current year and recomputes it when the major changes", async () => {
  const currentYear = String(new Date().getFullYear());
  const newerYear = String(Number(currentYear) + 2);
  const secondMajor = { ...major, id: "major-2", name: "Kỹ thuật hóa học" };
  const secondClasses = [currentYear, newerYear].flatMap((year) => makeClasses(year).map((group) => ({
    ...group, id: group.id.replace("group", "chemical"), code: group.code.replace("CNT", "KTHH"), majorId: secondMajor.id,
  })));
  axios.get.mockImplementation(async (url, options) => {
    if (url.includes("/system/majors")) return { data: [major, secondMajor] };
    if (url.includes("/plan/classes")) return { data: [...makeClasses(), ...secondClasses] };
    if (url.includes("/class-curriculum-progress")) return { data: { classes: secondClasses.filter((group) => group.academicYear === options.params.academicYear) } };
    if (url.includes("/course-offerings")) return { data: [] };
    return { data: [] };
  });

  mount();
  await waitFor(() => expect(screen.getByLabelText("Chuyên ngành")).toHaveValue(major.id));
  fireEvent.change(screen.getByLabelText("Chuyên ngành"), { target: { value: secondMajor.id } });
  expect(screen.getByLabelText("Ngành")).toHaveValue(secondMajor.disciplineId);
  expect(screen.getByLabelText("Khóa / năm học")).toHaveTextContent(currentYear);
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/class-curriculum-progress"), {
    params: { majorId: secondMajor.id, academicYear: currentYear }, withCredentials: true,
  }));
});

it("shows an empty state for a selected scope with no returned classes", async () => {
  mockData({ classes: [], catalog: makeClasses() });
  mount(); await chooseScope({ expectTable: false });
  expect(await screen.findByRole("heading", { name: "Không có lớp phù hợp" })).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

it("clears stale matrix content when the progress request fails", async () => {
  axios.get.mockImplementation(async (url) => {
    if (url.includes("/system/majors")) return { data: [major] };
    if (url.includes("/plan/classes")) return { data: makeClasses() };
    throw new Error("unavailable");
  });
  mount();
  await chooseScope({ expectTable: false });
  expect(await screen.findByText("Không thể tải dữ liệu theo dõi tiến độ.")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});
