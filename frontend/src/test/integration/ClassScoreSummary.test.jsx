import { renderToastHost } from "../renderToastHost";
beforeEach(renderToastHost);
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import ClassScoreSummary from "../../pages/reports/classScoreSummary";
import { createClassScoreWorkbook } from "../../pages/reports/classScoreSummaryExcel";
import { downloadDocumentFile } from "../../utils/documentFiles";
import { notifyGradebookSaved } from "../../utils/gradebookRevision";
import { fetchClassTranscripts, generateTranscriptDocuments } from "../../features/learners/learnerTranscriptBatch";
import { openLearnerTranscriptPdfPreview } from "../../features/learners/learnerTranscriptPdfPreview";
import { packTranscriptZip } from "../../features/learners/learnerTranscriptZip";
vi.mock("../../features/learners/learnerTranscriptBatch", () => ({ fetchClassTranscripts: vi.fn(), generateTranscriptDocuments: vi.fn() }));
vi.mock("../../features/learners/learnerTranscriptPdfPreview", () => ({ openLearnerTranscriptPdfPreview: vi.fn() }));
vi.mock("../../features/learners/learnerTranscriptZip", () => ({ packTranscriptZip: vi.fn() }));

jest.mock("axios");
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });
jest.mock("../../utils/documentFiles", async () => ({ ...await vi.importActual("../../utils/documentFiles"), downloadDocumentFile: jest.fn() }));
jest.mock("../../pages/reports/classScoreSummaryExcel", async (importOriginal) => ({
  ...await importOriginal(), createClassScoreWorkbook: jest.fn(),
}));


const groups = [
  { id: "g1", code: "CNTT2026.1.1", academicYear: "2026", major: { id: "m1", name: "Công nghệ thông tin", disciplineId: "d1", discipline: { id: "d1", name: "Kỹ thuật" } } },
  { id: "g2", code: "QTKD2026.1.1", academicYear: "2026", major: { id: "m2", name: "Quản trị kinh doanh", disciplineId: "d2", discipline: { id: "d2", name: "Kinh tế" } } },
  { id: "g3", code: "CNTT2025.1.1", academicYear: "2025", major: { id: "m1", name: "Công nghệ thông tin", disciplineId: "d1", discipline: { id: "d1", name: "Kỹ thuật" } } },
];
const subjects = [
  { id: "hp1", code: "HP01", name: "Triết học", credits: 3, isRequired: true },
  { id: "hp2", code: "HP02", name: "Tiếng Anh", credits: 3, isRequired: true },
  { id: "hp3", code: "HP03", name: "Luận văn", credits: 10, isRequired: true },
];
const student = { participantId: "student:one", code: "HV001", fullName: "Nguyễn Văn An", dob: "1997-04-16", gender: "Nam", scores: { hp1: { score: 0, result: "failed" }, hp2: { score: null, result: "exempt" } } };
const reportFor = (id) => ({ group: groups.find(group => group.id === id), curriculum: { name: "CTĐT Thạc sĩ", totalCredits: 60 }, subjects, rows: [{ ...student, code: `HV00${id.slice(1)}` }], page: 1, pageSize: 50, total: 1 });
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  axios.get.mockImplementation(async (url, config) => ({ data: url.endsWith("/options") ? { groups } : reportFor(config.params.classGroupId) }));
  createClassScoreWorkbook.mockResolvedValue(new Blob(["xlsx"]));
  generateTranscriptDocuments.mockResolvedValue([{ filename: "Bang-diem.docx", blob: new Blob(["word"]) }]);
  packTranscriptZip.mockResolvedValue(new Blob(["zip"], { type: "application/zip" }));
  openLearnerTranscriptPdfPreview.mockResolvedValue();
});
const mount = () => render(<MemoryRouter useTransitions={false}><ClassScoreSummary /></MemoryRouter>);
const chooseFilter = (label, text) => {
  fireEvent.mouseDown(screen.getByLabelText(label));
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: new RegExp(`^${text}`) }));
};

