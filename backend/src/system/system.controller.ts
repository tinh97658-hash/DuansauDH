import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { RbacService } from "../auth/rbac.service.js";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { CurrentUser } from "../common/auth-user.js";
import { RequirePermissions } from "../common/permissions.decorator.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { CreateCatalogDto, CreateRoomDto, UpdateCatalogDto, UpdateRoomDto } from "./dto/catalog.dto.js";
import { SystemService } from "./system.service.js";

@Controller("system")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
export class SystemController {
  constructor(private readonly system: SystemService, private readonly rbac: RbacService) {}

  @Get("unit-info") unitInfo() { return this.system.unitInfo(); }
  @Get("license") license() { return this.system.license(); }
  @Get("change-password") changePassword() { return this.system.changePassword(); }

  // ===== Dân tộc =====
  @Get("ethnicities") ethnicities() { return this.system.listEthnicities(); }
  @Post("ethnicities") @RequirePermissions("catalog.manage") createEthnicity(@Body() dto: CreateCatalogDto) { return this.system.createEthnicity(dto); }
  @Put("ethnicities/:id") @RequirePermissions("catalog.manage") updateEthnicity(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateEthnicity(id, dto); }
  @Delete("ethnicities/:id") @RequirePermissions("catalog.manage") removeEthnicity(@Param("id") id: string) { return this.system.removeEthnicity(id); }

  // ===== Quốc tịch =====
  @Get("nationalities") nationalities() { return this.system.listNationalities(); }
  @Post("nationalities") @RequirePermissions("catalog.manage") createNationality(@Body() dto: CreateCatalogDto) { return this.system.createNationality(dto); }
  @Put("nationalities/:id") @RequirePermissions("catalog.manage") updateNationality(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateNationality(id, dto); }
  @Delete("nationalities/:id") @RequirePermissions("catalog.manage") removeNationality(@Param("id") id: string) { return this.system.removeNationality(id); }

  // ===== Thành phố =====
  @Get("cities") cities() { return this.system.listCities(); }
  @Post("cities") @RequirePermissions("catalog.manage") createCity(@Body() dto: CreateCatalogDto) { return this.system.createCity(dto); }
  @Put("cities/:id") @RequirePermissions("catalog.manage") updateCity(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateCity(id, dto); }
  @Delete("cities/:id") @RequirePermissions("catalog.manage") removeCity(@Param("id") id: string) { return this.system.removeCity(id); }

  // ===== Quận huyện =====
  @Get("districts") districts() { return this.system.listDistricts(); }
  @Post("districts") @RequirePermissions("catalog.manage") createDistrict(@Body() dto: CreateCatalogDto) { return this.system.createDistrict(dto); }
  @Put("districts/:id") @RequirePermissions("catalog.manage") updateDistrict(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateDistrict(id, dto); }
  @Delete("districts/:id") @RequirePermissions("catalog.manage") removeDistrict(@Param("id") id: string) { return this.system.removeDistrict(id); }

  // ===== Phường xã =====
  @Get("wards") wards() { return this.system.listWards(); }
  @Post("wards") @RequirePermissions("catalog.manage") createWard(@Body() dto: CreateCatalogDto) { return this.system.createWard(dto); }
  @Put("wards/:id") @RequirePermissions("catalog.manage") updateWard(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateWard(id, dto); }
  @Delete("wards/:id") @RequirePermissions("catalog.manage") removeWard(@Param("id") id: string) { return this.system.removeWard(id); }

  // ===== Giảng viên =====
  @Get("units") units() { return this.system.listUnits(); }
  @Post("units") @RequirePermissions("catalog.manage") createUnit(@Body() dto: CreateCatalogDto) { return this.system.createUnit(dto); }
  @Put("units/:id") @RequirePermissions("catalog.manage") updateUnit(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateUnit(id, dto); }
  @Delete("units/:id") @RequirePermissions("catalog.manage") removeUnit(@Param("id") id: string) { return this.system.removeUnit(id); }

  @Get("lecturers") lecturers() { return this.system.listLecturers(); }
  @Post("lecturers") @RequirePermissions("catalog.manage") createLecturer(@Body() dto: CreateCatalogDto) { return this.system.createLecturer(dto); }
  @Put("lecturers/:id") @RequirePermissions("catalog.manage") updateLecturer(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateLecturer(id, dto); }
  @Delete("lecturers/:id") @RequirePermissions("catalog.manage") removeLecturer(@Param("id") id: string) { return this.system.removeLecturer(id); }

  // ===== Phòng học dùng chung =====
  @Get("rooms") @RequirePermissions("catalog.view") async rooms(
    @CurrentUser() user: any,
    @Query("includeInactive") includeInactive?: string,
  ) {
    if (includeInactive !== "true") return this.system.listRooms(false);
    const access = await this.rbac.effectiveAccess(user);
    const canManageCatalog = access.superadmin || access.permissions.has("catalog.manage");
    return this.system.listRooms(canManageCatalog);
  }
  @Post("rooms") @RequirePermissions("catalog.manage") createRoom(@Body() dto: CreateRoomDto) { return this.system.createRoom(dto); }
  @Put("rooms/:id") @RequirePermissions("catalog.manage") updateRoom(@Param("id") id: string, @Body() dto: UpdateRoomDto) { return this.system.updateRoom(id, dto); }

