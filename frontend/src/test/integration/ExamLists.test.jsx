import { AuthSessionContext } from "../../context/AuthSession";
import { act, fireEvent, render as renderUi, screen, waitFor, within } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@mui/material";
import axios from "axios";
import ExcelJS from "exceljs";
import ExamLists from "../../pages/masters/examLists";
import { draftOf, isExamCandidate } from "../../features/exams/gradebook";
import { calculateExamEligibility } from "../../features/exams/gradingPolicy";
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
let testPermissions = [];
const render = ui => renderUi(<AuthSessionContext.Provider value={{ access: { permissions: testPermissions } }}><ThemeProvider theme={testTheme}>{ui}</ThemeProvider></AuthSessionContext.Provider>);
const savedRow = { participantId: "student:one", code: "HV001", fullName: "Nguyễn Văn An", dob: "1990-01-02", gender: "Nam", eligible: null, examExempt: false, testScore: null, assignmentScore: null, examScore: null, courseScore: null, grade4: null, letterGrade: "", attemptScores: [], result: "pending" };
const data = { revision: 0, rows: [savedRow], total: 1, totalRows: 1, unassessedRows: 1, page: 1, pageSize: 15 };
const paged = (gradeRows, params = {}) => {
  const include = (params.includeIds || "").split(","), exclude = (params.excludeIds || "").split(",");
  const assessed = gradeRows.map(draftOf);
  const found = assessed.filter(row => (params.mode !== "exam" || ((include.includes(row.participantId) || isExamCandidate(row)) && !exclude.includes(row.participantId))) &&
    (!params.search || `${row.code} ${row.fullName}`.toLowerCase().includes(params.search.toLowerCase())));
  const page = Math.min(params.page || 1, Math.max(1, Math.ceil(found.length / 15)));
  return { revision: 0, rows: found.slice((page - 1) * 15, page * 15), total: found.length, totalRows: gradeRows.length, unassessedRows: assessed.filter(row => row.eligible === null).length, page, pageSize: 15 };
};
const setup = (role = "admin", gradeRows = data.rows) => {
  testPermissions = role === "admin" ? ["gradebook.submit", "gradebook.approve"] : role === "examiner" ? ["gradebook.submit"] : [];
  // A save must not mutate the shared baseline used by subsequent tests.
  gradeRows = gradeRows.map(row => row === savedRow ? { ...row, attemptScores: [...(row.attemptScores || [])] } : row);
  axios.put.mockImplementation(async (_, payload) => {
    payload.rows.forEach(value => Object.assign(gradeRows.find(row => row.participantId === value.participantId), value));
    return { data: { ...paged(gradeRows, payload), revision: 1 } };
  });
  axios.get.mockImplementation(async (url, config) => ({ data: url.endsWith("/options") ? {
    groups: [{ id: "g1", name: "CNTT 2026", code: "N01", academicYear: "2026", majorId: "m1", major: { name: "Công nghệ thông tin" } }],
    courseOfferings: [{ id: "o1", status: "completed", name: "Lớp An toàn thông tin", subjectId: "s1", subject: { id: "s1", code: "HP01", name: "An toàn thông tin" }, groupLinks: [{ classGroupId: "g1" }] }],
  } : url.endsWith("/isStaff") ? { message: role } : paged(gradeRows, config?.params) }));
};
// Toastify queues dismissal events. Flush the previous unmounted container's
// events before a new test reuses the same warning IDs.
beforeEach(async () => {
  await new Promise(resolve => setTimeout(resolve, 0));
  jest.clearAllMocks(); localStorage.clear(); setup();
});

it("locks approved grades and requires an explicit reopening reason", async () => {
  setup("admin", [{ ...savedRow, testScore: 8, assignmentScore: 8, examScore: 8 }]);
  const original = axios.get.getMockImplementation();
  let workflow = { status: "approved", version: 2 };
  axios.get.mockImplementation(async (url, config) => {
    const result = await original(url, config);
    return url.endsWith("/exam-lists") ? { data: { ...result.data, workflow } } : result;
  });
  axios.post.mockImplementation(async () => { workflow = { status: "draft", version: 3 }; return { data: {} }; });
  render(<ExamLists />);
  expect(await screen.findByLabelText("Điểm kiểm tra HV001")).toBeDisabled();
  expect(screen.getByText("Đã duyệt và khóa")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Mở lại để sửa" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByRole("button", { name: "Xác nhận" })).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText("Lý do hoặc căn cứ"), { target: { value: "Điều chỉnh theo biên bản" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/exam-lists/workflow"), expect.objectContaining({ action: "reopen", version: 2, note: "Điều chỉnh theo biên bản" })));
  await waitFor(() => expect(screen.getByLabelText("Điểm kiểm tra HV001")).toBeEnabled());
});

