/* eslint-disable testing-library/no-node-access -- Visual contracts assert panel order/layout and MUI Select's persisted input/disabled wrapper, not just accessible text. */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import CourseOfferings from "../../pages/masters/courseOfferings";
import Schedule from "../../pages/masters/schedule";

jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), defaults: {} }));
// Decorative icons are not under test; keep the actual scheduling controls/components.
jest.mock("@mui/icons-material", () => ({
  AddRounded: () => null, RefreshRounded: () => null, SearchRounded: () => null,
  ArrowForwardRounded: () => null, CheckCircleRounded: () => null, CloseRounded: () => null,
  LayersRounded: () => null, EventNoteRounded: () => null, DeleteOutlineRounded: () => null,
  EditRounded: () => null, MeetingRoomRounded: () => null, VisibilityRounded: () => null,
  ChevronLeftRounded: () => null, ChevronRightRounded: () => null, TodayRounded: () => null, AccessTimeRounded: () => null,
}));
jest.mock("../../components/FeatureLayout", () => function FeatureLayoutMock({ children, workspaceMode, hideHeader, title, group, desc }) {
  return <div data-workspace-mode={workspaceMode ? "true" : "false"}>{!hideHeader && <header>{group}<h1>{title}</h1>{desc}</header>}{children}</div>;
});

const major = { id: "major-1", code: "CNTT", name: "Công nghệ thông tin", program: "masters", active: true };
const secondMajor = { id: "major-2", code: "KT", name: "Kinh tế", program: "masters", active: true };
const group = {
  id: "group-1",
  code: "CNTT-2026-N01",
  name: "Nhóm 01",
  majorId: major.id,
  major,
  academicYear: "2026",
  term: "HK1",
};
const previousGroup = { ...group, id: "group-2025", code: "CNTT-2025-N01", academicYear: "2025" };
const activeGroup = { ...group, id: "group-active", code: "CNTT-2026-N02", name: "Nhóm 02" };
const subject = { id: "subject-1", code: "HP01", name: "Học phần thật", program: "masters" };
const candidate = {
  subject,
  eligibleClassGroups: [{ ...group, memberCount: 24 }],
  activeClassGroups: [activeGroup],
  completedClassGroups: [],
};
const persistedOffering = {
  id: "7b46c74b-344a-4fd6-a7e2-1868c40bfc31",
  subject,
  status: "active",
  participantCount: 24,
  sessionSummary: { totalCount: 0, heldCount: 0, notHeldCount: 0, plannedCount: 0, pendingCount: 0, futurePlannedCount: 0, firstPlannedSessionDate: null },
  groupLinks: [{ classGroupId: group.id, classGroup: group }],
};

