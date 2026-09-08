import { CourseOfferingParticipant } from "../database/models/training/course-offering-participant.model.js";
import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { RolesGuard } from "../common/roles.guard.js";
import { SchedulingWriteGuard } from "../common/scheduling-write.guard.js";
import { Major } from "../database/models/common/major.model.js";
import { Lecturer } from "../database/models/common/lecturer.model.js";
import { Room } from "../database/models/common/room.model.js";
import { Subject } from "../database/models/plan/subject.model.js";
import { SubjectPackage } from "../database/models/plan/subject-package.model.js";
import { SubjectPackageSubject } from "../database/models/plan/subject-package-subject.model.js";
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
    CourseOfferingClassGroup,
    CourseOfferingParticipant,
    Subject,
    SubjectPackage,
    SubjectPackageSubject,
    ClassGroup,
    ClassGroupMember,
    Major,
    Staff,
    Lecturer,
    Room,
    TeachingSession,
  ])],
  controllers: [SchedulingController],
  providers: [SchedulingService, SchedulingWriteGuard, RolesGuard],
  exports: [SchedulingService],
})
export class SchedulingModule {}