  // ===== Nhóm hình thức đào tạo =====
  @Get("training-mode-groups") trainingModeGroups() { return this.system.listTrainingModeGroups(); }
  @Post("training-mode-groups") @RequirePermissions("catalog.manage") createTrainingModeGroup(@Body() dto: CreateCatalogDto) { return this.system.createTrainingModeGroup(dto); }
  @Put("training-mode-groups/:id") @RequirePermissions("catalog.manage") updateTrainingModeGroup(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateTrainingModeGroup(id, dto); }
  @Delete("training-mode-groups/:id") @RequirePermissions("catalog.manage") removeTrainingModeGroup(@Param("id") id: string) { return this.system.removeTrainingModeGroup(id); }

  // ===== Hình thức đào tạo =====
  @Get("training-modes") trainingModes() { return this.system.listTrainingModes(); }
  @Post("training-modes") @RequirePermissions("catalog.manage") createTrainingMode(@Body() dto: CreateCatalogDto) { return this.system.createTrainingMode(dto); }
  @Put("training-modes/:id") @RequirePermissions("catalog.manage") updateTrainingMode(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateTrainingMode(id, dto); }
  @Delete("training-modes/:id") @RequirePermissions("catalog.manage") removeTrainingMode(@Param("id") id: string) { return this.system.removeTrainingMode(id); }

  // ===== Trình độ đào tạo =====
  @Get("training-levels") trainingLevels() { return this.system.listTrainingLevels(); }
  @Post("training-levels") @RequirePermissions("catalog.manage") createTrainingLevel(@Body() dto: CreateCatalogDto) { return this.system.createTrainingLevel(dto); }
  @Put("training-levels/:id") @RequirePermissions("catalog.manage") updateTrainingLevel(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateTrainingLevel(id, dto); }
  @Delete("training-levels/:id") @RequirePermissions("catalog.manage") removeTrainingLevel(@Param("id") id: string) { return this.system.removeTrainingLevel(id); }

  // ===== Ngành (cấp 1) =====
  @Get("disciplines") disciplines() { return this.system.listDisciplines(); }
  @Post("disciplines") @RequirePermissions("catalog.manage") createDiscipline(@Body() dto: CreateCatalogDto) { return this.system.createDiscipline(dto); }
  @Put("disciplines/:id") @RequirePermissions("catalog.manage") updateDiscipline(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateDiscipline(id, dto); }
  @Delete("disciplines/:id") @RequirePermissions("catalog.manage") removeDiscipline(@Param("id") id: string) { return this.system.removeDiscipline(id); }

  // ===== Chuyên ngành (cấp 2, thuộc một ngành) =====
  @Get("majors") majors(
    @Query("program") program?: string,
    @Query("trainingLevelId") trainingLevelId?: string,
  ) {
    return this.system.listMajors(program, trainingLevelId);
  }
  @Post("majors") @RequirePermissions("catalog.manage") createMajor(@Body() dto: CreateCatalogDto) { return this.system.createMajor(dto); }
  @Put("majors/:id") @RequirePermissions("catalog.manage") updateMajor(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateMajor(id, dto); }
  @Delete("majors/:id") @RequirePermissions("catalog.manage") removeMajor(@Param("id") id: string) { return this.system.removeMajor(id); }

  // ===== Trạng thái học =====
  @Get("study-statuses") studyStatuses() { return this.system.listStudyStatuses(); }
  @Post("study-statuses") @RequirePermissions("catalog.manage") createStudyStatus(@Body() dto: CreateCatalogDto) { return this.system.createStudyStatus(dto); }
  @Put("study-statuses/:id") @RequirePermissions("catalog.manage") updateStudyStatus(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateStudyStatus(id, dto); }
  @Delete("study-statuses/:id") @RequirePermissions("catalog.manage") removeStudyStatus(@Param("id") id: string) { return this.system.removeStudyStatus(id); }

  // ===== Học phần bổ sung kiến thức =====
  @Get("bridge-knowledge") bridgeKnowledge() { return this.system.listBridgeKnowledge(); }
  @Post("bridge-knowledge") @RequirePermissions("catalog.manage") createBridgeKnowledge(@Body() dto: CreateCatalogDto) { return this.system.createBridgeKnowledge(dto); }
  @Put("bridge-knowledge/:id") @RequirePermissions("catalog.manage") updateBridgeKnowledge(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.system.updateBridgeKnowledge(id, dto); }
  @Delete("bridge-knowledge/:id") @RequirePermissions("catalog.manage") removeBridgeKnowledge(@Param("id") id: string) { return this.system.removeBridgeKnowledge(id); }

  @Get("check-update") checkUpdate() { return this.system.checkUpdate(); }
}
