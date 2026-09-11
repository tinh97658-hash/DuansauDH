import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import Schedule from "../../pages/masters/schedule";
import SessionEditor from "../../features/scheduling/SessionEditor";
import OfferingDetails from "../../features/scheduling/OfferingDetails";

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
  expect(screen.getAllByRole("button", { name: /^Xếp (Sáng|Chiều)/ }).length).toBeGreaterThan(0);
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
  fireEvent.click(screen.getByRole("button", { name: /301.*40 chỗ/ }));
  fireEvent.click(screen.getByRole("button", { name: "Lưu buổi học" }));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/teaching-sessions"), expect.objectContaining({ courseOfferingId: "offering", sessionDate: "2099-01-05", period: "MORNING", roomId: "r", lecturerId: "l", startTime: "07:00", endTime: "12:00" }), { withCredentials: true });
});
it("updates the automatic time range and lecturer conflicts when changing period", async () => {
  axios.get.mockImplementation(async (url) => ({ data: url.includes("/lecturers") ? lecturers : url.includes("/rooms") ? rooms : url.includes("/teaching-sessions?") ? [{ id: "busy", lecturerId: "l", roomId: "r", startTime: "08:00:00", endTime: "10:00:00", status: "planned" }] : offering }));
  render(<SessionEditor offering={offering} date="2099-01-05" period="MORNING" user={{ canManageScheduling: true }} onClose={jest.fn()} onSaved={jest.fn()} />);
  expect(await screen.findByRole("option", { name: "Nguyễn Bình · Đang bận" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Buổi"), { target: { value: "AFTERNOON" } });
  expect(screen.getByText("Khung giờ buổi học: 13:00–17:00")).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Nguyễn Bình" })).toBeEnabled();
  expect(screen.getByRole("button", { name: /301.*40 chỗ/ })).toBeEnabled();
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
  render(<SessionEditor session={{ id: "past", status: "planned", sessionDate: "2020-01-05", period: "MORNING", startTime: "08:00", endTime: "11:00" }} offering={offering} user={{ canManageScheduling: true }} onClose={jest.fn()} onSaved={saved} />);
  expect(screen.queryByRole("button", { name: "Chỉnh sửa" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Đã diễn ra" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/past/confirmation"), { status: "held" }, { withCredentials: true }));
});
it("saves and clears per-learner notes on a persisted roster", async () => {
  render(<OfferingDetails offering={offering} user={{ role: "admin" }} onClose={jest.fn()} />);
  const input = await screen.findByRole("textbox", { name: "Ghi chú HV001" });
  expect(input).toHaveValue(""); fireEvent.change(input, { target: { value: "Miễn TA" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu ghi chú" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/roster-notes"), { participantNotes: [{ participantId: "student:one", note: "Miễn TA" }] }, { withCredentials: true }));
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
  expect(screen.getByText("P.301")).toBeInTheDocument();
  expect(screen.getByText("P.302")).toBeInTheDocument();
  expect(screen.getByText("TS. Nguyễn Bình")).toBeInTheDocument();
  expect(screen.getByText("PGS. Trần Văn C")).toBeInTheDocument();

  // Filter to upcoming
  fireEvent.click(screen.getByRole("button", { name: "Sắp tới (1)" }));
  expect(screen.getByText("P.301")).toBeInTheDocument();
  expect(screen.queryByText("P.302")).not.toBeInTheDocument();

  // Filter to held
  fireEvent.click(screen.getByRole("button", { name: "Đã diễn ra (1)" }));
  expect(screen.queryByText("P.301")).not.toBeInTheDocument();
  expect(screen.getByText("P.302")).toBeInTheDocument();
});
