import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import ClassScoreSummary from "../../pages/reports/classScoreSummary";
import LearnerTranscriptDialog from "../../features/learners/LearnerTranscriptDialog";
import { normalizeLearnerTranscript } from "../../features/learners/learnerTranscript";
import { openLearnerTranscriptPdfPreview } from "../../features/learners/learnerTranscriptPdfPreview";
import { createLearnerTranscriptWord } from "../../features/learners/learnerTranscriptWord";
import { createLearnerTranscriptPdf } from "../../features/learners/learnerTranscriptPdf";
import { fetchClassTranscripts, generateTranscriptDocuments } from "../../features/learners/learnerTranscriptBatch";
import { packTranscriptZip } from "../../features/learners/learnerTranscriptZip";
import { downloadDocumentFile } from "../../utils/documentFiles";

jest.mock("axios");
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });
jest.mock("../../features/learners/learnerTranscriptPdfPreview", async (importOriginal) => ({ openLearnerTranscriptPdfPreview: jest.fn((await importOriginal()).openLearnerTranscriptPdfPreview) }));
jest.mock("../../features/learners/learnerTranscriptWord", () => ({ createLearnerTranscriptWord: jest.fn() }));
jest.mock("../../features/learners/learnerTranscriptPdf", () => ({ createLearnerTranscriptPdf: jest.fn() }));
jest.mock("../../features/learners/learnerTranscriptBatch", async (importOriginal) => ({ fetchClassTranscripts: jest.fn(), generateTranscriptDocuments: jest.fn(), selectTranscriptScorecards: (await importOriginal()).selectTranscriptScorecards }));
jest.mock("../../features/learners/learnerTranscriptZip", () => ({ packTranscriptZip: jest.fn() }));
jest.mock("../../utils/documentFiles", async (importOriginal) => ({ ...await importOriginal(), downloadDocumentFile: jest.fn() }));
jest.mock("@mui/icons-material", () => ({ SearchRounded: () => null }));
jest.setTimeout(20000);

