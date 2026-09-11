import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/sequelize";
import { col, fn, Op } from "sequelize";
import type { Transaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { Major } from "../database/models/common/major.model.js";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { Subject } from "../database/models/plan/subject.model.js";
import { Curriculum } from "../database/models/plan/curriculum.model.js";
import { CurriculumSubject } from "../database/models/plan/curriculum-subject.model.js";
import { AdmissionRecord } from "../database/models/plan/admission-record.model.js";
import { CourseOffering } from "../database/models/training/course-offering.model.js";
import { ClassGroupService } from "./class-group.service.js";
import {
  CreateAdmissionRecordDto, CreateClassDto, CreateSubjectDto,
  UpdateAdmissionRecordDto, UpdateClassDto, UpdateSubjectDto,
} from "./dto/plan.dto.js";

@Injectable()
export class PlanService {
  constructor(
    @InjectModel(Subject) private readonly subjects: typeof Subject,
    @InjectModel(CurriculumSubject) private readonly curriculumEntries: typeof CurriculumSubject,
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

  async ensureCommonMajor(program: string, transaction?: Transaction) {
    const code = "CHUNG";
    const name = "Học phần chung (Cấp Viện)";
    let major = await this.majors.findOne({
      where: { code, program },
      transaction,
    });
    if (!major) {
      major = await this.majors.create({
        code,
        name,
        program,
        active: true,
        durationYears: 2,
        maxOvertimeYears: 2,
        description: "Danh mục học phần dùng chung toàn trường do Viện quản lý",
      } as any, { transaction });
    }
    return major;
  }

  async trainingPlan(program?: string) {
    if (program) {
      await this.ensureCommonMajor(program);
    } else {
      await this.ensureCommonMajor("masters");
      await this.ensureCommonMajor("doctoral");
    }
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
    return majors
      .map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        program: m.program,
        isCommon: m.code === "CHUNG",
        subjectCount: counts[m.id] || 0,
      }))
      .sort((a, b) => {
        if (a.isCommon && !b.isCommon) return -1;
        if (!a.isCommon && b.isCommon) return 1;
        return a.name.localeCompare(b.name, "vi");
      });
  }

  // ===== Học phần theo chuyên ngành & bậc đào tạo =====
  async listSubjects(majorId?: string, program?: string, includeCommon = false) {
    const where: any = {};
    if (majorId) {
      if (includeCommon) {
        where[Op.or] = [
          { majorId },
          { subjectType: "KC" },
        ];
      } else {
        where.majorId = majorId;
      }
    }
    if (program) where.program = program;
    return this.subjects.findAll({
      where,
      include: [{ model: Major, as: "major", attributes: ["id", "code", "name"] }],
      order: [["sortOrder", "ASC"], ["codeNumber", "ASC"], ["name", "ASC"]],
    });
  }

  async createSubject(dto: CreateSubjectDto) {
    const program = dto.program || "masters";
    if (dto.subjectType === "KC") {
      dto.allowCrossMajor = true;
    }
    return this.sequelize.transaction(async (transaction) => {
      await this.requireMajorForProgram(dto.majorId, program, transaction);
      await this.ensureUnique(this.subjects, "codeNumber", String(dto.codeNumber), undefined, { majorId: dto.majorId, program });
      await this.ensureUnique(this.subjects, "codeText", dto.codeText, undefined, { majorId: dto.majorId, program });
      await this.validateSubjectIdentityTarget(
        undefined,
        dto.canonicalSubjectId || null,
        dto.allowCrossMajor ?? false,
        dto.majorId,
        program,
        transaction,
      );
      const payload = this.pick(dto, [
        "codeNumber", "codeText", "name", "majorId", "program", "credits",
        "majorAssignment", "subjectType", "isRequired", "sortOrder", "active",
        "canonicalSubjectId", "allowCrossMajor",
      ]);
      payload.program = program;
      payload.code = dto.codeText || String(dto.codeNumber || "");
      return this.subjects.create(payload as any, { transaction });
    });
  }

  async updateSubject(id: string, dto: UpdateSubjectDto) {
    if (dto.subjectType === "KC") {
      dto.allowCrossMajor = true;
    }
    return this.sequelize.transaction(async (transaction) => {
      const subject = await this.subjects.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!subject) throw new NotFoundException("Không tìm thấy học phần.");
      const majorId = dto.majorId || subject.majorId;
      const program = dto.program || subject.program;
      await this.requireMajorForProgram(majorId, program, transaction);
      await this.validateSubjectIdentityUpdate(subject, dto, program, transaction);
      await this.ensureUnique(this.subjects, "codeNumber", String(dto.codeNumber ?? subject.codeNumber), id, { majorId, program });
      await this.ensureUnique(this.subjects, "codeText", dto.codeText ?? subject.codeText, id, { majorId, program });
      const payload = this.pick(dto, [
        "codeNumber", "codeText", "name", "majorId", "program", "credits",
        "majorAssignment", "subjectType", "isRequired", "sortOrder", "active",
        "canonicalSubjectId", "allowCrossMajor",
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
    const nextCanonicalId = Object.prototype.hasOwnProperty.call(dto, "canonicalSubjectId")
      ? (dto.canonicalSubjectId || null)
      : (subject.canonicalSubjectId || null);
    const nextAllowCrossMajor = dto.allowCrossMajor ?? subject.allowCrossMajor ?? false;

    await this.validateSubjectIdentityTarget(
      subject.id,
      nextCanonicalId,
      nextAllowCrossMajor,
      dto.majorId || subject.majorId,
      nextProgram,
      transaction,
    );

    const dependentCount = await this.subjects.count({
      where: { canonicalSubjectId: subject.id },
      transaction,
    });
    if (dependentCount > 0 && nextCanonicalId) {
      throw new ConflictException("Học phần đang là môn gốc nên không thể chuyển thành môn tương ứng của một môn khác.");
    }
    if (dependentCount > 0 && nextProgram !== subject.program) {
      throw new ConflictException("Không thể đổi bậc đào tạo của môn gốc đang có môn tương ứng ở ngành khác.");
    }
    if (dependentCount > 0 && dto.majorId !== undefined && dto.majorId !== subject.majorId) {
      throw new ConflictException("Không thể đổi chuyên ngành của môn gốc đang có môn tương ứng ở ngành khác.");
    }
    if (dependentCount > 0 && dto.active === false && subject.active !== false) {
      throw new ConflictException("Không thể ngừng sử dụng môn gốc đang có môn tương ứng ở ngành khác.");
    }
    if (dependentCount > 0 && nextAllowCrossMajor !== true) {
      throw new ConflictException("Không thể tắt học chung khác ngành khi môn gốc vẫn còn môn tương ứng.");
    }

  }

  private async validateSubjectIdentityTarget(
    subjectId: string | undefined,
    canonicalSubjectId: string | null,
    allowCrossMajor: boolean,
    majorId: string,
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
      if (root.majorId === majorId) throw new BadRequestException("Môn tương ứng phải thuộc một chuyên ngành khác.");
      if (root.active === false) throw new BadRequestException("Học phần gốc đã ngừng sử dụng.");
      if (root.allowCrossMajor !== true) throw new BadRequestException("Học phần gốc chưa được cho phép dùng chung liên ngành.");
    }
  }

  async removeSubject(id: string) {
    const subject = await this.subjects.findByPk(id);
    if (!subject) throw new NotFoundException("Không tìm thấy học phần.");
    const curriculumUsage = await this.curriculumEntries.count({ where: { subjectId: id } });
    if (curriculumUsage > 0) throw new ConflictException("Không thể xóa học phần đang nằm trong chương trình đào tạo.");
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
          model: Curriculum,
          as: "curriculum",
          attributes: ["id", "code", "name", "totalCredits", "applicableFromYear", "active"],
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
        { model: Curriculum, as: "curriculum", attributes: ["id", "code", "name", "totalCredits", "applicableFromYear", "active"] },
      ],
    });
  }

  async updateClass(id: string, dto: UpdateClassDto) {
    await this.classGroupsService.update(id, dto as any);
    return this.classGroups.findByPk(id, {
      include: [
        { model: Major, as: "major", attributes: ["id", "code", "name"] },
        { model: Curriculum, as: "curriculum", attributes: ["id", "code", "name", "totalCredits", "applicableFromYear", "active"] },
      ],
    });
  }

  async removeClass(id: string) {
    return this.classGroupsService.remove(id);
  }

  // Ghi chú nghiệp vụ: danh mục học phần của lớp được suy ra từ chương trình đào tạo
  // (CurriculumService) theo ngành + bậc + khóa. Không còn "gói học phần" theo lớp.

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
