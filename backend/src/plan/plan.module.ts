import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { RolesGuard } from "../common/roles.guard.js";
import { Major } from "../database/models/common/major.model.js";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { ClassGroupMember } from "../database/models/training/class-group-member.model.js";
import { Subject } from "../database/models/plan/subject.model.js";
import { SubjectPackage } from "../database/models/plan/subject-package.model.js";
import { SubjectPackageSubject } from "../database/models/plan/subject-package-subject.model.js";
import { AdmissionRecord } from "../database/models/plan/admission-record.model.js";
import { ClassGroupService } from "./class-group.service.js";
import { PlanController } from "./plan.controller.js";
import { PlanService } from "./plan.service.js";

@Module({
  imports: [SequelizeModule.forFeature([Subject, SubjectPackage, SubjectPackageSubject, ClassGroup, ClassGroupMember, Major, AdmissionRecord])],
  controllers: [PlanController],
  providers: [PlanService, ClassGroupService, RolesGuard],
  exports: [PlanService, ClassGroupService],
})
export class PlanModule {}
