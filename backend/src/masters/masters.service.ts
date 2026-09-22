import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/sequelize";
import { Op, UniqueConstraintError } from "sequelize";
import type { Transaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { ClassGroupMember } from "../database/models/training/class-group-member.model.js";
import { AdmissionRecord } from "../database/models/plan/admission-record.model.js";
import { Student } from "../database/models/student.model.js";
import { Major } from "../database/models/common/major.model.js";
import { ClassGroupService } from "../plan/class-group.service.js";
import {
  AssignMembersDto, AutoAssignDto, BatchCreateMastersClassGroupsDto, CreateMastersClassGroupDto, UpdateMastersClassGroupDto,
} from "./dto/masters-class-group.dto.js";

@Injectable()
export class MastersService {
  constructor(
    @InjectModel(ClassGroup) private readonly classGroups: typeof ClassGroup,
    @InjectModel(ClassGroupMember) private readonly classGroupMembers: typeof ClassGroupMember,
    @InjectModel(AdmissionRecord) private readonly admissionRecords: typeof AdmissionRecord,
    @InjectModel(Student) private readonly students: typeof Student,
    @InjectModel(Major) private readonly majors: typeof Major,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly classGroupsService: ClassGroupService,
  ) {}

  private stub(feature: string, label: string) {
    return { feature, label, status: "not_implemented", message: `Chức năng "${label}" chưa được triển khai.` };
  }

  bridgeCourse() { return this.stub("bridge-course", "Học bổ sung kiến thức"); }
  admissionScores() { return this.stub("admission-scores", "Điểm thi đầu vào thạc sĩ"); }
  examEligibility() { return this.stub("exam-eligibility", "Xét tư cách thi hết môn"); }
  examLists() { return this.stub("exam-lists", "Danh sách thi, điểm thi"); }
  englishExam() { return this.stub("english-exam", "Tạo đợt thi English"); }
  englishScores() { return this.stub("english-scores", "Điểm thi English"); }
  englishCertification() { return this.stub("english-certification", "Đăng ký đạt chuẩn ngoại ngữ"); }
  finalDefense() { return this.stub("final-defense", "Bảo vệ tốt nghiệp"); }
  graduationDocs() { return this.stub("graduation-docs", "Hồ sơ tốt nghiệp"); }

  // ===== NHÓM HỌC PHẦN (CLASS GROUPS) =====
  private async requireMastersMajor(majorId?: string | null, transaction?: Transaction) {
    if (!majorId) return null;
    const major = await this.majors.findByPk(majorId, { transaction });
    if (!major || major.active === false) throw new BadRequestException("Chuyên ngành không tồn tại hoặc đã ngừng sử dụng.");
    if (major.program !== "masters") throw new BadRequestException("Nhóm học phần Thạc sĩ không thể sử dụng chuyên ngành Tiến sĩ.");
    return major;
  }

  private eligibleAdmissionWhere(group: ClassGroup, ids?: string[]) {
    const where: Record<PropertyKey, unknown> = {
      trainingLevel: "Thạc sĩ",
      academicYear: group.academicYear,
      [Op.or]: [
        { status: "approved" },
        { studyStatus: { [Op.in]: ["Đủ điều kiện dự tuyển", "Đã trúng tuyển", "Đang học"] } },
      ],
    };
    if (group.majorId) where.majorId = group.majorId;
    if (ids) where.id = { [Op.in]: ids };
    return where;
  }

  async listClassGroups(majorId?: string, academicYear?: string, status?: string) {
    const where: Record<string, unknown> = { program: "masters" };
    if (majorId) where.majorId = majorId;
    if (academicYear) where.academicYear = academicYear;
    if (status && status !== "ALL") where.status = status;

    const groups = await this.classGroups.findAll({
      where,
      include: [
        { model: Major, as: "major", attributes: ["id", "code", "name"] },
        {
          model: ClassGroupMember,
          as: "members",
          include: [
            {
              model: AdmissionRecord,
              as: "admissionRecord",
              attributes: ["id", "code", "fullName", "dob", "gender", "email", "phone"],
            },
            {
              model: Student,
              as: "student",
              attributes: ["id", "regNo", "fullName", "email", "telNo"],
            },
          ],
        },
      ],
      order: [["academicYear", "DESC"], ["code", "ASC"]],
    });

    return groups.map((g) => {
      const plain = g.get({ plain: true });
      return {
        ...plain,
        memberCount: plain.members ? plain.members.length : 0,
      };
    });
  }

  async getClassGroup(id: string) {
    const group = await this.classGroups.findOne({
      where: { id, program: "masters" },
      include: [
        { model: Major, as: "major", attributes: ["id", "code", "name"] },
        {
          model: ClassGroupMember,
          as: "members",
          include: [
            {
              model: AdmissionRecord,
              as: "admissionRecord",
              attributes: ["id", "code", "fullName", "dob", "gender", "email", "phone"],
            },
            {
              model: Student,
              as: "student",
              attributes: ["id", "regNo", "fullName", "email", "telNo"],
            },
          ],
        },
      ],
    });
    if (!group) throw new NotFoundException("Không tìm thấy nhóm học phần.");
    const plain = group.get({ plain: true });
    return {
      ...plain,
      memberCount: plain.members ? plain.members.length : 0,
    };
  }

  async createClassGroup(dto: CreateMastersClassGroupDto) {
    const group = await this.classGroupsService.create({ ...dto, program: "masters" });
    return this.getClassGroup(group.id);
  }

  async updateClassGroup(id: string, dto: UpdateMastersClassGroupDto) {
    await this.classGroupsService.update(id, dto);
    return this.getClassGroup(id);
  }

  async deleteClassGroup(id: string) {
    return this.classGroupsService.remove(id);
  }

  // ===== HỌC VIÊN ĐỦ ĐIỀU KIỆN PHÂN NHÓM =====
  async batchCreateClassGroups(dto: BatchCreateMastersClassGroupsDto) {
    return this.sequelize.transaction(async (transaction) => {
      await this.requireMastersMajor(dto.majorId, transaction);
      const nameSeparator = /[.\-_]$/.test(dto.namePrefix) ? "" : " ";
      const templateTokens = dto.nameTemplate?.match(/\{n\}/g) || [];
      if (dto.nameTemplate && templateTokens.length !== 1) {
        throw new BadRequestException('Quy tắc tên nhóm phải chứa đúng một ký hiệu "{n}".');
      }
      const rows = Array.from({ length: dto.count }, (_, offset) => {
        const number = String(dto.startIndex + offset).padStart(2, "0");
        return {
          program: "masters",
          code: `${dto.codePrefix}${number}`,
          name: dto.nameTemplate
            ? dto.nameTemplate.replace("{n}", number)
            : `${dto.namePrefix}${nameSeparator}${number}`,
          majorId: dto.majorId || null,
          academicYear: dto.academicYear,
          maxStudents: dto.maxStudents,
          status: dto.status || "open",
          note: dto.note || null,
        };
      });
      if (rows.some((row) => !row.name.trim() || row.name.length > 200)) {
        throw new BadRequestException("Quy tắc tên nhóm sinh ra tên không hợp lệ.");
      }
      if (new Set(rows.map((row) => row.name)).size !== rows.length) {
        throw new BadRequestException("Quy tắc tên nhóm sinh ra các tên bị trùng nhau.");
      }
      const existing = await this.classGroups.findAll({
        where: { program: "masters", code: { [Op.in]: rows.map((row) => row.code) } },
        attributes: ["code"],
        transaction,
      });
      if (existing.length > 0) throw new ConflictException(`Mã nhóm "${existing[0].code}" đã tồn tại.`);
      const existingNames = await this.classGroups.findAll({
        where: {
          program: "masters",
          majorId: dto.majorId || null,
          academicYear: dto.academicYear,
          name: { [Op.in]: rows.map((row) => row.name) },
        },
        attributes: ["name"],
        transaction,
      });
      if (existingNames.length > 0) {
        throw new ConflictException(`Tên nhóm "${existingNames[0].name}" đã tồn tại trong chuyên ngành và khóa này.`);
      }
      const created: ClassGroup[] = [];
      for (const row of rows) {
        created.push(await this.classGroupsService.create(row, transaction));
      }
      let assignment = null;
      if (dto.autoAssign) {
        if (!dto.admissionRecordIds?.length) {
          throw new BadRequestException("Không có học viên chưa phân nhóm để thực hiện phân tự động.");
        }
        assignment = await this.autoAssignInTransaction({
          classGroupIds: created.map((group) => group.id),
          admissionRecordIds: dto.admissionRecordIds,
          method: dto.assignmentMethod || "balanced",
          targetCounts: dto.targetCounts,
        }, transaction);
      }
      return { success: true, count: created.length, groups: created, assignment };
    });
  }

  async listEligibleStudents(majorId?: string, academicYear?: string) {
    const where: Record<string, unknown> = {
      trainingLevel: "Thạc sĩ",
      [Op.or]: [
        { status: "approved" },
        { studyStatus: { [Op.in]: ["Đủ điều kiện dự tuyển", "Đã trúng tuyển", "Đang học"] } },
      ],
    };
    if (majorId) where.majorId = majorId;
    if (academicYear) where.academicYear = academicYear;

    const records = await this.admissionRecords.findAll({
      where,
      include: [{ model: Major, as: "major", attributes: ["id", "code", "name"] }],
      order: [["lastName", "ASC"], ["firstName", "ASC"], ["fullName", "ASC"]],
    });

    // Một học viên chỉ thuộc một nhóm học phần Thạc sĩ, không phụ thuộc bộ lọc đang xem.
    const groupWhere: Record<string, unknown> = { program: "masters" };

    const members = await this.classGroupMembers.findAll({
      include: [
        {
          model: ClassGroup,
          as: "classGroup",
          where: groupWhere,
          attributes: ["id", "code", "name", "academicYear"],
        },
      ],
    });

    const memberMap = new Map<string, { memberId: string; group: any }>();
    const studentMemberMap = new Map<string, { memberId: string; group: any }>();
    for (const m of members) {
      const assignment = {
        memberId: m.id,
        group: m.classGroup ? { id: m.classGroup.id, code: m.classGroup.code, name: m.classGroup.name } : null,
      };
      if (m.admissionRecordId) {
        memberMap.set(m.admissionRecordId, assignment);
      }
      if (m.studentId) studentMemberMap.set(m.studentId, assignment);
    }

    return records.map((r) => {
      const assignment = memberMap.get(r.id) || (r.studentId ? studentMemberMap.get(r.studentId) : undefined);
      return {
        id: r.id,
        code: r.code || "",
        fullName: r.fullName,
        lastName: r.lastName,
        firstName: r.firstName,
        dob: r.dob,
        gender: r.gender || "Nam",
        email: r.email,
        phone: r.phone,
        majorId: r.majorId,
        majorName: r.major?.name || r.majorName,
        academicYear: r.academicYear,
        status: r.status,
        assignedGroup: assignment ? assignment.group : null,
        memberId: assignment ? assignment.memberId : null,
      };
    });
  }

  // ===== PHÂN NHÓM HỌC VIÊN =====
  async assignMembers(classGroupId: string, dto: AssignMembersDto) {
    return this.sequelize.transaction(async (transaction) => {
      const group = await this.classGroups.findOne({
        where: { id: classGroupId, program: "masters", status: "open" },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!group) throw new NotFoundException("Không tìm thấy nhóm học phần đang mở.");
      const admissionRecordIds = dto.admissionRecordIds;
      const records = await this.admissionRecords.findAll({
        where: this.eligibleAdmissionWhere(group, admissionRecordIds) as any,
        attributes: ["id", "studentId"],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (records.length !== admissionRecordIds.length) {
        throw new BadRequestException("Danh sách có học viên không đủ điều kiện, sai chuyên ngành hoặc sai khóa tuyển sinh.");
      }
      const studentIds = records.map((record) => record.studentId).filter(Boolean) as string[];
      const existingMemberships = await this.classGroupMembers.findAll({
        where: {
          [Op.or]: [
            { admissionRecordId: { [Op.in]: admissionRecordIds } },
            ...(studentIds.length > 0 ? [{ studentId: { [Op.in]: studentIds } }] : []),
          ],
        },
        include: [{
          model: ClassGroup,
          as: "classGroup",
          where: { program: "masters" },
          attributes: ["id", "code", "name"],
        }],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (existingMemberships.length > 0) {
        const existing = existingMemberships[0];
        const assignedGroup = existing.classGroup;
        throw new ConflictException(
          `Học viên đã được phân vào lớp "${assignedGroup?.name || assignedGroup?.code || existing.classGroupId}". `
          + "Không thể phân học viên này vào lớp khác; hãy xóa khỏi lớp hiện tại trước.",
        );
      }
      const existingCount = await this.classGroupMembers.count({ where: { classGroupId }, transaction });
      if (existingCount + records.length > group.maxStudents) {
        throw new BadRequestException(`Nhóm chỉ còn ${Math.max(0, group.maxStudents - existingCount)} chỗ trống.`);
      }
      const studentIdByRecord = new Map(records.map((record) => [record.id, record.studentId]));
      try {
        await this.classGroupMembers.bulkCreate(admissionRecordIds.map((admissionRecordId) => ({
          classGroupId,
          admissionRecordId,
          studentId: studentIdByRecord.get(admissionRecordId) || null,
          enrolledAt: new Date(),
        })), { transaction });
      } catch (error) {
        if (error instanceof UniqueConstraintError) {
          throw new ConflictException("Có học viên vừa được phân vào lớp khác. Vui lòng tải lại danh sách.");
        }
        throw error;
      }
      return { success: true, message: `Đã phân ${records.length} học viên vào nhóm "${group.name}".`, count: records.length };
    });
  }

  async removeMember(classGroupId: string, memberId: string) {
    const member = await this.classGroupMembers.findOne({
      where: { id: memberId, classGroupId },
    });
    if (!member) throw new NotFoundException("Không tìm thấy học viên trong nhóm.");
    await member.destroy();
    return { success: true, message: "Đã xóa học viên khỏi nhóm học phần." };
  }

  private sortAdmissionRecords(records: AdmissionRecord[]) {
    const compare = (left: unknown, right: unknown) => String(left || "").localeCompare(
      String(right || ""),
      "vi",
      { sensitivity: "base" },
    );
    const givenName = (record: AdmissionRecord) => (
      record.firstName || String(record.fullName || "").trim().split(/\s+/).pop() || ""
    );
    return [...records].sort((left, right) => (
      compare(givenName(left), givenName(right))
      || compare(left.lastName, right.lastName)
      || compare(left.fullName, right.fullName)
      || compare(left.code, right.code)
      || compare(left.id, right.id)
    ));
  }

  private buildBlockCounts(
    groups: ClassGroup[],
    loads: Map<string, number>,
    studentCount: number,
    method: "balanced" | "fill_first" | "custom",
    targetCounts?: number[],
  ) {
    const available = groups.map((group) => Math.max(0, group.maxStudents - (loads.get(group.id) || 0)));
    if (available.reduce((sum, count) => sum + count, 0) < studentCount) {
      throw new BadRequestException("Tổng số chỗ trống của các nhóm không đủ để phân học viên.");
    }

    if (method === "custom") {
      if (!targetCounts || targetCounts.length !== groups.length) {
        throw new BadRequestException("Sĩ số tùy chỉnh phải tương ứng với đầy đủ các nhóm.");
      }
      if (targetCounts.reduce((sum, count) => sum + count, 0) !== studentCount) {
        throw new BadRequestException("Tổng sĩ số tùy chỉnh phải bằng số học viên cần phân.");
      }
      const overCapacityIndex = targetCounts.findIndex((count, index) => count > available[index]);
      if (overCapacityIndex >= 0) {
        throw new BadRequestException(`Nhóm "${groups[overCapacityIndex].name}" vượt sĩ số tối đa.`);
      }
      return [...targetCounts];
    }

    const counts = groups.map(() => 0);
    if (method === "fill_first") {
      let remaining = studentCount;
      for (let index = 0; index < groups.length && remaining > 0; index += 1) {
        counts[index] = Math.min(available[index], remaining);
        remaining -= counts[index];
      }
      return counts;
    }

    for (let assigned = 0; assigned < studentCount; assigned += 1) {
      const targetIndex = groups
        .map((group, index) => ({ group, index, load: (loads.get(group.id) || 0) + counts[index] }))
        .filter(({ index }) => counts[index] < available[index])
        .sort((left, right) => left.load - right.load || left.group.code.localeCompare(right.group.code))[0]?.index;
      if (targetIndex === undefined) {
        throw new BadRequestException("Tổng số chỗ trống của các nhóm không đủ để phân học viên.");
      }
      counts[targetIndex] += 1;
    }
    return counts;
  }

  private async autoAssignInTransaction(dto: AutoAssignDto, transaction: Transaction) {
    if (dto.classGroupIds.length < 2) throw new BadRequestException("Vui lòng chọn ít nhất 2 nhóm học phần.");
    const groups = await this.classGroups.findAll({
      where: { id: { [Op.in]: dto.classGroupIds }, program: "masters", status: "open" },
      order: [["code", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (groups.length !== dto.classGroupIds.length) throw new BadRequestException("Danh sách có nhóm không tồn tại hoặc đã đóng.");
    const scope = groups[0];
    const sameScope = groups.every((group) => (
      group.academicYear === scope.academicYear
      && (group.majorId || null) === (scope.majorId || null)
    ));
    if (!sameScope) throw new BadRequestException("Các nhóm phải cùng chuyên ngành và năm tuyển sinh.");
    const records = await this.admissionRecords.findAll({
      where: this.eligibleAdmissionWhere(scope, dto.admissionRecordIds) as any,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (records.length !== dto.admissionRecordIds.length) {
      throw new BadRequestException("Danh sách có học viên không đủ điều kiện, sai chuyên ngành hoặc sai khóa tuyển sinh.");
    }
    const studentIds = records.map((record) => record.studentId).filter(Boolean) as string[];
    const existingMemberships = await this.classGroupMembers.findAll({
      where: {
        [Op.or]: [
          { admissionRecordId: { [Op.in]: dto.admissionRecordIds } },
          ...(studentIds.length > 0 ? [{ studentId: { [Op.in]: studentIds } }] : []),
        ],
      },
      include: [{
        model: ClassGroup,
        as: "classGroup",
        where: { program: "masters" },
        attributes: ["id", "code", "name"],
      }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existingMemberships.length > 0) {
      const existing = existingMemberships[0];
      const assignedGroup = existing.classGroup;
      throw new ConflictException(
        `Học viên đã được phân vào lớp "${assignedGroup?.name || assignedGroup?.code || existing.classGroupId}". `
        + "Chỉ học viên chưa có lớp mới được đưa vào chia tự động.",
      );
    }

    const method = dto.method || "alphabetical";
    const sortedStudents = method === "round_robin" ? [...records] : this.sortAdmissionRecords(records);
    const loads = new Map<string, number>();
    for (const group of groups) {
      loads.set(group.id, await this.classGroupMembers.count({ where: { classGroupId: group.id }, transaction }));
    }
    const newMemberships: Array<{ classGroupId: string; admissionRecordId: string; studentId: string | null; enrolledAt: Date }> = [];

    if (method === "round_robin") {
      for (const student of sortedStudents) {
        const target = [...groups]
          .filter((group) => (loads.get(group.id) || 0) < group.maxStudents)
          .sort((left, right) => (loads.get(left.id) || 0) - (loads.get(right.id) || 0) || left.code.localeCompare(right.code))[0];
        if (!target) throw new BadRequestException("Tổng số chỗ trống của các nhóm không đủ để phân học viên.");
        newMemberships.push({ classGroupId: target.id, admissionRecordId: student.id, studentId: student.studentId || null, enrolledAt: new Date() });
        loads.set(target.id, (loads.get(target.id) || 0) + 1);
      }
    } else {
      const blockMethod = method === "fill_first" || method === "custom" ? method : "balanced";
      const counts = this.buildBlockCounts(groups, loads, sortedStudents.length, blockMethod, dto.targetCounts);
      let cursor = 0;
      groups.forEach((group, index) => {
        sortedStudents.slice(cursor, cursor + counts[index]).forEach((student) => {
          newMemberships.push({ classGroupId: group.id, admissionRecordId: student.id, studentId: student.studentId || null, enrolledAt: new Date() });
        });
        cursor += counts[index];
      });
    }

    try {
      await this.classGroupMembers.bulkCreate(newMemberships, { transaction });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new ConflictException("Có học viên vừa được phân vào lớp khác. Vui lòng tải lại danh sách.");
      }
      throw error;
    }
    return {
      success: true,
      message: `Đã phân ${newMemberships.length} học viên vào ${groups.length} nhóm học phần.`,
      distributed: groups.map((group) => ({
        groupId: group.id,
        groupName: group.name,
        count: newMemberships.filter((membership) => membership.classGroupId === group.id).length,
      })),
    };
  }

  async autoAssign(dto: AutoAssignDto) {
    return this.sequelize.transaction((transaction) => this.autoAssignInTransaction(dto, transaction));
  }

}