it("allows an examiner to submit but not approve a complete gradebook", async () => {
  setup("examiner", [{ ...savedRow, testScore: 8, assignmentScore: 8, examScore: 8 }]);
  const original = axios.get.getMockImplementation();
  let workflow = { status: "draft", version: 0 };
  axios.get.mockImplementation(async (url, config) => {
    const result = await original(url, config);
    return url.endsWith("/exam-lists") ? { data: { ...result.data, workflow } } : result;
  });
  axios.post.mockImplementation(async () => { workflow = { status: "submitted", version: 1 }; return { data: {} }; });
  render(<ExamLists />);
  await screen.findByLabelText("Điểm kiểm tra HV001");
  fireEvent.click(screen.getByRole("button", { name: "Gửi duyệt điểm" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Lý do hoặc căn cứ"), { target: { value: "Đã đối chiếu điểm" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận" }));
  await screen.findByText("Chờ duyệt");
  expect(screen.getByLabelText("Điểm kiểm tra HV001")).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Duyệt và khóa điểm" })).not.toBeInTheDocument();
});

it.each([
  { result: "passed", examScore: 8, courseScore: 8 },
  { result: "failed", examScore: 2, courseScore: 4.4 },
])("keeps a paused learner's completed $result attempt visible with the study status", async outcome => {
  setup("admin", [{ ...savedRow, studyStatus: "Đang bảo lưu", testScore: 8, assignmentScore: 8,
    examScore: outcome.examScore, courseScore: outcome.courseScore, result: outcome.result }]);
  render(<ExamLists />);
  expect(await screen.findByLabelText("Kết quả điểm HV001")).toHaveValue(outcome.result);
  const row = screen.getByText("HV001").closest("tr");
  expect(within(row).getByText("Đang bảo lưu")).toBeInTheDocument();
  expect(screen.getByLabelText("Điểm thi hết môn HV001")).toHaveValue(`${outcome.examScore}.0`);
  expect(screen.getByLabelText("Điểm học phần HV001")).toHaveValue(outcome.courseScore.toFixed(1));
  expect(axios.put).not.toHaveBeenCalled();
});

