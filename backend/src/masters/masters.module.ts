import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { ClassGroupMember } from "../database/models/training/class-group-member.model.js";
import { AdmissionRecord } from "../database/models/plan/admission-record.model.js";
import { Student } from "../database/models/student.model.js";
import { Major } from "../database/models/common/major.model.js";
import { PlanModule } from "../plan/plan.module.js";
import { MastersController } from "./masters.controller.js";
import { MastersService } from "./masters.service.js";

@Module({
  imports: [
    SequelizeModule.forFeature([
      ClassGroup,
      ClassGroupMember,
      AdmissionRecord,
      Student,
      Major,
    ]),
    PlanModule,
  ],
  controllers: [MastersController],
  providers: [MastersService],
  exports: [MastersService],
})
export class MastersModule {}
