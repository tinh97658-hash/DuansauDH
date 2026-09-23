import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import Schedule from "../../pages/masters/schedule";
import ScheduleView from "../../features/scheduling/Schedule";
import SessionEditor from "../../features/scheduling/SessionEditor";
import OfferingDetails from "../../features/scheduling/OfferingDetails";
import { addDays, formatDateKey, getBusinessTodayKey, mondayOf, vietnameseDate } from "../../utils/schedulingCalendar";

jest.mock("axios");
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });
const offering = { id: "offering", subject: { id: "s", code: "HP01", name: "Khai thác cảng" }, status: "active", participantCount: 20,
  groupLinks: [{ classGroupId: "g", classGroup: { id: "g", code: "KTHH-2026", majorId: "m", academicYear: "2026", allowedWeekdays: [1, 2, 3, 4, 5, 6, 0] } }], sessionSummary: { heldCount: 2 } };
const rooms = [{ id: "r", code: "301", capacity: 40, isActive: true }, { id: "small", code: "302", capacity: 5, isActive: true }];
const lecturers = [{ id: "l", name: "Nguyễn Bình", active: true }];
beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockImplementation(async (url) => ({ data: url.endsWith("/auth/session") ? { user: { canManageScheduling: true } } : url.includes("/course-offerings?") ? [offering] : url.endsWith("/course-offerings/offering") ? offering : url.includes("/lecturers") ? lecturers : url.includes("/rooms") ? rooms : url.endsWith("/roster") ? { participants: [{ id: "student:one", code: "HV001", fullName: "Nguyễn An", note: "" }] } : [] }));
  axios.post.mockResolvedValue({ data: {} }); axios.put.mockResolvedValue({ data: {} }); axios.delete.mockResolvedValue({ data: {} });
});
it("shows the seven-day calendar and selects a persisted offering for scheduling", async () => {
  render(<MemoryRouter><Schedule /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Xếp lịch" }));
  expect(screen.getByText("ĐANG XẾP")).toBeInTheDocument();
  expect(screen.getByRole("table", { name: "Lịch học theo tuần" })).toBeInTheDocument();
  expect(screen.getByText("CN")).toBeInTheDocument();
  expect(screen.getByLabelText("Hôm nay")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: /^Xếp (Sáng|Chiều)/ }).length).toBeGreaterThan(0);
  const currentWeekButton = screen.getByRole("button", { name: "Tuần này" });
  expect(currentWeekButton).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Tuần trước" }));
  expect(currentWeekButton).toBeEnabled();
  fireEvent.click(currentWeekButton);
  expect(currentWeekButton).toBeDisabled();
});
it("collapses the work-scope sidebar without clearing its filters and restores the controls", async () => {
  render(<MemoryRouter><ScheduleView user={{ canManageScheduling: true }} /></MemoryRouter>);
  const major = await screen.findByLabelText("Chuyên ngành");
  const search = screen.getByLabelText("Tìm môn / lớp");
  fireEvent.change(search, { target: { value: "Khai thác" } });

  const collapse = screen.getByRole("button", { name: "Thu gọn phạm vi làm việc" });
  const workspace = screen.getByRole("region", { name: "Không gian xếp lịch" });
  const sidebar = screen.getByRole("complementary");
  fireEvent.click(collapse);
  expect(workspace).toHaveClass("sl-sidebar-collapsed");
  expect(sidebar).toHaveAttribute("data-collapsed", "true");
  expect(screen.getByRole("button", { name: "Mở phạm vi làm việc" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Mở phạm vi làm việc" })).toHaveAttribute("aria-expanded", "false");

  fireEvent.click(screen.getByRole("button", { name: "Mở phạm vi làm việc" }));
  expect(workspace).not.toHaveClass("sl-sidebar-collapsed");
  expect(sidebar).toHaveAttribute("data-collapsed", "false");
  expect(major).toBeInTheDocument();
  expect(search).toHaveValue("Khai thác");
  expect(axios.get.mock.calls.filter(([url]) => url.includes("/course-offerings?"))).toHaveLength(1);
});
it("keeps Day Focus and its weekday while navigating weeks until the explicit week-view action", async () => {
  const currentMonday = mondayOf(getBusinessTodayKey());
  const fridayDate = formatDateKey(addDays(currentMonday, 4));
  const originalFocus = `Lịch ngày ${vietnameseDate(fridayDate)}`;
  const nextFridayFocus = `Lịch ngày ${vietnameseDate(formatDateKey(addDays(currentMonday, 11)))}`;
  const futureFridayDate = formatDateKey(addDays(currentMonday, 18));
  const futureFridayFocus = `Lịch ngày ${vietnameseDate(futureFridayDate)}`;
  render(<MemoryRouter><ScheduleView user={{ canManageScheduling: true }} /></MemoryRouter>);
  await screen.findByRole("table", { name: "Lịch học theo tuần" });

  const friday = screen.getAllByRole("button", { name: /Xem lịch .*: 0 lớp/ })[4];
  fireEvent.click(friday);
  expect(screen.getByRole("region", { name: originalFocus })).toBeInTheDocument();
  expect(screen.getByText(/^T6 · .* · 0 lớp$/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Tuần sau" }));
  await screen.findByRole("region", { name: nextFridayFocus });
  expect(screen.getByText(/^T6 · .* · 0 lớp$/)).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "SÁNG · 0 lớp" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "CHIỀU · 0 lớp" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Tuần trước" }));
  await waitFor(() => expect(screen.getByRole("region", { name: originalFocus })).toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: "Tuần trước" }));
  fireEvent.click(screen.getByRole("button", { name: "Tuần này" }));
  await waitFor(() => expect(screen.getByRole("region", { name: originalFocus })).toBeInTheDocument());
  expect(screen.getByText(/^T6 · .* · 0 lớp$/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Tuần sau" }));
  await screen.findByRole("region", { name: nextFridayFocus });
  fireEvent.click(screen.getByRole("button", { name: "Tuần sau" }));
  await screen.findByRole("region", { name: futureFridayFocus });
  fireEvent.click(screen.getByRole("button", { name: "← Tuần" }));

  expect(screen.getByRole("table", { name: "Lịch học theo tuần" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: `Xem lịch ${vietnameseDate(futureFridayDate)}: 0 lớp` })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: /Lịch ngày/ })).not.toBeInTheDocument();
});
it("summarizes a busy day in the week and exposes every session in day focus", async () => {
  let busyDate = "";
  axios.get.mockImplementation(async (url) => {
    if (url.includes("/course-offerings?")) return { data: [offering] };
    if (url.includes("/teaching-sessions?")) {
      const query = new URLSearchParams(url.split("?")[1]);
      if (query.get("from") === query.get("to")) return { data: [] };
      busyDate = query.get("from");
      const makeSession = (index, period) => ({
        id: `busy-${index}`,
        courseOfferingId: offering.id,
        courseOffering: { ...offering, name: index === 1 ? "Lớp buổi 1 với tên rất dài cần được rút gọn nhưng vẫn truy cập đầy đủ" : `Lớp buổi ${index}` },
        sessionDate: busyDate,
        period,
        status: index === 1 || index === 6 ? "held" : index === 2 || index === 7 ? "not_held" : "planned",
        startTime: period === "MORNING" ? "08:00:00" : "13:00:00",
        endTime: period === "MORNING" ? "11:00:00" : "17:00:00",
        lecturer: lecturers[0],
        room: rooms[0],
      });
      return { data: [
        ...Array.from({ length: 5 }, (_, index) => makeSession(index + 1, "MORNING")),
        ...Array.from({ length: 2 }, (_, index) => makeSession(index + 6, "AFTERNOON")),
      ] };
    }
    return { data: [] };
  });

  render(<MemoryRouter><ScheduleView user={{ canManageScheduling: true }} /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Tuần trước" }));
  const busyDay = await screen.findByRole("button", { name: /Xem lịch .*: 7 lớp/ });
  expect(screen.getByRole("button", { name: /Xem thêm 2 lớp ngày/ })).toHaveTextContent("+2 lớp");
  expect(screen.getAllByRole("button", { name: /Lớp buổi/ })).toHaveLength(5);
  expect(screen.queryByText(/08:00|11:00|13:00|17:00/)).not.toBeInTheDocument();

  fireEvent.click(busyDay);
  const focus = screen.getByRole("region", { name: /Lịch ngày/ });
  const morning = within(focus).getByRole("region", { name: "SÁNG · 5 lớp" });
  const afternoon = within(focus).getByRole("region", { name: "CHIỀU · 2 lớp" });
  expect(within(morning).getByRole("region", { name: "ĐÃ XẾP · 3 lớp" })).toHaveTextContent("3");
  expect(within(morning).getByRole("region", { name: "ĐÃ DIỄN RA · 1 lớp" })).toHaveTextContent("1");
  expect(within(morning).getByRole("region", { name: "KHÔNG DIỄN RA · 1 lớp" })).toHaveTextContent("1");
  expect(within(afternoon).getByRole("region", { name: "ĐÃ XẾP · 0 lớp" })).toHaveTextContent("0");
  expect(within(afternoon).getByRole("region", { name: "ĐÃ DIỄN RA · 1 lớp" })).toHaveTextContent("1");
  expect(within(afternoon).getByRole("region", { name: "KHÔNG DIỄN RA · 1 lớp" })).toHaveTextContent("1");
  expect(within(focus).getAllByRole("button", { name: /Lớp buổi/ })).toHaveLength(7);
  expect(within(focus).queryByRole("region", { name: /CHỜ XÁC NHẬN/ })).not.toBeInTheDocument();
  const longLabelCard = within(focus).getByRole("button", { name: /Lớp buổi 1 với tên rất dài/ });
  const longLabel = within(focus).getByTitle("Lớp buổi 1 với tên rất dài cần được rút gọn nhưng vẫn truy cập đầy đủ");
  expect(longLabel).toHaveTextContent("Lớp buổi 1 với tên rất dài cần được rút gọn nhưng vẫn truy cập đầy đủ");
  expect(longLabelCard).toHaveClass("sl-focus-session");
  expect(within(morning).getByRole("region", { name: "ĐÃ DIỄN RA · 1 lớp" })).toContainElement(longLabelCard);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

  fireEvent.click(within(focus).getByRole("button", { name: /Lớp buổi 7/ }));
  expect(screen.getByRole("dialog")).toHaveTextContent("CHI TIẾT BUỔI HỌC");
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Đóng chi tiết buổi học" }));
  fireEvent.click(screen.getByRole("button", { name: "← Tuần" }));
  expect(screen.getByRole("table", { name: "Lịch học theo tuần" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: new RegExp(`Xem lịch .*: 7 lớp`) }));
  fireEvent.click(screen.getByRole("button", { name: "Tuần sau" }));
  expect(await screen.findByRole("region", { name: /Lịch ngày/ })).toBeInTheDocument();
  expect(screen.queryByRole("table", { name: "Lịch học theo tuần" })).not.toBeInTheDocument();
  expect(busyDate).not.toBe("");
});
it("magnifies a scheduled class on hover or keyboard focus without opening it", async () => {
  axios.get.mockImplementation(async (url) => {
    if (url.includes("/course-offerings?")) return { data: [offering] };
    if (url.includes("/teaching-sessions?")) {
      const date = new URLSearchParams(url.split("?")[1]).get("from");
      return { data: [{
        id: "magnified-session",
        courseOfferingId: offering.id,
        courseOffering: { ...offering, name: "Lớp chuyên đề cần xem rõ" },
        sessionDate: date,
        period: "MORNING",
        status: "held",
        startTime: "08:00:00",
        endTime: "11:00:00",
        lecturer: lecturers[0],
        room: rooms[0],
      }] };
    }
    return { data: [] };
  });

  render(<MemoryRouter><ScheduleView user={{ canManageScheduling: true }} /></MemoryRouter>);
  const card = await screen.findByRole("button", { name: /Lớp chuyên đề cần xem rõ/ });
  fireEvent.mouseEnter(card);

  const magnifier = await screen.findByRole("tooltip");
  expect(magnifier).toHaveTextContent("XEM NHANH LỚP HỌC");
  expect(magnifier).toHaveTextContent("Lớp chuyên đề cần xem rõ");
  expect(magnifier).toHaveTextContent("Nguyễn Bình");
  expect(magnifier).toHaveTextContent("301");
  expect(magnifier).toHaveTextContent("08:00–11:00");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

  fireEvent.mouseLeave(card);
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  fireEvent.focus(card);
  expect(screen.getByRole("tooltip")).toBeInTheDocument();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});
it("keeps future planned sessions in the primary scheduled lane", async () => {
  let initialWeek = "";
  axios.get.mockImplementation(async (url) => {
    if (url.includes("/course-offerings?")) return { data: [offering] };
    if (url.includes("/teaching-sessions?")) {
      const query = new URLSearchParams(url.split("?")[1]);
      if (query.get("from") === query.get("to")) return { data: [] };
      if (!initialWeek) { initialWeek = query.get("from"); return { data: [] }; }
      const date = query.get("from");
      return { data: [{
        id: "future-planned",
        courseOfferingId: offering.id,
        courseOffering: { ...offering, name: "Lớp tương lai" },
        sessionDate: date,
        period: "MORNING",
        status: "planned",
        startTime: "08:00:00",
        endTime: "11:00:00",
        lecturer: lecturers[0],
        room: rooms[0],
      }] };
    }
    return { data: [] };
  });

  render(<MemoryRouter><ScheduleView user={{ canManageScheduling: true }} /></MemoryRouter>);
  await screen.findByRole("table", { name: "Lịch học theo tuần" });
  fireEvent.click(screen.getByRole("button", { name: "Tuần sau" }));
  fireEvent.click(await screen.findByRole("button", { name: /Xem lịch .*: 1 lớp/ }));

  const morning = screen.getByRole("region", { name: "SÁNG · 1 lớp" });
  const planned = within(morning).getByRole("region", { name: "ĐÃ XẾP · 1 lớp" });
  expect(within(planned).getByRole("button", { name: /Lớp tương lai/ })).toBeInTheDocument();
  expect(within(morning).getByLabelText("Trạng thái SÁNG")).toBeInTheDocument();
  expect(within(morning).getByRole("region", { name: "ĐÃ DIỄN RA · 0 lớp" })).toBeInTheDocument();
  expect(within(morning).getByRole("region", { name: "KHÔNG DIỄN RA · 0 lớp" })).toBeInTheDocument();
  expect(within(morning).queryByRole("region", { name: /CHỜ XÁC NHẬN/ })).not.toBeInTheDocument();
  expect(within(morning).getAllByRole("button", { name: /Lớp tương lai/ })).toHaveLength(1);
});
it("shows all pending confirmations independently of the displayed week and sorts oldest first", async () => {
  const pendingSessions = [
    { id: "newer", sessionDate: "2026-09-12", endTime: "12:00:00", period: "MORNING", courseOffering: { ...offering, name: "Lớp mới hơn" }, lecturer: { name: "Giảng viên B" }, room: { code: "P.202" } },
    { id: "older", sessionDate: "2026-09-02", endTime: "17:00:00", period: "AFTERNOON", courseOffering: { ...offering, name: "Lớp cũ hơn" }, lecturer: { name: "Giảng viên A" }, room: { code: "P.201" } },
  ];
  axios.get.mockImplementation(async (url) => ({ data: url.includes("/course-offerings?") ? [offering] : url.includes("/pending-teaching-sessions") ? pendingSessions : [] }));

  render(<MemoryRouter><ScheduleView user={{ canManageScheduling: true }} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "2 chờ xác nhận" }));

  const dialog = screen.getByRole("dialog", { name: "BUỔI CHỜ XÁC NHẬN · 2" });
  const cards = within(dialog).getAllByRole("article");
  expect(cards[0]).toHaveTextContent("02/09/2026");
  expect(cards[0]).toHaveTextContent("Lớp cũ hơn");
  expect(cards[1]).toHaveTextContent("12/09/2026");
  expect(cards[1]).toHaveTextContent("Lớp mới hơn");
  expect(within(dialog).getAllByRole("button", { name: "Không diễn ra" })).toHaveLength(2);
  expect(within(dialog).getAllByRole("button", { name: "✓ Đã diễn ra" })).toHaveLength(2);
  expect(axios.get).toHaveBeenCalledWith("/api/scheduling/pending-teaching-sessions", { withCredentials: true });
});
it("loads institute availability and excludes busy and undersized rooms before saving", async () => {
  const saved = jest.fn();
  render(<SessionEditor offering={offering} date="2099-01-05" period="MORNING" user={{ canManageScheduling: true }} onClose={jest.fn()} onSaved={saved} />);
  expect(screen.getByRole("dialog")).toHaveClass("v20-wide");
  expect(screen.getByRole("dialog")).not.toHaveClass("v20-drawer");
  expect(screen.queryByLabelText("Bắt đầu")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Kết thúc")).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText("Giảng viên")).toBeEnabled());
  await waitFor(() => expect(screen.getByRole("button", { name: /301.*40 chỗ/ })).toBeEnabled());
  expect(screen.getByRole("button", { name: /302.*5 chỗ/ })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Giảng viên"), { target: { value: "l" } });
  const selectedRoom = screen.getByRole("button", { name: /301.*40 chỗ/ });
  fireEvent.click(selectedRoom);
  expect(selectedRoom).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByText(/Phòng đã chọn:/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Lưu buổi học" }));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/teaching-sessions"), expect.objectContaining({ courseOfferingId: "offering", sessionDate: "2099-01-05", period: "MORNING", roomId: "r", lecturerId: "l", startTime: "07:00", endTime: "12:00" }), { withCredentials: true });
});
it("updates the automatic time range and lecturer conflicts when changing period", async () => {
  axios.get.mockImplementation(async (url) => ({ data: url.includes("/lecturers") ? lecturers : url.includes("/rooms") ? rooms : url.includes("/teaching-sessions?") ? [
    { id: "busy", lecturerId: "l", roomId: "r", period: "MORNING", startTime: "00:00:00", endTime: "00:01:00", status: "planned" },
    { id: "not-held", lecturerId: "l", roomId: "r", period: "AFTERNOON", startTime: "13:00:00", endTime: "17:00:00", status: "not_held" },
  ] : offering }));
  render(<SessionEditor offering={offering} date="2099-01-05" period="MORNING" user={{ canManageScheduling: true }} onClose={jest.fn()} onSaved={jest.fn()} />);
  expect(await screen.findByRole("option", { name: "Nguyễn Bình · Đang bận" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Buổi"), { target: { value: "AFTERNOON" } });
  expect(screen.getByText("Khung giờ buổi học: 13:00–17:00")).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Nguyễn Bình" })).toBeEnabled();
  expect(screen.getByRole("button", { name: /301.*40 chỗ/ })).toBeEnabled();
});
it("suppresses occupied date-period slots from complete week data while preserving create and detail flows", async () => {
  const addDate = (date, days) => {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  };
  const sharedOutsideScope = { id: "g-shared", code: "KTHH-2025", majorId: "m", academicYear: "2025", allowedWeekdays: [1, 2, 3, 4, 5, 6, 0] };
  const selectedOffering = {
    ...offering,
    id: "selected",
    name: "Lớp đã chọn",
    groupLinks: [
      ...offering.groupLinks,
      { classGroupId: sharedOutsideScope.id, classGroup: sharedOutsideScope },
    ],
  };
  const outsideOffering = {
    ...offering,
    id: "outside",
    name: "Lớp ngoài phạm vi",
    groupLinks: [{ classGroupId: sharedOutsideScope.id, classGroup: sharedOutsideScope }],
  };
  let weekDates = [];
  axios.get.mockImplementation(async (url) => {
    if (url.includes("/course-offerings?")) return { data: [selectedOffering, outsideOffering] };
    if (url.includes("/majors")) return { data: [] };
    if (url.includes("/pending-teaching-sessions")) return { data: [] };
    if (url.endsWith("/course-offerings/selected")) return { data: selectedOffering };
    if (url.includes("/lecturers")) return { data: lecturers };
    if (url.includes("/rooms")) return { data: rooms };
    if (url.includes("/teaching-sessions?")) {
      const query = new URLSearchParams(url.split("?")[1]);
      const from = query.get("from");
      const to = query.get("to");
      if (from === to) return { data: [] };
      weekDates = Array.from({ length: 7 }, (_, index) => addDate(from, index));
      const makeSession = (id, courseOffering, day, period = "MORNING", status = "planned") => ({
        id, courseOfferingId: courseOffering.id, courseOffering,
        sessionDate: weekDates[day], period, status,
        startTime: period === "MORNING" ? "08:00:00" : "13:00:00",
        endTime: period === "MORNING" ? "09:00:00" : "14:00:00",
        lecturerId: "l", roomId: "r", lecturer: lecturers[0], room: rooms[0],
      });
      return { data: [
        makeSession("same-offering", selectedOffering, 0),
        makeSession("shared-group-outside-scope", outsideOffering, 1),
        makeSession("not-held", selectedOffering, 2, "MORNING", "not_held"),
        makeSession("other-period", selectedOffering, 3, "MORNING"),
      ] };
    }
    return { data: [] };
  });

  render(<MemoryRouter><ScheduleView user={{ canManageScheduling: true }} /></MemoryRouter>);
  await screen.findByRole("option", { name: "2026" });
  fireEvent.change(screen.getByLabelText("Khóa / Năm"), { target: { value: "2026" } });
  await waitFor(() => expect(screen.queryByText("Lớp ngoài phạm vi")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Xếp lịch" }));
  fireEvent.click(screen.getByRole("button", { name: "Tuần sau" }));
  await waitFor(() => expect(screen.getAllByRole("button", { name: /Lớp đã chọn.*(ĐÃ XẾP|KHÔNG DIỄN RA)/ })).toHaveLength(3));

  expect(screen.queryByText("Lớp ngoài phạm vi")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: `Xếp Sáng ${weekDates[0]}` })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: `Xếp Sáng ${weekDates[1]}` })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: `Xếp Sáng ${weekDates[2]}` })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: `Xếp Sáng ${weekDates[3]}` })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: `Xếp Chiều ${weekDates[3]}` })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: `Xếp Sáng ${weekDates[4]}` }));
  let dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent("XẾP BUỔI");
  fireEvent.click(within(dialog).getByRole("button", { name: "Đóng chi tiết buổi học" }));

  fireEvent.click(screen.getAllByRole("button", { name: /Lớp đã chọn.*ĐÃ XẾP/ })[0]);
  dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent("CHI TIẾT BUỔI HỌC");
});

