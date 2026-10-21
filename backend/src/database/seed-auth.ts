import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { getConnectionToken } from "@nestjs/sequelize";
import { Sequelize } from "sequelize-typescript";
import { AppModule } from "../app.module.js";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, SYSTEM_ROLES } from "../auth/permissions.js";

/**
 * Đồng bộ catalog quyền (idempotent):
 * - Tạo/cập nhật `permissions` theo `src/auth/permissions.ts`.
 * - Đảm bảo 3 vai trò hệ thống tồn tại.
 * - Chỉ cấp quyền mặc định khi tạo vai trò mới; không khôi phục quyền đã được gỡ.
 */
async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const sequelize = app.get<Sequelize>(getConnectionToken());
    const Role = sequelize.models.Role as any;
    const Permission = sequelize.models.Permission as any;
    const RolePermission = sequelize.models.RolePermission as any;

    let createdPermissions = 0;
    for (const [index, definition] of PERMISSIONS.entries()) {
      const [record, created] = await Permission.findOrCreate({
        where: { code: definition.code },
        defaults: { ...definition, description: definition.description ?? null, sortOrder: index },
      });
      if (created) createdPermissions++;
      else await record.update({ name: definition.name, group: definition.group, description: definition.description ?? null, sortOrder: index });
    }

    let createdRoles = 0;
    const newRoleCodes = new Set<string>();
    for (const [index, definition] of SYSTEM_ROLES.entries()) {
      const [record, created] = await Role.findOrCreate({
        where: { code: definition.code },
        defaults: { ...definition, isSystem: true, sortOrder: index },
      });
      if (created) { createdRoles++; newRoleCodes.add(definition.code); }
      else await record.update({ name: definition.name, description: definition.description ?? null });
    }

    let granted = 0;
    for (const [roleCode, permissionCodes] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      if (!newRoleCodes.has(roleCode)) continue;
      const role = await Role.findOne({ where: { code: roleCode } });
      if (!role) continue;
      for (const code of permissionCodes) {
        const permission = await Permission.findOne({ where: { code } });
        if (!permission) continue;
        const [, created] = await RolePermission.findOrCreate({ where: { roleId: role.id, permissionId: permission.id } });
        if (created) granted++;
      }
    }

    console.log(`[seed-auth] permissions created=${createdPermissions}, roles created=${createdRoles}, role_permissions granted=${granted}`);
  } finally {
    await app.close();
  }
}

run().catch((error) => { console.error(`[seed-auth] ${error instanceof Error ? error.message : "Failed"}`); process.exitCode = 1; });
