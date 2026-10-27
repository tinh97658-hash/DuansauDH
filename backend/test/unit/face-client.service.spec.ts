import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import { ServiceUnavailableException, BadGatewayException, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FaceClientService, FaceNotFoundError } from "../../src/attendance/face-client.service.js";

describe("FaceClientService", () => {
  let config: ConfigService;
  let service: FaceClientService;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    config = {
      get: jest.fn((key: string) => {
        if (key === "FACE_SERVICE_URL") return "http://face-service:8000";
        if (key === "FACE_SERVICE_API_KEY") return "test-secret-api-key-16-chars";
        if (key === "FACE_SERVICE_TIMEOUT_MS") return "5000";
        return undefined;
      }),
    } as unknown as ConfigService;
    service = new FaceClientService(config);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("throws ServiceUnavailableException when FACE_SERVICE_API_KEY is missing", async () => {
    (config.get as any).mockReturnValue(undefined);
    await expect(
      service.recognize({
        image: Buffer.from("fake-image"),
        deviceId: "cam-1",
        allowedSubjects: ["student:123"],
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it("parses recognize response successfully", async () => {
    globalThis.fetch = jest.fn<any>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        decision: {
          decision: "ACCEPT",
          reason: "accepted",
          subject: { subject_id: "student:123", display_name: "Nguyen Van A" },
          candidate: null,
          candidates: [{ subject_id: "student:123", display_name: "Nguyen Van A", similarity: 0.85 }],
          similarity: 0.85,
          margin: 0.5,
          quality: {},
          quality_score: 0.9,
          logged: true,
          event_id: 101,
          model_version: "test-model",
        },
      }),
    });

    const result = await service.recognize({
      image: Buffer.from("fake-image"),
      deviceId: "cam-1",
      allowedSubjects: ["student:123"],
    });

    expect(result.decision).toBe("ACCEPT");
    expect(result.subject?.subject_id).toBe("student:123");
    expect(result.similarity).toBe(0.85);
  });

  it("handles 404 in withdraw idempotently", async () => {
    globalThis.fetch = jest.fn<any>().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ detail: "subject not found" }),
    });

    const result = await service.withdraw("student:nonexistent");
    expect(result).toEqual({
      subject_id: "student:nonexistent",
      withdrawn: false,
      templates_deleted: 0,
    });
  });

  it("translates 422 to BadRequestException", async () => {
    globalThis.fetch = jest.fn<any>().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: "insufficient valid face images" }),
    });

    await expect(
      service.enroll({
        subjectId: "student:123",
        displayName: "A",
        images: [
          { buffer: Buffer.from("1"), filename: "1.jpg", contentType: "image/jpeg" },
          { buffer: Buffer.from("2"), filename: "2.jpg", contentType: "image/jpeg" },
          { buffer: Buffer.from("3"), filename: "3.jpg", contentType: "image/jpeg" },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
