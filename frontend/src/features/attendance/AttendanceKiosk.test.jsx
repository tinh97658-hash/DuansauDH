import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AttendanceKiosk from "./AttendanceKiosk";
import { recognizeAttendance, analyzeAttendanceFrame, reportAttendanceTelemetry } from "./attendanceApi";

vi.mock("./attendanceApi", () => ({ recognizeAttendance: vi.fn(), analyzeAttendanceFrame: vi.fn(), reportAttendanceTelemetry: vi.fn() }));

const session = {
  id: "session-1", sessionDate: "2026-10-28", startTime: "08:00", endTime: "11:00",
  room: { id: "room-1", code: "A101", name: "Phòng 101", capacity: 50, isActive: true },
  attendanceState: "OPEN",
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

describe("Attendance kiosk", () => {
  let stop;
  let getUserMedia;
  let stream;
  beforeEach(() => {
    vi.clearAllMocks();
    stop = vi.fn();
    stream = { getTracks: () => [{ stop }] };
    getUserMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["frame"], { type: "image/jpeg" })));
    recognizeAttendance.mockResolvedValue({ decision: "UNKNOWN", reason: "no_face" });
    reportAttendanceTelemetry.mockResolvedValue({ recorded: true });
    analyzeAttendanceFrame.mockResolvedValue({ status: "ok", face_count: 1, quality_ok: true, bbox: [0.2, 0.2, 0.7, 0.8], quality: { brightness: 0.5, blur: 100, face_area_ratio: 0.3 }, quality_score: 0.8 });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

  async function openCamera(props = {}) {
    const view = render(<AttendanceKiosk session={session} onClose={vi.fn()} {...props} />);
    const video = view.container.ownerDocument.querySelector("video");
    await waitFor(() => expect(video.srcObject).toBe(stream));
    Object.defineProperties(video, {
      videoWidth: { configurable: true, value: 1280 },
      videoHeight: { configurable: true, value: 720 },
      readyState: { configurable: true, value: 2 },
    });
    fireEvent.loadedData(video);
    return view;
  }

  it("renders a room object without crashing and waits for camera data", async () => {
    render(<AttendanceKiosk session={session} onClose={vi.fn()} />);
    expect(screen.getByText(/Phòng: A101/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quét ngay" })).toBeDisabled();
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
  });

  it("stops a camera whose permission resolves after closing", async () => {
    const camera = deferred();
    getUserMedia.mockReturnValue(camera.promise);
    const view = render(<AttendanceKiosk session={session} onClose={vi.fn()} />);
    view.unmount();
    await act(async () => { camera.resolve(stream); });
    expect(stop).toHaveBeenCalledOnce();
  });

  it("sends one frame at a time and aborts the request on close", async () => {
    const response = deferred();
    recognizeAttendance.mockReturnValue(response.promise);
    const recorded = vi.fn();
    const view = await openCamera({ onAttendanceRecorded: recorded });
    const button = screen.getByRole("button", { name: "Quét ngay" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(recognizeAttendance).toHaveBeenCalledOnce());
    const [id, form, { signal }] = recognizeAttendance.mock.calls[0];
    expect(id).toBe(session.id);
    expect(form.get("image").type).toBe("image/jpeg");
    expect(form.get("deviceId")).toBe("kiosk-web");
    view.unmount();
    expect(signal.aborted).toBe(true);
    expect(stop).toHaveBeenCalledOnce();
    await act(async () => { response.resolve({ decision: "ACCEPT" }); });
    expect(recorded).not.toHaveBeenCalled();
    expect(reportAttendanceTelemetry).not.toHaveBeenCalled();
  });

  it("shows API errors and allows the next scan", async () => {
    recognizeAttendance.mockRejectedValueOnce({ response: { data: { message: ["Camera request failed", "Try again"] } } });
    await openCamera();
    fireEvent.click(screen.getByRole("button", { name: "Quét ngay" }));
    expect(await screen.findByText("Camera request failed; Try again")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quét ngay" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Quét ngay" }));
    expect(await screen.findByText(/Chưa phát hiện khuôn mặt/)).toBeInTheDocument();
  });

  it("recovers when a canvas cannot produce an image", async () => {
    HTMLCanvasElement.prototype.toBlob.mockImplementationOnce((callback) => callback(null));
    await openCamera();
    fireEvent.click(screen.getByRole("button", { name: "Quét ngay" }));
    expect(await screen.findByText(/Không thể chụp ảnh từ camera/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quét ngay" })).toBeEnabled();
    expect(recognizeAttendance).not.toHaveBeenCalled();
  });

  it.each(["ACCEPT", "REVIEW"])("refreshes attendance/reviews after %s", async (decision) => {
    const recorded = vi.fn();
    recognizeAttendance.mockResolvedValue({ decision, attendanceId: decision === "ACCEPT" ? "attendance-1" : null, attendance: decision === "ACCEPT" ? { status: "PRESENT", recordedAt: "2026-10-28T01:00:00Z", alreadyRecorded: false } : null, reviewId: decision === "REVIEW" ? "review-1" : null, reason: "margin_too_low", participant: { displayName: "Học viên A", id: "student:1", code: "HV01" } });
    await openCamera({ onAttendanceRecorded: recorded });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Quét ngay" }));
    await waitFor(() => expect(recorded).toHaveBeenCalledOnce());
    if (decision === "ACCEPT") expect(await screen.findByText("ĐIỂM DANH THÀNH CÔNG")).toBeInTheDocument();
    else expect(await screen.findByText(/Đã đưa vào hàng đợi duyệt/)).toBeInTheDocument();
  });

  it("reports denied camera permission", async () => {
    getUserMedia.mockRejectedValue({ name: "NotAllowedError" });
    render(<AttendanceKiosk session={session} onClose={vi.fn()} />);
    expect(await screen.findByText(/Quyền truy cập camera bị từ chối/)).toBeInTheDocument();
    expect(recognizeAttendance).not.toHaveBeenCalled();
  });

  it("keeps successful confirmation visible after the scan resumes", async () => {
    recognizeAttendance.mockResolvedValue({ decision: "ACCEPT", attendanceId: "attendance-1", attendance: { status: "LATE", recordedAt: "2026-10-28T01:20:00Z", alreadyRecorded: false }, participant: { displayName: "Học viên A", code: "HV01" } });
    await openCamera();
    fireEvent.click(screen.getByRole("checkbox"));
    vi.useFakeTimers();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Quét ngay" })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(750); });
    expect(await screen.findByText("ĐIỂM DANH THÀNH CÔNG")).toBeInTheDocument();
    expect(screen.getByText("Mã học viên: HV01")).toBeInTheDocument();
    expect(screen.getByText("Có mặt · Đi muộn")).toBeInTheDocument();
    expect(screen.getByText("Điểm danh của bạn đã được lưu. Bạn có thể rời khung để người tiếp theo thực hiện.")).toBeInTheDocument();
    analyzeAttendanceFrame.mockResolvedValue({ status: "no_face", face_count: 0, quality_ok: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(screen.getByText("ĐIỂM DANH THÀNH CÔNG")).toBeInTheDocument();
    expect(screen.getByText("Lần điểm danh gần nhất")).toBeInTheDocument();
  });

  it("explains that an existing record retains its original time", async () => {
    recognizeAttendance.mockResolvedValue({ decision: "ACCEPT", attendanceId: "attendance-1", attendance: { status: "PRESENT", recordedAt: "2026-10-28T01:00:00Z", alreadyRecorded: true }, participant: { displayName: "Học viên A", code: "HV01" } });
    await openCamera();
    fireEvent.click(screen.getByRole("button", { name: "Quét ngay" }));
    expect(await screen.findByText("BẠN ĐÃ ĐIỂM DANH")).toBeInTheDocument();
    expect(screen.getByText(/Hệ thống giữ nguyên lần điểm danh trước đó/)).toBeInTheDocument();
    expect(screen.getAllByText("08:00:00").length).toBeGreaterThan(0);
  });

  it("does not announce success without confirmation that attendance was saved", async () => {
    recognizeAttendance.mockResolvedValue({ decision: "ACCEPT", attendanceId: null });
    const recorded = vi.fn();
    await openCamera({ onAttendanceRecorded: recorded });
    fireEvent.click(screen.getByRole("button", { name: "Quét ngay" }));
    expect(await screen.findByText(/Chưa xác nhận được việc lưu điểm danh/)).toBeInTheDocument();
    expect(screen.queryByText("ĐIỂM DANH THÀNH CÔNG")).not.toBeInTheDocument();
    expect(recorded).not.toHaveBeenCalled();
  });

  it("retries an unsuccessful scan after a short result interval", async () => {
    await openCamera();
    vi.useFakeTimers();
    // Re-enable automatic scanning after installing the controlled clock.
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => { await vi.advanceTimersByTimeAsync(1050); });
    expect(recognizeAttendance).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(1700); });
    expect(recognizeAttendance).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(recognizeAttendance).toHaveBeenCalledTimes(2);
  });

  it.each(["ACCEPT", "REVIEW"])("does not repeat %s while the person remains in frame", async (decision) => {
    recognizeAttendance.mockResolvedValue({ decision, attendanceId: decision === "ACCEPT" ? "attendance-1" : null });
    await openCamera();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Quét ngay" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(9000); });
    expect(recognizeAttendance).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Quét ngay" })).toBeDisabled();
    expect(reportAttendanceTelemetry).toHaveBeenCalledOnce();
  });

  it("requires two consecutive empty frames before automatically accepting the next person", async () => {
    recognizeAttendance.mockResolvedValue({ decision: "ACCEPT", attendanceId: "attendance-1" });
    await openCamera();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Quét ngay" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(750); });
    const good = analyzeAttendanceFrame.mock.calls.length;
    expect(good).toBe(3);
    const valid = await analyzeAttendanceFrame.mock.results[0].value;
    const empty = { status: "no_face", face_count: 0, quality_ok: false };
    analyzeAttendanceFrame.mockResolvedValueOnce(empty).mockResolvedValueOnce(valid).mockResolvedValueOnce(empty).mockResolvedValueOnce(empty);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(recognizeAttendance).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Quét ngay" })).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(recognizeAttendance).toHaveBeenCalledTimes(2);
  });

  it("sends the selected frame token and reports client timings after UI commit", async () => {
    const valid = { status: "ok", face_count: 1, quality_ok: true, bbox: [0.2, 0.2, 0.7, 0.8], quality: { brightness: 0.5, blur: 100, face_area_ratio: 0.3 } };
    analyzeAttendanceFrame.mockResolvedValueOnce({ ...valid, quality_score: 0.6, capture_token: "first" })
      .mockResolvedValueOnce({ ...valid, quality_score: 0.95, capture_token: "best" })
      .mockResolvedValueOnce({ ...valid, quality_score: 0.7, capture_token: "last" });
    recognizeAttendance.mockResolvedValue({ decision: "ACCEPT", attendanceId: "attendance-1", eventId: "event-1" });
    reportAttendanceTelemetry.mockRejectedValue(new Error("telemetry offline"));
    await openCamera();
    fireEvent.click(screen.getByRole("button", { name: "Quét ngay" }));
    await waitFor(() => expect(reportAttendanceTelemetry).toHaveBeenCalledOnce());
    expect(recognizeAttendance.mock.calls[0][1].get("captureToken")).toBe("best");
    expect(reportAttendanceTelemetry).toHaveBeenCalledWith(session.id, expect.objectContaining({
      outcome: "ACCEPT", eventId: "event-1", frameCount: 3,
      captureMs: expect.any(Number), recognitionHttpMs: expect.any(Number), uiCommitMs: expect.any(Number), totalMs: expect.any(Number),
    }));
    expect(screen.getByText("ĐIỂM DANH THÀNH CÔNG")).toBeInTheDocument();
  });

  it("aborts departure analysis when closing the kiosk", async () => {
    recognizeAttendance.mockResolvedValue({ decision: "ACCEPT", attendanceId: "attendance-1" });
    const view = await openCamera();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Quét ngay" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(750); });
    const pending = deferred();
    analyzeAttendanceFrame.mockReturnValue(pending.promise);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    const signal = analyzeAttendanceFrame.mock.calls.at(-1)[2];
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { pending.resolve({ status: "no_face", face_count: 0 }); await vi.advanceTimersByTimeAsync(5000); });
    expect(recognizeAttendance).toHaveBeenCalledOnce();
  });

  it("backs off empty capture attempts and reports them separately from recognition", async () => {
    await openCamera();
    fireEvent.click(screen.getByRole("checkbox"));
    vi.useFakeTimers();
    analyzeAttendanceFrame.mockResolvedValue({ status: "no_face", face_count: 0, quality_ok: false });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Quét ngay" })); });
    expect(reportAttendanceTelemetry).toHaveBeenCalledWith(session.id, expect.objectContaining({ outcome: "NO_CAPTURE", frameCount: 1, recognitionHttpMs: 0 }));
    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => { await vi.advanceTimersByTimeAsync(999); });
    expect(analyzeAttendanceFrame).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(analyzeAttendanceFrame).toHaveBeenCalledTimes(2);
    expect(recognizeAttendance).not.toHaveBeenCalled();
  });

  it("stops departure polling if the session closes on the server", async () => {
    recognizeAttendance.mockResolvedValue({ decision: "ACCEPT", attendanceId: "attendance-1" });
    await openCamera();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Quét ngay" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(750); });
    analyzeAttendanceFrame.mockRejectedValue({ response: { status: 409 } });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    const calls = analyzeAttendanceFrame.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(analyzeAttendanceFrame).toHaveBeenCalledTimes(calls);
    expect(recognizeAttendance).toHaveBeenCalledOnce();
  });

  it.each([{ attendanceState: "CLOSED" }, { status: "not_held" }])("aborts capture when the same session becomes ineligible: %j", async (change) => {
    const pending = deferred();
    const valid = {
      status: "ok", face_count: 1, quality_ok: true, bbox: [0.2, 0.2, 0.7, 0.8], quality_score: 0.8,
    };
    analyzeAttendanceFrame.mockReturnValue(pending.promise);
    const recorded = vi.fn();
    const view = await openCamera({ onAttendanceRecorded: recorded });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Quét ngay" }));
    await waitFor(() => expect(analyzeAttendanceFrame).toHaveBeenCalledOnce());
    const signal = analyzeAttendanceFrame.mock.calls[0][2];
    view.rerender(<AttendanceKiosk session={{ ...session, ...change }} onClose={vi.fn()} onAttendanceRecorded={recorded} />);
    expect(signal.aborted).toBe(true);
    expect(stop).toHaveBeenCalledOnce();
    await act(async () => { pending.resolve(valid); });
    expect(recognizeAttendance).not.toHaveBeenCalled();
    expect(recorded).not.toHaveBeenCalled();
    expect(reportAttendanceTelemetry).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Quét ngay" })).toBeDisabled();
  });

  it.each([{ attendanceState: "CLOSED" }, { status: "not_held" }])("ignores pending recognition after the same session becomes ineligible: %j", async (change) => {
    const response = deferred();
    recognizeAttendance.mockReturnValue(response.promise);
    const recorded = vi.fn();
    const view = await openCamera({ onAttendanceRecorded: recorded });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Quét ngay" }));
    await waitFor(() => expect(recognizeAttendance).toHaveBeenCalledOnce());
    const signal = recognizeAttendance.mock.calls[0][2].signal;
    view.rerender(<AttendanceKiosk session={{ ...session, ...change }} onClose={vi.fn()} onAttendanceRecorded={recorded} />);
    expect(signal.aborted).toBe(true);
    await act(async () => { response.resolve({ decision: "ACCEPT", attendanceId: "attendance-1" }); });
    expect(recorded).not.toHaveBeenCalled();
    expect(reportAttendanceTelemetry).not.toHaveBeenCalled();
    expect(screen.queryByText("ĐIỂM DANH THÀNH CÔNG")).not.toBeInTheDocument();
  });
});
