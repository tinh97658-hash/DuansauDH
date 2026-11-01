import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { IsIn, IsOptional, Matches } from "class-validator";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { CurrentUser } from "../common/auth-user.js";
import { DashboardService } from "./dashboard.service.js";
import type { DashboardProgram, DashboardSection } from "./dashboard.service.js";

export class OperationalDashboardQuery {
  @Matches(/^\d{4}$/, { message: "Năm phải gồm 4 chữ số." }) year!: string;
  @IsOptional() @IsIn(["grouping", "teaching", "grades", "approvals", "studyLeaveApproval", "majorTransferApproval"]) section?: DashboardSection;
  @IsOptional() @IsIn(["masters", "doctoral"]) program?: DashboardProgram;
}

@Controller("dashboard")
@UseGuards(AuthenticatedGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("operational")
  operational(@CurrentUser() user: unknown, @Query() query: OperationalDashboardQuery) {
    return this.dashboard.operational(user, query.year, query.section, query.program);
  }
}
