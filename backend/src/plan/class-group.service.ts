import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op } from "sequelize";
import type { Transaction } from "sequelize";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { ClassGroupMember } from "../database/models/training/class-group-member.model.js";
import { SubjectPackage } from "../database/models/plan/subject-package.model.js";
import { Major } from "../database/models/common/major.model.js";

export interface CreateClassGroupInput {
  code: string;
  name: string;
  program?: string;
  majorId?: string | null;
  academicYear?: string;
  term?: string;
  maxStudents?: number;
  status?: string;
  note?: string | null;
}

export interface UpdateClassGroupInput {
  code?: string;
  name?: string;
  program?: string;
  majorId?: string | null;
  academicYear?: string;
  term?: string;
  maxStudents?: number;
  status?: string;
  note?: string | null;
}

export interface ClassGroupFilters {
  program?: string;
  majorId?: string;
  academicYear?: string;
  term?: string;
  status?: string;
}

/**
 * Service dùng chung quản lý bảng `class_groups` (nhóm học phần).
 * Là nguồn duy nhất cho các quy tắc nghiệp vụ khi tạo/sửa/xóa nhóm:
 * - Chuyên ngành phải tồn tại, còn hoạt động và khớp bậc đào tạo (masters/doctoral).
 * - Mã nhóm duy nhất trong phạm vi bậc đào tạo.
 * - Sĩ số tối đa không được nhỏ hơn số học viên hiện có.
 * - Không xóa nhóm đang có học viên hoặc gói học phần.
 *
 * PlanService và MastersService ủy quyền thao tác CRUD nhóm về service này để
 * tránh lệch nghiệp vụ giữa hai luồng (kế hoạch đào tạo vs phân nhóm học viên).
 */
@Injectable()
export class ClassGroupService {
  constructor(
    @InjectModel(ClassGroup) private readonly classGroups: typeof ClassGroup,
    @InjectModel(ClassGroupMember) private readonly classGroupMembers: typeof ClassGroupMember,
    @InjectModel(SubjectPackage) private readonly packages: typeof SubjectPackage,
    @InjectModel(Major) private readonly majors: typeof Major,
  ) {}

  private async requireMajorForProgram(majorId: string | null | undefined, program: string, transaction?: Transaction) {
    if (!majorId) return null;
    const major = await this.majors.findByPk(majorId, { transaction });
    if (!major || major.active === false) {
      throw new BadRequestException("Chuyên ngành không tồn tại hoặc đã ngừng sử dụng.");
    }
    if (major.program !== program) {
      throw new BadRequestException("Chuyên ngành không phù hợp với bậc đào tạo của nhóm.");
    }
    return major;
  }

  private async ensureCodeUnique(code: string, program: string, excludeId?: string, transaction?: Transaction) {
    const where: Record<string, unknown> = { code, program };
    if (excludeId) where.id = { [Op.ne]: excludeId };
    const existing = await this.classGroups.findOne({ where, transaction });
    if (existing) throw new ConflictException(`Mã nhóm "${code}" đã tồn tại.`);
  }

  async findById(id: string, transaction?: Transaction) {
    const group = await this.classGroups.findByPk(id, { transaction });
    if (!group) throw new NotFoundException("Không tìm thấy nhóm học phần.");
    return group;
  }

  async list(filters: ClassGroupFilters = {}) {
    const where: Record<string, unknown> = {};
    if (filters.program) where.program = filters.program;
    if (filters.majorId) where.majorId = filters.majorId;
    if (filters.academicYear) where.academicYear = filters.academicYear;
    if (filters.term) where.term = filters.term;
    if (filters.status && filters.status !== "ALL") where.status = filters.status;
    return this.classGroups.findAll({
      where,
      order: [["academicYear", "DESC"], ["code", "ASC"]],
    });
  }

  async create(input: CreateClassGroupInput, transaction?: Transaction) {
    const program = input.program || "masters";
    await this.requireMajorForProgram(input.majorId, program, transaction);
    await this.ensureCodeUnique(input.code, program, undefined, transaction);
    return this.classGroups.create({
      program,
      code: input.code,
      name: input.name,
      majorId: input.majorId || null,
      academicYear: input.academicYear || String(new Date().getFullYear()),
      term: input.term || "HK1",
      maxStudents: input.maxStudents ?? 40,
      status: input.status || "open",
      note: input.note ?? null,
    } as any, { transaction });
  }

  async update(id: string, input: UpdateClassGroupInput, transaction?: Transaction) {
    const group = await this.classGroups.findByPk(id, { transaction });
    if (!group) throw new NotFoundException("Không tìm thấy nhóm học phần.");

    const program = input.program || group.program;
    const majorId = input.majorId !== undefined ? input.majorId : group.majorId;
    await this.requireMajorForProgram(majorId, program, transaction);

    if (input.code !== undefined && input.code !== group.code) {
      await this.ensureCodeUnique(input.code, program, id, transaction);
    }
    if (input.maxStudents !== undefined) {
      const memberCount = await this.classGroupMembers.count({ where: { classGroupId: id }, transaction });
      if (input.maxStudents < memberCount) {
        throw new BadRequestException(`Sĩ số tối đa không thể nhỏ hơn ${memberCount} học viên hiện có.`);
      }
    }

    const payload: Record<string, unknown> = {};
    for (const key of ["code", "name", "program", "majorId", "academicYear", "term", "maxStudents", "status", "note"]) {
      const value = input[key as keyof UpdateClassGroupInput];
      if (value !== undefined) payload[key] = value;
    }
    await group.update(payload as any, { transaction });
    return group;
  }

  async remove(id: string, transaction?: Transaction) {
    const group = await this.classGroups.findByPk(id, { transaction });
    if (!group) throw new NotFoundException("Không tìm thấy nhóm học phần.");
    const [memberCount, packageCount] = await Promise.all([
      this.classGroupMembers.count({ where: { classGroupId: id }, transaction }),
      this.packages.count({ where: { classGroupId: id }, transaction }),
    ]);
    if (memberCount > 0) throw new ConflictException("Không thể xóa nhóm đang có học viên.");
    if (packageCount > 0) throw new ConflictException("Không thể xóa lớp đang có gói học phần.");
    await group.destroy({ transaction });
    return { success: true, message: "Đã xóa nhóm học phần." };
  }
}
