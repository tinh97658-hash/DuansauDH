import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { ClassGroupMember } from "../database/models/training/class-group-member.model.js";
import { AdmissionRecord } from "../database/models/plan/admission-record.model.js";
import { Student } from "../database/models/student.model.js";
import { Major } from "../database/models/common/major.model.js";
import { Curriculum } from "../database/models/plan/curriculum.model.js";
import { PlanModule } from "../plan/plan.module.js";
import { MastersController } from "./masters.controller.js";
import { MastersService } from "./masters.service.js";
import { ExamGradebookService } from "./exam-gradebook.service.js";
import { CourseExamGradebook } from "../database/models/training/course-exam-gradebook.model.js";
import { CourseOffering } from "../database/models/training/course-offering.model.js";
import { CourseOfferingClassGroup } from "../database/models/training/course-offering-class-group.model.js";
import { Subject } from "../database/models/plan/subject.model.js";

@Module({
  imports: [
    SequelizeModule.forFeature([
      ClassGroup,
      ClassGroupMember,
      AdmissionRecord,
      Student,
      Major,
      Curriculum,
      CourseExamGradebook, CourseOffering, CourseOfferingClassGroup, Subject,
    ]),
    PlanModule,
  ],
  controllers: [MastersController],
  providers: [MastersService, ExamGradebookService],
  exports: [MastersService],
})
export class MastersModule {}
