import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import ExamLists from "../../pages/masters/examLists";

jest.mock("axios");
jest.setTimeout(30000);
jest.mock("@mui/icons-material", () => ({
  DownloadRounded: () => null, ListAltRounded: () => null,
  SaveRounded: () => null, SearchRounded: () => null,
}));
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });
const savedRow = { participantId: "student:one", code: "HV001", fullName: "Nguyễn Văn An", dob: "1990-01-02", gender: "Nam", eligible: null, examExempt: false, testScore: null, assignmentScore: null, examScore: null, courseScore: null, grade4: null, letterGrade: "", attemptScores: [], result: "pending" };
const data = { revision: 0, rows: [savedRow], total: 1, totalRows: 1, page: 1, pageSize: 15 };
const paged = (gradeRows, params = {}) => {
  const include = (params.includeIds || "").split(","), exclude = (params.excludeIds || "").split(",");
  const found = gradeRows.filter(row => (params.mode !== "exam" || ((include.includes(row.participantId) || (row.eligible === true && !row.examExempt)) && !exclude.includes(row.participantId))) &&
    (!params.search || `${row.code} ${row.fullName}`.toLowerCase().includes(params.search.toLowerCase())));
  const page = Math.min(params.page || 1, Math.max(1, Math.ceil(found.length / 15)));
  return { revision: 0, rows: found.slice((page - 1) * 15, page * 15), total: found.length, totalRows: gradeRows.length, page, pageSize: 15 };
};
const setup = (role = "admin", gradeRows = data.rows) => {
  axios.get.mockImplementation(async (url, config) => ({ data: url.endsWith("/options") ? {
    groups: [{ id: "g1", name: "CNTT 2026", code: "N01", academicYear: "2026", majorId: "m1", major: { name: "Công nghệ thông tin" } }],
    courseOfferings: [{ id: "o1", name: "Lớp An toàn thông tin", subjectId: "s1", subject: { id: "s1", code: "HP01", name: "An toàn thông tin" }, groupLinks: [{ classGroupId: "g1" }] }],
  } : url.endsWith("/isStaff") ? { message: role } : paged(gradeRows, config?.params) }));
};
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); setup(); });

