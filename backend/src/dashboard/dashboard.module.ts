import { Module } from "@nestjs/common";
import { MastersModule } from "../masters/masters.module.js";
import { SchedulingModule } from "../scheduling/scheduling.module.js";
import { SystemModule } from "../system/system.module.js";
import { DashboardController } from "./dashboard.controller.js";
import { DashboardService } from "./dashboard.service.js";

@Module({
  imports: [MastersModule, SchedulingModule, SystemModule],
  controllers: [DashboardController], providers: [DashboardService],
})
export class DashboardModule {}
