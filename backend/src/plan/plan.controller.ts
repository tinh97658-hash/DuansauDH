import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { GroupResponsibilityService } from "../auth/group-responsibility.service.js";
import { CurrentUser } from "../common/auth-user.js";
import { RequirePermissions } from "../common/permissions.decorator.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import {
  CreateAdmissionRecordDto, CreateClassDto, CreateCurriculumDto, CreateLearningResultDto, CreateSharedSubjectsDto, CreateSubjectDto,
  CreateSubjectFromExistingDto,
  DecideMajorTransferDto, DecideRecognitionDto, ProposeRecognitionsDto, RequestMajorTransferDto, UpdateSubjectRecognitionDto,
  UpdateLearningResultDto,
  SetCurriculumSubjectsDto,
  UpdateAdmissionRecordDto, UpdateClassDto, UpdateCurriculumDto, UpdateSubjectDto,
} from "./dto/plan.dto.js";
import { CurriculumService } from "./curriculum.service.js";
import { PlanService } from "./plan.service.js";
import { MajorTransferService } from "./major-transfer.service.js";
import { SubjectRecognitionService } from "./subject-recognition.service.js";

@Controller("plan")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@RequirePermissions("plan.view")
export class PlanController {
  constructor(
    private readonly responsibility: GroupResponsibilityService,
    private readonly plan: PlanService,
    private readonly curriculums: CurriculumService,
    private readonly majorTransfers: MajorTransferService,
    private readonly recognitions: SubjectRecognitionService,
  ) {}

  @Get("training-plan") trainingPlan(@Query("program") program?: string) { return this.plan.trainingPlan(program); }
  @Get("admission-targets") @RequirePermissions("admission.view") admissionTargets() { return this.plan.admissionTargets(); }
  @Get("annual-fees") annualFees() { return this.plan.annualFees(); }

  @Get("subjects") subjects(
    @Query("majorId") majorId?: string,
    @Query("program") program?: string,
    @Query("includeCommon") includeCommon?: string,
  ) {
    return this.plan.listSubjects(majorId, program, includeCommon === "true");
  }
  @Post("subjects") @RequirePermissions("plan.manage") createSubject(@Body() dto: CreateSubjectDto) { return this.plan.createSubject(dto); }
  @Post("subjects/link-existing") @RequirePermissions("plan.manage") createSubjectFromExisting(@Body() dto: CreateSubjectFromExistingDto) { return this.plan.createSubjectFromExisting(dto); }
  @Post("subjects/shared") @RequirePermissions("plan.manage") createSharedSubjects(@Body() dto: CreateSharedSubjectsDto) { return this.plan.createSharedSubjects(dto); }
  @Put("subjects/:id") @RequirePermissions("plan.manage") updateSubject(@Param("id") id: string, @Body() dto: UpdateSubjectDto) { return this.plan.updateSubject(id, dto); }
  @Delete("subjects/:id") @RequirePermissions("plan.manage") removeSubject(@Param("id") id: string) { return this.plan.removeSubject(id); }

  // ===== Lớp học =====
  @Get("classes") classes(@Query("majorId") majorId?: string, @Query("program") program?: string, @Query("year") year?: string) { return this.plan.listClasses(majorId, program, year); }
  @Post("classes") @RequirePermissions("plan.manage") async createClass(@Body() dto: CreateClassDto, @CurrentUser() actor: any) { return this.plan.createClass({ ...dto, responsibleStaffId: await this.responsibility.forCreation(actor, dto.responsibleStaffId) }); }
  @Put("classes/:id") @RequirePermissions("plan.manage") updateClass(@Param("id") id: string, @Body() dto: UpdateClassDto) { return this.plan.updateClass(id, dto); }
  @Delete("classes/:id") @RequirePermissions("plan.manage") removeClass(@Param("id") id: string) { return this.plan.removeClass(id); }

  // ===== Chương trình đào tạo (theo ngành + bậc + khóa) =====
  @Get("curriculums") listCurriculums(@Query("majorId") majorId?: string, @Query("program") program?: string) { return this.curriculums.list(majorId, program); }
  @Get("curriculums/:id") curriculum(@Param("id") id: string) { return this.curriculums.detail(id); }
  @Post("curriculums") @RequirePermissions("plan.manage") createCurriculum(@Body() dto: CreateCurriculumDto) { return this.curriculums.create(dto); }
  @Put("curriculums/:id") @RequirePermissions("plan.manage") updateCurriculum(@Param("id") id: string, @Body() dto: UpdateCurriculumDto) { return this.curriculums.update(id, dto); }
  @Put("curriculums/:id/subjects") @RequirePermissions("plan.manage") setCurriculumSubjects(@Param("id") id: string, @Body() dto: SetCurriculumSubjectsDto) { return this.curriculums.setSubjects(id, dto); }
  @Delete("curriculums/:id") @RequirePermissions("plan.manage") removeCurriculum(@Param("id") id: string) { return this.curriculums.remove(id); }

  // ===== Học phần của lớp: toàn bộ học phần thuộc CTĐT lớp đã chọn =====
  @Get("classes/:id/subjects") classSubjects(@Param("id") id: string) { return this.curriculums.classSubjects(id); }
  @Post("classes/:id/curriculum") @RequirePermissions("plan.manage") ensureClassCurriculum(@Param("id") id: string) { return this.curriculums.ensureForClass(id); }

