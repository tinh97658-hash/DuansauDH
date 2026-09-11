import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { Roles } from "../common/auth-user.js";
import { RolesGuard } from "../common/roles.guard.js";
import {
  CreateAdmissionRecordDto, CreateClassDto, CreateCurriculumDto, CreateSubjectDto,
  SetClassElectivesDto, SetCurriculumSubjectsDto,
  UpdateAdmissionRecordDto, UpdateClassDto, UpdateCurriculumDto, UpdateSubjectDto,
} from "./dto/plan.dto.js";
import { CurriculumService } from "./curriculum.service.js";
import { PlanService } from "./plan.service.js";

@Controller("plan")
@UseGuards(AuthenticatedGuard)
export class PlanController {
  constructor(
    private readonly plan: PlanService,
    private readonly curriculums: CurriculumService,
  ) {}

  @Get("training-plan") trainingPlan(@Query("program") program?: string) { return this.plan.trainingPlan(program); }
  @Get("admission-targets") admissionTargets() { return this.plan.admissionTargets(); }
  @Get("annual-fees") annualFees() { return this.plan.annualFees(); }

  @Get("subjects") subjects(
    @Query("majorId") majorId?: string,
    @Query("program") program?: string,
    @Query("includeCommon") includeCommon?: string,
  ) {
    return this.plan.listSubjects(majorId, program, includeCommon === "true");
  }
  @Post("subjects") @Roles("admin") @UseGuards(RolesGuard) createSubject(@Body() dto: CreateSubjectDto) { return this.plan.createSubject(dto); }
  @Put("subjects/:id") @Roles("admin") @UseGuards(RolesGuard) updateSubject(@Param("id") id: string, @Body() dto: UpdateSubjectDto) { return this.plan.updateSubject(id, dto); }
  @Delete("subjects/:id") @Roles("admin") @UseGuards(RolesGuard) removeSubject(@Param("id") id: string) { return this.plan.removeSubject(id); }

  // ===== Lớp học =====
  @Get("classes") classes(@Query("majorId") majorId?: string, @Query("program") program?: string, @Query("year") year?: string) { return this.plan.listClasses(majorId, program, year); }
  @Post("classes") @Roles("admin") @UseGuards(RolesGuard) createClass(@Body() dto: CreateClassDto) { return this.plan.createClass(dto); }
  @Put("classes/:id") @Roles("admin") @UseGuards(RolesGuard) updateClass(@Param("id") id: string, @Body() dto: UpdateClassDto) { return this.plan.updateClass(id, dto); }
  @Delete("classes/:id") @Roles("admin") @UseGuards(RolesGuard) removeClass(@Param("id") id: string) { return this.plan.removeClass(id); }

  // ===== Chương trình đào tạo (theo ngành + bậc + khóa) =====
  @Get("curriculums") listCurriculums(@Query("majorId") majorId?: string, @Query("program") program?: string) { return this.curriculums.list(majorId, program); }
  @Get("curriculums/:id") curriculum(@Param("id") id: string) { return this.curriculums.detail(id); }
  @Post("curriculums") @Roles("admin") @UseGuards(RolesGuard) createCurriculum(@Body() dto: CreateCurriculumDto) { return this.curriculums.create(dto); }
  @Put("curriculums/:id") @Roles("admin") @UseGuards(RolesGuard) updateCurriculum(@Param("id") id: string, @Body() dto: UpdateCurriculumDto) { return this.curriculums.update(id, dto); }
  @Put("curriculums/:id/subjects") @Roles("admin") @UseGuards(RolesGuard) setCurriculumSubjects(@Param("id") id: string, @Body() dto: SetCurriculumSubjectsDto) { return this.curriculums.setSubjects(id, dto); }
  @Delete("curriculums/:id") @Roles("admin") @UseGuards(RolesGuard) removeCurriculum(@Param("id") id: string) { return this.curriculums.remove(id); }

  // ===== Học phần của lớp: kế thừa CTĐT + học phần tự chọn Viện chỉ định =====
  @Get("classes/:id/subjects") classSubjects(@Param("id") id: string) { return this.curriculums.classSubjects(id); }
  @Post("classes/:id/curriculum") @Roles("admin") @UseGuards(RolesGuard) ensureClassCurriculum(@Param("id") id: string) { return this.curriculums.ensureForClass(id); }
  @Put("classes/:id/electives") @Roles("admin") @UseGuards(RolesGuard) setClassElectives(@Param("id") id: string, @Body() dto: SetClassElectivesDto) { return this.curriculums.setClassElectives(id, dto.curriculumSubjectIds); }

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
