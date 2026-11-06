import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op } from "sequelize";
import { assertClassScopeEditable, assertCurriculumEditable, assertCurriculumSubjectsEditable, curriculumSubjectsInUse, lockTrainingStructure, usedCurriculumSubjectIds } from "./training-structure-integrity.js";
import { sortCurriculumSubjectsByVietnameseName } from "./curriculum-subject-order.js";
import { SUBJECT_KNOWLEDGE_GROUPS } from './subject-knowledge-groups.js';
import type { Transaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { Major } from "../database/models/common/major.model.js";
import { Subject } from "../database/models/plan/subject.model.js";
import { Curriculum } from "../database/models/plan/curriculum.model.js";
import { CurriculumBlock } from "../database/models/plan/curriculum-block.model.js";
import { CurriculumSubject } from "../database/models/plan/curriculum-subject.model.js";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import {
  CreateCurriculumDto,
  CurriculumSubjectEntryDto,
  SetCurriculumSubjectsDto,
  UpdateCurriculumDto,
} from "./dto/plan.dto.js";

/** Khối kiến thức mặc định của mọi CTĐT (khớp `subjects.subject_type`). */
const DEFAULT_BLOCKS = SUBJECT_KNOWLEDGE_GROUPS;
const BLOCK_CODES = new Set<string>(DEFAULT_BLOCKS.map((block) => block.code));
const SUBJECT_INCLUDE = { model: Subject, as: "subject" } as const;

/**
 * Nghiệp vụ chương trình đào tạo (CTĐT).
 *
 * - Mỗi **ngành + bậc + khóa** có thể có nhiều CTĐT hoàn chỉnh (`curriculums`).
 * - CTĐT gồm khối kiến thức và danh sách học phần, mỗi môn có nhãn bắt buộc/tự chọn.
 * - Mỗi lớp chọn đúng một CTĐT và học toàn bộ danh sách môn của CTĐT đó.
 *   Nếu phạm vi ngành + bậc + khóa có nhiều CTĐT thì lớp **buộc** phải chọn (`curriculumId`).
 * - `findForClassGroup` (chỉ đọc) và `assignToClassGroup` (ghi, tự tạo khi chưa có) là hai
 *   đường vào CTĐT của lớp; cả hai đều đối chiếu ngành + bậc + khóa của lớp.
 */
@Injectable()
export class CurriculumService {
  constructor(
    @InjectModel(Curriculum) private readonly curriculums: typeof Curriculum,
    @InjectModel(CurriculumBlock) private readonly blocks: typeof CurriculumBlock,
    @InjectModel(CurriculumSubject) private readonly entries: typeof CurriculumSubject,
    @InjectModel(ClassGroup) private readonly classGroups: typeof ClassGroup,
    @InjectModel(Subject) private readonly subjects: typeof Subject,
    @InjectModel(Major) private readonly majors: typeof Major,
    private readonly sequelize: Sequelize,
  ) {}

  private static readonly DETAIL_INCLUDE = [
    { model: CurriculumBlock, as: "blocks" },
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
        { model: Major, as: "major", attributes: ["id", "name"] },
        { model: CurriculumSubject, as: "subjectEntries", attributes: ["id", "isRequired", "credits", "electiveGroupId"], include: [SUBJECT_INCLUDE] },
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
        totalCredits: (plain.subjectEntries || []).reduce((total: number, entry: any) => total + (Number(entry.subject?.credits ?? entry.credits) || 0), 0),
        classGroups: classesByCurriculum.get(item.id) || [],
      };
    });
  }

  async detail(id: string, transaction?: Transaction) {
    const curriculum = await this.curriculums.findByPk(id, {
      include: CurriculumService.DETAIL_INCLUDE as never,
      order: [
        [{ model: CurriculumBlock, as: "blocks" }, "sortOrder", "ASC"],
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
    const usedIds = await usedCurriculumSubjectIds(this.sequelize, id, transaction);
    return {
      ...result,
      subjects: result.subjects.map(entry => ({ ...entry, requirementEditable: !usedIds.has(entry.id) })),
      subjectsEditable: !(await curriculumSubjectsInUse(this.sequelize, id, transaction)),
      classGroups: classGroups.map((c) => ({ id: c.id, code: c.code, name: c.name, academicYear: c.academicYear })),
    };
  }

  /** Mỗi lớp học toàn bộ danh sách môn của CTĐT đã gắn; loại môn là thông tin của CTĐT. */
  async classSubjects(classGroupId: string) {
    return this.sequelize.transaction(async transaction => {
      await lockTrainingStructure(this.sequelize, transaction);
      const classGroup = await this.requireClassGroup(classGroupId, transaction);
      const curriculum = await this.findForClassGroup(classGroup, transaction);
      const classInfo = { id: classGroup.id, code: classGroup.code, name: classGroup.name, academicYear: classGroup.academicYear };
      if (!curriculum) return { classGroup: classInfo, curriculum: null, blocks: [], electiveGroups: [], subjects: [], selectedElectiveIds: [],
        totals: { requiredCredits: 0, selectedElectiveCredits: 0, totalCredits: 0 } };
      const blocks = await this.blocks.findAll({ where: { curriculumId: curriculum.id }, order: [["sortOrder", "ASC"]], transaction });
      const rows = await this.entries.findAll({ where: { curriculumId: curriculum.id }, include: [SUBJECT_INCLUDE], transaction });
      const subjectRows = sortCurriculumSubjectsByVietnameseName(rows, (row: any) => row.subject || { id: row.subjectId }).map((row: any) => {
        const plain = typeof row.get === "function" ? row.get({ plain: true }) : row;
        const block = blocks.find(item => item.id === plain.blockId);
        return { id: plain.id, subjectId: plain.subjectId, code: plain.subject?.codeText || plain.subject?.code || "",
          codeNumber: plain.subject?.codeNumber ?? 0, name: plain.subject?.name || "",
          credits: Number(plain.subject?.credits ?? plain.credits) || 0, isRequired: plain.isRequired !== false,
          active: plain.subject?.active !== false, blockId: plain.blockId,
          blockCode: plain.subject?.subjectType || block?.code || "", blockName: block?.name || "",
          electiveGroupId: null, electiveGroupCode: "", electiveGroupName: "", selected: true };
      });
      const requiredCredits = subjectRows.filter(row => row.isRequired).reduce((sum, row) => sum + row.credits, 0);
      const selectedElectiveCredits = subjectRows.filter(row => !row.isRequired).reduce((sum, row) => sum + row.credits, 0);
      return { classGroup: classInfo, curriculum: { id: curriculum.id, code: curriculum.code, name: curriculum.name, totalCredits: requiredCredits + selectedElectiveCredits },
        blocks: blocks.map(block => ({ id: block.id, code: block.code, name: block.name, minCredits: 0,
          requiredCredits: subjectRows.filter(row => row.blockId === block.id && row.isRequired).reduce((sum, row) => sum + row.credits, 0),
          electiveCredits: subjectRows.filter(row => row.blockId === block.id && !row.isRequired).reduce((sum, row) => sum + row.credits, 0) })),
        electiveGroups: [], subjects: subjectRows, selectedElectiveIds: subjectRows.filter(row => !row.isRequired).map(row => row.id),
        totals: { requiredCredits, selectedElectiveCredits, totalCredits: requiredCredits + selectedElectiveCredits } };
    });
  }

  // ===== Ghi =====

  async create(dto: CreateCurriculumDto) {
    return this.sequelize.transaction(async (transaction) => {
      const program = dto.program || "masters";
      await this.requireMajor(dto.majorId, program, transaction);
      const applicableFromYear = (dto.applicableFromYear || "").trim();
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
      const entries = Array.isArray(dto.subjects)
        ? dto.subjects
        : await this.catalogEntries(dto.majorId, program, transaction);
      await this.replaceSubjects(curriculum.id, entries, blocks, transaction);

      return this.detail(curriculum.id, transaction);
    });
  }

  async update(id: string, dto: UpdateCurriculumDto) {
    return this.sequelize.transaction(async (transaction) => {
      await lockTrainingStructure(this.sequelize, transaction);
      const curriculum = await this.requireCurriculum(id, transaction);
      if (["majorId", "program", "applicableFromYear", "totalCredits"].some(key =>
        dto[key] !== undefined && dto[key] !== curriculum[key])) {
        await assertCurriculumEditable(this.sequelize, id, transaction);
      }
      const program = dto.program || curriculum.program;
      const majorId = dto.majorId || curriculum.majorId;
      await this.requireMajor(majorId, program, transaction);

      const scopeChanged = majorId !== curriculum.majorId || program !== curriculum.program;
      if (scopeChanged || dto.totalCredits !== undefined) {
        const entries = await this.entries.findAll({ where: { curriculumId: id }, include: [SUBJECT_INCLUDE], transaction });
        if (scopeChanged && entries.some(entry => !entry.subject || entry.subject.majorId !== majorId || entry.subject.program !== program)) {
          throw new BadRequestException("Không thể đổi ngành hoặc bậc đào tạo khi danh sách học phần không thuộc phạm vi mới. Hãy lập CTĐT khác hoặc làm trống CTĐT chưa sử dụng trước.");
        }
        const actualCredits = entries.reduce((total, entry) => total + (Number(entry.subject?.credits ?? entry.credits) || 0), 0);
        if (dto.totalCredits !== undefined && dto.totalCredits !== actualCredits) {
          throw new BadRequestException(`Tổng tín chỉ được tính từ danh sách học phần (${actualCredits} TC), không thể đặt thành ${dto.totalCredits} TC.`);
        }
      }

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
      await lockTrainingStructure(this.sequelize, transaction);
      const curriculum = await this.requireCurriculum(id, transaction);
      const linkedClasses = await this.classGroups.count({ where: { curriculumId: id }, transaction });
      if (linkedClasses > 0) {
        throw new ConflictException(`Không thể xóa: còn ${linkedClasses} lớp đang dùng chương trình đào tạo này.`);
      }
      await assertCurriculumEditable(this.sequelize, id, transaction);
      await curriculum.destroy({ transaction });
      return { success: true, message: "Đã xóa chương trình đào tạo." };
    });
  }

  async setSubjects(id: string, dto: SetCurriculumSubjectsDto) {
    return this.sequelize.transaction(async (transaction) => {
      await this.sequelize.query("SELECT pg_advisory_xact_lock(21026)", { transaction });
      await lockTrainingStructure(this.sequelize, transaction);
      const curriculum = await this.requireCurriculum(id, transaction);
      await assertCurriculumSubjectsEditable(this.sequelize, id, transaction);
      const blocks = await this.blocks.findAll({ where: { curriculumId: id }, transaction });
      if (!blocks.length) throw new BadRequestException("Chương trình đào tạo chưa có khối kiến thức.");
      await this.replaceSubjects(id, dto.subjects, new Map(blocks.map(block => [block.code, block])), transaction);
      return this.detail(id, transaction);
    });
  }

  /** Only unused subjects can change type, preserving the applied curriculum's history. */
  async setSubjectRequirement(curriculumId: string, entryId: string, isRequired: boolean) {
    return this.sequelize.transaction(async transaction => {
      await this.sequelize.query("SELECT pg_advisory_xact_lock(21026)", { transaction });
      await lockTrainingStructure(this.sequelize, transaction);
      await this.requireCurriculum(curriculumId, transaction);
      const rows = await this.entries.findAll({ where: { curriculumId }, transaction });
      const entry = rows.find(row => row.id === entryId);
      if (!entry) throw new NotFoundException("Học phần không thuộc CTĐT này.");
      if (entry.isRequired !== isRequired) {
        const usedIds = await usedCurriculumSubjectIds(this.sequelize, curriculumId, transaction);
        if (usedIds.has(entry.id)) throw new ConflictException({ code: "CURRICULUM_SUBJECT_IN_USE",
          message: "Học phần đã mở lớp hoặc có dữ liệu học tập nên không thể đổi Bắt buộc / Tự chọn. Hãy cấu hình khác trong CTĐT mới." });
        await entry.update({ isRequired }, { transaction });
      }
      return this.detail(curriculumId, transaction);
    });
  }

  /**
   * Tìm CTĐT của lớp theo ngành + bậc + khóa và tự gắn lại `curriculum_id` nếu lớp
   * chưa có khoá (dữ liệu cũ). **Không tạo mới** — dùng `ensureForClass` khi cần tạo.
   */
  private async findForClassGroup(classGroup: ClassGroup, transaction?: Transaction): Promise<Curriculum | null> {
    if (!classGroup.majorId) return null;
    const selected = classGroup.curriculumId
      ? await this.curriculums.findByPk(classGroup.curriculumId, { transaction })
      : null;
    const applicableFromYear = (classGroup.academicYear || "").trim();
    if (selected
      && selected.majorId === classGroup.majorId
      && selected.program === classGroup.program
      && selected.applicableFromYear === applicableFromYear) {
      return selected;
    }
    const matches = await this.curriculums.findAll({
      where: { majorId: classGroup.majorId, program: classGroup.program, applicableFromYear },
      transaction,
    });
    if (matches.length !== 1) return null;
    if (classGroup.curriculumId !== matches[0].id) {
      await lockTrainingStructure(this.sequelize, transaction);
      await assertClassScopeEditable(this.sequelize, classGroup.id, transaction);
      await classGroup.update({ curriculumId: matches[0].id } as never, { transaction });
    }
    return matches[0];
  }

  /** Gắn (và tạo nếu chưa có) CTĐT của ngành + khóa cho một lớp. */
  async assignToClassGroup(classGroup: ClassGroup, transaction?: Transaction, requestedCurriculumId?: string): Promise<Curriculum> {
    await lockTrainingStructure(this.sequelize, transaction);
    if (!classGroup.majorId) {
      throw new BadRequestException("Lớp học phải được gắn chuyên ngành trước khi xác định chương trình đào tạo.");
    }
    const applicableFromYear = (classGroup.academicYear || "").trim();
    let curriculum: Curriculum | null = null;
    if (requestedCurriculumId) {
      curriculum = await this.curriculums.findByPk(requestedCurriculumId, { transaction });
      if (!curriculum || curriculum.active === false) {
        throw new BadRequestException("Chương trình đào tạo đã chọn không tồn tại hoặc đã ngừng sử dụng.");
      }
      if (curriculum.majorId !== classGroup.majorId
        || curriculum.program !== classGroup.program
        || curriculum.applicableFromYear !== applicableFromYear) {
        throw new BadRequestException("Chương trình đào tạo không thuộc đúng chuyên ngành, bậc và khóa của lớp.");
      }
    } else if (classGroup.curriculumId) {
      const current = await this.curriculums.findByPk(classGroup.curriculumId, { transaction });
      if (current
        && current.majorId === classGroup.majorId
        && current.program === classGroup.program
        && current.applicableFromYear === applicableFromYear) curriculum = current;
    }
    if (!curriculum) {
      const matches = await this.curriculums.findAll({
        where: { majorId: classGroup.majorId, program: classGroup.program, applicableFromYear, active: true },
        transaction,
      });
      if (matches.length > 1) {
        throw new BadRequestException("Có nhiều chương trình đào tạo cho chuyên ngành và khóa này. Vui lòng chọn CTĐT cho lớp.");
      }
      curriculum = matches[0] || await this.autoCreate(classGroup.majorId, classGroup.program, applicableFromYear, transaction);
    }
    if (classGroup.curriculumId !== curriculum.id) {
      await assertClassScopeEditable(this.sequelize, classGroup.id, transaction);
      await classGroup.update({ curriculumId: curriculum.id } as never, { transaction });
    }
    return curriculum;
  }

  async ensureForClass(classGroupId: string) {
    return this.sequelize.transaction(async (transaction) => {
      await lockTrainingStructure(this.sequelize, transaction);
      const classGroup = await this.requireClassGroup(classGroupId, transaction);
      const curriculum = await this.assignToClassGroup(classGroup, transaction);
      return this.detail(curriculum.id, transaction);
    });
  }

  // ===== Nội bộ =====

  private async autoCreate(majorId: string, program: string, applicableFromYear: string, transaction: Transaction) {
    const major = await this.requireMajor(majorId, program, transaction);
    const yearLabel = applicableFromYear || "chưa xác định";
    let code = `CT-${applicableFromYear || "NA"}`;
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
    await this.replaceSubjects(curriculum.id, entries, blocks, transaction);
    return curriculum;
  }

  private async catalogEntries(majorId: string, program: string, transaction: Transaction): Promise<CurriculumSubjectEntryDto[]> {
    const subjects = await this.subjects.findAll({
      where: {
        program,
        active: true,
        majorId,
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

  private async replaceSubjects(
    curriculumId: string,
    entries: CurriculumSubjectEntryDto[],
    blocks: Map<string, CurriculumBlock>,
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

    const curriculum = await this.curriculums.findByPk(curriculumId, { transaction });
    if (!curriculum) throw new NotFoundException("Không tìm thấy chương trình đào tạo.");
    const outsideMajor = subjectIds.filter((subjectId) => {
      const subject = subjectById.get(subjectId)!;
      return subject.majorId !== curriculum.majorId || subject.program !== curriculum.program;
    });
    if (outsideMajor.length > 0) {
      throw new BadRequestException("Mỗi học phần trong chương trình đào tạo phải có mã riêng thuộc đúng chuyên ngành và bậc đào tạo.");
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
      const blockCode = String(subject.subjectType || entry.blockCode || "").trim().toUpperCase();
      const block = (blockCode ? blocks.get(blockCode) : undefined) || fallbackBlock;
      if (!block) throw new BadRequestException("Chương trình đào tạo chưa có khối kiến thức phù hợp.");
      const isRequired = entry.isRequired ?? currentBySubjectId.get(entry.subjectId)?.isRequired ?? subject.isRequired ?? true;
      return {
        curriculumId,
        blockId: block.id,
        electiveGroupId: null,
        subjectId: entry.subjectId,
        isRequired,
        credits: Number(subject.credits) || 0,
        sortOrder: entry.sortOrder ?? index + 1,
      };
    });

    // Keep stable entry ids so grades and history remain attached to the same course.
    const incomingSubjectIds = new Set(payload.map((row) => row.subjectId));

    const removed = current.filter((row) => !incomingSubjectIds.has(row.subjectId));
    if (removed.length > 0) {
      // Xoá dòng học phần cũng tự gỡ lựa chọn tự chọn của lớp (khoá ngoại cascade).
      await this.entries.destroy({ where: { id: { [Op.in]: removed.map((row) => row.id) } }, transaction });
    }

    for (const row of payload) {
      const existing = currentBySubjectId.get(row.subjectId);
      if (!existing) {
        await this.entries.create(row as never, { transaction });
        continue;
      }
      await existing.update(row as never, { transaction });
    }

    await this.recomputeTotalCredits(curriculumId, transaction);
  }

  private async recomputeTotalCredits(curriculumId: string, transaction: Transaction) {
    const rows = await this.entries.findAll({ where: { curriculumId }, include: [SUBJECT_INCLUDE], transaction });
    const totalCredits = rows.reduce((total, row) => total + (Number(row.subject?.credits ?? row.credits) || 0), 0);
    await this.curriculums.update({ totalCredits } as never, { where: { id: curriculumId }, transaction });
  }

  private withTotals(curriculum: any) {
    const value = typeof curriculum.get === "function" ? curriculum.get({ plain: true }) : curriculum;
    const entries = sortCurriculumSubjectsByVietnameseName(value.subjectEntries || [],
      (entry: any) => entry.subject || { id: entry.subjectId }).map((entry: any) => {
      const subject = entry.subject || {};
      return {
        id: entry.id,
        subjectId: entry.subjectId,
        code: subject.codeText || subject.code || "",
        name: subject.name || "",
        credits: Number(subject.credits ?? entry.credits) || 0,
        isRequired: Boolean(entry.isRequired ?? subject.isRequired ?? true),
        active: subject.active !== false,
        majorAssignment: Boolean(subject.majorAssignment),
        blockId: entry.blockId,
        blockCode: subject.subjectType || (value.blocks || []).find((block: any) => block.id === entry.blockId)?.code || "",
        electiveGroupId: null,
        electiveGroupCode: "",
        sortOrder: entry.sortOrder,
      };
    });
    const requiredCredits = entries.filter((entry: any) => entry.isRequired).reduce((total: number, entry: any) => total + entry.credits, 0);
    const selectedElectiveCredits = entries.filter((entry: any) => !entry.isRequired).reduce((total: number, entry: any) => total + entry.credits, 0);
    const totalCredits = requiredCredits + selectedElectiveCredits;
    const availableCredits = entries.reduce((total: number, entry: any) => total + entry.credits, 0);
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
      totalCredits,
      availableCredits,
      blocks: value.blocks || [],
      electiveGroups: [],
      classGroups: value.classGroups || [],
      subjects: entries,
      totals: { requiredCredits, selectedElectiveCredits, totalCredits },
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
