import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller.js";
import { ReportsService } from "./reports.service.js";
import { SequelizeModule } from "@nestjs/sequelize";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { ClassScoreSummaryService } from "./class-score-summary.service.js";

@Module({
  imports: [SequelizeModule.forFeature([ClassGroup])],
  controllers: [ReportsController],
  providers: [ReportsService, ClassScoreSummaryService],
  exports: [ReportsService],
})
export class ReportsModule {}
