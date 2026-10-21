import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { Permission } from "../database/models/permission.model.js";
import { Role } from "../database/models/role.model.js";
import { RolePermission } from "../database/models/role-permission.model.js";
import { StaffRole } from "../database/models/staff-role.model.js";
import { RolesController } from "./roles.controller.js";
import { RolesService } from "./roles.service.js";

@Module({
  imports: [SequelizeModule.forFeature([Role, Permission, RolePermission, StaffRole])],
  controllers: [RolesController],
  providers: [RolesService, PermissionsGuard],
  exports: [RolesService],
})
export class RolesModule {}
