import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { Roles } from "../common/auth-user.js";
import { RolesGuard } from "../common/roles.guard.js";
import {
  AssignMembersDto, AutoAssignDto, BatchCreateMastersClassGroupsDto, CreateMastersClassGroupDto, UpdateMastersClassGroupDto,
} from "./dto/masters-class-group.dto.js";
import { MastersService } from "./masters.service.js";

@Controller("masters")
@UseGuards(AuthenticatedGuard)
export class MastersController {
  constructor(private readonly masters: MastersService) {}

  @Get("bridge-course") bridgeCourse() { return this.masters.bridgeCourse(); }
  @Get("admission-scores") admissionScores() { return this.masters.admissionScores(); }
  @Get("exam-eligibility") examEligibility() { return this.masters.examEligibility(); }
  @Get("exam-lists") examLists() { return this.masters.examLists(); }
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
    @Query("term") term?: string,
    @Query("status") status?: string,
  ) {
    return this.masters.listClassGroups(majorId, academicYear, term, status);
  }

  @Get("class-groups/eligible-students")
  listEligibleStudents(
    @Query("majorId") majorId?: string,
    @Query("academicYear") academicYear?: string,
    @Query("term") term?: string,
  ) {
    return this.masters.listEligibleStudents(majorId, academicYear, term);
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
  removeMember(@Param("id") id: string, @Param("memberId") memberId: string) {
    return this.masters.removeMember(id, memberId);
  }

  @Post("class-groups/auto-assign")
  @Roles("admin")
  @UseGuards(RolesGuard)
  autoAssign(@Body() dto: AutoAssignDto) {
    return this.masters.autoAssign(dto);
  }
}
