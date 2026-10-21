import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/sequelize";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { col, fn, Op, where, Transaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { AuditService } from "../audit/audit.service.js";
import { ChangeLogService } from "../audit/change-log.service.js";
import { AdministrationSafetyService } from "../auth/administration-safety.service.js";
import { RbacService } from "../auth/rbac.service.js";
import { Role } from "../database/models/role.model.js";
import { Staff } from "../database/models/staff.model.js";
import { StaffRole } from "../database/models/staff-role.model.js";
import {
  AccountListQueryDto,
  AuditLogQueryDto,
  ChangeLogQueryDto,
  ChangeOwnPasswordDto,
  CreateAccountDto,
  ResetAccountPasswordDto,
  UpdateAccountDto,
  UpdateAccountStatusDto,
} from "./dto/account.dto.js";

export interface RequestContext {
  ip?: string | null;
  userAgent?: string | null;
}

const ROLE_INCLUDE = { model: Role, as: "roles", through: { attributes: [] } };
const ROLE_ATTRIBUTES = ["id", "code", "name", "active"];

const generatePassword = () => randomBytes(9).toString("base64url");

const serializeAccount = (staff: Staff) => {
  const value: any = staff.get({ plain: true });
  return {
    id: value.id,
    name: value.name,
    email: value.email,
    role: value.role,
    status: value.status,
    mustChangePassword: value.mustChangePassword,
    lastLoginAt: value.lastLoginAt,
    passwordChangedAt: value.passwordChangedAt,
    canManageScheduling: value.canManageScheduling,
    createdAt: value.createdAt,
    roles: (value.roles ?? []).map((role: any) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      active: role.active,
    })),
  };
};

@Injectable()
export class AccountsService {
  constructor(
    @InjectModel(Staff) private readonly staff: typeof Staff,
    @InjectModel(Role) private readonly roles: typeof Role,
    @InjectModel(StaffRole) private readonly staffRoles: typeof StaffRole,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly audit: AuditService,
    private readonly changeLogService: ChangeLogService,
    private readonly rbac: RbacService,
    private readonly administrationSafety: AdministrationSafetyService,
  ) {}

  async list(query: AccountListQueryDto) {
    const conditions: any = {};
    if (query.status) conditions.status = query.status;

    const keyword = query.search?.trim();
    if (keyword) {
      conditions[Op.or] = [
        { name: { [Op.iLike]: `%${keyword}%` } },
        { email: { [Op.iLike]: `%${keyword}%` } },
      ];
    }

    if (query.roleId) {
      const memberships = await this.staffRoles.findAll({ where: { roleId: query.roleId }, attributes: ["staffId"] });
      const staffIds = memberships.map((membership) => membership.staffId);
      if (!staffIds.length) return [];
      conditions.id = { [Op.in]: staffIds };
    }

    const staff = await this.staff.scope("withoutPassword").findAll({
      where: conditions,
      include: [{ ...ROLE_INCLUDE, attributes: ROLE_ATTRIBUTES }],
      order: [["name", "ASC"]],
    });
    return staff.map(serializeAccount);
  }

  async detail(id: string) {
    const staff = await this.staff.scope("withoutPassword").findByPk(id, {
      include: [{ ...ROLE_INCLUDE, attributes: ROLE_ATTRIBUTES }],
    });
    if (!staff) throw new NotFoundException("Không tìm thấy tài khoản.");
    return serializeAccount(staff);
  }

  async create(actorId: string, dto: CreateAccountDto, context: RequestContext) {
    const email = dto.email.trim().toLowerCase();
    if (await this.findByEmail(email)) throw new ConflictException("Email đã được sử dụng.");

    const roleIds = [...new Set(dto.roleIds)];
    let primaryRole: Role;

    const generated = !dto.password;
    const password = dto.password ?? generatePassword();
    const hashed = await bcrypt.hash(password, 12);

    const created = await this.sequelize.transaction(async (transaction) => {
      const roles = await this.resolveRoles(roleIds, transaction);
      this.assertAssignableRoles(roles);
      primaryRole = this.pickPrimaryRole(roles, dto.primaryRoleId);
      const staff = await this.staff.create({
        name: dto.name.trim(),
        email,
        role: primaryRole.code,
        password: hashed,
        status: "active",
        mustChangePassword: true,
      } as any, { transaction });

      await this.staffRoles.bulkCreate(
        roleIds.map((roleId) => ({ staffId: staff.id, roleId })),
        { transaction },
      );
      return staff;
    });

    this.rbac.invalidate(created.id);
    await this.audit.record({
      actorStaffId: actorId,
      targetStaffId: created.id,
      action: "account.create",
      metadata: { email, roleIds, primaryRoleId: primaryRole.id, passwordGenerated: generated },
      ...context,
    });

    return {
      message: "Tạo tài khoản thành công",
      data: await this.detail(created.id),
      generatedPassword: generated ? password : undefined,
    };
  }

