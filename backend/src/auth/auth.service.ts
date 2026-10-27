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

@Injectable()
export class AuthService {
  constructor(
    private readonly staff: StaffRepository,
    private readonly students: StudentsRepository,
    private readonly audit: AuditService,
    private readonly auditContext: AuditContextService,
  ) {}

  async validateLocal(email: string, password: string) {
    const staff = await this.staff.findByEmail(email);
    if (staff) {
      if (staff.status === "disabled") {
        await this.recordLoginFailure(staff, email, "disabled");
        throw new UnauthorizedException("Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.");
      }
      if (!staff.password) {
        await this.recordLoginFailure(staff, email, "password_required");
        throw new UnauthorizedException("Tài khoản cán bộ này yêu cầu đăng nhập bằng Google");
      }
      if (await bcrypt.compare(password, staff.password)) {
        await this.auditContext.runAsStaff(staff, () => staff.update({ lastLoginAt: new Date() }));
        await this.recordLogin(staff, email, "local");
        return staff;
      }
      await this.recordLoginFailure(staff, email, "bad_password");
      throw new UnauthorizedException("Email hoặc mật khẩu không chính xác");
    }
    const student = await this.students.findByEmail(email);
    if (!student || student.accountType !== "registered" || student.approvalState !== "approved") {
      throw new UnauthorizedException("Không tìm thấy tài khoản nội bộ hợp lệ với email này");
    }
    if (await bcrypt.compare(password, student.password)) return student;
    throw new UnauthorizedException("Email hoặc mật khẩu không chính xác");
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