const group = { id: "g1", code: "CLASS1", academicYear: "2026", major: { id: "m1", name: "Major", disciplineId: "d1", discipline: { id: "d1", name: "Discipline" } } };
const students = Array.from({ length: 40 }, (_, index) => ({
  participantId: `student:${index}`, studentId: String(index), admissionRecordId: index === 39 ? null : `ar${index}`,
  canPreview: index !== 39, code: `HV${String(index + 1).padStart(3, "0")}`,
  fullName: index % 2 === 0 ? `Nguyễn An ${index}` : `Trần Bình ${index}`, lastName: index % 2 === 0 ? "Nguyễn" : "Trần", firstName: index % 2 === 0 ? "An" : "Bình",
}));
const roster = { classGroup: group, students };
const scorecard = { student: { fullName: "Nguyễn An", code: "HV001" }, group, curriculum: { name: "CTĐT" }, subjects: [] };
let tab;
beforeEach(async () => {
  jest.clearAllMocks(); localStorage.clear();
  openLearnerTranscriptPdfPreview.mockImplementation((await vi.importActual("../../features/learners/learnerTranscriptPdfPreview")).openLearnerTranscriptPdfPreview);
  URL.createObjectURL = jest.fn(() => "blob:transcript");
  URL.revokeObjectURL = jest.fn();
  tab = { close: jest.fn(), opener: null, closed: false, location: { replace: jest.fn() } };
  jest.spyOn(window, "open").mockReturnValue(tab);
  jest.spyOn(window, "print").mockImplementation(() => {});
  createLearnerTranscriptWord.mockResolvedValue(new Blob(["docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
  createLearnerTranscriptPdf.mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
  fetchClassTranscripts.mockResolvedValue({ classGroup: group, scorecards: [scorecard] });
  generateTranscriptDocuments.mockResolvedValue([{ filename: "sample.docx", blob: new Blob(["docx"]) }]);
  packTranscriptZip.mockResolvedValue(new Blob(["zip"], { type: "application/zip" }));
  axios.get.mockImplementation(async (url) => ({ data: url.endsWith("/options") ? { groups: [group] }
    : url.endsWith("/roster") ? roster : url.includes("/learner-scorecard/") ? scorecard
    : { group, subjects: [{ id: "hp1", name: "Subject" }], curriculum: { name: "CTĐT" }, rows: [{ ...students[0], scores: {} }], total: 40, page: 1, pageSize: 15 } }));
});
afterEach(() => { window.dispatchEvent(new Event("pagehide")); jest.restoreAllMocks(); });
const mountDialog = () => render(<LearnerTranscriptDialog classGroupId="g1" onClose={jest.fn()} />);
const loadedDialog = async () => {
  await screen.findByRole("checkbox", { name: /HV040/ });
  return screen.getByRole("dialog");
};

it("offers exactly summary Excel and personal transcript actions, loading roster on demand", async () => {
  render(<MemoryRouter useTransitions={false}><ClassScoreSummary /></MemoryRouter>);
  await screen.findByText("HV001");
  expect(axios.get.mock.calls.some(([url]) => url.endsWith("/roster") || url.endsWith("/export"))).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Xuất file" }));
  expect(screen.getAllByRole("menuitem").map(item => item.textContent)).toEqual(["Xuất điểm cả lớp", "Xuất bảng điểm cá nhân"]);
  fireEvent.click(screen.getByRole("menuitem", { name: "Xuất bảng điểm cá nhân" }));
  const dialog = await loadedDialog();
  expect(within(dialog).getAllByRole("checkbox")).toHaveLength(41);
  expect(axios.get.mock.calls.filter(([url]) => url.endsWith("/roster"))).toHaveLength(1);
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/class-score-summary\/roster$/), { params: { classGroupId: "g1" } });
  expect(axios.get.mock.calls.some(([url]) => url.endsWith("/export") || url.includes("/learner-scorecard/"))).toBe(false);
});

it("searches client-side without losing participant selection and selects the whole roster while filtered", async () => {
  mountDialog();
  const dialog = await loadedDialog();
  const search = within(dialog).getByLabelText("Tìm theo mã HV, họ tên...");
  fireEvent.change(search, { target: { value: "nguyễn" } });
  fireEvent.click(within(dialog).getByRole("checkbox", { name: /HV001/ }));
  fireEvent.change(search, { target: { value: "TRẦN" } });
  fireEvent.click(within(dialog).getByRole("checkbox", { name: /HV002/ }));
  fireEvent.change(search, { target: { value: "" } });
  expect(within(dialog).getByRole("checkbox", { name: /HV001/ })).toBeChecked();
  expect(within(dialog).getByRole("checkbox", { name: /HV002/ })).toBeChecked();
  expect(within(dialog).getByRole("status")).toHaveTextContent("Đã chọn 2 / 40 học viên");
  expect(within(dialog).getByRole("checkbox", { name: "Chọn tất cả học viên" })).toHaveAttribute("data-indeterminate", "true");
  fireEvent.change(search, { target: { value: "HV001" } });
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "Chọn tất cả học viên" }));
  expect(within(dialog).getByRole("status")).toHaveTextContent("Đã chọn 40 / 40 học viên");
  fireEvent.change(search, { target: { value: "" } });
  expect(within(dialog).getAllByRole("checkbox").every(input => input.checked)).toBe(true);
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "Chọn tất cả học viên" }));
  expect(within(dialog).getByRole("status")).toHaveTextContent("Đã chọn 0 / 40 học viên");
  expect(axios.get).toHaveBeenCalledTimes(1);
});

