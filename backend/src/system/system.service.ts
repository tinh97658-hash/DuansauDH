import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { col, fn, Op, where } from "sequelize";
import { BridgeKnowledgeSubject } from "../database/models/common/bridge-knowledge-subject.model.js";
import { City } from "../database/models/common/city.model.js";
import { District } from "../database/models/common/district.model.js";
import { Ethnicity } from "../database/models/common/ethnicity.model.js";
import { Lecturer } from "../database/models/common/lecturer.model.js";
import { Major } from "../database/models/common/major.model.js";
import { Room } from "../database/models/common/room.model.js";
import { Nationality } from "../database/models/common/nationality.model.js";
import { StudyStatus } from "../database/models/common/study-status.model.js";
import { TrainingLevel } from "../database/models/common/training-level.model.js";
import { TrainingMode } from "../database/models/common/training-mode.model.js";
import { TrainingModeGroup } from "../database/models/common/training-mode-group.model.js";
import { Ward } from "../database/models/common/ward.model.js";
import { Staff } from "../database/models/staff.model.js";
import { CreateCatalogDto, CreateRoomDto, UpdateCatalogDto, UpdateRoomDto } from "./dto/catalog.dto.js";

// Các model danh mục dùng chung; dùng any để tránh lỗi union ModelStatic với method this của Sequelize.
type CatalogModel = any;

const sort = [["sortOrder", "ASC"], ["name", "ASC"]] as any;

@Injectable()
export class SystemService {
  constructor(
    @InjectModel(Ethnicity) private readonly ethnicities: typeof Ethnicity,
    @InjectModel(Nationality) private readonly nationalities: typeof Nationality,
    @InjectModel(City) private readonly cities: typeof City,
    @InjectModel(District) private readonly districts: typeof District,
    @InjectModel(Ward) private readonly wards: typeof Ward,
    @InjectModel(TrainingModeGroup) private readonly trainingModeGroups: typeof TrainingModeGroup,
    @InjectModel(TrainingMode) private readonly trainingModes: typeof TrainingMode,
    @InjectModel(TrainingLevel) private readonly trainingLevels: typeof TrainingLevel,
    @InjectModel(Major) private readonly majors: typeof Major,
    @InjectModel(StudyStatus) private readonly studyStatuses: typeof StudyStatus,
    @InjectModel(BridgeKnowledgeSubject) private readonly bridgeKnowledgeSubjects: typeof BridgeKnowledgeSubject,
    @InjectModel(Lecturer) private readonly lecturers: typeof Lecturer,
    @InjectModel(Staff) private readonly staff: typeof Staff,
    @InjectModel(Room) private readonly rooms: typeof Room,
  ) {}

  // ===== Các chức năng chưa triển khai =====
  private stub(feature: string, label: string) {
    return { feature, label, status: "not_implemented", message: `Chức năng "${label}" chưa được triển khai.` };
  }

  unitInfo() { return this.stub("unit-info", "Thông tin về đơn vị"); }
  license() { return this.stub("license", "License"); }
  changePassword() { return this.stub("change-password", "Đổi mật khẩu"); }
  users() {
    return this.staff.findAll({ attributes: ["id", "name", "email", "role", "canManageScheduling"], order: [["name", "ASC"], ["id", "ASC"]] });
  }
  checkUpdate() { return this.stub("check-update", "Check Update"); }

  // ===== Tiện ích dùng chung =====
  private pick(dto: object, keys: string[]) {
    const output: Record<string, unknown> = {};
    for (const key of keys) {
      const value = (dto as Record<string, unknown>)[key];
      if (value !== undefined) output[key] = value;
    }
    return output;
  }

  private async ensureCodeUnique(model: CatalogModel, code: string, excludeId?: string) {
    const whereClause: Record<string, unknown> = { code };
    if (excludeId) whereClause.id = { [Op.ne]: excludeId };
    const existing = await model.findOne({ where: whereClause });
    if (existing) throw new ConflictException(`Mã "${code}" đã tồn tại.`);
  }

