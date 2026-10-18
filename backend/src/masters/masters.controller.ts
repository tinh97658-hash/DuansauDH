import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { CurrentUser } from "../common/auth-user.js";
import { RequirePermissions } from "../common/permissions.decorator.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { GradingPolicyService } from "./grading-policy.service.js";
import { GradingPoliciesQueryDto, SaveGradingPoliciesDto } from "./dto/grading-policy.dto.js";
import {
  AssignMembersDto, AutoAssignDto, BatchCreateMastersClassGroupsDto, CreateMastersClassGroupDto, UpdateMastersClassGroupDto,
} from "./dto/masters-class-group.dto.js";
import { MastersService } from "./masters.service.js";
import { ExamGradebookService } from "./exam-gradebook.service.js";
import { ExamGradebookQueryDto, ExamSubjectsQueryDto, SaveExamGradebookDto, GradebookWorkflowDto } from "./dto/exam-gradebook.dto.js";
import { AdmissionEvaluationService } from "../plan/admission-evaluation.service.js";

@Controller("masters")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@RequirePermissions("masters.view")
export class MastersController {
  constructor(
    private readonly masters: MastersService,
    private readonly gradebooks: ExamGradebookService,
    private readonly admissionEvaluation: AdmissionEvaluationService,
    private readonly gradingPolicies: GradingPolicyService,
  ) {}

  @Get("exam-lists/history") @RequirePermissions("gradebook.view")
  gradebookHistory(@Query() query: ExamGradebookQueryDto) { return this.gradebooks.history(query); }

  @Post("exam-lists/workflow") @RequirePermissions("gradebook.submit")
  gradebookWorkflow(@Body() dto: GradebookWorkflowDto, @CurrentUser() actor: any) { return this.gradebooks.transition(dto, actor); }

  @Get("bridge-course") bridgeCourse() { return this.masters.bridgeCourse(); }
  @Get("grading-policies")
  listGradingPolicies(@Query() query: GradingPoliciesQueryDto) { return this.gradingPolicies.list(query); }
  @Get("grading-rules")
  sharedGradingRules() { return this.gradingPolicies.shared(); }
  @Put("grading-policies") @RequirePermissions("gradebook.approve")
  saveGradingPolicies(@Body() dto: SaveGradingPoliciesDto, @CurrentUser() user: any) { return this.gradingPolicies.save(dto, user?.id ? String(user.id) : undefined); }
  @Get("admission-scores")
  admissionScores(@Query("roundId") roundId?: string) { return roundId ? this.admissionEvaluation.ranking(roundId) : this.admissionEvaluation.listRounds(); }
  @Get("exam-eligibility") examEligibility() { return this.masters.examEligibility(); }
  @Get("exam-lists/options") @RequirePermissions("gradebook.view")
  examListOptions() { return this.gradebooks.options(); }
  @Get("exam-lists/subjects") @RequirePermissions("gradebook.view")
  examListSubjects(@Query() query: ExamSubjectsQueryDto) { return this.gradebooks.subjects(query.classGroupId); }
  @Get("exam-lists") @RequirePermissions("gradebook.view")
  examLists(@Query() query: ExamGradebookQueryDto) { return this.gradebooks.get(query); }
  @Put("exam-lists") @RequirePermissions("gradebook.submit")
  saveExamLists(@Body() dto: SaveExamGradebookDto, @CurrentUser() actor: any) { return this.gradebooks.save(dto, actor); }
  @Get("english-exam") englishExam() { return this.masters.englishExam(); }
  @Get("english-scores") englishScores() { return this.masters.englishScores(); }
  @Get("english-certification") englishCertification() { return this.masters.englishCertification(); }
  @Get("final-defense") finalDefense() { return this.masters.finalDefense(); }
  @Get("graduation-docs") graduationDocs() { return this.masters.graduationDocs(); }

  // ===== NHÓM HỌC PHẦN (CLASS GROUPS) =====
  @Get("class-groups")
  listClassGroups(
    @Query("majorId") majorId?: string,
    @Query("academicYear") academicYear?: string,
    @Query("status") status?: string,
  ) {
    return this.masters.listClassGroups(majorId, academicYear, status);
  }

  @Get("class-groups/eligible-students")
  listEligibleStudents(
    @Query("majorId") majorId?: string,
    @Query("academicYear") academicYear?: string,
  ) {
    return this.masters.listEligibleStudents(majorId, academicYear);
  }

  @Get("class-groups/:id")
  getClassGroup(@Param("id") id: string) {
    return this.masters.getClassGroup(id);
  }

  @Post("class-groups") @RequirePermissions("masters.manage")
  createClassGroup(@Body() dto: CreateMastersClassGroupDto) {
    return this.masters.createClassGroup(dto);
  }

  @Post("class-groups/batch") @RequirePermissions("masters.manage")
  batchCreateClassGroups(@Body() dto: BatchCreateMastersClassGroupsDto) {
    return this.masters.batchCreateClassGroups(dto);
  }

  @Put("class-groups/:id") @RequirePermissions("masters.manage")
  updateClassGroup(@Param("id") id: string, @Body() dto: UpdateMastersClassGroupDto) {
    return this.masters.updateClassGroup(id, dto);
  }

  @Delete("class-groups/:id") @RequirePermissions("masters.manage")
  deleteClassGroup(@Param("id") id: string) {
    return this.masters.deleteClassGroup(id);
  }

  // ===== PHÂN NHÓM HỌC VIÊN =====
  @Post("class-groups/:id/members") @RequirePermissions("masters.manage")
  assignMembers(@Param("id") id: string, @Body() dto: AssignMembersDto) {
    return this.masters.assignMembers(id, dto);
  }

  @Delete("class-groups/:id/members/:memberId") @RequirePermissions("masters.manage")
  removeMember(@Param("id") id: string, @Param("memberId") memberId: string, @CurrentUser() actor: any) {
    return this.masters.removeMember(id, memberId, actor);
  }

  @Post("class-groups/auto-assign") @RequirePermissions("masters.manage")
  autoAssign(@Body() dto: AutoAssignDto) {
    return this.masters.autoAssign(dto);
  }
}
