import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import AdminAdmissionRecordDetail from "../../pages/plan/admissionRecordDetail";
import { toast } from "react-toastify";

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

jest.mock("axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  defaults: {},
}));
jest.mock("react-router-dom", () => ({
  useParams: () => ({ id: "record-1" }),
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
}));
jest.mock("../../components/FeatureLayout", () => function FeatureLayoutMock({ children }) { return children; });
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
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

const configureReads = ({ learningResults = [], recognitions = [], studiedSubjects = [] } = {}) => {
  axios.get.mockImplementation((url) => {
    if (url.includes("/plan/admission-records/record-1/learning-results")) return Promise.resolve({ data: learningResults });
    if (url.includes("/plan/admission-records/record-1/studied-subjects")) return Promise.resolve({ data: studiedSubjects });
    if (url.includes("/plan/admission-records/record-1/subject-recognitions")) return Promise.resolve({ data: recognitions });
    if (url.includes("/plan/admission-records/record-1/recognized-credits")) return Promise.resolve({ data: { credits: 3 } });
    if (url.includes("/plan/admission-records/record-1/major-transfers")) return Promise.resolve({ data: [] });
    if (url.includes("/plan/admission-records/record-1")) return Promise.resolve({ data: record });
    if (url.includes("/system/majors")) return Promise.resolve({ data: [major] });
    if (url.includes("/system/bridge-knowledge")) return Promise.resolve({ data: [] });
    if (url.includes("/plan/subjects?")) return Promise.resolve({ data: [subject] });
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
};

const clickAndWait = async (element) => {
  await act(async () => { fireEvent.click(element); await new Promise((resolve) => setTimeout(resolve, 0)); });
};

describe("AdmissionRecordDetail shared subject recognition", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configureReads();
  });

  it("shows the recognized-credit total and the unified recognition panel", async () => {
    render(<AdminAdmissionRecordDetail />);

    await waitFor(() => expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("/plan/admission-records/record-1/subject-recognitions"),
      expect.anything(),
    ));
    expect(await screen.findByText(/Đã công nhận: 3 tín chỉ/)).toBeTruthy();
    expect(screen.getByText(/Học phần đã học trong chương trình đào tạo/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Đối chiếu CTĐT & đề xuất công nhận/ })).toBeTruthy();
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
      }],
    });
    axios.put.mockResolvedValue({ data: { id: "rec-1", status: "approved" } });

    render(<AdminAdmissionRecordDetail />);

    expect(await screen.findByText(/Chờ hội đồng/)).toBeTruthy();
    expect(screen.getByText(/Chỉ trùng tên — chờ hội đồng/)).toBeTruthy();

    await clickAndWait(screen.getByRole("button", { name: "Xử lý" }));
    const saveButton = await screen.findByRole("button", { name: "Lưu quyết định" });
    await clickAndWait(saveButton);

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
      expect.stringContaining("/plan/subject-recognitions/rec-1/decision"),
      expect.objectContaining({ decision: "approved" }),
      expect.anything(),
    ));
    expect(toast.success).toHaveBeenCalledWith("Đã duyệt công nhận học phần.");
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

    render(<AdminAdmissionRecordDetail />);

    expect(await screen.findByText(/Học viên chưa có học phần đã học có kết quả/)).toBeTruthy();
    expect(screen.queryByTestId("studied-subjects")).toBeNull();
  });

  it("lets the council edit or cancel an already decided recognition", async () => {
    configureReads({
      recognitions: [{
        id: "rec-1",
        basis: "canonical_subject",
        status: "approved",
        decidedAt: "2026-08-01T00:00:00.000Z",
        sourceType: "pre_masters",
        majorTransferId: null,
        sourceSubject: { id: "subject-old", codeText: "OLD101", name: "Triết học" },
        targetSubject: { id: "subject-1", codeText: "CNT101", name: "Triết học" },
      }],
    });

    render(<AdminAdmissionRecordDetail />);

    const editButton = await screen.findByRole("button", { name: /Sửa quyết định/ });
    expect(screen.queryByRole("button", { name: "Xử lý" })).toBeNull();

    // Quyết định đã chốt vẫn sửa được, và giá trị cũ được nạp sẵn để không vô tình đảo kết quả.
    await clickAndWait(editButton);
    expect(await screen.findByText(/Sửa quyết định công nhận học phần/)).toBeTruthy();
    expect(screen.getByText(/đã được lưu trước đó/)).toBeTruthy();
  });

  it("cancels a decided recognition so it can be proposed again", async () => {
    configureReads({
      recognitions: [{
        id: "rec-1",
        basis: "canonical_subject",
        status: "approved",
        sourceType: "pre_masters",
        majorTransferId: null,
        sourceSubject: { id: "subject-old", codeText: "OLD101", name: "Triết học" },
        targetSubject: { id: "subject-1", codeText: "CNT101", name: "Triết học" },
      }],
    });
    axios.delete.mockResolvedValue({ data: { success: true } });
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);

    render(<AdminAdmissionRecordDetail />);

    await clickAndWait(await screen.findByTestId("cancel-recognition-rec-1"));

    await waitFor(() => expect(axios.delete).toHaveBeenCalledWith(
      expect.stringContaining("/plan/subject-recognitions/rec-1"),
      expect.anything(),
    ));
    expect(toast.success).toHaveBeenCalledWith("Đã hủy công nhận học phần.");
    confirmSpy.mockRestore();
  });

  it("shows studied curriculum subjects without scores and limits recognition cards to prior learning and bridge subjects", async () => {
    const recognition = (id, sourceType, learningResult = {}) => ({ id, sourceType, status: "approved", basis: "canonical_subject", sourceSubject: subject, targetSubject: subject, learningResult });
    configureReads({
      studiedSubjects: [
        { id: "grade-1", subject, sourceType: "regular", status: "completed", result: "passed", score: 9.25 },
        { id: "grade-2", subject: { ...subject, id: "subject-2", name: "Học phần không đạt" }, sourceType: "regular", status: "completed", result: "failed", score: 3.25 },
      ],
      recognitions: [recognition("regular", "regular"), recognition("external", "external"),
        recognition("early", "early_enrollment", { result: "passed", score: 9.25 }),
        recognition("pre", "pre_masters", { result: "failed", score: 3.25 }),
        recognition("bridge", "regular", { bridgeKnowledgeSubjectId: "bridge-1", result: "passed" })],
    });
    render(<AdminAdmissionRecordDetail />);
    const studied = await screen.findByTestId("studied-subjects");
    expect(within(studied).getByText("Đạt")).toBeInTheDocument();
    expect(within(studied).getByText("Không đạt")).toBeInTheDocument();
    expect(within(studied).queryByText("Điểm")).not.toBeInTheDocument();
    expect(within(studied).queryByText("9.25")).not.toBeInTheDocument();
    expect(within(studied).queryByText("3.25")).not.toBeInTheDocument();
    expect(screen.getByText("Quyết định công nhận học phần (3)")).toBeInTheDocument();
    expect(screen.queryByTestId("recognition-regular")).not.toBeInTheDocument();
    expect(screen.queryByTestId("recognition-external")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("recognition-early")).getByText("Kết quả: Đạt")).toBeInTheDocument();
    expect(within(screen.getByTestId("recognition-pre")).getByText("Kết quả: Không đạt")).toBeInTheDocument();
    expect(screen.getByTestId("recognition-bridge")).toBeInTheDocument();
  });

  it("preserves an exemption and a pending exam instead of displaying a pass", async () => {
    configureReads({
      studiedSubjects: [{ id: "grade-1", subject, sourceType: "regular", status: "completed", result: "exempt" }],
      recognitions: [{ id: "rec-1", sourceType: "pre_masters", status: "approved", sourceSubject: subject,
        targetSubject: subject, learningResult: { result: "pending" } }],
    });
    render(<AdminAdmissionRecordDetail />);
    const studied = await screen.findByTestId("studied-subjects");
    expect(within(studied).getByText("Miễn thi")).toBeInTheDocument();
    expect(within(studied).queryByText("Đạt")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("recognition-rec-1")).getByText("Kết quả: Chưa có kết quả")).toBeInTheDocument();
  });
});
