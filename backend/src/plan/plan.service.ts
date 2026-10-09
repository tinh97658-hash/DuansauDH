import { Optional } from "@nestjs/common";
import { admissionLearnerWhere } from "./admission-learner-policy.js";
import { AdmissionEvaluationService } from "./admission-evaluation.service.js";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/sequelize";
import { col, fn, Op } from "sequelize";
import type { Transaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { Major } from "../database/models/common/major.model.js";
import { Discipline } from "../database/models/common/discipline.model.js";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { ClassGroupMember } from "../database/models/training/class-group-member.model.js";
import { Subject } from "../database/models/plan/subject.model.js";
import { Curriculum } from "../database/models/plan/curriculum.model.js";
import { CurriculumSubject } from "../database/models/plan/curriculum-subject.model.js";
import { AdmissionRecord } from "../database/models/plan/admission-record.model.js";
import { CourseOffering } from "../database/models/training/course-offering.model.js";
import { ClassGroupService } from "./class-group.service.js";
import { SubjectRecognitionService } from "./subject-recognition.service.js";
import {
  CreateAdmissionRecordDto, CreateClassDto, CreateSubjectDto,
  CreateSharedSubjectsDto, CreateSubjectFromExistingDto,
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
    private readonly recognitions: SubjectRecognitionService,
    @InjectModel(ClassGroupMember) private readonly classGroupMembers: typeof ClassGroupMember,
    @Optional() private readonly admissionEvaluation?: AdmissionEvaluationService,
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
    if (!major || major.active === false || major.isCommon) {
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
    if (!major || major.active === false || major.isCommon) {
      throw new BadRequestException("Chuyên ngành không tồn tại hoặc đã ngừng sử dụng.");
    }
    if (major.program !== program) throw new BadRequestException("Chuyên ngành không phù hợp với bậc đào tạo.");
    return major;
  }

  async trainingPlan(program?: string) {
    const majorWhere: Record<string, unknown> = { isCommon: false, active: true };
    if (program) majorWhere.program = program;
    const majors = await this.majors.findAll({
      where: majorWhere,
      attributes: ["id", "name", "program", "disciplineId", "active"],
      include: [{ model: Discipline, attributes: ["id", "code", "name"], required: false }],
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
        name: m.name,
        program: m.program,
        disciplineId: m.disciplineId,
        discipline: m.discipline ? {
          id: m.discipline.id,
          code: m.discipline.code,
          name: m.discipline.name,
        } : null,
        subjectCount: counts[m.id] || 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }

  // ===== Học phần theo chuyên ngành & bậc đào tạo =====
  async listSubjects(majorId?: string, program?: string, _includeCommon = false) {
    const where: any = {};
    if (majorId) where.majorId = majorId;
    if (program) where.program = program;
    return this.subjects.findAll({
      where,
      include: [{ model: Major, as: "major", attributes: ["id", "name"] }],
      order: [["sortOrder", "ASC"], ["codeNumber", "ASC"], ["name", "ASC"]],
    });
  }

  async createSubject(dto: CreateSubjectDto) {
    const program = dto.program || "masters";
    if (dto.canonicalSubjectId && dto.allowCrossMajor) {
      throw new BadRequestException("Học phần alias không thể đồng thời là học phần gốc dùng chung liên ngành.");
    }
    return this.sequelize.transaction(async (transaction) => {
      await this.requireMajorForProgram(dto.majorId, program, transaction);
      const sharedMajorIds = await this.validateSharedMajorIds(dto.sharedMajorIds || [], dto.majorId, program, transaction);
      dto.allowCrossMajor = sharedMajorIds.length > 0;
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
        "canonicalSubjectId", "allowCrossMajor", "sharedMajorIds",
      ]);
      payload.program = program;
      payload.sharedMajorIds = sharedMajorIds;
      payload.code = dto.codeText || String(dto.codeNumber || "");
      return this.subjects.create(payload as any, { transaction });
    });
  }

  async updateSubject(id: string, dto: UpdateSubjectDto) {
    return this.sequelize.transaction(async (transaction) => {
      const subject = await this.subjects.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!subject) throw new NotFoundException("Không tìm thấy học phần.");
      const majorId = dto.majorId || subject.majorId;
      const program = dto.program || subject.program;
      await this.requireMajorForProgram(majorId, program, transaction);
      const sharedMajorIds = await this.validateSharedMajorIds(
        dto.sharedMajorIds ?? subject.sharedMajorIds ?? [], majorId, program, transaction,
      );
      if (dto.sharedMajorIds !== undefined || sharedMajorIds.length > 0) dto.allowCrossMajor = sharedMajorIds.length > 0;
      await this.validateSubjectIdentityUpdate(subject, dto, program, transaction);
      const payload = this.pick(dto, [
        "codeNumber", "codeText", "name", "majorId", "program", "credits",
        "majorAssignment", "subjectType", "isRequired", "sortOrder", "active",
        "canonicalSubjectId", "allowCrossMajor", "sharedMajorIds",
      ]);
      payload.sharedMajorIds = sharedMajorIds;
      if (dto.codeText !== undefined) {
        payload.code = dto.codeText;
      } else if (dto.codeNumber !== undefined && !subject.codeText) {
        payload.code = String(dto.codeNumber);
      }
      await subject.update(payload, { transaction });

      // Curriculum entries store a snapshot of the required/elective flag.
      // Keep that snapshot aligned with the catalog, which is the UI's source
      // of truth for this property.
      if (dto.isRequired !== undefined) {
        await this.curriculumEntries.update(
          {
            isRequired: dto.isRequired,
            ...(dto.isRequired ? { electiveGroupId: null } : {}),
          },
          { where: { subjectId: id }, transaction },
        );
      }

      // A curriculum entry also snapshots the catalog's knowledge-block type.
      // Move existing entries to the matching block in their own curriculum
      // whenever that type changes in the catalog.
      if (dto.subjectType !== undefined) {
        await this.sequelize.query(
          `UPDATE curriculum_subjects AS cs
           SET block_id = cb.id, updated_at = NOW()
           FROM curriculum_blocks AS cb
           WHERE cs.subject_id = :subjectId
             AND cb.curriculum_id = cs.curriculum_id
             AND cb.code = :blockCode`,
          {
            replacements: { subjectId: id, blockCode: dto.subjectType },
            transaction,
          },
        );
      }

      return this.subjects.findByPk(id, {
        include: [
          { model: Major, as: "major", attributes: ["id", "name"] },
          { model: Subject, as: "canonicalSubject" },
        ],
        transaction,
      });
    });
  }

  async createSharedSubjects(dto: CreateSharedSubjectsDto) {
    const source = dto.source;
    const program = source.program || "masters";
    const definitions = [
      { majorId: source.majorId, codeNumber: source.codeNumber, codeText: source.codeText },
      ...dto.counterparts,
    ];
    const majorIds = definitions.map((item) => item.majorId);
    if (new Set(majorIds).size !== majorIds.length) {
      throw new BadRequestException("Mỗi chuyên ngành chỉ được khai báo một mã học phần.");
    }

    return this.sequelize.transaction(async (transaction) => {
      for (const majorId of majorIds) await this.requireMajorForProgram(majorId, program, transaction);
      const created: Subject[] = [];
      for (const definition of definitions) {
        const sharedMajorIds = majorIds.filter((id) => id !== definition.majorId);
        created.push(await this.subjects.create({
          ...this.pick(source, [
            "name", "credits", "majorAssignment", "subjectType", "isRequired", "sortOrder", "active",
          ]),
          majorId: definition.majorId,
          program,
          codeNumber: definition.codeNumber,
          codeText: definition.codeText,
          code: definition.codeText,
          canonicalSubjectId: null,
          allowCrossMajor: true,
          sharedMajorIds,
        } as any, { transaction }));
      }
      return { subjects: created };
    });
  }

  async createSubjectFromExisting(dto: CreateSubjectFromExistingDto) {
    const source = dto.source;
    const program = source.program || "masters";
    return this.sequelize.transaction(async (transaction) => {
      await this.requireMajorForProgram(source.majorId, program, transaction);
      const existingSubjectIds = dto.existingSubjectIds || [];
      const counterparts = dto.counterparts || [];
      if (existingSubjectIds.length === 0 && counterparts.length === 0) {
        throw new BadRequestException("Vui lòng chọn ít nhất một chuyên ngành học chung.");
      }
      const existingSubjects = await this.subjects.findAll({
        where: { id: { [Op.in]: existingSubjectIds } },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (existingSubjects.length !== existingSubjectIds.length) {
        throw new BadRequestException("Có học phần gợi ý không còn tồn tại.");
      }

      const existingMajorIds = existingSubjects.map((subject) => subject.majorId);
      const counterpartMajorIds = counterparts.map((counterpart) => counterpart.majorId);
      const targetMajorIds = [...new Set([...existingMajorIds, ...counterpartMajorIds])];
      if (targetMajorIds.length !== existingSubjects.length + counterparts.length || targetMajorIds.includes(source.majorId)) {
        throw new BadRequestException("Mỗi chuyên ngành học chung chỉ được chọn một học phần có sẵn.");
      }
      const targetMajors = await this.majors.findAll({
        where: { id: { [Op.in]: targetMajorIds }, program, active: true },
        transaction,
      });
      if (targetMajors.length !== targetMajorIds.length) {
        throw new BadRequestException("Có chuyên ngành học chung không tồn tại, đã ngừng sử dụng hoặc khác bậc đào tạo.");
      }

      const normalizedSourceName = source.name.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
      if (existingSubjects.some((subject) => (
        subject.program !== program
        || subject.name.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi") !== normalizedSourceName
        || Number(subject.credits) !== Number(source.credits || 0)
      ))) {
        throw new BadRequestException("Học phần học chung phải cùng tên, cùng số tín chỉ và cùng bậc đào tạo.");
      }

      for (const counterpart of counterparts) {
      }
      const payload = this.pick(source, [
        "codeNumber", "codeText", "name", "majorId", "program", "credits",
        "majorAssignment", "subjectType", "isRequired", "sortOrder", "active",
      ]);
      payload.program = program;
      payload.code = source.codeText || String(source.codeNumber || "");
      payload.canonicalSubjectId = null;
      payload.allowCrossMajor = true;
      payload.sharedMajorIds = targetMajorIds;
      const created = await this.subjects.create(payload as any, { transaction });

      const completeScope = [source.majorId, ...targetMajorIds];
      const createdCounterparts: Subject[] = [];
      for (const counterpart of counterparts) {
        createdCounterparts.push(await this.subjects.create({
          ...this.pick(source, ["name", "credits", "majorAssignment", "subjectType", "isRequired", "sortOrder", "active"]),
          majorId: counterpart.majorId,
          program,
          codeNumber: counterpart.codeNumber,
          codeText: counterpart.codeText,
          code: counterpart.codeText,
          canonicalSubjectId: null,
          allowCrossMajor: true,
          sharedMajorIds: completeScope.filter((id) => id !== counterpart.majorId),
        } as any, { transaction }));
      }
      for (const subject of existingSubjects) {
        const sharedMajorIds = [...new Set([
          ...(subject.sharedMajorIds || []),
          ...completeScope.filter((id) => id !== subject.majorId),
        ])];
        await subject.update({ allowCrossMajor: true, sharedMajorIds }, { transaction });
      }

      return {
        subject: await this.subjects.findByPk(created.id, {
          include: [{ model: Major, as: "major", attributes: ["id", "name"] }],
          transaction,
        }),
        linkedSubjects: existingSubjects,
        createdCounterparts,
      };
    });
  }

  private async validateSharedMajorIds(ids: string[], ownMajorId: string, program: string, transaction: Transaction) {
    const uniqueIds = [...new Set(ids || [])];
    if (uniqueIds.includes(ownMajorId)) throw new BadRequestException("Phạm vi học chung không được chứa chính chuyên ngành của học phần.");
    if (uniqueIds.length === 0) return uniqueIds;
    const majors = await this.majors.findAll({
      where: { id: { [Op.in]: uniqueIds }, program, active: true, isCommon: false },
      attributes: ["id"], transaction,
    });
    if (majors.length !== uniqueIds.length) {
      throw new BadRequestException("Phạm vi học chung có chuyên ngành không tồn tại, đã ngừng sử dụng hoặc khác bậc đào tạo.");
    }
    return uniqueIds;
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
        { model: Major, as: "major", attributes: ["id", "name"] },
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
        { model: Major, as: "major", attributes: ["id", "name"] },
        { model: Curriculum, as: "curriculum", attributes: ["id", "code", "name", "totalCredits", "applicableFromYear", "active"] },
      ],
    });
  }

  async updateClass(id: string, dto: UpdateClassDto) {
    await this.classGroupsService.update(id, dto as any);
    return this.classGroups.findByPk(id, {
      include: [
        { model: Major, as: "major", attributes: ["id", "name"] },
        { model: Curriculum, as: "curriculum", attributes: ["id", "code", "name", "totalCredits", "applicableFromYear", "active"] },
      ],
    });
  }

  async removeClass(id: string) {
    return this.classGroupsService.remove(id);
  }

  // Danh mục học phần của lớp là toàn bộ học phần thuộc CTĐT được chọn trực tiếp cho lớp.
  // Cùng ngành + khóa có thể có nhiều CTĐT khác nhau; không có lớp "gói học phần" trung gian.

  // ===== HỒ SƠ TUYỂN SINH (ADMISSION RECORDS) =====
  async listAdmissionRecords(
    majorId?: string,
    trainingLevel?: string,
    academicYear?: string,
    status?: string,
    disciplineId?: string,
    search?: string,
    pageParam?: string,
    pageSizeParam?: string,
    excludeStatus?: string,
    includeGroup = false,
    admissionStage?: string,
  ) {
    const page = Math.max(1, Number.parseInt(pageParam || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(pageSizeParam || "20", 10) || 20));
    const where: any = {};
    if (majorId) where.majorId = majorId;
    if (trainingLevel) where.trainingLevel = trainingLevel;
    if (academicYear) where.academicYear = academicYear;
    if (status && status !== "ALL") where.studyStatus = status;
    else if (excludeStatus) where.studyStatus = { [Op.ne]: excludeStatus };
    if (admissionStage === "learners") {
      where[Op.and] = [admissionLearnerWhere()];
    } else if (admissionStage === "applications") {
      where[Op.and] = [
        { status: { [Op.ne]: "approved" } },
        { [Op.or]: [{ studyStatus: { [Op.notIn]: ["Đã trúng tuyển", "Đang học"] } }, { studyStatus: { [Op.is]: null } }] },
      ];
    }

    const keyword = search?.trim().slice(0, 100);
    if (keyword) {
      const pattern = `%${keyword}%`;
      where[Op.or] = ["fullName", "code", "idCard", "phone", "email", "majorName"].map((field) => ({
        [field]: { [Op.iLike]: pattern },
      }));
    }

    const includeMajor = {
      model: Major,
      as: "major",
      attributes: ["id", "name", "disciplineId"],
      ...(disciplineId ? { where: { disciplineId }, required: true } : {}),
    };

    const countWith = (extraWhere: Record<string, unknown> = {}) => this.admissionRecordsModel.count({
      where: Object.keys(extraWhere).length ? { [Op.and]: [where, extraWhere] } : where,
      include: [includeMajor],
      distinct: true,
    });

    const [result, mastersCount, doctoralCount, eligibleCount] = await Promise.all([
      this.admissionRecordsModel.findAndCountAll({
        where,
        include: [includeMajor],
        order: [["createdAt", "DESC"]],
        limit: pageSize,
        offset: (page - 1) * pageSize,
        distinct: true,
      }),
      countWith({ trainingLevel: "Thạc sĩ" }),
      countWith({ trainingLevel: "Tiến sĩ" }),
      countWith({ studyStatus: { [Op.in]: ["Đủ điều kiện dự tuyển", "Đã trúng tuyển", "Đang học"] } }),
    ]);

    const total = result.count;
    let rows: any[] = result.rows;

    if (includeGroup && rows.length > 0) {
      const admissionRecordIds = rows.map((row) => row.id);
      const studentIds = rows.map((row) => row.studentId).filter(Boolean);
      const membershipWhere = {
        [Op.or]: [
          { admissionRecordId: { [Op.in]: admissionRecordIds } },
          ...(studentIds.length > 0 ? [{ studentId: { [Op.in]: studentIds } }] : []),
        ],
      };
      const memberships = await this.classGroupMembers.findAll({
        where: membershipWhere,
        include: [{
          model: ClassGroup,
          as: "classGroup",
          where: { program: "masters" },
          attributes: ["id", "code", "name", "academicYear"],
          required: true,
        }],
      });
      const byRecordId = new Map<string, any>();
      const byStudentId = new Map<string, any>();
      for (const membership of memberships) {
        if (membership.admissionRecordId) byRecordId.set(membership.admissionRecordId, membership.classGroup);
        if (membership.studentId) byStudentId.set(membership.studentId, membership.classGroup);
      }
      rows = rows.map((row) => {
        const plain = typeof row.toJSON === "function" ? row.toJSON() : row;
        const group = byRecordId.get(row.id) || (row.studentId ? byStudentId.get(row.studentId) : null);
        return {
          ...plain,
          assignedGroup: group ? {
            id: group.id,
            code: group.code,
            name: group.name,
            academicYear: group.academicYear,
          } : null,
        };
      });
    }

    return {
      data: rows,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      stats: { total, mastersCount, doctoralCount, eligibleCount },
    };
  }

  async getAdmissionRecord(id: string) {
    const record = await this.admissionRecordsModel.findByPk(id, {
      include: [{ model: Major, as: "major", attributes: ["id", "name"] }],
    });
    if (!record) throw new NotFoundException("Không tìm thấy hồ sơ tuyển sinh");
    return record;
  }

  async createAdmissionRecord(dto: CreateAdmissionRecordDto) {
    await this.admissionEvaluation?.guardRecordUpdate(null, dto);
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
      include: [{ model: Major, as: "major", attributes: ["id", "name"] }],
    });
  }

  async updateAdmissionRecord(id: string, dto: UpdateAdmissionRecordDto) {
    return this.sequelize.transaction(async (transaction) => {
      const record = await this.admissionRecordsModel.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!record) throw new NotFoundException("Không tìm thấy hồ sơ tuyển sinh");

      let fullName = dto.fullName?.trim();
      if (!fullName && (dto.lastName !== undefined || dto.firstName !== undefined)) {
        fullName = `${dto.lastName ?? record.lastName ?? ""} ${dto.firstName ?? record.firstName ?? ""}`.trim();
      }
      await this.admissionEvaluation?.guardRecordUpdate(record, dto, transaction);
      const payload: Record<string, unknown> = { ...dto };
      delete payload.majorName;
      if (dto.majorId !== undefined || dto.trainingLevel !== undefined) {
        const major = await this.requireAdmissionMajor(dto.majorId ?? record.majorId, dto.trainingLevel ?? record.trainingLevel);
        payload.majorId = major.id;
        payload.majorName = major.name;
      }
      if (fullName) payload.fullName = fullName;

      await record.update(payload as any, { transaction });
      // Học viên vừa vào CTĐT chính thức: tự đối chiếu kết quả tiền thạc sĩ/học trước để đề xuất công nhận.
      if (payload.status === "approved" && record.status !== "approved" && this.recognitions) {
        try {
          await this.recognitions.proposeForRecord(id, {});
        } catch {
          // Chưa có CTĐT phù hợp hoặc chưa có kết quả học phần: bỏ qua, không chặn việc lưu hồ sơ.
        }
      }
      return this.admissionRecordsModel.findByPk(id, {
        include: [{ model: Major, as: "major", attributes: ["id", "name"] }], transaction,
      });
    });
  }

  async removeAdmissionRecord(id: string) {
    const record = await this.admissionRecordsModel.findByPk(id);
    if (!record) throw new NotFoundException("Không tìm thấy hồ sơ tuyển sinh");
    await record.destroy();
    return { success: true, message: "Đã xóa hồ sơ tuyển sinh." };
  }
}
