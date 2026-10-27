import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import AdminAdmissionRecordDetail from "../../pages/plan/admissionRecordDetail";
import { toast } from "react-toastify";
import { MemoryRouter } from "react-router-dom";

// Decorative icons are not the contract under test; avoid importing the full icon catalog.
jest.mock("@mui/icons-material", () => ({
  AddPhotoAlternateRounded: () => null, ArrowBackRounded: () => null, CheckCircleRounded: () => null,
  DeleteRounded: () => null, FolderSpecialRounded: () => null, PersonRounded: () => null,
  PictureAsPdfRounded: () => null, RefreshRounded: () => null, SaveRounded: () => null,
  SchoolRounded: () => null, WarningAmberRounded: () => null, WorkspacePremiumRounded: () => null,
  SwapHorizRounded: () => null, HistoryRounded: () => null, AddRounded: () => null,
  DeleteOutlineRounded: () => null, EditRounded: () => null, FactCheckRounded: () => null,
  MenuBookRounded: () => null, RuleRounded: () => null,
}));
jest.setTimeout(15000);

vi.mock("axios", () => ({ default: {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  defaults: {},
} }));
vi.mock("react-router-dom", async () => ({
  ...await vi.importActual("react-router-dom"),
  useParams: () => ({ id: "record-1" }),
  useNavigate: () => jest.fn(),
}));
jest.mock("../../components/FeatureLayout", () => function FeatureLayoutMock({ children }) { return children; });
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
  ToastContainer: () => null,
}));

const major = { id: "major-1", code: "CNTT", name: "Công nghệ thông tin", program: "masters" };
const subject = { id: "subject-1", codeText: "CNT101", codeNumber: 101, name: "Triết học", credits: 3, majorId: "major-1", program: "masters" };

const record = {
  id: "record-1",
  fullName: "Nguyễn Văn A",
  majorId: "major-1",
  majorName: "Công nghệ thông tin",
  trainingLevel: "Thạc sĩ",
  academicYear: "2026",
  status: "pending",
  documents: {},
};

