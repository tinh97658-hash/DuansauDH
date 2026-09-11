import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { RolesGuard } from "../common/roles.guard.js";
import { SchedulingWriteGuard } from "../common/scheduling-write.guard.js";
import { CourseOfferingWriteGuard } from "../common/course-offering-write.guard.js";
import { CourseOfferingStudent } from "../database/models/training/course-offering-student.model.js";
import { AdmissionRecord } from "../database/models/plan/admission-record.model.js";
import { Major } from "../database/models/common/major.model.js";
import { Lecturer } from "../database/models/common/lecturer.model.js";
import { Room } from "../database/models/common/room.model.js";
import { Subject } from "../database/models/plan/subject.model.js";
import { CurriculumSubject } from "../database/models/plan/curriculum-subject.model.js";
import { ClassGroupElective } from "../database/models/training/class-group-elective.model.js";
import { Staff } from "../database/models/staff.model.js";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { ClassGroupMember } from "../database/models/training/class-group-member.model.js";
import { CourseOffering } from "../database/models/training/course-offering.model.js";
import { CourseOfferingClassGroup } from "../database/models/training/course-offering-class-group.model.js";
import { TeachingSession } from "../database/models/training/teaching-session.model.js";
import { SchedulingController } from "./scheduling.controller.js";
import { SchedulingService } from "./scheduling.service.js";

@Module({
  imports: [SequelizeModule.forFeature([
    CourseOffering,
    CourseOfferingStudent, AdmissionRecord,
    CourseOfferingClassGroup,
    Subject,
    CurriculumSubject,
    ClassGroupElective,
    ClassGroup,
    ClassGroupMember,
    Major,
    Staff,
    Lecturer,
    Room,
    TeachingSession,
  ])],
  controllers: [SchedulingController],
  providers: [SchedulingService, SchedulingWriteGuard, CourseOfferingWriteGuard, RolesGuard],
  exports: [SchedulingService],
})
export class SchedulingModule {}