it("retains the editor and reports a server conflict instead of claiming success", async () => {
  const saved = jest.fn(); axios.put.mockRejectedValue({ response: { status: 409, data: { message: "Phòng học đã có lịch" } } });
  const session = { id: "session", courseOfferingId: "offering", sessionDate: "2099-01-05", period: "MORNING", status: "planned", startTime: "08:00", endTime: "11:00", lecturerId: "l", roomId: "r" };
  render(<SessionEditor session={session} offering={offering} user={{ canManageScheduling: true }} onClose={jest.fn()} onSaved={saved} />);
  fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Lưu buổi học" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Lưu buổi học" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Phòng học đã có lịch"); expect(saved).not.toHaveBeenCalled();
});
it("confirms an ended session through the API without edit controls", async () => {
  const saved = jest.fn();
  const onClose = jest.fn();
  render(<SessionEditor session={{ id: "past", status: "planned", sessionDate: "2020-01-05", period: "MORNING", startTime: "08:00", endTime: "11:00" }} offering={offering} user={{ canManageScheduling: true }} onClose={onClose} onSaved={saved} />);
  expect(screen.queryByRole("button", { name: "Chỉnh sửa" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Đóng chi tiết buổi học" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Đã diễn ra" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/past/confirmation"), { status: "held" }, { withCredentials: true }));
});
it("switches course-class tabs without refetching or losing a learner note", async () => {
  const onClose = jest.fn();
  const onSelect = jest.fn();
  const offeringWithGroups = {
    ...offering,
    groupLinks: Array.from({ length: 4 }, (_, index) => ({
      classGroupId: `g-${index + 1}`,
      classGroup: { id: `g-${index + 1}`, code: `KTHH2026.0${index + 1}`, major: { name: "Khai thác hàng hải" }, memberCount: index + 1 },
    })),
  };
  axios.get.mockImplementation(async (url) => ({
    data: url.endsWith("/course-offerings/offering") ? offeringWithGroups
      : url.endsWith("/roster") ? { participants: [{ id: "student:one", code: "HV001", fullName: "Nguyễn An", note: "" }] }
      : [],
  }));
  render(<OfferingDetails offering={offeringWithGroups} user={{ role: "admin", canManageScheduling: true }} onClose={onClose} onSelect={onSelect} />);

  const scheduleTab = screen.getByRole("tab", { name: "LỊCH HỌC" });
  const peopleTab = screen.getByRole("tab", { name: "LỚP & HỌC VIÊN" });
  expect(scheduleTab).toHaveAttribute("aria-selected", "true");
  expect(peopleTab).toHaveAttribute("aria-selected", "false");
  expect(await screen.findByText("LỊCH HỌC ĐÃ XẾP")).toBeInTheDocument();
  expect(await screen.findByText("Chưa có buổi học nào được xếp lịch cho lớp học phần này.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Đã xếp sắp tới/ })).not.toBeInTheDocument();
  expect(screen.queryByText("LỚP / NHÓM THAM GIA")).not.toBeInTheDocument();
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(4));
  const requestCount = axios.get.mock.calls.length;

  fireEvent.click(peopleTab);
  expect(peopleTab).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("LỚP / NHÓM THAM GIA")).toBeInTheDocument();
  expect(screen.getByText("DANH SÁCH HỌC VIÊN")).toBeInTheDocument();
  expect(screen.getAllByText(/^KTHH2026\.0[1-4]$/)).toHaveLength(4);
  expect(screen.queryByRole("button", { name: /^Tất cả/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Sắp tới/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Chờ xác nhận/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Đã diễn ra/ })).not.toBeInTheDocument();
  const input = await screen.findByRole("textbox", { name: "Ghi chú HV001" });
  expect(input).toHaveValue("");
  fireEvent.change(input, { target: { value: "Miễn TA" } });

  fireEvent.click(scheduleTab);
  expect(screen.getByText("LỊCH HỌC ĐÃ XẾP")).toBeInTheDocument();
  expect(screen.queryByRole("textbox", { name: "Ghi chú HV001" })).not.toBeInTheDocument();
  fireEvent.click(peopleTab);
  expect(screen.getByRole("textbox", { name: "Ghi chú HV001" })).toHaveValue("Miễn TA");
  expect(axios.get).toHaveBeenCalledTimes(requestCount);
  expect(screen.getByRole("button", { name: "Xếp lịch / Xếp thêm" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Lưu ghi chú" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/roster-notes"), { participantNotes: [{ participantId: "student:one", note: "Miễn TA" }] }, { withCredentials: true }));
  fireEvent.click(screen.getByRole("button", { name: "Xếp lịch / Xếp thêm" }));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "offering" }));
  const closeButton = screen.getByRole("button", { name: "Đóng" });
  await waitFor(() => expect(closeButton).toBeEnabled());
  fireEvent.click(closeButton);
  expect(onClose).toHaveBeenCalledTimes(1);
});
it("renders the list of scheduled sessions and filters them by status", async () => {
  const mockSessions = [
    {
      id: "session-1",
      courseOfferingId: "offering",
      sessionDate: "2099-10-15",
      period: "MORNING",
      startTime: "08:00:00",
      endTime: "11:30:00",
      status: "planned",
      room: { id: "r1", code: "P.301", name: "Phòng 301 Nhà A" },
      lecturer: { id: "l1", code: "GV01", name: "TS. Nguyễn Bình" },
    },
    {
      id: "session-2",
      courseOfferingId: "offering",
      sessionDate: "2020-01-10",
      period: "AFTERNOON",
      startTime: "13:30:00",
      endTime: "17:00:00",
      status: "held",
      room: { id: "r2", code: "P.302", name: "Phòng 302 Nhà A" },
      lecturer: { id: "l2", code: "GV02", name: "PGS. Trần Văn C" },
    },
  ];
  axios.get.mockImplementation(async (url) => ({
    data: url.includes("/teaching-sessions") ? mockSessions
      : url.endsWith("/roster") ? { participants: [] }
      : url.endsWith("/course-offerings/offering") ? { ...offering, sessionSummary: { heldCount: 1, futurePlannedCount: 1, pendingCount: 0 } }
      : []
  }));
  render(<OfferingDetails offering={{ ...offering, sessionSummary: { heldCount: 1, futurePlannedCount: 1, pendingCount: 0 } }} user={{ role: "admin", canManageScheduling: true }} onClose={jest.fn()} />);

  expect(await screen.findByText("LỊCH HỌC ĐÃ XẾP (2 buổi)")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Tất cả (2)" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Chờ xác nhận (0)" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Đã xếp sắp tới/ })).not.toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "CA HỌC" })).toBeInTheDocument();
  expect(screen.getByText("P.301")).toBeInTheDocument();
  expect(screen.getByText("P.302")).toBeInTheDocument();
  expect(screen.getByText("TS. Nguyễn Bình")).toBeInTheDocument();
  expect(screen.getByText("PGS. Trần Văn C")).toBeInTheDocument();
  expect(screen.getByText("Sáng")).toBeInTheDocument();
  expect(screen.getByText("Chiều")).toBeInTheDocument();
  expect(screen.queryByText("Phòng 301 Nhà A")).not.toBeInTheDocument();
  expect(screen.queryByText("Phòng 302 Nhà A")).not.toBeInTheDocument();
  expect(screen.queryByText("GV01")).not.toBeInTheDocument();
  expect(screen.queryByText("GV02")).not.toBeInTheDocument();
  expect(screen.queryByText("08:00 - 11:30")).not.toBeInTheDocument();
  expect(screen.queryByText("13:30 - 17:00")).not.toBeInTheDocument();

  // Filter to upcoming
  fireEvent.click(screen.getByRole("button", { name: "Sắp tới (1)" }));
  expect(screen.getByText("P.301")).toBeInTheDocument();
  expect(screen.queryByText("P.302")).not.toBeInTheDocument();

  // Filter to held
  fireEvent.click(screen.getByRole("button", { name: "Đã diễn ra (1)" }));
  expect(screen.queryByText("P.301")).not.toBeInTheDocument();
  expect(screen.getByText("P.302")).toBeInTheDocument();
});
