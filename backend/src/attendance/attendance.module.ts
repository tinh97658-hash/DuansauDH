import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { AdmissionRecord } from "../database/models/plan/admission-record.model.js";
import { Student } from "../database/models/student.model.js";
import { TeachingSession } from "../database/models/training/teaching-session.model.js";
import { SchedulingModule } from "../scheduling/scheduling.module.js";
import { AttendanceController } from "./attendance.controller.js";
import {
  AttendanceRecognitionEvent,
  AttendanceReviewQueue,
  TeachingSessionAttendance,
} from "./attendance.models.js";
import { AttendanceService } from "./attendance.service.js";
import { FaceClientService } from "./face-client.service.js";

@Module({
  imports: [
    SequelizeModule.forFeature([
      TeachingSession,
      TeachingSessionAttendance,
      AttendanceRecognitionEvent,
      AttendanceReviewQueue,
      AdmissionRecord,
      Student,
    ]),
    SchedulingModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService, FaceClientService],
  exports: [AttendanceService, FaceClientService],
})
export class AttendanceModule {}
