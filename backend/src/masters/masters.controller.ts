import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { CurrentUser, Roles } from "../common/auth-user.js";
import { GradingPolicyService } from "./grading-policy.service.js";
import { GradingPoliciesQueryDto, SaveGradingPoliciesDto } from "./dto/grading-policy.dto.js";
import { RolesGuard } from "../common/roles.guard.js";
import {
  AssignMembersDto, AutoAssignDto, BatchCreateMastersClassGroupsDto, CreateMastersClassGroupDto, UpdateMastersClassGroupDto,
} from "./dto/masters-class-group.dto.js";
import { MastersService } from "./masters.service.js";
import { ExamGradebookService } from "./exam-gradebook.service.js";
import { ExamGradebookQueryDto, ExamSubjectsQueryDto, SaveExamGradebookDto, GradebookWorkflowDto } from "./dto/exam-gradebook.dto.js";
import { AdmissionEvaluationService } from "../plan/admission-evaluation.service.js";

@Controller("masters")
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles("admin", "supervisor", "examiner")
export class MastersController {
  constructor(
    private readonly masters: MastersService,
    private readonly gradebooks: ExamGradebookService,
    private readonly admissionEvaluation: AdmissionEvaluationService,
    private readonly gradingPolicies: GradingPolicyService,
  ) {}

  @Get("exam-lists/history")
  gradebookHistory(@Query() query: ExamGradebookQueryDto) { return this.gradebooks.history(query); }

  @Post("exam-lists/workflow") @Roles("admin", "examiner")
  gradebookWorkflow(@Body() dto: GradebookWorkflowDto, @CurrentUser() actor: any) { return this.gradebooks.transition(dto, actor); }

  @Get("bridge-course") bridgeCourse() { return this.masters.bridgeCourse(); }
  @Get("grading-policies") @Roles("admin", "supervisor", "examiner") @UseGuards(RolesGuard)
  listGradingPolicies(@Query() query: GradingPoliciesQueryDto) { return this.gradingPolicies.list(query); }
  @Get("grading-rules") @Roles("admin", "supervisor", "examiner") @UseGuards(RolesGuard)
  sharedGradingRules() { return this.gradingPolicies.shared(); }
  @Put("grading-policies") @Roles("admin", "examiner") @UseGuards(RolesGuard)
  saveGradingPolicies(@Body() dto: SaveGradingPoliciesDto, @CurrentUser() user: any) { return this.gradingPolicies.save(dto, user?.id ? String(user.id) : undefined); }
  @Get("admission-scores") @Roles("admin", "supervisor", "examiner") @UseGuards(RolesGuard)
  admissionScores(@Query("roundId") roundId?: string) { return roundId ? this.admissionEvaluation.ranking(roundId) : this.admissionEvaluation.listRounds(); }
  @Get("exam-eligibility") examEligibility() { return this.masters.examEligibility(); }
  @Get("exam-lists/options") @Roles("admin", "supervisor", "examiner") @UseGuards(RolesGuard)
  examListOptions() { return this.gradebooks.options(); }
  @Get("exam-lists/subjects") @Roles("admin", "supervisor", "examiner") @UseGuards(RolesGuard)
  examListSubjects(@Query() query: ExamSubjectsQueryDto) { return this.gradebooks.subjects(query.classGroupId); }
  @Get("exam-lists") @Roles("admin", "supervisor", "examiner") @UseGuards(RolesGuard)
  examLists(@Query() query: ExamGradebookQueryDto) { return this.gradebooks.get(query); }
  @Put("exam-lists") @Roles("admin", "examiner") @UseGuards(RolesGuard)
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

  @Post("class-groups")
  @Roles("admin")
  @UseGuards(RolesGuard)
  createClassGroup(@Body() dto: CreateMastersClassGroupDto) {
    return this.masters.createClassGroup(dto);
  }

  @Post("class-groups/batch")
  @Roles("admin")
  @UseGuards(RolesGuard)
  batchCreateClassGroups(@Body() dto: BatchCreateMastersClassGroupsDto) {
    return this.masters.batchCreateClassGroups(dto);
  }

  @Put("class-groups/:id")
  @Roles("admin")
  @UseGuards(RolesGuard)
  updateClassGroup(@Param("id") id: string, @Body() dto: UpdateMastersClassGroupDto) {
    return this.masters.updateClassGroup(id, dto);
  }

  @Delete("class-groups/:id")
  @Roles("admin")
  @UseGuards(RolesGuard)
  deleteClassGroup(@Param("id") id: string) {
    return this.masters.deleteClassGroup(id);
  }

  // ===== PHÂN NHÓM HỌC VIÊN =====
  @Post("class-groups/:id/members")
  @Roles("admin")
  @UseGuards(RolesGuard)
  assignMembers(@Param("id") id: string, @Body() dto: AssignMembersDto) {
    return this.masters.assignMembers(id, dto);
  }

  @Delete("class-groups/:id/members/:memberId")
  @Roles("admin")
  @UseGuards(RolesGuard)
  removeMember(@Param("id") id: string, @Param("memberId") memberId: string, @CurrentUser() actor: any) {
    return this.masters.removeMember(id, memberId, actor);
  }

  @Post("class-groups/auto-assign")
  @Roles("admin")
  @UseGuards(RolesGuard)
  autoAssign(@Body() dto: AutoAssignDto) {
    return this.masters.autoAssign(dto);
  }
}