it("selects all 40 roster identities when search shows only five and preserves an earlier three-person selection", async () => {
  const names = students.map((student, index) => ({ ...student, fullName: `${index < 5 ? "Nguyễn" : "Trần"} Học viên ${index}`, lastName: index < 5 ? "Nguyễn" : "Trần" }));
  axios.get.mockResolvedValueOnce({ data: { ...roster, students: names } });
  mountDialog();
  const dialog = await loadedDialog();
  const boxes = dialog.querySelectorAll('.transcript-roster-row input[type="checkbox"]');
  [0, 5, 6].forEach(index => fireEvent.click(boxes[index]));
  fireEvent.change(screen.getByLabelText("Tìm theo mã HV, họ tên..."), { target: { value: "Nguyễn" } });
  expect(dialog.querySelectorAll('.transcript-roster-row')).toHaveLength(5);
  expect(screen.getByRole("status")).toHaveTextContent("Đã chọn 3 / 40");
  fireEvent.click(screen.getByRole("checkbox", { name: "Chọn tất cả học viên" }));
  expect(screen.getByRole("status")).toHaveTextContent("Đã chọn 40 / 40");
  expect(screen.getByRole("button", { name: "Xuất 40 bảng điểm" })).toBeEnabled();
});

it("keeps format, selection, counter and disabled export together above the scrollable list", async () => {
  mountDialog();
  const dialog = await loadedDialog();
  const controls = within(dialog).getByRole("radio", { name: "PDF" }).closest(".transcript-controls");
  expect(controls).toContainElement(within(dialog).getByRole("checkbox", { name: "Chọn tất cả học viên" }));
  expect(controls).toContainElement(within(dialog).getByRole("status"));
  expect(controls).toContainElement(within(dialog).getByRole("button", { name: "Xuất bảng điểm" }));
  expect(within(dialog).getByRole("button", { name: "Xuất bảng điểm" })).toBeDisabled();
  expect(within(dialog).getByRole("radio", { name: "PDF" })).toBeEnabled();
  expect(within(dialog).getByRole("radio", { name: "Word" })).toBeChecked();
  expect(controls.compareDocumentPosition(within(dialog).getByLabelText("Danh sách học viên của lớp")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Xem trước HV001" }));
  await waitFor(() => expect(openLearnerTranscriptPdfPreview).toHaveBeenCalledWith(normalizeLearnerTranscript(scorecard), tab, expect.objectContaining({ isCancelled: expect.any(Function) })));
  expect(axios.get).toHaveBeenLastCalledWith(expect.stringMatching(/learner-scorecard\/ar0$/), { params: { classGroupId: "g1" } });
});

const mountSmallDialog = async () => {
  axios.get.mockResolvedValueOnce({ data: { ...roster, students: students.slice(0, 3) } });
  const view = mountDialog();
  await screen.findByRole("checkbox", { name: /HV003/ });
  return view;
};

it("enables both single and multiple selections without a separate whole-class mode", async () => {
  await mountSmallDialog();
  expect(document.querySelectorAll("#transcript-dialog-title")).toHaveLength(1);
  const exportButton = screen.getByRole("button", { name: "Xuất bảng điểm" });
  expect(exportButton).toBeDisabled();
  expect(screen.getByRole("radio", { name: "PDF" })).toBeEnabled();
  expect(screen.getByText(/1 học viên: tải file trực tiếp/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: /HV001/ }));
  expect(exportButton).toBeEnabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /HV002/ }));
  expect(exportButton).toBeEnabled();
  expect(exportButton).toHaveTextContent("Xuất 2 bảng điểm");
  expect(screen.getByRole("status")).toHaveTextContent("Đã chọn 2 / 3 học viên");
  expect(screen.getByRole("checkbox", { name: /HV001/ })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: /HV002/ })).toBeChecked();
  expect(createLearnerTranscriptWord).not.toHaveBeenCalled();
});

