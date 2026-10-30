import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GuidedEnrollmentCapture from "./GuidedEnrollmentCapture";
import { analyzeEnrollmentFrame } from "./attendanceApi";

vi.mock("./attendanceApi", () => ({ analyzeEnrollmentFrame: vi.fn() }));
const good = { status: "ok", face_count: 1, quality_ok: true, quality_score: 0.8, yaw_signed: 0,
  bbox: [0.2, 0.2, 0.7, 0.8], quality: { blur: 100, brightness: 0.5, face_area_ratio: 0.3 } };
let stop, stream, onComplete;
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); stop = vi.fn(); onComplete = vi.fn();
  stream = { getTracks: () => [{ stop }] };
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
  vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockReturnValue(2);
  vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(1280);
  vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(720);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["photo"], { type: "image/jpeg" })));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("guided enrollment", () => {
  it("captures front and two opposing poses, then releases the camera", async () => {
    let i = 0;
    analyzeEnrollmentFrame.mockImplementation(async () => ({ ...good, yaw_signed: i++ < 3 ? 0 : i <= 6 ? 0.12 : -0.12 }));
    render(<GuidedEnrollmentCapture participantId="student:1" onComplete={onComplete} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Mở camera chụp mẫu" })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(4500); });
    expect(onComplete).toHaveBeenCalledOnce();
    const files = onComplete.mock.calls[0][0];
    expect(files).toHaveLength(3);
    expect(files.every((file) => file instanceof File && file.type === "image/jpeg")).toBe(true);
    expect(analyzeEnrollmentFrame).toHaveBeenCalledTimes(9);
    expect(stop).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("Đã chọn đủ 3 ảnh đạt yêu cầu");
  });
  it("keeps asking for one person without capturing a group", async () => {
    analyzeEnrollmentFrame.mockResolvedValue({ ...good, face_count: 2 });
    render(<GuidedEnrollmentCapture participantId="student:1" onComplete={onComplete} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Mở camera chụp mẫu" })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Có nhiều khuôn mặt");
    fireEvent.click(screen.getByRole("button", { name: "Dừng camera" }));
    expect(stop).toHaveBeenCalledOnce();
  });
});
