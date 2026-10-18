import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/auth-user.js";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { RequirePermissions } from "../common/permissions.decorator.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { SchedulingWriteGuard } from "../common/scheduling-write.guard.js";
import { CourseOfferingWriteGuard } from "../common/course-offering-write.guard.js";
import {
  AssignSchedulingManagerDto,
  ClassCurriculumProgressQueryDto,
  ConfirmTeachingSessionDto,
  CompleteCourseOfferingDto,
  CourseOfferingCandidatesQueryDto,
  CreateCourseOfferingDto,
  CreateTeachingSessionDto,
  ListCourseOfferingsQueryDto,
  ListTeachingSessionsQueryDto,
  PreviewCourseOfferingParticipantsDto,
  UpdateTeachingSessionDto,
  RetakeQueryDto, RegisterRetakeDto, UpdateRosterNotesDto, SchedulingGroupSettingsDto,
} from "./dto/scheduling.dto.js";
import { SchedulingService } from "./scheduling.service.js";

@Controller("scheduling")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@RequirePermissions("scheduling.view")
export class SchedulingController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get("course-offering-candidates")
  candidates(@Query() query: CourseOfferingCandidatesQueryDto) {
    return this.scheduling.listCourseOfferingCandidates(query);
  }

  @Get("class-curriculum-progress")
  classCurriculumProgress(@Query() query: ClassCurriculumProgressQueryDto) {
    return this.scheduling.getClassCurriculumProgress(query);
  }

  @Post("course-offerings")
  @RequirePermissions("scheduling.write")
  @UseGuards(CourseOfferingWriteGuard)
  createCourseOffering(@Body() dto: CreateCourseOfferingDto) {
    return this.scheduling.createCourseOffering(dto);
  }

  @Get("course-offerings")
  listCourseOfferings(@Query() query: ListCourseOfferingsQueryDto) {
    return this.scheduling.listCourseOfferings(query);
  }

  @Delete("course-offerings/:id")
  @RequirePermissions("scheduling.write")
  @UseGuards(CourseOfferingWriteGuard)
  deleteCourseOffering(@Param("id", ParseUUIDPipe) id: string) {
    return this.scheduling.deleteCourseOffering(id);
  }

  @Delete("course-offerings/:id/teaching-sessions")
  @RequirePermissions("scheduling.write")
  @UseGuards(CourseOfferingWriteGuard)
  deleteCourseOfferingSchedule(@Param("id", ParseUUIDPipe) id: string) {
    return this.scheduling.deleteCourseOfferingSchedule(id);
  }

  @Post("course-offerings/participant-preview")
  @RequirePermissions("scheduling.write")
  @UseGuards(CourseOfferingWriteGuard)
  previewCourseOfferingParticipants(@Body() dto: PreviewCourseOfferingParticipantsDto) {
    return this.scheduling.previewCourseOfferingParticipants(dto);
  }

  @Post("course-offerings/roster-preview")
  @RequirePermissions("scheduling.write")
  @UseGuards(CourseOfferingWriteGuard)
  previewCourseOfferingRoster(@Body() dto: PreviewCourseOfferingParticipantsDto) {
    return this.scheduling.previewCourseOfferingRoster(dto);
  }

  @Get("retakes")
  retakes(@Query() dto: RetakeQueryDto) { return this.scheduling.listRetakes(dto); }

  @Post("retakes") @RequirePermissions("scheduling.write") @UseGuards(SchedulingWriteGuard)
  registerRetake(@Body() dto: RegisterRetakeDto) { return this.scheduling.registerRetake(dto); }

  @Get("course-offerings/:id/roster")
  roster(@Param("id", ParseUUIDPipe) id: string) { return this.scheduling.getCourseOfferingRoster(id); }

  @Put("course-offerings/:id/roster-notes")
  @RequirePermissions("scheduling.write")
  @UseGuards(CourseOfferingWriteGuard)
  rosterNotes(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateRosterNotesDto) { return this.scheduling.updateRosterNotes(id, dto); }

  @Put("groups/:id/settings")
  @RequirePermissions("scheduling.write")
  @UseGuards(CourseOfferingWriteGuard)
  groupSettings(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SchedulingGroupSettingsDto) { return this.scheduling.updateSchedulingGroup(id, dto); }

  @Get("course-offering-students/:subjectId")
  @RequirePermissions("scheduling.write")
  @UseGuards(CourseOfferingWriteGuard)
  individualStudents(@Param("subjectId", ParseUUIDPipe) subjectId: string, @Query("search") search?: string) {
    return this.scheduling.listIndividualStudents(subjectId, search);
  }

  @Get("course-offerings/:id/unresolved-teaching-sessions")
  listUnresolvedTeachingSessions(@Param("id", ParseUUIDPipe) id: string) {
    return this.scheduling.listUnresolvedTeachingSessions(id);
  }

  @Get("course-offerings/:id/teaching-sessions")
  listTeachingSessionsForOffering(@Param("id", ParseUUIDPipe) id: string) {
    return this.scheduling.listTeachingSessionsForOffering(id);
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
  @RequirePermissions("scheduling.write")
  @UseGuards(SchedulingWriteGuard)
  listPendingTeachingSessions() {
    return this.scheduling.listPendingTeachingSessions();
  }

  @Get("teaching-sessions/:id")
  getTeachingSession(@Param("id", ParseUUIDPipe) id: string) {
    return this.scheduling.getTeachingSession(id);
  }

  @Post("teaching-sessions")
  @RequirePermissions("scheduling.write")
  @UseGuards(SchedulingWriteGuard)
  createTeachingSession(@Body() dto: CreateTeachingSessionDto) {
    return this.scheduling.createTeachingSession(dto);
  }

  @Put("teaching-sessions/:id")
  @RequirePermissions("scheduling.write")
  @UseGuards(SchedulingWriteGuard)
  updateTeachingSession(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeachingSessionDto,
  ) {
    return this.scheduling.updateTeachingSession(id, dto);
  }

  @Put("teaching-sessions/:id/confirmation")
  @RequirePermissions("scheduling.write")
  @UseGuards(SchedulingWriteGuard)
  confirmTeachingSession(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ConfirmTeachingSessionDto,
    @CurrentUser() user: any,
  ) {
    return this.scheduling.confirmTeachingSession(id, dto.status, user.id);
  }

  @Delete("teaching-sessions/:id")
  @RequirePermissions("scheduling.write")
  @UseGuards(SchedulingWriteGuard)
  deleteTeachingSession(@Param("id", ParseUUIDPipe) id: string) {
    return this.scheduling.deleteTeachingSession(id);
  }

  @Put("course-offerings/:id/completion")
  @RequirePermissions("scheduling.write")
  @UseGuards(SchedulingWriteGuard)
  completeCourseOffering(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: CompleteCourseOfferingDto,
  ) {
    return this.scheduling.completeCourseOffering(id, user.id, dto);
  }

  @Put("assignee")
  @RequirePermissions("scheduling.assign")
  assignSchedulingManager(@Body() dto: AssignSchedulingManagerDto) {
    return this.scheduling.assignSchedulingManager(dto.staffId);
  }
}