it("fetches a fresh single scorecard, normalizes it and downloads one Word file without invoking print", async () => {
  await mountSmallDialog();
  fireEvent.click(screen.getByRole("checkbox", { name: /HV001/ }));
  fireEvent.click(screen.getByRole("button", { name: "Xem trước HV001" }));
  await waitFor(() => expect(openLearnerTranscriptPdfPreview).toHaveBeenCalledWith(normalizeLearnerTranscript(scorecard), tab, expect.objectContaining({ isCancelled: expect.any(Function) })));
  await waitFor(() => expect(screen.getByRole("button", { name: "Xuất 1 bảng điểm" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Xuất 1 bảng điểm" }));
  await waitFor(() => expect(downloadDocumentFile).toHaveBeenCalledWith(expect.any(Blob), "Bang-diem-HV001-Nguyễn An.docx"));
  expect(createLearnerTranscriptWord).toHaveBeenCalledWith(normalizeLearnerTranscript(scorecard));
  const requests = axios.get.mock.calls.filter(([url]) => url.includes("/learner-scorecard/"));
  expect(requests).toHaveLength(2);
  expect(requests.every(([url, config]) => url.endsWith("/ar0") && config.params.classGroupId === "g1")).toBe(true);
  expect(window.print).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole("button", { name: "Xuất 1 bảng điểm" })).toBeEnabled());
});

it("downloads a single PDF from the format selector using the same dataset", async () => {
  await mountSmallDialog();
  fireEvent.click(screen.getByRole("radio", { name: "PDF" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /HV001/ }));
  fireEvent.click(screen.getByRole("button", { name: "Xuất 1 bảng điểm" }));
  await waitFor(() => expect(downloadDocumentFile).toHaveBeenCalledWith(expect.any(Blob), "Bang-diem-HV001-Nguyễn An.pdf"));
  expect(createLearnerTranscriptPdf).toHaveBeenCalledWith(normalizeLearnerTranscript(scorecard));
});

it.each(["word", "pdf"])("exports exactly 3 of 40 selected %s transcripts and keeps selection/search after failure", async format => {
  mountDialog();
  const dialog = await loadedDialog();
  const cards = students.map(student => ({ ...scorecard, student }));
  fetchClassTranscripts.mockResolvedValue({ classGroup: group, scorecards: cards });
  const checkboxes = dialog.querySelectorAll('.transcript-roster-row input[type="checkbox"]');
  [0, 1, 2].forEach(index => fireEvent.click(checkboxes[index]));
  if (format === "pdf") fireEvent.click(screen.getByRole("radio", { name: "PDF" }));
  const search = screen.getByLabelText("Tìm theo mã HV, họ tên...");
  fireEvent.change(search, { target: { value: "Nguyễn" } });
  expect(screen.getByRole("status")).toHaveTextContent("Đã chọn 3 / 40");
  fetchClassTranscripts.mockRejectedValueOnce(new Error("Export failed"));
  fireEvent.click(screen.getByRole("button", { name: "Xuất 3 bảng điểm" }));
  expect(await screen.findByText("Export failed")).toBeInTheDocument();
  expect(search).toHaveValue("Nguyễn");
  fireEvent.click(screen.getByRole("button", { name: "Xuất 3 bảng điểm" }));
  await waitFor(() => expect(downloadDocumentFile).toHaveBeenCalledWith(expect.any(Blob), `Bang-diem-CLASS1-${format === "pdf" ? "PDF" : "Word"}.zip`));
  expect(generateTranscriptDocuments).toHaveBeenCalledWith(cards.slice(0, 3), format, expect.objectContaining({ isCancelled: expect.any(Function) }));
  expect(fetchClassTranscripts.mock.calls).toEqual([["g1"], ["g1"]]);
  expect(axios.get.mock.calls.some(([url]) => url.includes("/learner-scorecard/"))).toBe(false);
  expect(screen.getByRole("status")).toHaveTextContent("Đã chọn 3 / 40");
});

it("cancels a pending selected batch without downloading a late ZIP", async () => {
  const view = await mountSmallDialog();
  [0, 1].forEach(index => fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(`HV00${index + 1}`) })));
  let finish;
  fetchClassTranscripts.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const button = screen.getByRole("button", { name: "Xuất 2 bảng điểm" });
  fireEvent.click(button); fireEvent.click(button);
  expect(fetchClassTranscripts).toHaveBeenCalledTimes(1);
  view.unmount();
  await act(async () => finish({ classGroup: group, scorecards: [] }));
  expect(generateTranscriptDocuments).not.toHaveBeenCalled();
  expect(downloadDocumentFile).not.toHaveBeenCalled();
});

