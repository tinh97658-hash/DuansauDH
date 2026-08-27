import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { Roles } from "../common/auth-user.js";
import { RolesGuard } from "../common/roles.guard.js";
import { CreateCatalogDto, UpdateCatalogDto } from "./dto/catalog.dto.js";
import { SystemService } from "./system.service.js";

@Controller("system")
@UseGuards(AuthenticatedGuard)
export class SystemController {
  constructor(private readonly system: SystemService) {}

  @Get("unit-info") unitInfo() { return this.system.unitInfo(); }
  @Get("license") license() { return this.system.license(); }
  @Get("change-password") changePassword() { return this.system.changePassword(); }
  @Get("users") users() { return this.system.users(); }

  // ===== Dân tộc =====
  @Get("ethnicities") ethnicities() { return this.system.listEthnicities(); }
  @Post("ethnicities") @Roles("admin") @UseGuards(RolesGuard) createEthnicity(@Body() dto: CreateCatalogDto) { return this.system.createEthnicity(dto); }
  @Put("ethnicities/:id") @Roles("admin") @UseGuards(RolesGuard) updateEthnicity(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateEthnicity(id, dto); }
  @Delete("ethnicities/:id") @Roles("admin") @UseGuards(RolesGuard) removeEthnicity(@Param("id") id: string) { return this.system.removeEthnicity(id); }

  // ===== Quốc tịch =====
  @Get("nationalities") nationalities() { return this.system.listNationalities(); }
  @Post("nationalities") @Roles("admin") @UseGuards(RolesGuard) createNationality(@Body() dto: CreateCatalogDto) { return this.system.createNationality(dto); }
  @Put("nationalities/:id") @Roles("admin") @UseGuards(RolesGuard) updateNationality(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateNationality(id, dto); }
  @Delete("nationalities/:id") @Roles("admin") @UseGuards(RolesGuard) removeNationality(@Param("id") id: string) { return this.system.removeNationality(id); }

  // ===== Thành phố =====
  @Get("cities") cities() { return this.system.listCities(); }
  @Post("cities") @Roles("admin") @UseGuards(RolesGuard) createCity(@Body() dto: CreateCatalogDto) { return this.system.createCity(dto); }
  @Put("cities/:id") @Roles("admin") @UseGuards(RolesGuard) updateCity(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateCity(id, dto); }
  @Delete("cities/:id") @Roles("admin") @UseGuards(RolesGuard) removeCity(@Param("id") id: string) { return this.system.removeCity(id); }

  // ===== Quận huyện =====
  @Get("districts") districts() { return this.system.listDistricts(); }
  @Post("districts") @Roles("admin") @UseGuards(RolesGuard) createDistrict(@Body() dto: CreateCatalogDto) { return this.system.createDistrict(dto); }
  @Put("districts/:id") @Roles("admin") @UseGuards(RolesGuard) updateDistrict(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateDistrict(id, dto); }
  @Delete("districts/:id") @Roles("admin") @UseGuards(RolesGuard) removeDistrict(@Param("id") id: string) { return this.system.removeDistrict(id); }

  // ===== Phường xã =====
  @Get("wards") wards() { return this.system.listWards(); }
  @Post("wards") @Roles("admin") @UseGuards(RolesGuard) createWard(@Body() dto: CreateCatalogDto) { return this.system.createWard(dto); }
  @Put("wards/:id") @Roles("admin") @UseGuards(RolesGuard) updateWard(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateWard(id, dto); }
  @Delete("wards/:id") @Roles("admin") @UseGuards(RolesGuard) removeWard(@Param("id") id: string) { return this.system.removeWard(id); }

  // ===== Giảng viên =====
  @Get("lecturers") lecturers() { return this.system.listLecturers(); }
  @Post("lecturers") @Roles("admin") @UseGuards(RolesGuard) createLecturer(@Body() dto: CreateCatalogDto) { return this.system.createLecturer(dto); }
  @Put("lecturers/:id") @Roles("admin") @UseGuards(RolesGuard) updateLecturer(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateLecturer(id, dto); }
  @Delete("lecturers/:id") @Roles("admin") @UseGuards(RolesGuard) removeLecturer(@Param("id") id: string) { return this.system.removeLecturer(id); }