  async update(actorId: string, id: string, dto: UpdateAccountDto, context: RequestContext) {
    const staff = await this.staff.findByPk(id);
    if (!staff) throw new NotFoundException("Không tìm thấy tài khoản.");

    const email = dto.email ? dto.email.trim().toLowerCase() : undefined;
    if (email && email !== staff.email) {
      const duplicate = await this.findByEmail(email);
      if (duplicate && duplicate.id !== staff.id) throw new ConflictException("Email đã được sử dụng.");
    }

    let nextRoleIds: string[] | undefined;
    let primaryCode: string | undefined;
    await this.sequelize.transaction(async (transaction) => {
      let rolesChanged = false;
      let addedRoleIds: string[] = [];
      let removedRoleIds: string[] = [];
      if (dto.roleIds !== undefined || dto.primaryRoleId !== undefined) {
        await this.administrationSafety.lock(transaction);
        // Compare legacy primary state after serialization, not the pre-lock
        // snapshot, so a concurrent edit cannot restore a dormant primary.
        await staff.reload({ transaction, lock: Transaction.LOCK.UPDATE });
        const memberships = await this.staffRoles.findAll({ where: { staffId: id }, attributes: ["roleId"], transaction });
        const previousRoleIds = new Set(memberships.map((membership) => membership.roleId));
        nextRoleIds = dto.roleIds ? [...new Set(dto.roleIds)] : [...previousRoleIds];
        addedRoleIds = nextRoleIds.filter(roleId => !previousRoleIds.has(roleId));
        removedRoleIds = [...previousRoleIds].filter(roleId => !nextRoleIds.includes(roleId));
        const roles = await this.resolveRoles(nextRoleIds, transaction);
        this.assertAssignableRoles(roles, previousRoleIds);
        const assignmentsChanged = previousRoleIds.size !== nextRoleIds.length || nextRoleIds.some((roleId) => !previousRoleIds.has(roleId));
        const currentPrimary = roles.find(role => role.code === staff.role);
        // An exact legacy resubmission preserves stored history. Changing the
        // assignments or primary requires an active assigned primary instead.
        const preservingPrimary = !assignmentsChanged && currentPrimary &&
          (dto.primaryRoleId === undefined || dto.primaryRoleId === currentPrimary.id);
        const primaryRole = preservingPrimary ? currentPrimary : this.pickPrimaryRole(
          roles, dto.primaryRoleId ?? roles.find(role => role.code === staff.role && role.active === true)?.id,
        );
        primaryCode = primaryRole.code;
        rolesChanged = primaryCode !== staff.role || assignmentsChanged;
      }
      const changes: Record<string, unknown> = {};
      if (dto.name !== undefined) changes.name = dto.name.trim();
      if (email !== undefined) changes.email = email;
      if (primaryCode !== undefined) changes.role = primaryCode;
      if (Object.keys(changes).length) await staff.update(changes, { transaction });

      if (rolesChanged && nextRoleIds) {
        // Preserve retained historical membership rows and their timestamps.
        if (removedRoleIds.length) await this.staffRoles.destroy({ where: { staffId: id, roleId: { [Op.in]: removedRoleIds } }, transaction });
        if (addedRoleIds.length) await this.staffRoles.bulkCreate(
          addedRoleIds.map((roleId) => ({ staffId: id, roleId })),
          { transaction },
        );
        await staff.increment("sessionVersion", { transaction });
        await this.administrationSafety.assertRetained(transaction);
      }
    });

    this.rbac.invalidate(id);
    await this.audit.record({
      actorStaffId: actorId,
      targetStaffId: id,
      action: "account.update",
      metadata: { name: dto.name, email, roleIds: nextRoleIds, primaryRoleCode: primaryCode },
      ...context,
    });
    return { message: "Cập nhật tài khoản thành công", data: await this.detail(id) };
  }

  async updateStatus(actorId: string, id: string, dto: UpdateAccountStatusDto, context: RequestContext) {
    const staff = await this.staff.findByPk(id);
    if (!staff) throw new NotFoundException("Không tìm thấy tài khoản.");
    if (dto.status === staff.status) return { message: "Trạng thái không thay đổi", data: await this.detail(id) };

    if (dto.status === "disabled") {
      if (id === actorId) throw new ConflictException("Không thể tự khóa tài khoản đang đăng nhập.");
    }

    await this.sequelize.transaction(async (transaction) => {
      await this.administrationSafety.lock(transaction);
      await staff.update({ status: dto.status }, { transaction });
      if (dto.status === "disabled") {
        await staff.increment("sessionVersion", { transaction });
        await this.administrationSafety.assertRetained(transaction);
      }
    });

    this.rbac.invalidate(id);
    await this.audit.record({
      actorStaffId: actorId,
      targetStaffId: id,
      action: dto.status === "disabled" ? "account.disable" : "account.enable",
      ...context,
    });
    return {
      message: dto.status === "disabled" ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản.",
      data: await this.detail(id),
    };
  }

