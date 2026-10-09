import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/sequelize";
import { Sequelize } from "sequelize-typescript";
import type { Transaction } from "sequelize";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { classGroupCode } from "../plan/class-group-code.js";
import { col, fn, Op, where } from "sequelize";
import { BridgeKnowledgeSubject } from "../database/models/common/bridge-knowledge-subject.model.js";
import { City } from "../database/models/common/city.model.js";
import { Discipline } from "../database/models/common/discipline.model.js";
import { District } from "../database/models/common/district.model.js";
import { Ethnicity } from "../database/models/common/ethnicity.model.js";
import { Lecturer } from "../database/models/common/lecturer.model.js";
import { Unit } from "../database/models/common/unit.model.js";
import { Major } from "../database/models/common/major.model.js";
import { Room } from "../database/models/common/room.model.js";
import { Nationality } from "../database/models/common/nationality.model.js";
import { StudyStatus } from "../database/models/common/study-status.model.js";
import { TrainingLevel } from "../database/models/common/training-level.model.js";
import { TrainingMode } from "../database/models/common/training-mode.model.js";
import { TrainingModeGroup } from "../database/models/common/training-mode-group.model.js";
import { Ward } from "../database/models/common/ward.model.js";
import { Subject } from "../database/models/plan/subject.model.js";
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
    @InjectModel(Discipline) private readonly disciplines: typeof Discipline,
    @InjectModel(Major) private readonly majors: typeof Major,
    @InjectModel(StudyStatus) private readonly studyStatuses: typeof StudyStatus,
    @InjectModel(BridgeKnowledgeSubject) private readonly bridgeKnowledgeSubjects: typeof BridgeKnowledgeSubject,
    @InjectModel(Lecturer) private readonly lecturers: typeof Lecturer,
    @InjectModel(Staff) private readonly staff: typeof Staff,
    @InjectModel(Room) private readonly rooms: typeof Room,
    @InjectModel(Subject) private readonly subjects: typeof Subject,
    @InjectModel(ClassGroup) private readonly classGroups: typeof ClassGroup = ClassGroup,
    @InjectConnection() private readonly sequelize: Sequelize = null as any,
    @InjectModel(Unit) private readonly units: typeof Unit = Unit,
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

  // ===== Ngành (cấp 1) =====
  async listDisciplines() {
    return this.disciplines.findAll({ order: [["sortOrder", "ASC"], ["name", "ASC"]] });
  }
  async createDiscipline(dto: CreateCatalogDto) {
    if (!dto.code) throw new BadRequestException("Vui lòng nhập mã ngành.");
    await this.ensureCodeUnique(this.disciplines, dto.code);
    return this.disciplines.create(this.pick(dto, ["code", "name", "englishName", "description", "sortOrder", "active"]) as any);
  }
  async updateDiscipline(id: string, dto: UpdateCatalogDto) {
    const row = await this.findOr404(this.disciplines, id, "Ngành");
    if (dto.code && dto.code !== row.code) await this.ensureCodeUnique(this.disciplines, dto.code, id);
    await row.update(this.pick(dto, ["code", "name", "englishName", "description", "sortOrder", "active"]) as any);
    return row;
  }
  async removeDiscipline(id: string) {
    const row = await this.findOr404(this.disciplines, id, "Ngành");
    const majorCount = await this.majors.count({ where: { disciplineId: id } });
    if (majorCount > 0) {
      throw new ConflictException(`Ngành "${row.name}" còn ${majorCount} chuyên ngành. Vui lòng xoá hoặc chuyển các chuyên ngành trước.`);
    }
    await row.destroy();
    return { message: "Xóa ngành thành công" };
  }

  // ===== Chuyên ngành (cấp 2, thuộc một ngành) =====
  async listMajors(program?: string, trainingLevelId?: string) {
    const where: any = { isCommon: false };
    if (program) where.program = program;
    if (trainingLevelId) where.trainingLevelId = trainingLevelId;
    return this.majors.findAll({
      where,
      include: [
        { model: TrainingLevel, as: "trainingLevel", attributes: ["id", "code", "name"] },
        { model: Discipline, as: "discipline", attributes: ["id", "code", "name"] },
      ],
      order: [["name", "ASC"]],
    });
  }
  async createMajor(dto: CreateCatalogDto) {
    if (!dto.disciplineId) throw new BadRequestException("Vui lòng chọn ngành của chuyên ngành.");
    await this.requireParent(this.disciplines, dto.disciplineId, "Ngành");
    const program = dto.program || "masters";
    const code = this.majorCode(dto.code);
    await this.ensureMajorCodeUnique(code, program);
    const trainingLevelId = await this.resolveMajorTrainingLevel(program, dto.trainingLevelId);
    if (trainingLevelId) await this.requireParent(this.trainingLevels, trainingLevelId, "Trình độ đào tạo");
    return this.majors.create({
      ...this.pick(dto, [
        "name", "englishName", "program", "isAdmissionScreening", "durationYears", "maxOvertimeYears", "active"
      ]),
      disciplineId: dto.disciplineId,
      code,
      program,
      trainingLevelId,
    } as any);
  }
  private majorCode(value: unknown) {
    const code = String(value || "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{1,30}$/.test(code)) throw new BadRequestException("Vui lòng nhập mã chuyên ngành gồm chữ không dấu, số, gạch ngang hoặc gạch dưới (tối đa 30 ký tự).");
    return code;
  }
  private async ensureMajorCodeUnique(code: string, program: string, excludeId?: string, transaction?: Transaction) {
    const where: any = { code, program };
    if (excludeId) where.id = { [Op.ne]: excludeId };
    if (await this.majors.findOne({ where, transaction })) throw new ConflictException(`Mã chuyên ngành "${code}" đã tồn tại trong bậc đào tạo này.`);
  }
  async updateMajor(id: string, dto: UpdateCatalogDto, transaction?: Transaction) {
    if (!transaction && this.sequelize) return this.sequelize.transaction((tx) => this.updateMajor(id, dto, tx));
    const row = await this.majors.findByPk(id, { transaction, ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!row) throw new NotFoundException("Chuyên ngành không tồn tại.");
    const disciplineId = dto.disciplineId || row.disciplineId;
    if (dto.disciplineId && dto.disciplineId !== row.disciplineId) {
      await this.requireParent(this.disciplines, dto.disciplineId, "Ngành");
    }
    const program = dto.program || row.program || "masters";
    const code = dto.code === undefined ? row.code : this.majorCode(dto.code);
    if (code && (code !== row.code || program !== row.program)) {
      await this.ensureMajorCodeUnique(code, program, id, transaction);
      const groups = await this.classGroups.findAll({ where: { majorId: id }, transaction, ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}) });
      for (const group of groups) {
        if (!group.groupNumber || !group.academicYear) continue;
        const groupCode = classGroupCode(code, group.academicYear, group.intakeRound, group.groupNumber);
        const collision = await this.classGroups.findOne({ where: { code: groupCode, program: group.program, id: { [Op.ne]: group.id } }, transaction });
        if (collision) throw new ConflictException(`Mã nhóm "${groupCode}" đã tồn tại.`);
        await group.update({ code: groupCode, name: groupCode }, { transaction });
      }
    }
    const trainingLevelId = await this.resolveMajorTrainingLevel(program, dto.trainingLevelId);
    if (trainingLevelId) await this.requireParent(this.trainingLevels, trainingLevelId, "Trình độ đào tạo");
    await row.update({
      ...this.pick(dto, [
        "name", "englishName", "program", "isAdmissionScreening", "durationYears", "maxOvertimeYears", "active"
      ]),
      disciplineId,
      ...(code ? { code } : {}),
      program,
      trainingLevelId,
    } as any, { transaction });
    return row;
  }
  async removeMajor(id: string) { return this.removeSimple(this.majors, id, "Chuyên ngành"); }

  // ===== Trạng thái học =====
  async listStudyStatuses() { return this.listAll(this.studyStatuses); }
  async createStudyStatus(dto: CreateCatalogDto) { return this.createSimple(this.studyStatuses, dto, "Trạng thái học"); }
  async updateStudyStatus(id: string, dto: UpdateCatalogDto) { return this.updateSimple(this.studyStatuses, id, dto, "Trạng thái học"); }
  async removeStudyStatus(id: string) { return this.removeSimple(this.studyStatuses, id, "Trạng thái học"); }

  // ===== Học phần bổ sung kiến thức =====
  async listBridgeKnowledge() {
    const rows = await this.bridgeKnowledgeSubjects.findAll({
      include: [{ model: Subject, as: "equivalentSubject", attributes: ["id", "codeNumber", "codeText", "name", "credits", "majorId", "program"] }],
      order: [["sortOrder", "ASC"], ["code", "ASC"]],
    });
    return rows;
  }
  async createBridgeKnowledge(dto: CreateCatalogDto) {
    if (!dto.code) throw new BadRequestException("Vui lòng nhập mã học phần.");
    await this.ensureCodeUnique(this.bridgeKnowledgeSubjects, dto.code);
    const equivalentSubjectId = await this.requireEquivalentSubject(dto.equivalentSubjectId);
    return this.bridgeKnowledgeSubjects.create(this.pick(dto, ["code", "name", "credits", "sortOrder", "active"]) as any)
      .then(async (created) => {
        await created.update({ equivalentSubjectId } as any);
        return created;
      });
  }
  async updateBridgeKnowledge(id: string, dto: UpdateCatalogDto) {
    const row = await this.findOr404(this.bridgeKnowledgeSubjects, id, "Học phần bổ sung kiến thức");
    if (dto.code && dto.code !== row.code) await this.ensureCodeUnique(this.bridgeKnowledgeSubjects, dto.code, id);
    await row.update(this.pick(dto, ["code", "name", "credits", "sortOrder", "active"]) as any);
    if (dto.equivalentSubjectId !== undefined) {
      const equivalentSubjectId = await this.requireEquivalentSubject(dto.equivalentSubjectId);
      await row.update({ equivalentSubjectId } as any);
    }
    return row;
  }
  async removeBridgeKnowledge(id: string) { return this.removeSimple(this.bridgeKnowledgeSubjects, id, "Học phần bổ sung kiến thức"); }

  /**
   * Học bổ sung kiến thức không mặc nhiên là học phần CTĐT: chỉ được công nhận khi có
   * khai báo tương đương trỏ tới một học phần Thạc sĩ đang hoạt động.
   */
  private async requireEquivalentSubject(subjectId?: string | null) {
    if (!subjectId) return null;
    const subject = await this.subjects.findByPk(subjectId);
    if (!subject || subject.active === false) {
      throw new BadRequestException("Học phần CTĐT được khai báo tương đương không tồn tại hoặc đã ngừng sử dụng.");
    }
    if (subject.program !== "masters") {
      throw new BadRequestException("Chỉ khai báo tương đương với học phần bậc Thạc sĩ.");
    }
    return subject.id;
  }

  // ===== Đơn vị công tác =====
  async listUnits() { return this.listAll(this.units); }

  async createUnit(dto: CreateCatalogDto) {
    if (!dto.code) throw new BadRequestException("Vui lòng nhập mã đơn vị.");
    if (!dto.name?.trim()) throw new BadRequestException("Vui lòng nhập tên đơn vị.");
    await this.ensureCodeUnique(this.units, dto.code);
    return this.units.create(this.pick(dto, ["code", "name", "englishName", "description", "sortOrder", "active"]) as any);
  }

  async updateUnit(id: string, dto: UpdateCatalogDto) {
    const row = await this.findOr404(this.units, id, "Đơn vị");
    if (dto.code !== undefined && !dto.code?.trim()) throw new BadRequestException("Vui lòng nhập mã đơn vị.");
    if (dto.name !== undefined && !dto.name?.trim()) throw new BadRequestException("Vui lòng nhập tên đơn vị.");
    if (dto.code && dto.code !== row.code) await this.ensureCodeUnique(this.units, dto.code, id);
    await row.update(this.pick(dto, ["code", "name", "englishName", "description", "sortOrder", "active"]) as any);
    return row;
  }

  async removeUnit(id: string) {
    const row = await this.findOr404(this.units, id, "Đơn vị");
    const count = await this.lecturers.count({ where: { unitId: id } });
    if (count) throw new ConflictException(`Đơn vị "${row.name}" đang có ${count} giảng viên. Chuyển giảng viên sang đơn vị khác trước khi xóa.`);
    await row.destroy();
    return { message: "Xóa đơn vị thành công" };
  }

  private async validateLecturerUnit(unitId?: string | null) {
    if (!unitId) return;
    const unit = await this.units.findByPk(unitId);
    if (!unit || !unit.active) throw new BadRequestException("Đơn vị không tồn tại hoặc đã ngừng sử dụng.");
  }

  // ===== Giảng viên =====
  async listLecturers() {
    return this.lecturers.findAll({
      include: [
        { model: Staff, as: "staff", attributes: ["id", "name", "email"] },
        { model: Unit, as: "unit", attributes: ["id", "code", "name", "active"] },
        { model: Discipline, as: "discipline", attributes: ["id", "code", "name"] },
        { model: Major, as: "major", attributes: ["id", "name", "disciplineId", "program"] },
      ],
      order: [["name", "ASC"]],
    });
  }
  async createLecturer(dto: CreateCatalogDto) {
    if (!dto.code) throw new BadRequestException("Vui lòng nhập mã giảng viên.");
    if (!dto.name) throw new BadRequestException("Vui lòng nhập tên giảng viên.");
    await this.ensureCodeUnique(this.lecturers, dto.code);
    if (dto.email) await this.ensureEmailUnique(dto.email);
    if (dto.staffId !== undefined && dto.staffId !== null) await this.requireParent(this.staff, dto.staffId, "Tài khoản nhân sự");
    await this.validateLecturerScope(dto.disciplineId, dto.majorId);
    await this.validateLecturerUnit(dto.unitId);
    return this.lecturers.create(this.pick(dto, [
      "staffId", "code", "name", "phone", "email", "academicRank", "academicDegree", "teachingType", "title", "faculty", "department", "unitId", "disciplineId", "majorId", "active"
    ]) as any);
  }
  async updateLecturer(id: string, dto: UpdateCatalogDto) {
    const row = await this.findOr404(this.lecturers, id, "Giảng viên");
    if (dto.unitId !== undefined && dto.unitId !== row.unitId) await this.validateLecturerUnit(dto.unitId);
    if (dto.code && dto.code !== row.code) await this.ensureCodeUnique(this.lecturers, dto.code, id);
    if (dto.email && dto.email !== row.email) await this.ensureEmailUnique(dto.email, id);
    if (dto.staffId !== undefined && dto.staffId !== null) await this.requireParent(this.staff, dto.staffId, "Tài khoản nhân sự");
    if (dto.disciplineId !== undefined || dto.majorId !== undefined) {
      const disciplineId = dto.disciplineId === undefined ? row.disciplineId : dto.disciplineId;
      const majorId = dto.majorId === undefined ? row.majorId : dto.majorId;
      if (disciplineId !== row.disciplineId || majorId !== row.majorId) {
        await this.validateLecturerScope(disciplineId, majorId);
      }
    }
    await row.update(this.pick(dto, [
      "staffId", "code", "name", "phone", "email", "academicRank", "academicDegree", "teachingType", "title", "faculty", "department", "unitId", "disciplineId", "majorId", "active"
    ]) as any);
    return row;
  }
  async removeLecturer(id: string) { return this.removeSimple(this.lecturers, id, "Giảng viên"); }

  private async validateLecturerScope(disciplineId?: string | null, majorId?: string | null) {
    // Giữ nguyên kiểm tra phân loại ngành/chuyên ngành cũ, độc lập với đơn vị công tác.
    if (!disciplineId && !majorId) return;
    if (!disciplineId) throw new BadRequestException("Vui lòng chọn đơn vị của giảng viên có chuyên ngành đã khai báo.");
    const discipline = await this.disciplines.findByPk(disciplineId);
    if (!discipline || discipline.active === false) {
      throw new BadRequestException("Đơn vị của giảng viên không tồn tại hoặc đã ngừng sử dụng.");
    }
    if (!majorId) return;
    const major = await this.majors.findByPk(majorId);
    if (!major || major.active === false) {
      throw new BadRequestException("Chuyên ngành của giảng viên không tồn tại hoặc đã ngừng sử dụng.");
    }
    if (major.disciplineId !== disciplineId) {
      throw new BadRequestException("Chuyên ngành đã khai báo không thuộc đơn vị đã chọn. Cần rà soát phân loại cũ trước khi đổi đơn vị.");
    }
  }

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
