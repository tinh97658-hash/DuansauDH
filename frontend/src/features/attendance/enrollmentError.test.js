import { describe, expect, it } from "vitest";
import { formatEnrollmentError } from "./enrollmentError";

describe("enrollment error details", () => {
  it("shows numbered rejection reasons and measured thresholds in Vietnamese", () => {
    const message = formatEnrollmentError(
      "only 0 of 3 images passed quality; need at least 3; " +
      "image 1: low_quality: blur 1.0 < 20.0; contrast 0.010 < 0.060 | " +
      "image 2: no_face: no face detected | " +
      "image 3: low_quality: roll -40.0 deg exceeds +/-30.0"
    );
    expect(message).toBe(
      "Có 0/3 ảnh đạt yêu cầu, cần ít nhất 3 ảnh đạt.\n" +
      "Ảnh #1: Độ nét 1.0 thấp hơn ngưỡng 20.0; Độ tương phản 0.010 thấp hơn ngưỡng 0.060\n" +
      "Ảnh #2: Không phát hiện được khuôn mặt\n" +
      "Ảnh #3: Góc nghiêng đầu -40.0° vượt ngưỡng ±30.0°"
    );
  });

  it("preserves other errors and handles the old service response", () => {
    expect(formatEnrollmentError("Network Error")).toBe("Network Error");
    expect(formatEnrollmentError("only 0 of 3 images passed quality; need at least 3"))
      .toContain("Dịch vụ chưa trả lý do loại từng ảnh.");
  });
});
