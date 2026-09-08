import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import SessionComposer from "../../components/scheduling/SessionComposer";
import PendingSessionsDrawer from "../../components/scheduling/PendingSessionsDrawer";
import CourseOfferingDrawer from "../../components/scheduling/CourseOfferingDrawer";
import Schedule from "../../pages/masters/schedule";
jest.mock("../../components/FeatureLayout", () => ({ children }) => <main>{children}</main>);
jest.mock("axios", () => ({ delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(), defaults: {}, interceptors: { request: { use: jest.fn() } } }));
const room = { id: "room", code: "P101", name: "Phòng 101", capacity: 40, isActive: true };
const lecturer = { id: "lecturer", code: "GV01", name: "Giảng viên A", active: true };
const offering = { id: "offering", status: "active", subject: { code: "HP01", name: "Học phần", program: "masters" },
  name: "Lớp Cơ sở dữ liệu 2026", plannedUnits: 10, canMerge: false, participantCount: 2, groupLinks: [{ classGroup: { id: "class", code: "A", name: "Lớp A", majorId: "major", major: { id: "major", name: "Ngành" }, academicYear: "2026" } }] };
const session = { id: "lesson", courseOfferingId: "offering", courseOffering: offering, isScheduled: false, status: "planned", sequenceNumber: 1 };
function composer(extra = {}) {
  const props = { open: true, offering, session, rooms: [room], lecturers: [lecturer], sessions: [], canEdit: true, initialDate: "2999-09-12", initialPeriod: "MORNING", onClose: jest.fn(), onSubmit: jest.fn(), ...extra };
  render(<SessionComposer {...props} />); return props;
}
const originalFetch = global.fetch;
beforeEach(() => { jest.clearAllMocks(); global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ message: "admin" }) }); });
afterEach(() => { global.fetch = originalFetch; });
it("allocates a draft using only date and period, with no manual clock controls or clock payload", async () => {
  const p = composer({ session: { ...session, period: "MORNING" } });
  expect(screen.queryByLabelText("Bắt đầu")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Kết thúc")).not.toBeInTheDocument();
  expect(screen.queryByText("Chọn giờ")).not.toBeInTheDocument();
  fireEvent.mouseDown(screen.getByLabelText("Giảng viên"));
  fireEvent.click(screen.getByRole("option", { name: "GV01 · Giảng viên A" }));
  fireEvent.click(screen.getByRole("button", { name: "Chọn phòng P101" }));
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  expect(p.onSubmit).toHaveBeenCalledWith({ sessionDate: "2999-09-12", period: "MORNING", lecturerId: "lecturer", roomId: "room", note: null });
});
it("blocks room and lecturer booked anywhere within the selected day/period", () => {
  composer({ session: { ...session, period: "MORNING" }, sessions: [{ id: "other", sessionDate: "2999-09-12", period: "MORNING", startTime: "11:00", endTime: "12:00", status: "planned", roomId: "room", lecturerId: "lecturer" }] });
  expect(screen.getByRole("button", { name: "Chọn phòng P101" })).toBeDisabled();
  fireEvent.mouseDown(screen.getByLabelText("Giảng viên"));
  expect(screen.getByRole("option", { name: /Đang bận/ })).toHaveAttribute("aria-disabled", "true");
});
it("does not block the other period or a session marked not held", () => {
  composer({ session: { ...session, period: "MORNING" }, sessions: [
    { id: "other", sessionDate: "2999-09-12", period: "AFTERNOON", status: "planned", roomId: "room" },
    { id: "cancelled", sessionDate: "2999-09-12", period: "MORNING", status: "not_held", roomId: "room" },
  ] });
  expect(screen.getByRole("button", { name: "Chọn phòng P101" })).not.toBeDisabled();
});
it("requests availability on date changes and waits before saving", () => {
  const onDateChange = jest.fn(); composer({ onDateChange, availabilityLoading: true });
  fireEvent.change(screen.getByLabelText("Ngày học"), { target: { value: "2999-09-20" } });
  expect(onDateChange).toHaveBeenCalledWith("2999-09-20");
  expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
});
it("keeps a viewer unable to modify a draft", () => {
  composer({ canEdit: false });
  expect(screen.getByLabelText("Ngày học")).toBeDisabled();
  expect(screen.getByLabelText("Buổi học")).toHaveAttribute("aria-disabled", "true");
  expect(screen.queryByRole("button", { name: "Lưu thay đổi" })).not.toBeInTheDocument();
});
it("renders the schedule without semester or completion controls", async () => {
  axios.get.mockImplementation(async (url) => {
    if (url.includes("/auth/session")) return { data: { user: { canManageScheduling: true } } };
    if (url.includes("/system/rooms")) return { data: [room] };
    if (url.includes("/system/lecturers")) return { data: [lecturer] };
    if (url.includes("/course-offerings?")) return { data: [offering] };
    return { data: [] };
  });
  render(<MemoryRouter><Schedule /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText("PHẠM VI LÀM VIỆC")).toBeInTheDocument());
  expect(screen.queryByLabelText("Học kỳ")).not.toBeInTheDocument();
  expect(screen.queryByText(/HOÀN THÀNH|Hoàn tất|KẾ HOẠCH KHAI MÔN/)).not.toBeInTheDocument();
  expect(await screen.findByText("Lớp Cơ sở dữ liệu 2026")).toBeInTheDocument();
});