  async resetPassword(actorId: string, id: string, dto: ResetAccountPasswordDto, context: RequestContext) {
    const staff = await this.staff.findByPk(id);
    if (!staff) throw new NotFoundException("Không tìm thấy tài khoản.");

    const generated = !dto.password;
    const password = dto.password ?? generatePassword();
    const hashed = await bcrypt.hash(password, 12);

    await staff.update({
      password: hashed,
      mustChangePassword: true,
      passwordChangedAt: new Date(),
      sessionVersion: staff.sessionVersion + 1,
    });

    await this.audit.record({
      actorStaffId: actorId,
      targetStaffId: id,
      action: "account.password.reset",
      metadata: { passwordGenerated: generated },
      ...context,
    });
    return {
      message: "Đặt lại mật khẩu thành công.",
      generatedPassword: generated ? password : undefined,
    };
  }

  async changeOwnPassword(user: unknown, dto: ChangeOwnPasswordDto, context: RequestContext) {
    if (!(user instanceof Staff)) throw new ForbiddenException("Chỉ nhân sự mới đổi được mật khẩu tại đây.");
    const staff = await this.staff.findByPk(user.id);
    if (!staff) throw new NotFoundException("Không tìm thấy tài khoản.");
    if (!staff.password) throw new BadRequestException("Tài khoản dùng đăng nhập Google, không có mật khẩu nội bộ để đổi.");

    if (!(await bcrypt.compare(dto.currentPassword, staff.password))) {
      throw new BadRequestException("Mật khẩu hiện tại không đúng.");
    }
    if (await bcrypt.compare(dto.newPassword, staff.password)) {
      throw new BadRequestException("Mật khẩu mới phải khác mật khẩu hiện tại.");
    }

    await staff.update({
      password: await bcrypt.hash(dto.newPassword, 12),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    });

    await this.audit.record({
      actorStaffId: staff.id,
      targetStaffId: staff.id,
      action: "account.password.change",
      ...context,
    });
    return { message: "Đổi mật khẩu thành công." };
  }

  async revokeSessions(actorId: string, id: string, context: RequestContext) {
    const staff = await this.staff.findByPk(id);
    if (!staff) throw new NotFoundException("Không tìm thấy tài khoản.");

    await staff.update({ sessionVersion: staff.sessionVersion + 1 });
    await this.audit.record({
      actorStaffId: actorId,
      targetStaffId: id,
      action: "account.sessions.revoke",
      ...context,
    });
    return { message: "Đã buộc đăng xuất tất cả phiên của tài khoản này." };
  }

  async auditLogs(query: AuditLogQueryDto) {
    return this.audit.list(query);
  }

  async changeLogs(query: ChangeLogQueryDto) {
    return this.changeLogService.list(query);
  }

  async changeLogTables() {
    return this.changeLogService.tables();
  }

  async mePermissions(user: unknown) {
    if (!(user instanceof Staff)) return { permissions: [] as string[], roles: [] as string[] };
    const access = await this.rbac.effectiveAccess(user);
    return { permissions: [...access.permissions], roles: access.roleCodes };
  }

  // ===== Helpers =====

  private findByEmail(email: string) {
    return this.staff.findOne({ where: where(fn("lower", col("email")), email.trim().toLowerCase()) });
  }

  private async resolveRoles(roleIds: string[], transaction: Transaction) {
    // Lock role rows until the assignment commits, so concurrent deactivation
    // cannot race the active-state check. Use stable order across role sets.
    const roles = await this.roles.findAll({ where: { id: { [Op.in]: roleIds } }, transaction, lock: Transaction.LOCK.UPDATE, order: [["id", "ASC"]] });
    if (roles.length !== roleIds.length) throw new BadRequestException("Một số vai trò không tồn tại.");
    return roles;
  }

  private assertAssignableRoles(roles: Role[], existing = new Set<string>()) {
    if (roles.some(role => role.active !== true && !existing.has(role.id))) {
      throw new BadRequestException("Không thể gán vai trò đã ngừng hoạt động.");
    }
  }

  private pickPrimaryRole(roles: Role[], primaryRoleId?: string) {
    if (!roles.length) throw new BadRequestException("Phải chọn ít nhất một vai trò.");
    const primary = primaryRoleId ? roles.find((role) => role.id === primaryRoleId) : roles.find(role => role.active === true);
    if (!primary) throw new BadRequestException("Vai trò chính phải nằm trong danh sách vai trò được gán.");
    if (primary.active !== true) throw new BadRequestException("Vai trò chính phải đang hoạt động.");
    return primary;
  }

}
