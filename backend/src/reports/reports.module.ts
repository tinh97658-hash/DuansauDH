import { SchedulingModule } from "../scheduling/scheduling.module.js";
import { LecturerPaymentService } from "./lecturer-payment.service.js";
import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller.js";
import { ReportsService } from "./reports.service.js";
import { SequelizeModule } from "@nestjs/sequelize";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { ClassScoreSummaryService } from "./class-score-summary.service.js";

@Module({
  imports: [SchedulingModule, SequelizeModule.forFeature([ClassGroup])],
  controllers: [ReportsController],
  providers: [LecturerPaymentService, ReportsService, ClassScoreSummaryService],
  exports: [ReportsService],
})
export class ReportsModule {}