  private async findOr404(model: CatalogModel, id: string, label: string) {
    const row = await model.findByPk(id);
    if (!row) throw new NotFoundException(`${label} không tồn tại.`);
    return row;
  }

  private async requireParent(model: CatalogModel, id: string | undefined, label: string) {
    if (!id) throw new BadRequestException(`Vui lòng chọn ${label}.`);
    const parent = await model.findByPk(id);
    if (!parent) throw new NotFoundException(`${label} không tồn tại.`);
  }

  private listAll(model: CatalogModel, order: any = sort, options: any = {}) {
    return model.findAll({ order, ...options });
  }

  private async resolveMajorTrainingLevel(program: string, requestedId?: string) {
    const expectedCode = program === "doctoral" ? "DOCTOR" : "MASTER";
    if (requestedId) {
      const requested = await this.trainingLevels.findByPk(requestedId);
      if (!requested) throw new NotFoundException("Trình độ đào tạo không tồn tại.");
      if (requested.code !== expectedCode) {
        throw new BadRequestException("Trình độ đào tạo không phù hợp với bậc của ngành học.");
      }
      return requested.id;
    }
    const expected = await this.trainingLevels.findOne({ where: { code: expectedCode } });
    if (!expected) throw new BadRequestException(`Chưa cấu hình trình độ đào tạo ${expectedCode}.`);
    return expected.id;
  }

  private async createSimple(model: CatalogModel, dto: CreateCatalogDto, label: string, keys = ["code", "name", "sortOrder", "active"]) {
    if (!dto.code) throw new BadRequestException(`Vui lòng nhập mã ${label.toLowerCase()}.`);
    await this.ensureCodeUnique(model, dto.code);
    return model.create(this.pick(dto, keys) as any);
  }

  private async updateSimple(model: CatalogModel, id: string, dto: UpdateCatalogDto, label: string, keys = ["code", "name", "sortOrder", "active"]) {
    const row = await this.findOr404(model, id, label);
    if (dto.code && dto.code !== row.code) await this.ensureCodeUnique(model, dto.code, id);
    await row.update(this.pick(dto, keys) as any);
    return row;
  }

  private async removeSimple(model: CatalogModel, id: string, label: string) {
    const row = await this.findOr404(model, id, label);
    await row.destroy();
    return { message: `Xóa ${label.toLowerCase()} thành công` };
  }

  // ===== Dân tộc =====
  async listEthnicities() { return this.listAll(this.ethnicities); }
  async createEthnicity(dto: CreateCatalogDto) { return this.createSimple(this.ethnicities, dto, "Dân tộc"); }
  async updateEthnicity(id: string, dto: UpdateCatalogDto) { return this.updateSimple(this.ethnicities, id, dto, "Dân tộc"); }
  async removeEthnicity(id: string) { return this.removeSimple(this.ethnicities, id, "Dân tộc"); }

  // ===== Quốc tịch =====
  async listNationalities() { return this.listAll(this.nationalities); }
  async createNationality(dto: CreateCatalogDto) { return this.createSimple(this.nationalities, dto, "Quốc tịch"); }
  async updateNationality(id: string, dto: UpdateCatalogDto) { return this.updateSimple(this.nationalities, id, dto, "Quốc tịch"); }
  async removeNationality(id: string) { return this.removeSimple(this.nationalities, id, "Quốc tịch"); }

  // ===== Thành phố =====
  async listCities() { return this.listAll(this.cities); }
  async createCity(dto: CreateCatalogDto) { return this.createSimple(this.cities, dto, "Thành phố"); }
  async updateCity(id: string, dto: UpdateCatalogDto) { return this.updateSimple(this.cities, id, dto, "Thành phố"); }
  async removeCity(id: string) { return this.removeSimple(this.cities, id, "Thành phố"); }

