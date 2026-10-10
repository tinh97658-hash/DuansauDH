import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import { toast } from "react-toastify";
import AdminAdmissionRecordDetail from "../../pages/plan/admissionRecordDetail";

// This mounts the full record page and its MUI dialogs, including the refresh
// after a decision. Match the existing full-page integration tests' timeout.
jest.setTimeout(15000);

jest.mock("@mui/icons-material", () => ({
  AddPhotoAlternateRounded: () => null, ArrowBackRounded: () => null, CheckCircleRounded: () => null,
  DeleteRounded: () => null, FolderSpecialRounded: () => null, PersonRounded: () => null,
  PictureAsPdfRounded: () => null, RefreshRounded: () => null, SaveRounded: () => null,
  SchoolRounded: () => null, WarningAmberRounded: () => null, WorkspacePremiumRounded: () => null,
  SwapHorizRounded: () => null, HistoryRounded: () => null, AddRounded: () => null,
  DeleteOutlineRounded: () => null, EditRounded: () => null, FactCheckRounded: () => null,
  MenuBookRounded: () => null, RuleRounded: () => null,
}));
jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), defaults: {} }));
jest.mock("react-router-dom", () => ({
  useParams: () => ({ id: "record-1" }), useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
}));
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return children; });
jest.mock("react-toastify", () => ({ toast: { success: jest.fn(), error: jest.fn() }, ToastContainer: () => null }));

const majorA = { id: "A", name: "Ngành A", program: "masters", active: true };
const majorB = { id: "B", name: "Ngành B", program: "masters", active: true };
const record = { id: "record-1", fullName: "Nguyễn Văn A", majorId: "A", majorName: "Ngành A",
  academicYear: "2026", trainingLevel: "Thạc sĩ", status: "approved", studyStatus: "Đã trúng tuyển", documents: {} };
const transfer = { id: "transfer-1", fromMajorId: "A", toMajorId: "B", fromMajor: majorA, toMajor: majorB, status: "pending", requestedAt: "2026-10-10T09:00:00Z" };
function reads(transfers = []) {
  axios.get.mockImplementation(async (url) => {
    if (url.endsWith("/auth/session")) return { data: { user: { role: "admin" } } };
    if (url.includes("/system/majors")) return { data: [majorA, majorB] };
    if (url.includes("/major-transfers")) return { data: transfers };
    if (url.includes("/curriculums?")) return { data: [{ id: "curriculum-B", code: "CT-B", name: "CTĐT B", applicableFromYear: "2026", active: true }] };
    if (url.includes("/recognized-credits")) return { data: { credits: 0 } };
    if (url.endsWith("/admission-records/record-1")) return { data: record };
    return { data: [] };
  });
}
beforeEach(() => { jest.resetAllMocks(); reads(); });

async function requestDialog() {
  fireEvent.click(await screen.findByRole("button", { name: "Chuyển chuyên ngành" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.mouseDown(within(dialog).getByText("Chọn chuyên ngành mới"));
  fireEvent.click(await screen.findByRole("option", { name: "Ngành B" }));
  fireEvent.change(within(dialog).getByLabelText("Lý do chuyển"), { target: { value: "Đổi định hướng" } });
  return dialog;
}
async function approvalDialog() {
  reads([transfer]); render(<AdminAdmissionRecordDetail />);
  fireEvent.click(await screen.findByRole("button", { name: "Duyệt" }));
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "Duyệt chuyển ngành" })).toBeEnabled());
  return dialog;
}

it("POSTs a pending request and reports waiting for processing, without claiming the record was changed", async () => {
  axios.post.mockResolvedValue({ data: transfer }); render(<AdminAdmissionRecordDetail />);
  const dialog = await requestDialog();
  fireEvent.click(within(dialog).getByRole("button", { name: "Gửi chờ hội đồng" }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã gửi yêu cầu chuyển chuyên ngành, chờ xử lý."));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/admission-records/record-1/major-transfers"),
    { toMajorId: "B", reason: "Đổi định hướng" }, { withCredentials: true });
  expect(axios.put).not.toHaveBeenCalled();
});

it("surfaces a request API error and emits no success", async () => {
  axios.post.mockRejectedValue({ response: { data: { message: "Đang có yêu cầu chờ xử lý." } } });
  render(<AdminAdmissionRecordDetail />); const dialog = await requestDialog();
  fireEvent.click(within(dialog).getByRole("button", { name: "Gửi chờ hội đồng" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Đang có yêu cầu chờ xử lý."));
  expect(toast.success).not.toHaveBeenCalled(); expect(screen.getByRole("dialog")).toBeInTheDocument();
});

it("only shows approval success after the decision API resolves", async () => {
  let finish;
  axios.put.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const dialog = await approvalDialog();
  fireEvent.click(within(dialog).getByRole("button", { name: "Duyệt chuyển ngành" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/major-transfers/transfer-1/decision"),
    { decision: "approved", toCurriculumId: "curriculum-B", note: "" }, { withCredentials: true }));
  expect(toast.success).not.toHaveBeenCalled();
  await act(async () => { finish({ data: { ...transfer, status: "approved" } }); });
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã duyệt chuyển chuyên ngành và đối chiếu học phần được công nhận."));
});

it("keeps the approval dialog open and displays the backend error on failure", async () => {
  axios.put.mockRejectedValue({ response: { data: { message: "Chương trình đào tạo mới không phù hợp." } } });
  const dialog = await approvalDialog();
  fireEvent.click(within(dialog).getByRole("button", { name: "Duyệt chuyển ngành" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Chương trình đào tạo mới không phù hợp."));
  expect(toast.success).not.toHaveBeenCalled(); expect(screen.getByRole("dialog")).toBeInTheDocument();
});
