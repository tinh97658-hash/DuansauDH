import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Permission } from "../database/models/permission.model.js";
import { Role } from "../database/models/role.model.js";
import { StaffRole } from "../database/models/staff-role.model.js";

export interface EffectiveAccess {
  permissions: Set<string>;
  roleCodes: string[];
  groupScope?: { restrictView: boolean; restrictEdit: boolean; readOnly: boolean };
}

const CACHE_TTL_MS = 30_000;

/**
 * Phân giải quyền hiệu lực của một cán bộ: hợp quyền của mọi vai trò được gán.
 * Fallback sang cột `staff.role` cho dữ liệu cũ chưa có bản ghi `staff_roles`.
 */
@Injectable()
export class RbacService {
  private readonly cache = new Map<string, { expiresAt: number; access: EffectiveAccess }>();

  constructor(
    @InjectModel(Role) private readonly roles: typeof Role,
    @InjectModel(StaffRole) private readonly staffRoles: typeof StaffRole,
  ) {}

  invalidate(staffId?: string) {
    if (staffId) {
      for (const key of this.cache.keys()) if (key.startsWith(`${staffId}:`)) this.cache.delete(key);
    }
    else this.cache.clear();
  }

  async effectiveAccess(staff: { id: string; role?: string; sessionVersion?: number }): Promise<EffectiveAccess> {
    const key = `${staff.id}:${staff.sessionVersion ?? 0}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.access;
    const access = await this.compute(staff);
    this.cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, access });
    return access;
  }

  private async compute(staff: { id: string; role?: string }): Promise<EffectiveAccess> {
    const assignments = await this.staffRoles.findAll({
      where: { staffId: staff.id },
      include: [{ model: Role, as: "role", include: [{ model: Permission, as: "permissions" }] }],
    });
    let roleModels = assignments.map((assignment) => assignment.role).filter(Boolean) as Role[];
    if (!roleModels.length && staff.role) {
      const fallback = await this.roles.findOne({
        where: { code: staff.role },
        include: [{ model: Permission, as: "permissions" }],
      });
      if (fallback) roleModels = [fallback];
    }

    roleModels = roleModels.filter((role) => role.active === true);
    const permissions = new Set<string>();
    for (const role of roleModels) {
      for (const permission of role.permissions ?? []) permissions.add(permission.code);
    }
    return { permissions, roleCodes: roleModels.map((role) => role.code), groupScope: {
      restrictView: roleModels.some(role => role.restrictGroupView === true),
      restrictEdit: roleModels.some(role => role.restrictGroupEdit === true),
      readOnly: roleModels.some(role => role.groupReadOnly === true),
    } };
  }
}
