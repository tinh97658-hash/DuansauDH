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
  capture_reused?: boolean;
  threshold_accept?: number | null;
  threshold_review?: number | null;
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

export interface FaceEnrollmentConflict {
  subjectId: string;
  displayName: string;
  similarity: number;
}

export interface CaptureAnalysis {
  status: string;
  face_count: number;
  quality_ok: boolean;
  quality_reason: string;
  quality: Record<string, number>;
  quality_score: number | null;
  yaw_signed: number;
  bbox: number[] | null;
  capture_token?: string | null;
}

export class FaceNotFoundError extends Error {}

@Injectable()
export class FaceClientService {
  private readonly logger = new Logger(FaceClientService.name);

  constructor(private readonly config: ConfigService) {}

  async analyze(image: EnrollImage, purpose: "enroll" | "recognize", captureContext?: string): Promise<CaptureAnalysis> {
    const form = new FormData();
    form.append("image", new Blob([new Uint8Array(image.buffer)], { type: image.contentType }), image.filename);
    form.append("purpose", purpose);
    if (captureContext) form.append("capture_context", captureContext);
    return this.request<CaptureAnalysis>("/api/integration/v1/analyze", { method: "POST", body: form });
  }

  async recognize(input: {
    image: Buffer;
    filename?: string;
    contentType?: string;
    deviceId: string;
    allowedSubjects: string[];
    captureToken?: string;
    captureContext?: string;
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
    if (input.captureToken) form.append("capture_token", input.captureToken);
    if (input.captureContext) form.append("capture_context", input.captureContext);

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

  /**
   * Enrollment guard: compare every enrollment frame with the other active
   * subjects and return the strongest cross-subject matches. The face-service
   * only enforces unique `external_code`; it does not reject two subjects that
   * share the same face, so PGSMS must do it before writing templates.
   */
  async findEnrollmentConflicts(input: {
    images: EnrollImage[];
    excludeSubjectId: string;
    threshold: number;
  }): Promise<FaceEnrollmentConflict[]> {
    if (!input.images.length || input.threshold <= 0) return [];

    const subjects = await this.listSubjects(true);
    const allowedSubjects = subjects
      .map((subject) => subject.subject_id)
      .filter((subjectId) => subjectId !== input.excludeSubjectId);
    if (!allowedSubjects.length) return [];

    const conflicts = new Map<string, FaceEnrollmentConflict>();
    for (const image of input.images) {
      const decision = await this.recognize({
        image: image.buffer,
        filename: image.filename,
        contentType: image.contentType,
        deviceId: "enrollment-duplicate-check",
        allowedSubjects,
      });
      for (const candidate of decision.candidates ?? []) {
        if (candidate.subject_id === input.excludeSubjectId) continue;
        if (candidate.similarity < input.threshold) continue;
        const existing = conflicts.get(candidate.subject_id);
        if (!existing || candidate.similarity > existing.similarity) {
          conflicts.set(candidate.subject_id, {
            subjectId: candidate.subject_id,
            displayName: candidate.display_name,
            similarity: candidate.similarity,
          });
        }
      }
    }

    return [...conflicts.values()].sort((a, b) => b.similarity - a.similarity);
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
    try {
      const params = new URLSearchParams();
      if (input.subjectId) params.set("subject_id", input.subjectId);
      params.set("limit", String(input.limit ?? 50));
      const body = await this.request<{ events: BiometricAudit[] }>(
        `/api/integration/v1/audit?${params.toString()}`,
        { method: "GET" },
      );
      return body.events;
    } catch (error) {
      if (error instanceof FaceNotFoundError) return [];
      throw error;
    }
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
