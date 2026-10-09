import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { ReportsService } from "./reports.service.js";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { RolesGuard } from "../common/roles.guard.js";
import { Roles } from "../common/auth-user.js";
import { ClassScoreSummaryService } from "./class-score-summary.service.js";
import { ClassScoreSummaryQueryDto, LearnerScorecardQueryDto } from "./dto/class-score-summary.dto.js";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService, private readonly scoreSummary: ClassScoreSummaryService) {}

  @Get("class-lists") classLists() { return this.reports.classLists(); }
  @Get("course-scores") courseScores() { return this.reports.courseScores(); }
  @Get("class-score-summary/options")
  @UseGuards(AuthenticatedGuard, RolesGuard) @Roles("admin", "supervisor", "examiner")
  classScoreSummaryOptions() { return this.scoreSummary.options(); }
  @Get("class-score-summary/export")
  @UseGuards(AuthenticatedGuard, RolesGuard) @Roles("admin", "supervisor", "examiner")
  exportClassScoreSummary(@Query() query: ClassScoreSummaryQueryDto) { return this.scoreSummary.get(query, true); }
  @Get("class-score-summary")
  @UseGuards(AuthenticatedGuard, RolesGuard) @Roles("admin", "supervisor", "examiner")
  classScoreSummary(@Query() query: ClassScoreSummaryQueryDto) { return this.scoreSummary.get(query); }
  @Get("learner-scorecard/:admissionRecordId")
  @UseGuards(AuthenticatedGuard, RolesGuard) @Roles("admin", "supervisor", "examiner")
  learnerScorecard(@Param("admissionRecordId", ParseUUIDPipe) id: string, @Query() query: LearnerScorecardQueryDto) {
    return this.scoreSummary.learnerScorecard(id, query.classGroupId);
  }
  @Get("ministerial-report") ministerialReport() { return this.reports.ministerialReport(); }
  @Get("temp-score-masters") tempScoreMasters() { return this.reports.tempScoreMasters(); }
  @Get("temp-score-doctoral") tempScoreDoctoral() { return this.reports.tempScoreDoctoral(); }
  @Get("diploma-appendix-masters") diplomaAppendixMasters() { return this.reports.diplomaAppendixMasters(); }
  @Get("diploma-appendix-doctoral") diplomaAppendixDoctoral() { return this.reports.diplomaAppendixDoctoral(); }
}