it("downloads the active tab's columns, current draft values, and searched students", async () => {
  setup("admin", [
    { ...savedRow, eligible: true, courseScore: 9, result: "passed" },
    { ...savedRow, participantId: "student:two", code: "HV002", eligible: false },
    { ...savedRow, participantId: "student:three", code: "HV003", eligible: true },
    ...Array.from({ length: 19 }, (_, index) => ({ ...savedRow, participantId: `student:${index + 4}`, code: `HV${String(index + 4).padStart(3, "0")}` })),
  ]);
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = jest.fn(() => "blob:gradebook");
  URL.revokeObjectURL = jest.fn();
  const downloads = [];
  const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () { downloads.push(this.download); });
  const readBlob = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(blob);
  });
  const exportCsv = async () => {
    const count = URL.createObjectURL.mock.calls.length;
    const button = await screen.findByRole("button", { name: "Xuất CSV" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(count + 1));
    const blob = URL.createObjectURL.mock.calls[URL.createObjectURL.mock.calls.length - 1][0];
    const csv = await readBlob(blob);
    const header = screen.getAllByRole("columnheader").map((cell) => `"${cell.textContent}"`).join(",");
    expect(csv.replace(/^\uFEFF/, "").split("\r\n")[0]).toBe(header);
    return csv;
  };
  try {
    render(<ExamLists />);
    fireEvent.change(await screen.findByLabelText("Điểm học phần HV001"), { target: { value: "8,5" } });
    const full = await exportCsv();
    expect(full.split("\r\n")).toHaveLength(23);
    expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/exam-lists$/), expect.objectContaining({ params: expect.objectContaining({ page: 2, pageSize: 15 }) }));
    expect(full).toContain('"8,5"');
    expect(full).toContain('"02/01/1990"');
    expect(full).toContain('"HV002"');
    expect(downloads[0]).toMatch(/^ca-bang-diem-/);
    fireEvent.click(screen.getByRole("button", { name: "DS thi" }));
    const exam = await exportCsv();
    expect(exam).not.toContain("Điểm học phần");
    expect(exam).not.toContain('"8,5"');
    expect(exam).not.toContain('"HV002"');
    expect(exam).toContain('"HV001"');
    expect(exam).toContain('"HV003"');
    expect(downloads[1]).toMatch(/^ds-thi-/);
    fireEvent.change(screen.getByPlaceholderText("Tìm theo mã HV, họ tên..."), { target: { value: "HV003" } });
    const searched = await exportCsv();
    expect(searched).toContain('"HV003"');
    expect(searched).not.toContain('"HV001"');
    expect(axios.put).not.toHaveBeenCalled();
  } finally {
    // Đợi các URL tải file được giải phóng trước khi khôi phục API trình duyệt.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    click.mockRestore();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});

it("filters real course classes by major and year and selects the matching subject", async () => {
  const groups = [
    { id: "g1", name: "CNTT 2026", academicYear: "2026", majorId: "m1", major: { name: "Công nghệ thông tin" } },
    { id: "g2", name: "QTKD 2026", academicYear: "2026", majorId: "m2", major: { name: "Quản trị kinh doanh" } },
    { id: "g3", name: "QTKD 2025", academicYear: "2025", majorId: "m2", major: { name: "Quản trị kinh doanh" } },
  ];
  const courseOfferings = [
    { id: "o1", name: "Lớp An toàn thông tin", subjectId: "s1", subject: { id: "s1", name: "An toàn thông tin" }, groupLinks: [{ classGroupId: "g1" }] },
    { id: "o2", name: "Lớp Marketing 2026", subjectId: "s2", subject: { id: "s2", name: "Marketing" }, groupLinks: [{ classGroupId: "g2" }] },
    { id: "o3", name: "Lớp Marketing 2025", subjectId: "s2", subject: { id: "s2", name: "Marketing" }, groupLinks: [{ classGroupId: "g3" }] },
    { id: "o4", name: "Lớp Quản trị 2025", subjectId: "s3", subject: { id: "s3", name: "Quản trị chiến lược" }, groupLinks: [{ classGroupId: "g3" }] },
  ];
  axios.get.mockImplementation(async (url) => ({ data: url.endsWith("/options") ? { groups, courseOfferings } : url.endsWith("/isStaff") ? { message: "admin" } : data }));
  render(<ExamLists />);
  await screen.findByLabelText("Điểm kiểm tra HV001");
  expect(screen.getByLabelText("Lớp học phần")).toHaveTextContent("Lớp An toàn thông tin");
  fireEvent.mouseDown(screen.getByLabelText("Chuyên ngành"));
  fireEvent.click(within(screen.getByRole("listbox")).getByText("Quản trị kinh doanh"));
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/exam-lists$/), { params: expect.objectContaining({ classGroupId: "g2", courseOfferingId: "o2", pageSize: 15 }) }));
  expect(screen.getByLabelText("Môn")).toHaveTextContent("Marketing");
  fireEvent.mouseDown(screen.getByLabelText("Năm"));
  fireEvent.click(within(screen.getByRole("listbox")).getByText("2025"));
  await waitFor(() => expect(screen.getByLabelText("Lớp học phần")).toHaveTextContent("Lớp Marketing 2025"));
  fireEvent.mouseDown(screen.getByLabelText("Lớp học phần"));
  const classes = screen.getByRole("listbox");
  expect(within(classes).queryByText(/An toàn thông tin/)).not.toBeInTheDocument();
  expect(within(classes).queryByText(/Marketing 2026/)).not.toBeInTheDocument();
  fireEvent.click(within(classes).getByText(/Lớp Quản trị 2025/));
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/exam-lists$/), { params: expect.objectContaining({ classGroupId: "g3", courseOfferingId: "o4", pageSize: 15 }) }));
  expect(screen.getByLabelText("Môn")).toHaveTextContent("Quản trị chiến lược");
  fireEvent.mouseDown(screen.getByLabelText("Môn"));
  fireEvent.click(within(screen.getByRole("listbox")).getByText("Marketing"));
  await waitFor(() => expect(screen.getByLabelText("Lớp học phần")).toHaveTextContent("Lớp Marketing 2025"));
});