it("locks unfinished classes, shows the yellow warning at the right, and unlocks after completion on refocus", async () => {
  let status = "active";
  const defaultGet = axios.get.getMockImplementation();
  axios.get.mockImplementation(async (url, config) => {
    const response = await defaultGet(url, config);
    if (url.endsWith("/options")) response.data.courseOfferings[0].status = status;
    else if (url.endsWith("/exam-lists")) response.data = { ...response.data, offering: { id: "o1", status } };
    return response;
  });
  render(<ExamLists />);
  const input = await screen.findByLabelText("Điểm kiểm tra HV001");
  expect(input).toBeDisabled();
  expect(screen.getByLabelText("Điểm BTL/TL/KT HV001")).toBeDisabled();
  expect(screen.getByLabelText("Điểm thi hết môn HV001")).toBeDisabled();
  expect(screen.getByLabelText("Miễn thi HV001")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cập nhật cả bảng" })).toBeDisabled();
  const warning = await screen.findByText("Vui lòng xác nhận hoàn thành giảng dạy trước khi nhập điểm.");
  expect(warning.closest(".Toastify__toast")).toHaveClass("exam-warning-toast");
  expect(warning.closest(".Toastify__toast-container")).toHaveClass("Toastify__toast-container--top-right");
  fireEvent.change(input, { target: { value: "8" } });
  expect(input).toHaveValue("");
  expect(axios.put).not.toHaveBeenCalled();
  status = "completed";
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(screen.getByLabelText("Điểm kiểm tra HV001")).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Điểm kiểm tra HV001"), { target: { value: "8" } });
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật cả bảng" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(1));
});

it("refreshes a profile exemption as checked and passed, discards a stale draft, and restores entry when removed", async () => {
  const gradeRows = [{ ...savedRow, testScore: null, assignmentScore: null, examScore: null }];
  setup("admin", gradeRows);
  render(<ExamLists />);
  fireEvent.change(await screen.findByLabelText("Điểm kiểm tra HV001"), { target: { value: "8" } });
  expect(screen.getByRole("button", { name: "Cập nhật cả bảng" })).toBeEnabled();
  Object.assign(gradeRows[0], { profileForeignLanguageExempt: true, examExempt: true, result: "passed" });
  fireEvent(window, new CustomEvent("exam-gradebook-saved", { detail: { source: "profile" } }));
  await waitFor(() => expect(screen.getByLabelText("Miễn thi HV001")).toBeChecked());
  expect(screen.getByLabelText("Miễn thi HV001")).toBeDisabled();
  expect(screen.getByLabelText("Kết quả điểm HV001")).toHaveValue("passed");
  expect(screen.getByLabelText("Điểm kiểm tra HV001")).toHaveValue("");
  expect(screen.getByLabelText("Điểm kiểm tra HV001")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cập nhật cả bảng" })).toBeDisabled();
  expect(axios.put).not.toHaveBeenCalled();
  Object.assign(gradeRows[0], { profileForeignLanguageExempt: false, examExempt: false, result: "pending" });
  fireEvent(window, new CustomEvent("exam-gradebook-saved", { detail: { source: "profile" } }));
  await waitFor(() => expect(screen.getByLabelText("Miễn thi HV001")).not.toBeChecked());
  expect(screen.getByLabelText("Điểm kiểm tra HV001")).toBeEnabled();
  expect(screen.getByLabelText("Kết quả điểm HV001")).toHaveValue("pending");
});

it("shows interrupted study-leave failures read-only without replacing missing marks with zero", async () => {
  setup("admin", [{ ...savedRow, studyLeaveFailure: true, testScore: 7, assignmentScore: 8, result: "failed", studyStatus: "Đang bảo lưu" }]);
  render(<ExamLists />);
  expect(await screen.findByLabelText("Kết quả điểm HV001")).toHaveValue("failed");
  expect(screen.getByLabelText("Kết quả điểm HV001").selectedOptions[0]).toHaveTextContent("Không đạt");
  expect(screen.getByLabelText("Điểm kiểm tra HV001")).toHaveValue("7.0");
  expect(screen.getByLabelText("Điểm kiểm tra HV001")).toBeDisabled();
  expect(screen.getByLabelText("Điểm thi hết môn HV001")).toHaveValue("");
  expect(screen.getByLabelText("Điểm học phần HV001")).toHaveValue("");
  expect(screen.getByLabelText("Miễn thi HV001")).toBeDisabled();
  expect(axios.put).not.toHaveBeenCalled();
});

it("shows saved ineligible rows as failed on initial load even when the stored result is pending", async () => {
  setup("admin", [{ ...savedRow, testScore: 6, assignmentScore: 3, result: "pending" }]);
  render(<ExamLists />);
  expect(await screen.findByLabelText("Kết quả điểm HV001")).toHaveValue("failed");
  expect(screen.getByLabelText("Điểm thi hết môn HV001")).toHaveValue("0.0");
  expect(screen.getByLabelText("Điểm học phần HV001")).toHaveValue("0.0");
  expect(screen.getByLabelText("Thang điểm 4 HV001")).toHaveValue("0.0");
  expect(screen.getByLabelText("Thang điểm chữ HV001")).toHaveValue("F");
  expect(screen.getByLabelText("Điểm thi hết môn HV001")).toBeDisabled();
  expect(axios.put).not.toHaveBeenCalled();
});

it("immediately fails an ineligible learner, locks exam entry and allows saving without an exam", async () => {
  setup("admin", [{ ...savedRow }]);
  render(<ExamLists />);
  const test = await screen.findByLabelText("Điểm kiểm tra HV001");
  fireEvent.change(test, { target: { value: "6" } });
  expect(screen.getByLabelText("Kết quả điểm HV001")).toHaveValue("pending");
  fireEvent.change(screen.getByLabelText("Điểm BTL/TL/KT HV001"), { target: { value: "3" } });
  expect(screen.getByLabelText("Kết quả điểm HV001")).toHaveValue("failed");
  expect(screen.getByLabelText("Điểm thi hết môn HV001")).toBeDisabled();
  expect(test).not.toBeDisabled();
  expect(screen.getByLabelText("Điểm BTL/TL/KT HV001")).not.toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật cả bảng" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    rows: [expect.objectContaining({ result: "failed", examScore: null, courseScore: 0 })],
  })));
  await waitFor(() => expect(screen.getByRole("button", { name: "Cập nhật cả bảng" })).toBeDisabled());
  expect(screen.getByLabelText("Kết quả điểm HV001")).toHaveValue("failed");
  fireEvent.change(screen.getByLabelText("Điểm BTL/TL/KT HV001"), { target: { value: "6" } });
  expect(screen.getByLabelText("Điểm thi hết môn HV001")).not.toBeDisabled();
  expect(screen.getByLabelText("Kết quả điểm HV001")).toHaveValue("pending");
  fireEvent.change(screen.getByLabelText("Điểm thi hết môn HV001"), { target: { value: "3" } });
  expect(screen.getByLabelText("Kết quả điểm HV001")).toHaveValue("failed");
  expect(screen.getByLabelText("Điểm thi hết môn HV001")).not.toBeDisabled();
});

