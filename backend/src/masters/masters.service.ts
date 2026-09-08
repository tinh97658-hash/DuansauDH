import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/sequelize";
import { Op } from "sequelize";
import type { Transaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { ClassGroupMember } from "../database/models/training/class-group-member.model.js";
import { AdmissionRecord } from "../database/models/plan/admission-record.model.js";
import { Student } from "../database/models/student.model.js";
import { Major } from "../database/models/common/major.model.js";
import { ClassGroupService } from "../plan/class-group.service.js";
import {
  AssignMembersDto, AutoAssignDto, CreateMastersClassGroupDto, UpdateMastersClassGroupDto,
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

  async listClassGroups(majorId?: string, academicYear?: string, term?: string, status?: string) {
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

  async createClassFromStudents(dto: import("./dto/masters-class-group.dto.js").CreateClassFromStudentsDto) {
    const id = await this.sequelize.transaction(async (transaction) => {
      const parent = await this.classGroups.findOne({
        where: { id: dto.parentGroupId, program: "masters", status: "open" },
        transaction, lock: transaction.LOCK.UPDATE,
      });
      if (!parent || parent.parentGroupId || !parent.majorId) throw new BadRequestException("Chọn Nhóm HP đang mở có ngành.");
      const ids = [...new Set(dto.admissionRecordIds)];
      if (ids.length !== dto.admissionRecordIds.length) throw new BadRequestException("Danh sách học viên rỗng hoặc trùng.");
      const records = await this.admissionRecords.findAll({
        where: this.eligibleAdmissionWhere(parent, ids) as any, transaction, lock: transaction.LOCK.UPDATE,
      });
      if (records.length !== ids.length) throw new BadRequestException("Học viên không đủ điều kiện hoặc khác ngành/khóa của nhóm.");
      const group = await this.classGroupsService.create({
        code: dto.code, name: dto.name, parentGroupId: parent.id, majorId: parent.majorId,
        program: "masters", academicYear: parent.academicYear || undefined,
        maxStudents: Math.max(40, records.length),
      }, transaction);
      const seen = new Set<string>();
      const rows = records.filter((record) => {
        const identity = record.studentId || record.id;
        if (seen.has(identity)) return false;
        seen.add(identity); return true;
      });
      await this.classGroupMembers.bulkCreate(rows.map((record) => ({
        classGroupId: group.id, admissionRecordId: record.id, studentId: record.studentId || null,
      })), { transaction });
      return group.id;
    });
    return this.getClassGroup(id);
  }

  async updateMemberNote(classGroupId: string, memberId: string, note: string) {
    await this.getClassGroup(classGroupId);
    const member = await this.classGroupMembers.findOne({ where: { id: memberId, classGroupId } });
    if (!member) throw new NotFoundException("Không tìm thấy học viên trong lớp.");
    await member.update({ note });
    return member;
  }

  async createClassGroup(dto: CreateMastersClassGroupDto) {
    const group = await this.classGroupsService.create({ ...dto, program: "masters" });
    return this.getClassGroup(group.id);
  }

  async updateClassGroup(id: string, dto: UpdateMastersClassGroupDto) {
    await this.getClassGroup(id);
    await this.classGroupsService.update(id, dto);
    return this.getClassGroup(id);
  }

  async deleteClassGroup(id: string) {
    return this.classGroupsService.remove(id);
  }

  // ===== HỌC VIÊN ĐỦ ĐIỀU KIỆN PHÂN NHÓM =====
  async batchCreateClassGroups(dto: import("./dto/masters-class-group.dto.js").BatchCreateMastersClassGroupsDto) {
    return this.sequelize.transaction(async (transaction) => {
      await this.requireMastersMajor(dto.majorId, transaction);
      const rows = Array.from({ length: dto.count }, (_, offset) => {
        const number = String(dto.startIndex + offset).padStart(2, "0");
        return {
          program: "masters",
          code: `${dto.codePrefix}${number}`,
          name: `${dto.namePrefix} ${number}`,
          majorId: dto.majorId || null,
          academicYear: dto.academicYear,
          term: dto.term,
          maxStudents: dto.maxStudents,
          status: "open",
        };
      });
      const existing = await this.classGroups.findAll({
        where: { program: "masters", code: { [Op.in]: rows.map((row) => row.code) } },
        attributes: ["code"],
        transaction,
      });
      if (existing.length > 0) throw new ConflictException(`Mã nhóm "${existing[0].code}" đã tồn tại.`);
      const created: unknown[] = [];
      for (const row of rows) {
        created.push(await this.classGroupsService.create(row, transaction));
      }
      return { success: true, count: created.length, groups: created };
    });
  }

  async listEligibleStudents(majorId?: string, academicYear?: string, term?: string) {
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

    // Lấy tất cả các thành viên của nhóm học phần thạc sĩ trong cùng năm/học kỳ
    const groupWhere: Record<string, unknown> = { program: "masters" };
    if (academicYear) groupWhere.academicYear = academicYear;

    const members = await this.classGroupMembers.findAll({
      include: [
        {
          model: ClassGroup,
          as: "classGroup",
          where: groupWhere,
          attributes: ["id", "code", "name", "majorId", "academicYear", "term", "parentGroupId"],
        },
      ],
    });

    const memberMap = new Map<string, { memberId: string; group: any }>();
    for (const m of members) {
      if (m.classGroup && !m.classGroup.parentGroupId) {
        for (const identity of [m.admissionRecordId, m.studentId].filter(Boolean)) {
          memberMap.set([identity, m.classGroup.majorId || "", m.classGroup.academicYear || ""].join(":"), {
            memberId: m.id,
            group: { id: m.classGroup.id, code: m.classGroup.code, name: m.classGroup.name },
          });
        }
      }
    }

    return records.map((r) => {
      const scopeSuffix = [r.majorId || "", r.academicYear || ""].join(":");
      const assignment = memberMap.get(r.id + ":" + scopeSuffix) || (r.studentId ? memberMap.get(r.studentId + ":" + scopeSuffix) : undefined);
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
        classes: members.filter((m) => m.admissionRecordId === r.id && m.classGroup?.parentGroupId)
          .map((m) => ({ id: m.classGroup.id, name: m.classGroup.name, code: m.classGroup.code })) ,
      };
    });
  }


  // Root admission groups compete within program + major + intake year.
  // Child teaching classes and CourseOffering snapshots are a separate scope.
  private async requireUnassignedInScope(group: ClassGroup, records: AdmissionRecord[], transaction: Transaction) {
    const studentIds = [...new Set(records.map((record) => record.studentId).filter((id): id is string => Boolean(id)))].sort();
    if (studentIds.length) {
      await this.students.findAll({
        where: { id: { [Op.in]: studentIds } }, order: [["id", "ASC"]],
        transaction, lock: transaction.LOCK.UPDATE,
      });
    }
    const scopeGroups = await this.classGroups.findAll({
      where: { program: group.program, parentGroupId: null, majorId: group.majorId || null, academicYear: group.academicYear },
      attributes: ["id", "code", "name"], transaction,
    });
    const memberships = await this.classGroupMembers.findAll({
      where: {
        classGroupId: { [Op.in]: scopeGroups.map((item) => item.id) },
        [Op.or]: [
          { admissionRecordId: { [Op.in]: records.map((record) => record.id) } },
          ...(studentIds.length ? [{ studentId: { [Op.in]: studentIds } }] : []),
        ],
      },
      transaction,
    });
    for (const record of records) {
      const membership = memberships.find((member) => member.admissionRecordId === record.id
        || (record.studentId && member.studentId === record.studentId));
      if (!membership) continue;
      const current = scopeGroups.find((item) => item.id === membership.classGroupId);
      throw new ConflictException(
        "Học viên " + (record.code || record.fullName || record.id) + " đã thuộc nhóm "
        + (current?.code || current?.name || membership.classGroupId) + " và không thể gán tiếp vào nhóm " + (group.code || group.name) + ".",
      );
    }
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
      if (group.parentGroupId) {
        const records = await this.admissionRecords.findAll({
          where: this.eligibleAdmissionWhere(group, dto.admissionRecordIds) as any,
          transaction, lock: transaction.LOCK.UPDATE,
        });
        if (records.length !== dto.admissionRecordIds.length) throw new BadRequestException("Học viên không đủ điều kiện hoặc khác ngành/khóa.");
        const members = await this.classGroupMembers.findAll({ where: { classGroupId }, transaction });
        const seen = new Set(members.map((m) => m.studentId || m.admissionRecordId));
        const rows = records.filter((r) => {
          const identity = r.studentId || r.id;
          if (seen.has(identity)) return false;
          seen.add(identity); return true;
        });
        if (members.length + rows.length > group.maxStudents) throw new BadRequestException("Lớp vượt quá sĩ số tối đa.");
        await this.classGroupMembers.bulkCreate(rows.map((r) => ({ classGroupId, admissionRecordId: r.id, studentId: r.studentId || null })), { transaction });
        return { success: true, added: rows.length };
      }
      const admissionRecordIds = dto.admissionRecordIds;
      const records = await this.admissionRecords.findAll({
        where: this.eligibleAdmissionWhere(group, admissionRecordIds) as any,
        attributes: ["id", "studentId", "code", "fullName"],
        order: [["id", "ASC"]],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (records.length !== admissionRecordIds.length) {
        throw new BadRequestException("Danh sách có học viên không đủ điều kiện, sai chuyên ngành hoặc sai khóa tuyển sinh.");
      }
      await this.requireUnassignedInScope(group, records, transaction);
      const existingCount = await this.classGroupMembers.count({ where: { classGroupId }, transaction });
      if (existingCount + records.length > group.maxStudents) {
        throw new BadRequestException(`Nhóm chỉ còn ${Math.max(0, group.maxStudents - existingCount)} chỗ trống.`);
      }
      const studentIdByRecord = new Map(records.map((record) => [record.id, record.studentId]));
      await this.classGroupMembers.bulkCreate(admissionRecordIds.map((admissionRecordId) => ({
        classGroupId,
        admissionRecordId,
        studentId: studentIdByRecord.get(admissionRecordId) || null,
        enrolledAt: new Date(),
      })), { transaction });
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

  async autoAssign(dto: AutoAssignDto) {
    return this.sequelize.transaction(async (transaction) => {
      if (dto.classGroupIds.length < 2) throw new BadRequestException("Vui lòng chọn ít nhất 2 nhóm học phần.");
      const groups = await this.classGroups.findAll({
        where: { id: { [Op.in]: dto.classGroupIds }, program: "masters", status: "open" },
        order: [["code", "ASC"]],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (groups.length !== dto.classGroupIds.length) throw new BadRequestException("Danh sách có nhóm không tồn tại hoặc đã đóng.");
      if (groups.some((group) => group.parentGroupId)) throw new BadRequestException("Không chia lại học viên giữa các lớp HP độc lập.");
      const scope = groups[0];
      const sameScope = groups.every((group) => (
        group.academicYear === scope.academicYear
        && (group.majorId || null) === (scope.majorId || null)
      ));
      if (!sameScope) throw new BadRequestException("Các nhóm chia đều phải cùng chuyên ngành và năm tuyển sinh.");
      const records = await this.admissionRecords.findAll({
        where: this.eligibleAdmissionWhere(scope, dto.admissionRecordIds) as any,
        order: [["id", "ASC"]],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (records.length !== dto.admissionRecordIds.length) {
        throw new BadRequestException("Danh sách có học viên không đủ điều kiện, sai chuyên ngành hoặc sai khóa tuyển sinh.");
      }
      await this.requireUnassignedInScope(scope, records, transaction);
      const sortedStudents = [...records];
      if ((dto.method || "alphabetical") === "alphabetical") {
        sortedStudents.sort((left, right) => {
          const leftName = (left.firstName || left.fullName || "").toLowerCase();
          const rightName = (right.firstName || right.fullName || "").toLowerCase();
          return leftName.localeCompare(rightName, "vi");
        });
      }
      const loads = new Map<string, number>();
      for (const group of groups) {
        loads.set(group.id, await this.classGroupMembers.count({ where: { classGroupId: group.id }, transaction }));
      }
      const newMemberships: Array<{ classGroupId: string; admissionRecordId: string; studentId: string | null; enrolledAt: Date }> = [];
      for (const student of sortedStudents) {
        const target = [...groups]
          .filter((group) => (loads.get(group.id) || 0) < group.maxStudents)
          .sort((left, right) => (loads.get(left.id) || 0) - (loads.get(right.id) || 0) || left.code.localeCompare(right.code))[0];
        if (!target) throw new BadRequestException("Tổng số chỗ trống của các nhóm không đủ để phân học viên.");
        newMemberships.push({ classGroupId: target.id, admissionRecordId: student.id, studentId: student.studentId || null, enrolledAt: new Date() });
        loads.set(target.id, (loads.get(target.id) || 0) + 1);
      }
      await this.classGroupMembers.bulkCreate(newMemberships, { transaction });
      return {
        success: true,
        message: `Đã phân đều ${newMemberships.length} học viên vào ${groups.length} nhóm học phần.`,
        distributed: groups.map((group) => ({
          groupId: group.id,
          groupName: group.name,
          count: newMemberships.filter((membership) => membership.classGroupId === group.id).length,
        })),
      };
    });
  }

}

