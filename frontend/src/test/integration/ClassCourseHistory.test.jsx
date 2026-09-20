import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import ClassCourseHistory from "../../pages/masters/classCourseHistory";

jest.mock("axios");
jest.mock("@mui/icons-material", () => new Proxy({}, { get: () => () => null }));
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });
jest.mock("../../features/scheduling/OfferingDetails", () => function Details({ offering, onClose }) {
  return <div role="dialog" aria-label="Chi tiết lớp học phần"><span>{offering.name}</span><button onClick={onClose}>Đóng</button></div>;
});

const major = { id: "major-1", name: "Công nghệ thông tin" };
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

function mockData({ classes = makeClasses(), catalog = classes, offerings = [offering] } = {}) {
  axios.get.mockImplementation(async (url, options) => {
    if (url.includes("/system/majors")) return { data: [major] };
    if (url.includes("/plan/classes")) return { data: catalog };
    if (url.includes("/class-curriculum-progress")) return { data: { classes: options.params.academicYear === "2027" ? classes : [] } };
    if (url.includes("/course-offerings")) return { data: offerings };
    return { data: [] };
  });
}

function mount(query = "") {
  return render(<MemoryRouter initialEntries={[`/masters/class-course-history${query}`]}><ClassCourseHistory /></MemoryRouter>);
}

async function chooseScope({ expectTable = true } = {}) {
  await waitFor(() => expect(screen.getByLabelText("Chuyên ngành")).toHaveValue(major.id));
  expect(screen.getByLabelText("Khóa / năm học")).toHaveValue("2027");
  if (expectTable) return screen.findByRole("table", { name: "Ma trận tiến độ học phần theo lớp" });
  return null;
}

beforeEach(() => { jest.clearAllMocks(); mockData(); });

it("selects a valid major and its newest available year on initial load", async () => {
  mount();
  expect(await chooseScope()).toBeInTheDocument();
  expect(screen.queryByText(/Vui lòng chọn/)).not.toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/class-curriculum-progress"), {
    params: { majorId: major.id, academicYear: "2027" }, withCredentials: true,
  });
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

it("blocks rendering when one major-year scope has different non-null curriculumIds", async () => {
  const catalog = makeClasses();
  catalog[1] = { ...catalog[1], curriculumId: "curriculum-2" };
  mockData({ catalog });
  mount();
  expect(await screen.findByText(/Dữ liệu không nhất quán/)).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(axios.get).not.toHaveBeenCalledWith(expect.stringContaining("/class-curriculum-progress"), expect.anything());
});

it("keeps years separate when changing the required academic-year filter", async () => {
  const classes2028 = makeClasses("2028");
  mockData({ catalog: [...makeClasses(), ...classes2028] });
  mount();
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/class-curriculum-progress"), {
    params: { majorId: major.id, academicYear: "2028" }, withCredentials: true,
  }));
  expect(await screen.findByRole("heading", { name: "Không có lớp phù hợp" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Khóa / năm học"), { target: { value: "2027" } });
  expect(await screen.findByRole("table", { name: "Ma trận tiến độ học phần theo lớp" })).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
  expect(screen.queryByRole("columnheader", { name: "CNT2028.01" })).not.toBeInTheDocument();
});

it("prefers the current year and recomputes it when the major changes", async () => {
  const currentYear = String(new Date().getFullYear());
  const newerYear = String(Number(currentYear) + 2);
  const secondMajor = { id: "major-2", name: "Kỹ thuật hóa học" };
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
  expect(screen.getByLabelText("Khóa / năm học")).toHaveValue(currentYear);
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
