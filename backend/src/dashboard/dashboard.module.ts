import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { MastersModule } from "../masters/masters.module.js";
import { SchedulingModule } from "../scheduling/scheduling.module.js";
import { SystemModule } from "../system/system.module.js";
import { DashboardController } from "./dashboard.controller.js";
import { DashboardService } from "./dashboard.service.js";

@Module({
  imports: [MastersModule, SchedulingModule, SystemModule, SequelizeModule.forFeature([ClassGroup])],
  controllers: [DashboardController], providers: [DashboardService],
})
export class DashboardModule {}
