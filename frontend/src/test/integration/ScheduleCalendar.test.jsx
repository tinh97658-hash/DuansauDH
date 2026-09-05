/* eslint-disable testing-library/no-node-access -- Visual contracts inspect slot hierarchy, emitted CSS and MUI portal aria-hidden state, which semantic queries alone cannot assert. */
import SessionComposer from "../../components/scheduling/SessionComposer";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import { MemoryRouter } from "react-router-dom";
import Schedule from "../../pages/masters/schedule";
import WeeklyCalendar from "../../components/scheduling/WeeklyCalendar";
import { addDays, formatDateKey, isSessionPast, mondayOf } from "../../utils/schedulingCalendar";

jest.mock("axios", () => ({ delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(), defaults: {} }));
// Decorative icons are not under test; avoid loading the entire icon catalog in Jest.
jest.mock("@mui/icons-material", () => ({
  AddRounded: () => null, RefreshRounded: () => null, SearchRounded: () => null,
  CloseRounded: () => null, EventNoteRounded: () => null, CheckCircleRounded: () => null,
  DeleteOutlineRounded: () => null, EditRounded: () => null, MeetingRoomRounded: () => null,
  VisibilityRounded: () => null, ChevronLeftRounded: () => null, ChevronRightRounded: () => null,
  TodayRounded: () => null, AccessTimeRounded: () => null,
}));
jest.mock("../../components/FeatureLayout", () => function FeatureLayoutMock({ children, workspaceMode }) { return <div data-workspace-mode={workspaceMode ? "true" : "false"}>{children}</div>; });

const major = { id: "major-1", code: "CNTT", name: "Công nghệ thông tin" };
const secondMajor = { id: "major-2", code: "KT", name: "Kinh tế" };
const group = { id: "group-1", code: "CNTT-26", name: "Nhóm CNTT", majorId: major.id, major, academicYear: "2026", term: "HK1" };
const crossGroup = { id: "group-2", code: "KT-26", name: "Nhóm KT", majorId: secondMajor.id, major: secondMajor, academicYear: "2026", term: "HK1" };
const subject = { id: "subject-1", code: "HP01", name: "Học phần thật", program: "masters" };
const monday = "2026-08-31";
const today = "2026-09-02";
const offering = {
  id: "offering-1", subject, status: "active", participantCount: 30,
  sessionSummary: { totalCount: 1, heldCount: 0, notHeldCount: 0, plannedCount: 1, pendingCount: 1, futurePlannedCount: 0, firstPlannedSessionDate: monday },
  groupLinks: [{ classGroup: group }, { classGroup: crossGroup }],
};
const completedOffering = {
  ...offering, id: "offering-2", status: "completed",
  sessionSummary: { totalCount: 2, heldCount: 1, notHeldCount: 1, plannedCount: 0, pendingCount: 0, futurePlannedCount: 0, firstPlannedSessionDate: null },
  subject: { ...subject, id: "subject-2", code: "HP02", name: "Môn hoàn thành" },
};
const lecturer = { id: "lecturer-1", code: "GV01", name: "Nguyễn Văn A", active: true };
const inactiveLecturer = { id: "lecturer-2", code: "GV02", name: "Ngừng dùng", active: false };
const room = { id: "room-1", code: "301", name: "Phòng 301", capacity: 40, isActive: true };
const secondRoom = { id: "room-2", code: "402", name: "Phòng 402", capacity: 50, isActive: true };
const session = {
  id: "session-1", courseOfferingId: offering.id, sessionDate: monday, period: "MORNING", startTime: "08:00:00", endTime: "10:00:00",
  lecturerId: lecturer.id, roomId: room.id, note: "Buổi đầu", status: "planned", courseOffering: offering, lecturer, room,
};
const futureSession = {
  ...session,
  id: "session-future",
  period: "AFTERNOON",
  sessionDate: formatDateKey(addDays(monday, 6)),
  startTime: "20:00:00",
  endTime: "23:59:59",
};