it("prevents duplicate exports while the scorecard or Word generation is pending", async () => {
  await mountSmallDialog();
  let resolveScorecard, resolveWord;
  axios.get.mockImplementationOnce(() => new Promise(resolve => { resolveScorecard = resolve; }));
  createLearnerTranscriptWord.mockImplementationOnce(() => new Promise(resolve => { resolveWord = resolve; }));
  fireEvent.click(screen.getByRole("checkbox", { name: /HV001/ }));
  const button = screen.getByRole("button", { name: "Xuất 1 bảng điểm" });
  fireEvent.click(button); fireEvent.click(button);
  expect(screen.getByRole("button", { name: "Đang xuất..." })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: /HV001/ })).toBeDisabled();
  expect(axios.get.mock.calls.filter(([url]) => url.includes("/learner-scorecard/"))).toHaveLength(1);
  await act(async () => resolveScorecard({ data: scorecard }));
  expect(createLearnerTranscriptWord).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Đang xuất..." }));
  expect(downloadDocumentFile).not.toHaveBeenCalled();
  await act(async () => resolveWord(new Blob(["docx"])));
  expect(downloadDocumentFile).toHaveBeenCalledTimes(1);
});

it.each(["fetch", "generate"])("keeps selection and allows retry after a single-export %s failure", async (stage) => {
  await mountSmallDialog();
  if (stage === "fetch") axios.get.mockRejectedValueOnce(new Error("Word export failed"));
  else createLearnerTranscriptWord.mockRejectedValueOnce(new Error("Word export failed"));
  fireEvent.click(screen.getByRole("checkbox", { name: /HV001/ }));
  fireEvent.click(screen.getByRole("button", { name: "Xuất 1 bảng điểm" }));
  expect(await screen.findByText("Word export failed")).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: /HV001/ })).toBeChecked();
  expect(screen.getByRole("button", { name: "Xuất 1 bảng điểm" })).toBeEnabled();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(downloadDocumentFile).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Xuất 1 bảng điểm" }));
  await waitFor(() => expect(downloadDocumentFile).toHaveBeenCalledTimes(1));
});

it("does not download a pending Word file after the modal closes", async () => {
  const view = await mountSmallDialog();
  let resolveWord;
  createLearnerTranscriptWord.mockImplementationOnce(() => new Promise(resolve => { resolveWord = resolve; }));
  fireEvent.click(screen.getByRole("checkbox", { name: /HV001/ }));
  fireEvent.click(screen.getByRole("button", { name: "Xuất 1 bảng điểm" }));
  await waitFor(() => expect(resolveWord).toBeDefined());
  view.unmount();
  await act(async () => resolveWord(new Blob(["docx"])));
  expect(downloadDocumentFile).not.toHaveBeenCalled();
});

it("keeps a student without an admission record selectable but disables preview with an explanation", async () => {
  mountDialog();
  const dialog = await loadedDialog();
  expect(within(dialog).getByRole("button", { name: "Xem trước HV040" })).toBeDisabled();
  expect(within(dialog).getByText("Chưa có hồ sơ học viên phù hợp để tạo bảng điểm.")).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("checkbox", { name: /HV040/ }));
  expect(within(dialog).getByRole("status")).toHaveTextContent("Đã chọn 1 / 40 học viên");
  expect(axios.get).toHaveBeenCalledTimes(1);
});

it("shows roster errors and retries without showing a previous class roster", async () => {
  axios.get.mockRejectedValueOnce(new Error("Roster failed"));
  const view = mountDialog();
  fireEvent.click(await screen.findByRole("button", { name: "Thử lại" }));
  await loadedDialog();
  let resolveNext;
  axios.get.mockImplementationOnce(() => new Promise(resolve => { resolveNext = resolve; }));
  view.rerender(<LearnerTranscriptDialog classGroupId="g2" onClose={jest.fn()} />);
  expect(screen.queryByRole("checkbox", { name: /HV001/ })).not.toBeInTheDocument();
  await act(async () => resolveNext({ data: { classGroup: { id: "g2", code: "CLASS2" }, students: [] } }));
  expect(await screen.findByText("Lớp chưa có học viên.")).toBeInTheDocument();
});

