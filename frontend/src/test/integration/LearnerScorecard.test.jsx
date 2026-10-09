import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import AdmissionRecordDetail from "../../pages/plan/admissionRecordDetail";
import ClassScoreSummary from "../../pages/reports/classScoreSummary";
import LearnerScorecard from "../../features/learners/LearnerScorecard";

jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), defaults: {} }));
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });
jest.mock("react-toastify", () => ({ ToastContainer: () => null, toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@mui/icons-material", () => ({
  AddPhotoAlternateRounded: () => null, ArrowBackRounded: () => null, CheckCircleRounded: () => null,
  DeleteRounded: () => null, FolderSpecialRounded: () => null, PersonRounded: () => null,
  RefreshRounded: () => null, SaveRounded: () => null, SchoolRounded: () => null,
  WarningAmberRounded: () => null, WorkspacePremiumRounded: () => null, SwapHorizRounded: () => null,
  HistoryRounded: () => null, AddRounded: () => null, DeleteOutlineRounded: () => null,
  EditRounded: () => null, FactCheckRounded: () => null, MenuBookRounded: () => null,
  RuleRounded: () => null, VisibilityRounded: () => null, SearchRounded: () => null, DownloadRounded: () => null,
}));
jest.setTimeout(20000);

const major = { id: "m1", name: "Công nghệ thông tin", program: "masters", disciplineId: "d1", discipline: { id: "d1", name: "Công nghệ thông tin" } };
const groups = [
  { id: "g1", code: "CNTT2026.1.1", name: "CNTT2026.1.1", program: "masters", academicYear: "2026", major },
  { id: "g2", code: "CNTT2025.1.1", name: "CNTT2025.1.1", program: "masters", academicYear: "2025", major },
];
const record = { id: "ar1", code: "HV001", fullName: "Nguyễn Văn An", trainingLevel: "Thạc sĩ", academicYear: "2026", majorId: "m1", documents: {} };
const student = { ...record, admissionRecordId: "ar1", participantId: "admission:ar1", scores: {} };
const subjects = [
  { id: "hp1", code: "HP01", name: "Triết học", credits: 3, isRequired: true, grade: { score: 7.3, result: "passed", details: { source: "gradebook", testScore: 8, assignmentScore: 8.5, examScore: 7, grade4: 3, letterGrade: "B", attemptScores: [6, 7] } } },
  { id: "hp2", code: "HP02", name: "Tiếng Anh", credits: 3, isRequired: true, grade: { score: 0, result: "failed", details: { testScore: 0, examScore: 0 } } },
  { id: "hp3", code: "HP03", name: "Phương pháp nghiên cứu", credits: 3, isRequired: true, grade: { score: null, result: "exempt", details: { source: "gradebook" } } },
  { id: "hp4", code: "HP04", name: "Luận văn", credits: 10, isRequired: true, grade: null },
  { id: "hp5", code: "HP05", name: "Phân tích dữ liệu", credits: 2, isRequired: false, grade: { score: null, result: "pending", details: { testScore: 0 } } },
];
const scorecard = (id = "g1") => ({ student, groups, group: groups.find(group => group.id === id), curriculum: { id: "c1", name: "CTĐT Công nghệ thông tin", totalCredits: 60 }, subjects });
const classReport = { ...scorecard(), rows: [student], total: 1 };
const LocationProbe = () => {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="location">{location.pathname}{location.search}</output><button onClick={() => navigate(-1)}>Lùi lịch sử</button></>;
};
const mount = (entry = "/masters/admitted-records/ar1") => render(<MemoryRouter initialEntries={[entry]}>
  <LocationProbe /><Routes>
    <Route path="/reports/class-score-summary" element={<ClassScoreSummary />} />
    <Route path="/masters/admitted-records/:id" element={<AdmissionRecordDetail />} />
    <Route path="/plan/admission-records/:id" element={<AdmissionRecordDetail />} />
  </Routes>
</MemoryRouter>);

beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear();
  axios.get.mockImplementation(async (url, config) => {
    if (url.endsWith("/class-score-summary/options")) return { data: { groups } };
    if (url.endsWith("/class-score-summary/export")) return { data: classReport };
    if (url.includes("/learner-scorecard/")) return { data: scorecard(config.params.classGroupId || "g1") };
    if (url.endsWith("/admission-records/ar1")) return { data: record };
    if (url.endsWith("/auth/isStaff")) return { data: { message: "admin" } };
    if (url.includes("/system/majors")) return { data: [major] };
    if (url.endsWith("/recognized-credits")) return { data: { credits: 0 } };
    return { data: [] };
  });
});

