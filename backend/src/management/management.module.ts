import { Module } from "@nestjs/common";
import { StaffModule } from "../staff/staff.module.js";
import { StudentsModule } from "../students/students.module.js";
import { AdminController } from "./admin.controller.js";
import { DataController } from "./data.controller.js";
import { RolesGuard } from "../common/roles.guard.js";

@Module({ imports: [StaffModule, StudentsModule], controllers: [AdminController, DataController], providers: [RolesGuard] })
export class ManagementModule {}
