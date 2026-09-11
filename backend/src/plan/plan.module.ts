import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { RolesGuard } from "../common/roles.guard.js";
import { Major } from "../database/models/common/major.model.js";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { ClassGroupMember } from "../database/models/training/class-group-member.model.js";
import { Subject } from "../database/models/plan/subject.model.js";
import { Curriculum } from "../database/models/plan/curriculum.model.js";
import { CurriculumBlock } from "../database/models/plan/curriculum-block.model.js";
import { CurriculumElectiveGroup } from "../database/models/plan/curriculum-elective-group.model.js";
import { CurriculumSubject } from "../database/models/plan/curriculum-subject.model.js";
import { AdmissionRecord } from "../database/models/plan/admission-record.model.js";
import { CourseOffering } from "../database/models/training/course-offering.model.js";
import { ClassGroupElective } from "../database/models/training/class-group-elective.model.js";
import { ClassGroupService } from "./class-group.service.js";
import { CurriculumService } from "./curriculum.service.js";
import { PlanController } from "./plan.controller.js";
import { PlanService } from "./plan.service.js";

@Module({
  imports: [SequelizeModule.forFeature([
    Subject,
    Curriculum, CurriculumBlock, CurriculumElectiveGroup, CurriculumSubject,
    ClassGroup, ClassGroupMember, ClassGroupElective,
    Major, AdmissionRecord, CourseOffering,
  ])],
  controllers: [PlanController],
  providers: [PlanService, ClassGroupService, CurriculumService, RolesGuard],
  exports: [PlanService, ClassGroupService, CurriculumService],
})
export class PlanModule {}