it("refreshes the open class summary after exam grades are saved", async () => {
  let updated = false;
  axios.get.mockImplementation(async (url, config) => ({ data: url.endsWith("/options") ? { groups }
    : { ...reportFor(config.params.classGroupId), rows: [{ ...student, scores: { hp1: { score: updated ? 8.5 : 0, result: updated ? "passed" : "failed" } } }] } }));
  mount();
  await screen.findByText("HV001");
  updated = true;
  act(() => notifyGradebookSaved());
  expect(await screen.findByText("8.5")).toBeInTheDocument();
});

it('shows a saved disqualification as Không đạt instead of a blank cell and refreshes when the latest result changes', async () => {
  let result = 'failed';
  axios.get.mockImplementation(async (url, config) => ({ data: url.endsWith('/options') ? { groups }
    : { ...reportFor(config.params.classGroupId), rows: [{ ...student, scores: { hp1: { score: null, result, eligibilityFrozen: true } } }] } }));
  mount();
  const failed = await screen.findByText('Không đạt');
  expect(failed).toHaveClass('css-failed');
  result = 'pending';
  act(() => notifyGradebookSaved());
  await waitFor(()=>expect(screen.queryByText('Không đạt')).not.toBeInTheDocument());
});

it("shows a profile language exemption as passed in the summary after the profile is saved", async () => {
  let exempt = false;
  axios.get.mockImplementation(async (url, config) => ({ data: url.endsWith("/options") ? { groups }
    : { ...reportFor(config.params.classGroupId), rows: [{ ...student, scores: {
      hp2: exempt ? { score: null, result: "passed", profileForeignLanguageExempt: true } : null,
    } }] } }));
  mount();
  await screen.findByText("HV001");
  exempt = true;
  act(() => notifyGradebookSaved("profile"));
  expect(await screen.findByText("MT")).toBeInTheDocument();
});

it("shows the whole curriculum, preserving zero, exemption and blank ungraded cells", async () => {
  mount();
  const row = (await screen.findByText("HV001")).closest("tr");
  expect(screen.getAllByRole("columnheader").map(header => header.textContent)).toEqual(["STT", "Mã HV", "Họ đệm", "Tên", "Ngày sinh", "Giới tính", "Triết học", "Tiếng Anh", "Luận văn"]);
  expect(within(row).getAllByRole("cell").map(cell => cell.textContent)).toEqual(["1", "HV001", "Nguyễn Văn", "An", "16/04/1997", "Nam", "0", "MT", ""]);
  expect(within(row).getByText("0")).toHaveClass("css-failed");
  expect(screen.queryByText("CTĐT Thạc sĩ")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Thoát" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Ngành")).toHaveTextContent("Kỹ thuật");
  expect(screen.getByLabelText("Chuyên ngành")).toHaveTextContent("Công nghệ thông tin");
  expect(screen.queryByText(/Ô trống: chưa có điểm/)).not.toBeInTheDocument();
  expect(screen.queryByText("Số dòng:")).not.toBeInTheDocument();
});

it("scopes majors and classes by discipline and resets unavailable choices when the year changes", async () => {
  mount();
  await screen.findByText("HV001");
  chooseFilter("Ngành", "Kỹ thuật");
  chooseFilter("Chuyên ngành", "Công nghệ thông tin");
  expect(screen.getByText("HV001")).toBeInTheDocument();
  chooseFilter("Ngành", "Kinh tế");
  await screen.findByText("HV002");
  expect(screen.getByLabelText("Chuyên ngành")).toHaveTextContent("Quản trị kinh doanh");
  fireEvent.mouseDown(screen.getByLabelText("Chuyên ngành"));
  expect(within(screen.getByRole("listbox")).queryByText("Công nghệ thông tin")).not.toBeInTheDocument();
  fireEvent.click(within(screen.getByRole("listbox")).getByText("Quản trị kinh doanh"));
  chooseFilter("Năm vào trường", "2025");
  await screen.findByText("HV003");
  expect(screen.getByLabelText("Ngành")).toHaveTextContent("Kỹ thuật");
  expect(screen.getByLabelText("Chuyên ngành")).toHaveTextContent("Công nghệ thông tin");
});

