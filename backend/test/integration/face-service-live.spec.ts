import { describe, expect, it } from "@jest/globals";
import { ConfigService } from "@nestjs/config";
import { FaceClientService } from "../../src/attendance/face-client.service.js";

describe("Live Face-Service Integration (Docker 127.0.0.1:8010)", () => {
  const config = {
    get: (key: string) => {
      if (key === "FACE_SERVICE_URL") return "http://127.0.0.1:8010";
      if (key === "FACE_SERVICE_API_KEY") return "local-integration-smoke-key-123";
      if (key === "FACE_SERVICE_TIMEOUT_MS") return "15000";
      return undefined;
    },
  } as unknown as ConfigService;

  const client = new FaceClientService(config);
  const testSubjectId = `student:test-${Date.now()}`;

  // Helper to generate a minimal valid JPEG
  function makeJpeg(color: number): Buffer {
    // 1x1 dummy JPEG or small canvas
    // Valid 64x64 JPEG header + pixels
    const width = 64;
    const height = 64;
    // We can use a pre-encoded minimal JPEG buffer
    const minimalJpeg = Buffer.from(
      "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAAEAAQBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
      "base64"
    );
    return minimalJpeg;
  }

  it("successfully connects to live face-service and lists subjects", async () => {
    const subjects = await client.listSubjects(false);
    expect(Array.isArray(subjects)).toBe(true);
  });

  it("handles empty audit list for non-existent subject without error", async () => {
    const audit = await client.listAudit({ subjectId: "student:non-existent", limit: 5 });
    expect(Array.isArray(audit)).toBe(true);
    expect(audit.length).toBe(0);
  });

  it("withdraws non-existent subject idempotently", async () => {
    const result = await client.withdraw("student:non-existent-subject");
    expect(result.withdrawn).toBe(false);
    expect(result.templates_deleted).toBe(0);
  });
});
