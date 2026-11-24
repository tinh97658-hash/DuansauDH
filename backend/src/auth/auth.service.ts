import { Injectable, UnauthorizedException } from "@nestjs/common";
import bcrypt from "bcrypt";
import { AuditContextService } from "../audit/audit-context.js";
import { AuditService } from "../audit/audit.service.js";
import type { Staff } from "../database/models/staff.model.js";
import { StaffRepository } from "../staff/staff.repository.js";
import { StudentsRepository } from "../students/students.repository.js";

interface AuditInput {
  action: string;
  actorStaffId?: string | null;
  targetStaffId?: string | null;
  metadata?: Record<string, unknown> | null;
}

const INVALID_CREDENTIALS_MESSAGE = "Email hoặc mật khẩu không chính xác";
// Valid bcrypt(cost=12) hash used to equalize response timing when no local password matches.
const DUMMY_BCRYPT_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKxGhu6D6pY2P3p4C8k3q3fP0z2y1Q7m8vK6u";
const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly failedAttempts = new Map<string, { count: number; expiresAt: number }>();

  constructor(
    private readonly staff: StaffRepository,
    private readonly students: StudentsRepository,
    private readonly audit: AuditService,
    private readonly auditContext: AuditContextService,
  ) {}

  private isLockedOut(key: string): boolean {
    const entry = this.failedAttempts.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.failedAttempts.delete(key);
      return false;
    }
    return entry.count >= MAX_FAILED_ATTEMPTS;
  }

  private recordAttemptFailure(key: string): void {
    const now = Date.now();
    const existing = this.failedAttempts.get(key);
    if (!existing || now > existing.expiresAt) {
      this.failedAttempts.set(key, { count: 1, expiresAt: now + LOCKOUT_WINDOW_MS });
      return;
    }
    existing.count += 1;
    existing.expiresAt = now + LOCKOUT_WINDOW_MS;
  }

  private clearAttemptFailures(key: string): void {
    this.failedAttempts.delete(key);
  }

  async validateLocal(email: string, password: string) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (this.isLockedOut(normalizedEmail)) {
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const staff = await this.staff.findByEmail(email);
    if (staff) {
      if (staff.status === "disabled") {
        await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
        this.recordAttemptFailure(normalizedEmail);
        await this.recordLoginFailure(staff, email, "disabled");
        throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
      }
      if (!staff.password) {
        await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
        this.recordAttemptFailure(normalizedEmail);
        await this.recordLoginFailure(staff, email, "password_required");
        throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
      }
      if (await bcrypt.compare(password, staff.password)) {
        this.clearAttemptFailures(normalizedEmail);
        await this.auditContext.runAsStaff(staff, () => staff.update({ lastLoginAt: new Date() }));
        await this.recordLogin(staff, email, "local");
        return staff;
      }
      this.recordAttemptFailure(normalizedEmail);
      await this.recordLoginFailure(staff, email, "bad_password");
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
    const student = await this.students.findByEmail(email);
    if (!student || student.accountType !== "registered" || student.approvalState !== "approved") {
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      this.recordAttemptFailure(normalizedEmail);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
    if (await bcrypt.compare(password, student.password)) {
      this.clearAttemptFailures(normalizedEmail);
      return student;
    }
    this.recordAttemptFailure(normalizedEmail);
    throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
  }

  async validateGoogle(email: string) {
    const staff = await this.staff.findByEmail(email);
    if (!staff) throw new UnauthorizedException("Tài khoản cán bộ chưa được cấp quyền sử dụng hệ thống");
    if (staff.status === "disabled") {
      await this.recordLoginFailure(staff, email, "disabled");
      throw new UnauthorizedException("Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.");
    }
    await this.auditContext.runAsStaff(staff, () => staff.update({ lastLoginAt: new Date() }));
    await this.recordLogin(staff, email, "google");
    return staff;
  }

  /** Ghi nhật ký đăng xuất cho tài khoản nhân sự (best-effort). */
  async recordLogout(staff: Staff) {
    if (!staff?.id) return;
    await this.record({
      action: "account.logout",
      actorStaffId: staff.id,
      targetStaffId: staff.id,
      metadata: { email: staff.email },
    });
  }

  async deserialize(key: string) {
    const parts = String(key).split(":");
    const [type, id, version] = parts;
    if (parts.length !== 3 || !id || !/^\d+$/.test(version || "")) return null;
    if (type === "student") {
      const student = await this.students.findById(id);
      if (!student || student.accountType !== "registered" || student.approvalState !== "approved" ||
        Number(version) !== student.sessionVersion) return null;
      return student;
    }
    if (type !== "staff") return null;

    const staff = await this.staff.findById(id);
    if (!staff || staff.status !== "active") return null;
    if (Number(version) !== staff.sessionVersion) return null;
    return staff;
  }

  private recordLogin(staff: Staff, email: string, provider: string) {
    return this.record({ action: "account.login", actorStaffId: staff.id, targetStaffId: staff.id, metadata: { email, provider } });
  }

  private recordLoginFailure(staff: Staff, email: string, reason: string) {
    return this.record({ action: "account.login.failed", targetStaffId: staff.id, metadata: { email, reason } });
  }

  /** Ghi nhật ký là best-effort: không được chặn đăng nhập/đăng xuất nếu ghi lỗi. */
  private async record(entry: AuditInput) {
    try {
      const context = this.auditContext.current();
      await this.audit.record({
        actorStaffId: entry.actorStaffId ?? null,
        targetStaffId: entry.targetStaffId ?? null,
        action: entry.action,
        metadata: entry.metadata ?? null,
        ip: context?.ip ?? null,
        userAgent: context?.userAgent ?? null,
      });
    } catch {
      // Bỏ qua lỗi ghi nhật ký.
    }
  }
}