it("loads the new tab on demand and preserves every subject, component, zero and ungraded value", async () => {
  mount();
  const tab = await screen.findByRole("tab", { name: "Bảng điểm" });
  expect(axios.get.mock.calls.some(([url]) => url.includes("/learner-scorecard/"))).toBe(false);
  fireEvent.click(tab);
  await screen.findByText("HP01");
  expect(tab).toHaveAttribute("aria-selected", "true");
  expect(screen.getByTestId("location")).toHaveTextContent("?tab=grades");
  const panel = screen.getByLabelText("Bảng điểm học viên");
  expect(within(panel).getAllByRole("row")).toHaveLength(6);
  const values = code => within(within(panel).getByText(code).closest("tr")).getAllByRole("cell").map(cell => cell.textContent);
  expect(values("HP01")).toEqual(["1", "HP01", "Triết học", "3", "Bắt buộc", "8", "8.5", "7", "7.3", "3", "B", "Lần 1: 6; Lần 2: 7", "Đạt"]);
  expect(values("HP02")[8]).toBe("0");
  expect(values("HP02")[12]).toBe("Không đạt");
  expect(values("HP03")[12]).toBe("Miễn thi");
  expect(values("HP04").slice(5, 12)).toEqual(Array(7).fill(""));
  expect(values("HP04")[12]).toBe("Chưa có điểm");
  expect(values("HP05")[5]).toBe("0");
  expect(values("HP05")[8]).toBe("");
  expect(values("HP05")[12]).toBe("Chưa có kết quả");
  fireEvent.click(screen.getByRole("tab", { name: "Thông tin hồ sơ & học tập" }));
  expect(screen.getByRole("tab", { name: "Thông tin hồ sơ & học tập" })).toHaveAttribute("aria-selected", "true");
  expect(screen.queryByLabelText("Bảng điểm học viên")).not.toBeInTheDocument();
});

it("opens the clicked learner's scorecard in the exact reported class and supports browser back", async () => {
  mount("/reports/class-score-summary");
  const link = (await screen.findByText("An")).closest("a");
  expect(link).toHaveAttribute("href", "/masters/admitted-records/ar1?tab=grades&classGroupId=g1");
  fireEvent.click(link);
  await screen.findByText("HP01");
  expect(screen.getByRole("tab", { name: "Bảng điểm" })).toHaveAttribute("aria-selected", "true");
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/learner-scorecard\/ar1$/), { params: { classGroupId: "g1" } });
  expect(screen.getByLabelText("Lớp học viên")).toHaveTextContent("CNTT2026.1.1");
  fireEvent.click(screen.getByRole("button", { name: "Lùi lịch sử" }));
  expect((await screen.findByText("HV001")).closest("a")).toBeInTheDocument();
});

it("keeps the chosen class in the URL and discards a late response from a previous class", async () => {
  let resolveOld;
  mount("/masters/admitted-records/ar1?tab=grades&classGroupId=g1");
  await screen.findByText("HP01");
  axios.get.mockImplementation((url, config) => new Promise(resolve => {
    if (config.params.classGroupId === "g2") resolveOld = resolve;
    else resolve({ data: scorecard("g1") });
  }));
  fireEvent.mouseDown(screen.getByLabelText("Lớp học viên"));
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "CNTT2025.1.1" }));
  await waitFor(() => expect(resolveOld).toBeDefined());
  expect(screen.getByTestId("location")).toHaveTextContent("classGroupId=g2");
  // Leaving the tab while a request is in flight must not populate the next tab mount.
  fireEvent.click(screen.getByRole("tab", { name: "Thông tin hồ sơ & học tập" }));
  await act(async () => resolveOld({ data: scorecard("g2") }));
  expect(screen.queryByLabelText("Bảng điểm học viên")).not.toBeInTheDocument();
});

it("supports the scorecard tab on a doctoral profile", async () => {
  const originalGet = axios.get.getMockImplementation();
  axios.get.mockImplementation(async (url, config) => url.endsWith("/admission-records/ar1") ? { data: { ...record, trainingLevel: "Tiến sĩ" } } : originalGet(url, config));
  mount("/plan/admission-records/ar1?tab=grades&classGroupId=g1");
  await screen.findByText("HP01");
  expect(screen.getByRole("tab", { name: "Bảng điểm" })).toHaveAttribute("aria-selected", "true");
  expect(screen.queryByRole("tab", { name: "Xét tuyển" })).not.toBeInTheDocument();
});

it("retries an API failure without losing the requested class", async () => {
  axios.get.mockRejectedValueOnce(new Error("Không tải được điểm"));
  render(<LearnerScorecard admissionRecordId="ar1" classGroupId="g2" onClassChange={jest.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Thử lại" }));
  await screen.findByText("HP01");
  expect(axios.get).toHaveBeenLastCalledWith(expect.stringMatching(/learner-scorecard\/ar1$/), { params: { classGroupId: "g2" } });
});

it.each([
  [{ group: null, groups: [], curriculum: null, subjects: [] }, "Học viên chưa được phân vào lớp"],
  [{ curriculum: null, subjects: [] }, "Lớp chưa được gán chương trình đào tạo"],
  [{ subjects: [] }, "Chương trình đào tạo chưa có học phần"],
])("shows the correct empty state without inventing grades", async (override, message) => {
  axios.get.mockResolvedValueOnce({ data: { ...scorecard(), ...override } });
  render(<LearnerScorecard admissionRecordId="ar1" onClassChange={jest.fn()} />);
  expect(await screen.findByText(new RegExp(message))).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});
