import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { Student } from "../database/models/student.model.js";
import { Submission } from "../database/models/submission.model.js";
import { NotificationModule } from "../notifications/notification.module.js";
import { StudentsRepository } from "./students.repository.js";
import { StudentsService } from "./students.service.js";

@Module({
  imports: [SequelizeModule.forFeature([Student, Submission]), NotificationModule],
  providers: [StudentsRepository, StudentsService],
  exports: [StudentsRepository, StudentsService],
})
export class StudentsModule {}
