import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import AttendanceSession from "./AttendanceSession";
import { AuthSessionContext } from "../../context/AuthSession";
import { closeAttendanceSession, getAttendanceWorkflow, listSessionAttendance, listSessionEnrollments, listSessionReviews, openAttendanceSession, withdrawParticipantEnrollment } from "./attendanceApi";

vi.mock("axios");
vi.mock("./attendanceApi", () => ({ closeAttendanceSession: vi.fn(), getAttendanceWorkflow: vi.fn(), listSessionAttendance: vi.fn(), listSessionEnrollments: vi.fn(), listSessionReviews: vi.fn(), openAttendanceSession: vi.fn(), withdrawParticipantEnrollment: vi.fn(), getParticipantEnrollment: vi.fn(), listParticipantAudit: vi.fn() }));
let state;
const renderSession = () => render(<AuthSessionContext.Provider value={{ access: { permissions: ["attendance.record", "attendance.enroll"] } }}><AttendanceSession sessionId="session-1" /></AuthSessionContext.Provider>);
beforeEach(() => {
  vi.clearAllMocks(); state = "NOT_OPEN";
  getAttendanceWorkflow.mockImplementation(async () => ({ state, withinWindow: true }));
  openAttendanceSession.mockImplementation(async () => { state = "OPEN"; });
  closeAttendanceSession.mockImplementation(async () => { state = "CLOSED"; });
  listSessionAttendance.mockImplementation(async () => state === "CLOSED" ? [{ participantId: "student:1", status: "ABSENT", source: "SYSTEM" }] : []);
  listSessionReviews.mockResolvedValue([]);
  listSessionEnrollments.mockResolvedValue({ enrollments: [] });
  withdrawParticipantEnrollment.mockResolvedValue({ templates_deleted: 3 });
  axios.get.mockImplementation(async (url) => ({ data: url.includes("/roster") ? { participants: [{ id: "student:1", fullName: "Học viên A", code: "HV01" }] } : { id: "session-1", courseOfferingId: "offering-1", sessionDate: "2026-10-28", status: "held" } }));
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("attendance open and close controls", () => {
  it("keeps missing students unmarked until an authorized session close", async () => {
    renderSession();
    expect(await screen.findByText("Học viên A")).toBeInTheDocument();
    expect(screen.getByText("Chưa điểm danh")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mở Kiosk Quét Mặt" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Mở điểm danh" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Mở Kiosk Quét Mặt" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Chốt điểm danh" }));
    expect(await screen.findByText("Vắng mặt")).toBeInTheDocument();
    expect(screen.getByText("Chốt buổi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đã chốt điểm danh" })).toBeDisabled();
    expect(closeAttendanceSession).toHaveBeenCalledWith("session-1");
  });
  it("keeps the session open when pending reviews prevent finalization", async () => {
    state = "OPEN";
    closeAttendanceSession.mockRejectedValue({ response: { data: { message: "Còn 1 ca chờ duyệt." } } });
    renderSession();
    await screen.findByText("Học viên A");
    fireEvent.click(screen.getByRole("button", { name: "Chốt điểm danh" }));
    expect(await screen.findByText("Còn 1 ca chờ duyệt.")).toBeInTheDocument();
    expect(screen.getByText("Chưa điểm danh")).toBeInTheDocument();
    expect(screen.queryByText("Vắng mặt")).not.toBeInTheDocument();
  });

  it("shows face enrollment status and lets staff update or withdraw it", async () => {
    listSessionEnrollments
      .mockResolvedValueOnce({
        enrollments: [{ participantId: "student:1", exists: true, active: true, enrolled: true, templateCount: 3, createdAt: "2026-10-27T10:00:00Z" }],
      })
      .mockResolvedValue({
        enrollments: [{ participantId: "student:1", exists: true, active: false, enrolled: false, templateCount: 0, createdAt: "2026-10-27T10:00:00Z" }],
      });

    renderSession();

    expect(await screen.findByText("Đã có 3 mẫu")).toBeInTheDocument();
    expect(screen.getByText("1/1 học viên đã có khuôn mặt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cập nhật" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Thu hồi" }));

    await waitFor(() => expect(withdrawParticipantEnrollment).toHaveBeenCalledWith("student:1"));
    expect(await screen.findByText(/Đã thu hồi 3 mẫu khuôn mặt/)).toBeInTheDocument();
    expect(await screen.findByText("Đã thu hồi")).toBeInTheDocument();
    expect(screen.getByText("0/1 học viên đã có khuôn mặt")).toBeInTheDocument();
  });
});