  // ===== Nhóm hình thức đào tạo =====
  @Get("training-mode-groups") trainingModeGroups() { return this.system.listTrainingModeGroups(); }
  @Post("training-mode-groups") @Roles("admin") @UseGuards(RolesGuard) createTrainingModeGroup(@Body() dto: CreateCatalogDto) { return this.system.createTrainingModeGroup(dto); }
  @Put("training-mode-groups/:id") @Roles("admin") @UseGuards(RolesGuard) updateTrainingModeGroup(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateTrainingModeGroup(id, dto); }
  @Delete("training-mode-groups/:id") @Roles("admin") @UseGuards(RolesGuard) removeTrainingModeGroup(@Param("id") id: string) { return this.system.removeTrainingModeGroup(id); }

  // ===== Hình thức đào tạo =====
  @Get("training-modes") trainingModes() { return this.system.listTrainingModes(); }
  @Post("training-modes") @Roles("admin") @UseGuards(RolesGuard) createTrainingMode(@Body() dto: CreateCatalogDto) { return this.system.createTrainingMode(dto); }
  @Put("training-modes/:id") @Roles("admin") @UseGuards(RolesGuard) updateTrainingMode(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateTrainingMode(id, dto); }
  @Delete("training-modes/:id") @Roles("admin") @UseGuards(RolesGuard) removeTrainingMode(@Param("id") id: string) { return this.system.removeTrainingMode(id); }

  // ===== Trình độ đào tạo =====
  @Get("training-levels") trainingLevels() { return this.system.listTrainingLevels(); }
  @Post("training-levels") @Roles("admin") @UseGuards(RolesGuard) createTrainingLevel(@Body() dto: CreateCatalogDto) { return this.system.createTrainingLevel(dto); }
  @Put("training-levels/:id") @Roles("admin") @UseGuards(RolesGuard) updateTrainingLevel(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateTrainingLevel(id, dto); }
  @Delete("training-levels/:id") @Roles("admin") @UseGuards(RolesGuard) removeTrainingLevel(@Param("id") id: string) { return this.system.removeTrainingLevel(id); }

  // ===== Ngành học =====
  @Get("majors") majors(
    @Query("program") program?: string,
    @Query("trainingLevelId") trainingLevelId?: string,
  ) {
    return this.system.listMajors(program, trainingLevelId);
  }
  @Post("majors") @Roles("admin") @UseGuards(RolesGuard) createMajor(@Body() dto: CreateCatalogDto) { return this.system.createMajor(dto); }
  @Put("majors/:id") @Roles("admin") @UseGuards(RolesGuard) updateMajor(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateMajor(id, dto); }
  @Delete("majors/:id") @Roles("admin") @UseGuards(RolesGuard) removeMajor(@Param("id") id: string) { return this.system.removeMajor(id); }

  // ===== Trạng thái học =====
  @Get("study-statuses") studyStatuses() { return this.system.listStudyStatuses(); }
  @Post("study-statuses") @Roles("admin") @UseGuards(RolesGuard) createStudyStatus(@Body() dto: CreateCatalogDto) { return this.system.createStudyStatus(dto); }
  @Put("study-statuses/:id") @Roles("admin") @UseGuards(RolesGuard) updateStudyStatus(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateStudyStatus(id, dto); }
  @Delete("study-statuses/:id") @Roles("admin") @UseGuards(RolesGuard) removeStudyStatus(@Param("id") id: string) { return this.system.removeStudyStatus(id); }

  // ===== Học phần bổ sung kiến thức =====
  @Get("bridge-knowledge") bridgeKnowledge() { return this.system.listBridgeKnowledge(); }
  @Post("bridge-knowledge") @Roles("admin") @UseGuards(RolesGuard) createBridgeKnowledge(@Body() dto: CreateCatalogDto) { return this.system.createBridgeKnowledge(dto); }
  @Put("bridge-knowledge/:id") @Roles("admin") @UseGuards(RolesGuard) updateBridgeKnowledge(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateBridgeKnowledge(id, dto); }
  @Delete("bridge-knowledge/:id") @Roles("admin") @UseGuards(RolesGuard) removeBridgeKnowledge(@Param("id") id: string) { return this.system.removeBridgeKnowledge(id); }

  @Get("check-update") checkUpdate() { return this.system.checkUpdate(); }
}
