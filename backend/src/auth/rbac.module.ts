import { GroupResponsibilityService } from "./group-responsibility.service.js";
import { GroupResponsibilityController } from "./group-responsibility.controller.js";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { GroupScopeService } from "./group-scope.service.js";
import { GroupScopeInterceptor } from "./group-scope.interceptor.js";
import { Global, Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { Permission } from "../database/models/permission.model.js";
import { Role } from "../database/models/role.model.js";
import { StaffRole } from "../database/models/staff-role.model.js";
import { AdministrationSafetyService } from "./administration-safety.service.js";
import { RbacService } from "./rbac.service.js";

/**
 * Module RBAC dùng chung: cung cấp `RbacService` và `PermissionsGuard` cho toàn bộ
 * ứng dụng nên các module khác không cần import lại.
 */
@Global()
@Module({
  imports: [SequelizeModule.forFeature([Role, Permission, StaffRole])],
  controllers: [GroupResponsibilityController],
  providers: [GroupResponsibilityService, GroupScopeService, { provide: APP_INTERCEPTOR, useClass: GroupScopeInterceptor }, RbacService, PermissionsGuard, AdministrationSafetyService],
  exports: [GroupScopeService, GroupResponsibilityService, RbacService, PermissionsGuard, AdministrationSafetyService],
})
export class RbacModule {}