const configureReads = ({ learningResults = [], recognitions = [], studiedSubjects = [], subjectCatalog = [subject], bridgeCatalog = [] } = {}) => {
  axios.get.mockImplementation((url) => {
    if (url.includes("/plan/admission-records/record-1/learning-results")) return Promise.resolve({ data: learningResults });
    if (url.includes("/plan/admission-records/record-1/studied-subjects")) return Promise.resolve({ data: studiedSubjects });
    if (url.includes("/plan/admission-records/record-1/subject-recognitions")) return Promise.resolve({ data: recognitions });
    if (url.includes("/plan/admission-records/record-1/recognized-credits")) return Promise.resolve({ data: { credits: 3 } });
    if (url.includes("/plan/admission-records/record-1/major-transfers")) return Promise.resolve({ data: [] });
    if (url.includes("/plan/admission-records/record-1")) return Promise.resolve({ data: record });
    if (url.includes("/system/majors")) return Promise.resolve({ data: [major] });
    if (url.includes("/system/bridge-knowledge")) return Promise.resolve({ data: bridgeCatalog });
    if (url.includes("/plan/subjects?")) return Promise.resolve({ data: subjectCatalog });
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
};

const clickAndWait = async (element) => {
  await act(async () => { fireEvent.click(element); await new Promise((resolve) => setTimeout(resolve, 0)); });
};

const renderPage = () => render(<MemoryRouter useTransitions={false}><AdminAdmissionRecordDetail returnPath="/masters/admitted-records" /></MemoryRouter>);
const renderLearningPage = async () => {
  renderPage();
  await clickAndWait(await screen.findByRole("tab", { name: "Học tập" }));
};

describe("AdmissionRecordDetail shared subject recognition", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configureReads();
  });

  it("immediately displays unsubmitted prior learning and directs incomplete approval to the editable result", async () => {
    const result = { id: "lr-raw", subjectId: subject.id, subject, sourceType: "pre_masters", status: "registered", result: "pending" };
    configureReads({ learningResults: [result] });
    await renderLearningPage();
    const table = screen.getByRole("table", { name: "Phê duyệt công nhận học phần" });
    expect(within(table).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Học phần", "Nguồn học", "Trạng thái", "Kết quả", "Thao tác"]);
    expect(within(table).getByText("CHỜ DUYỆT")).toBeInTheDocument();
    expect(within(table).getByText("Tiền thạc sĩ")).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "Duyệt" })).toBeDisabled();
    expect(within(table).getByText(/Cần hoàn thành và có kết quả Đạt hoặc Miễn học/)).toBeInTheDocument();
    await clickAndWait(within(table).getByRole("button", { name: "Cập nhật kết quả" }));
    const dialog = screen.getByRole("dialog");
    const status = within(dialog).getByLabelText("Trạng thái");
    expect(status).toHaveValue("Đã hoàn thành");
    const outcome = within(dialog).getByLabelText("Kết quả");
    expect(outcome).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.mouseDown(outcome);
    await clickAndWait(await screen.findByRole("option", { name: "Đạt" }));
    expect(outcome).toHaveTextContent("Đạt");
    expect(axios.put).not.toHaveBeenCalled();
  });

  it("completes the saved score-9 registration with an explicit outcome and date, then enables approval", async () => {
    const learning = { id: "lr-score", subjectId: subject.id, subject, sourceType: "pre_masters", status: "registered", result: "pending", score: 9, completedAt: null, decisionNo: "VB678" };
    const recognitions = [];
    configureReads({ learningResults: [learning], recognitions });
    axios.put.mockImplementation(async (url, payload) => {
      if (url.includes("/learning-results/")) {
        Object.assign(learning, payload);
        recognitions.push({ id: "rec-score", learningResultId: learning.id, learningResult: learning,
          sourceType: learning.sourceType, targetSubject: subject, sourceSubject: subject, status: "pending" });
        return { data: learning };
      }
      recognitions[0].status = payload.decision;
      return { data: recognitions[0] };
    });
    await renderLearningPage();
    const table = screen.getByRole("table", { name: "Phê duyệt công nhận học phần" });
    expect(within(table).getByRole("button", { name: "Duyệt" })).toBeDisabled();
    await clickAndWait(within(table).getByRole("button", { name: "Cập nhật kết quả" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Trạng thái")).toHaveValue("Đã hoàn thành");
    expect(within(dialog).getByLabelText("Điểm (0–10)")).toHaveValue(9);
    expect(within(dialog).getByLabelText("Số quyết định / văn bằng")).toHaveValue("VB678");
    await clickAndWait(within(dialog).getByRole("button", { name: "Lưu kết quả" }));
    expect(axios.put).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Kết quả đã hoàn thành phải có ngày hoàn thành.");
    fireEvent.change(within(dialog).getByLabelText("Ngày hoàn thành"), { target: { value: "2026-10-14" } });
    await clickAndWait(within(dialog).getByRole("button", { name: "Lưu kết quả" }));
    expect(axios.put).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Vui lòng chọn Đạt, Không đạt hoặc Miễn học cho học phần đã hoàn thành.");
    fireEvent.mouseDown(within(dialog).getByLabelText("Kết quả"));
    await clickAndWait(await screen.findByRole("option", { name: "Đạt" }));
    await clickAndWait(within(dialog).getByRole("button", { name: "Lưu kết quả" }));
    expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/learning-results/lr-score"), expect.objectContaining({
      status: "completed", result: "passed", score: 9, completedAt: "2026-10-14", decisionNo: "VB678",
    }), expect.anything());
    const row = screen.getByTestId("recognition-rec-score");
    await waitFor(() => expect(within(row).getByRole("button", { name: "Duyệt" })).toBeEnabled());
    await clickAndWait(within(row).getByRole("button", { name: "Duyệt" }));
    expect(within(screen.getByTestId("recognition-rec-score")).getByText("ĐÃ DUYỆT")).toBeInTheDocument();
  });

  it("shows approval and rejection statuses in the same table and saves a rejection from its row", async () => {
    const recognitions = ["approved", "rejected", "pending"].map((status, index) => ({ id: `rec-${index}`, status, sourceType: "pre_masters", sourceSubject: subject, targetSubject: subject,
      learningResult: { sourceType: "pre_masters", status: "completed", result: "passed" } }));
    configureReads({ recognitions });
    axios.put.mockResolvedValue({ data: {} });
    await renderLearningPage();
    expect(within(screen.getByTestId("recognition-rec-0")).getByText("ĐÃ DUYỆT")).toBeInTheDocument();
    expect(within(screen.getByTestId("recognition-rec-1")).getByText("TỪ CHỐI")).toBeInTheDocument();
    await clickAndWait(within(screen.getByTestId("recognition-rec-2")).getByRole("button", { name: "Từ chối" }));
    expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/subject-recognitions/rec-2/decision"), expect.objectContaining({ decision: "rejected" }), expect.anything());
    expect(within(screen.getByTestId("recognition-rec-2")).getByText("TỪ CHỐI")).toBeInTheDocument();
  });

  it("shows the recognized-credit total and the unified recognition panel", async () => {
    await renderLearningPage();

    await waitFor(() => expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("/plan/admission-records/record-1/subject-recognitions"),
      expect.anything(),
    ));
    expect(await screen.findByText(/Đã tích lũy: 3 tín chỉ/)).toBeTruthy();
    expect(screen.getByText(/Học phần đã học trong chương trình đào tạo/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Đối chiếu CTĐT & đề xuất công nhận/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thêm kết quả học phần/ })).toBeTruthy();
  });

  it("renders a pending recognition and lets the council decide it", async () => {
    configureReads({
      recognitions: [{
        id: "rec-1",
        basis: "same_name",
        status: "pending",
        sourceType: "pre_masters",
        majorTransferId: null,
        sourceSubject: { id: "subject-old", codeText: "OLD101", name: "Phương pháp nghiên cứu" },
        targetSubject: { id: "subject-1", codeText: "CNT101", name: "Phương pháp nghiên cứu" },
        learningResult: { id: "lr-1", status: "completed", result: "passed", sourceType: "pre_masters" },
      }],
    });
    axios.put.mockResolvedValue({ data: { id: "rec-1", status: "approved" } });

    await renderLearningPage();

    expect(await screen.findByText("CHỜ DUYỆT")).toBeTruthy();
    expect(screen.queryByText(/Chỉ trùng tên — chờ hội đồng/)).not.toBeInTheDocument();

    await clickAndWait(screen.getByRole("button", { name: "Duyệt" }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
      expect.stringContaining("/plan/subject-recognitions/rec-1/decision"),
      expect.objectContaining({ decision: "approved" }),
      expect.anything(),
    ));
    expect(toast.success).toHaveBeenCalledWith("Đã duyệt công nhận học phần.");
    expect(within(screen.getByTestId("recognition-rec-1")).getByText("ĐÃ DUYỆT")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("creates and approves an eligible raw result with one click and keeps the confirmed status after a stale refresh", async () => {
    const learning = { id: "lr-raw", subjectId: subject.id, subject, sourceType: "pre_masters", status: "completed", result: "passed" };
    configureReads({ learningResults: [learning] });
    axios.post.mockResolvedValue({ data: { recognitions: [{ id: "rec-created", learningResultId: learning.id,
      sourceType: learning.sourceType, learningResult: learning, sourceSubject: subject, targetSubject: subject, status: "pending" }] } });
    axios.put.mockResolvedValue({ data: { id: "rec-created", status: "approved" } });
    await renderLearningPage();
    await clickAndWait(within(screen.getByRole("table", { name: "Phê duyệt công nhận học phần" })).getByRole("button", { name: "Duyệt" }));
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/subject-recognitions/propose"), { requireReview: true }, expect.anything());
    expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/subject-recognitions/rec-created/decision"), expect.objectContaining({ decision: "approved" }), expect.anything());
    expect(within(screen.getByTestId("recognition-rec-created")).getByText("ĐÃ DUYỆT")).toBeInTheDocument();
    expect(screen.queryByTestId("recognition-learning-lr-raw")).not.toBeInTheDocument();
  });

  it("keeps a pending decision when the server rejects approval", async () => {
    const learning = { id: "lr-1", status: "completed", result: "passed", sourceType: "pre_masters" };
    configureReads({ recognitions: [{ id: "rec-failed", status: "pending", sourceType: "pre_masters", learningResult: learning, targetSubject: subject }] });
    axios.put.mockRejectedValueOnce({ response: { data: { message: "Kết quả đã thay đổi, chưa thể duyệt." } } });
    await renderLearningPage();
    await clickAndWait(within(screen.getByTestId("recognition-rec-failed")).getByRole("button", { name: "Duyệt" }));
    expect(within(screen.getByTestId("recognition-rec-failed")).getByText("CHỜ DUYỆT")).toBeInTheDocument();
    expect(screen.queryByText("ĐÃ DUYỆT")).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Kết quả đã thay đổi, chưa thể duyệt.");
  });

  it("carries over a registered subject without counting credits", async () => {
    configureReads({
      learningResults: [{
        id: "lr-1",
        sourceType: "early_enrollment",
        status: "studying",
        result: "pending",
        academicYear: "2025",
        subjectId: "subject-1",
        subject: { id: "subject-1", codeText: "CNT101", name: "Triết học" },
      }],
    });

    await renderLearningPage();

    expect(await screen.findByText(/Học viên chưa có học phần đã học có kết quả/)).toBeTruthy();
    expect(screen.queryByTestId("studied-subjects")).toBeNull();
  });

  it.each(["approved", "rejected"])("disables all visible actions for a finalized %s decision", async status => {
    const learning = { id: "lr-final", sourceType: "pre_masters", subject, status: "completed", result: "passed" };
    configureReads({ learningResults: [learning], recognitions: [{ id: "rec-final", status, sourceType: "pre_masters", targetSubject: subject, learningResultId: learning.id, learningResult: learning }] });
    await renderLearningPage();
    const row = within(screen.getByTestId("recognition-rec-final"));
    for (const name of ["Duyệt", "Từ chối", "Cập nhật kết quả"]) {
      const button = row.getByRole("button", { name });
      expect(button).toBeVisible();
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Sửa quyết định")).not.toBeInTheDocument();
    expect(axios.put).not.toHaveBeenCalled();
  });
  it("shows only four studied columns and locked actions for an approved recognition", async () => {
    const learning = { id: "lr-approved", sourceType: "pre_masters", subjectId: subject.id, subject, status: "completed", result: "passed" };
    configureReads({
      learningResults: [learning], studiedSubjects: [learning],
      recognitions: [{
        id: "rec-1",
        learningResultId: learning.id, learningResult: learning,
        basis: "canonical_subject",
        status: "approved",
        sourceType: "pre_masters",
        majorTransferId: null,
        sourceSubject: { id: "subject-old", codeText: "OLD101", name: "Triết học" },
        targetSubject: { id: "subject-1", codeText: "CNT101", name: "Triết học" },
      }],
    });
    await renderLearningPage();
    const studied = screen.getByRole("table", { name: "Học phần đã học trong chương trình đào tạo" });
    expect(within(studied).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Học phần", "Nguồn học", "Trạng thái", "Kết quả"]);
    expect(within(studied).queryByRole("button")).not.toBeInTheDocument();
    const decision = screen.getByTestId("recognition-rec-1");
    expect(within(decision).getAllByRole("button")).toHaveLength(3);
    within(decision).getAllByRole("button").forEach(button => expect(button).toBeDisabled());
    expect(within(decision).queryByText("Sửa quyết định")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cancel-recognition-rec-1")).not.toBeInTheDocument();
    expect(axios.delete).not.toHaveBeenCalled();
  });

  it.each(["pending", "approved", "rejected"])("shows prior learning in the upper table only when its decision is approved (%s)", async status => {
    const prior = { id: "lr-prior", sourceType: "pre_masters", subjectId: subject.id, subject, status: "completed", result: "passed" };
    const otherSubject = { ...subject, id: "subject-remaining", codeText: "HPTH", name: "Học phần còn lại" };
    configureReads({ learningResults: [prior], studiedSubjects: [prior,
      { id: "regular-grade", sourceType: "regular", subject: otherSubject, status: "completed", result: "failed" }],
      recognitions: [{ id: "rec-prior", sourceType: "pre_masters", status, learningResultId: prior.id,
        learningResult: prior, sourceSubject: subject, targetSubject: subject }] });
    await renderLearningPage();
    const upper = screen.getByRole("table", { name: "Học phần đã học trong chương trình đào tạo" });
    if (status === "approved") expect(within(upper).getByText("CNT101 — Triết học")).toBeInTheDocument();
    else expect(within(upper).queryByText("CNT101 — Triết học")).not.toBeInTheDocument();
    expect(within(upper).getByText("HPTH — Học phần còn lại")).toBeInTheDocument();
    expect(screen.getByText(`Học phần đã học trong chương trình đào tạo (${status === "approved" ? 2 : 1})`)).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Phê duyệt công nhận học phần" })).getByText("CNT101 — Triết học")).toBeInTheDocument();
  });

  it.each(["passed", "exempt"])("includes an approved %s recognition even when the studied endpoint only returns exams", async result => {
    const target = { ...subject, id: "target-subject", codeText: "TARGET101" };
    const learning = { id: "lr-approved", sourceType: "pre_masters", subject, status: "completed", result };
    configureReads({ learningResults: [learning], recognitions: [{ id: "rec-approved", status: "approved",
      learningResultId: learning.id, sourceType: "pre_masters", targetSubject: target }] });
    await renderLearningPage();
    const upper = screen.getByRole("table", { name: "Học phần đã học trong chương trình đào tạo" });
    expect(within(upper).getByText("TARGET101 — Triết học")).toBeInTheDocument();
    expect(within(upper).getByText("Tiền thạc sĩ")).toBeInTheDocument();
    expect(within(upper).getByText(result === "passed" ? "Đạt" : "Miễn thi")).toBeInTheDocument();
    expect(screen.getByTestId("recognition-rec-approved")).toBeInTheDocument();
  });

  it.each(["pending", "approved", "rejected"].flatMap(status => ["passed", "failed", "exempt"].map(result => [status, result])))
  ("keeps an independent regular %s decision / %s exam result visible", async (status, result) => {
    const english = { ...subject, id: "english", codeText: "HPTA", name: "Tiếng Anh" };
    const prior = { id: "lr-prior", sourceType: "pre_masters", subjectId: english.id, subject: english, status: "completed", result: "pending" };
    configureReads({ learningResults: [prior], studiedSubjects: [
      { id: "regular-english", sourceType: "regular", subject: english, status: "completed", result },
    ], recognitions: [{ id: "rec-prior", sourceType: "pre_masters", status,
      learningResultId: prior.id, learningResult: prior, sourceSubject: english, targetSubject: english }] });
    await renderLearningPage();
    const upper = screen.getByRole("table", { name: "Học phần đã học trong chương trình đào tạo" });
    expect(within(upper).getByText("HPTA — Tiếng Anh")).toBeInTheDocument();
    expect(within(upper).getByText("Chính khóa")).toBeInTheDocument();
    expect(within(upper).getByText({ passed: "Đạt", failed: "Không đạt", exempt: "Miễn thi" }[result])).toBeInTheDocument();
    const decision = screen.getByTestId("recognition-rec-prior");
    expect(within(decision).getByText("HPTA — Tiếng Anh")).toBeInTheDocument();
    expect(within(decision).getByText("Chưa có kết quả")).toBeInTheDocument();
  });

  it("keeps the regular exam result without duplicating an approved recognition of the same subject", async () => {
    const learning = { id: "lr-approved", sourceType: "pre_masters", subject, status: "completed", result: "passed" };
    configureReads({ learningResults: [learning], studiedSubjects: [
      { id: "exam-failed", sourceType: "regular", subject, status: "completed", result: "failed" },
    ], recognitions: [{ id: "rec-approved", status: "approved", sourceType: "pre_masters",
      learningResultId: learning.id, learningResult: learning, targetSubject: subject }] });
    await renderLearningPage();
    const upper = screen.getByRole("table", { name: "Học phần đã học trong chương trình đào tạo" });
    expect(within(upper).getAllByText("CNT101 — Triết học")).toHaveLength(1);
    expect(within(upper).getByText("Chính khóa")).toBeInTheDocument();
    expect(within(upper).getByText("Không đạt")).toBeInTheDocument();
    expect(within(screen.getByTestId("recognition-rec-approved")).getByText("Đạt")).toBeInTheDocument();
  });

  it("shows studied curriculum subjects without scores and limits recognition cards to prior learning and bridge subjects", async () => {
    const recognition = (id, sourceType, learningResult = {}) => ({ id, sourceType, status: "approved", basis: "canonical_subject", sourceSubject: subject, targetSubject: subject, learningResult });
    configureReads({
      studiedSubjects: [
        { id: "grade-1", subject: { ...subject, id: "regular-subject" }, sourceType: "regular", status: "completed", result: "passed", score: 9.25 },
        { id: "grade-2", subject: { ...subject, id: "subject-2", name: "Học phần không đạt" }, sourceType: "regular", status: "completed", result: "failed", score: 3.25 },
      ],
      recognitions: [recognition("regular", "regular"), recognition("external", "external"),
        recognition("early", "early_enrollment", { result: "passed", score: 9.25 }),
        recognition("pre", "pre_masters", { result: "failed", score: 3.25 }),
        recognition("bridge", "regular", { bridgeKnowledgeSubjectId: "bridge-1", result: "passed" })],
    });
    await renderLearningPage();
    const studied = await screen.findByTestId("studied-subjects");
    expect(within(studied).getByText("Đạt")).toBeInTheDocument();
    expect(within(studied).getByText("Không đạt")).toBeInTheDocument();
    expect(within(studied).queryByText("Điểm")).not.toBeInTheDocument();
    expect(within(studied).queryByText("9.25")).not.toBeInTheDocument();
    expect(within(studied).queryByText("3.25")).not.toBeInTheDocument();
    expect(screen.getByText("Quyết định công nhận học phần (4)")).toBeInTheDocument();
    expect(screen.queryByTestId("recognition-regular")).not.toBeInTheDocument();
    expect(screen.getByTestId("recognition-external")).toBeInTheDocument();
    expect(within(screen.getByTestId("recognition-early")).getByText("Đạt")).toBeInTheDocument();
    expect(within(screen.getByTestId("recognition-pre")).getByText("Không đạt")).toBeInTheDocument();
    expect(screen.getByTestId("recognition-bridge")).toBeInTheDocument();
  });

  it("labels a passed profile exemption as Miễn thi while retaining the pending recognition result", async () => {
    configureReads({
      studiedSubjects: [{ id: "grade-1", subject: { ...subject, id: "regular-exempt" }, sourceType: "regular", status: "completed", result: "passed", profileForeignLanguageExempt: true }],
      recognitions: [{ id: "rec-1", sourceType: "pre_masters", status: "approved", sourceSubject: subject,
        targetSubject: subject, learningResult: { result: "pending" } }],
    });
    await renderLearningPage();
    const studied = await screen.findByTestId("studied-subjects");
    expect(within(studied).getByText("Miễn thi")).toBeInTheDocument();
    expect(within(studied).queryByText("Đạt")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("recognition-rec-1")).getByText("Chưa có kết quả")).toBeInTheDocument();
  });

  it('shows an interrupted study-leave failure in learning information', async () => {
    configureReads({ learningResults: [], studiedSubjects: [{ id: 'leave-failure', sourceType: 'regular', subject,
      status: 'completed', result: 'failed', studyLeaveFailure: true }], recognitions: [] });
    await renderLearningPage();
    const table = screen.getByRole('table', { name: 'Học phần đã học trong chương trình đào tạo' });
    expect(within(table).getByText('Không đạt')).toBeInTheDocument();
  });

  it("separates study results from the profile and orders the new study tab before the scorecard", async () => {
    renderPage();
    const learningTab = await screen.findByRole("tab", { name: "Học tập" });
    expect(screen.getAllByRole("tab").map(tab => tab.textContent)).toEqual([
      "Thông tin hồ sơ", "Xét tuyển", "Học tập", "Bảng điểm", "Bảo lưu",
    ]);
    expect(screen.getByRole("tab", { name: "Thông tin hồ sơ" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tabpanel", { name: "Học tập" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thêm kết quả học phần" })).not.toBeInTheDocument();
    await clickAndWait(learningTab);
    expect(screen.getByRole("tabpanel", { name: "Học tập" })).toBeVisible();
    expect(screen.getByText(/I\. Thông tin cá nhân/)).not.toBeVisible();
    await clickAndWait(screen.getByRole("tab", { name: "Thông tin hồ sơ" }));
    expect(screen.getByText(/I\. Thông tin cá nhân/)).toBeVisible();
    expect(screen.queryByRole("tabpanel", { name: "Học tập" })).not.toBeInTheDocument();
  });

  it("hides completed exam subjects, including failures and exemptions, but keeps pending and distinct subjects", async () => {
    const failed = { ...subject, id: "failed", codeText: "F01", name: "Học phần không đạt" };
    const exempt = { ...subject, id: "exempt", codeText: "E01", name: "Học phần miễn thi" };
    const pending = { ...subject, id: "pending", codeText: "P01", name: "Học phần chờ kết quả" };
    const distinct = { ...subject, id: "distinct", codeText: "D01" };
    const alias = { ...subject, id: "alias", codeText: "A01", canonicalSubjectId: subject.id };
    configureReads({
      subjectCatalog: [subject, failed, exempt, pending, distinct, alias],
      studiedSubjects: [
        { id: "exam-1", subject, result: "passed" },
        { id: "exam-2", subject: failed, result: "failed" },
        { id: "exam-3", subject: exempt, result: "exempt" },
      ],
      learningResults: [{ id: "lr-pending", subjectId: pending.id, result: "pending", status: "studying" }],
    });
    await renderLearningPage();
    await clickAndWait(screen.getByRole("button", { name: "Thêm kết quả học phần" }));
    fireEvent.mouseDown(within(screen.getByRole("dialog")).getByLabelText("Học phần"));
    const options = within(await screen.findByRole("listbox"));
    expect(options.queryByRole("option", { name: "CNT101 — Triết học" })).not.toBeInTheDocument();
    expect(options.queryByRole("option", { name: "F01 — Học phần không đạt" })).not.toBeInTheDocument();
    expect(options.queryByRole("option", { name: "E01 — Học phần miễn thi" })).not.toBeInTheDocument();
    expect(options.queryByRole("option", { name: "A01 — Triết học" })).not.toBeInTheDocument();
    expect(options.getByRole("option", { name: "P01 — Học phần chờ kết quả" })).toBeInTheDocument();
    expect(options.getByRole("option", { name: "D01 — Triết học" })).toBeInTheDocument();
  });

  it("hides existing personal results from new entries while preserving the subject when editing", async () => {
    const result = { id: "lr-1", subjectId: subject.id, subject, sourceType: "pre_masters", result: "passed", status: "completed" };
    configureReads({ learningResults: [result], studiedSubjects: [result] });
    await renderLearningPage();
    await clickAndWait(screen.getByRole("button", { name: "Thêm kết quả học phần" }));
    fireEvent.mouseDown(within(screen.getByRole("dialog")).getByLabelText("Học phần"));
    const options = within(await screen.findByRole("listbox"));
    expect(options.queryByRole("option", { name: "CNT101 — Triết học" })).not.toBeInTheDocument();
    expect(options.getByRole("option", { name: "Không còn học phần chưa có kết quả." })).toHaveAttribute("aria-disabled", "true");
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    await clickAndWait(within(screen.getByRole("dialog")).getByRole("button", { name: "Hủy" }));
    await clickAndWait(await screen.findByRole("button", { name: "Cập nhật kết quả" }, { timeout: 5000 }));
    expect(within(screen.getByRole("dialog")).getByLabelText("Học phần")).toHaveTextContent("CNT101 — Triết học");
  });

  it("filters bridge subjects with a saved outcome without hiding bridge subjects awaiting a result", async () => {
    const completed = { id: "b1", code: "BS01", name: "Đã có kết quả" };
    const pending = { id: "b2", code: "BS02", name: "Chờ kết quả" };
    configureReads({ bridgeCatalog: [completed, pending], learningResults: [
      { id: "lr-b1", bridgeKnowledgeSubjectId: completed.id, result: "failed" },
      { id: "lr-b2", bridgeKnowledgeSubjectId: pending.id, result: "pending" },
    ] });
    await renderLearningPage();
    await clickAndWait(screen.getByRole("button", { name: "Thêm kết quả học phần" }));
    fireEvent.mouseDown(within(screen.getByRole("dialog")).getByLabelText("Loại học phần"));
    await clickAndWait(await screen.findByRole("option", { name: "Học phần bổ sung kiến thức" }));
    fireEvent.mouseDown(within(screen.getByRole("dialog")).getByLabelText("Học phần"));
    const options = within(await screen.findByRole("listbox"));
    expect(options.queryByRole("option", { name: /BS01/ })).not.toBeInTheDocument();
    expect(options.getByRole("option", { name: /BS02/ })).toBeInTheDocument();
  });
});
