import { RolePermissionScope } from '../database/models/role-permission-scope.model.js';
import { SCHEDULING_SCOPES, INSTITUTION_PERMISSIONS, type ScopedGrant, type SchedulingPermission } from './scheduling-scopes.js';
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Permission } from "../database/models/permission.model.js";
import { Role } from "../database/models/role.model.js";
import { StaffRole } from "../database/models/staff-role.model.js";
import { permissionAssignableToRole } from "./permissions.js";
import { workingProfileStorage } from './profile-context.js';
import { effectiveProfilePermissions } from './permission-tree.js';

export interface EffectiveAccess {
  permissions: Set<string>;
  roleCodes: string[];
  schedulingGrants?: ScopedGrant[];
  academicGrants?: Array<{ roleId: string; permission: string; scope: 'institution' }>;
  groupScope?: { restrictView: boolean; restrictEdit: boolean; readOnly: boolean };
}

const CACHE_TTL_MS = 30_000;

/**
 * Request người dùng chỉ phân giải vai trò của hồ sơ đang chọn. Tác vụ nội bộ
 * không có request context giữ chế độ tương thích; không dùng chế độ này qua HTTP.
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

  async effectiveAccess(staff: { id: string; role?: string; sessionVersion?: number }, fresh = false): Promise<EffectiveAccess> {
    const profile=workingProfileStorage.getStore();
    const scoped=profile?.staffId===staff.id;
    if(scoped&&(!profile.roleId||profile.selectionRequired))return {permissions:new Set(),roleCodes:[],groupScope:{restrictView:true,restrictEdit:true,readOnly:true}};
    const key = `${staff.id}:${staff.sessionVersion ?? 0}:${scoped?profile.roleId:'internal'}`;
    const cached = this.cache.get(key);
    if (!scoped && !fresh && cached && cached.expiresAt > Date.now()) return cached.access;
    const access = await this.compute(staff);
    this.cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, access });
    return access;
  }

  async availableRoles(staff: {id:string;role?:string}) {
    const assignments = await this.staffRoles.findAll({
      where: { staffId: staff.id },
      include: [{ model: Role, as: "role", include: [{ model: Permission, as: "permissions" }, { model: RolePermissionScope, as: "permissionScopes" }] }],
    });
    let roleModels = assignments.map((assignment) => assignment.role).filter(Boolean) as Role[];
    if (!assignments.length && staff.role) {
      const fallback = await this.roles.findOne({
        where: { code: staff.role },
        include: [{ model: Permission, as: "permissions" }, { model: RolePermissionScope, as: "permissionScopes" }],
      });
      if (fallback) roleModels = [fallback];
    }

    return roleModels.filter(role=>role.active===true);
  }

  async profiles(staff:{id:string;role?:string}){
    return (await this.availableRoles(staff)).map(role=>({id:role.id,name:role.name,code:role.code,
      scopeLabel:role.restrictGroupView?'Lớp được phân công phụ trách':'Theo phạm vi quyền được cấp',readOnly:role.groupReadOnly===true}));
  }

  private async compute(staff: { id: string; role?: string }) {
    let roleModels=await this.availableRoles(staff);
    const profile=workingProfileStorage.getStore();
    const scoped=profile?.staffId===staff.id;
    if(scoped)roleModels=roleModels.filter(role=>role.id===profile.roleId);
    let permissions = new Set<string>();
    for (const role of roleModels) {
      for (const permission of role.permissions ?? []) if (permissionAssignableToRole(permission.code, role.code)) permissions.add(permission.code);
    }
    if(scoped)permissions=effectiveProfilePermissions(permissions);
    const academicGrants = roleModels.flatMap(role => (role.permissions ?? [])
      .filter(permission => permissions.has(permission.code) && INSTITUTION_PERMISSIONS.has(permission.code) && permissionAssignableToRole(permission.code, role.code))
      .map(permission => ({ roleId: role.id, permission: permission.code, scope: 'institution' as const })));
    const schedulingGrants: ScopedGrant[] = academicGrants
      .filter(grant => Object.hasOwn(SCHEDULING_SCOPES, grant.permission))
      .map(grant => ({ ...grant, permission: grant.permission as SchedulingPermission }));
    return { schedulingGrants, academicGrants, permissions, roleCodes: roleModels.map((role) => role.code), groupScope: {
      restrictView: roleModels.some(role => role.restrictGroupView === true),
      restrictEdit: roleModels.some(role => role.restrictGroupEdit === true),
      readOnly: roleModels.some(role => role.groupReadOnly === true),
    } };
  }
}