  // ===== Quận huyện =====
  async listDistricts() {
    return this.districts.findAll({
      include: [{ model: City, as: "city", attributes: ["id", "code", "name"] }],
      order: sort,
    });
  }
  async createDistrict(dto: CreateCatalogDto) {
    if (!dto.code) throw new BadRequestException("Vui lòng nhập mã quận huyện.");
    await this.ensureCodeUnique(this.districts, dto.code);
    await this.requireParent(this.cities, dto.cityId, "Thành phố");
    return this.districts.create(this.pick(dto, ["code", "name", "cityId", "sortOrder", "active"]) as any);
  }
  async updateDistrict(id: string, dto: UpdateCatalogDto) {
    const row = await this.findOr404(this.districts, id, "Quận huyện");
    if (dto.code && dto.code !== row.code) await this.ensureCodeUnique(this.districts, dto.code, id);
    if (dto.cityId !== undefined && dto.cityId !== null) await this.requireParent(this.cities, dto.cityId, "Thành phố");
    await row.update(this.pick(dto, ["code", "name", "cityId", "sortOrder", "active"]) as any);
    return row;
  }
  async removeDistrict(id: string) { return this.removeSimple(this.districts, id, "Quận huyện"); }

  // ===== Phường xã =====
  async listWards() {
    return this.wards.findAll({
      include: [{ model: District, as: "district", attributes: ["id", "code", "name"], include: [{ model: City, as: "city", attributes: ["id", "code", "name"] }] }],
      order: sort,
    });
  }
  async createWard(dto: CreateCatalogDto) {
    if (!dto.code) throw new BadRequestException("Vui lòng nhập mã phường xã.");
    await this.ensureCodeUnique(this.wards, dto.code);
    await this.requireParent(this.districts, dto.districtId, "Quận huyện");
    return this.wards.create(this.pick(dto, ["code", "name", "districtId", "sortOrder", "active"]) as any);
  }
  async updateWard(id: string, dto: UpdateCatalogDto) {
    const row = await this.findOr404(this.wards, id, "Phường xã");
    if (dto.code && dto.code !== row.code) await this.ensureCodeUnique(this.wards, dto.code, id);
    if (dto.districtId !== undefined && dto.districtId !== null) await this.requireParent(this.districts, dto.districtId, "Quận huyện");
    await row.update(this.pick(dto, ["code", "name", "districtId", "sortOrder", "active"]) as any);
    return row;
  }
  async removeWard(id: string) { return this.removeSimple(this.wards, id, "Phường xã"); }

  // ===== Nhóm hình thức đào tạo =====
  async listTrainingModeGroups() { return this.listAll(this.trainingModeGroups); }
  async createTrainingModeGroup(dto: CreateCatalogDto) { return this.createSimple(this.trainingModeGroups, dto, "Nhóm hình thức đào tạo"); }
  async updateTrainingModeGroup(id: string, dto: UpdateCatalogDto) { return this.updateSimple(this.trainingModeGroups, id, dto, "Nhóm hình thức đào tạo"); }
  async removeTrainingModeGroup(id: string) { return this.removeSimple(this.trainingModeGroups, id, "Nhóm hình thức đào tạo"); }

  // ===== Hình thức đào tạo =====
  async listTrainingModes() {
    return this.trainingModes.findAll({
      include: [{ model: TrainingModeGroup, as: "group", attributes: ["id", "code", "name"] }],
      order: sort,
    });
  }
  async createTrainingMode(dto: CreateCatalogDto) {
    if (!dto.code) throw new BadRequestException("Vui lòng nhập mã hình thức đào tạo.");
    await this.ensureCodeUnique(this.trainingModes, dto.code);
    if (dto.groupId !== undefined && dto.groupId !== null) await this.requireParent(this.trainingModeGroups, dto.groupId, "Nhóm hình thức đào tạo");
    return this.trainingModes.create(this.pick(dto, ["code", "name", "groupId", "sortOrder", "active"]) as any);
  }
  async updateTrainingMode(id: string, dto: UpdateCatalogDto) {
    const row = await this.findOr404(this.trainingModes, id, "Hình thức đào tạo");
    if (dto.code && dto.code !== row.code) await this.ensureCodeUnique(this.trainingModes, dto.code, id);
    if (dto.groupId !== undefined && dto.groupId !== null) await this.requireParent(this.trainingModeGroups, dto.groupId, "Nhóm hình thức đào tạo");
    await row.update(this.pick(dto, ["code", "name", "groupId", "sortOrder", "active"]) as any);
    return row;
  }
  async removeTrainingMode(id: string) { return this.removeSimple(this.trainingModes, id, "Hình thức đào tạo"); }

