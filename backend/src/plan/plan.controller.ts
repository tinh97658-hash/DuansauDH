import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { Roles } from "../common/auth-user.js";
import { RolesGuard } from "../common/roles.guard.js";
import {
  CreateAdmissionRecordDto, CreateClassDto, CreateCurriculumDto, CreateLearningResultDto, CreateSharedSubjectsDto, CreateSubjectDto,
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
@UseGuards(AuthenticatedGuard)
export class PlanController {
  constructor(
    private readonly plan: PlanService,
    private readonly curriculums: CurriculumService,
    private readonly majorTransfers: MajorTransferService,
    private readonly recognitions: SubjectRecognitionService,
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
  @Post("subjects/shared") @Roles("admin") @UseGuards(RolesGuard) createSharedSubjects(@Body() dto: CreateSharedSubjectsDto) { return this.plan.createSharedSubjects(dto); }
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

  // ===== Học phần của lớp: toàn bộ học phần thuộc CTĐT lớp đã chọn =====
  @Get("classes/:id/subjects") classSubjects(@Param("id") id: string) { return this.curriculums.classSubjects(id); }
  @Post("classes/:id/curriculum") @Roles("admin") @UseGuards(RolesGuard) ensureClassCurriculum(@Param("id") id: string) { return this.curriculums.ensureForClass(id); }

  // ===== Hồ sơ tuyển sinh (Admission Records) =====
  @Get("admission-records")
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
  ) {
    return this.plan.listAdmissionRecords(
      majorId, trainingLevel, academicYear, status, disciplineId, search, page, pageSize,
      excludeStatus, includeGroup === "true",
    );
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

  @Get("admission-records/:id/major-transfers")
  majorTransferHistory(@Param("id") id: string) { return this.majorTransfers.list(id); }

  @Post("admission-records/:id/major-transfers")
  @Roles("admin") @UseGuards(RolesGuard)
  requestMajorTransfer(@Param("id") id: string, @Body() dto: RequestMajorTransferDto) {
    return this.majorTransfers.request(id, dto);
  }

  @Put("major-transfers/:id/decision")
  @Roles("admin") @UseGuards(RolesGuard)
  decideMajorTransfer(@Param("id") id: string, @Body() dto: DecideMajorTransferDto) {
    return this.majorTransfers.decide(id, dto);
  }

  @Put("subject-recognitions/:id")
  @Roles("admin") @UseGuards(RolesGuard)
  updateSubjectRecognition(@Param("id") id: string, @Body() dto: UpdateSubjectRecognitionDto) {
    return this.majorTransfers.updateRecognition(id, dto);
  }

  // ===== Kết quả học phần cá nhân (tiền thạc sĩ / học trước / chính khóa) =====
  @Get("admission-records/:id/learning-results")
  learningResults(@Param("id") id: string) { return this.recognitions.listLearningResults(id); }

  @Post("admission-records/:id/learning-results")
  @Roles("admin") @UseGuards(RolesGuard)
  createLearningResult(@Param("id") id: string, @Body() dto: CreateLearningResultDto) {
    return this.recognitions.createLearningResult(id, dto);
  }

  @Put("learning-results/:id")
  @Roles("admin") @UseGuards(RolesGuard)
  updateLearningResult(@Param("id") id: string, @Body() dto: UpdateLearningResultDto) {
    return this.recognitions.updateLearningResult(id, dto);
  }

  @Delete("learning-results/:id")
  @Roles("admin") @UseGuards(RolesGuard)
  removeLearningResult(@Param("id") id: string) { return this.recognitions.removeLearningResult(id); }

  // ===== Công nhận học phần dùng chung cho cả chuyển ngành, tiền thạc sĩ và học trước =====
  @Get("admission-records/:id/subject-recognitions")
  subjectRecognitions(@Param("id") id: string) { return this.recognitions.listRecognitions(id); }

  @Get("admission-records/:id/recognized-credits")
  recognizedCredits(@Param("id") id: string) { return this.recognitions.recognizedCredits(id); }

  @Post("admission-records/:id/subject-recognitions/propose")
  @Roles("admin") @UseGuards(RolesGuard)
  proposeRecognitions(@Param("id") id: string, @Body() dto: ProposeRecognitionsDto) {
    return this.recognitions.proposeForRecord(id, dto);
  }

  @Put("subject-recognitions/:id/decision")
  @Roles("admin") @UseGuards(RolesGuard)
  decideRecognition(@Param("id") id: string, @Body() dto: DecideRecognitionDto) {
    return this.recognitions.decide(id, dto);
  }

  /** Xóa quyết định công nhận để sửa lại; đối chiếu lại sẽ tạo đề xuất mới theo dữ liệu hiện hành. */
  @Delete("subject-recognitions/:id")
  @Roles("admin") @UseGuards(RolesGuard)
  removeRecognition(@Param("id") id: string) { return this.recognitions.removeRecognition(id); }
}
