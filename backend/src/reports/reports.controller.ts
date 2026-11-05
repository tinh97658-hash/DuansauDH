import { LecturerPaymentService } from "./lecturer-payment.service.js";
import { ApplyLecturerPaymentBatchDto, LecturerPaymentQueryDto, PreviewLecturerPaymentBatchDto, UpdateLecturerPaymentDto } from "./dto/lecturer-payment.dto.js";
import { SchedulingService } from "../scheduling/scheduling.service.js";
import { Body, Controller, Get, Post, Put, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
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
  constructor(
    private readonly reports: ReportsService,
    private readonly scoreSummary: ClassScoreSummaryService,
    private readonly payments: LecturerPaymentService,
    private readonly scheduling: SchedulingService,
  ) {}

  @Get("lecturer-payments/options")
  paymentOptions() { return this.payments.options(); }

  @Get("lecturer-payments/export") @RequirePermissions("reports.view", "reports.export")
  exportPayments(@Query() query: LecturerPaymentQueryDto) { return this.payments.list(query); }

  @Get("lecturer-payments")
  lecturerPayments(@Query() query: LecturerPaymentQueryDto) { return this.payments.list(query); }

  @Post("lecturer-payments/batch-preview") @RequirePermissions("reports.view", "reports.payments.manage")
  previewPaymentBatch(@Body() dto: PreviewLecturerPaymentBatchDto, @CurrentUser() actor: any) {
    return this.payments.previewBatch(dto.filters, dto.paid, actor.id, dto.paymentDate);
  }

  @Put("lecturer-payments/batch") @RequirePermissions("reports.view", "reports.payments.manage")
  applyPaymentBatch(@Body() dto: ApplyLecturerPaymentBatchDto, @CurrentUser() actor: any) {
    return this.payments.applyBatch(dto.token, actor.id);
  }

  @Put("lecturer-payments/:offeringId/:lecturerId") @RequirePermissions("reports.view", "reports.payments.manage")
  updatePayment(@Param("offeringId", ParseUUIDPipe) offeringId: string,
    @Param("lecturerId", ParseUUIDPipe) lecturerId: string, @Body() dto: UpdateLecturerPaymentDto,
    @CurrentUser() actor: any) { return this.payments.update(offeringId, lecturerId, dto, actor.id); }

  // Use the existing detail loaders under report permissions and existing group data scope.
  @Get("lecturer-payments/offerings/:id")
  paymentOffering(@Param("id", ParseUUIDPipe) id: string) { return this.scheduling.getCourseOffering(id); }
  @Get("lecturer-payments/offerings/:id/roster")
  paymentRoster(@Param("id", ParseUUIDPipe) id: string) { return this.scheduling.getCourseOfferingRoster(id); }
  @Get("lecturer-payments/offerings/:id/teaching-sessions")
  paymentSessions(@Param("id", ParseUUIDPipe) id: string) { return this.scheduling.listTeachingSessionsForOffering(id); }
  @Get("lecturer-payments/offerings/:id/unresolved-teaching-sessions")
  paymentUnresolved(@Param("id", ParseUUIDPipe) id: string) { return this.scheduling.listUnresolvedTeachingSessions(id); }

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