  // ===== Trình độ đào tạo =====
  async listTrainingLevels() { return this.listAll(this.trainingLevels); }
  async createTrainingLevel(dto: CreateCatalogDto) {
    if (!dto.code) throw new BadRequestException("Vui lòng nhập mã trình độ đào tạo.");
    await this.ensureCodeUnique(this.trainingLevels, dto.code);
    return this.trainingLevels.create(this.pick(dto, ["code", "name", "durationYears", "sortOrder", "active"]) as any);
  }
  async updateTrainingLevel(id: string, dto: UpdateCatalogDto) {
    const row = await this.findOr404(this.trainingLevels, id, "Trình độ đào tạo");
    if (dto.code && dto.code !== row.code) await this.ensureCodeUnique(this.trainingLevels, dto.code, id);
    await row.update(this.pick(dto, ["code", "name", "durationYears", "sortOrder", "active"]) as any);
    return row;
  }
  async removeTrainingLevel(id: string) { return this.removeSimple(this.trainingLevels, id, "Trình độ đào tạo"); }

  // ===== Ngành học =====
  async listMajors(program?: string, trainingLevelId?: string) {
    const where: any = {};
    if (program) where.program = program;
    if (trainingLevelId) where.trainingLevelId = trainingLevelId;
    where.code = { [Op.ne]: "CHUNG" };
    return this.majors.findAll({
      where,
      include: [{ model: TrainingLevel, as: "trainingLevel", attributes: ["id", "code", "name"] }],
      order: [["name", "ASC"]],
    });
  }
  async createMajor(dto: CreateCatalogDto) {
    if (!dto.code) throw new BadRequestException("Vui lòng nhập mã ngành học.");
    await this.ensureCodeUnique(this.majors, dto.code);
    const program = dto.program || "masters";
    const trainingLevelId = await this.resolveMajorTrainingLevel(program, dto.trainingLevelId);
    if (trainingLevelId) await this.requireParent(this.trainingLevels, trainingLevelId, "Trình độ đào tạo");
    return this.majors.create({
      ...this.pick(dto, [
        "code", "name", "program", "isAdmissionScreening", "durationYears", "maxOvertimeYears", "description", "active"
      ]),
      program,
      trainingLevelId,
    } as any);
  }
  async updateMajor(id: string, dto: UpdateCatalogDto) {
    const row = await this.findOr404(this.majors, id, "Ngành học");
    if (dto.code && dto.code !== row.code) await this.ensureCodeUnique(this.majors, dto.code, id);
    const program = dto.program || row.program || "masters";
    const trainingLevelId = await this.resolveMajorTrainingLevel(program, dto.trainingLevelId);
    if (trainingLevelId) await this.requireParent(this.trainingLevels, trainingLevelId, "Trình độ đào tạo");
    await row.update({
      ...this.pick(dto, [
        "code", "name", "program", "isAdmissionScreening", "durationYears", "maxOvertimeYears", "description", "active"
      ]),
      program,
      trainingLevelId,
    } as any);
    return row;
  }
  async removeMajor(id: string) { return this.removeSimple(this.majors, id, "Ngành học"); }

  // ===== Trạng thái học =====
  async listStudyStatuses() { return this.listAll(this.studyStatuses); }
  async createStudyStatus(dto: CreateCatalogDto) { return this.createSimple(this.studyStatuses, dto, "Trạng thái học"); }
  async updateStudyStatus(id: string, dto: UpdateCatalogDto) { return this.updateSimple(this.studyStatuses, id, dto, "Trạng thái học"); }
  async removeStudyStatus(id: string) { return this.removeSimple(this.studyStatuses, id, "Trạng thái học"); }

