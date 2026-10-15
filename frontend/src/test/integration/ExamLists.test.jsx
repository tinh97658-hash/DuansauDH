import { act, fireEvent, render as renderUi, screen, waitFor, within } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@mui/material";
import axios from "axios";
import ExcelJS from "exceljs";
import ExamLists from "../../pages/masters/examLists";
import { notifySubjectCatalogChanged } from "../../utils/subjectCatalog";

jest.mock("axios");
jest.setTimeout(60000);
jest.mock("@mui/icons-material", () => ({
  DownloadRounded: () => null, ListAltRounded: () => null,
  SaveRounded: () => null, SearchRounded: () => null,
}));
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });
// Animation timers are unrelated to grade entry/export and slow down large page fixtures.
const testTheme = createTheme({ components: { MuiButtonBase: { defaultProps: { disableRipple: true } } } });
const render = ui => renderUi(<ThemeProvider theme={testTheme}>{ui}</ThemeProvider>);
const savedRow = { participantId: "student:one", code: "HV001", fullName: "Nguyễn Văn An", dob: "1990-01-02", gender: "Nam", eligible: null, examExempt: false, testScore: null, assignmentScore: null, examScore: null, courseScore: null, grade4: null, letterGrade: "", attemptScores: [], result: "pending" };
const data = { revision: 0, rows: [savedRow], total: 1, totalRows: 1, page: 1, pageSize: 15 };
const paged = (gradeRows, params = {}) => {
  const include = (params.includeIds || "").split(","), exclude = (params.excludeIds || "").split(",");
  const found = gradeRows.filter(row => (params.mode !== "exam" || ((include.includes(row.participantId) || row.result === "passed") && !exclude.includes(row.participantId))) &&
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

it("refreshes catalog metadata without discarding unsaved grades or changing the selected class", async () => {
  render(<ExamLists />);
  fireEvent.change(await screen.findByLabelText("Điểm kiểm tra HV001"), { target: { value: "8" } });
  const original = axios.get.getMockImplementation();
  axios.get.mockImplementation(async (url, config) => {
    const response = await original(url, config);
    if (url.endsWith("/options")) response.data.courseOfferings[0].subject = { id: "s1", code: "NEW01", name: "Học phần cập nhật", credits: 5 };
    return response;
  });
  const gradeRequests = axios.get.mock.calls.filter(([url]) => url.endsWith("/exam-lists")).length;
  act(() => notifySubjectCatalogChanged());
  await waitFor(() => expect(screen.getByLabelText("Môn")).toHaveTextContent("Học phần cập nhật"));
  expect(screen.getByLabelText("Điểm kiểm tra HV001")).toHaveValue("8");
  expect(screen.getByText("1 học viên chưa lưu")).toBeInTheDocument();
  expect(screen.getByLabelText("Lớp học phần")).toHaveTextContent("CNTT 2026");
  expect(axios.get.mock.calls.filter(([url]) => url.endsWith("/exam-lists"))).toHaveLength(gradeRequests);
});

it("downloads the active tab's columns, current draft values, and searched students", async () => {
  setup("admin", [
    { ...savedRow, eligible: true, courseScore: 9, result: "passed" },
    { ...savedRow, participantId: "student:two", code: "HV002", eligible: false },
    { ...savedRow, participantId: "student:three", code: "HV003", eligible: true, result: "passed" },
    ...Array.from({ length: 19 }, (_, index) => ({ ...savedRow, participantId: `student:${index + 4}`, code: `HV${String(index + 4).padStart(3, "0")}` })),
  ]);
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = jest.fn(() => "blob:gradebook");
  URL.revokeObjectURL = jest.fn();
  const downloads = [];
  const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () { downloads.push(this.download); });
  const exportExamExcel = async () => {
    const count = URL.createObjectURL.mock.calls.length;
    const button = await screen.findByRole("button", { name: "Xuất Excel" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(count + 1));
    const blob = URL.createObjectURL.mock.calls[count][0];
    const buffer = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsArrayBuffer(blob); });
    const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer);
    return book.worksheets[0];
  };
  try {
    render(<ExamLists />);
    fireEvent.change(await screen.findByLabelText("Điểm kiểm tra HV001"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Điểm BTL/TL/KT HV001"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Điểm thi hết môn HV001"), { target: { value: "9" } });
    expect(screen.queryByRole("button", { name: "Xuất CSV" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xuất file" }));
    expect(screen.queryByRole("menuitem", { name: /Word/ })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "PDF / In" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Excel (.xlsx)" }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
    const buffer = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsArrayBuffer(URL.createObjectURL.mock.calls[0][0]); });
    const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer);
    const sheet = book.worksheets[0];
    expect(sheet.rowCount).toBe(31);
    expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/exam-lists$/), expect.objectContaining({ params: expect.objectContaining({ page: 2, pageSize: 15 }) }));
    expect(sheet.getCell("L10").value).toBe("8.5");
    expect(sheet.getCell("E10").value).toBe("02/01/1990");
    expect(sheet.getCell("B11").value).toBe("HV002");
    expect(downloads[0]).toBe("Bang-diem-mon-hoc-N01-HP01.xlsx");
    fireEvent.click(screen.getByRole("button", { name: "DS thi" }));
    const examSheet = await exportExamExcel();
    expect(examSheet.getRow(4).values.slice(1)).toEqual(screen.getAllByRole("columnheader").map(cell => cell.textContent));
    expect(examSheet.rowCount).toBe(6);
    expect(examSheet.getCell("B5").value).toBe("HV001");
    expect(examSheet.getCell("B6").value).toBe("HV003");
    expect(examSheet.getCell("I5").value).toBe("Đạt");
    expect(examSheet.getCell("A4").fill.fgColor.argb).toBe("FFDCE6F1");
    expect(examSheet.pageSetup).toMatchObject({ paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 });
    expect(downloads[1]).toBe("DS-thi-N01-HP01.xlsx");
    expect(screen.queryByRole("button", { name: "Xuất CSV" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Tìm theo mã HV, họ tên..."), { target: { value: "HV003" } });
    const searchedSheet = await exportExamExcel();
    expect(searchedSheet.rowCount).toBe(5);
    expect(searchedSheet.getCell("A5").value).toBe(1);
    expect(searchedSheet.getCell("B5").value).toBe("HV003");
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
  expect(score).toHaveAttribute("readonly");
  fireEvent.change(screen.getByLabelText("Điểm kiểm tra HV001"), { target: { value: "8" } });
  fireEvent.change(screen.getByLabelText("Điểm BTL/TL/KT HV001"), { target: { value: "8" } });
  fireEvent.change(screen.getByLabelText("Điểm thi hết môn HV001"), { target: { value: "9" } });
  expect(score).toHaveValue("8.5");
  expect(screen.getByLabelText("Thang điểm 4 HV001")).toHaveValue("4.0");
  expect(screen.getByLabelText("Thang điểm chữ HV001")).toHaveValue("A");
  expect(screen.getByLabelText("Kết quả điểm HV001")).toHaveValue("passed");
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

it("rounds every editable score on blur and formats all score columns with one decimal", async () => {
  render(<ExamLists />);
  await screen.findByLabelText("Điểm kiểm tra HV001");
  for (const label of ["Điểm kiểm tra", "Điểm BTL/TL/KT", "Điểm thi hết môn"]) {
    const input = screen.getByLabelText(`${label} HV001`);
    for (const [value, expected] of [["6", "6.0"], ["5.76", "5.8"], ["5.54", "5.5"]]) {
      fireEvent.change(input, { target: { value } });
      expect(input).toHaveValue(value);
      fireEvent.blur(input);
      expect(input).toHaveValue(expected);
    }
  }
  expect(screen.getByLabelText("Điểm học phần HV001")).toHaveValue("5.5");
  expect(screen.getByLabelText("Thang điểm 4 HV001")).toHaveValue("2.0");
  expect(screen.getByLabelText("Điểm các lần thi HV001")).toHaveValue("5.5");
  fireEvent.change(screen.getByLabelText("Điểm thi hết môn HV001"), { target: { value: "" } });
  fireEvent.blur(screen.getByLabelText("Điểm thi hết môn HV001"));
  expect(screen.getByLabelText("Điểm thi hết môn HV001")).toHaveValue("");
  expect(screen.getByLabelText("Điểm các lần thi HV001")).toHaveValue("");
  expect(screen.getByLabelText("Điểm học phần HV001")).toHaveValue("");
});

it("only accepts scores from 0 to 10 when typing or pasting into any component", async () => {
  render(<ExamLists />);
  await screen.findByLabelText("Điểm kiểm tra HV001");
  for (const label of ["Điểm kiểm tra", "Điểm BTL/TL/KT", "Điểm thi hết môn"]) {
    const input = screen.getByLabelText(`${label} HV001`);
    fireEvent.change(input, { target: { value: "6" } });
    for (const value of ["-1", "-0.1", "11", "10.01", "10,01", "100", "abc", "1e1", "Infinity"]) {
      fireEvent.change(input, { target: { value } });
      expect(input).toHaveValue("6");
    }
    for (const value of ["0", "10", "5,76", "5.54", ""]) {
      fireEvent.change(input, { target: { value } });
      expect(input).toHaveValue(value);
    }
  }
});

it("shows blank exam sheets without clearing drafts and keeps supervisors read-only", async () => {
  setup("supervisor", [{ ...savedRow, eligible: true, result: "passed" }]);
  render(<ExamLists />);
  expect(await screen.findByLabelText("Điểm học phần HV001")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cập nhật cả bảng" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "DS thi" }));
  await screen.findByRole("columnheader", { name: /^Kết quả điểm/ });
  expect(screen.queryByLabelText("Điểm học phần HV001")).not.toBeInTheDocument();
  for (const label of ["Điểm kiểm tra", "Điểm BTL/TL/KT", "Điểm thi hết môn", "Điểm học phần", "Thang điểm 4", "Thang điểm chữ", "Điểm các lần thi hết môn"]) {
    expect(screen.queryByRole("columnheader", { name: new RegExp(`^${label}`) })).not.toBeInTheDocument();
  }
  expect(within(screen.getByTestId("exam-print-table")).getAllByRole("columnheader", { hidden: true })).toHaveLength(10);
  expect(screen.getByRole("columnheader", { name: /^Kết quả điểm/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cả bảng điểm" }));
  expect(await screen.findByLabelText("Điểm học phần HV001")).toBeInTheDocument();
  expect(axios.put).not.toHaveBeenCalled();
});

it("shows an unsaved passed student in DS thi and saves notes included in the print table", async () => {
  const passedRow = { ...savedRow, testScore: 6, assignmentScore: 6, examScore: 6, courseScore: 6, result: "passed", notes: "Ghi chú học viên" };
  axios.put.mockResolvedValue({ data: { ...data, revision: 1, rows: [passedRow] } });
  render(<ExamLists />);
  await screen.findByLabelText("Điểm kiểm tra HV001");
  for (const label of ["Điểm kiểm tra", "Điểm BTL/TL/KT", "Điểm thi hết môn"]) {
    fireEvent.change(screen.getByLabelText(`${label} HV001`), { target: { value: "6" } });
  }
  fireEvent.click(screen.getByRole("button", { name: "DS thi" }));
  expect(await screen.findByLabelText("Miễn thi HV001")).not.toBeChecked();
  expect(screen.getByLabelText("Kết quả điểm HV001")).toHaveValue("passed");
  expect(screen.getByLabelText("Tư cách thi HV001")).not.toBeChecked();
  const headers = screen.getAllByRole("columnheader").map(cell => cell.textContent);
  expect(headers.slice(-2)).toEqual(["Kết quả điểm", "Ghi chú"]);
  const notes = screen.getByLabelText("Ghi chú HV001");
  expect(notes).toBeEnabled();
  fireEvent.change(notes, { target: { value: passedRow.notes } });
  expect(within(screen.getByTestId("exam-print-table")).getByText(passedRow.notes)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật cả bảng" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ rows: [expect.objectContaining({ result: "passed", notes: passedRow.notes })] })));
  expect(await screen.findByText("Đã cập nhật bảng điểm cho 1 học viên.")).toBeInTheDocument();
  expect(screen.getByLabelText("Ghi chú HV001")).toHaveValue(passedRow.notes);
});

it("prints the loaded page with the current search and mode without fetching the whole roster", async () => {
  setup("admin", [
    { ...savedRow, eligible: true, result: "passed" },
    { ...savedRow, participantId: "student:two", code: "HV002", eligible: null, result: "pending" },
    { ...savedRow, participantId: "student:three", code: "HV003", eligible: false, result: "passed" },
    { ...savedRow, participantId: "student:four", code: "HV004", eligible: true, examExempt: true, result: "exempt" },
    { ...savedRow, participantId: "student:five", code: "HV005", eligible: true, result: "failed" },
  ]);
  render(<ExamLists />);
  const printRows = () => within(screen.getByTestId("exam-print-table")).getAllByRole("row", { hidden: true });
  await screen.findByLabelText("Điểm học phần HV001");
  expect(screen.queryByRole("button", { name: "DS thi có điểm" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Danh sách không đạt" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("Tìm theo mã HV, họ tên..."), { target: { value: "HV002" } });
  expect(screen.queryByTestId("exam-print-table")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "DS thi" }));
  await waitFor(() => expect(printRows()).toHaveLength(1));
  fireEvent.change(screen.getByPlaceholderText("Tìm theo mã HV, họ tên..."), { target: { value: "" } });
  await waitFor(() => expect(printRows()).toHaveLength(3));
  const printed = printRows();
  expect(printed).toHaveLength(3);
  expect(printed[1]).toHaveTextContent("HV001");
  expect(printed[2]).toHaveTextContent("HV003");
  for (const code of ["HV002", "HV004", "HV005"]) expect(within(screen.getByTestId("exam-print-table")).queryByText(code)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "In danh sách" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Tải lại" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Xuất CSV" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Xuất Excel" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cả bảng điểm" }));
  await waitFor(() => expect(screen.queryByTestId("exam-print-table")).not.toBeInTheDocument());
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
  expect(screen.queryByTestId("exam-print-table")).not.toBeInTheDocument();
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
    ...savedRow, participantId: `student:${index + 1}`, code: `HV${String(index + 1).padStart(3, "0")}`, eligible: true, result: "passed",
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

it("exports all 30 students to PDF, preserves drafts and reflects the current search", async () => {
  const roster = Array.from({ length: 30 }, (_, i) => ({ ...savedRow, participantId: `student:${i + 1}`, code: `HV${String(i + 1).padStart(3, "0")}` }));
  setup("admin", roster);
  const replace = jest.fn();
  const open = jest.spyOn(window, "open").mockReturnValue({ sessionStorage, location: { replace }, close: jest.fn() });
  const snapshot = () => JSON.parse(sessionStorage.getItem(`gradebook-preview:${new URL(replace.mock.calls[replace.mock.calls.length - 1][0], "http://localhost").searchParams.get("preview")}`));
  try {
    render(<ExamLists />);
    const menu = screen.getByRole("button", { name: "Xuất file" });
    expect(menu).toBeDisabled();
    fireEvent.change(await screen.findByLabelText("Điểm kiểm tra HV001"), { target: { value: "9,5" } });
    expect(screen.getAllByRole("textbox", { name: /^Điểm kiểm tra HV/ })).toHaveLength(15);
    fireEvent.click(menu); fireEvent.click(screen.getByRole("menuitem", { name: "PDF / In" }));
    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    expect(snapshot().rows).toHaveLength(30); expect(snapshot().rows[0][8]).toBe("9.5"); expect(snapshot().rows[29][1]).toBe("HV030");
    await waitFor(() => expect(menu).toBeEnabled());
    fireEvent.change(screen.getByPlaceholderText("Tìm theo mã HV, họ tên..."), { target: { value: "HV030" } });
    await screen.findByLabelText("Điểm kiểm tra HV030");
    fireEvent.click(menu); fireEvent.click(screen.getByRole("menuitem", { name: "PDF / In" }));
    await waitFor(() => expect(replace).toHaveBeenCalledTimes(2));
    expect(snapshot().rows).toHaveLength(1); expect(snapshot().rows[0][1]).toBe("HV030");
    expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/exam-lists$/), { params: expect.objectContaining({ search: "HV030", mode: "all", page: 1, pageSize: 15 }) });
    expect(axios.put).not.toHaveBeenCalled();
  } finally { open.mockRestore(); }
});

it("disables controls while exporting and reports revision changes without producing a preview", async () => {
  setup("admin", Array.from({ length: 30 }, (_, i) => ({ ...savedRow, participantId: `student:${i}`, code: `HV${i}` })));
  render(<ExamLists />);
  await screen.findByLabelText("Điểm kiểm tra HV0");
  let finish;
  axios.get.mockImplementation((_url, { params }) => params.page === 1
    ? new Promise(resolve => { finish = resolve; })
    : Promise.resolve({ data: { revision: 2, total: 30, page: 2, rows: [savedRow] } }));
  const replace = jest.fn(), close = jest.fn();
  const open = jest.spyOn(window, "open").mockReturnValue({ sessionStorage, location: { replace }, close });
  try {
    const menu = screen.getByRole("button", { name: "Xuất file" });
    fireEvent.click(menu); fireEvent.click(screen.getByRole("menuitem", { name: "PDF / In" }));
    await waitFor(() => expect(menu).toBeDisabled());
    expect(screen.getByPlaceholderText("Tìm theo mã HV, họ tên...")).toBeDisabled();
    expect(screen.getByRole("button", { name: "DS thi" })).toBeDisabled();
    finish({ data: { revision: 1, total: 30, page: 1, rows: [savedRow] } });
    expect(await screen.findByText("Bảng điểm đã thay đổi trong lúc xuất. Vui lòng xuất lại.")).toBeInTheDocument();
    await waitFor(() => expect(menu).toBeEnabled()); expect(replace).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledTimes(1);
  } finally { open.mockRestore(); }
});

it("disables the export menu for empty data and while saving", async () => {
  setup("admin", []);
  const view = render(<ExamLists />);
  await screen.findByText("Không có học viên phù hợp với danh sách đang chọn.");
  expect(screen.getByRole("button", { name: "Xuất file" })).toBeDisabled();
  view.unmount(); setup();
  render(<ExamLists />);
  fireEvent.change(await screen.findByLabelText("Điểm kiểm tra HV001"), { target: { value: "7" } });
  let finish;
  axios.put.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật cả bảng" }));
  expect(screen.getByRole("button", { name: "Xuất file" })).toBeDisabled();
  finish({ data: { ...data, revision: 1 } });
  await screen.findByText("Đã cập nhật bảng điểm cho 1 học viên.");
  expect(screen.getByRole("button", { name: "Xuất file" })).toBeEnabled();
});
