import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/sequelize";
import { Sequelize } from "sequelize-typescript";
import type { Transaction } from "sequelize";
import { AdmissionRecord } from "../database/models/plan/admission-record.model.js";
import { Subject } from "../database/models/plan/subject.model.js";
import { Student } from "../database/models/student.model.js";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { ClassGroupMember } from "../database/models/training/class-group-member.model.js";
import { CourseOffering } from "../database/models/training/course-offering.model.js";
import { CourseOfferingClassGroup } from "../database/models/training/course-offering-class-group.model.js";
import { CourseExamGrade, CourseExamGradebook } from "../database/models/training/course-exam-gradebook.model.js";
import { ExamGradebookQueryDto, SaveExamGradebookDto } from "./dto/exam-gradebook.dto.js";

export const emptyExamGrade = (participantId: string): CourseExamGrade => ({
  participantId, eligible: null, examExempt: false, testScore: null, assignmentScore: null,
  examScore: null, courseScore: null, grade4: null, letterGrade: "", attemptScores: [], result: "pending",
});

@Injectable()
export class ExamGradebookService {
  constructor(
    @InjectModel(ClassGroup) private readonly groups: typeof ClassGroup,
    @InjectModel(ClassGroupMember) private readonly members: typeof ClassGroupMember,
    @InjectModel(CourseOffering) private readonly offerings: typeof CourseOffering,
    @InjectModel(CourseOfferingClassGroup) private readonly links: typeof CourseOfferingClassGroup,
    @InjectModel(CourseExamGradebook) private readonly books: typeof CourseExamGradebook,
    @InjectConnection() private readonly sequelize: Sequelize,
  ) {}

  async options() {
    const groups = await this.groups.findAll({
      where: { program: "masters" }, attributes: ["id", "code", "name", "academicYear"],
      order: [["academicYear", "DESC"], ["name", "ASC"]],
    });
    return { groups };
  }

  private async requireGroup(id: string, transaction?: Transaction) {
    const group = await this.groups.findOne({ where: { id, program: "masters" }, transaction,
      ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!group) throw new NotFoundException("Không tìm thấy lớp học viên Thạc sĩ.");
    return group;
  }

  async subjects(classGroupId: string) {
    await this.requireGroup(classGroupId);
    return this.offerings.findAll({
      attributes: ["id", "name", "subjectId", "status"],
      include: [
        { model: Subject, as: "subject", attributes: ["id", "code", "name", "credits"], where: { program: "masters" }, required: true },
        { model: CourseOfferingClassGroup, as: "groupLinks", attributes: [], where: { classGroupId }, required: true },
      ], order: [["createdAt", "DESC"]],
    });
  }

  private async scope(query: ExamGradebookQueryDto, transaction?: Transaction) {
    const group = await this.requireGroup(query.classGroupId, transaction);
    const link = await this.links.findOne({ where: { classGroupId: query.classGroupId, courseOfferingId: query.courseOfferingId }, transaction });
    if (!link) throw new BadRequestException("Học phần không thuộc lớp đã chọn.");
    const offering = await this.offerings.findByPk(query.courseOfferingId, {
      attributes: ["id", "name", "subjectId", "status"],
      include: [{ model: Subject, as: "subject", attributes: ["id", "code", "name", "credits", "program"] }], transaction,
    });
    if (!offering || offering.subject?.program !== "masters") throw new NotFoundException("Không tìm thấy học phần Thạc sĩ.");
    const members = await this.members.findAll({
      where: { classGroupId: query.classGroupId }, transaction,
      attributes: ["id", "studentId", "admissionRecordId"],
      include: [
        { model: AdmissionRecord, as: "admissionRecord", attributes: ["id", "studentId", "code", "fullName", "lastName", "firstName", "dob", "gender"] },
        { model: Student, as: "student", attributes: ["id", "regNo", "fullName"] },
      ],
    });
    const roster = new Map<string, { participantId: string; code: string; fullName: string; lastName: string; firstName: string; dob: string; gender: string }>();
    for (const member of members) {
      const record = member.admissionRecord;
      const studentId = member.studentId || record?.studentId;
      const participantId = studentId ? `student:${studentId}` : record?.id ? `admission:${record.id}` : null;
      if (!participantId || roster.has(participantId)) continue;
      roster.set(participantId, {
        participantId, code: record?.code || member.student?.regNo || "", fullName: record?.fullName || member.student?.fullName || "",
        lastName: record?.lastName || "", firstName: record?.firstName || "", dob: record?.dob || "", gender: record?.gender || "",
      });
    }
    return { group, offering, roster: [...roster.values()].sort((a, b) => (a.firstName || a.fullName.split(/\s+/).pop() || "").localeCompare(b.firstName || b.fullName.split(/\s+/).pop() || "", "vi") || a.fullName.localeCompare(b.fullName, "vi")) };
  }

  async get(query: ExamGradebookQueryDto) {
    const [{ group, offering, roster }, book] = await Promise.all([
      this.scope(query),
      this.books.findOne({ where: { classGroupId: query.classGroupId, courseOfferingId: query.courseOfferingId } }),
    ]);
    const saved = new Map((book?.grades || []).map((grade) => [grade.participantId, grade]));
    return {
      group: { id: group.id, name: group.name, code: group.code, academicYear: group.academicYear }, offering,
      revision: book?.revision || 0,
      rows: roster.map((person) => ({ ...emptyExamGrade(person.participantId), ...saved.get(person.participantId), ...person })),
    };
  }

  async save(dto: SaveExamGradebookDto) {
    await this.sequelize.transaction(async (transaction) => {
      const { roster } = await this.scope(dto, transaction);
      const allowed = new Set(roster.map((row) => row.participantId));
      const ids = new Set<string>();
      for (const row of dto.rows) {
        if (!allowed.has(row.participantId)) throw new BadRequestException("Bảng điểm chứa học viên ngoài lớp đã chọn.");
        if (ids.has(row.participantId)) throw new BadRequestException("Bảng điểm có học viên bị lặp.");
        ids.add(row.participantId);
        if (["passed", "failed"].includes(row.result) && row.courseScore == null) {
          throw new BadRequestException("Phải nhập điểm học phần trước khi chọn Đạt hoặc Không đạt.");
        }
        if (row.examExempt && row.result !== "exempt") throw new BadRequestException("Học viên được miễn thi phải có kết quả Miễn thi.");
      }
      const where = { classGroupId: dto.classGroupId, courseOfferingId: dto.courseOfferingId };
      let book = await this.books.findOne({ where, transaction, lock: transaction.LOCK.UPDATE });
      if ((book?.revision || 0) !== dto.revision) {
        throw new ConflictException("Bảng điểm đã được người khác cập nhật. Hãy tải lại trước khi lưu.");
      }
      const merged = new Map((book?.grades || []).map((row) => [row.participantId, row]));
      for (const row of dto.rows) merged.set(row.participantId, {
        ...emptyExamGrade(row.participantId), ...row, eligible: row.eligible ?? null,
        testScore: row.testScore ?? null, assignmentScore: row.assignmentScore ?? null,
        examScore: row.examScore ?? null, courseScore: row.courseScore ?? null, grade4: row.grade4 ?? null,
        letterGrade: row.letterGrade.trim(),
      });
      const payload = { ...where, grades: [...merged.values()], revision: dto.revision + 1 };
      if (book) await book.update(payload, { transaction });
      else book = await this.books.create(payload as never, { transaction });
    });
    return this.get(dto);
  }
}