  // ===== Học phần bổ sung kiến thức =====
  async listBridgeKnowledge() { return this.listAll(this.bridgeKnowledgeSubjects); }
  async createBridgeKnowledge(dto: CreateCatalogDto) {
    if (!dto.code) throw new BadRequestException("Vui lòng nhập mã học phần.");
    await this.ensureCodeUnique(this.bridgeKnowledgeSubjects, dto.code);
    return this.bridgeKnowledgeSubjects.create(this.pick(dto, ["code", "name", "credits", "sortOrder", "active"]) as any);
  }
  async updateBridgeKnowledge(id: string, dto: UpdateCatalogDto) {
    const row = await this.findOr404(this.bridgeKnowledgeSubjects, id, "Học phần bổ sung kiến thức");
    if (dto.code && dto.code !== row.code) await this.ensureCodeUnique(this.bridgeKnowledgeSubjects, dto.code, id);
    await row.update(this.pick(dto, ["code", "name", "credits", "sortOrder", "active"]) as any);
    return row;
  }
  async removeBridgeKnowledge(id: string) { return this.removeSimple(this.bridgeKnowledgeSubjects, id, "Học phần bổ sung kiến thức"); }

  // ===== Giảng viên =====
  async listLecturers() {
    return this.lecturers.findAll({
      include: [{ model: Staff, as: "staff", attributes: ["id", "name", "email"] }],
      order: [["name", "ASC"]],
    });
  }
  async createLecturer(dto: CreateCatalogDto) {
    if (!dto.code) throw new BadRequestException("Vui lòng nhập mã giảng viên.");
    if (!dto.name) throw new BadRequestException("Vui lòng nhập tên giảng viên.");
    await this.ensureCodeUnique(this.lecturers, dto.code);
    if (dto.email) await this.ensureEmailUnique(dto.email);
    if (dto.staffId !== undefined && dto.staffId !== null) await this.requireParent(this.staff, dto.staffId, "Tài khoản nhân sự");
    return this.lecturers.create(this.pick(dto, [
      "staffId", "code", "name", "phone", "email", "academicRank", "academicDegree", "teachingType", "title", "department", "active"
    ]) as any);
  }
  async updateLecturer(id: string, dto: UpdateCatalogDto) {
    const row = await this.findOr404(this.lecturers, id, "Giảng viên");
    if (dto.code && dto.code !== row.code) await this.ensureCodeUnique(this.lecturers, dto.code, id);
    if (dto.email && dto.email !== row.email) await this.ensureEmailUnique(dto.email, id);
    if (dto.staffId !== undefined && dto.staffId !== null) await this.requireParent(this.staff, dto.staffId, "Tài khoản nhân sự");
    await row.update(this.pick(dto, [
      "staffId", "code", "name", "phone", "email", "academicRank", "academicDegree", "teachingType", "title", "department", "active"
    ]) as any);
    return row;
  }
  async removeLecturer(id: string) { return this.removeSimple(this.lecturers, id, "Giảng viên"); }

  // ===== Phòng học dùng chung =====
  async listRooms(includeInactive = false) {
    return this.rooms.findAll({
      ...(includeInactive ? {} : { where: { isActive: true } }),
      order: [["code", "ASC"], ["name", "ASC"]],
    });
  }

  async createRoom(dto: CreateRoomDto) {
    await this.ensureCodeUnique(this.rooms, dto.code);
    return this.rooms.create(this.pick(dto, ["code", "name", "capacity", "isActive"]) as any);
  }

  async updateRoom(id: string, dto: UpdateRoomDto) {
    const room = await this.findOr404(this.rooms, id, "Phòng học");
    if (dto.code && dto.code !== room.code) await this.ensureCodeUnique(this.rooms, dto.code, id);
    await room.update(this.pick(dto, ["code", "name", "capacity", "isActive"]) as any);
    return room;
  }

  private async ensureEmailUnique(email: string, excludeId?: string) {
    if (!email || !email.trim()) return;
    const existing = await this.lecturers.findOne({ where: where(fn("lower", col("email")), email.trim().toLowerCase()) });
    if (existing && existing.id !== excludeId) throw new ConflictException(`Email "${email}" đã tồn tại.`);
  }
}