it("keeps unsaved grades until a filter change is confirmed", async () => {
  render(<ExamLists />);
  fireEvent.change(await screen.findByLabelText("Điểm kiểm tra HV001"), { target: { value: "7" } });
  fireEvent.mouseDown(screen.getByLabelText("Chuyên ngành"));
  fireEvent.click(within(screen.getByRole("listbox")).getByText("Tất cả chuyên ngành"));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("Có điểm chưa lưu")).toBeInTheDocument();
  expect(screen.getByLabelText("Điểm kiểm tra HV001")).toHaveValue("7");
  fireEvent.click(within(dialog).getByRole("button", { name: "Ở lại" }));
  expect(screen.getByLabelText("Chuyên ngành")).toHaveTextContent("Công nghệ thông tin");
  expect(screen.getByLabelText("Điểm kiểm tra HV001")).toHaveValue("7");
});

it("loads a real class roster and saves only the edited row with its revision", async () => {
  axios.put.mockResolvedValue({ data: { ...data, revision: 1, rows: [{ ...savedRow, courseScore: 8.5 }] } });
  render(<ExamLists />);
  const score = await screen.findByLabelText("Điểm học phần HV001");
  fireEvent.change(score, { target: { value: "8,5" } });
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật cả bảng" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/masters/exam-lists"), expect.objectContaining({ classGroupId: "g1", courseOfferingId: "o1", revision: 0, rows: [expect.objectContaining({ participantId: "student:one", courseScore: 8.5 })] })));
  expect(await screen.findByText("Đã cập nhật bảng điểm cho 1 học viên.")).toBeInTheDocument();
});

it("retains a draft when saving fails", async () => {
  axios.put.mockRejectedValue({ response: { data: { message: "Bảng điểm đã được người khác cập nhật." } } });
  render(<ExamLists />);
  fireEvent.change(await screen.findByLabelText("Điểm kiểm tra HV001"), { target: { value: "7" } });
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật cả bảng" }));
  expect(await screen.findByText("Bảng điểm đã được người khác cập nhật.")).toBeInTheDocument();
  expect(screen.getByLabelText("Điểm kiểm tra HV001")).toHaveValue("7");
});