const mockReads = (canManageScheduling, { includeScheduling = false, candidates = [candidate] } = {}) => {
  axios.get.mockImplementation((url) => {
    if (url.includes("/system/majors")) return Promise.resolve({ data: [major, secondMajor] });
    if (url.includes("/auth/session")) return Promise.resolve({ data: { authenticated: true, user: { canManageScheduling } } });
    if (url.includes("/masters/class-groups")) {
      return Promise.resolve({ data: url.includes(secondMajor.id) ? [] : [group, previousGroup] });
    }
    if (url.includes("/scheduling/course-offering-candidates")) return Promise.resolve({ data: { subjects: candidates } });
    if (includeScheduling && url.includes("/scheduling/course-offerings?")) return Promise.resolve({ data: [persistedOffering] });
    if (includeScheduling && url.includes("/scheduling/pending-teaching-sessions")) return Promise.resolve({ data: [] });
    if (includeScheduling && url.includes("/scheduling/teaching-sessions?")) return Promise.resolve({ data: [] });
    if (includeScheduling && url.includes("/system/lecturers")) return Promise.resolve({ data: [] });
    if (includeScheduling && url.includes("/system/rooms")) return Promise.resolve({ data: [] });
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
};

// These actions start candidate/preview requests or navigation; await their React updates.
// eslint-disable-next-line testing-library/no-unnecessary-act -- Await asynchronous candidate/preview updates beyond fireEvent's synchronous act.
const clickAndWait = async (element) => { await act(async () => { fireEvent.click(element); await new Promise((resolve) => setTimeout(resolve, 0)); }); };
const renderPage = async (node) => {
  let result;
  // eslint-disable-next-line testing-library/no-unnecessary-act -- Mount starts mocked API reads that must settle before interactions.
  await act(async () => { result = render(node); });
  return result;
};

const chooseSelectOption = async (label, optionName) => {
  const select = await screen.findByLabelText(label);
  await waitFor(() => expect(select.closest(".MuiInputBase-root")).not.toHaveClass("Mui-disabled"));
  fireEvent.mouseDown(select);
  await clickAndWait(await screen.findByRole("option", { name: optionName }));
};

const reachSubjectWorkspace = async () => {
  await chooseSelectOption("Chọn chuyên ngành", `${major.name} (${major.code})`);
  await chooseSelectOption("Khóa / Năm học", "2026");
  await clickAndWait(await screen.findByRole("button", { name: /HP01 · Học phần thật/ }));
};

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
};

// The A/B preview race test awaits several real MUI renders on the Windows runner.
jest.setTimeout(30000);

describe("Masters course-offering page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.post.mockImplementation((url) => Promise.resolve({ data: url.endsWith("/participant-preview") ? { classGroupCount: 1, participantCount: 24 } : persistedOffering }));
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: jest.fn() });
  });

  it("reveals scope steps progressively and resets downstream choices when scope changes", async () => {
    mockReads(true);
    const { container } = await renderPage(<MemoryRouter><CourseOfferings /></MemoryRouter>);

    expect(await screen.findByLabelText("Chọn chuyên ngành")).toBeInTheDocument();
    expect(container.firstChild).toHaveAttribute("data-workspace-mode", "true");
    expect(screen.queryByLabelText("Khóa / Năm học")).not.toBeInTheDocument();
    expect(screen.queryByText("HỌC PHẦN CÒN CẦN TỔ CHỨC")).not.toBeInTheDocument();

    await chooseSelectOption("Chọn chuyên ngành", `${major.name} (${major.code})`);
    const yearSelect = await screen.findByLabelText("Khóa / Năm học");
    expect(yearSelect.parentElement.querySelector("input")).toHaveValue("");
    expect(screen.queryByText("HỌC PHẦN CÒN CẦN TỔ CHỨC")).not.toBeInTheDocument();

    await chooseSelectOption("Khóa / Năm học", "2026");
    expect(await screen.findByText("HỌC PHẦN CÒN CẦN TỔ CHỨC")).toBeInTheDocument();
    await clickAndWait(await screen.findByRole("button", { name: /HP01 · Học phần thật/ }));
    expect(await screen.findByText("GHÉP LỚP / NHÓM")).toBeInTheDocument();

    await chooseSelectOption("Khóa / Năm học", "2025");
    expect(screen.queryByText("GHÉP LỚP / NHÓM")).not.toBeInTheDocument();
    expect(await screen.findByText("Chọn Học phần để tổ chức lớp học phần")).toBeInTheDocument();

    await chooseSelectOption("Chọn chuyên ngành", `${secondMajor.name} (${secondMajor.code})`);
    expect(screen.queryByText("HỌC PHẦN CÒN CẦN TỔ CHỨC")).not.toBeInTheDocument();
    const resetYearSelect = screen.getAllByLabelText("Khóa / Năm học").find((element) => element.getAttribute("role") === "button");
    expect(resetYearSelect.parentElement.querySelector("input")).toHaveValue("");
  });

  it("creates from eligible groups and opens the persisted offering in scheduling selection mode", async () => {
    mockReads(true, { includeScheduling: true });

    await renderPage(
      <MemoryRouter initialEntries={["/masters/course-offerings"]}>
        <Routes>
          <Route path="/masters/course-offerings" element={<CourseOfferings />} />
          <Route path="/masters/schedule" element={<><LocationProbe /><Schedule /></>} />
        </Routes>
      </MemoryRouter>,
    );

    await reachSubjectWorkspace();
    const groupCheckbox = await screen.findByRole("checkbox", { name: `Chọn nhóm ${group.code}` });
    expect(screen.getByRole("checkbox", { name: `Chọn nhóm ${activeGroup.code}` })).toBeDisabled();
    const candidateUrl = axios.get.mock.calls.find(([url]) => url.includes("course-offering-candidates"))[0];
    expect(candidateUrl).toContain("program=masters");
    await clickAndWait(groupCheckbox);
    await waitFor(() => expect(screen.getByTestId("participant-preview-count")).toHaveTextContent("24"));
    await clickAndWait(screen.getByRole("button", { name: "Tạo lớp học phần" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/scheduling/course-offerings"),
      { subjectId: subject.id, classGroupIds: [group.id] },
      { withCredentials: true },
    ));
    expect(await screen.findByText("ĐÃ TẠO LỚP HỌC PHẦN")).toBeInTheDocument();
    expect(axios.get.mock.calls.filter(([url]) => url.includes("course-offering-candidates"))).toHaveLength(2);

    await clickAndWait(screen.getByRole("button", { name: "Sang Xếp lịch" }));
    expect(await screen.findByTestId("location-search")).toHaveTextContent(`?offeringId=${persistedOffering.id}`);
    const selectedCard = await screen.findByRole("button", { name: /HP01 · Học phần thật/ });
    expect(selectedCard).toHaveAttribute("data-selected", "true");
    expect(selectedCard).toHaveAttribute("data-new-offering", "true");
    expect(screen.getByTestId("selected-offering-strip")).toHaveTextContent("ĐANG XẾP");
    expect(screen.getByTestId("weekly-calendar")).toHaveAttribute("data-selecting", "true");
    expect(screen.getByPlaceholderText("Tìm môn / lớp...")).toHaveValue("");
    expect(screen.getByRole("button", { name: /ĐANG DẠY · 1/ })).toHaveAttribute("data-active", "true");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center", inline: "nearest" });
  });

  it("keeps create controls disabled for read-only Staff", async () => {
    mockReads(false);
    await renderPage(<MemoryRouter><CourseOfferings /></MemoryRouter>);

    expect(await screen.findByText("Tài khoản hiện tại chỉ có quyền xem.")).toBeInTheDocument();
    await reachSubjectWorkspace();
    const groupCheckbox = await screen.findByRole("checkbox", { name: `Chọn nhóm ${group.code}` });
    expect(groupCheckbox).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tạo lớp học phần" })).toBeDisabled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("keeps the current cohort's candidates when the previous cohort responds last", async () => {
    mockReads(true);
    const reads = axios.get.getMockImplementation();
    const requests = [];
    axios.get.mockImplementation((url, config) => {
      if (!url.includes("/course-offering-candidates?")) return reads(url, config);
      return new Promise((resolve) => requests.push({ url, resolve }));
    });
    await renderPage(<MemoryRouter><CourseOfferings /></MemoryRouter>);
    await chooseSelectOption("Chọn chuyên ngành", `${major.name} (${major.code})`);
    await chooseSelectOption("Khóa / Năm học", "2026");
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toContain("academicYear=2026");
    await chooseSelectOption("Khóa / Năm học", "2025");
    expect(requests).toHaveLength(2);
    expect(requests[1].url).toContain("academicYear=2025");
    const current = { ...candidate, subject: { ...subject, id: "subject-2025", code: "HP25", name: "Học phần khóa 2025" } };
    await act(async () => { requests[1].resolve({ data: { subjects: [current] } }); });
    expect(screen.getByText("HP25 · Học phần khóa 2025")).toBeInTheDocument();
    await act(async () => { requests[0].resolve({ data: { subjects: [candidate] } }); });
    expect(screen.getByText("HP25 · Học phần khóa 2025")).toBeInTheDocument();
    expect(screen.queryByText("HP01 · Học phần thật")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Khóa / Năm học")).toHaveTextContent("2025");
  });

  it("keeps two upper panels and a bottom composition/summary with a disabled, non-demo retake area", async () => {
    mockReads(true);
    await renderPage(<MemoryRouter><CourseOfferings /></MemoryRouter>);
    await reachSubjectWorkspace();
    expect(screen.queryByRole("heading", { name: "Tạo lớp học phần" })).not.toBeInTheDocument();
    expect(screen.queryByText("Đào tạo Thạc sĩ")).not.toBeInTheDocument();
    expect(screen.queryByText(/Tổ chức học phần từ gói học phần chính thức/)).not.toBeInTheDocument();
    expect(within(screen.getByTestId("offering-shell")).getByText("TẠO LỚP HỌC PHẦN")).toBeInTheDocument();
    const top = screen.getByTestId("offering-top-panels");
    const groupsPanel = screen.getByTestId("offering-groups-panel");
    const retake = screen.getByTestId("offering-retake-panel");
    expect(top.children).toHaveLength(2);
    expect(top.firstElementChild).toBe(groupsPanel);
    expect(top.lastElementChild).toBe(retake);
    expect(retake).toHaveAttribute("aria-disabled", "true");
    expect(within(retake).getByLabelText("Tìm học viên học lại")).toBeDisabled();
    expect(within(retake).getAllByText("Chưa có dữ liệu học lại chính thức")).toHaveLength(1);
    expect(within(retake).getAllByText("Danh sách học viên học lại sẽ xuất hiện tại đây khi kết quả học tập được liên kết chính xác với học phần.")).toHaveLength(1);
    expect(within(retake).queryByText(/Chức năng này sẽ được mở/)).not.toBeInTheDocument();
    expect(within(retake).queryByRole("checkbox")).not.toBeInTheDocument();
    const bottom = screen.getByTestId("offering-bottom-panel");
    expect(top.nextElementSibling).toBe(bottom);
    expect(bottom.lastElementChild).toBe(screen.getByTestId("offering-summary"));
    expect(screen.getByTestId("offering-shell")).toHaveStyle("height: 100%; min-height: 0; grid-template-rows: 68px minmax(0,1fr)");
    expect(screen.getByTestId("offering-body")).toHaveStyle("min-height: 0; grid-template-rows: minmax(0,1fr) 170px");
    expect(bottom).toHaveStyle("height: 170px; grid-template-columns: minmax(0,1fr) 260px");
    const summary = screen.getByTestId("offering-summary");
    expect(summary).toHaveStyle("grid-template-rows: auto minmax(0,1fr) auto");
    expect(summary).not.toHaveStyle("overflow-y: auto");
    expect(within(summary).getByRole("button", { name: "Làm lại" })).toBeDisabled();
    expect(within(summary).getByRole("button", { name: "Tạo lớp học phần" })).toBeDisabled();
    expect(within(summary).getByRole("button", { name: "Tạo lớp học phần" })).toBeVisible();
    expect(within(bottom).getByText("3 · THÀNH PHẦN LỚP HỌC PHẦN")).toBeInTheDocument();
    expect(screen.queryByText(/2\/3 ·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ghép học viên học lại ·/)).not.toBeInTheDocument();
    expect(screen.getByTestId("create-offering-workspace")).toHaveAttribute("data-scheduling-typography", "compact");
    expect(screen.getByTestId("participant-preview-count")).toHaveTextContent("0");
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("keeps the A+B authoritative preview when the older A-only response arrives last", async () => {
    const groupB = { ...group, id: "group-b", code: "CNTT-2026-B", memberCount: 2 };
    mockReads(true, { candidates: [{ ...candidate, eligibleClassGroups: [{ ...group, memberCount: 2 }, groupB] }] });
    let resolveA;
    let resolveAB;
    axios.post.mockImplementation((_url, data) => new Promise((resolve) => {
      if (data.classGroupIds.length === 1) resolveA = resolve;
      else resolveAB = resolve;
    }));
    await renderPage(<MemoryRouter><CourseOfferings /></MemoryRouter>);
    await reachSubjectWorkspace();
    await clickAndWait(screen.getByRole("checkbox", { name: `Chọn nhóm ${group.code}` }));
    expect(screen.getByLabelText("Đang tính tổng học viên")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo lớp học phần" })).toBeDisabled();
    await clickAndWait(screen.getByRole("checkbox", { name: `Chọn nhóm ${groupB.code}` }));
    expect(axios.post).toHaveBeenLastCalledWith(expect.stringMatching(/\/participant-preview$/), { classGroupIds: [group.id, groupB.id] }, { withCredentials: true });
    await act(async () => { resolveAB({ data: { classGroupCount: 2, participantCount: 3 } }); });
    expect(screen.getByTestId("participant-preview-count")).toHaveTextContent("3");
    await act(async () => { resolveA({ data: { classGroupCount: 1, participantCount: 2 } }); });
    expect(screen.getByTestId("participant-preview-count")).toHaveTextContent("3");
    expect(screen.getByRole("button", { name: "Tạo lớp học phần" })).toBeEnabled();
    await clickAndWait(screen.getByRole("button", { name: "Làm lại" }));
    expect(screen.getByTestId("participant-preview-count")).toHaveTextContent("0");
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it("shows an unknown count and blocks create on preview failure without falling back to memberCount sums", async () => {
    mockReads(true);
    axios.post.mockRejectedValue(new Error("Preview unavailable"));
    await renderPage(<MemoryRouter><CourseOfferings /></MemoryRouter>);
    await reachSubjectWorkspace();
    await clickAndWait(screen.getByRole("checkbox", { name: `Chọn nhóm ${group.code}` }));
    expect(await screen.findByText(/Không thể tính tổng học viên/)).toBeInTheDocument();
    expect(screen.getByTestId("participant-preview-count")).toHaveTextContent("—");
    expect(screen.getByRole("button", { name: "Tạo lớp học phần" })).toBeDisabled();
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][0]).toMatch(/\/participant-preview$/);
  });
});
