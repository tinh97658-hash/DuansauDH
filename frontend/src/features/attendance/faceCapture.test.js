import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureStableFace } from "./faceCapture";

const good = { status: "ok", face_count: 1, quality_ok: true, quality_score: 0.8, yaw_signed: 0,
  bbox: [0.2, 0.2, 0.7, 0.8], quality: { blur: 100, brightness: 0.5, face_area_ratio: 0.3 } };
let blobs, analyze, controller, onGuide, video, canvas;
beforeEach(() => {
  vi.useFakeTimers(); blobs = []; controller = new AbortController(); onGuide = vi.fn();
  video = { readyState: 2, videoWidth: 1280, videoHeight: 720 };
  canvas = { getContext: () => ({ drawImage: vi.fn() }), toBlob: (callback) => { const blob = new Blob([String(blobs.length)]); blobs.push(blob); callback(blob); } };
  analyze = vi.fn().mockResolvedValue(good);
});
afterEach(() => vi.useRealTimers());
const start = (options = {}) => captureStableFace({ video, canvas, analyze, signal: controller.signal, onGuide, ...options });

describe("stable capture selection", () => {
  it("waits for three stable frames and selects the best quality image", async () => {
    analyze.mockResolvedValueOnce({ ...good, quality_score: 0.6 }).mockResolvedValueOnce({ ...good, quality_score: 0.95 }).mockResolvedValueOnce({ ...good, quality_score: 0.7 });
    const pending = start();
    await vi.advanceTimersByTimeAsync(699);
    expect(analyze).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    const selected = await pending;
    expect(selected.blob).toBe(blobs[1]);
    expect(analyze).toHaveBeenCalledTimes(3);
  });
  it("does not select a frame when more than one face is present", async () => {
    analyze.mockResolvedValue({ ...good, face_count: 2 });
    expect(await start()).toBeNull();
    expect(analyze).toHaveBeenCalledOnce();
    expect(onGuide).toHaveBeenCalledWith(expect.stringContaining("Có nhiều khuôn mặt"));
  });
  it("rejects moving faces even when every individual image passes quality", async () => {
    let i = 0;
    analyze.mockImplementation(async () => ({ ...good, bbox: i++ % 2 ? [0.5, 0.2, 1, 0.8] : good.bbox }));
    const pending = start();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await pending).toBeNull();
    expect(onGuide).toHaveBeenLastCalledWith(expect.stringContaining("đang di chuyển"));
  });
  it("requires the requested enrollment pose", async () => {
    expect(await start({ poseMatches: (yaw) => yaw > 0.08 })).toBeNull();
    expect(onGuide).toHaveBeenCalledWith(expect.stringContaining("Quay đầu nhẹ"));
  });
  it("aborts while waiting for the next frame", async () => {
    const pending = start();
    await vi.advanceTimersByTimeAsync(1);
    controller.abort();
    expect(await pending).toBeNull();
    expect(analyze).toHaveBeenCalledOnce();
  });
});
