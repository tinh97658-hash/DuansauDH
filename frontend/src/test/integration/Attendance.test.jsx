import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AttendancePage from "../../pages/masters/attendance";
import { AuthSessionContext } from "../../context/AuthSession";
import axios from "axios";

vi.mock("axios");

const mockSession = {
  user: { role: "admin", username: "admin" },
  access: {
    permissions: [
      "attendance.view",
      "attendance.record",
      "attendance.enroll",
      "attendance.review",
      "attendance.export",
      "scheduling.view",
    ],
    roles: ["admin"],
  },
};

const mockTeachingSessions = [
  {
    id: "session-1",
    sessionDate: "2026-10-28",
    startTime: "07:00",
    endTime: "11:30",
    courseOfferingId: "offering-1",
    courseOffering: {
      id: "offering-1",
      subjectCode: "SDH-701",
      subjectName: "Học máy nâng cao",
    },
    room: { code: "P.302-A1" },
    lecturer: { fullName: "TS. Nguyễn Văn A" },
  },
];

const mockRoster = [
  {
    id: "HV001",
    studentCode: "2601001",
    fullName: "Trần Thị Lan",
  },
  {
    id: "HV002",
    studentCode: "2601002",
    fullName: "Lê Văn Hùng",
  },
];

const mockAttendance = [
  {
    participantId: "HV001",
    status: "PRESENT",
    source: "FACE",
    confidence: 0.88,
    recordedAt: "2026-10-28T07:15:00.000Z",
  },
];

describe("Attendance Feature UI Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders teaching session selector with header", async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes("/scheduling/teaching-sessions")) {
        return Promise.resolve({ data: mockTeachingSessions });
      }
      return Promise.reject(new Error("not found"));
    });

    render(
      <MemoryRouter initialEntries={["/masters/attendance"]}>
        <AuthSessionContext.Provider value={mockSession}>
          <Routes>
            <Route path="/masters/attendance" element={<AttendancePage />} />
          </Routes>
        </AuthSessionContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByText("Quản Lý Điểm Danh Buổi Học")).toBeInTheDocument();
  });

  it("loads and displays roster table and attendance records for a selected session", async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes("/attendance/sessions/session-1/attendance")) {
        return Promise.resolve({ data: mockAttendance });
      }
      if (url.includes("/attendance/sessions/session-1/reviews")) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes("/scheduling/teaching-sessions/session-1")) {
        return Promise.resolve({ data: mockTeachingSessions[0] });
      }
      if (url.includes("/scheduling/offerings/offering-1/roster")) {
        return Promise.resolve({ data: { participants: mockRoster } });
      }
      return Promise.reject(new Error("not found: " + url));
    });

    render(
      <MemoryRouter initialEntries={["/masters/attendance/session-1"]}>
        <AuthSessionContext.Provider value={mockSession}>
          <Routes>
            <Route path="/masters/attendance/:sessionId" element={<AttendancePage />} />
          </Routes>
        </AuthSessionContext.Provider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Trần Thị Lan")).toBeInTheDocument();
      expect(screen.getByText("Lê Văn Hùng")).toBeInTheDocument();
    });

    // Check stats are rendered
    expect(screen.getByText("SĨ SỐ LỚP")).toBeInTheDocument();
    expect(screen.getByText("CÓ MẶT (ĐÚNG GIỜ)")).toBeInTheDocument();
    expect(screen.getByText("CHỜ DUYỆT (REVIEW)")).toBeInTheDocument();

    // Verify Action buttons are rendered
    expect(screen.getByRole("button", { name: /Mở Kiosk Quét Mặt/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Xuất CSV/i })).toBeInTheDocument();
  });
});