it("ignores a late roster response after switching class", async () => {
  let resolveOld;
  axios.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  const view = mountDialog();
  view.rerender(<LearnerTranscriptDialog classGroupId="g2" onClose={jest.fn()} />);
  await loadedDialog();
  await act(async () => resolveOld({ data: { classGroup: { id: "g1" }, students: [] } }));
  expect(screen.getByRole("checkbox", { name: /HV040/ })).toBeInTheDocument();
});

it("reports preview failures and closes the reserved tab", async () => {
  mountDialog(); await loadedDialog();
  axios.get.mockRejectedValueOnce(new Error("Scorecard failed"));
  fireEvent.click(screen.getByRole("button", { name: "Xem trước HV001" }));
  expect(await screen.findByText("Scorecard failed")).toBeInTheDocument();
  expect(tab.close).toHaveBeenCalled();
  expect(openLearnerTranscriptPdfPreview).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Xem trước HV001" })).toBeEnabled();
});

it("does not fetch the scorecard if the browser blocks the preview tab", async () => {
  mountDialog(); await loadedDialog();
  window.open.mockReturnValueOnce(null);
  fireEvent.click(screen.getByRole("button", { name: "Xem trước HV001" }));
  expect(await screen.findByText(/Trình duyệt đã chặn tab xem trước/)).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledTimes(1);
});

it("ignores preview completion after the modal closes", async () => {
  const view = mountDialog(); await loadedDialog();
  let resolvePreview;
  axios.get.mockImplementationOnce(() => new Promise(resolve => { resolvePreview = resolve; }));
  fireEvent.click(screen.getByRole("button", { name: "Xem trước HV001" }));
  view.unmount();
  await act(async () => resolvePreview({ data: scorecard }));
  expect(openLearnerTranscriptPdfPreview).not.toHaveBeenCalled();
  expect(tab.close).toHaveBeenCalled();
});


it("opens the PDF preview window synchronously, guards duplicate generation and preserves selection/search", async () => {
  await mountSmallDialog();
  let finish;
  createLearnerTranscriptPdf.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole("checkbox", { name: /HV001/ }));
  const search = screen.getByLabelText("Tìm theo mã HV, họ tên...");
  fireEvent.change(search, { target: { value: "HV001" } });
  const button = screen.getByRole("button", { name: "Xem trước HV001" });
  fireEvent.click(button); fireEvent.click(button);
  expect(window.open).toHaveBeenCalledTimes(1);
  expect(window.open).toHaveBeenCalledWith("about:blank", "_blank");
  await waitFor(() => expect(createLearnerTranscriptPdf).toHaveBeenCalledTimes(1));
  expect(tab.location.replace).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Xuất 1 bảng điểm" })).toBeDisabled();
  const blob = new Blob(["pdf"], { type: "application/pdf" });
  await act(async () => finish(blob));
  expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
  expect(tab.location.replace).toHaveBeenCalledWith("blob:transcript");
  expect(window.print).not.toHaveBeenCalled();
  expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
  expect(search).toHaveValue("HV001");
  expect(screen.getByRole("checkbox", { name: /HV001/ })).toBeChecked();
  expect(screen.getByRole("status")).toHaveTextContent("Đã chọn 1 / 3");
});
it("closes the reserved preview window on PDF generation failure and keeps report state", async () => {
  await mountSmallDialog();
  createLearnerTranscriptPdf.mockRejectedValueOnce(new Error("PDF generation failed"));
  fireEvent.click(screen.getByRole("checkbox", { name: /HV001/ }));
  fireEvent.change(screen.getByLabelText("Tìm theo mã HV, họ tên..."), { target: { value: "HV001" } });
  fireEvent.click(screen.getByRole("button", { name: "Xem trước HV001" }));
  expect(await screen.findByText("PDF generation failed")).toBeInTheDocument();
  expect(tab.close).toHaveBeenCalled();
  expect(screen.getByLabelText("Tìm theo mã HV, họ tên...")).toHaveValue("HV001");
  expect(screen.getByRole("checkbox", { name: /HV001/ })).toBeChecked();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(window.print).not.toHaveBeenCalled();
});
