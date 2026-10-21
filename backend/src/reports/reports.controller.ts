import { Body, Controller, Get, Post, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { ReportsService } from "./reports.service.js";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { CurrentUser } from "../common/auth-user.js";
import { RequirePermissions } from "../common/permissions.decorator.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { ClassScoreSummaryService } from "./class-score-summary.service.js";
import { ClassScoreRosterQueryDto, ClassScoreSummaryQueryDto, LearnerScorecardQueryDto } from "./dto/class-score-summary.dto.js";

@Controller("reports")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@RequirePermissions("reports.view")
export class ReportsController {
  constructor(private readonly reports: ReportsService, private readonly scoreSummary: ClassScoreSummaryService) {}

  @Post("learner-scorecard/:admissionRecordId/issue") @RequirePermissions("reports.export")
  issue(@Param("admissionRecordId", ParseUUIDPipe) id: string, @Body() dto: ClassScoreRosterQueryDto, @CurrentUser() actor: any) {
    return this.scoreSummary.issue(id, dto.classGroupId, actor);
  }

  @Get("transcript-issues/:id")
  issued(@Param("id", ParseUUIDPipe) id: string) { return this.scoreSummary.issued(id); }

  @Get("learner-scorecard/:admissionRecordId/issues")
  issues(@Param("admissionRecordId", ParseUUIDPipe) id: string) { return this.scoreSummary.issuesForRecord(id); }

  @Get("class-lists") classLists() { return this.reports.classLists(); }
  @Get("course-scores") courseScores() { return this.reports.courseScores(); }
  @Get("class-score-summary/options")
  classScoreSummaryOptions() { return this.scoreSummary.options(); }
  @Get("class-score-summary/roster")
  classScoreRoster(@Query() query: ClassScoreRosterQueryDto) { return this.scoreSummary.roster(query.classGroupId); }
  @Get("class-score-summary/transcripts")
  classTranscripts(@Query() query: ClassScoreRosterQueryDto) { return this.scoreSummary.transcripts(query.classGroupId); }
  @Get("class-score-summary/export") @RequirePermissions("reports.export")
  exportClassScoreSummary(@Query() query: ClassScoreSummaryQueryDto) { return this.scoreSummary.get(query, true); }
  @Get("class-score-summary")
  classScoreSummary(@Query() query: ClassScoreSummaryQueryDto) { return this.scoreSummary.get(query); }
  @Get("learner-scorecard/:admissionRecordId")
  learnerScorecard(@Param("admissionRecordId", ParseUUIDPipe) id: string, @Query() query: LearnerScorecardQueryDto) {
    return this.scoreSummary.learnerScorecard(id, query.classGroupId);
  }
  @Get("ministerial-report") ministerialReport() { return this.reports.ministerialReport(); }
  @Get("temp-score-masters") tempScoreMasters() { return this.reports.tempScoreMasters(); }
  @Get("temp-score-doctoral") tempScoreDoctoral() { return this.reports.tempScoreDoctoral(); }
  @Get("diploma-appendix-masters") diplomaAppendixMasters() { return this.reports.diplomaAppendixMasters(); }
  @Get("diploma-appendix-doctoral") diplomaAppendixDoctoral() { return this.reports.diplomaAppendixDoctoral(); }
}