it("shows blank exam sheets without clearing drafts and keeps supervisors read-only", async () => {
  setup("supervisor", [{ ...savedRow, eligible: true }]);
  render(<ExamLists />);
  expect(await screen.findByLabelText("Điểm học phần HV001")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cập nhật cả bảng" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "DS thi" }));
  await screen.findByRole("columnheader", { name: /^Kết quả điểm/ });
  expect(screen.queryByLabelText("Điểm học phần HV001")).not.toBeInTheDocument();
  for (const label of ["Điểm kiểm tra", "Điểm BTL/TL/KT", "Điểm thi hết môn", "Điểm học phần", "Thang điểm 4", "Thang điểm chữ", "Điểm các lần thi hết môn"]) {
    expect(screen.queryByRole("columnheader", { name: new RegExp(`^${label}`) })).not.toBeInTheDocument();
  }
  expect(within(screen.getByTestId("exam-print-table")).getAllByRole("columnheader", { hidden: true })).toHaveLength(9);
  expect(screen.getByRole("columnheader", { name: /^Kết quả điểm/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cả bảng điểm" }));
  expect(await screen.findByLabelText("Điểm học phần HV001")).toBeInTheDocument();
  expect(axios.put).not.toHaveBeenCalled();
});

it("prints the loaded page with the current search and mode without fetching the whole roster", async () => {
  setup("admin", [
    { ...savedRow, eligible: true },
    { ...savedRow, participantId: "student:two", code: "HV002", eligible: null },
    { ...savedRow, participantId: "student:three", code: "HV003", eligible: false },
    { ...savedRow, participantId: "student:four", code: "HV004", eligible: true, examExempt: true },
  ]);
  render(<ExamLists />);
  const printRows = () => within(screen.getByTestId("exam-print-table")).getAllByRole("row", { hidden: true });
  await screen.findByLabelText("Điểm học phần HV001");
  expect(screen.queryByRole("button", { name: "DS thi có điểm" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Danh sách không đạt" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("Tìm theo mã HV, họ tên..."), { target: { value: "HV002" } });
  await waitFor(() => expect(printRows()).toHaveLength(2));
  fireEvent.click(screen.getByRole("button", { name: "DS thi" }));
  await waitFor(() => expect(printRows()).toHaveLength(1));
  fireEvent.change(screen.getByPlaceholderText("Tìm theo mã HV, họ tên..."), { target: { value: "" } });
  await waitFor(() => expect(printRows()).toHaveLength(2));
  const printed = printRows();
  expect(printed).toHaveLength(2);
  expect(printed[1]).toHaveTextContent("HV001");
  expect(screen.queryByRole("button", { name: "In danh sách" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Tải lại" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Xuất CSV" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cả bảng điểm" }));
  await waitFor(() => expect(printRows()).toHaveLength(5));
});

it("requests only 15 students per page and saves drafts from different pages together", async () => {
  const roster = Array.from({ length: 22 }, (_, index) => ({
    ...savedRow, participantId: `student:${index + 1}`, code: `HV${String(index + 1).padStart(3, "0")}`,
  }));
  setup("admin", roster);
  axios.put.mockResolvedValue({ data: { ...paged(roster), revision: 1 } });
  render(<ExamLists />);
  await screen.findByLabelText("Điểm kiểm tra HV001");
  expect(screen.getAllByRole("textbox", { name: /^Điểm kiểm tra HV/ })).toHaveLength(15);
  expect(screen.queryByLabelText("Điểm kiểm tra HV016")).not.toBeInTheDocument();
  expect(screen.getByText("Hiển thị 1–15 trên 22 học viên")).toBeInTheDocument();
  const initialCalls = axios.get.mock.calls.filter(([url]) => url.endsWith("/exam-lists"));
  expect(initialCalls).toHaveLength(1);
  expect(initialCalls[0][1].params).toMatchObject({ page: 1, pageSize: 15 });
  expect(initialCalls.some(([, config]) => config.params.page === 2)).toBe(false);
  fireEvent.change(screen.getByLabelText("Điểm kiểm tra HV001"), { target: { value: "7" } });
  fireEvent.click(screen.getByRole("button", { name: /page 2/i }));
  await screen.findByLabelText("Điểm kiểm tra HV016");
  expect(screen.getAllByRole("textbox", { name: /^Điểm kiểm tra HV/ })).toHaveLength(7);
  expect(screen.getByText("Hiển thị 16–22 trên 22 học viên")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Điểm kiểm tra HV016"), { target: { value: "8" } });
  fireEvent.click(screen.getByRole("button", { name: /page 1/i }));
  expect(await screen.findByLabelText("Điểm kiểm tra HV001")).toHaveValue("7");
  expect(within(screen.getByTestId("exam-print-table")).getAllByRole("row", { hidden: true })).toHaveLength(16);
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/exam-lists$/), { params: expect.objectContaining({ page: 2, pageSize: 15 }) });
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật cả bảng" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ rows: [
    expect.objectContaining({ participantId: "student:1", testScore: 7 }),
    expect.objectContaining({ participantId: "student:16", testScore: 8 }),
  ] })));
  expect(await screen.findByText("Đã cập nhật bảng điểm cho 2 học viên.")).toBeInTheDocument();
});

it("returns to the first page when searching or changing the list mode", async () => {
  setup("admin", Array.from({ length: 22 }, (_, index) => ({
    ...savedRow, participantId: `student:${index + 1}`, code: `HV${String(index + 1).padStart(3, "0")}`, eligible: true,
  })));
  render(<ExamLists />);
  await screen.findByLabelText("Điểm kiểm tra HV001");
  fireEvent.click(screen.getByRole("button", { name: /page 2/i }));
  await screen.findByLabelText("Điểm kiểm tra HV016");
  fireEvent.change(screen.getByPlaceholderText("Tìm theo mã HV, họ tên..."), { target: { value: "HV001" } });
  expect(await screen.findByLabelText("Điểm kiểm tra HV001")).toBeInTheDocument();
  expect(screen.getByText("Hiển thị 1–1 trên 1 học viên")).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("Tìm theo mã HV, họ tên..."), { target: { value: "" } });
  fireEvent.click(await screen.findByRole("button", { name: /page 2/i }));
  await screen.findByLabelText("Điểm kiểm tra HV016");
  fireEvent.click(screen.getByRole("button", { name: "DS thi" }));
  expect(await screen.findByText("Hiển thị 1–15 trên 22 học viên")).toBeInTheDocument();
});
