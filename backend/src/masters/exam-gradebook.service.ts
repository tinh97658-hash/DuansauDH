import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/sequelize";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes, type Transaction } from "sequelize";
import { Subject } from "../database/models/plan/subject.model.js";
import { Major } from "../database/models/common/major.model.js";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { ClassGroupMember } from "../database/models/training/class-group-member.model.js";
import { CourseOffering } from "../database/models/training/course-offering.model.js";
import { CourseOfferingClassGroup } from "../database/models/training/course-offering-class-group.model.js";
import { CourseExamGrade, CourseExamGradebook } from "../database/models/training/course-exam-gradebook.model.js";
import { ExamGradebookQueryDto, SaveExamGradebookDto } from "./dto/exam-gradebook.dto.js";
import { calculateExamGrade, roundExamScore } from "./exam-grade-calculation.js";
import { GradingPolicyService } from "./grading-policy.service.js";
import { COMPONENT_KEYS, LEGACY_GRADING_POLICY } from "./grading-policy.js";

export const emptyExamGrade = (participantId: string): CourseExamGrade => ({
  participantId, eligible: null, examExempt: false, testScore: null, assignmentScore: null,
  examScore: null, courseScore: null, grade4: null, letterGrade: "", attemptScores: [], result: "pending", notes: "",
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
    @Optional() private readonly policies?: GradingPolicyService,
  ) {}

  async options() {
    const groups = await this.groups.findAll({
      where: { program: "masters" }, attributes: ["id", "code", "name", "academicYear", "majorId"],
      include: [{ model: Major, as: "major", attributes: ["id", "name"] }],
      order: [["academicYear", "DESC"], ["name", "ASC"]],
    });
    const courseOfferings = await this.offerings.findAll({
      attributes: ["id", "name", "subjectId", "status"],
      include: [
        { model: Subject, as: "subject", attributes: ["id", "code", "name", "credits"], where: { program: "masters" }, required: true },
        { model: CourseOfferingClassGroup, as: "groupLinks", attributes: ["classGroupId"], required: true },
      ],
      order: [["createdAt", "DESC"]],
    });
    return { groups, courseOfferings };
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
    return { group, offering };
  }

  async get(query: ExamGradebookQueryDto) {
    const { group, offering } = await this.scope(query);
    const currentPolicy = this.policies ? await this.policies.latest(offering.subjectId, group.academicYear || "") : LEGACY_GRADING_POLICY;
    const pageSize = Math.min(15, Math.max(1, query.pageSize || 15));
    const requestedPage = Math.max(1, query.page || 1);
    // Chỉ trả tối đa 15 hồ sơ. COUNT, tìm kiếm, lọc DS thi và khử trùng chạy trong PostgreSQL.
    const [result] = await this.sequelize.query<any>(`
      WITH book AS (
        SELECT revision, grades FROM course_exam_gradebooks
        WHERE class_group_id = :groupId AND course_offering_id = :offeringId
      ), identities AS (
        SELECT cm.id member_id, ar.id admission_id,
          CASE WHEN COALESCE(cm.student_id, ar.student_id) IS NOT NULL
            THEN 'student:' || COALESCE(cm.student_id, ar.student_id)::text
            WHEN ar.id IS NOT NULL THEN 'admission:' || ar.id::text END AS "participantId",
          COALESCE(NULLIF(ar.code, ''), st.reg_no, '') AS code,
          COALESCE(NULLIF(ar.full_name, ''), st.full_name, '') AS "fullName",
          COALESCE(ar.last_name, '') AS "lastName", COALESCE(ar.first_name, '') AS "firstName",
          COALESCE(ar.dob::text, '') AS dob, COALESCE(ar.gender, '') AS gender
        FROM class_group_members cm
        LEFT JOIN admission_records ar ON ar.id = cm.admission_record_id
        LEFT JOIN students st ON st.id = cm.student_id
        WHERE cm.class_group_id = :groupId
      ), people AS (
        SELECT DISTINCT ON ("participantId") "participantId", code, "fullName", "lastName", "firstName", dob, gender
        FROM identities WHERE "participantId" IS NOT NULL
        ORDER BY "participantId", admission_id NULLS LAST, member_id
      ), grade_map AS (
        SELECT value->>'participantId' participant_id, value grade
        FROM book, LATERAL jsonb_array_elements(book.grades)
      ), roster AS (
        SELECT p.*, COALESCE(g.grade, '{}'::jsonb) grade FROM people p
        LEFT JOIN grade_map g ON g.participant_id = p."participantId"
      ), filtered AS (
        SELECT * FROM roster
        WHERE (:mode <> 'exam' OR (
          ("participantId" = ANY(STRING_TO_ARRAY(:includeIds, ',')) OR grade->>'result' = 'passed')
          AND NOT ("participantId" = ANY(STRING_TO_ARRAY(:excludeIds, ',')))
        ))
          AND (:search = '' OR POSITION(LOWER(:search) IN LOWER(code || ' ' || "fullName")) > 0)
      ), metadata AS (
        SELECT (SELECT COUNT(*)::int FROM roster) AS "totalRows",
          (SELECT COUNT(*)::int FROM filtered) AS total,
          COALESCE((SELECT revision FROM book), 0) AS revision
      ), paging AS (
        SELECT *, LEAST(:page, GREATEST(1, CEIL(total::numeric / :pageSize)::int)) AS page FROM metadata
      ), selected AS (
        SELECT * FROM filtered
        ORDER BY LOWER(COALESCE(NULLIF("firstName", ''), SUBSTRING(TRIM("fullName") FROM '[^ ]+$'))), LOWER("fullName"), "participantId"
        LIMIT :pageSize OFFSET (SELECT (page - 1) * :pageSize FROM paging)
      )
      SELECT paging.*, COALESCE((SELECT jsonb_agg(to_jsonb(selected)) FROM selected), '[]'::jsonb) AS rows FROM paging
    `, { type: QueryTypes.SELECT, replacements: {
      groupId: query.classGroupId, offeringId: query.courseOfferingId,
      page: requestedPage, pageSize, mode: query.mode || "all", search: (query.search || "").trim(),
      includeIds: query.includeIds || "", excludeIds: query.excludeIds || "",
    } });
    return {
      group: { id: group.id, name: group.name, code: group.code, academicYear: group.academicYear }, offering,
      revision: result.revision, total: result.total, totalRows: result.totalRows, page: result.page, pageSize,
      rows: result.rows.map(({ grade, ...person }: any) => ({ ...emptyExamGrade(person.participantId), ...grade, ...person,
        attemptScores: grade.examScore == null ? [] : [grade.examScore],
        gradingPolicy: grade.participantId ? grade.gradingPolicy || LEGACY_GRADING_POLICY : currentPolicy,
      })),
    };
  }

  async save(dto: SaveExamGradebookDto) {
    await this.sequelize.transaction(async (transaction) => {
      const { group, offering } = await this.scope(dto, transaction);
      // Khi lưu chỉ kiểm tra danh tính các học viên vừa sửa, không tải cả lớp.
      const participants = await this.sequelize.query<{ participantId: string }>(`
        SELECT DISTINCT CASE WHEN COALESCE(cm.student_id, ar.student_id) IS NOT NULL
          THEN 'student:' || COALESCE(cm.student_id, ar.student_id)::text
          WHEN ar.id IS NOT NULL THEN 'admission:' || ar.id::text END AS "participantId"
        FROM class_group_members cm LEFT JOIN admission_records ar ON ar.id = cm.admission_record_id
        WHERE cm.class_group_id = :groupId AND
          (CASE WHEN COALESCE(cm.student_id, ar.student_id) IS NOT NULL
            THEN 'student:' || COALESCE(cm.student_id, ar.student_id)::text
            WHEN ar.id IS NOT NULL THEN 'admission:' || ar.id::text END) IN (:ids)
      `, { type: QueryTypes.SELECT, transaction, replacements: { groupId: dto.classGroupId, ids: dto.rows.map(row => row.participantId) } });
      const allowed = new Set(participants.map(row => row.participantId));
      const ids = new Set<string>();
      for (const row of dto.rows) {
        if (!allowed.has(row.participantId)) throw new BadRequestException("Bảng điểm chứa học viên ngoài lớp đã chọn.");
        if (ids.has(row.participantId)) throw new BadRequestException("Bảng điểm có học viên bị lặp.");
        ids.add(row.participantId);
      }
      const where = { classGroupId: dto.classGroupId, courseOfferingId: dto.courseOfferingId };
      let book = await this.books.findOne({ where, transaction, lock: transaction.LOCK.UPDATE });
      if ((book?.revision || 0) !== dto.revision) {
        throw new ConflictException("Bảng điểm đã được người khác cập nhật. Hãy tải lại trước khi lưu.");
      }
      const merged = new Map((book?.grades || []).map((row) => [row.participantId, row]));
      const currentPolicy = this.policies ? await this.policies.latest(offering.subjectId, group.academicYear || "", transaction) : LEGACY_GRADING_POLICY;
      for (const row of dto.rows) {
        const previous = merged.get(row.participantId);
        const gradingPolicy = previous ? previous.gradingPolicy || LEGACY_GRADING_POLICY : currentPolicy;
        if (!previous && ((row.policyVersion ?? 0) !== currentPolicy.version || (row.policyRulesVersion ?? 0) !== (currentPolicy.rulesVersion ?? 0))) throw new ConflictException("Cách tính điểm của môn đã thay đổi trong lúc nhập. Hãy tải lại cấu hình trước khi lưu; điểm vừa nhập chưa bị lưu hoặc thay đổi.");
        const scores = { testScore: roundExamScore(row.testScore), assignmentScore: roundExamScore(row.assignmentScore), examScore: roundExamScore(row.examScore) };
        const unchanged = previous && COMPONENT_KEYS.every(key => (previous[key] ?? null) === (scores[key] ?? null)) && previous.examExempt === row.examExempt;
        const calculated = unchanged ? { courseScore: previous.courseScore, grade4: previous.grade4, letterGrade: previous.letterGrade, result: previous.result }
          : calculateExamGrade({ ...row, ...scores }, gradingPolicy);
        const { policyVersion: _policyVersion, policyRulesVersion: _rulesVersion, ...values } = row;
        merged.set(row.participantId, {
          ...emptyExamGrade(row.participantId), ...values, eligible: row.eligible ?? null,
          ...scores,
          attemptScores: scores.examScore == null ? [] : [scores.examScore],
          letterGrade: row.letterGrade.trim(),
          ...calculated, gradingPolicy: structuredClone(gradingPolicy),
        });
      }
      const payload = { ...where, grades: [...merged.values()], revision: dto.revision + 1 };
      if (book) await book.update(payload, { transaction });
      else book = await this.books.create(payload as never, { transaction });
    });
    return this.get(dto);
  }
}
