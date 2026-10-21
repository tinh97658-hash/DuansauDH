import { Module } from "@nestjs/common";
import { StaffModule } from "../staff/staff.module.js";
import { StudentsModule } from "../students/students.module.js";
import { DataController } from "./data.controller.js";
import { PermissionsGuard } from "../common/permissions.guard.js";

@Module({ imports: [StaffModule, StudentsModule], controllers: [DataController], providers: [PermissionsGuard] })
export class ManagementModule {}