it("adds four independent sessions across weeks despite legacy units, completed status and canMerge false", async () => {
  const persisted = [];
  const current = { ...offering, status: "completed", sessionSummary: { totalCount: 0 } };
  axios.get.mockImplementation(async (url) => {
    if (url.includes("/auth/session")) return { data: { user: { canManageScheduling: true } } };
    if (url.includes("/system/rooms")) return { data: [room] };
    if (url.includes("/system/lecturers")) return { data: [lecturer] };
    if (url.includes("/course-offerings?")) return { data: [{ ...current, sessionSummary: { totalCount: persisted.length } }] };
    if (url.includes("/teaching-sessions?")) {
      const query = new URL(url, "http://localhost").searchParams;
      return { data: persisted.filter((s) => s.sessionDate >= query.get("from") && s.sessionDate <= query.get("to")) };
    }
    return { data: [] };
  });
  axios.post.mockImplementation(async (_url, payload) => {
    const row = { ...payload, id: "saved-" + (persisted.length + 1), status: "planned", isScheduled: true, courseOffering: current, room, lecturer };
    persisted.push(row); return { data: row };
  });
  const view = render(<MemoryRouter initialEntries={["/masters/schedule?offeringId=offering"]}><Schedule /></MemoryRouter>);
  await waitFor(() => expect(screen.getByTestId("weekly-calendar")).toHaveAttribute("data-selecting", "true"));
  fireEvent.click(screen.getByLabelText("Tuần sau"));
  await waitFor(() => expect(screen.queryByLabelText("Đang tải lịch tuần")).not.toBeInTheDocument());
  let firstWeek;
  for (let index = 0; index < 4; index++) {
    if (index === 2) {
      firstWeek = view.container.querySelector("[data-slot-date]").getAttribute("data-slot-date");
      fireEvent.click(screen.getByLabelText("Tuần sau"));
      await waitFor(() => expect(view.container.querySelector("[data-slot-date]")).not.toHaveAttribute("data-slot-date", firstWeek));
      await waitFor(() => expect(screen.queryByLabelText("Đang tải lịch tuần")).not.toBeInTheDocument());
    }
    const cells = [...view.container.querySelectorAll('[data-slot-date][data-period="' + (index % 2 ? "AFTERNOON" : "MORNING") + '"]')];
    fireEvent.click(cells[index % 2]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByLabelText("Ngày học")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Đổi ngày / buổi" }));
    expect(within(dialog).getByLabelText("Ngày học")).toBeEnabled();
    fireEvent.mouseDown(within(dialog).getByLabelText("Giảng viên"));
    fireEvent.click(screen.getByRole("option", { name: "GV01 · Giảng viên A" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Chọn phòng P101" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu lịch" }));
    await waitFor(() => expect(persisted).toHaveLength(index + 1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  }
  expect(new Set(persisted.map((s) => s.sessionDate)).size).toBe(4);
  expect(axios.post).toHaveBeenCalledTimes(4);
  for (const [, payload] of axios.post.mock.calls) {
    expect(payload).not.toHaveProperty("startTime");
    expect(payload).not.toHaveProperty("endTime");
    expect(payload).not.toHaveProperty("plannedUnits");
  }
  expect(screen.getByText("Đã diễn ra 0 buổi")).toBeInTheDocument();
  expect(screen.queryByText(/đủ buổi|đủ tiết|Phân buổi|Hoàn thành|Hoàn tất/)).not.toBeInTheDocument();
});

it("shows only the two confirmation actions and orders afternoon before morning", () => {
  const confirm = jest.fn();
  const rows = ["MORNING", "AFTERNOON"].map((period) => ({ ...session, id: period, courseOffering: offering, sessionDate: "2026-09-01", period, room, lecturer }));
  render(<PendingSessionsDrawer open sessions={rows} onClose={jest.fn()} onConfirm={confirm} />);
  const cards = [...document.querySelectorAll("[data-pending-session-id]")];
  expect(cards[0]).toHaveAttribute("data-pending-session-id", "AFTERNOON");
  expect(within(cards[0]).getAllByRole("button")).toHaveLength(2);
  expect(screen.queryByText("Xem chi tiết")).not.toBeInTheDocument();
  fireEvent.click(within(cards[0]).getByRole("button", { name: "✓ Đã diễn ra" }));
  fireEvent.click(within(cards[1]).getByRole("button", { name: "Không diễn ra" }));
  expect(confirm.mock.calls.map(([s, status]) => [s.id, status])).toEqual([["AFTERNOON", "held"], ["MORNING", "not_held"]]);
});

it("keeps held, pending and future counters distinct and shows actual source membership", async () => {
  axios.get.mockResolvedValue({ data: { memberCount: 2 } });
  const onSchedule = jest.fn();
  render(<CourseOfferingDrawer open offering={{ ...offering, sessionSummary: { totalCount: 5, heldCount: 2, pendingCount: 1, futurePlannedCount: 1, notHeldCount: 1 } }} canManage onClose={jest.fn()} onSchedule={onSchedule} />);
  await screen.findByText(/Ngành.*2 học viên/);
  expect(document.querySelector('[data-counter="Đã diễn ra"]')).toHaveTextContent("2");
  expect(document.querySelector('[data-counter="Chờ xác nhận"]')).toHaveTextContent("1");
  expect(document.querySelector('[data-counter="Đã xếp sắp tới"]')).toHaveTextContent("1");
  expect(screen.queryByText(/Hoàn thành|Hoàn tất/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Xếp lịch / Xếp thêm" }));
  expect(onSchedule).toHaveBeenCalled();
});

it("uses the offering summary when a session response omits it", () => {
  composer({ offering: { ...offering, sessionSummary: { heldCount: 3 } } });
  expect(screen.getByText("Đã diễn ra 3 buổi")).toBeInTheDocument();
});
it("does not show archived subjects in the pending queue or calendar", async () => {
  const archived = { ...session, isScheduled: true, courseOffering: { ...offering, name: "Archived class", subject: { ...offering.subject, active: false } } };
  axios.get.mockImplementation(async (url) => {
    if (url.includes("/auth/session")) return { data: { user: { canManageScheduling: true } } };
    if (url.includes("/course-offerings?")) return { data: [offering] };
    if (url.includes("/teaching-sessions?") || url.includes("/pending-teaching-sessions")) return { data: [archived] };
    return { data: [] };
  });
  render(<MemoryRouter><Schedule /></MemoryRouter>);
  await screen.findByText(offering.name);
  expect(screen.queryByText(/Archived class/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /1 chờ xác nhận/ })).not.toBeInTheDocument();
});