it("selects subject names and local curriculum codes while keeping the entire shared roster", async () => {
  const groups = [
    { id: "g1", name: "CKTM 2026", code: "CKTM", academicYear: "2026", majorId: "m1", major: { name: "Cơ khí thông minh và Robot" } },
    { id: "g2", name: "CNTT 2026", code: "CNTT", academicYear: "2026", majorId: "m2", major: { name: "Công nghệ thông tin" } },
    { id: "g3", name: "TĐH 2026", code: "TDH", academicYear: "2026", majorId: "m3", major: { name: "Tự động hóa" } },
  ];
  const english = { id: "english-robot", name: "Tiếng anh", code: "HPTA" };
  const ai = { id: "ai-robot", name: "Trí tuệ nhân tạo", code: "CKAI" };
  const courseOfferings = [
    { id: "english", status: "completed", name: "Lớp Tiếng anh ghép 3 chuyên ngành", subject: english, groupLinks: groups.map((group, index) => ({ classGroupId: group.id, subject: { ...english, id: `english-${index}` } })) },
    { id: "ai", status: "completed", name: "Lớp Trí tuệ nhân tạo ghép 3 chuyên ngành", subject: ai, groupLinks: groups.map((group, index) => ({ classGroupId: group.id, subject: { ...ai, id: `ai-${index}`, code: ["CKAI", "ITAI", "TDAI"][index] } })) },
  ];
  const gradeRows = Array.from({ length: 18 }, (_, index) => ({ ...savedRow,
    participantId: `student:${index + 1}`, code: `HV${String(index + 1).padStart(3, "0")}`, fullName: `Học viên ${index + 1}`,
  }));
  axios.get.mockImplementation(async (url, config) => ({ data: url.endsWith("/options") ? { groups, courseOfferings }
    : url.endsWith("/isStaff") ? { message: "admin" }
      : paged(config?.params?.rosterScope === "offering" ? gradeRows : gradeRows.slice(0, 6), config?.params) }));
  axios.put.mockImplementation(async (_, payload) => ({ data: { ...paged(gradeRows, payload), revision: 1 } }));
  render(<ExamLists />);
  await screen.findByLabelText("Điểm kiểm tra HV001");
  expect(screen.getByLabelText("Tên lớp học phần")).toHaveTextContent("Tiếng anh");
  expect(screen.getByLabelText("Môn")).toHaveTextContent("HPTA - Tiếng anh");
  expect(screen.getByText("18 / 18 học viên")).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByLabelText("Tên lớp học phần"));
  const names = screen.getByRole("listbox");
  expect(within(names).getAllByRole("option")).toHaveLength(2);
  expect(names).toHaveTextContent("Lớp Tiếng anh ghép 3 chuyên ngành");
  fireEvent.click(within(names).getByRole("option", { name: /Lớp Trí tuệ nhân tạo/ }));
  expect(screen.getByLabelText("Môn")).toHaveTextContent("CKAI - Trí tuệ nhân tạo");
  fireEvent.mouseDown(screen.getByLabelText("Chuyên ngành"));
  fireEvent.click(within(screen.getByRole("listbox")).getByText("Công nghệ thông tin"));
  await waitFor(() => expect(screen.getByLabelText("Môn")).toHaveTextContent("ITAI - Trí tuệ nhân tạo"));
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/exam-lists$/), { params: expect.objectContaining({ classGroupId: "g2", courseOfferingId: "ai", rosterScope: "offering" }) });
  fireEvent.mouseDown(screen.getByLabelText("Tên lớp học phần"));
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: /Lớp Tiếng anh/ }));
  await waitFor(() => expect(screen.getByLabelText("Môn")).toHaveTextContent("HPTA - Tiếng anh"));
  await waitFor(() => expect(screen.getByRole("button", { name: /page 2/i })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: /page 2/i }));
  fireEvent.change(await screen.findByLabelText("Điểm kiểm tra HV018"), { target: { value: "8" } });
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật cả bảng" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringMatching(/\/exam-lists$/), expect.objectContaining({
    classGroupId: "g2", courseOfferingId: "english", rosterScope: "offering", rows: [expect.objectContaining({ participantId: "student:18", testScore: 8 })],
  })));
});