it.each(["Nguyễn", "Không khớp"])("exports the whole selected class independently of table search '%s'", async (search) => {
  const full = { ...reportFor("g1"), rows: [student,
    { ...student, participantId: "student:two", code: "HV002", fullName: "Trần Văn Bình" }], total: 2 };
  const matching = search === "Nguyễn" ? [student] : [];
  const cards = full.rows.map(row => ({ student: row, group: full.group, subjects: [] }));
  fetchClassTranscripts.mockResolvedValue({ classGroup: full.group, scorecards: cards });
  axios.get.mockImplementation(async (url, config) => ({ data: url.endsWith("/options") ? { groups }
    : url.endsWith("/export") ? full : { ...full, rows: config.params.search ? matching : full.rows,
      total: config.params.search ? matching.length : full.total, page: config.params.page, pageSize: 15 } }));
  mount();
  await screen.findByText("HV001");
  const table = screen.getByRole("table");
  fireEvent.change(screen.getByLabelText("Tìm kiếm"), { target: { value: search } });
  expect(screen.getByRole("table")).toBe(table);
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/class-score-summary$/),
    { params: { classGroupId: "g1", search, page: 1, pageSize: 15 }, signal: expect.any(AbortSignal) }));
  if (matching.length) await screen.findByText("HV001");
  else await screen.findByText("Không có học viên phù hợp với tìm kiếm.");
  await waitFor(() => expect(screen.getByRole("button", { name: "Xuất báo cáo" })).toBeEnabled());
  expect(screen.queryByText("HV002")).not.toBeInTheDocument();
  expect(axios.get.mock.calls.some(([url]) => url.endsWith("/export"))).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Xuất báo cáo" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Xuất bảng điểm cả lớp" }));
  await waitFor(() => expect(createClassScoreWorkbook).toHaveBeenCalledWith(full));
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/class-score-summary\/export$/), { params: { classGroupId: "g1" } });
  expect(fetchClassTranscripts).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole("button", { name: "Xuất báo cáo" })).toBeEnabled());
  expect(screen.getByLabelText("Tìm kiếm")).toHaveValue(search);
});

it("filters classes by intake year and loads the selected class", async () => {
  mount();
  await screen.findByText("HV001");
  expect(screen.getByLabelText("Chọn lớp")).not.toHaveTextContent("CNTT2025");
  chooseFilter("Ngành", "Kinh tế");
  await screen.findByText("HV002");
  chooseFilter("Năm vào trường", "2025");
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/class-score-summary$/), { params: { classGroupId: "g3", search: "", page: 1, pageSize: 15 }, signal: expect.any(AbortSignal) }));
  await screen.findByText("HV003");
  expect(screen.getByLabelText("Chọn lớp")).toHaveTextContent("CNTT2025.1.1");
  expect(screen.getByLabelText("Chọn lớp")).not.toHaveTextContent("QTKD2026");
});

it("loads only a page, requests the next page, and resets search to page one", async () => {
  axios.get.mockImplementation(async (url, config) => ({ data: url.endsWith("/options") ? { groups } : {
    ...reportFor(config.params.classGroupId), total: config.params.search ? 1 : 40,
    page: config.params.page, pageSize: 15,
    rows: [{ ...student, code: config.params.search ? "HV040" : config.params.page === 2 ? "HV016" : "HV001" }],
  } }));
  mount();
  await screen.findByText("HV001");
  expect(axios.get.mock.calls.some(([url]) => url.endsWith("/export"))).toBe(false);
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/class-score-summary$/), { params: { classGroupId: "g1", search: "", page: 1, pageSize: 15 }, signal: expect.any(AbortSignal) });
  fireEvent.click(screen.getByRole("button", { name: /^Trang 2$/ }));
  const row = (await screen.findByText("HV016")).closest("tr");
  expect(within(row).getAllByRole("cell")[0]).toHaveTextContent("16");
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/class-score-summary$/), { params: { classGroupId: "g1", search: "", page: 2, pageSize: 15 }, signal: expect.any(AbortSignal) });
  fireEvent.change(screen.getByLabelText("T\u00ecm ki\u1ebfm"), { target: { value: "HV040" } });
  await screen.findByText("HV040");
  expect(axios.get).toHaveBeenLastCalledWith(expect.stringMatching(/class-score-summary$/), { params: { classGroupId: "g1", search: "HV040", page: 1, pageSize: 15 }, signal: expect.any(AbortSignal) });
  expect(axios.get.mock.calls.some(([url]) => url.endsWith("/export"))).toBe(false);
});