  // ===== Hồ sơ tuyển sinh (Admission Records) =====
  @Get("admission-records") @RequirePermissions("admission.view")
  listAdmissionRecords(
    @Query("majorId") majorId?: string,
    @Query("trainingLevel") trainingLevel?: string,
    @Query("academicYear") academicYear?: string,
    @Query("status") status?: string,
    @Query("disciplineId") disciplineId?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("excludeStatus") excludeStatus?: string,
    @Query("includeGroup") includeGroup?: string,
    @Query("admissionStage") admissionStage?: string,
  ) {
    return this.plan.listAdmissionRecords(
      majorId, trainingLevel, academicYear, status, disciplineId, search, page, pageSize,
      excludeStatus, includeGroup === "true", admissionStage,
    );
  }

  @Get("admission-records/:id") @RequirePermissions("admission.view")
  getAdmissionRecord(@Param("id") id: string) {
    return this.plan.getAdmissionRecord(id);
  }

  @Post("admission-records")
  @RequirePermissions("admission.manage")
  createAdmissionRecord(@Body() dto: CreateAdmissionRecordDto) {
    return this.plan.createAdmissionRecord(dto);
  }

  @Put("admission-records/:id")
  @RequirePermissions("admission.manage")
  updateAdmissionRecord(@Param("id") id: string, @Body() dto: UpdateAdmissionRecordDto) {
    return this.plan.updateAdmissionRecord(id, dto);
  }

  @Delete("admission-records/:id")
  @RequirePermissions("admission.manage")
  removeAdmissionRecord(@Param("id") id: string) {
    return this.plan.removeAdmissionRecord(id);
  }

  @Get("admission-records/:id/major-transfers") @RequirePermissions("admission.view")
  majorTransferHistory(@Param("id") id: string) { return this.majorTransfers.list(id); }

  @Post("admission-records/:id/major-transfers")
  @RequirePermissions("admission.manage")
  requestMajorTransfer(@Param("id") id: string, @Body() dto: RequestMajorTransferDto) {
    return this.majorTransfers.request(id, dto);
  }

  @Put("major-transfers/:id/decision")
  @RequirePermissions("admission.manage")
  decideMajorTransfer(@Param("id") id: string, @Body() dto: DecideMajorTransferDto, @CurrentUser() actor: any) {
    return this.majorTransfers.decide(id, dto, actor);
  }

  @Put("subject-recognitions/:id")
  @RequirePermissions("admission.manage")
  updateSubjectRecognition(@Param("id") id: string, @Body() dto: UpdateSubjectRecognitionDto) {
    return this.majorTransfers.updateRecognition(id, dto);
  }

  // ===== Kết quả học phần cá nhân (tiền thạc sĩ / học trước / chính khóa) =====
  @Get("admission-records/:id/learning-results") @RequirePermissions("admission.view")
  learningResults(@Param("id") id: string) { return this.recognitions.listLearningResults(id); }

  @Get("admission-records/:id/studied-subjects") @RequirePermissions("admission.view")
  studiedSubjects(@Param("id") id: string) { return this.recognitions.listStudiedSubjects(id); }

  @Post("admission-records/:id/learning-results")
  @RequirePermissions("admission.manage")
  createLearningResult(@Param("id") id: string, @Body() dto: CreateLearningResultDto) {
    return this.recognitions.createLearningResult(id, dto);
  }

  @Put("learning-results/:id")
  @RequirePermissions("admission.manage")
  updateLearningResult(@Param("id") id: string, @Body() dto: UpdateLearningResultDto) {
    return this.recognitions.updateLearningResult(id, dto);
  }

  @Delete("learning-results/:id")
  @RequirePermissions("admission.manage")
  removeLearningResult(@Param("id") id: string) { return this.recognitions.removeLearningResult(id); }

  // ===== Công nhận học phần dùng chung cho cả chuyển ngành, tiền thạc sĩ và học trước =====
  @Get("admission-records/:id/subject-recognitions") @RequirePermissions("admission.view")
  subjectRecognitions(@Param("id") id: string) { return this.recognitions.listRecognitions(id); }

  @Get("admission-records/:id/recognized-credits") @RequirePermissions("admission.view")
  recognizedCredits(@Param("id") id: string) { return this.recognitions.recognizedCredits(id); }

  @Post("admission-records/:id/subject-recognitions/propose")
  @RequirePermissions("admission.manage")
  proposeRecognitions(@Param("id") id: string, @Body() dto: ProposeRecognitionsDto) {
    return this.recognitions.proposeForRecord(id, dto);
  }

  @Put("subject-recognitions/:id/decision")
  @RequirePermissions("admission.manage")
  decideRecognition(@Param("id") id: string, @Body() dto: DecideRecognitionDto) {
    return this.recognitions.decide(id, dto);
  }

  /** Xóa quyết định công nhận để sửa lại; đối chiếu lại sẽ tạo đề xuất mới theo dữ liệu hiện hành. */
  @Delete("subject-recognitions/:id")
  @RequirePermissions("admission.manage")
  removeRecognition(@Param("id") id: string) { return this.recognitions.removeRecognition(id); }
}