const setupReads = (options = {}) => {
  const { canManage = true, offerings = [offering, completedOffering], sessions = [session], rooms = [room, secondRoom] } = options;
  const pendingSessions = options.pendingSessions ?? sessions.filter((item) => item.status === "planned" && isSessionPast(item));
  axios.get.mockImplementation((url) => {
    if (url.includes("/course-offerings?")) return Promise.resolve({ data: offerings });
    if (url.includes("/unresolved-teaching-sessions")) return options.unresolvedError ? Promise.reject(options.unresolvedError) : Promise.resolve({ data: options.unresolvedSessions ?? sessions.filter((item) => item.status === "planned") });
    if (url.includes("/course-offerings/")) return Promise.resolve({ data: options.offeringDetail ?? offerings[0] });
    if (url.includes("/pending-teaching-sessions")) return Promise.resolve({ data: pendingSessions });
    if (url.includes("/teaching-sessions?")) return Promise.resolve({ data: sessions });
    if (url.includes("/system/lecturers")) return Promise.resolve({ data: [lecturer, inactiveLecturer] });
    if (url.includes("/system/rooms")) return Promise.resolve({ data: rooms });
    if (url.includes("/auth/session")) return Promise.resolve({ data: { authenticated: true, user: { canManageScheduling: canManage } } });
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
};

// Flush React/mocked API updates without retaining an act scope across a timer.
// eslint-disable-next-line testing-library/no-unnecessary-act -- Await the mocked API microtasks triggered by the event, beyond fireEvent's synchronous act.
const clickAndWait = async (element) => { await act(async () => { fireEvent.click(element); }); };
// eslint-disable-next-line testing-library/no-unnecessary-act -- Date changes can trigger asynchronous availability reads.
const changeAndWait = async (element, event) => { await act(async () => { fireEvent.change(element, event); }); };
const chooseTime = async (label, value) => {
  const title = label === "Bắt đầu" ? "CHỌN GIỜ BẮT ĐẦU" : "CHỌN GIỜ KẾT THÚC";
  // Use the dialog's accessible label directly: repeated global role queries walk
  // the entire styled workspace and starve timers in JSDOM on this runner.
  if (!screen.queryByLabelText(title)) await clickAndWait(screen.getByLabelText(label));
  const pickerElement = screen.getByLabelText(title);
  expect(pickerElement).toHaveAttribute("role", "dialog");
  const picker = within(pickerElement);
  const [hour, minute] = value.split(":");
  await clickAndWait(picker.getByLabelText(`Giờ ${hour}`));
  await clickAndWait(picker.getByLabelText(`Phút ${minute}`));
  await clickAndWait(picker.getByText("Xong", { selector: "button" }));
  await waitFor(() => expect(screen.queryByLabelText(title)).not.toBeInTheDocument());
};
const renderSchedule = async (path = `/masters/schedule?offeringId=${offering.id}`) => {
  let result;
  // eslint-disable-next-line testing-library/no-unnecessary-act -- Mount starts several mocked API reads; await their React updates before returning.
  await act(async () => { result = render(<MemoryRouter initialEntries={[path]}><Schedule /></MemoryRouter>); });
  return result;
};
const firstSlot = async (period = "MORNING") => (await screen.findAllByRole("button", { name: new RegExp(`Thêm buổi ${period === "MORNING" ? "Sáng" : "Chiều"} ngày`) }))[0];

const openCreateAndChooseResources = async (period = "MORNING") => {
  await clickAndWait(await firstSlot(period));
  expect(await screen.findByRole("dialog", { name: /XẾP BUỔI/ })).toBeInTheDocument();
  await chooseTime("Bắt đầu", "10:00");
  await chooseTime("Kết thúc", "12:00");
  fireEvent.mouseDown(screen.getByLabelText("Giảng viên"));
  await clickAndWait(await screen.findByRole("option", { name: "GV01 · Nguyễn Văn A" }));
  await clickAndWait(screen.getByRole("button", { name: "Chọn phòng 301" }));
};

// Large MUI workspace queries are slow on the Windows test runner; keep real async completion awaited.
jest.setTimeout(30000);

describe("Masters weekly scheduling workspace", () => {
  const NativeDate = global.Date;

  beforeAll(() => {
    global.Date = class extends NativeDate {
      constructor(...args) {
        super(...(args.length > 0 ? args : ["2026-09-02T05:00:00Z"]));
      }

      static now() {
        return new NativeDate("2026-09-02T05:00:00Z").getTime();
      }
    };
  });

  afterAll(() => {
    global.Date = NativeDate;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    axios.delete.mockResolvedValue({ data: {} });
    axios.post.mockResolvedValue({ data: {} });
    axios.put.mockResolvedValue({ data: {} });
  });

  it("uses workspace mode and keeps the 14-slot calendar neutral until an offering is selected", async () => {
    setupReads();
    const { container } = await renderSchedule("/masters/schedule");
    expect(await screen.findAllByText("HP01 · Học phần thật")).not.toHaveLength(0);
    expect(container.firstChild).toHaveAttribute("data-workspace-mode", "true");
    expect(screen.getByLabelText("Chuyên ngành")).toHaveTextContent("Tất cả chuyên ngành");
    expect(screen.getByLabelText("Khóa / Năm")).toHaveTextContent("Tất cả");
    expect(screen.getByLabelText("Học kỳ")).toHaveTextContent("Tất cả");
    expect(screen.getByTestId("weekly-calendar")).toHaveAttribute("data-selecting", "false");
    expect(screen.queryByRole("button", { name: /Thêm buổi (Sáng|Chiều) ngày/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Chưa có lịch")).toHaveLength(10);
    expect(screen.getAllByText("ĐÃ QUA")).toHaveLength(3);
    expect(screen.getByTestId("schedule-workspace")).toHaveAttribute("data-scheduling-typography", "compact");
  });

  it("renders seven days by two periods and opens the clicked Morning or Afternoon slot", async () => {
    setupReads({ sessions: [] });
    await renderSchedule();
    expect(await screen.findAllByRole("button", { name: /Thêm buổi (Sáng|Chiều) ngày/ })).toHaveLength(10);
    expect(document.querySelectorAll("[data-slot-date]")).toHaveLength(14);
    expect(screen.getAllByText("+ Chọn buổi này")).toHaveLength(10);
    await clickAndWait(await firstSlot("AFTERNOON"));
    expect(await screen.findByRole("dialog", { name: /XẾP BUỔI/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Ngày học")).toHaveValue(today);
    expect(screen.getByLabelText("Buổi")).toHaveTextContent("CHIỀU");
    expect(screen.queryByRole("button", { name: "SÁNG" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "CHIỀU" })).not.toBeInTheDocument();
    const periodLabels = screen.getAllByTestId(/period-label-/);
    expect(periodLabels).toHaveLength(2);
    expect(within(screen.getByTestId("period-label-MORNING")).getByText("SÁNG")).toBeInTheDocument();
    expect(within(screen.getByTestId("period-label-AFTERNOON")).getByText("CHIỀU")).toBeInTheDocument();
    expect(screen.queryByText("AM")).not.toBeInTheDocument();
    expect(screen.queryByText("PM")).not.toBeInTheDocument();
    periodLabels.forEach((label) => expect(label).toHaveStyle({ writingMode: "horizontal-tb", transform: "none" }));
    expect(document.querySelectorAll("[data-day-header]")).toHaveLength(7);
    [...document.querySelectorAll("[data-day-header]")].forEach((header) => expect(header).toHaveStyle({ whiteSpace: "nowrap" }));
  });

  it("submits semantic period together with exact start and end times", async () => {
    setupReads({ sessions: [] });
    await renderSchedule();
    await openCreateAndChooseResources("MORNING");
    expect(screen.getByRole("button", { name: "Chọn phòng 301" }).parentElement).toHaveAttribute("data-room-state", "selected");
    await clickAndWait(screen.getByRole("button", { name: "Lưu lịch" }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/teaching-sessions"), {
      courseOfferingId: offering.id, sessionDate: today, period: "MORNING", startTime: "10:00", endTime: "12:00", lecturerId: lecturer.id, roomId: room.id, note: null,
    }, { withCredentials: true }));
    expect(await screen.findByText("Buổi học đã được tạo.")).toBeInTheDocument();
    expect(document.querySelector("aside .MuiAlert-standardSuccess")).toBeNull();
    expect(document.querySelectorAll(".Toastify__toast-container--top-center")).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole("status", { name: "Đang tải lịch tuần" })).not.toBeInTheDocument());
  });

  it("renders persisted sessions in their semantic period with exact time", async () => {
    setupReads();
    await renderSchedule();
    expect(await screen.findByText("301 · 08:00–10:00")).toBeInTheDocument();
    const morningSlot = document.querySelector(`[data-slot-date="${monday}"][data-period="MORNING"]`);
    expect(within(morningSlot).getByRole("button", { name: "Xem buổi học HP01 08:00" })).toBeInTheDocument();
  });

  it("auto-selects cross-major offerings without narrowing them out", async () => {
    setupReads();
    await renderSchedule();
    const selection = await screen.findByTestId("selected-offering-strip");
    expect(selection).toHaveTextContent("Công nghệ thông tin");
    expect(selection).toHaveTextContent("Kinh tế");
    const majorSelect = screen.getByLabelText("Chuyên ngành");
    expect(majorSelect.parentElement.querySelector("input")).toHaveValue("");
  });

  it("reloads the real date range when navigating weeks", async () => {
    setupReads();
    await renderSchedule();
    await firstSlot();
    const before = axios.get.mock.calls.filter(([url]) => url.includes("/teaching-sessions?")).length;
    await clickAndWait(screen.getByRole("button", { name: "Tuần sau" }));
    await waitFor(() => expect(axios.get.mock.calls.filter(([url]) => url.includes("/teaching-sessions?")).length).toBeGreaterThan(before));
  });

  it.each(["resolve", "reject"])("keeps week B visible when stale week A requests %s after B", async (outcome) => {
    setupReads({ sessions: [], pendingSessions: [] });
    const reads = axios.get.getMockImplementation();
    const requests = [];
    axios.get.mockImplementation((url, config) => {
      if (!url.includes("/teaching-sessions?")) return reads(url, config);
      return new Promise((resolve, reject) => requests.push({ url, resolve, reject }));
    });
    await renderSchedule();
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toContain("from=2026-08-31&to=2026-09-06");
    await clickAndWait(screen.getByRole("button", { name: "Tuần sau" }));
    expect(requests).toHaveLength(2);
    expect(requests[1].url).toContain("from=2026-09-07&to=2026-09-13");
    const weekBSession = { ...session, id: "week-b", sessionDate: "2026-09-07", room: secondRoom };
    await act(async () => { requests[1].resolve({ data: [weekBSession] }); });
    expect(screen.getByText("402 · 08:00–10:00")).toBeInTheDocument();
    await act(async () => {
      if (outcome === "resolve") requests[0].resolve({ data: [session] });
      else requests[0].reject(new Error("Stale week A failed"));
    });
    expect(document.querySelector("[data-day-header]")).toHaveAttribute("data-day-header", "2026-09-07");
    expect(screen.getByText("402 · 08:00–10:00")).toBeInTheDocument();
    expect(screen.queryByText("301 · 08:00–10:00")).not.toBeInTheDocument();
    expect(screen.queryByText("Không thể tải lịch học của tuần.")).not.toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Đang tải lịch tuần" })).not.toBeInTheDocument();
  });

  it("groups rooms by derived floor and enforces capacity states", async () => {
    setupReads({ sessions: [], rooms: [{ ...room, capacity: 20 }, { ...secondRoom, capacity: null }] });
    await renderSchedule();
    await clickAndWait(await firstSlot());
    await chooseTime("Bắt đầu", "09:00");
    await chooseTime("Kết thúc", "10:00");
    expect(screen.getByText("TẦNG 3")).toBeInTheDocument();
    expect(screen.getByText("TẦNG 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Phòng không đủ sức chứa 301" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Phòng chưa có sức chứa 402" })).toBeDisabled();
  });

  it("keeps inactive rooms visible but disabled when the catalog exposes them", async () => {
    setupReads({ sessions: [], pendingSessions: [], rooms: [{ ...room, isActive: false }] });
    await renderSchedule();
    await clickAndWait(await firstSlot());
    await chooseTime("Bắt đầu", "09:00");
    await chooseTime("Kết thúc", "10:00");
    const inactive = screen.getByRole("button", { name: "Phòng ngừng sử dụng 301" });
    expect(inactive).toBeDisabled();
    expect(inactive.parentElement).toHaveAttribute("data-room-state", "inactive");
  });

  it("marks overlapping rooms busy but allows an adjacent exact time", async () => {
    setupReads({ sessions: [{ ...session, sessionDate: today }] });
    await renderSchedule();
    await clickAndWait(await firstSlot());
    await chooseTime("Bắt đầu", "09:00");
    await chooseTime("Kết thúc", "10:30");
    expect(screen.getByRole("button", { name: "Phòng bận 301" })).toBeDisabled();
    await chooseTime("Bắt đầu", "10:00");
    await chooseTime("Kết thúc", "12:00");
    expect(screen.getByRole("button", { name: "Chọn phòng 301" })).toBeEnabled();
  });

  it("disables a Lecturer that overlaps exact time", async () => {
    setupReads({ sessions: [{ ...session, sessionDate: today }] });
    await renderSchedule();
    await clickAndWait(await firstSlot());
    await chooseTime("Bắt đầu", "09:00");
    await chooseTime("Kết thúc", "10:30");
    fireEvent.mouseDown(screen.getByLabelText("Giảng viên"));
    expect(await screen.findByRole("option", { name: /GV01 · Nguyễn Văn A · Đang bận 08:00–10:00/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps global availability even when scope mode hides another program group's session", async () => {
    const otherGroup = { ...group, id: "group-other", academicYear: "2025" };
    const otherOffering = { ...offering, id: "offering-other", subject: { ...subject, code: "HPX" }, groupLinks: [{ classGroup: otherGroup }] };
    const externalSession = { ...session, sessionDate: today, id: "session-other", courseOfferingId: otherOffering.id, courseOffering: otherOffering };
    setupReads({ sessions: [externalSession] });
    await renderSchedule();
    expect(await screen.findByTestId("selected-offering-strip")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Theo phạm vi" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Toàn Viện" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xem buổi học HPX 08:00" })).not.toBeInTheDocument();
    await clickAndWait(await firstSlot());
    await chooseTime("Bắt đầu", "09:00");
    await chooseTime("Kết thúc", "10:30");
    expect(screen.getByRole("button", { name: "Phòng bận 301" })).toBeDisabled();
  });

  it.each([
    ["ROOM_CONFLICT", /Phòng 301 đang được sử dụng/],
    ["LECTURER_CONFLICT", /Giảng viên Nguyễn Văn A đang bận/],
    ["CLASS_GROUP_CONFLICT", /nhóm học viên đã có lịch/],
  ])("keeps the composer open for authoritative %s", async (code, message) => {
    setupReads({ sessions: [] });
    axios.post.mockRejectedValue({ response: { status: 409, data: { code, details: { roomId: room.id, lecturerId: lecturer.id, classGroupIds: [group.id] } } } });
    await renderSchedule();
    await openCreateAndChooseResources();
    await clickAndWait(screen.getByRole("button", { name: "Lưu lịch" }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /XẾP BUỔI/ })).toBeInTheDocument();
    await waitFor(() => expect(axios.get.mock.calls.filter(([url]) => url.includes("/teaching-sessions?")).length).toBe(code === "ROOM_CONFLICT" ? 2 : 1));
  });

  it("updates exact-time sessions with PUT and keeps offering composition immutable", async () => {
    setupReads({ sessions: [futureSession], pendingSessions: [] });
    await renderSchedule();
    await clickAndWait(await screen.findByRole("button", { name: "Xem buổi học HP01 20:00" }));
    await clickAndWait(await screen.findByRole("button", { name: "Chỉnh sửa lịch" }));
    await changeAndWait(screen.getByLabelText("Ghi chú"), { target: { value: "Đã sửa" } });
    await clickAndWait(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining(`/teaching-sessions/${futureSession.id}`), expect.not.objectContaining({ courseOfferingId: expect.anything() }), { withCredentials: true }));
    expect(await screen.findByText("Đã lưu thay đổi lịch.")).toBeInTheDocument();
    expect(document.querySelector("aside .MuiAlert-standardSuccess")).toBeNull();
  });

  it("confirms a pending session and reloads authoritative data", async () => {
    setupReads();
    await renderSchedule();
    await clickAndWait(await screen.findByRole("button", { name: "Xem buổi học HP01 08:00" }));
    await clickAndWait(await screen.findByRole("button", { name: "✓ Đã diễn ra" }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining(`/teaching-sessions/${session.id}/confirmation`), { status: "held" }, { withCredentials: true }));
  });

  it("deletes a planned session only after confirmation", async () => {
    setupReads({ sessions: [futureSession], pendingSessions: [] });
    await renderSchedule();
    await clickAndWait(await screen.findByRole("button", { name: "Xem buổi học HP01 20:00" }));
    await clickAndWait(screen.getByRole("button", { name: "Xóa khỏi lịch" }));
    expect(await screen.findByRole("dialog", { name: "Xóa buổi học khỏi lịch?" })).toBeInTheDocument();
    await clickAndWait(screen.getByRole("button", { name: "Xác nhận xóa" }));
    await waitFor(() => expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining(`/teaching-sessions/${futureSession.id}`), { withCredentials: true }));
    expect(await screen.findByText("Đã xóa buổi học khỏi lịch.")).toBeInTheDocument();
    expect(document.querySelector("aside .MuiAlert-standardSuccess")).toBeNull();
  });

  it("keeps confirmed and completed sessions read-only", async () => {
    const held = { ...session, status: "held" };
    const notHeld = { ...session, id: "session-not-held", period: "AFTERNOON", startTime: "13:00:00", endTime: "15:00:00", status: "not_held" };
    setupReads({ offerings: [completedOffering], sessions: [held, notHeld].map((item) => ({ ...item, courseOfferingId: completedOffering.id, courseOffering: completedOffering })) });
    await renderSchedule(`/masters/schedule?offeringId=${completedOffering.id}`);
    expect(await screen.findByTestId("selected-offering-strip")).toHaveTextContent("CHỈ XEM");
    expect(screen.getByText("✓ ĐÃ DIỄN RA")).toBeInTheDocument();
    expect(screen.getByText("— KHÔNG DIỄN RA")).toBeInTheDocument();
    await clickAndWait(screen.getByRole("button", { name: "Xem buổi học HP02 08:00" }));
    const dialog = await screen.findByRole("dialog", { name: /CHI TIẾT BUỔI HỌC/ });
    expect(within(dialog).queryByRole("button", { name: "Lưu thay đổi" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Xóa khỏi lịch" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "✓ Đã diễn ra" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Không diễn ra" })).not.toBeInTheDocument();
  });

  it("uses distinct persisted and derived session state palettes", async () => {
    const held = { ...session, id: "held", status: "held" };
    const notHeld = { ...session, id: "not-held", period: "AFTERNOON", startTime: "13:00:00", endTime: "15:00:00", status: "not_held" };
    setupReads({ sessions: [session, futureSession, held, notHeld], pendingSessions: [session] });
    await renderSchedule();

    const states = {
      planned: ["rgb(233, 243, 249)", "#91bad5", "#2f7db2"],
      pending: ["rgb(255, 246, 221)", "#dabb68", "#cd8810"],
      held: ["rgb(235, 247, 240)", "#92c7a7", "#35875a"],
      "not-held": ["rgb(255, 244, 244)", "#d9a0a4", "#b4232b"],
    };
    await screen.findByRole("button", { name: "Xem buổi học HP01 20:00" });
    Object.entries(states).forEach(([state, [background, border, accent]]) => {
      const card = document.querySelector(`[data-session-state="${state}"]`);
      expect(card.style.backgroundColor).toBe(background);
      expect(card.style.borderColor).toBe(border);
      expect(card.style.borderLeftColor).toBe(accent);
    });
  });

  it("keeps read-only Staff out of selecting, editing, deletion and confirmation", async () => {
    setupReads({ canManage: false });
    await renderSchedule();
    expect(await screen.findByText(/Quyền chỉ xem/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Thêm buổi (Sáng|Chiều) ngày/ })).not.toBeInTheDocument();
    await clickAndWait(screen.getByRole("button", { name: "Xem buổi học HP01 08:00" }));
    const dialog = await screen.findByRole("dialog", { name: /CHI TIẾT BUỔI HỌC/ });
    expect(within(dialog).queryByRole("button", { name: "Lưu thay đổi" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Xóa khỏi lịch" })).not.toBeInTheDocument();
  });

  it("offers explicit manual completion with no minimum session count in the client", async () => {
    const completable = { ...offering, sessionSummary: { totalCount: 1, heldCount: 1, notHeldCount: 0, plannedCount: 0, pendingCount: 0, futurePlannedCount: 0, firstPlannedSessionDate: null } };
    setupReads({ offerings: [completable], sessions: [], pendingSessions: [] });
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    await renderSchedule();
    await clickAndWait(await screen.findByRole("button", { name: /HP01 · Học phần thật/ }));
    await clickAndWait(await screen.findByRole("button", { name: "Xác nhận hoàn thành giảng dạy" }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining(`/course-offerings/${offering.id}/completion`), {}, { withCredentials: true }));
    confirmSpy.mockRestore();
  });

  it("keeps invalid-time rooms non-available, then lets an available room be selected", async () => {
    setupReads({ sessions: [], pendingSessions: [] });
    await renderSchedule();
    await clickAndWait(await firstSlot());
    await chooseTime("Bắt đầu", "11:00");
    await chooseTime("Kết thúc", "10:00");
    expect(screen.getByText("Chọn giờ bắt đầu và kết thúc để kiểm tra tình trạng phòng.")).toBeInTheDocument();
    expect(screen.queryByText("TRỐNG")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Phòng chờ thời gian 301" })).toBeDisabled();
    await chooseTime("Kết thúc", "12:00");
    const available = screen.getByRole("button", { name: "Chọn phòng 301" });
    expect(available).toBeEnabled();
    await clickAndWait(available);
    expect(available.parentElement).toHaveAttribute("data-room-state", "selected");
  });

  it("exposes exact lifecycle actions for future and past planned sessions", async () => {
    setupReads({ sessions: [session, futureSession], pendingSessions: [session] });
    await renderSchedule();

    await clickAndWait(await screen.findByRole("button", { name: "Xem buổi học HP01 20:00" }));
    let dialog = await screen.findByRole("dialog", { name: /CHI TIẾT BUỔI HỌC/ });
    expect(within(dialog).getByRole("button", { name: "Chỉnh sửa lịch" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Xóa khỏi lịch" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "✓ Đã diễn ra" })).not.toBeInTheDocument();
    await clickAndWait(within(dialog).getByRole("button", { name: "Đóng" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /CHI TIẾT BUỔI HỌC/ })).not.toBeInTheDocument());
    await waitFor(() => expect(document.querySelector("[data-workspace-mode]").parentElement).not.toHaveAttribute("aria-hidden"));

    await clickAndWait(await screen.findByRole("button", { name: "Xem buổi học HP01 08:00" }));
    dialog = await screen.findByRole("dialog", { name: /CHI TIẾT BUỔI HỌC/ });
    expect(within(dialog).queryByRole("button", { name: "Chỉnh sửa lịch" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Xóa khỏi lịch" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "✓ Đã diễn ra" })).toBeInTheDocument();
  });

  it("opens a global pending drawer and reloads authoritative lists after confirmation", async () => {
    setupReads({ sessions: [], pendingSessions: [session] });
    await renderSchedule();
    await clickAndWait(await screen.findByRole("button", { name: "Mở 1 buổi chờ xác nhận" }));
    const drawer = await screen.findByText("Buổi chờ xác nhận · 1");
    await clickAndWait(within(drawer.closest(".MuiDrawer-paper")).getByRole("button", { name: "✓ Đã diễn ra" }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining(`/teaching-sessions/${session.id}/confirmation`), { status: "held" }, { withCredentials: true }));
    await waitFor(() => expect(axios.get.mock.calls.filter(([url]) => url.includes("/pending-teaching-sessions")).length).toBeGreaterThan(1));
  });

  it("opens CourseOffering detail from the whole worklist card while its schedule action selects", async () => {
    setupReads({ sessions: [], pendingSessions: [] });
    await renderSchedule("/masters/schedule");
    const card = await screen.findByRole("button", { name: /HP01 · Học phần thật/ });
    await clickAndWait(card);
    await clickAndWait(await screen.findByRole("button", { name: "Đóng chi tiết lớp học phần" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Đóng chi tiết lớp học phần" })).not.toBeInTheDocument());
    await clickAndWait(within(card).getByRole("button", { name: "Xếp lịch" }));
    expect(await screen.findByTestId("selected-offering-strip")).toHaveTextContent("ĐANG XẾP");
  });

  it("makes past empty dates neutral and neither mouse nor keyboard selectable while today and future stay selectable", async () => {
    const onSlotClick = jest.fn();
    render(<WeeklyCalendar monday={mondayOf(monday)} sessions={[]} selecting onSlotClick={onSlotClick} />);
    const yesterdaySlot = document.querySelector('[data-slot-date="2026-09-01"][data-period="MORNING"]');
    expect(yesterdaySlot).not.toHaveAttribute("role");
    expect(yesterdaySlot).not.toHaveAttribute("tabindex");
    expect(yesterdaySlot).toHaveAttribute("data-past-date", "true");
    expect(yesterdaySlot).toHaveStyle({ cursor: "default", boxShadow: "none", backgroundColor: "#EDF0F2" });
    expect(within(yesterdaySlot).getByText("ĐÃ QUA")).toBeInTheDocument();
    expect(within(yesterdaySlot).getByText("Không có lịch")).toBeInTheDocument();
    expect(within(yesterdaySlot).queryByText("+ Chọn buổi này")).not.toBeInTheDocument();
    await clickAndWait(yesterdaySlot);
    fireEvent.keyDown(yesterdaySlot, { key: "Enter" });
    fireEvent.keyDown(yesterdaySlot, { key: " " });
    expect(onSlotClick).not.toHaveBeenCalled();
    const todaySlot = screen.getByRole("button", { name: "Thêm buổi Sáng ngày 02/09/2026" });
    expect(todaySlot).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(todaySlot, { key: "Enter" });
    expect(onSlotClick).toHaveBeenLastCalledWith(today, "MORNING");
    const futureSlot = screen.getByRole("button", { name: "Thêm buổi Chiều ngày 06/09/2026" });
    expect(within(futureSlot).getByText("+ Chọn buổi này")).toBeInTheDocument();
    await clickAndWait(futureSlot);
    expect(onSlotClick).toHaveBeenLastCalledWith("2026-09-06", "AFTERNOON");
    expect(screen.getByTestId("weekly-calendar")).toHaveAttribute("data-scheduling-typography", "compact");
  });

  it("keeps a historical held card green and viewable without giving its past cell an add action", async () => {
    const held = { ...session, status: "held" };
    const onSlotClick = jest.fn();
    const onSessionClick = jest.fn();
    render(<WeeklyCalendar monday={mondayOf(monday)} sessions={[held]} selecting onSlotClick={onSlotClick} onSessionClick={onSessionClick} />);
    const card = screen.getByRole("button", { name: "Xem buổi học HP01 08:00" });
    expect(card).toHaveAttribute("data-session-state", "held");
    expect(card.style.backgroundColor).toBe("rgb(235, 247, 240)");
    expect(card.parentElement).not.toHaveAttribute("role");
    await clickAndWait(card.parentElement);
    await clickAndWait(card);
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onSessionClick).toHaveBeenCalledWith(held);
    expect(onSlotClick).not.toHaveBeenCalled();
  });

  it("does not mark rooms or lecturers busy for an overlapping not_held session", async () => {
    setupReads({ sessions: [{ ...session, sessionDate: today, status: "not_held" }] });
    await renderSchedule();
    await clickAndWait(await firstSlot());
    await chooseTime("Bắt đầu", "09:00");
    await chooseTime("Kết thúc", "12:00");
    const availableRoom = screen.getByRole("button", { name: "Chọn phòng 301" });
    expect(availableRoom).toBeEnabled();
    expect(availableRoom.parentElement).toHaveAttribute("data-room-state", "available");
    fireEvent.mouseDown(screen.getByLabelText("Giảng viên"));
    expect(await screen.findByRole("option", { name: "GV01 · Nguyễn Văn A" })).not.toHaveAttribute("aria-disabled", "true");
  });

  it.each([
    ["2026-09-01", "12:00"],
    [today, "11:59"],
  ])("rejects the ended Composer target %s %s without calling POST", async (sessionDate, endTime) => {
    setupReads({ sessions: [] });
    await renderSchedule();
    await openCreateAndChooseResources();
    await changeAndWait(screen.getByLabelText("Ngày học"), { target: { value: sessionDate } });
    await chooseTime("Kết thúc", endTime);
    await clickAndWait(screen.getByRole("button", { name: "Lưu lịch" }));
    expect(await screen.findByText("Không thể xếp lịch vào một buổi học đã kết thúc.")).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("preserves the authoritative SESSION_TIME_IN_PAST message and keeps the Composer open", async () => {
    setupReads({ sessions: [] });
    axios.post.mockRejectedValue({ response: { status: 409, data: { code: "SESSION_TIME_IN_PAST", message: "Không thể xếp lịch vào một buổi học đã kết thúc." } } });
    await renderSchedule();
    await openCreateAndChooseResources();
    await clickAndWait(screen.getByRole("button", { name: "Lưu lịch" }));
    expect(await screen.findByText("Không thể xếp lịch vào một buổi học đã kết thúc.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /XẾP BUỔI/ })).toBeInTheDocument();
  });

  it("orders global pending sessions newest first with deterministic end-time/id ties", async () => {
    const pending = [
      { ...session, id: "old", sessionDate: monday },
      { ...session, id: "new-a", sessionDate: today, endTime: "11:00:00" },
      { ...session, id: "middle", sessionDate: "2026-09-01" },
      { ...session, id: "new-b", sessionDate: today, endTime: "11:00:00" },
      { ...session, id: "new-late", sessionDate: today, endTime: "11:30:00" },
    ];
    setupReads({ sessions: [], pendingSessions: pending });
    await renderSchedule();
    await clickAndWait(await screen.findByRole("button", { name: "Mở 5 buổi chờ xác nhận" }));
    const drawer = (await screen.findByText("Buổi chờ xác nhận · 5")).closest(".MuiDrawer-paper");
    expect(within(drawer).getByText("XUYÊN TUẦN · GẦN NHẤT TRƯỚC")).toBeInTheDocument();
    expect([...drawer.querySelectorAll("[data-pending-session-id]")].map((item) => item.dataset.pendingSessionId)).toEqual(["new-late", "new-b", "new-a", "middle", "old"]);
  });

  it("opens all unresolved weeks in two ordered groups and reuses session DETAIL without changing calendar or selection", async () => {
    const unresolved = [
      { ...session, id: "pending-old", sessionDate: "2026-08-10" },
      { ...futureSession, id: "upcoming-far", sessionDate: "2026-10-18" },
      { ...session, id: "held", status: "held" },
      { ...session, id: "pending-new", sessionDate: "2026-08-24" },
      { ...futureSession, id: "upcoming-near", sessionDate: "2026-09-20" },
    ];
    setupReads({ sessions: [], unresolvedSessions: unresolved, pendingSessions: [] });
    await renderSchedule("/masters/schedule");
    await clickAndWait(await screen.findByRole("button", { name: /HP01 · Học phần thật/ }));
    await clickAndWait(await screen.findByRole("button", { name: "Xem các buổi cần xử lý" }));
    const drawer = await screen.findByTestId("unresolved-sessions-drawer");
    expect(await within(drawer).findByText("CHỜ XÁC NHẬN · 2")).toBeInTheDocument();
    expect(within(drawer).getByText("ĐÃ XẾP SẮP TỚI · 2")).toBeInTheDocument();
    expect(within(drawer).getAllByRole("button", { name: /Xem buổi / }).map((item) => item.getAttribute("aria-label"))).toEqual([
      "Xem buổi 24/08/2026 08:00", "Xem buổi 10/08/2026 08:00", "Xem buổi 20/09/2026 20:00", "Xem buổi 18/10/2026 20:00",
    ]);
    expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/course-offerings\/offering-1\/unresolved-teaching-sessions$/), { withCredentials: true });
    expect(screen.queryByTestId("selected-offering-strip")).not.toBeInTheDocument();
    expect(document.querySelector("[data-day-header]")).toHaveAttribute("data-day-header", monday);
    await clickAndWait(within(drawer).getByRole("button", { name: "Xem buổi 24/08/2026 08:00" }));
    const detail = await screen.findByRole("dialog", { name: /CHI TIẾT BUỔI HỌC/ });
    expect(within(detail).getByLabelText("Ngày học")).toHaveValue("2026-08-24");
    expect(within(detail).getByLabelText("Ngày học")).toBeDisabled();
    expect(within(detail).queryByRole("button", { name: "Lưu thay đổi" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("unresolved-sessions-drawer")).not.toBeInTheDocument());
  });

  it("allows read-only Staff to view unresolved sessions without exposing mutations", async () => {
    setupReads({ canManage: false, sessions: [], unresolvedSessions: [session] });
    await renderSchedule("/masters/schedule");
    await clickAndWait(await screen.findByRole("button", { name: /HP01 · Học phần thật/ }));
    await clickAndWait(await screen.findByRole("button", { name: "Xem các buổi cần xử lý" }));
    await clickAndWait(await screen.findByRole("button", { name: "Xem buổi 31/08/2026 08:00" }));
    const detail = await screen.findByRole("dialog", { name: /CHI TIẾT BUỔI HỌC/ });
    expect(within(detail).queryByRole("button", { name: "✓ Đã diễn ra" })).not.toBeInTheDocument();
    expect(within(detail).queryByRole("button", { name: "Chỉnh sửa lịch" })).not.toBeInTheDocument();
    expect(axios.get.mock.calls.some(([url]) => url.includes("/pending-teaching-sessions"))).toBe(false);
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.put).not.toHaveBeenCalled();
  });

  it("shows an empty unresolved list and refreshes just the offering summary when stale", async () => {
    const refreshed = { ...offering, sessionSummary: { plannedCount: 0, heldCount: 1 } };
    setupReads({ sessions: [], unresolvedSessions: [], offeringDetail: refreshed });
    await renderSchedule("/masters/schedule");
    await clickAndWait(await screen.findByRole("button", { name: /HP01 · Học phần thật/ }));
    await clickAndWait(await screen.findByRole("button", { name: "Xem các buổi cần xử lý" }));
    expect(await screen.findByText("Không còn buổi học cần xử lý.")).toBeInTheDocument();
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/course-offerings\/offering-1$/), { withCredentials: true }));
    expect(screen.queryByTestId("selected-offering-strip")).not.toBeInTheDocument();
    expect(axios.get.mock.calls.filter(([url]) => url.includes("/teaching-sessions?")).length).toBe(1);
  });

  it("shows unresolved API errors instead of a fabricated empty list", async () => {
    setupReads({ sessions: [], unresolvedError: { response: { data: { message: "Không thể tải danh sách buổi học." } } } });
    await renderSchedule("/masters/schedule");
    await clickAndWait(await screen.findByRole("button", { name: /HP01 · Học phần thật/ }));
    await clickAndWait(await screen.findByRole("button", { name: "Xem các buổi cần xử lý" }));
    expect(await screen.findByText("Không thể tải danh sách buổi học.")).toBeInTheDocument();
    expect(screen.queryByText("Không còn buổi học cần xử lý.")).not.toBeInTheDocument();
  });

  it("loads global availability for an unresolved future session's own week before editing, without moving the visible calendar", async () => {
    const target = { ...futureSession, sessionDate: "2026-09-17" };
    const busy = { ...target, id: "other-week-global", courseOfferingId: "other-offering", lecturerId: "another-lecturer" };
    setupReads({ sessions: [], unresolvedSessions: [target] });
    const reads = axios.get.getMockImplementation();
    axios.get.mockImplementation((url, config) => url.includes("/teaching-sessions?from=2026-09-14") ? Promise.resolve({ data: [target, busy] }) : reads(url, config));
    await renderSchedule("/masters/schedule");
    await clickAndWait(await screen.findByRole("button", { name: /HP01 · Học phần thật/ }));
    await clickAndWait(await screen.findByRole("button", { name: "Xem các buổi cần xử lý" }));
    await clickAndWait(await screen.findByRole("button", { name: "Xem buổi 17/09/2026 20:00" }));
    await clickAndWait(await screen.findByRole("button", { name: "Chỉnh sửa lịch" }));
    expect(screen.getByRole("button", { name: "Phòng bận 301" })).toBeDisabled();
    expect(screen.getByLabelText("Ngày học")).toHaveAttribute("min", "2026-09-14");
    expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/teaching-sessions\?from=2026-09-14&to=2026-09-20$/), { withCredentials: true });
    expect(document.querySelector("[data-day-header]")).toHaveAttribute("data-day-header", monday);
  });
});

describe("Scheduling compact cards and exact-time composer", () => {
  const renderComposer = (overrides = {}) => {
    const onSubmit = jest.fn();
    const props = { open: true, offering, session: null, lecturers: [lecturer], rooms: [room], sessions: [], canEdit: true, saving: false,
      initialDate: "2999-09-12", initialPeriod: "MORNING", onClose: jest.fn(), onSubmit, ...overrides };
    return { ...render(<SessionComposer {...props} />), onSubmit };
  };

  it("clamps a long calendar title to two lines, shows room/time, and omits lecturer", async () => {
    const longTitle = "Học phần với tiêu đề dài ".repeat(10);
    render(<WeeklyCalendar monday={mondayOf(monday)} sessions={[{ ...session, courseOffering: { ...offering, subject: { ...subject, name: longTitle } } }]} />);
    const card = screen.getByRole("button", { name: "Xem buổi học HP01 08:00" });
    const title = within(card).getByTestId("calendar-subject-title");
    expect(title).toHaveTextContent(longTitle.trim());
    expect(title).toHaveStyle("display: -webkit-box; overflow: hidden; max-height: 2.4em;");
    // JSDOM does not expose prefixed clamp declarations through getComputedStyle.
    // Check the real emitted rule attached to the title's class instead.
    const titleRules = [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules])
      .filter((rule) => [...title.classList].some((className) => rule.selectorText === "." + className || rule.selectorText === "." + className + "." + className))
      .map((rule) => rule.cssText).join("\n");
    expect(titleRules).toMatch(/-webkit-line-clamp:\s*2/);
    expect(titleRules).toMatch(/-webkit-box-orient:\s*vertical/);
    expect(within(card).queryByText(lecturer.name)).not.toBeInTheDocument();
    expect(within(card).getByText("301 · 08:00–10:00")).toBeInTheDocument();
    expect(within(card).getByText("CNTT-26, KT-26")).toHaveStyle("font-size: 10.5px; font-weight: 400; line-height: 1.3;");
  });

  it.each([["MORNING", "SÁNG"], ["AFTERNOON", "CHIỀU"]])("keeps %s read-only for both create and edit", async (period, label) => {
    const { unmount } = renderComposer({ initialPeriod: period });
    expect(screen.getByLabelText("Buổi")).toHaveTextContent(label);
    expect(screen.queryByRole("button", { name: "SÁNG" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "CHIỀU" })).not.toBeInTheDocument();
    unmount();
    renderComposer({ session: { ...futureSession, sessionDate: "2999-09-12", period,
      startTime: period === "MORNING" ? "08:00:00" : "20:00:00", endTime: period === "MORNING" ? "10:00:00" : "22:00:00" } });
    await clickAndWait(screen.getByRole("button", { name: "Chỉnh sửa lịch" }));
    expect(screen.getByLabelText("Buổi")).toHaveTextContent(label);
    expect(screen.queryByRole("button", { name: "SÁNG" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "CHIỀU" })).not.toBeInTheDocument();
  });

  it("starts neutral, has no exact-time input, and shows one required message only after Save", async () => {
    const { onSubmit } = renderComposer();
    expect(screen.getByRole("button", { name: "Bắt đầu" })).toHaveTextContent("Chọn giờ");
    expect(screen.getByRole("button", { name: "Kết thúc" })).toHaveTextContent("Chọn giờ");
    expect(screen.queryByPlaceholderText("HH:mm")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Bắt đầu|Kết thúc/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await clickAndWait(screen.getByRole("button", { name: "Lưu lịch" }));
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Vui lòng chọn giờ bắt đầu và giờ kết thúc.");
    expect(screen.queryByText("Giờ bắt đầu không hợp lệ.")).not.toBeInTheDocument();
    expect(screen.queryByText("Giờ kết thúc không hợp lệ.")).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([["MORNING", 0, 11], ["AFTERNOON", 12, 23]])("offers the %s hour range and all 60 minutes, then auto-opens End", async (period, firstHour, lastHour) => {
    renderComposer({ initialPeriod: period });
    await clickAndWait(screen.getByRole("button", { name: "Bắt đầu" }));
    const picker = within(screen.getByRole("dialog", { name: "CHỌN GIỜ BẮT ĐẦU" }));
    expect(picker.getByText("GIỜ")).toBeInTheDocument();
    expect(picker.getByText("PHÚT")).toBeInTheDocument();
    const hourChoices = within(picker.getByRole("group", { name: "Giờ" })).getAllByRole("button");
    expect(hourChoices.map((button) => button.textContent)).toEqual(Array.from({ length: 12 }, (_, index) => String(firstHour + index).padStart(2, "0")));
    const minuteChoices = within(picker.getByRole("group", { name: "Phút" })).getAllByRole("button");
    expect(minuteChoices.map((button) => button.textContent)).toEqual(Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0")));
    minuteChoices.forEach((button) => expect(button).toBeEnabled());
    expect(picker.getByRole("group", { name: "Giờ" })).toHaveStyle("overflow-y: auto");
    expect(picker.getByRole("group", { name: "Phút" })).toHaveStyle("overflow-y: auto");
    await chooseTime("Bắt đầu", `${String(lastHour).padStart(2, "0")}:29`);
    const endPicker = within(screen.getByRole("dialog", { name: "CHỌN GIỜ KẾT THÚC" }));
    expect(within(endPicker.getByRole("group", { name: "Giờ" })).getAllByRole("button")).toHaveLength(period === "MORNING" ? 13 : 12);
  });

  it("locks morning end at 12:00, accepts arbitrary minutes, and does not reopen End when it already has a value", async () => {
    renderComposer();
    await chooseTime("Bắt đầu", "08:29");
    const picker = within(screen.getByRole("dialog", { name: "CHỌN GIỜ KẾT THÚC" }));
    await clickAndWait(picker.getByLabelText("Phút 37"));
    await clickAndWait(picker.getByLabelText("Giờ 12"));
    expect(picker.getByLabelText("Phút 00")).toHaveAttribute("aria-pressed", "true");
    expect(picker.getByLabelText("Phút 00")).toBeEnabled();
    const lockedMinutes = within(picker.getByRole("group", { name: "Phút" })).getAllByRole("button").slice(1);
    lockedMinutes.forEach((button) => expect(button).toBeDisabled());
    await clickAndWait(picker.getByRole("button", { name: "Xong" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "CHỌN GIỜ KẾT THÚC" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Kết thúc" })).toHaveTextContent("12:00");
    await chooseTime("Bắt đầu", "09:31");
    expect(screen.queryByRole("dialog", { name: "CHỌN GIỜ KẾT THÚC" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bắt đầu" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Lưu lịch" })).toBeEnabled();
  });

  it("keeps availability neutral until valid time and disables Save when End is not after Start", async () => {
    const { onSubmit } = renderComposer({ sessions: [{ ...session, sessionDate: "2999-09-12" }] });
    expect(screen.getByText("Chọn thời gian để kiểm tra giảng viên.")).toBeInTheDocument();
    expect(screen.getByLabelText("Giảng viên")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Chọn giờ bắt đầu và kết thúc để kiểm tra tình trạng phòng.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Phòng chờ thời gian 301" })).toBeDisabled();
    expect(screen.queryByText("ĐÃ DÙNG")).not.toBeInTheDocument();
    expect(screen.queryByText("TRỐNG")).not.toBeInTheDocument();
    await chooseTime("Bắt đầu", "09:00");
    await chooseTime("Kết thúc", "09:00");
    expect(screen.getByRole("alert")).toHaveTextContent("Giờ kết thúc phải sau giờ bắt đầu.");
    expect(screen.getByRole("button", { name: "Lưu lịch" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Phòng chờ thời gian 301" })).toBeDisabled();
    expect(screen.getByLabelText("Giảng viên")).toHaveAttribute("aria-disabled", "true");
    expect(onSubmit).not.toHaveBeenCalled();
    await chooseTime("Kết thúc", "10:00");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Phòng bận 301" })).toBeDisabled();
    expect(screen.getByLabelText("Giảng viên")).not.toHaveAttribute("aria-disabled", "true");
  });

  it("never prefills create from historical latestTimesByPeriod, including invalid afternoon data", () => {
    const withTimes = { ...offering, sessionSummary: { ...offering.sessionSummary, latestTimesByPeriod: {
      AFTERNOON: { sessionId: "persisted-pm", sessionDate: "2026-08-02", startTime: "09:57:00", endTime: "11:59:00" },
    } } };
    renderComposer({ offering: withTimes, initialPeriod: "AFTERNOON" });
    expect(screen.getByLabelText("Bắt đầu")).toHaveTextContent("Chọn giờ");
    expect(screen.getByLabelText("Kết thúc")).toHaveTextContent("Chọn giờ");
    expect(screen.getByLabelText("Buổi")).toHaveTextContent("CHIỀU");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/09:57/)).not.toBeInTheDocument();
  });

  it("preserves historical period, blocks mismatch availability, and allows correction only within that period", async () => {
    const { onSubmit } = renderComposer({ session: { ...session, sessionDate: "2999-09-12", period: "AFTERNOON" } });
    expect(screen.getByLabelText("Buổi")).toHaveTextContent("CHIỀU");
    expect(screen.getByRole("alert")).toHaveTextContent("Dữ liệu hiện tại có giờ học không khớp với buổi Chiều.");
    await clickAndWait(screen.getByRole("button", { name: "Chỉnh sửa lịch" }));
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Phòng chờ thời gian 301" })).toBeDisabled();
    expect(screen.getByLabelText("Giảng viên")).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("button", { name: "SÁNG" })).not.toBeInTheDocument();
    await chooseTime("Bắt đầu", "19:03");
    await chooseTime("Kết thúc", "21:47");
    await clickAndWait(screen.getByRole("button", { name: "Lưu thay đổi" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ period: "AFTERNOON", startTime: "19:03", endTime: "21:47" }));
  });

  it.each(["held", "not_held"])("keeps %s sessions in active offerings read-only", (status) => {
    renderComposer({ session: { ...session, status } });
    expect(screen.getByLabelText("Bắt đầu")).toBeDisabled();
    ["Chỉnh sửa lịch", "Xóa khỏi lịch", "✓ Đã diễn ra", "Không diễn ra", "Lưu thay đổi"].forEach((name) => {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    });
  });
});
