import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op } from "sequelize";
import type { Transaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { Major } from "../database/models/common/major.model.js";
import { Subject } from "../database/models/plan/subject.model.js";
import { Curriculum } from "../database/models/plan/curriculum.model.js";
import { CurriculumBlock } from "../database/models/plan/curriculum-block.model.js";
import { CurriculumElectiveGroup } from "../database/models/plan/curriculum-elective-group.model.js";
import { CurriculumSubject } from "../database/models/plan/curriculum-subject.model.js";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { ClassGroupElective } from "../database/models/training/class-group-elective.model.js";
import {
  CreateCurriculumDto,
  CurriculumSubjectEntryDto,
  SetCurriculumSubjectsDto,
  UpdateCurriculumDto,
} from "./dto/plan.dto.js";

/** Khối kiến thức mặc định của mọi CTĐT (khớp `subjects.subject_type`). */
const DEFAULT_BLOCKS = [
  { code: "KC", name: "Khối kiến thức chung", sortOrder: 0 },
  { code: "CS", name: "Kiến thức cơ sở ngành", sortOrder: 1 },
  { code: "CN", name: "Kiến thức chuyên ngành", sortOrder: 2 },
  { code: "TC", name: "Học phần tự chọn", sortOrder: 3 },
  { code: "CH", name: "Chuyên đề", sortOrder: 4 },
];
const BLOCK_CODES = new Set(DEFAULT_BLOCKS.map((block) => block.code));
const SUBJECT_INCLUDE = { model: Subject, as: "subject" } as const;

/**
 * Nghiệp vụ chương trình đào tạo (CTĐT).
 *
 * - Mỗi **ngành + bậc + khóa** có đúng một CTĐT (`curriculums`).
 * - CTĐT gồm các **khối kiến thức** (`curriculum_blocks`), các **nhóm tự chọn**
 *   (`curriculum_elective_groups`) và danh mục **học phần** (`curriculum_subjects`).
 * - Lớp/nhóm học viên **kế thừa** CTĐT của ngành + khóa; Viện chỉ **chọn học phần tự chọn
 *   cho cả lớp** (`class_group_electives`), không tự định nghĩa lại danh mục học phần.
 */
@Injectable()
export class CurriculumService {
  constructor(
    @InjectModel(Curriculum) private readonly curriculums: typeof Curriculum,
    @InjectModel(CurriculumBlock) private readonly blocks: typeof CurriculumBlock,
    @InjectModel(CurriculumElectiveGroup) private readonly electiveGroups: typeof CurriculumElectiveGroup,
    @InjectModel(CurriculumSubject) private readonly entries: typeof CurriculumSubject,
    @InjectModel(ClassGroup) private readonly classGroups: typeof ClassGroup,
    @InjectModel(ClassGroupElective) private readonly classElectives: typeof ClassGroupElective,
    @InjectModel(Subject) private readonly subjects: typeof Subject,
    @InjectModel(Major) private readonly majors: typeof Major,
    private readonly sequelize: Sequelize,
  ) {}

  private static readonly DETAIL_INCLUDE = [
    { model: CurriculumBlock, as: "blocks" },
    { model: CurriculumElectiveGroup, as: "electiveGroups" },
    { model: CurriculumSubject, as: "subjectEntries", include: [SUBJECT_INCLUDE] },
  ];

  // ===== Đọc =====

  async list(majorId?: string, program?: string) {
    const where: Record<string, unknown> = {};
    if (majorId) where.majorId = majorId;
    if (program) where.program = program;
    const items = await this.curriculums.findAll({
      where,
      include: [
        { model: Major, as: "major", attributes: ["id", "code", "name"] },
        { model: CurriculumSubject, as: "subjectEntries", attributes: ["id", "isRequired", "credits"] },
      ],
      order: [["applicableFromYear", "DESC"], ["code", "ASC"]],
    });

    const curriculumIds = items.map((c) => c.id);
    const classes = curriculumIds.length === 0 ? [] : await this.classGroups.findAll({
      where: { curriculumId: { [Op.in]: curriculumIds } },
      attributes: ["id", "code", "name", "academicYear", "curriculumId"],
    });

    const classesByCurriculum = new Map<string, Array<{ id: string; code: string; name: string; academicYear: string | null }>>();
    for (const c of classes) {
      if (!c.curriculumId) continue;
      const list = classesByCurriculum.get(c.curriculumId) || [];
      list.push({ id: c.id, code: c.code, name: c.name, academicYear: c.academicYear });
      classesByCurriculum.set(c.curriculumId, list);
    }

    return items.map((item) => {
      const plain = typeof item.get === "function" ? item.get({ plain: true }) : item;
      return {
        ...plain,
        classGroups: classesByCurriculum.get(item.id) || [],
      };
    });
  }

  async detail(id: string, transaction?: Transaction) {
    const curriculum = await this.curriculums.findByPk(id, {
      include: CurriculumService.DETAIL_INCLUDE as never,
      order: [
        [{ model: CurriculumBlock, as: "blocks" }, "sortOrder", "ASC"],
        [{ model: CurriculumElectiveGroup, as: "electiveGroups" }, "sortOrder", "ASC"],
        [{ model: CurriculumSubject, as: "subjectEntries" }, "sortOrder", "ASC"],
      ],
      transaction,
    });
    if (!curriculum) throw new NotFoundException("Không tìm thấy chương trình đào tạo.");
    const classGroups = await this.classGroups.findAll({
      where: { curriculumId: id },
      attributes: ["id", "code", "name", "academicYear"],
      transaction,
    });
    const result = this.withTotals(curriculum);
    return {
      ...result,
      classGroups: classGroups.map((c) => ({ id: c.id, code: c.code, name: c.name, academicYear: c.academicYear })),
    };
  }

  /**
   * Danh mục học phần hiệu lực của một lớp: học phần bắt buộc trong CTĐT
   * cộng với học phần tự chọn mà Viện đã chọn cho lớp.
   *
   * Đây là thao tác **chỉ đọc**: nếu lớp chưa có CTĐT thì trả về `curriculum: null`
   * để giao diện mời người dùng tạo CTĐT (`ensureForClass`).
   */
  async classSubjects(classGroupId: string) {
    return this.sequelize.transaction(async (transaction) => {
      const classGroup = await this.requireClassGroup(classGroupId, transaction);
      const curriculum = await this.findForClassGroup(classGroup, transaction);
      if (!curriculum) {
        return {
          classGroup: { id: classGroup.id, code: classGroup.code, name: classGroup.name, academicYear: classGroup.academicYear },
          curriculum: null,
          blocks: [],
          electiveGroups: [],
          subjects: [],
          selectedElectiveIds: [],
          totals: { requiredCredits: 0, selectedElectiveCredits: 0, totalCredits: 0 },
        };
      }
      const curriculumId = curriculum.id;

      const [blocks, electiveGroups, rows, selected] = await Promise.all([
        this.blocks.findAll({ where: { curriculumId }, order: [["sortOrder", "ASC"]], transaction }),
        this.electiveGroups.findAll({ where: { curriculumId }, order: [["sortOrder", "ASC"]], transaction }),
        this.entries.findAll({
          where: { curriculumId },
          include: [
            SUBJECT_INCLUDE,
            { model: CurriculumBlock, as: "block" },
            { model: CurriculumElectiveGroup, as: "electiveGroup" },
          ] as never,
          order: [["sortOrder", "ASC"]],
          transaction,
        }),
        this.classElectives.findAll({ where: { classGroupId }, transaction }),
      ]);

      const selectedIds = new Set(selected.map((row) => row.curriculumSubjectId));
      const blockById = new Map(blocks.map((block) => [block.id, block]));
      const groupById = new Map(electiveGroups.map((group) => [group.id, group]));

      const subjectRows = rows.map((row: any) => {
        const plain = typeof row.get === "function" ? row.get({ plain: true }) : row;
        const isRequired = Boolean(plain.isRequired);
        const block = plain.blockId ? blockById.get(plain.blockId) : undefined;
        const group = plain.electiveGroupId ? groupById.get(plain.electiveGroupId) : undefined;
        return {
          id: plain.id,
          subjectId: plain.subjectId,
          code: plain.subject?.codeText || plain.subject?.code || "",
          codeNumber: plain.subject?.codeNumber ?? 0,
          name: plain.subject?.name || "",
          credits: Number(plain.credits) || 0,
          isRequired,
          active: plain.subject?.active !== false,
          blockId: plain.blockId,
          blockCode: plain.block?.code || blockById.get(plain.blockId)?.code || "",
          blockName: block?.name || "",
          electiveGroupId: plain.electiveGroupId,
          electiveGroupCode: group?.code || "",
          electiveGroupName: group?.name || "",
          selected: true,
        };
      });

      const requiredCredits = subjectRows
        .filter((row) => row.isRequired)
        .reduce((total, row) => total + row.credits, 0);
      const selectedElectiveCredits = subjectRows
        .filter((row) => !row.isRequired)
        .reduce((total, row) => total + row.credits, 0);

      return {
        classGroup: { id: classGroup.id, code: classGroup.code, name: classGroup.name, academicYear: classGroup.academicYear },
        curriculum: { id: curriculum.id, code: curriculum.code, name: curriculum.name, totalCredits: curriculum.totalCredits },
        blocks: blocks.map((block) => ({
          id: block.id,
          code: block.code,
          name: block.name,
          minCredits: block.minCredits,
          requiredCredits: subjectRows.filter((row) => row.blockId === block.id && row.isRequired).reduce((total, row) => total + row.credits, 0),
          electiveCredits: subjectRows.filter((row) => row.blockId === block.id && !row.isRequired).reduce((total, row) => total + row.credits, 0),
        })),
        electiveGroups: electiveGroups.map((group) => ({
          id: group.id,
          code: group.code,
          name: group.name,
          minCredits: group.minCredits,
          maxCredits: group.maxCredits,
          selectedCredits: subjectRows.filter((row) => row.electiveGroupId === group.id).reduce((total, row) => total + row.credits, 0),
        })),
        subjects: subjectRows,
        selectedElectiveIds: subjectRows.filter((row) => !row.isRequired).map((row) => row.id),
        totals: { requiredCredits, selectedElectiveCredits, totalCredits: requiredCredits + selectedElectiveCredits },
      };
    });
  }

  // ===== Ghi =====

  async create(dto: CreateCurriculumDto) {
    return this.sequelize.transaction(async (transaction) => {
      const program = dto.program || "masters";
      const major = await this.requireMajor(dto.majorId, program, transaction);
      const applicableFromYear = (dto.applicableFromYear || "").trim();
      const existing = await this.curriculums.findOne({
        where: { majorId: dto.majorId, program, applicableFromYear },
        transaction,
      });
      if (existing) {
        throw new ConflictException(`Ngành "${major.code}" đã có chương trình đào tạo cho khóa "${applicableFromYear || "chưa xác định"}".`);
      }
      const duplicateCode = await this.curriculums.findOne({ where: { code: dto.code }, transaction });
      if (duplicateCode) throw new ConflictException(`Mã chương trình đào tạo "${dto.code}" đã tồn tại.`);

      const curriculum = await this.curriculums.create({
        code: dto.code,
        name: dto.name,
        majorId: dto.majorId,
        program,
        applicableFromYear,
        totalCredits: 0,
        active: dto.active ?? true,
        note: dto.note ?? null,
      } as never, { transaction });

      const blocks = await this.syncBlocks(curriculum.id, dto.blocks || DEFAULT_BLOCKS.map((block) => ({ ...block, minCredits: 0 })), transaction);
      const groups = await this.syncElectiveGroups(curriculum.id, dto.electiveGroups || [], transaction);
      const entries = Array.isArray(dto.subjects)
        ? dto.subjects
        : await this.catalogEntries(dto.majorId, program, transaction);
      await this.replaceSubjects(curriculum.id, entries, blocks, groups, transaction);

      return this.detail(curriculum.id, transaction);
    });
  }

  async update(id: string, dto: UpdateCurriculumDto) {
    return this.sequelize.transaction(async (transaction) => {
      const curriculum = await this.requireCurriculum(id, transaction);
      const program = dto.program || curriculum.program;
      const majorId = dto.majorId || curriculum.majorId;
      await this.requireMajor(majorId, program, transaction);

      const applicableFromYear = dto.applicableFromYear !== undefined
        ? dto.applicableFromYear.trim()
        : curriculum.applicableFromYear;
      const conflict = await this.curriculums.findOne({
        where: { majorId, program, applicableFromYear, id: { [Op.ne]: id } },
        transaction,
      });
      if (conflict) throw new ConflictException("Đã có chương trình đào tạo khác cho ngành và khóa này.");

      if (dto.code !== undefined && dto.code !== curriculum.code) {
        const duplicate = await this.curriculums.findOne({ where: { code: dto.code, id: { [Op.ne]: id } }, transaction });
        if (duplicate) throw new ConflictException(`Mã chương trình đào tạo "${dto.code}" đã tồn tại.`);
      }

      const payload: Record<string, unknown> = {};
      for (const key of ["code", "name", "majorId", "program", "applicableFromYear", "active"] as const) {
        if (dto[key] !== undefined) payload[key] = dto[key];
      }
      if (dto.note !== undefined) payload.note = dto.note || null;
      if (Object.keys(payload).length > 0) await curriculum.update(payload as never, { transaction });
      if (dto.totalCredits !== undefined) await curriculum.update({ totalCredits: dto.totalCredits } as never, { transaction });

      return this.detail(id, transaction);
    });
  }

  async remove(id: string) {
    return this.sequelize.transaction(async (transaction) => {
      const curriculum = await this.requireCurriculum(id, transaction);
      const linkedClasses = await this.classGroups.count({ where: { curriculumId: id }, transaction });
      if (linkedClasses > 0) {
        throw new ConflictException(`Không thể xóa: còn ${linkedClasses} lớp đang dùng chương trình đào tạo này.`);
      }
      await curriculum.destroy({ transaction });
      return { success: true, message: "Đã xóa chương trình đào tạo." };
    });
  }

  async setSubjects(id: string, dto: SetCurriculumSubjectsDto) {
    return this.sequelize.transaction(async (transaction) => {
      const curriculum = await this.requireCurriculum(id, transaction);
      const [blocks, groups] = await Promise.all([
        this.blocks.findAll({ where: { curriculumId: id }, transaction }),
        this.electiveGroups.findAll({ where: { curriculumId: id }, transaction }),
      ]);
      if (blocks.length === 0) throw new BadRequestException("Chương trình đào tạo chưa có khối kiến thức.");
      await this.replaceSubjects(
        id,
        dto.subjects,
        new Map(blocks.map((block) => [block.code, block])),
        new Map(groups.map((group) => [group.code, group])),
        transaction,
      );
      return this.detail(id, transaction);
    });
  }

  /** Đặt danh sách học phần tự chọn mà Viện chỉ định cho một lớp. */
  async setClassElectives(classGroupId: string, curriculumSubjectIds: string[]) {
    await this.sequelize.transaction(async (transaction) => {
      const classGroup = await this.requireClassGroup(classGroupId, transaction);
      const curriculum = await this.findForClassGroup(classGroup, transaction);
      if (!curriculum) {
        throw new BadRequestException("Lớp chưa có chương trình đào tạo. Hãy tạo chương trình đào tạo cho lớp trước.");
      }

      const rows = await this.entries.findAll({
        where: { curriculumId: curriculum.id },
        include: [{ model: CurriculumElectiveGroup, as: "electiveGroup" }] as never,
        transaction,
      });
      const byId = new Map(rows.map((row: any) => [row.id, row]));
      const unknown = curriculumSubjectIds.filter((entryId) => !byId.has(entryId));
      if (unknown.length > 0) {
        throw new BadRequestException("Có học phần không thuộc chương trình đào tạo của lớp.");
      }
      const notElective = curriculumSubjectIds.filter((entryId) => byId.get(entryId)!.isRequired);
      if (notElective.length > 0) {
        throw new BadRequestException("Học phần bắt buộc luôn thuộc chương trình, không cần chọn.");
      }

      const creditsByGroup = new Map<string, number>();
      for (const entryId of curriculumSubjectIds) {
        const row: any = byId.get(entryId)!;
        const key = row.electiveGroupId || "";
        creditsByGroup.set(key, (creditsByGroup.get(key) || 0) + (Number(row.credits) || 0));
      }
      for (const [groupId, credits] of creditsByGroup) {
        if (!groupId) continue;
        const group: any = rows.find((row: any) => row.electiveGroupId === groupId)?.electiveGroup;
        if (!group) continue;
        if (group.minCredits > 0 && credits < group.minCredits) {
          throw new BadRequestException(`Nhóm tự chọn "${group.name}" cần tối thiểu ${group.minCredits} tín chỉ, đang chọn ${credits}.`);
        }
        if (group.maxCredits > 0 && credits > group.maxCredits) {
          throw new BadRequestException(`Nhóm tự chọn "${group.name}" tối đa ${group.maxCredits} tín chỉ, đang chọn ${credits}.`);
        }
      }

      await this.classElectives.destroy({ where: { classGroupId }, transaction });
      if (curriculumSubjectIds.length > 0) {
        await this.classElectives.bulkCreate(
          curriculumSubjectIds.map((entryId) => ({ classGroupId, curriculumSubjectId: entryId })) as never,
          { transaction },
        );
      }
    });
    return this.classSubjects(classGroupId);
  }

  /**
   * Tìm CTĐT của lớp theo ngành + bậc + khóa và tự gắn lại `curriculum_id` nếu lớp
   * chưa có khoá (dữ liệu cũ). **Không tạo mới** — dùng `ensureForClass` khi cần tạo.
   */
  private async findForClassGroup(classGroup: ClassGroup, transaction?: Transaction): Promise<Curriculum | null> {
    if (!classGroup.majorId) return null;
    let curriculum = classGroup.curriculumId
      ? await this.curriculums.findByPk(classGroup.curriculumId, { transaction })
      : null;
    if (!curriculum) {
      curriculum = await this.curriculums.findOne({
        where: {
          majorId: classGroup.majorId,
          program: classGroup.program,
          applicableFromYear: (classGroup.academicYear || "").trim(),
        },
        transaction,
      });
    }
    if (curriculum && classGroup.curriculumId !== curriculum.id) {
      await classGroup.update({ curriculumId: curriculum.id } as never, { transaction });
    }
    return curriculum;
  }

  /** Gắn (và tạo nếu chưa có) CTĐT của ngành + khóa cho một lớp. */
  async assignToClassGroup(classGroup: ClassGroup, transaction?: Transaction): Promise<Curriculum> {
    if (!classGroup.majorId) {
      throw new BadRequestException("Lớp học phải được gắn chuyên ngành trước khi xác định chương trình đào tạo.");
    }
    const applicableFromYear = (classGroup.academicYear || "").trim();
    let curriculum = await this.curriculums.findOne({
      where: { majorId: classGroup.majorId, program: classGroup.program, applicableFromYear },
      transaction,
    });
    if (!curriculum) {
      curriculum = await this.autoCreate(classGroup.majorId, classGroup.program, applicableFromYear, transaction);
    }
    if (classGroup.curriculumId !== curriculum.id) {
      await classGroup.update({ curriculumId: curriculum.id } as never, { transaction });
    }
    // Tự động đồng bộ các môn tự chọn của CTĐT vào danh sách môn học của lớp
    const electiveEntries = await this.entries.findAll({
      where: { curriculumId: curriculum.id, isRequired: false },
      attributes: ["id"],
      transaction,
    });
    await this.classElectives.destroy({ where: { classGroupId: classGroup.id }, transaction });
    if (electiveEntries.length > 0) {
      await this.classElectives.bulkCreate(
        electiveEntries.map((e) => ({ classGroupId: classGroup.id, curriculumSubjectId: e.id })) as never,
        { transaction },
      );
    }
    return curriculum;
  }

  async ensureForClass(classGroupId: string) {
    return this.sequelize.transaction(async (transaction) => {
      const classGroup = await this.requireClassGroup(classGroupId, transaction);
      const curriculum = await this.assignToClassGroup(classGroup, transaction);
      return this.detail(curriculum.id, transaction);
    });
  }

  // ===== Nội bộ =====

  private async autoCreate(majorId: string, program: string, applicableFromYear: string, transaction: Transaction) {
    const major = await this.requireMajor(majorId, program, transaction);
    const yearLabel = applicableFromYear || "chưa xác định";
    let code = `CT-${major.code}-${applicableFromYear || "NA"}`;
    const duplicate = await this.curriculums.findOne({ where: { code }, transaction });
    if (duplicate) code = `${code}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const curriculum = await this.curriculums.create({
      code,
      name: `Chương trình đào tạo ${major.name} - Khóa ${yearLabel}`,
      majorId,
      program,
      applicableFromYear,
      totalCredits: 0,
      active: true,
      note: null,
    } as never, { transaction });

    const blocks = await this.syncBlocks(curriculum.id, DEFAULT_BLOCKS.map((block) => ({ ...block, minCredits: 0 })), transaction);
    const entries = await this.catalogEntries(majorId, program, transaction);
    await this.replaceSubjects(curriculum.id, entries, blocks, new Map<string, CurriculumElectiveGroup>(), transaction);
    return curriculum;
  }

  private async catalogEntries(majorId: string, program: string, transaction: Transaction): Promise<CurriculumSubjectEntryDto[]> {
    const subjects = await this.subjects.findAll({
      where: {
        program,
        active: true,
        [Op.or]: [
          { majorId },
          { subjectType: "KC" },
        ],
      },
      order: [["sortOrder", "ASC"], ["codeNumber", "ASC"], ["name", "ASC"]],
      transaction,
    });
    return subjects.map((subject, index) => ({
      subjectId: subject.id,
      blockCode: BLOCK_CODES.has(subject.subjectType) ? subject.subjectType : "CN",
      isRequired: subject.isRequired !== false,
      credits: Number(subject.credits) || 0,
      sortOrder: index + 1,
    }));
  }

  private async syncBlocks(curriculumId: string, definitions: Array<{ code: string; name: string; minCredits?: number; sortOrder?: number }>, transaction: Transaction) {
    const definitionsByCode = new Map<string, { code: string; name: string; minCredits?: number; sortOrder?: number }>();
    for (const definition of definitions) {
      const code = String(definition.code || "").trim().toUpperCase();
      if (!code || definitionsByCode.has(code)) continue;
      definitionsByCode.set(code, { ...definition, code });
    }
    const existing = await this.blocks.findAll({ where: { curriculumId }, transaction });
    const existingByCode = new Map(existing.map((row) => [row.code, row]));
    let index = 0;
    for (const definition of definitionsByCode.values()) {
      index += 1;
      const payload = {
        curriculumId,
        code: definition.code,
        name: definition.name || definition.code,
        minCredits: definition.minCredits ?? 0,
        sortOrder: definition.sortOrder ?? index,
      };
      const current = existingByCode.get(definition.code);
      if (current) await current.update(payload as never, { transaction });
      else await this.blocks.create(payload as never, { transaction });
    }
    const rows = await this.blocks.findAll({ where: { curriculumId }, order: [["sortOrder", "ASC"]], transaction });
    return new Map(rows.map((row) => [row.code, row]));
  }

  private async syncElectiveGroups(curriculumId: string, definitions: Array<{ code: string; name: string; minCredits?: number; maxCredits?: number; sortOrder?: number }>, transaction: Transaction) {
    const definitionsByCode = new Map<string, { code: string; name: string; minCredits?: number; maxCredits?: number; sortOrder?: number }>();
    for (const definition of definitions) {
      const code = String(definition.code || "").trim().toUpperCase();
      if (!code || definitionsByCode.has(code)) continue;
      definitionsByCode.set(code, { ...definition, code });
    }
    const existing = await this.electiveGroups.findAll({ where: { curriculumId }, transaction });
    const existingByCode = new Map(existing.map((row) => [row.code, row]));
    let index = 0;
    for (const definition of definitionsByCode.values()) {
      index += 1;
      const payload = {
        curriculumId,
        code: definition.code,
        name: definition.name || definition.code,
        minCredits: definition.minCredits ?? 0,
        maxCredits: definition.maxCredits ?? 0,
        sortOrder: definition.sortOrder ?? index,
      };
      const current = existingByCode.get(definition.code);
      if (current) await current.update(payload as never, { transaction });
      else await this.electiveGroups.create(payload as never, { transaction });
    }
    const rows = await this.electiveGroups.findAll({ where: { curriculumId }, transaction });
    return new Map(rows.map((row) => [row.code, row]));
  }

  private async replaceSubjects(
    curriculumId: string,
    entries: CurriculumSubjectEntryDto[],
    blocks: Map<string, CurriculumBlock>,
    groups: Map<string, CurriculumElectiveGroup>,
    transaction: Transaction,
  ) {
    const subjectIds = [...new Set(entries.map((entry) => entry.subjectId))];
    const found = await this.subjects.findAll({
      where: { id: { [Op.in]: subjectIds } },
      transaction,
    });
    const subjectById = new Map(found.map((subject) => [subject.id, subject]));
    const missing = subjectIds.filter((subjectId) => !subjectById.has(subjectId));
    if (missing.length > 0) {
      throw new BadRequestException("Danh sách có học phần không tồn tại.");
    }

    const current = await this.entries.findAll({ where: { curriculumId }, transaction });
    const currentBySubjectId = new Map(current.map((row) => [row.subjectId, row]));
    // Học phần đã ngừng sử dụng vẫn được giữ nếu nó đã nằm trong CTĐT; chỉ chặn thêm mới.
    const inactive = subjectIds.filter((subjectId) => (
      subjectById.get(subjectId)!.active === false && !currentBySubjectId.has(subjectId)
    ));
    if (inactive.length > 0) {
      throw new BadRequestException("Danh sách có học phần đã ngừng sử dụng.");
    }

    const fallbackBlock = blocks.values().next().value as CurriculumBlock;
    const payload = entries.map((entry, index) => {
      const subject = subjectById.get(entry.subjectId)!;
      const blockCode = String(entry.blockCode || "").trim().toUpperCase();
      const block = (blockCode ? blocks.get(blockCode) : undefined) || fallbackBlock;
      if (!block) throw new BadRequestException("Chương trình đào tạo chưa có khối kiến thức phù hợp.");
      const groupCode = String(entry.electiveGroupCode || "").trim().toUpperCase();
      const group = groupCode ? groups.get(groupCode) : undefined;
      if (groupCode && !group) throw new BadRequestException(`Nhóm tự chọn "${groupCode}" không tồn tại trong chương trình đào tạo.`);
      const isRequired = entry.isRequired ?? subject.isRequired !== false;
      if (isRequired && group) throw new BadRequestException("Học phần bắt buộc không được xếp vào nhóm tự chọn.");
      return {
        curriculumId,
        blockId: block.id,
        electiveGroupId: isRequired ? null : group?.id ?? null,
        subjectId: entry.subjectId,
        isRequired,
        credits: entry.credits ?? (Number(subject.credits) || 0),
        sortOrder: entry.sortOrder ?? index + 1,
      };
    });

    // Đồng bộ theo hiệu số để **giữ nguyên id** của các dòng không đổi; nhờ vậy lựa chọn
    // học phần tự chọn của lớp không bị mất mỗi lần cập nhật CTĐT.
    const incomingSubjectIds = new Set(payload.map((row) => row.subjectId));

    const removed = current.filter((row) => !incomingSubjectIds.has(row.subjectId));
    if (removed.length > 0) {
      // Xoá dòng học phần cũng tự gỡ lựa chọn tự chọn của lớp (khoá ngoại cascade).
      await this.entries.destroy({ where: { id: { [Op.in]: removed.map((row) => row.id) } }, transaction });
    }

    const becameRequired: string[] = [];
    for (const row of payload) {
      const existing = currentBySubjectId.get(row.subjectId);
      if (!existing) {
        await this.entries.create(row as never, { transaction });
        continue;
      }
      if (row.isRequired && !existing.isRequired) becameRequired.push(existing.id);
      await existing.update(row as never, { transaction });
    }

    // Tự động đồng bộ các môn tự chọn của CTĐT vào classElectives của các lớp đang gắn CTĐT này
    const allElectiveEntries = await this.entries.findAll({
      where: { curriculumId, isRequired: false },
      attributes: ["id"],
      transaction,
    });
    const linkedClasses = await this.classGroups.findAll({
      where: { curriculumId },
      attributes: ["id"],
      transaction,
    });
    if (linkedClasses.length > 0) {
      const classIds = linkedClasses.map((c) => c.id);
      await this.classElectives.destroy({ where: { classGroupId: { [Op.in]: classIds } }, transaction });
      if (allElectiveEntries.length > 0) {
        const records: Array<{ classGroupId: string; curriculumSubjectId: string }> = [];
        for (const c of linkedClasses) {
          for (const e of allElectiveEntries) {
            records.push({ classGroupId: c.id, curriculumSubjectId: e.id });
          }
        }
        await this.classElectives.bulkCreate(records as never, { transaction });
      }
    }

    await this.recomputeTotalCredits(curriculumId, transaction);
  }

  private async recomputeTotalCredits(curriculumId: string, transaction: Transaction) {
    const rows = await this.entries.findAll({ where: { curriculumId }, transaction });
    const groups = await this.electiveGroups.findAll({ where: { curriculumId }, transaction });
    const requiredCredits = rows
      .filter((row) => row.isRequired)
      .reduce((total, row) => total + (Number(row.credits) || 0), 0);
    const electiveCredits = groups.reduce((total, group) => total + (Number(group.minCredits) || 0), 0);
    await this.curriculums.update({ totalCredits: requiredCredits + electiveCredits } as never, { where: { id: curriculumId }, transaction });
  }

  private withTotals(curriculum: any) {
    const value = typeof curriculum.get === "function" ? curriculum.get({ plain: true }) : curriculum;
    const entries = (value.subjectEntries || []).map((entry: any) => {
      const subject = entry.subject || {};
      return {
        id: entry.id,
        subjectId: entry.subjectId,
        code: subject.codeText || subject.code || "",
        name: subject.name || "",
        credits: Number(entry.credits) || 0,
        isRequired: Boolean(entry.isRequired),
        blockId: entry.blockId,
        blockCode: (value.blocks || []).find((block: any) => block.id === entry.blockId)?.code || "",
        electiveGroupId: entry.electiveGroupId ?? null,
        electiveGroupCode: (value.electiveGroups || []).find((group: any) => group.id === entry.electiveGroupId)?.code || "",
        sortOrder: entry.sortOrder,
      };
    });
    const requiredCredits = entries.filter((entry: any) => entry.isRequired).reduce((total: number, entry: any) => total + entry.credits, 0);
    const selectedElectiveCredits = (value.electiveGroups || []).reduce((total: number, group: any) => total + (Number(group.minCredits) || 0), 0);
    return {
      id: value.id,
      code: value.code,
      name: value.name,
      majorId: value.majorId,
      major: value.major || null,
      program: value.program,
      applicableFromYear: value.applicableFromYear,
      active: value.active,
      note: value.note,
      totalCredits: value.totalCredits,
      blocks: value.blocks || [],
      electiveGroups: value.electiveGroups || [],
      classGroups: value.classGroups || [],
      subjects: entries,
      totals: { requiredCredits, selectedElectiveCredits, totalCredits: value.totalCredits },
    };
  }

  private async requireCurriculum(id: string, transaction?: Transaction) {
    const curriculum = await this.curriculums.findByPk(id, { transaction });
    if (!curriculum) throw new NotFoundException("Không tìm thấy chương trình đào tạo.");
    return curriculum;
  }

  private async requireClassGroup(id: string, transaction?: Transaction) {
    const classGroup = await this.classGroups.findByPk(id, { transaction });
    if (!classGroup) throw new NotFoundException("Không tìm thấy lớp học.");
    return classGroup;
  }

  private async requireMajor(majorId: string, program: string, transaction?: Transaction) {
    const major = await this.majors.findByPk(majorId, { transaction });
    if (!major || major.active === false) throw new BadRequestException("Chuyên ngành không tồn tại hoặc đã ngừng sử dụng.");
    if (major.program !== program) throw new BadRequestException("Chuyên ngành không phù hợp với bậc đào tạo.");
    return major;
  }
}
