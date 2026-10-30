import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { CurrentUser } from "../common/auth-user.js";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { RequirePermissions } from "../common/permissions.decorator.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import type { Staff } from "../database/models/staff.model.js";
import {
  ListAttendanceReviewsQueryDto,
  ResolveAttendanceReviewDto,
  RecognizeAttendanceDto,
  AttendanceTelemetryDto,
} from "./attendance.dto.js";
import { AttendanceService } from "./attendance.service.js";
import {
  attendanceEnrollmentUploadOptions,
  attendanceProbeUploadOptions,
} from "./attendance-uploads.js";

@Controller("attendance")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@RequirePermissions("attendance.view")
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post("participants/:participantId/enrollment/analyze")
  @RequirePermissions("attendance.enroll")
  @UseInterceptors(FileInterceptor("image", attendanceProbeUploadOptions))
  analyzeEnrollment(@Param("participantId") participantId: string, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.attendance.analyzeEnrollment(participantId, file);
  }

  @Post("sessions/:sessionId/analyze")
  @RequirePermissions("attendance.record")
  @UseInterceptors(FileInterceptor("image", attendanceProbeUploadOptions))
  analyzeSession(@Param("sessionId", ParseUUIDPipe) sessionId: string, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.attendance.analyzeSession(sessionId, file);
  }

  @Get("sessions/:sessionId/workflow")
  workflow(@Param("sessionId", ParseUUIDPipe) sessionId: string) {
    return this.attendance.attendanceWorkflow(sessionId);
  }

  @Post("sessions/:sessionId/open")
  @RequirePermissions("attendance.record")
  open(@Param("sessionId", ParseUUIDPipe) sessionId: string, @CurrentUser() staff: Staff) {
    return this.attendance.openAttendance(sessionId, staff);
  }

  @Post("sessions/:sessionId/close")
  @RequirePermissions("attendance.record")
  close(@Param("sessionId", ParseUUIDPipe) sessionId: string, @CurrentUser() staff: Staff) {
    return this.attendance.closeAttendance(sessionId, staff);
  }

  @Post("participants/:participantId/enrollment")
  @RequirePermissions("attendance.enroll")
  @UseInterceptors(
    FilesInterceptor("images", 5, attendanceEnrollmentUploadOptions),
  )
  enroll(
    @Param("participantId") participantId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body("replace") replace: string | undefined,
    @CurrentUser() staff: Staff,
  ) {
    return this.attendance.enroll(
      participantId,
      files ?? [],
      replace === undefined ? true : replace !== "false",
      staff,
    );
  }

  @Get("participants/:participantId/enrollment")
  getEnrollment(@Param("participantId") participantId: string) {
    return this.attendance.getEnrollment(participantId);
  }

  @Get("participants/:participantId/enrollment/audit")
  listEnrollmentAudit(
    @Param("participantId") participantId: string,
    @Query("limit") limit?: string,
  ) {
    return this.attendance.listEnrollmentAudit(participantId, Number(limit));
  }

  @Delete("participants/:participantId/enrollment")
  @RequirePermissions("attendance.enroll")
  withdrawEnrollment(
    @Param("participantId") participantId: string,
    @CurrentUser() staff: Staff,
  ) {
    return this.attendance.withdrawEnrollment(participantId, staff);
  }

  @Post("sessions/:sessionId/recognize")
  @RequirePermissions("attendance.record")
  @UseInterceptors(FileInterceptor("image", attendanceProbeUploadOptions))
  recognize(
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @UploadedFile() image: Express.Multer.File | undefined,
    @Body() dto: RecognizeAttendanceDto,
    @CurrentUser() staff: Staff,
  ) {
    return this.attendance.recognize(sessionId, image, dto, staff);
  }

  @Post("sessions/:sessionId/telemetry")
  @RequirePermissions("attendance.record")
  telemetry(
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() dto: AttendanceTelemetryDto,
  ) {
    return this.attendance.recordTelemetry(sessionId, dto);
  }

  @Get("sessions/:sessionId/attendance")
  listSessionAttendance(@Param("sessionId", ParseUUIDPipe) sessionId: string) {
    return this.attendance.listSessionAttendance(sessionId);
  }

  @Get("sessions/:sessionId/enrollments")
  listSessionEnrollments(@Param("sessionId", ParseUUIDPipe) sessionId: string) {
    return this.attendance.listSessionEnrollments(sessionId);
  }

  @Get("sessions/:sessionId/reviews")
  listSessionReviews(
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Query() query: ListAttendanceReviewsQueryDto,
  ) {
    return this.attendance.listSessionReviews(sessionId, query.status);
  }

  @Post("reviews/:reviewId/resolve")
  @RequirePermissions("attendance.review")
  resolveReview(
    @Param("reviewId", ParseUUIDPipe) reviewId: string,
    @Body() dto: ResolveAttendanceReviewDto,
    @CurrentUser() staff: Staff,
  ) {
    return this.attendance.resolveReview(reviewId, dto, staff);
  }
}
