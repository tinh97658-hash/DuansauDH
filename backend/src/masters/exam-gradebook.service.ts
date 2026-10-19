import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/sequelize";
import { Sequelize } from "sequelize-typescript";
import { Op, QueryTypes, type Transaction } from "sequelize";
import { Subject } from "../database/models/plan/subject.model.js";
import { Major } from "../database/models/common/major.model.js";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { ClassGroupMember } from "../database/models/training/class-group-member.model.js";
import { CourseOffering } from "../database/models/training/course-offering.model.js";
import { CourseOfferingClassGroup } from "../database/models/training/course-offering-class-group.model.js";
import { CourseExamGrade, CourseExamGradebook } from "../database/models/training/course-exam-gradebook.model.js";
import { ExamGradebookQueryDto, ExamGradeRowDto, SaveExamGradebookDto } from "./dto/exam-gradebook.dto.js";
import { calculateExamEligibility, calculateExamGrade, roundExamScore } from "./exam-grade-calculation.js";
import { GradingPolicyService } from "./grading-policy.service.js";
import { excludeRecognizedExamParticipant } from "./recognized-exam-participant.js";
import { LEGACY_GRADING_POLICY, type GradingPolicy } from "./grading-policy.js";
import { examCurriculumInclude, examSubjectForGroup } from "./exam-subject-scope.js";
import { enrolledOfferingMemberSql } from "../scheduling/retake-groups.js";
import { notWithdrawnSql } from "../plan/study-leave-policy.js";
import { studyLeaveFailureOutcomesSql, studyLeaveFailureParticipantSql } from '../plan/exam-outcomes.js';
import { foreignLanguageExemptGrade, profileForeignLanguageExemptSql } from "./foreign-language-exemption.js";
import { randomUUID } from "node:crypto";
import { auditActor } from "../plan/membership-history.js";
import { GradebookWorkflowDto } from "./dto/exam-gradebook.dto.js";
import { resolveSavedExamGrade } from "./exam-grade-calculation.js";
import { isDeepStrictEqual } from "node:util";
import { Staff } from "../database/models/staff.model.js";
import { RbacService } from "../auth/rbac.service.js";

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
    @Optional() private readonly rbac?: RbacService,
  ) {}

  async options() {
    const groups = await this.groups.findAll({
      where: { program: "masters" }, attributes: ["id", "code", "name", "academicYear", "majorId"],
      include: [{ model: Major, as: "major", attributes: ["id", "name"] }, examCurriculumInclude],
      order: [["academicYear", "DESC"], ["name", "ASC"]],
    });
    const courseOfferings = await this.offerings.findAll({
      attributes: ["id", "name", "subjectId", "status", "gradebookStatus", "gradebookVersion"],
      include: [
        { model: Subject, as: "subject", attributes: ["id", "code", "name", "credits", "canonicalSubjectId"], where: { program: "masters" }, required: true },
        { model: CourseOfferingClassGroup, as: "groupLinks", attributes: ["classGroupId"], required: true },
      ],
      order: [["createdAt", "DESC"]],
    });
    const byId = new Map(groups.map(group => [group.id, group]));
    return { groups, courseOfferings: courseOfferings.map(offering => {
      const value = typeof offering.get === "function" ? offering.get({ plain: true }) : offering;
      return { ...value, groupLinks: value.groupLinks.map((link: any) => ({ ...link,
        subject: byId.has(link.classGroupId) ? examSubjectForGroup(byId.get(link.classGroupId), value.subject) : value.subject,
      })) };
    }) };
  }

  private async requireGroup(id: string, transaction?: Transaction) {
    const group = await this.groups.findOne({ where: { id, program: "masters" }, include: [examCurriculumInclude], transaction,
      ...(transaction ? { lock: { level: transaction.LOCK.UPDATE, of: ClassGroup } } : {}) });
    if (!group) throw new NotFoundException("Không tìm thấy lớp học viên Thạc sĩ.");
    return group;
  }

  async subjects(classGroupId: string) {
    await this.requireGroup(classGroupId);
    return this.offerings.findAll({
      attributes: ["id", "name", "subjectId", "status", "gradebookStatus", "gradebookVersion"],
      include: [
        { model: Subject, as: "subject", attributes: ["id", "code", "name", "credits"], where: { program: "masters" }, required: true },
        { model: CourseOfferingClassGroup, as: "groupLinks", attributes: [], where: { classGroupId }, required: true },
      ], order: [["createdAt", "DESC"]],
    });
  }

  private async scope(query: ExamGradebookQueryDto, transaction?: Transaction) {
    const offering = await this.offerings.findByPk(query.courseOfferingId, {
      attributes: ["id", "name", "subjectId", "status", "gradebookStatus", "gradebookVersion", ...(transaction ? ["gradebookSnapshot"] : [])],
      include: [{ model: Subject, as: "subject", attributes: ["id", "code", "name", "credits", "program", "canonicalSubjectId"] }], transaction,
      ...(transaction ? { lock: { level: transaction.LOCK.UPDATE, of: CourseOffering } } : {}),
    });
    if (!offering || offering.subject?.program !== "masters") throw new NotFoundException("Không tìm thấy học phần Thạc sĩ.");
    const group = await this.requireGroup(query.classGroupId, transaction);
    const link = await this.links.findOne({ where: { classGroupId: query.classGroupId, courseOfferingId: query.courseOfferingId }, transaction });
    if (!link) throw new BadRequestException("Học phần không thuộc lớp đã chọn.");
    return { group, offering };
  }

  private async offeringGroups(offeringId: string, transaction?: Transaction) {
    const links = await this.links.findAll({ where: { courseOfferingId: offeringId },
      include: [{ model: ClassGroup, as: "classGroup", where: { program: "masters" }, required: true,
        include: [examCurriculumInclude] }], transaction, order: [["classGroupId", "ASC"]] });
    return links.map(link => link.classGroup);
  }

  async get(query: ExamGradebookQueryDto) {
    const { group, offering } = await this.scope(query);
    const shared = query.rosterScope === "offering";
    const scopedGroups = shared ? await this.offeringGroups(offering.id) : [group];
    const groupIds = scopedGroups.map(item => item.id);
    const policies = Object.fromEntries(await Promise.all(scopedGroups.map(async item => [item.id, this.policies
      ? await this.policies.latest(examSubjectForGroup(item, offering.subject).id || offering.subjectId, item.academicYear || "")
      : LEGACY_GRADING_POLICY])));
    const currentPolicy = policies[group.id];
    const pageSize = Math.min(15, Math.max(1, query.pageSize || 15));
    const requestedPage = Math.max(1, query.page || 1);
    // Chỉ trả tối đa 15 hồ sơ. COUNT, tìm kiếm, lọc DS thi và khử trùng chạy trong PostgreSQL.
    const [result] = await this.sequelize.query<any>(`
      WITH book AS (
        SELECT revision, grades, class_group_id, updated_at FROM course_exam_gradebooks
        WHERE class_group_id IN (:groupIds) AND course_offering_id = :offeringId
      ), identities AS (
        SELECT cm.id member_id, ar.id admission_id, cm.class_group_id AS "classGroupId",
          CASE WHEN COALESCE(cm.student_id, ar.student_id) IS NOT NULL
            THEN 'student:' || COALESCE(cm.student_id, ar.student_id)::text
            WHEN ar.id IS NOT NULL THEN 'admission:' || ar.id::text END AS "participantId",
          COALESCE(NULLIF(ar.code, ''), st.reg_no, '') AS code,
          COALESCE(NULLIF(ar.full_name, ''), st.full_name, '') AS "fullName",
          COALESCE(ar.last_name, '') AS "lastName", COALESCE(ar.first_name, '') AS "firstName",
          COALESCE(ar.dob::text, '') AS dob, COALESCE(ar.gender, '') AS gender,
          ar.study_status AS "studyStatus"
        FROM academic_class_members cm
        LEFT JOIN admission_records ar ON ar.id = cm.admission_record_id
        LEFT JOIN students st ON st.id = cm.student_id
        WHERE (cm.left_at IS NULL OR cm.left_at >= (SELECT created_at FROM course_offerings WHERE id = :offeringId)) AND cm.class_group_id IN (:groupIds)
          AND ${enrolledOfferingMemberSql('cm.class_group_id', `(CASE WHEN COALESCE(cm.student_id, ar.student_id) IS NOT NULL
            THEN 'student:' || COALESCE(cm.student_id, ar.student_id)::text ELSE 'admission:' || ar.id::text END)`, true)}
        ${shared ? `UNION ALL
        SELECT os.id, ar.id, CAST(:individualGroupId AS uuid),
          CASE WHEN ar.student_id IS NOT NULL THEN 'student:' || ar.student_id::text ELSE 'admission:' || ar.id::text END,
          COALESCE(NULLIF(ar.code, ''), st.reg_no, ''), COALESCE(NULLIF(ar.full_name, ''), st.full_name, ''),
          COALESCE(ar.last_name, ''), COALESCE(ar.first_name, ''), COALESCE(ar.dob::text, ''), COALESCE(ar.gender, ''), ar.study_status
        FROM course_offering_students os JOIN admission_records ar ON ar.id = os.admission_record_id
        LEFT JOIN students st ON st.id = ar.student_id WHERE os.course_offering_id = :offeringId` : ""}
      ), people AS (
        SELECT DISTINCT ON ("participantId") "participantId", "classGroupId", code, "fullName", "lastName", "firstName", dob, gender, "studyStatus"
        FROM identities WHERE "participantId" IS NOT NULL
          AND (${notWithdrawnSql('"participantId"')} OR ${studyLeaveFailureParticipantSql('"participantId"')})
          AND ${excludeRecognizedExamParticipant('"participantId"')}
        ORDER BY "participantId", "classGroupId", admission_id NULLS LAST, member_id
      ), grade_map AS (
        SELECT DISTINCT ON (value->>'participantId') value->>'participantId' participant_id, value grade
        FROM book, LATERAL jsonb_array_elements(book.grades)
        ORDER BY value->>'participantId', book.updated_at DESC, book.class_group_id
      ), roster AS (
        SELECT p.*, COALESCE((SELECT failure.grade FROM (${studyLeaveFailureOutcomesSql()}) failure
          WHERE failure.course_offering_id = :offeringId AND failure.participant_id = p."participantId" LIMIT 1),
          CASE WHEN COALESCE(g.grade->>'finalized', 'false') <> 'true' AND ${profileForeignLanguageExemptSql('p."participantId"', ':subjectId', '(SELECT academic_year FROM class_groups WHERE id = p."classGroupId")')}
          THEN COALESCE(g.grade, '{}'::jsonb) || CAST(:foreignLanguageGrade AS jsonb)
          ELSE COALESCE(g.grade, '{}'::jsonb) END) grade,
          COALESCE(CASE WHEN g.grade->>'finalized' = 'true' THEN g.grade->'eligibilityPolicy' END, CAST(:policies AS jsonb)->p."classGroupId"::text) AS policy FROM people p
        LEFT JOIN grade_map g ON g.participant_id = p."participantId"
      ), assessed AS (
        SELECT roster.*, CASE
          WHEN grade->>'studyLeaveFailure' = 'true' THEN false
          WHEN grade->>'examExempt' = 'true' THEN false
          WHEN jsonb_typeof(grade->'testScore') IS DISTINCT FROM 'number'
            OR jsonb_typeof(grade->'assignmentScore') IS DISTINCT FROM 'number' THEN NULL
          WHEN (grade->>'testScore')::numeric NOT BETWEEN 0 AND 10
            OR (grade->>'assignmentScore')::numeric NOT BETWEEN 0 AND 10 THEN NULL
          ELSE ROUND((grade->>'testScore')::numeric, 1) >= (policy->'minimums'->>'testScore')::numeric
            AND ROUND((grade->>'assignmentScore')::numeric, 1) >= (policy->'minimums'->>'assignmentScore')::numeric
        END AS eligibility FROM roster
      ), filtered AS (
        SELECT * FROM assessed
        WHERE (:mode <> 'exam' OR (
          ("participantId" = ANY(STRING_TO_ARRAY(:includeIds, ',')) OR eligibility = true)
          AND grade->>'examExempt' IS DISTINCT FROM 'true'
          AND grade->>'studyLeaveFailure' IS DISTINCT FROM 'true'
          AND NOT ("participantId" = ANY(STRING_TO_ARRAY(:excludeIds, ',')))
        ))
          AND (:search = '' OR POSITION(LOWER(:search) IN LOWER(code || ' ' || "fullName")) > 0)
      ), metadata AS (
        SELECT (SELECT COUNT(*)::int FROM roster) AS "totalRows",
          (SELECT COUNT(*)::int FROM assessed WHERE eligibility IS NULL) AS "unassessedRows",
          (SELECT COUNT(*)::int FROM filtered) AS total,
          COALESCE((SELECT SUM(revision)::int FROM book), 0) AS revision
      ), paging AS (
        SELECT *, LEAST(:page, GREATEST(1, CEIL(total::numeric / :pageSize)::int)) AS page FROM metadata
      ), selected AS (
        SELECT * FROM filtered
        ORDER BY LOWER(COALESCE(NULLIF("firstName", ''), SUBSTRING(TRIM("fullName") FROM '[^ ]+$'))), LOWER("fullName"), "participantId"
        LIMIT :pageSize OFFSET (SELECT (page - 1) * :pageSize FROM paging)
      )
      SELECT paging.*, COALESCE((SELECT jsonb_agg(to_jsonb(selected)) FROM selected), '[]'::jsonb) AS rows FROM paging
    `, { type: QueryTypes.SELECT, replacements: {
      groupId: query.classGroupId, offeringId: query.courseOfferingId, subjectId: offering.subjectId,
      groupIds, individualGroupId: groupIds[0], policies: JSON.stringify(policies), foreignLanguageGrade: JSON.stringify(foreignLanguageExemptGrade()),
      page: requestedPage, pageSize, mode: query.mode || "all", search: (query.search || "").trim(),
      includeIds: query.includeIds || "", excludeIds: query.excludeIds || "",
      testMinimum: currentPolicy.minimums.testScore, assignmentMinimum: currentPolicy.minimums.assignmentScore,
    } });
    return {
      group: { id: group.id, name: group.name, code: group.code, academicYear: group.academicYear }, offering,
      workflow: { status: offering.gradebookStatus || "draft", version: offering.gradebookVersion || 0 },
      revision: result.revision, total: result.total, totalRows: result.totalRows, unassessedRows: result.unassessedRows, page: result.page, pageSize,
      eligibilityPolicy: currentPolicy,
      ...(shared ? { eligibilityPolicies: policies } : {}),
      rows: result.rows.map(({ grade, policy, eligibility: _eligibility, ...person }: any) => {
        const eligibilityPolicy = grade.finalized ? grade.eligibilityPolicy || grade.gradingPolicy : policy || currentPolicy;
        const gradingPolicy = grade.participantId ? grade.gradingPolicy || LEGACY_GRADING_POLICY : eligibilityPolicy;
        const row = { ...emptyExamGrade(person.participantId), ...grade, ...person };
        return { ...row, ...resolveSavedExamGrade({ ...row, gradingPolicy }, eligibilityPolicy), eligible: calculateExamEligibility(row, eligibilityPolicy),
          attemptScores: row.examScore == null ? [] : [row.examScore],
          gradingPolicy, eligibilityPolicy,
        };
      }),
    };
  }

  async save(dto: SaveExamGradebookDto, actor?: any) {
    if (dto.rosterScope === "offering") return this.saveOffering(dto, actor);
    await this.sequelize.transaction(async (transaction) => {
      await this.sequelize.query("SELECT pg_advisory_xact_lock(21026)", { transaction });
      const { group, offering } = await this.scope(dto, transaction);
      this.requireCompletedTeaching(offering);
      this.requireDraft(offering);
      // Khi lưu chỉ kiểm tra danh tính các học viên vừa sửa, không tải cả lớp.
      const participants = await this.sequelize.query<{ participantId: string; profileForeignLanguageExempt?: boolean }>(`
        SELECT DISTINCT CASE WHEN COALESCE(cm.student_id, ar.student_id) IS NOT NULL
          THEN 'student:' || COALESCE(cm.student_id, ar.student_id)::text
          WHEN ar.id IS NOT NULL THEN 'admission:' || ar.id::text END AS "participantId",
          ${profileForeignLanguageExemptSql(`(CASE WHEN COALESCE(cm.student_id, ar.student_id) IS NOT NULL
            THEN 'student:' || COALESCE(cm.student_id, ar.student_id)::text ELSE 'admission:' || ar.id::text END)`, ':subjectId', ':academicYear')} AS "profileForeignLanguageExempt"
        FROM academic_class_members cm LEFT JOIN admission_records ar ON ar.id = cm.admission_record_id
        WHERE (cm.left_at IS NULL OR cm.left_at >= (SELECT created_at FROM course_offerings WHERE id = :offeringId)) AND cm.class_group_id = :groupId
          AND ${enrolledOfferingMemberSql('cm.class_group_id', `(CASE WHEN COALESCE(cm.student_id, ar.student_id) IS NOT NULL
            THEN 'student:' || COALESCE(cm.student_id, ar.student_id)::text ELSE 'admission:' || ar.id::text END)`)}
          AND ${excludeRecognizedExamParticipant(`(CASE WHEN COALESCE(cm.student_id, ar.student_id) IS NOT NULL
            THEN 'student:' || COALESCE(cm.student_id, ar.student_id)::text
            WHEN ar.id IS NOT NULL THEN 'admission:' || ar.id::text END)`)} AND
          (CASE WHEN COALESCE(cm.student_id, ar.student_id) IS NOT NULL
            THEN 'student:' || COALESCE(cm.student_id, ar.student_id)::text
            WHEN ar.id IS NOT NULL THEN 'admission:' || ar.id::text END) IN (:ids)
      `, { type: QueryTypes.SELECT, transaction, replacements: { groupId: dto.classGroupId, offeringId: offering.id, subjectId: offering.subjectId, academicYear: group.academicYear || "", ids: dto.rows.map(row => row.participantId) } });
      const allowed = new Set(participants.map(row => row.participantId));
      const ids = new Set<string>();
      for (const row of dto.rows) {
        if (!allowed.has(row.participantId)) throw new BadRequestException("Bảng điểm chứa học viên ngoài lớp đã chọn.");
        if (ids.has(row.participantId)) throw new BadRequestException("Bảng điểm có học viên bị lặp.");
        ids.add(row.participantId);
      }
      this.requireEditableParticipants(participants);
      const where = { classGroupId: dto.classGroupId, courseOfferingId: dto.courseOfferingId };
      let book = await this.books.findOne({ where, transaction, lock: transaction.LOCK.UPDATE });
      if ((book?.revision || 0) !== dto.revision) {
        throw new ConflictException("Bảng điểm đã được người khác cập nhật. Hãy tải lại trước khi lưu.");
      }
      const merged = new Map((book?.grades || []).map((row) => [row.participantId, row]));
      const currentPolicy = this.policies ? await this.policies.latest(examSubjectForGroup(group, offering.subject).id || offering.subjectId, group.academicYear || "", transaction) : LEGACY_GRADING_POLICY;
      for (const row of dto.rows) {
        merged.set(row.participantId, this.savedGrade(row, merged.get(row.participantId), currentPolicy));
      }
      const payload = { ...where, grades: [...merged.values()], revision: dto.revision + 1 };
      const before = book?.grades || [];
      if (book) await book.update(payload, { transaction });
      else book = await this.books.create(payload as never, { transaction });
      await this.audit(offering.id, "save", actor, "Lưu điểm", before, payload.grades, transaction);
    });
    return this.get(dto);
  }

  private savedGrade(row: ExamGradeRowDto, previous: CourseExamGrade | undefined, currentPolicy: GradingPolicy): CourseExamGrade {
    const gradingPolicy = previous ? previous.gradingPolicy || LEGACY_GRADING_POLICY : currentPolicy;
    if (!previous && ((row.policyVersion ?? 0) !== currentPolicy.version || (row.policyRulesVersion ?? 0) !== (currentPolicy.rulesVersion ?? 0))) {
      throw new ConflictException("Cách tính điểm của môn đã thay đổi trong lúc nhập. Hãy tải lại cấu hình trước khi lưu; điểm vừa nhập chưa bị lưu hoặc thay đổi.");
    }
    const scores = { testScore: roundExamScore(row.testScore), assignmentScore: roundExamScore(row.assignmentScore), examScore: roundExamScore(row.examScore) };
    const { policyVersion: _policyVersion, policyRulesVersion: _rulesVersion, ...values } = row;
    return { ...emptyExamGrade(row.participantId), ...values, ...scores,
      eligible: calculateExamEligibility({ ...row, ...scores }, currentPolicy),
      attemptScores: scores.examScore == null ? [] : [scores.examScore],
      ...calculateExamGrade({ ...row, ...scores }, gradingPolicy, currentPolicy), gradingPolicy: structuredClone(gradingPolicy),
    };
  }

  private requireCompletedTeaching(offering: CourseOffering) {
    if (offering.status !== "completed") throw new ConflictException({
      code: "TEACHING_NOT_COMPLETED",
      message: "Vui lòng xác nhận hoàn thành giảng dạy trước khi nhập điểm.",
    });
  }

  private requireDraft(offering: CourseOffering) {
    if (offering.gradebookStatus && offering.gradebookStatus !== "draft") {
      throw new ConflictException("Bảng điểm đã gửi duyệt hoặc đã khóa. Cần quản trị viên mở lại trước khi sửa.");
    }
  }

  private async audit(offeringId: string, action: string, actor: any, note: string, before: any, after: any, transaction: Transaction) {
    await this.sequelize.query(`INSERT INTO gradebook_events (id,course_offering_id,action,actor,note,before_data,after_data)
      VALUES (:id,:offeringId,:action,CAST(:actor AS jsonb),:note,CAST(:before AS jsonb),CAST(:after AS jsonb))`, {
      transaction, replacements: { id: randomUUID(), offeringId, action, actor: JSON.stringify(auditActor(actor)), note,
        before: JSON.stringify(before), after: JSON.stringify(after) },
    });
  }

  async history(query: ExamGradebookQueryDto) {
    await this.scope(query);
    return this.sequelize.query(`SELECT id,action,actor,note,before_data AS "before",after_data AS "after",created_at AS "createdAt"
      FROM gradebook_events WHERE course_offering_id = :id ORDER BY created_at DESC,id DESC`, {
      type: QueryTypes.SELECT, replacements: { id: query.courseOfferingId },
    });
  }

  /** Quyền nhập/gửi duyệt và duyệt/mở lại bảng điểm, phân giải qua RBAC. */
  private async gradebookRights(actor: any): Promise<{ canSubmit: boolean; canApprove: boolean }> {
    if (this.rbac && actor instanceof Staff) {
      const access = await this.rbac.effectiveAccess(actor);
      return {
        canSubmit: access.permissions.has("gradebook.submit"),
        canApprove: access.permissions.has("gradebook.approve"),
      };
    }
    return { canSubmit: false, canApprove: false };
  }

  async transition(dto: GradebookWorkflowDto, actor: any) {
    const { canSubmit, canApprove } = await this.gradebookRights(actor);
    if (!canSubmit || (dto.action !== "submit" && !canApprove)) {
      throw new BadRequestException("Chỉ quản trị viên được duyệt hoặc mở lại bảng điểm.");
    }
    if (!dto.note?.trim()) throw new BadRequestException("Nhập lý do hoặc căn cứ xử lý bảng điểm.");
    await this.sequelize.transaction(async transaction => {
      await this.sequelize.query("SELECT pg_advisory_xact_lock(21026)", { transaction });
      const { offering } = await this.scope(dto, transaction);
      this.requireCompletedTeaching(offering);
      const status = offering.gradebookStatus || "draft";
      if ((offering.gradebookVersion || 0) !== dto.version) throw new ConflictException("Trạng thái bảng điểm đã thay đổi. Hãy tải lại.");
      const expected = dto.action === "submit" ? "draft" : dto.action === "approve" ? "submitted" : null;
      if (expected ? status !== expected : status === "draft") throw new ConflictException("Thao tác không phù hợp trạng thái bảng điểm.");
      const books = await this.books.findAll({ where: { courseOfferingId: offering.id }, transaction, lock: transaction.LOCK.UPDATE });
      if (books.reduce((sum, book) => sum + book.revision, 0) !== dto.revision) throw new ConflictException("Điểm đã thay đổi. Hãy tải lại trước khi xử lý.");
      let snapshot: any = null;
      const before = { status, books: books.map(book => ({ classGroupId: book.classGroupId, grades: book.grades, revision: book.revision })) };
      if (dto.action !== "reopen") {
        // Offering is locked before reading, as it is for every grade save.
        // One unfiltered roster is used, independent of the page/search in the UI.
        const rows: any[] = [];
        for (let page = 1; ; page += 1) {
          const result = await this.get({ classGroupId: dto.classGroupId, courseOfferingId: offering.id, rosterScope: "offering", page, pageSize: 15 });
          rows.push(...result.rows);
          if (page * result.pageSize >= result.total) break;
        }
        if (!rows.length || rows.some(row => row.result === "pending")) throw new ConflictException("Chưa có đủ kết quả cho toàn bộ học viên của lớp học phần.");
        const fingerprint = (values: any[]) => values.map(row => Object.fromEntries([
          "participantId", "classGroupId", "testScore", "assignmentScore", "examScore", "examExempt", "result", "courseScore",
          "gradingPolicy", "eligibilityPolicy", "studyLeaveFailure", "profileForeignLanguageExempt",
        ].map(key => [key, row[key] ?? null])));
        if (dto.action === "approve" && !isDeepStrictEqual(fingerprint(rows), fingerprint(offering.gradebookSnapshot?.rows || []))) {
          throw new ConflictException("Danh sách học viên, cấu hình hoặc kết quả đã thay đổi sau khi gửi duyệt. Mở lại và gửi duyệt lại.");
        }
        snapshot = { at: new Date().toISOString(), actor: auditActor(actor), rows };
        if (dto.action === "approve") {
          for (const group of await this.offeringGroups(offering.id, transaction)) {
            const book = books.find(item => item.classGroupId === group.id);
            const merged = new Map((book?.grades || []).map(row => [row.participantId, row]));
            for (const row of rows.filter(row => row.classGroupId === group.id)) {
              merged.set(row.participantId, { ...row, finalized: true, eligibilityPolicy: structuredClone(row.eligibilityPolicy) });
            }
            const payload = { classGroupId: group.id, courseOfferingId: offering.id, grades: [...merged.values()], revision: (book?.revision || 0) + 1 };
            if (book) await book.update(payload, { transaction });
            else await this.books.create(payload as never, { transaction });
          }
        }
      } else {
        for (const book of books) await book.update({ revision: book.revision + 1, grades: book.grades.map(({ finalized, eligibilityPolicy, ...row }) => row) }, { transaction });
      }
      const next = dto.action === "submit" ? "submitted" : dto.action === "approve" ? "approved" : "draft";
      await offering.update({ gradebookStatus: next, gradebookVersion: (offering.gradebookVersion || 0) + 1, gradebookSnapshot: snapshot }, { transaction });
      await this.audit(offering.id, dto.action, actor, dto.note.trim(), before, { status: next, snapshot }, transaction);
    });
    return this.get({ ...dto, rosterScope: "offering" });
  }

  private requireEditableParticipants(participants: { profileForeignLanguageExempt?: boolean }[]) {
    if (participants.some(row => row.profileForeignLanguageExempt)) throw new ConflictException("Học viên được miễn thi ngoại ngữ theo hồ sơ. Hãy cập nhật trạng thái miễn thi trong hồ sơ học viên.");
  }

  private async saveOffering(dto: SaveExamGradebookDto, actor?: any) {
    await this.sequelize.transaction(async transaction => {
      await this.sequelize.query("SELECT pg_advisory_xact_lock(21026)", { transaction });
      const { offering } = await this.scope(dto, transaction);
      this.requireCompletedTeaching(offering);
      this.requireDraft(offering);
      const groups = await this.offeringGroups(offering.id, transaction);
      const groupIds = groups.map(group => group.id);
      const participants = await this.sequelize.query<{ participantId: string; classGroupId: string; profileForeignLanguageExempt?: boolean }>(`
        WITH identities AS (
          SELECT cm.class_group_id AS "classGroupId",
            CASE WHEN COALESCE(cm.student_id, ar.student_id) IS NOT NULL
              THEN 'student:' || COALESCE(cm.student_id, ar.student_id)::text
              WHEN ar.id IS NOT NULL THEN 'admission:' || ar.id::text END AS "participantId"
          FROM academic_class_members cm LEFT JOIN admission_records ar ON ar.id = cm.admission_record_id
          WHERE (cm.left_at IS NULL OR cm.left_at >= (SELECT created_at FROM course_offerings WHERE id = :offeringId)) AND cm.class_group_id IN (:groupIds)
            AND ${enrolledOfferingMemberSql('cm.class_group_id', `(CASE WHEN COALESCE(cm.student_id, ar.student_id) IS NOT NULL
              THEN 'student:' || COALESCE(cm.student_id, ar.student_id)::text ELSE 'admission:' || ar.id::text END)`)}
          UNION ALL
          SELECT CAST(:individualGroupId AS uuid), CASE WHEN ar.student_id IS NOT NULL
            THEN 'student:' || ar.student_id::text ELSE 'admission:' || ar.id::text END
          FROM course_offering_students os JOIN admission_records ar ON ar.id = os.admission_record_id
          WHERE os.course_offering_id = :offeringId
        ) SELECT DISTINCT ON ("participantId") "participantId", "classGroupId",
          ${profileForeignLanguageExemptSql('"participantId"', ':subjectId', '(SELECT academic_year FROM class_groups WHERE id = identities."classGroupId")')} AS "profileForeignLanguageExempt" FROM identities
        WHERE "participantId" IN (:ids) AND ${excludeRecognizedExamParticipant('"participantId"')}
          AND ${notWithdrawnSql('"participantId"')}
        ORDER BY "participantId", "classGroupId"
      `, { type: QueryTypes.SELECT, transaction, replacements: {
        groupIds, individualGroupId: groupIds[0], offeringId: offering.id, subjectId: offering.subjectId, ids: dto.rows.map(row => row.participantId),
      } });
      const owners = new Map(participants.map(person => [person.participantId, person.classGroupId]));
      const ids = new Set<string>();
      for (const row of dto.rows) {
        if (!owners.has(row.participantId)) throw new BadRequestException("Bảng điểm chứa học viên ngoài lớp đã chọn.");
        if (ids.has(row.participantId)) throw new BadRequestException("Bảng điểm có học viên bị lặp.");
        ids.add(row.participantId);
      }
      this.requireEditableParticipants(participants);
      const books = await this.books.findAll({ where: { courseOfferingId: offering.id, classGroupId: { [Op.in]: groupIds } },
        transaction, lock: transaction.LOCK.UPDATE, order: [["updatedAt", "DESC"], ["classGroupId", "ASC"]] });
      if (books.reduce((sum, book) => sum + book.revision, 0) !== dto.revision) {
        throw new ConflictException("Bảng điểm đã được người khác cập nhật. Hãy tải lại trước khi lưu.");
      }
      const previous = new Map<string, CourseExamGrade>();
      for (const book of books) for (const grade of book.grades) if (!previous.has(grade.participantId)) previous.set(grade.participantId, grade);
      const policies = new Map<string, GradingPolicy>();
      const changes = new Map<string, Map<string, CourseExamGrade>>();
      for (const row of dto.rows) {
        const ownerId = owners.get(row.participantId)!;
        if (!policies.has(ownerId)) {
          const group = groups.find(group => group.id === ownerId)!;
          policies.set(ownerId, this.policies ? await this.policies.latest(examSubjectForGroup(group, offering.subject).id || offering.subjectId,
            group.academicYear || "", transaction) : LEGACY_GRADING_POLICY);
        }
        const grade = this.savedGrade(row, previous.get(row.participantId), policies.get(ownerId)!);
        // Keep legacy group gradebooks usable, including duplicate membership.
        const targetIds = new Set([ownerId, ...books.filter(book => book.grades.some(saved => saved.participantId === row.participantId)).map(book => book.classGroupId)]);
        for (const targetId of targetIds) {
          if (!changes.has(targetId)) changes.set(targetId, new Map());
          changes.get(targetId)!.set(row.participantId, grade);
        }
      }
      for (const [classGroupId, changed] of changes) {
        const book = books.find(book => book.classGroupId === classGroupId);
        const merged = new Map((book?.grades || []).map(grade => [grade.participantId, grade]));
        for (const [id, grade] of changed) merged.set(id, grade);
        const payload = { classGroupId, courseOfferingId: offering.id, grades: [...merged.values()], revision: (book?.revision || 0) + 1 };
        const before = book?.grades || [];
        if (book) await book.update(payload, { transaction });
        else await this.books.create(payload as never, { transaction });
        await this.audit(offering.id, "save", actor, "Lưu điểm", { classGroupId, grades: before }, payload, transaction);
      }
    });
    return this.get(dto);
  }
}
