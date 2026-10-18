import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { Role } from "../database/models/role.model.js";
import { Staff } from "../database/models/staff.model.js";
import { StaffRole } from "../database/models/staff-role.model.js";
import { AccountsController } from "./accounts.controller.js";
import { AccountsService } from "./accounts.service.js";

@Module({
  imports: [SequelizeModule.forFeature([Staff, Role, StaffRole])],
  controllers: [AccountsController],
  providers: [AccountsService, PermissionsGuard],
  exports: [AccountsService],
})
export class AccountsModule {}
