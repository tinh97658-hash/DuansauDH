import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { Staff } from "../database/models/staff.model.js";
import { Student } from "../database/models/student.model.js";
import { NotificationModule } from "../notifications/notification.module.js";
import { StaffRepository } from "./staff.repository.js";
import { StaffService } from "./staff.service.js";

@Module({
  imports: [SequelizeModule.forFeature([Staff, Student]), NotificationModule],
  providers: [StaffRepository, StaffService],
  exports: [StaffRepository, StaffService],
})
export class StaffModule {}
