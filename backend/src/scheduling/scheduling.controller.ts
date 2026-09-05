import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CurrentUser, Roles } from "../common/auth-user.js";
import { RolesGuard } from "../common/roles.guard.js";
import { SchedulingWriteGuard } from "../common/scheduling-write.guard.js";
import {
  AssignSchedulingManagerDto,
  ConfirmTeachingSessionDto,
  CourseOfferingCandidatesQueryDto,
  CreateCourseOfferingDto,
  CreateTeachingSessionDto,
  ListCourseOfferingsQueryDto,
  ListTeachingSessionsQueryDto,
  PreviewCourseOfferingParticipantsDto,
  UpdateTeachingSessionDto,
} from "./dto/scheduling.dto.js";
import { SchedulingService } from "./scheduling.service.js";

@Controller("scheduling")
@Roles("admin", "supervisor", "examiner")
@UseGuards(RolesGuard)
export class SchedulingController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get("course-offering-candidates")
  candidates(@Query() query: CourseOfferingCandidatesQueryDto) {
    return this.scheduling.listCourseOfferingCandidates(query);
  }

  @Post("course-offerings")
  @UseGuards(SchedulingWriteGuard)
  createCourseOffering(@Body() dto: CreateCourseOfferingDto) {
    return this.scheduling.createCourseOffering(dto);
  }

  @Get("course-offerings")
  listCourseOfferings(@Query() query: ListCourseOfferingsQueryDto) {
    return this.scheduling.listCourseOfferings(query);
  }

  @Post("course-offerings/participant-preview")
  @UseGuards(SchedulingWriteGuard)
  previewCourseOfferingParticipants(@Body() dto: PreviewCourseOfferingParticipantsDto) {
    return this.scheduling.previewCourseOfferingParticipants(dto);
  }

  @Get("course-offerings/:id/unresolved-teaching-sessions")
  listUnresolvedTeachingSessions(@Param("id", ParseUUIDPipe) id: string) {
    return this.scheduling.listUnresolvedTeachingSessions(id);
  }

  @Get("course-offerings/:id")
  getCourseOffering(@Param("id", ParseUUIDPipe) id: string) {
    return this.scheduling.getCourseOffering(id);
  }

  @Get("teaching-sessions")
  listTeachingSessions(@Query() query: ListTeachingSessionsQueryDto) {
    return this.scheduling.listTeachingSessions(query);
  }

  @Get("pending-teaching-sessions")
  @UseGuards(SchedulingWriteGuard)
  listPendingTeachingSessions() {
    return this.scheduling.listPendingTeachingSessions();
  }

  @Get("teaching-sessions/:id")
  getTeachingSession(@Param("id", ParseUUIDPipe) id: string) {
    return this.scheduling.getTeachingSession(id);
  }

  @Post("teaching-sessions")
  @UseGuards(SchedulingWriteGuard)
  createTeachingSession(@Body() dto: CreateTeachingSessionDto) {
    return this.scheduling.createTeachingSession(dto);
  }

  @Put("teaching-sessions/:id")
  @UseGuards(SchedulingWriteGuard)
  updateTeachingSession(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeachingSessionDto,
  ) {
    return this.scheduling.updateTeachingSession(id, dto);
  }

  @Put("teaching-sessions/:id/confirmation")
  @UseGuards(SchedulingWriteGuard)
  confirmTeachingSession(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ConfirmTeachingSessionDto,
    @CurrentUser() user: any,
  ) {
    return this.scheduling.confirmTeachingSession(id, dto.status, user.id);
  }

  @Delete("teaching-sessions/:id")
  @UseGuards(SchedulingWriteGuard)
  deleteTeachingSession(@Param("id", ParseUUIDPipe) id: string) {
    return this.scheduling.deleteTeachingSession(id);
  }

  @Put("course-offerings/:id/completion")
  @UseGuards(SchedulingWriteGuard)
  completeCourseOffering(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.scheduling.completeCourseOffering(id, user.id);
  }

  @Put("assignee")
  @Roles("admin")
  assignSchedulingManager(@Body() dto: AssignSchedulingManagerDto) {
    return this.scheduling.assignSchedulingManager(dto.staffId);
  }
}
