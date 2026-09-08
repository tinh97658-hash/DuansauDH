import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/sequelize";
import { col, fn, Op } from "sequelize";
import type { Transaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { Major } from "../database/models/common/major.model.js";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { Subject } from "../database/models/plan/subject.model.js";
import { SubjectPackage } from "../database/models/plan/subject-package.model.js";
import { SubjectPackageSubject } from "../database/models/plan/subject-package-subject.model.js";
import { AdmissionRecord } from "../database/models/plan/admission-record.model.js";
import { CourseOffering } from "../database/models/training/course-offering.model.js";
import { ClassGroupService } from "./class-group.service.js";
import {
  CreateAdmissionRecordDto, CreateClassDto, CreateSubjectDto, CreateSubjectPackageDto,
  UpdateAdmissionRecordDto, UpdateClassDto, UpdateSubjectDto, UpdateSubjectPackageDto,
} from "./dto/plan.dto.js";

@Injectable()
export class PlanService {
  constructor(
    @InjectModel(Subject) private readonly subjects: typeof Subject,
    @InjectModel(SubjectPackage) private readonly packages: typeof SubjectPackage,
    @InjectModel(SubjectPackageSubject) private readonly packageEntries: typeof SubjectPackageSubject,
    @InjectModel(ClassGroup) private readonly classGroups: typeof ClassGroup,
    @InjectModel(Major) private readonly majors: typeof Major,
    @InjectModel(AdmissionRecord) private readonly admissionRecordsModel: typeof AdmissionRecord,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly classGroupsService: ClassGroupService,
    @InjectModel(CourseOffering) private readonly courseOfferings: typeof CourseOffering,
  ) {}

  // ===== Các chức năng khác (chưa triển khai) =====
  private stub(feature: string, label: string) {
    return { feature, label, status: "not_implemented", message: `Chức năng "${label}" chưa được triển khai.` };
  }
  admissionTargets() { return this.stub("admission-targets", "Chỉ tiêu xét tuyển"); }
  annualFees() { return this.stub("annual-fees", "Khoản thu đầu năm"); }

  // ===== Tiện ích =====
  private pick(dto: any, keys: string[]) {
    const output: Record<string, unknown> = {};
    for (const key of keys) {
      const value = dto[key];
      if (value !== undefined) output[key] = value;
    }
    return output;
  }

  private programForTrainingLevel(trainingLevel?: string | null) {
    const normalized = String(trainingLevel || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .toLowerCase()
      .trim();
    if (normalized === "doctoral" || normalized.includes("tien si")) return "doctoral";
    if (normalized === "masters" || normalized.includes("thac si")) return "masters";
    return undefined;
  }

  private async requireAdmissionMajor(majorId: string | null | undefined, trainingLevel?: string | null) {
    if (!majorId) throw new BadRequestException("Vui lòng chọn chuyên ngành đăng ký tuyển sinh");
    const major = await this.majors.findByPk(majorId);
    if (!major || major.active === false) {
      throw new BadRequestException("Chuyên ngành đã chọn không tồn tại hoặc đã ngừng sử dụng");
    }
    const expectedProgram = this.programForTrainingLevel(trainingLevel);
    if (expectedProgram && major.program && major.program !== expectedProgram) {
      throw new BadRequestException("Chuyên ngành không phù hợp với trình độ đào tạo đã chọn");
    }
    return major;
  }

  private async ensureUnique(model: any, field: string, value: string, excludeId?: string, extra: Record<string, unknown> = {}) {
    const where: Record<string, unknown> = { [field]: value, ...extra };
    if (excludeId) where.id = { [Op.ne]: excludeId };
    const existing = await model.findOne({ where });
    if (existing) throw new ConflictException(`Giá trị "${value}" đã tồn tại.`);
  }

  // ===== Tổng quan kế hoạch đào tạo =====
  private async requireMajorForProgram(majorId: string | null | undefined, program: string, transaction?: Transaction) {
    if (!majorId) throw new BadRequestException("Vui lòng chọn chuyên ngành.");
    const major = await this.majors.findByPk(majorId, { transaction });
    if (!major || major.active === false) throw new BadRequestException("Chuyên ngành không tồn tại hoặc đã ngừng sử dụng.");
    if (major.program !== program) throw new BadRequestException("Chuyên ngành không phù hợp với bậc đào tạo.");
    return major;
  }

  private async validatePackageSubjects(classGroup: ClassGroup, subjectIds: string[], transaction: Transaction, requireExactly21 = false) {
    if (!classGroup.majorId) throw new BadRequestException("Lớp học phải được gắn chuyên ngành trước khi tạo gói học phần.");
    if (subjectIds.length === 0 || subjectIds.length > 21) {
      throw new BadRequestException("Gói học phần phải có từ 1 đến 21 học phần.");
    }
    if (requireExactly21 && subjectIds.length !== 21) {
      throw new BadRequestException("Gói học phần chính thức phải có đúng 21 học phần.");
    }
    const subjects = await this.subjects.findAll({
      where: { id: { [Op.in]: subjectIds }, majorId: classGroup.majorId, program: classGroup.program, active: true },
      transaction,
    });
    if (subjects.length !== subjectIds.length) {
      throw new BadRequestException("Danh sách có học phần không tồn tại, đã ngừng sử dụng hoặc không thuộc chuyên ngành/bậc của lớp.");
    }
  }

  async trainingPlan(program?: string) {
    const majorWhere: Record<string, unknown> = {};
    if (program) majorWhere.program = program;
    const majors = await this.majors.findAll({
      where: majorWhere,
      attributes: ["id", "code", "name", "program"],
      order: [["name", "ASC"]],
    });
    const counts: Record<string, number> = {};
    const where: Record<string, unknown> = {};
    if (program) where.program = program;
    const rows = (await this.subjects.findAll({
      where,
      attributes: ["majorId", [fn("COUNT", col("id")), "count"]],
      group: ["majorId"],
      raw: true,
    })) as unknown as Array<{ majorId: string; count: string | number }>;

    for (const r of rows) counts[r.majorId] = Number(r.count) || 0;
    return majors.map((m) => ({ id: m.id, code: m.code, name: m.name, program: m.program, subjectCount: counts[m.id] || 0 }));
  }

  // ===== Học phần theo chuyên ngành & bậc đào tạo =====
  async listSubjects(majorId?: string, program?: string) {
    const where: Record<string, unknown> = {};
    if (majorId) where.majorId = majorId;
    if (program) where.program = program;
    return this.subjects.findAll({
      where,
      include: [{ model: Major, as: "major", attributes: ["id", "code", "name"] }],
      order: [["sortOrder", "ASC"], ["codeNumber", "ASC"], ["name", "ASC"]],
    });
  }

  async createSubject(dto: CreateSubjectDto) {
    const program = dto.program || "masters";
    if ((dto.teachingUnits != null) !== (dto.teachingUnitType != null)) throw new BadRequestException("Nhập đồng thời số giờ/tiết và đơn vị.");
    return this.sequelize.transaction(async (transaction) => {
      await this.requireMajorForProgram(dto.majorId, program, transaction);
      await this.ensureUnique(this.subjects, "codeNumber", String(dto.codeNumber), undefined, { majorId: dto.majorId, program });
      await this.ensureUnique(this.subjects, "codeText", dto.codeText, undefined, { majorId: dto.majorId, program });
      await this.validateSubjectIdentityTarget(
        undefined,
        dto.canonicalSubjectId || null,
        dto.allowCrossMajor ?? false,
        program,
        transaction,
      );
      const payload = this.pick(dto, [
        "codeNumber", "codeText", "name", "majorId", "program", "credits",
        "majorAssignment", "subjectType", "isRequired", "sortOrder", "active",
        "canonicalSubjectId", "allowCrossMajor", "teachingUnits", "teachingUnitType",
      ]);
      payload.program = program;
      payload.code = dto.codeText || String(dto.codeNumber || "");
      return this.subjects.create(payload as any, { transaction });
    });
  }

  async updateSubject(id: string, dto: UpdateSubjectDto) {
    return this.sequelize.transaction(async (transaction) => {
      const subject = await this.subjects.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!subject) throw new NotFoundException("Không tìm thấy học phần.");
      const units = dto.teachingUnits ?? subject.teachingUnits;
      const unitType = dto.teachingUnitType ?? subject.teachingUnitType;
      if ((units != null) !== (unitType != null)) throw new BadRequestException("Nhập đồng thời số giờ/tiết và đơn vị.");
      const majorId = dto.majorId || subject.majorId;
      const program = dto.program || subject.program;
      await this.requireMajorForProgram(majorId, program, transaction);
      await this.validateSubjectIdentityUpdate(subject, dto, program, transaction);
      await this.ensureUnique(this.subjects, "codeNumber", String(dto.codeNumber ?? subject.codeNumber), id, { majorId, program });
      await this.ensureUnique(this.subjects, "codeText", dto.codeText ?? subject.codeText, id, { majorId, program });
      const payload = this.pick(dto, [
        "codeNumber", "codeText", "name", "majorId", "program", "credits",
        "majorAssignment", "subjectType", "isRequired", "sortOrder", "active",
        "canonicalSubjectId", "allowCrossMajor", "teachingUnits", "teachingUnitType",
      ]);
      if (dto.codeText !== undefined) {
        payload.code = dto.codeText;
      } else if (dto.codeNumber !== undefined && !subject.codeText) {
        payload.code = String(dto.codeNumber);
      }
      await subject.update(payload, { transaction });
      return this.subjects.findByPk(id, {
        include: [
          { model: Major, as: "major", attributes: ["id", "code", "name"] },
          { model: Subject, as: "canonicalSubject" },
        ],
        transaction,
      });
    });
  }

  private async validateSubjectIdentityUpdate(
    subject: Subject,
    dto: UpdateSubjectDto,
    nextProgram: string,
    transaction: Transaction,
  ) {
    const changesCanonical = Object.prototype.hasOwnProperty.call(dto, "canonicalSubjectId");
    const currentCanonicalId = subject.canonicalSubjectId || null;
    const nextCanonicalId = changesCanonical ? (dto.canonicalSubjectId || null) : currentCanonicalId;
    const nextAllowCrossMajor = dto.allowCrossMajor ?? subject.allowCrossMajor ?? false;
    const canonicalChanged = currentCanonicalId !== nextCanonicalId;
    const programChanged = nextProgram !== subject.program;
    const deactivating = dto.active === false && subject.active !== false;

    await this.validateSubjectIdentityTarget(
      subject.id,
      nextCanonicalId,
      nextAllowCrossMajor,
      nextProgram,
      transaction,
    );

    const dependentCount = await this.subjects.count({
      where: { canonicalSubjectId: subject.id },
      transaction,
    });
    if (dependentCount > 0 && nextCanonicalId) {
      throw new ConflictException("Học phần đang là gốc của mapping khác nên không thể trở thành alias.");
    }
    if (dependentCount > 0 && programChanged) {
      throw new ConflictException("Không thể đổi bậc đào tạo của học phần gốc đang có alias.");
    }
    if (dependentCount > 0 && deactivating) {
      throw new ConflictException("Không thể ngừng sử dụng học phần gốc đang có alias.");
    }

    if (canonicalChanged) {
      const offeringCount = await this.courseOfferings.count({ where: { subjectId: subject.id }, transaction });
      if (offeringCount > 0) {
        throw new ConflictException("Không thể đổi logical identity của học phần đang được lớp học phần tham chiếu.");
      }
    }
  }

  private async validateSubjectIdentityTarget(
    subjectId: string | undefined,
    canonicalSubjectId: string | null,
    allowCrossMajor: boolean,
    program: string,
    transaction: Transaction,
  ) {
    if (subjectId && canonicalSubjectId === subjectId) {
      throw new BadRequestException("Học phần không được tham chiếu chính nó làm học phần gốc.");
    }
    if (canonicalSubjectId && allowCrossMajor) {
      throw new BadRequestException("Học phần alias không thể đồng thời là học phần gốc dùng chung liên ngành.");
    }

    if (canonicalSubjectId) {
      const root = await this.subjects.findByPk(canonicalSubjectId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!root) throw new BadRequestException("Không tìm thấy học phần gốc được chọn.");
      if (root.canonicalSubjectId) throw new BadRequestException("Học phần alias phải trỏ trực tiếp tới một học phần gốc, không được tạo chuỗi mapping.");
      if (root.program !== program) throw new BadRequestException("Học phần alias và học phần gốc phải cùng bậc đào tạo.");
      if (root.active === false) throw new BadRequestException("Học phần gốc đã ngừng sử dụng.");
    }
  }

  async removeSubject(id: string) {
    const subject = await this.subjects.findByPk(id);
    if (!subject) throw new NotFoundException("Không tìm thấy học phần.");
    const packageUsage = await this.packageEntries.count({ where: { subjectId: id } });
    if (packageUsage > 0) throw new ConflictException("Không thể xóa học phần đang được sử dụng trong gói học phần.");
    const aliasUsage = await this.subjects.count({ where: { canonicalSubjectId: id } });
    if (aliasUsage > 0) throw new ConflictException("Không thể xóa học phần đang là gốc của mapping liên ngành.");
    const offeringUsage = await this.courseOfferings.count({ where: { subjectId: id } });
    if (offeringUsage > 0) throw new ConflictException("Không thể xóa học phần đang được lớp học phần tham chiếu.");
    await subject.destroy();
    return { success: true, message: "Đã xóa học phần." };
  }

  // ===== Lớp học (ClassGroup) =====
  async listClasses(majorId?: string, program?: string, academicYear?: string) {
    const where: Record<string, unknown> = {};
    if (majorId) where.majorId = majorId;
    if (program) where.program = program;
    if (academicYear) where.academicYear = academicYear;
    return this.classGroups.findAll({
      where,
      include: [
        { model: Major, as: "major", attributes: ["id", "code", "name"] },
        {
          model: SubjectPackage,
          as: "packages",
          attributes: ["id", "code", "name", "isOfficial", "active", "totalSubjects", "canMerge"],
        },
      ],
      order: [["academicYear", "DESC"], ["code", "ASC"]],
    });
  }

  async createClass(dto: CreateClassDto) {
    const created = await this.classGroupsService.create(dto as any);
    return this.classGroups.findByPk(created.id, {
      include: [
        { model: Major, as: "major", attributes: ["id", "code", "name"] },
        { model: SubjectPackage, as: "packages", attributes: ["id", "code", "name", "isOfficial", "active", "totalSubjects", "canMerge"] },
      ],
    });
  }

  async updateClass(id: string, dto: UpdateClassDto) {
    await this.classGroupsService.update(id, dto as any);
    return this.classGroups.findByPk(id, {
      include: [
        { model: Major, as: "major", attributes: ["id", "code", "name"] },
        { model: SubjectPackage, as: "packages", attributes: ["id", "code", "name", "isOfficial", "active", "totalSubjects", "canMerge"] },
      ],
    });
  }

  async removeClass(id: string) {
    return this.classGroupsService.remove(id);
  }

  // ===== Gói học phần theo lớp =====
  async listPackages(classGroupId?: string) {
    const where: Record<string, unknown> = {};
    if (classGroupId) where.classGroupId = classGroupId;
    return this.packages.findAll({
      where,
      include: [
        {
          model: SubjectPackageSubject,
          as: "entries",
          include: [{ model: Subject, as: "subject" }],
        },
      ],
      order: [["isOfficial", "DESC"], ["code", "ASC"]],
    });
  }

  async createPackage(dto: CreateSubjectPackageDto) {
    return this.sequelize.transaction(async (transaction) => {
    const classGroup = await this.classGroups.findByPk(dto.classGroupId, { transaction });
    if (!classGroup) throw new NotFoundException("Không tìm thấy lớp học.");
    await this.ensureUnique(this.packages, "code", dto.code, undefined, { classGroupId: dto.classGroupId });
    await this.validatePackageSubjects(classGroup, dto.subjectIds, transaction, dto.isOfficial === true);

    // Nếu truyền isOfficial = true, gỡ official của các gói khác cùng lớp
    if (dto.isOfficial) {
      await this.packages.update({ isOfficial: false }, { where: { classGroupId: dto.classGroupId }, transaction });
    }

    const pkg = await this.packages.create({
      code: dto.code,
      name: dto.name,
      classGroupId: dto.classGroupId,
      active: dto.active ?? true,
      isOfficial: dto.isOfficial ?? false,
      canMerge: dto.canMerge ?? false,
      totalSubjects: dto.subjectIds.length,
    }, { transaction });

    if (dto.subjectIds && dto.subjectIds.length > 0) {
      const entries = dto.subjectIds.map((subjectId, idx) => ({
        packageId: pkg.id,
        subjectId,
        sortOrder: idx + 1,
      }));
      await this.packageEntries.bulkCreate(entries, { transaction });
    }

    return this.packages.findByPk(pkg.id, {
      include: [
        {
          model: SubjectPackageSubject,
          as: "entries",
          include: [{ model: Subject, as: "subject" }],
        },
      ], transaction,
    });
    });
  }

  async updatePackage(id: string, dto: UpdateSubjectPackageDto) {
    return this.sequelize.transaction(async (transaction) => {
    const pkg = await this.packages.findByPk(id, { transaction });
    if (!pkg) throw new NotFoundException("Không tìm thấy gói học phần.");
    if (dto.code !== undefined && dto.code !== pkg.code) {
      await this.ensureUnique(this.packages, "code", dto.code, id, { classGroupId: pkg.classGroupId });
    }
    const classGroup = await this.classGroups.findByPk(pkg.classGroupId, { transaction });
    if (!classGroup) throw new NotFoundException("Không tìm thấy lớp học.");
    if (dto.subjectIds !== undefined) {
      await this.validatePackageSubjects(classGroup, dto.subjectIds, transaction, dto.isOfficial === true || (pkg.isOfficial && dto.isOfficial !== false));
    } else if (dto.isOfficial === true) {
      const count = await this.packageEntries.count({ where: { packageId: id }, transaction });
      if (count !== 21) throw new BadRequestException("Gói học phần chính thức phải có đúng 21 học phần.");
    }

    // Nếu cập nhật isOfficial = true, gỡ official của các gói khác cùng lớp
    if (dto.isOfficial === true) {
      await this.packages.update({ isOfficial: false }, { where: { classGroupId: pkg.classGroupId }, transaction });
    }

    const payload = this.pick(dto, ["code", "name", "active", "isOfficial", "canMerge"]);
    if (dto.subjectIds !== undefined) payload.totalSubjects = dto.subjectIds.length;
    await pkg.update(payload, { transaction });

    if (dto.subjectIds !== undefined) {
      await this.packageEntries.destroy({ where: { packageId: id }, transaction });
      if (dto.subjectIds.length > 0) {
        const entries = dto.subjectIds.map((subjectId, idx) => ({
          packageId: id,
          subjectId,
          sortOrder: idx + 1,
        }));
        await this.packageEntries.bulkCreate(entries, { transaction });
      }
    }

    return this.packages.findByPk(id, {
      include: [
        {
          model: SubjectPackageSubject,
          as: "entries",
          include: [{ model: Subject, as: "subject" }],
        },
      ], transaction,
    });
    });
  }

  async setOfficialPackage(id: string) {
    return this.sequelize.transaction(async (transaction) => {
    const pkg = await this.packages.findByPk(id, { transaction });
    if (!pkg) throw new NotFoundException("Không tìm thấy gói học phần.");

    // Gỡ bỏ trạng thái chính thức của tất cả các gói thuộc lớp này
    if (pkg.active === false) throw new BadRequestException("Không thể chọn gói học phần đã ngừng sử dụng.");
    const count = await this.packageEntries.count({ where: { packageId: id }, transaction });
    if (count !== 21) throw new BadRequestException("Gói học phần chính thức phải có đúng 21 học phần.");
    await this.packages.update({ isOfficial: false }, { where: { classGroupId: pkg.classGroupId }, transaction });

    // Đặt gói được chọn thành chính thức
    await pkg.update({ isOfficial: true, totalSubjects: count }, { transaction });

    return this.packages.findByPk(id, {
      include: [
        {
          model: SubjectPackageSubject,
          as: "entries",
          include: [{ model: Subject, as: "subject" }],
        },
      ], transaction,
    });
    });
  }

  async removePackage(id: string) {
    const pkg = await this.packages.findByPk(id);
    if (!pkg) throw new NotFoundException("Không tìm thấy gói học phần.");
    if (pkg.isOfficial) throw new ConflictException("Không thể xóa gói học phần chính thức. Hãy chọn gói chính thức khác trước.");
    await pkg.destroy();
    return { success: true, message: "Đã xóa gói học phần." };
  }

  // ===== Validation Helper: Gói học phần chính thức =====
  async createDefaultPackages(classGroupId: string) {
    return this.sequelize.transaction(async (transaction) => {
      const classGroup = await this.classGroups.findByPk(classGroupId, { transaction });
      if (!classGroup) throw new NotFoundException("Không tìm thấy lớp học.");
      if (!classGroup.majorId) throw new BadRequestException("Lớp học chưa được gắn chuyên ngành.");
      const existingCount = await this.packages.count({ where: { classGroupId }, transaction });
      if (existingCount > 0) throw new ConflictException("Lớp học đã có gói học phần.");
      const subjects = await this.subjects.findAll({
        where: { majorId: classGroup.majorId, program: classGroup.program, active: true },
        order: [["sortOrder", "ASC"], ["codeNumber", "ASC"]],
        limit: 21,
        transaction,
      });
      if (subjects.length !== 21) throw new BadRequestException("Cần đủ 21 học phần đang hoạt động để tạo gói chuẩn.");
      const subjectIds = subjects.map((subject) => subject.id);
      const definitions = [
        { code: `G1-${classGroup.code}`, name: "Gói học phần 1", isOfficial: true },
        { code: `G2-${classGroup.code}`, name: "Gói học phần 2", isOfficial: false },
      ];
      for (const definition of definitions) {
        const pkg = await this.packages.create({ ...definition, classGroupId, active: true, totalSubjects: 21 }, { transaction });
        await this.packageEntries.bulkCreate(subjectIds.map((subjectId, index) => ({
          packageId: pkg.id,
          subjectId,
          sortOrder: index + 1,
        })), { transaction });
      }
      return this.packages.findAll({
        where: { classGroupId },
        include: [{ model: SubjectPackageSubject, as: "entries", include: [{ model: Subject, as: "subject" }] }],
        order: [["isOfficial", "DESC"], ["code", "ASC"]],
        transaction,
      });
    });
  }

  async getOfficialPackageForClass(classGroupId: string) {
    return this.packages.findOne({
      where: { classGroupId, isOfficial: true },
      include: [
        {
          model: SubjectPackageSubject,
          as: "entries",
          include: [{ model: Subject, as: "subject" }],
        },
      ],
    });
  }

  async validateClassHasOfficialPackage(classGroupId: string) {
    const officialPkg = await this.getOfficialPackageForClass(classGroupId);
    if (!officialPkg) {
      throw new BadRequestException("Lớp học chưa có gói học phần chính thức. Không thể xếp lịch học hoặc nhập điểm.");
    }
    return officialPkg;
  }

  // ===== HỒ SƠ TUYỂN SINH (ADMISSION RECORDS) =====
  async listAdmissionRecords(majorId?: string, trainingLevel?: string, academicYear?: string, status?: string) {
    const where: Record<string, unknown> = {};
    if (majorId) where.majorId = majorId;
    if (trainingLevel) where.trainingLevel = trainingLevel;
    if (academicYear) where.academicYear = academicYear;
    if (status && status !== "ALL") where.status = status;

    return this.admissionRecordsModel.findAll({
      where,
      include: [{ model: Major, as: "major", attributes: ["id", "code", "name"] }],
      order: [["createdAt", "DESC"]],
    });
  }

  async getAdmissionRecord(id: string) {
    const record = await this.admissionRecordsModel.findByPk(id, {
      include: [{ model: Major, as: "major", attributes: ["id", "code", "name"] }],
    });
    if (!record) throw new NotFoundException("Không tìm thấy hồ sơ tuyển sinh");
    return record;
  }

  async createAdmissionRecord(dto: CreateAdmissionRecordDto) {
    let fullName = dto.fullName?.trim();
    if (!fullName) {
      fullName = `${dto.lastName || ""} ${dto.firstName || ""}`.trim();
    }
    if (!fullName) {
      throw new BadRequestException("Họ và tên không được để trống");
    }

    const major = await this.requireAdmissionMajor(dto.majorId, dto.trainingLevel);
    const payload = {
      ...dto,
      fullName,
      email: dto.email || `candidate_${Date.now()}@vmu.edu.vn`,
      majorName: major.name,
    };

    const created = await this.admissionRecordsModel.create(payload as any);
    return this.admissionRecordsModel.findByPk(created.id, {
      include: [{ model: Major, as: "major", attributes: ["id", "code", "name"] }],
    });
  }

  async updateAdmissionRecord(id: string, dto: UpdateAdmissionRecordDto) {
    const record = await this.admissionRecordsModel.findByPk(id);
    if (!record) throw new NotFoundException("Không tìm thấy hồ sơ tuyển sinh");

    let fullName = dto.fullName?.trim();
    if (!fullName && (dto.lastName !== undefined || dto.firstName !== undefined)) {
      fullName = `${dto.lastName ?? record.lastName ?? ""} ${dto.firstName ?? record.firstName ?? ""}`.trim();
    }
    const payload: Record<string, unknown> = { ...dto };
    delete payload.majorName;
    if (dto.majorId !== undefined || dto.trainingLevel !== undefined) {
      const major = await this.requireAdmissionMajor(dto.majorId ?? record.majorId, dto.trainingLevel ?? record.trainingLevel);
      payload.majorId = major.id;
      payload.majorName = major.name;
    }
    if (fullName) payload.fullName = fullName;

    await record.update(payload as any);
    return this.admissionRecordsModel.findByPk(id, {
      include: [{ model: Major, as: "major", attributes: ["id", "code", "name"] }],
    });
  }

  async removeAdmissionRecord(id: string) {
    const record = await this.admissionRecordsModel.findByPk(id);
    if (!record) throw new NotFoundException("Không tìm thấy hồ sơ tuyển sinh");
    await record.destroy();
    return { success: true, message: "Đã xóa hồ sơ tuyển sinh." };
  }
}