it("exports all students using a separate full-class request", async () => {
  const full = { ...reportFor("g1"), rows: [student, { ...student, participantId: "student:two", code: "HV002" }], total: 2 };
  const cards = full.rows.map(row => ({ student: row, group: full.group, subjects: [] }));
  fetchClassTranscripts.mockResolvedValue({ classGroup: full.group, scorecards: cards });
  axios.get.mockImplementation(async (url, config) => ({ data: url.endsWith("/options") ? { groups } : url.endsWith("/export") ? full : reportFor(config.params.classGroupId) }));
  mount();
  await screen.findByText("HV001");
  fireEvent.click(screen.getByRole("button", { name: "Xuất báo cáo" }));
  expect(screen.getAllByRole("menuitem")).toHaveLength(2);
  fireEvent.click(screen.getByRole("menuitem", { name: "Xuất bảng điểm cả lớp" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Xem trước PDF" })).not.toBeInTheDocument();
  await waitFor(() => expect(createClassScoreWorkbook).toHaveBeenCalledExactlyOnceWith(full));
  await waitFor(() => expect(downloadDocumentFile).toHaveBeenCalledWith(expect.any(Blob), "Tong-hop-diem-CNTT2026.1.1.xlsx"));
  expect(generateTranscriptDocuments).not.toHaveBeenCalled();
  expect(fetchClassTranscripts).not.toHaveBeenCalled();
});

it("reports a failed Excel export without downloading an incomplete workbook", async () => {
  mount(); await screen.findByText("HV001");
  axios.get.mockRejectedValueOnce(new Error("Không tải được bảng điểm cả lớp"));
  fireEvent.click(screen.getByRole("button", { name: "Xuất báo cáo" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Xuất bảng điểm cả lớp" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Không tải được bảng điểm cả lớp");
  await waitFor(() => expect(screen.getByRole("button", { name: "Xuất báo cáo" })).toBeEnabled());
  expect(createClassScoreWorkbook).not.toHaveBeenCalled();
  expect(openLearnerTranscriptPdfPreview).not.toHaveBeenCalled();
  expect(generateTranscriptDocuments).not.toHaveBeenCalled();
  expect(downloadDocumentFile).not.toHaveBeenCalled();
});

it("discards a late response from the previously selected class", async () => {
  let resolveOld;
  axios.get.mockImplementation((url, config) => url.endsWith("/options") ? Promise.resolve({ data: { groups } }) : config.params.classGroupId === "g1" ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve({ data: reportFor("g2") }));
  mount();
  await waitFor(() => expect(resolveOld).toBeDefined());
  chooseFilter("Ngành", "Kinh tế");
  await screen.findByText("HV002");
  await act(async () => { resolveOld({ data: reportFor("g1") }); });
  await waitFor(() => expect(screen.queryByText("HV001")).not.toBeInTheDocument());
});

it("shows missing curriculum and empty class states with export disabled", async () => {
  axios.get.mockImplementation(async url => ({ data: url.endsWith("/options") ? { groups } : { ...reportFor("g1"), curriculum: null, subjects: [], rows: [], total: 0 } }));
  mount();
  expect(await screen.findByText(/Lớp chưa được gán chương trình đào tạo/)).toBeInTheDocument();
  expect(screen.getByText("Lớp chưa có học viên.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Xuất báo cáo" }));
  expect(screen.getByRole("menuitem", { name: "Xuất bảng điểm cả lớp" })).toHaveAttribute("aria-disabled", "true");
});

it("retries a failed report without changing the selected class", async () => {
  mount();
  await screen.findByText("HV001");
  axios.get.mockRejectedValueOnce(new Error("Không tải được bảng điểm"));
  chooseFilter("Ngành", "Kinh tế");
  fireEvent.click(await screen.findByRole("button", { name: "Thử lại" }));
  await screen.findByText("HV002");
  expect(screen.getByLabelText("Chọn lớp")).toHaveTextContent("QTKD2026.1.1");
});
