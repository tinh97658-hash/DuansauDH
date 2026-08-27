import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { Roles } from "../common/auth-user.js";
import { RolesGuard } from "../common/roles.guard.js";
import {
  CreateAdmissionRecordDto, CreateClassDto, CreateSubjectDto, CreateSubjectPackageDto,
  UpdateAdmissionRecordDto, UpdateClassDto, UpdateSubjectDto, UpdateSubjectPackageDto,
} from "./dto/plan.dto.js";
import { PlanService } from "./plan.service.js";

@Controller("plan")
@UseGuards(AuthenticatedGuard)
export class PlanController {
  constructor(private readonly plan: PlanService) {}

  @Get("training-plan") trainingPlan(@Query("program") program?: string) { return this.plan.trainingPlan(program); }
  @Get("admission-targets") admissionTargets() { return this.plan.admissionTargets(); }
  @Get("annual-fees") annualFees() { return this.plan.annualFees(); }

  // ===== Học phần theo chuyên ngành & bậc đào tạo =====
  @Get("subjects") subjects(@Query("majorId") majorId?: string, @Query("program") program?: string) { return this.plan.listSubjects(majorId, program); }
  @Post("subjects") @Roles("admin") @UseGuards(RolesGuard) createSubject(@Body() dto: CreateSubjectDto) { return this.plan.createSubject(dto); }
  @Put("subjects/:id") @Roles("admin") @UseGuards(RolesGuard) updateSubject(@Param("id") id: string, @Body() dto: UpdateSubjectDto) { return this.plan.updateSubject(id, dto); }
  @Delete("subjects/:id") @Roles("admin") @UseGuards(RolesGuard) removeSubject(@Param("id") id: string) { return this.plan.removeSubject(id); }

  // ===== Lớp học =====
  @Get("classes") classes(@Query("majorId") majorId?: string, @Query("program") program?: string, @Query("year") year?: string) { return this.plan.listClasses(majorId, program, year); }
  @Post("classes") @Roles("admin") @UseGuards(RolesGuard) createClass(@Body() dto: CreateClassDto) { return this.plan.createClass(dto); }
  @Put("classes/:id") @Roles("admin") @UseGuards(RolesGuard) updateClass(@Param("id") id: string, @Body() dto: UpdateClassDto) { return this.plan.updateClass(id, dto); }
  @Delete("classes/:id") @Roles("admin") @UseGuards(RolesGuard) removeClass(@Param("id") id: string) { return this.plan.removeClass(id); }

  // ===== Gói học phần theo lớp =====
  @Get("subject-packages") subjectPackages(@Query("classGroupId") classGroupId?: string) { return this.plan.listPackages(classGroupId); }
  @Post("classes/:id/default-packages") @Roles("admin") @UseGuards(RolesGuard) createDefaultPackages(@Param("id") id: string) { return this.plan.createDefaultPackages(id); }
  @Post("subject-packages") @Roles("admin") @UseGuards(RolesGuard) createPackage(@Body() dto: CreateSubjectPackageDto) { return this.plan.createPackage(dto); }
  @Put("subject-packages/:id/set-official") @Roles("admin") @UseGuards(RolesGuard) setOfficialPackage(@Param("id") id: string) { return this.plan.setOfficialPackage(id); }
  @Put("subject-packages/:id") @Roles("admin") @UseGuards(RolesGuard) updatePackage(@Param("id") id: string, @Body() dto: UpdateSubjectPackageDto) { return this.plan.updatePackage(id, dto); }
  @Delete("subject-packages/:id") @Roles("admin") @UseGuards(RolesGuard) removePackage(@Param("id") id: string) { return this.plan.removePackage(id); }

  // ===== Hồ sơ tuyển sinh (Admission Records) =====
  @Get("admission-records")
  listAdmissionRecords(
    @Query("majorId") majorId?: string,
    @Query("trainingLevel") trainingLevel?: string,
    @Query("academicYear") academicYear?: string,
    @Query("status") status?: string,
  ) {
    return this.plan.listAdmissionRecords(majorId, trainingLevel, academicYear, status);
  }

  @Get("admission-records/:id")
  getAdmissionRecord(@Param("id") id: string) {
    return this.plan.getAdmissionRecord(id);
  }

  @Post("admission-records")
  @Roles("admin")
  @UseGuards(RolesGuard)
  createAdmissionRecord(@Body() dto: CreateAdmissionRecordDto) {
    return this.plan.createAdmissionRecord(dto);
  }

  @Put("admission-records/:id")
  @Roles("admin")
  @UseGuards(RolesGuard)
  updateAdmissionRecord(@Param("id") id: string, @Body() dto: UpdateAdmissionRecordDto) {
    return this.plan.updateAdmissionRecord(id, dto);
  }

  @Delete("admission-records/:id")
  @Roles("admin")
  @UseGuards(RolesGuard)
  removeAdmissionRecord(@Param("id") id: string) {
    return this.plan.removeAdmissionRecord(id);
  }
}