it("opens and saves the old CNTT–QLTC gradebook separately from a newer cross-cohort offering of HPTA", async () => {
  const groups = [
    { id: "g1", code: "CNTT 2026.1.1", academicYear: "2026", majorId: "cntt", major: { name: "Công nghệ thông tin" } },
    { id: "g2", code: "QLTC 2026.1.1", academicYear: "2026", majorId: "qltc", major: { name: "Quản lý tài chính" } },
    { id: "g3", code: "CNTT 2025.1.1", academicYear: "2025", majorId: "cntt", major: { name: "Công nghệ thông tin" } },
    { id: "g4", code: "CNTT 2026.1.2", academicYear: "2026", majorId: "cntt", major: { name: "Công nghệ thông tin" } },
  ];
  const subject = { id: "english", code: "HPTA", name: "Tiếng Anh" };
  const newName = "Tiếng Anh — CNTT 2025.1.1 + CNTT 2026.1.1 + CNTT 2026.1.2";
  const oldName = "Tiếng Anh — CNTT 2026.1.1 + QLTC 2026.1.1";
  const courseOfferings = [
    { id: "new", name: newName, status: "active", subject, groupLinks: ["g1", "g3", "g4"].map(classGroupId => ({ classGroupId })) },
    { id: "old", name: oldName, status: "completed", subject, groupLinks: ["g1", "g2"].map(classGroupId => ({ classGroupId })) },
  ];
  const oldRow = { ...savedRow, code: "OLD001", testScore: 8, assignmentScore: 8, examScore: 8, courseScore: 8, result: "passed" };
  axios.get.mockImplementation(async (url, config) => ({ data: url.endsWith("/options") ? { groups, courseOfferings }
    : url.endsWith("/isStaff") ? { message: "admin" }
      : { ...data, offering: courseOfferings.find(offering => offering.id === config.params.courseOfferingId),
        rows: [config.params.courseOfferingId === "old" ? oldRow : { ...savedRow, code: "NEW001", testScore: null }] } }));
  axios.put.mockImplementation(async (_, payload) => ({ data: { ...data, offering: courseOfferings[1], revision: 1, rows: [{ ...oldRow, ...payload.rows[0] }] } }));
  render(<ExamLists />);
  expect(await screen.findByLabelText("Điểm kiểm tra NEW001")).toBeDisabled();
  fireEvent.mouseDown(screen.getByLabelText("Năm"));
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "2025" }));
  await screen.findByLabelText("Điểm kiểm tra NEW001");
  fireEvent.mouseDown(screen.getByLabelText("Tên lớp học phần"));
  expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(1);
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: newName }));
  fireEvent.mouseDown(screen.getByLabelText("Năm"));
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "2026" }));
  await screen.findByLabelText("Điểm kiểm tra NEW001");
  fireEvent.mouseDown(screen.getByLabelText("Tên lớp học phần"));
  const list = screen.getByRole("listbox");
  expect(within(list).getAllByRole("option")).toHaveLength(2);
  expect(within(list).getByRole("option", { name: newName })).toBeInTheDocument();
  fireEvent.click(within(list).getByRole("option", { name: oldName }));
  const input = await screen.findByLabelText("Điểm kiểm tra OLD001");
  expect(input).toBeEnabled();
  expect(input).toHaveValue("8.0");
  expect(screen.queryByLabelText("Điểm kiểm tra NEW001")).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: "9" } });
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật cả bảng" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    classGroupId: "g1", courseOfferingId: "old", rosterScope: "offering",
    rows: [expect.objectContaining({ testScore: 9 })],
  })));
});

it("locks qualification and derives it from current minimums while waiting for the exam outcome", async () => {
  const policy = { minimums: { testScore: 6, assignmentScore: 7, examScore: 4 } };
  setup("admin", [{ ...savedRow, eligibilityPolicy: policy }]);
  render(<ExamLists />);
  const testScore = await screen.findByLabelText("Điểm kiểm tra HV001");
  const qualification = screen.getByLabelText("Tư cách thi HV001");
  expect(qualification).toBeDisabled();
  fireEvent.change(testScore, { target: { value: "6" } });
  expect(qualification).not.toBeChecked();
  fireEvent.change(screen.getByLabelText("Điểm BTL/TL/KT HV001"), { target: { value: "6" } });
  expect(qualification).not.toBeChecked();
  expect(screen.getByText("Không đủ tư cách")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Điểm BTL/TL/KT HV001"), { target: { value: "7" } });
  expect(qualification).toBeChecked();
  expect(screen.getByLabelText("Kết quả điểm HV001")).toHaveValue("pending");
  fireEvent.change(screen.getByLabelText("Điểm thi hết môn HV001"), { target: { value: "8" } });
  expect(screen.getByLabelText("Kết quả điểm HV001")).toHaveValue("passed");
  fireEvent.change(screen.getByLabelText("Điểm thi hết môn HV001"), { target: { value: "3" } });
  expect(screen.getByLabelText("Kết quả điểm HV001")).toHaveValue("failed");
  fireEvent.click(screen.getByLabelText("Miễn thi HV001"));
  expect(qualification).not.toBeChecked();
  expect(screen.getByLabelText("Kết quả điểm HV001")).toHaveValue("exempt");
  expect(screen.getByLabelText("Điểm học phần HV001")).toHaveAttribute("readonly");
  expect(screen.getByLabelText("Điểm học phần HV001").closest("td")).toHaveClass("exam-derived-cell");
});

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
  expect(screen.getByLabelText("Tên lớp học phần")).toHaveTextContent("Lớp An toàn thông tin");
  expect(axios.get.mock.calls.filter(([url]) => url.endsWith("/exam-lists"))).toHaveLength(gradeRequests);
});

