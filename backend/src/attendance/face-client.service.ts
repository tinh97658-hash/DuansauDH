// NestJS client for the internal face-service.

import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type FaceDecision = "ACCEPT" | "REVIEW" | "UNKNOWN" | "ERROR";

export interface FaceSubject {
  subject_id: string;
  display_name: string;
  active: boolean;
  template_count: number;
  created_at: string;
}

export interface FaceCandidate {
  subject_id: string;
  display_name: string;
  similarity: number;
}

export interface FaceDecisionPayload {
  decision: FaceDecision;
  reason: string | null;
  subject: { subject_id: string; display_name: string } | null;
  candidate: { subject_id: string; display_name: string } | null;
  candidates: FaceCandidate[];
  similarity: number | null;
  margin: number | null;
  quality: Record<string, number>;
  quality_score: number | null;
  logged: boolean;
  event_id: number | null;
  model_version: string;
}

export interface FaceEnrollmentPayload {
  subject: FaceSubject;
  templates_added: number;
  template_count: number;
  rejected_images: Array<{ index: number; reason: string }>;
}

export type BiometricAuditAction = "ENROLL" | "REPLACE" | "WITHDRAW";

export interface BiometricAudit {
  audit_id: number;
  subject_id: string;
  action: BiometricAuditAction;
  actor: string | null;
  templates_before: number;
  templates_after: number;
  templates_added: number;
  templates_deleted: number;
  model_version: string | null;
  created_at: string;
}

export interface EnrollImage {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export class FaceNotFoundError extends Error {}

@Injectable()
export class FaceClientService {
  private readonly logger = new Logger(FaceClientService.name);

  constructor(private readonly config: ConfigService) {}

  async recognize(input: {
    image: Buffer;
    filename?: string;
    contentType?: string;
    deviceId: string;
    allowedSubjects: string[];
  }): Promise<FaceDecisionPayload> {
    const form = new FormData();
    form.append(
      "image",
      new Blob([new Uint8Array(input.image)], {
        type: input.contentType ?? "image/jpeg",
      }),
      input.filename ?? "probe.jpg",
    );
    form.append("device_id", input.deviceId);
    form.append("allowed_subjects", JSON.stringify(input.allowedSubjects));

    const body = await this.request<{ decision: FaceDecisionPayload }>(
      "/api/integration/v1/recognize",
      { method: "POST", body: form },
    );
    return body.decision;
  }

  async enroll(input: {
    subjectId: string;
    displayName: string;
    images: EnrollImage[];
    replace?: boolean;
    actorId?: string;
  }): Promise<FaceEnrollmentPayload> {
    if (input.images.length < 3 || input.images.length > 5) {
      throw new BadRequestException("enrollment requires 3-5 images");
    }

    const form = new FormData();
    form.append("display_name", input.displayName);
    form.append("replace", String(input.replace ?? true));
    for (const image of input.images) {
      form.append(
        "images",
        new Blob([new Uint8Array(image.buffer)], { type: image.contentType }),
        image.filename,
      );
    }

    return this.request<FaceEnrollmentPayload>(
      `/api/integration/v1/subjects/${encodeURIComponent(input.subjectId)}/enroll`,
      { method: "POST", body: form },
      input.actorId,
    );
  }

  async withdraw(
    subjectId: string,
    actorId?: string,
  ): Promise<{
    subject_id: string;
    withdrawn: boolean;
    templates_deleted: number;
  }> {
    try {
      return await this.request<{
        subject_id: string;
        withdrawn: boolean;
        templates_deleted: number;
      }>(
        `/api/integration/v1/subjects/${encodeURIComponent(subjectId)}`,
        { method: "DELETE" },
        actorId,
      );
    } catch (error) {
      // DELETE is idempotent for retention cleanup: a subject that is already
      // absent has zero templates left to delete.
      if (error instanceof FaceNotFoundError) {
        return { subject_id: subjectId, withdrawn: false, templates_deleted: 0 };
      }
      throw error;
    }
  }

  async listAudit(input: {
    subjectId?: string;
    limit?: number;
  } = {}): Promise<BiometricAudit[]> {
    const params = new URLSearchParams();
    if (input.subjectId) params.set("subject_id", input.subjectId);
    params.set("limit", String(input.limit ?? 50));
    const body = await this.request<{ events: BiometricAudit[] }>(
      `/api/integration/v1/audit?${params.toString()}`,
      { method: "GET" },
    );
    return body.events;
  }

  async getSubject(subjectId: string): Promise<FaceSubject | null> {
    try {
      const body = await this.request<{ subject: FaceSubject }>(
        `/api/integration/v1/subjects/${encodeURIComponent(subjectId)}`,
        { method: "GET" },
      );
      return body.subject;
    } catch (error) {
      if (error instanceof FaceNotFoundError) return null;
      throw error;
    }
  }

  async listSubjects(activeOnly = true): Promise<FaceSubject[]> {
    const query = activeOnly ? "?active_only=true" : "?active_only=false";
    const body = await this.request<{ subjects: FaceSubject[] }>(
      `/api/integration/v1/subjects${query}`,
      { method: "GET" },
    );
    return body.subjects;
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    actorId?: string,
  ): Promise<T> {
    const url = `${this.baseUrl()}${path}`;
    const apiKey = this.config.get<string>("FACE_SERVICE_API_KEY");
    if (!apiKey) {
      throw new ServiceUnavailableException("face-service is not configured");
    }

    const headers: Record<string, string> = {
      "X-API-Key": apiKey,
      Accept: "application/json",
    };
    if (actorId) headers["X-Actor-Id"] = actorId;

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers,
        signal: AbortSignal.timeout(this.timeoutMs()),
      });
    } catch {
      this.logger.error(`face-service request failed: ${path}`);
      throw new BadGatewayException("face-service unavailable");
    }

    if (!response.ok) {
      const detail = await this.safeDetail(response);
      if (response.status === 404) {
        throw new FaceNotFoundError(detail);
      }
      if (response.status === 401 || response.status === 503) {
        this.logger.error(`face-service auth/config error: ${response.status}`);
        throw new ServiceUnavailableException("face-service unavailable");
      }
      if (response.status === 422 || response.status === 400) {
        throw new BadRequestException(detail);
      }
      this.logger.error(`face-service error: ${response.status}`);
      throw new BadGatewayException("face-service error");
    }

    return (await response.json()) as T;
  }

  private baseUrl(): string {
    const value = this.config.get<string>("FACE_SERVICE_URL") ?? "http://face-service:8000";
    return value.replace(/\/+$/, "");
  }

  private timeoutMs(): number {
    const parsed = Number(this.config.get<string>("FACE_SERVICE_TIMEOUT_MS") ?? "15000");
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 15000;
  }

  private async safeDetail(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { detail?: unknown };
      return typeof body.detail === "string" ? body.detail : `HTTP ${response.status}`;
    } catch {
      return `HTTP ${response.status}`;
    }
  }
}
