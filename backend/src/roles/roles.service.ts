import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/sequelize";
import { col, fn, Op } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { AuditService } from "../audit/audit.service.js";
import { Permission } from "../database/models/permission.model.js";
import { Role } from "../database/models/role.model.js";
import { RolePermission } from "../database/models/role-permission.model.js";
import { StaffRole } from "../database/models/staff-role.model.js";
import { RbacService } from "../auth/rbac.service.js";
import { CreateRoleDto, SetRolePermissionsDto, UpdateRoleDto } from "./dto/role.dto.js";

export interface RequestContext {
  ip?: string | null;
  userAgent?: string | null;
}

const PERMISSION_ATTRIBUTES = ["id", "code", "name", "group"];
const PERMISSION_INCLUDE = {
  model: Permission,
  as: "permissions",
  attributes: PERMISSION_ATTRIBUTES,
  through: { attributes: [] },
};

const serializeRole = (role: Role) => {
  const value: any = role.get({ plain: true });
  return {
    id: value.id,
    code: value.code,
    name: value.name,
    description: value.description,
    isSystem: value.isSystem,
    isSuperadmin: value.isSuperadmin,
    active: value.active,
    sortOrder: value.sortOrder,
    permissions: (value.permissions ?? []).map((permission: any) => ({
      id: permission.id,
      code: permission.code,
      name: permission.name,
      group: permission.group,
    })),
  };
};

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role) private readonly roles: typeof Role,
    @InjectModel(Permission) private readonly permissions: typeof Permission,
    @InjectModel(RolePermission) private readonly rolePermissions: typeof RolePermission,
    @InjectModel(StaffRole) private readonly staffRoles: typeof StaffRole,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly audit: AuditService,
    private readonly rbac: RbacService,
  ) {}

  async list() {
    const roles = await this.roles.findAll({
      include: [PERMISSION_INCLUDE],
      order: [["isSystem", "DESC"], ["sortOrder", "ASC"], ["name", "ASC"]],
    });

    const counts = (await this.staffRoles.findAll({
      attributes: ["roleId", [fn("count", col("staff_id")), "total"]],
      group: ["roleId"],
      raw: true,
    })) as unknown as Array<{ roleId: string; total: string }>;
    const countByRole = new Map(counts.map((row) => [row.roleId, Number(row.total)]));

    return roles.map((role) => ({ ...serializeRole(role), staffCount: countByRole.get(role.id) ?? 0 }));
  }

  async permissionsCatalog() {
    const permissions = await this.permissions.findAll({ order: [["sortOrder", "ASC"]] });
    const groups = new Map<string, Array<{ id: string; code: string; name: string; description: string | null }>>();
    for (const permission of permissions) {
      const value: any = permission.get({ plain: true });
      if (!groups.has(value.group)) groups.set(value.group, []);
      groups.get(value.group)!.push({ id: value.id, code: value.code, name: value.name, description: value.description });
    }
    return [...groups.entries()].map(([group, items]) => ({ group, permissions: items }));
  }

  async detail(id: string) {
    const role = await this.roles.findByPk(id, { include: [PERMISSION_INCLUDE] });
    if (!role) throw new NotFoundException("Không tìm thấy vai trò.");
    return serializeRole(role);
  }

  async create(actorId: string, dto: CreateRoleDto, context: RequestContext) {
    const code = dto.code.trim().toLowerCase();
    if (await this.roles.findOne({ where: { code } })) throw new ConflictException("Mã vai trò đã tồn tại.");

    const permissionIds = [...new Set(dto.permissionIds ?? [])];
    if (permissionIds.length) await this.assertPermissionsExist(permissionIds);

    const created = await this.sequelize.transaction(async (transaction) => {
      const role = await this.roles.create({
        code,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        isSystem: false,
        isSuperadmin: false,
        active: true,
        sortOrder: 100,
      } as any, { transaction });
      if (permissionIds.length) {
        await this.rolePermissions.bulkCreate(
          permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
          { transaction },
        );
      }
      return role;
    });

    await this.audit.record({
      actorStaffId: actorId,
      action: "role.create",
      metadata: { roleId: created.id, code, permissionIds },
      ...context,
    });
    return { message: "Tạo vai trò thành công", data: await this.detail(created.id) };
  }

  async update(actorId: string, id: string, dto: UpdateRoleDto, context: RequestContext) {
    const role = await this.roles.findByPk(id);
    if (!role) throw new NotFoundException("Không tìm thấy vai trò.");

    const changes: Record<string, unknown> = {};
    if (dto.name !== undefined) changes.name = dto.name.trim();
    if (dto.description !== undefined) changes.description = dto.description?.trim() ?? null;
    if (dto.active !== undefined) {
      if (role.isSystem && !dto.active) throw new ConflictException("Không thể vô hiệu hóa vai trò hệ thống.");
      changes.active = dto.active;
    }

    let permissionIds: string[] | undefined;
    if (dto.permissionIds) {
      permissionIds = [...new Set(dto.permissionIds)];
      if (permissionIds.length) await this.assertPermissionsExist(permissionIds);
    }

    await this.sequelize.transaction(async (transaction) => {
      if (Object.keys(changes).length) await role.update(changes, { transaction });
      if (permissionIds) {
        await this.rolePermissions.destroy({ where: { roleId: id }, transaction });
        if (permissionIds.length) {
          await this.rolePermissions.bulkCreate(
            permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
            { transaction },
          );
        }
      }
    });

    this.rbac.invalidate();
    await this.audit.record({
      actorStaffId: actorId,
      action: "role.update",
      metadata: { roleId: id, ...changes, permissionIds },
      ...context,
    });
    return { message: "Cập nhật vai trò thành công", data: await this.detail(id) };
  }

  async setPermissions(actorId: string, id: string, dto: SetRolePermissionsDto, context: RequestContext) {
    const role = await this.roles.findByPk(id);
    if (!role) throw new NotFoundException("Không tìm thấy vai trò.");

    const permissionIds = [...new Set(dto.permissionIds)];
    if (permissionIds.length) await this.assertPermissionsExist(permissionIds);

    await this.sequelize.transaction(async (transaction) => {
      await this.rolePermissions.destroy({ where: { roleId: id }, transaction });
      if (permissionIds.length) {
        await this.rolePermissions.bulkCreate(
          permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
          { transaction },
        );
      }
    });

    this.rbac.invalidate();
    await this.audit.record({
      actorStaffId: actorId,
      action: "role.permissions.update",
      metadata: { roleId: id, permissionIds },
      ...context,
    });
    return { message: "Cập nhật quyền cho vai trò thành công", data: await this.detail(id) };
  }

  async remove(actorId: string, id: string, context: RequestContext) {
    const role = await this.roles.findByPk(id);
    if (!role) throw new NotFoundException("Không tìm thấy vai trò.");
    if (role.isSystem) throw new ConflictException("Không thể xóa vai trò hệ thống.");

    const assigned = await this.staffRoles.count({ where: { roleId: id } });
    if (assigned > 0) throw new ConflictException("Vai trò đang được gán cho nhân sự, không thể xóa.");

    await this.sequelize.transaction(async (transaction) => {
      await this.rolePermissions.destroy({ where: { roleId: id }, transaction });
      await role.destroy({ transaction });
    });

    this.rbac.invalidate();
    await this.audit.record({
      actorStaffId: actorId,
      action: "role.delete",
      metadata: { roleId: id, code: role.code },
      ...context,
    });
    return { message: "Đã xóa vai trò." };
  }

  private async assertPermissionsExist(permissionIds: string[]) {
    const found = await this.permissions.count({ where: { id: { [Op.in]: permissionIds } } });
    if (found !== permissionIds.length) throw new BadRequestException("Một số quyền không tồn tại.");
  }
}