it("downloads the active tab's columns, current draft values, and searched students", async () => {
  setup("admin", [
    { ...savedRow, testScore: 6, assignmentScore: 6, eligible: true, courseScore: 9, result: "passed" },
    { ...savedRow, participantId: "student:two", code: "HV002", testScore: 3, assignmentScore: 6, eligible: false },
    { ...savedRow, participantId: "student:three", code: "HV003", testScore: 6, assignmentScore: 6, eligible: true, result: "passed" },
    ...Array.from({ length: 19 }, (_, index) => ({ ...savedRow, participantId: `student:${index + 4}`, code: `HV${String(index + 4).padStart(3, "0")}`, testScore: 3, assignmentScore: 6 })),
  ]);
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = jest.fn(() => "blob:gradebook");
  URL.revokeObjectURL = jest.fn();
  const downloads = [];
  const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () { downloads.push(this.download); });
  const exportExamExcel = async () => {
    const count = URL.createObjectURL.mock.calls.length;
    const button = await screen.findByRole("button", { name: "Xuất file" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("menuitem", { name: "Excel (.xlsx)" }));
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
    expect(sheet.getCell("E10").value).toBe("02/01/90");
    expect(sheet.getCell("B11").value).toBe("HV002");
    expect(downloads[0]).toBe("Bang-diem-mon-hoc-N01-HP01.xlsx");
    await waitFor(() => expect(screen.getByRole("button", { name: "Cập nhật cả bảng" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật cả bảng" }));
    await waitFor(() => expect(screen.queryByText("1 học viên chưa lưu")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "DS thi" }));
    const examSheet = await exportExamExcel();
    expect(examSheet.getRow(4).values.slice(1)).toEqual(screen.getAllByRole("columnheader").map(cell => cell.textContent));
    expect(examSheet.rowCount).toBe(6);
    expect(examSheet.getCell("B5").value).toBe("HV001");
    expect(examSheet.getCell("B6").value).toBe("HV003");
    expect(examSheet.getCell("I4").value).toBe("Ghi chú");
    expect(examSheet.getCell("A4").fill.fgColor.argb).toBe("FFDCE6F1");
    expect(examSheet.pageSetup).toMatchObject({ paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 });
    expect(downloads[1]).toBe("DS-thi-N01-HP01.xlsx");
    expect(screen.queryByRole("button", { name: "Xuất CSV" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Tìm kiếm" }), { target: { value: "HV003" } });
    const searchedSheet = await exportExamExcel();
    expect(searchedSheet.rowCount).toBe(5);
    expect(searchedSheet.getCell("A5").value).toBe(1);
    expect(searchedSheet.getCell("B5").value).toBe("HV003");
    expect(axios.put).toHaveBeenCalledTimes(1);
  } finally {
    // Đợi các URL tải file được giải phóng trước khi khôi phục API trình duyệt.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    click.mockRestore();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});

it("selects separate offerings of the same subject with an optional year filter", async () => {
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
  expect(screen.getByLabelText("Tên lớp học phần")).toHaveTextContent("An toàn thông tin");
  fireEvent.mouseDown(screen.getByLabelText("Chuyên ngành"));
  fireEvent.click(within(screen.getByRole("listbox")).getByText("Quản trị kinh doanh"));
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/exam-lists$/), { params: expect.objectContaining({ classGroupId: "g2", courseOfferingId: "o2", pageSize: 15 }) }));
  expect(screen.getByLabelText("Môn")).toHaveTextContent("Marketing");
  expect(screen.getByLabelText("Năm")).toHaveTextContent("Tất cả năm");
  fireEvent.mouseDown(screen.getByLabelText("Tên lớp học phần"));
  const classes = screen.getByRole("listbox");
  expect(within(classes).queryByText(/An toàn thông tin/)).not.toBeInTheDocument();
  expect(within(classes).getByRole("option", { name: /Marketing 2026/ })).toBeInTheDocument();
  expect(within(classes).getByRole("option", { name: /Marketing 2025/ })).toBeInTheDocument();
  fireEvent.click(within(classes).getByRole("option", { name: /Quản trị 2025/ }));
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/exam-lists$/), { params: expect.objectContaining({ classGroupId: "g3", courseOfferingId: "o4", pageSize: 15 }) }));
  expect(screen.getByLabelText("Môn")).toHaveTextContent("Quản trị chiến lược");
  fireEvent.mouseDown(screen.getByLabelText("Tên lớp học phần"));
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: /Marketing 2025/ }));
  await waitFor(() => expect(screen.getByLabelText("Tên lớp học phần")).toHaveTextContent("Marketing"));
  expect(axios.get).toHaveBeenLastCalledWith(expect.stringMatching(/\/exam-lists$/), { params: expect.objectContaining({ classGroupId: "g3", courseOfferingId: "o3" }) });
  fireEvent.mouseDown(screen.getByLabelText("Tên lớp học phần"));
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: /Marketing 2026/ }));
  await waitFor(() => expect(axios.get).toHaveBeenLastCalledWith(expect.stringMatching(/\/exam-lists$/), { params: expect.objectContaining({ classGroupId: "g2", courseOfferingId: "o2" }) }));
  fireEvent.mouseDown(screen.getByLabelText("Năm"));
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "2025" }));
  await waitFor(() => expect(axios.get).toHaveBeenLastCalledWith(expect.stringMatching(/\/exam-lists$/), { params: expect.objectContaining({ classGroupId: "g3", courseOfferingId: "o3" }) }));
  fireEvent.mouseDown(screen.getByLabelText("Tên lớp học phần"));
  expect(within(screen.getByRole("listbox")).queryByRole("option", { name: /Marketing 2026/ })).not.toBeInTheDocument();
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: /Marketing 2025/ }));
  fireEvent.mouseDown(screen.getByLabelText("Năm"));
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Tất cả năm" }));
  fireEvent.mouseDown(screen.getByLabelText("Tên lớp học phần"));
  expect(within(screen.getByRole("listbox")).getByRole("option", { name: /Marketing 2026/ })).toBeInTheDocument();
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
  const savedEvent = jest.fn();
  window.addEventListener("exam-gradebook-saved", savedEvent, { once: true });
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
  expect(savedEvent).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem("exam-gradebook-revision")).toBeTruthy();
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
  setup("supervisor", [{ ...savedRow, testScore: 6, assignmentScore: 6, eligible: true, result: "passed" }]);
  render(<ExamLists />);
  expect(await screen.findByLabelText("Điểm học phần HV001")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cập nhật cả bảng" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "DS thi" }));
  await screen.findByLabelText("Ghi chú HV001");
  expect(screen.queryByLabelText("Điểm học phần HV001")).not.toBeInTheDocument();
  for (const label of ["Điểm kiểm tra", "Điểm BTL/TL/KT", "Điểm thi hết môn", "Điểm học phần", "Thang điểm 4", "Thang điểm chữ", "Điểm các lần thi hết môn"]) {
    expect(screen.queryByRole("columnheader", { name: new RegExp(`^${label}`) })).not.toBeInTheDocument();
  }
  expect(within(screen.getByTestId("exam-print-table")).getAllByRole("columnheader", { hidden: true })).toHaveLength(9);
  expect(screen.queryByRole("columnheader", { name: /^Kết quả điểm/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cả bảng điểm" }));
  expect(await screen.findByLabelText("Điểm học phần HV001")).toBeInTheDocument();
  expect(axios.put).not.toHaveBeenCalled();
});

it("shows an unsaved passed student in DS thi and saves notes included in the print table", async () => {
  setup("admin", [{ ...savedRow }]);
  const passedRow = { ...savedRow, testScore: 6, assignmentScore: 6, examScore: 6, courseScore: 6, result: "passed", notes: "Ghi chú học viên" };
  render(<ExamLists />);
  await screen.findByLabelText("Điểm kiểm tra HV001");
  for (const label of ["Điểm kiểm tra", "Điểm BTL/TL/KT", "Điểm thi hết môn"]) {
    fireEvent.change(screen.getByLabelText(`${label} HV001`), { target: { value: "6" } });
  }
  fireEvent.click(screen.getByRole("button", { name: "DS thi" }));
  expect(await screen.findByLabelText("Miễn thi HV001")).not.toBeChecked();
  expect(screen.queryByLabelText("Kết quả điểm HV001")).not.toBeInTheDocument();
  expect(screen.queryByText("Hãy nhập đủ điểm thành phần cho tất cả học viên!")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Tư cách thi HV001")).toBeChecked();
  expect(screen.getByLabelText("Tư cách thi HV001")).toBeDisabled();
  const headers = screen.getAllByRole("columnheader").map(cell => cell.textContent);
  expect(headers.slice(-2)).toEqual(["Miễn thi", "Ghi chú"]);
  const notes = screen.getByLabelText("Ghi chú HV001");
  expect(notes).toBeEnabled();
  fireEvent.change(notes, { target: { value: passedRow.notes } });
  expect(screen.getByRole("button", { name: "Xuất file" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật cả bảng" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ rows: [expect.objectContaining({ result: "passed", notes: passedRow.notes })] })));
  expect(await screen.findByText("Đã cập nhật bảng điểm cho 1 học viên.")).toBeInTheDocument();
  expect(screen.getByLabelText("Ghi chú HV001")).toHaveValue(passedRow.notes);
  expect(within(screen.getByTestId("exam-print-table")).getByText(passedRow.notes)).toBeInTheDocument();
});

it("blocks exam exports if even one student elsewhere in the class is not assessed", async () => {
  const roster = Array.from({ length: 16 }, (_, index) => ({ ...savedRow, participantId: `student:${index}`, code: `HV${index + 1}`, testScore: 4, assignmentScore: index === 15 ? null : 4 }));
  setup("admin", roster);
  render(<ExamLists />);
  await screen.findByLabelText("\u0110i\u1ec3m ki\u1ec3m tra HV1");
  fireEvent.click(screen.getByRole("button", { name: "DS thi" }));
  await screen.findByLabelText("T\u01b0 c\u00e1ch thi HV1");
  expect(screen.getByRole("button", { name: "Xuất file" })).toBeDisabled();
  const warning = await screen.findByText("Hãy nhập đủ điểm thành phần cho tất cả học viên!");
  expect(warning.closest('[role="alert"]')).toBeInTheDocument();
  expect(warning.closest(".Toastify__toast")).toHaveClass("exam-warning-toast");
  expect(warning.closest(".Toastify__toast-container")).toHaveClass("Toastify__toast-container--top-right");
  expect(within(screen.getByTestId("exam-print-table")).getAllByRole("row", { hidden: true })).toHaveLength(1);
  fireEvent.change(screen.getByRole("textbox", { name: "Tìm kiếm" }), { target: { value: "HV1" } });
  await screen.findByLabelText("T\u01b0 c\u00e1ch thi HV1");
  expect(screen.getByRole("button", { name: "Xuất file" })).toBeDisabled();
  expect(screen.getByText("Hãy nhập đủ điểm thành phần cho tất cả học viên!")).toBeInTheDocument();
});

it("shows the missing-score toast on click while the exam list is still loading", async () => {
  render(<ExamLists />);
  await screen.findByLabelText("Điểm kiểm tra HV001");
  const original = axios.get.getMockImplementation();
  let finishRequest;
  axios.get.mockImplementation((url, config) => config?.params?.mode === "exam"
    ? new Promise(resolve => { finishRequest = () => resolve({ data: paged([{ ...savedRow }], config.params) }); })
    : original(url, config));
  fireEvent.click(screen.getByRole("button", { name: "DS thi" }));
  expect(await screen.findByText("Hãy nhập đủ điểm thành phần cho tất cả học viên!")).toBeInTheDocument();
  expect(screen.getByLabelText("Đang tải bảng điểm")).toBeInTheDocument();
  await act(async () => finishRequest());
  expect(screen.getByText("Hãy nhập đủ điểm thành phần cho tất cả học viên!")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Xuất file" })).toBeDisabled();
});

it("shows eligible pending and failed examinees, excluding exemptions and failed prerequisites", async () => {
  setup("admin", [
    { ...savedRow, testScore: 4, assignmentScore: 4 },
    { ...savedRow, participantId: "student:two", code: "HV002", testScore: 3, assignmentScore: 8, result: "passed" },
    { ...savedRow, participantId: "student:three", code: "HV003", testScore: 8, assignmentScore: 8, examExempt: true },
    { ...savedRow, participantId: "student:four", code: "HV004", testScore: 6, assignmentScore: 6, examScore: 3, result: "failed" },
  ]);
  render(<ExamLists />);
  await screen.findByLabelText("\u0110i\u1ec3m ki\u1ec3m tra HV001");
  fireEvent.click(screen.getByRole("button", { name: "DS thi" }));
  await screen.findByLabelText("T\u01b0 c\u00e1ch thi HV001");
  expect(screen.getByLabelText("T\u01b0 c\u00e1ch thi HV001")).toBeDisabled();
  expect(screen.queryByText("HV002")).not.toBeInTheDocument();
  expect(screen.queryByText("HV003")).not.toBeInTheDocument();
  expect(screen.getAllByText("HV004").length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: "Xuất file" })).toBeEnabled();
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
    ...savedRow, participantId: `student:${index + 1}`, code: `HV${String(index + 1).padStart(3, "0")}`, testScore: 6, assignmentScore: 6, eligible: true, result: "passed",
  })));
  render(<ExamLists />);
  await screen.findByLabelText("Điểm kiểm tra HV001");
  fireEvent.click(screen.getByRole("button", { name: /page 2/i }));
  await screen.findByLabelText("Điểm kiểm tra HV016");
  fireEvent.change(screen.getByRole("textbox", { name: "Tìm kiếm" }), { target: { value: "HV001" } });
  expect(await screen.findByLabelText("Điểm kiểm tra HV001")).toBeInTheDocument();
  expect(screen.getByText("Hiển thị 1–1 trên 1 học viên")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Tìm kiếm" }), { target: { value: "" } });
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
    fireEvent.change(screen.getByRole("textbox", { name: "Tìm kiếm" }), { target: { value: "HV030" } });
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
    expect(screen.getByRole("textbox", { name: "Tìm kiếm" })).toBeDisabled();
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
