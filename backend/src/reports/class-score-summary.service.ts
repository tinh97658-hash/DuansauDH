import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/sequelize";
import { QueryTypes } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { Major } from "../database/models/common/major.model.js";
import { Discipline } from "../database/models/common/discipline.model.js";
import { Curriculum } from "../database/models/plan/curriculum.model.js";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { ClassScoreSummaryQueryDto } from "./dto/class-score-summary.dto.js";
import { sortCurriculumSubjectsByVietnameseName } from "../plan/curriculum-subject-order.js";
import { LEGACY_GRADING_POLICY, type GradingPolicy } from "../masters/grading-policy.js";
import { calculateExamEligibility, resolveSavedExamGrade } from "../masters/exam-grade-calculation.js";
import { matchesExamSubjectSql } from "../masters/exam-subject-scope.js";
import { foreignLanguageExemptGrade, foreignLanguageSubjectSql } from "../masters/foreign-language-exemption.js";

import { examOutcomesSql } from "../plan/exam-outcomes.js";
// Shared identity selection and deduplication; neither path changes roster semantics.
const CLASS_ROSTER_CTE = `
      WITH identities AS (
        SELECT cm.id AS member_id, ar.id AS admission_id, ar.id AS "admissionRecordId",
          COALESCE(cm.student_id, ar.student_id) AS "studentId",
          CASE WHEN COALESCE(cm.student_id, ar.student_id) IS NOT NULL
            THEN 'student:' || COALESCE(cm.student_id, ar.student_id)::text
            WHEN ar.id IS NOT NULL THEN 'admission:' || ar.id::text END AS "participantId",
          COALESCE(NULLIF(ar.code, ''), st.reg_no, '') AS code,
          COALESCE(NULLIF(ar.full_name, ''), st.full_name, '') AS "fullName",
          COALESCE(ar.last_name, '') AS "lastName", COALESCE(ar.first_name, '') AS "firstName",
          COALESCE(ar.dob, '') AS dob, COALESCE(ar.gender, '') AS gender,
          COALESCE(ar.is_exempt_foreign_language, false) AS "isExemptForeignLanguage"
        FROM class_group_members cm
        LEFT JOIN LATERAL (
          SELECT a.* FROM admission_records a
          WHERE a.id = cm.admission_record_id OR (cm.admission_record_id IS NULL AND a.student_id = cm.student_id)
          ORDER BY CASE WHEN a.id = cm.admission_record_id THEN 0 ELSE 1 END,
            CASE WHEN a.academic_year = :academicYear THEN 0 ELSE 1 END, a.created_at DESC, a.id
          LIMIT 1
        ) ar ON true
        LEFT JOIN students st ON st.id = COALESCE(cm.student_id, ar.student_id)
        WHERE cm.class_group_id = :groupId
      ), people AS (
        SELECT DISTINCT ON ("participantId") "participantId", "admissionRecordId", "studentId", code, "fullName", "lastName", "firstName", dob, gender, "isExemptForeignLanguage"
        FROM identities WHERE "participantId" IS NOT NULL
        ORDER BY "participantId", admission_id NULLS LAST, member_id
      )`;
const ROSTER_ORDER = `LOWER(COALESCE(NULLIF("firstName", ''), SUBSTRING(TRIM("fullName") FROM '[^ ]+$'))), LOWER("fullName"), "participantId"`;

// Same profile projection for single and whole-class transcript datasets.
const TRANSCRIPT_PROFILE_SQL = `
      SELECT ar.id AS "admissionRecordId", ar.student_id AS "studentId", ar.code, ar.full_name AS "fullName",
        ar.last_name AS "lastName", ar.first_name AS "firstName", ar.dob, ar.gender, ar.academic_year AS "academicYear",
        ar.pob, ar.admission_date AS "admissionDate", ar.training_level AS "trainingLevel",
        ar.training_mode_name AS "trainingModeName", ar.training_mode_group AS "trainingModeGroup", ar.language,
        CASE WHEN m.id IS NOT NULL THEN jsonb_build_object('id', m.id, 'name', m.name)
          WHEN NULLIF(ar.major_name, '') IS NOT NULL THEN jsonb_build_object('id', ar.major_id, 'name', ar.major_name)
          ELSE NULL END AS major,
        NULL::numeric AS "durationYears", NULL::text AS "masterDiplomaNumber",
        CASE WHEN ar.student_id IS NOT NULL THEN 'student:' || ar.student_id::text
          ELSE 'admission:' || ar.id::text END AS "participantId"
      FROM admission_records ar LEFT JOIN majors m ON m.id = ar.major_id`;

@Injectable()
export class ClassScoreSummaryService {
  constructor(
    @InjectModel(ClassGroup) private readonly groups: typeof ClassGroup,
    @InjectConnection() private readonly sequelize: Sequelize,
  ) {}

  async options() {
    return { groups: await this.groups.findAll({
      attributes: ["id", "code", "name", "program", "academicYear", "curriculumId", "majorId"],
      include: [{ model: Major, attributes: ["id", "name", "disciplineId"],
        include: [{ model: Discipline, attributes: ["id", "code", "name"] }] }],
      order: [["academicYear", "DESC"], ["code", "ASC"]],
    }) };
  }

  async roster(classGroupId: string) {
    const classGroup = await this.groups.findByPk(classGroupId, {
      attributes: ["id", "code", "name", "program", "academicYear"],
    });
    if (!classGroup) throw new NotFoundException("Không tìm thấy lớp học viên.");
    const students = await this.sequelize.query<any>(`
      ${CLASS_ROSTER_CTE}
      SELECT "participantId", "admissionRecordId", "studentId", code, "fullName", "lastName", "firstName",
        ("admissionRecordId" IS NOT NULL) AS "canPreview"
      FROM people ORDER BY ${ROSTER_ORDER}
    `, { type: QueryTypes.SELECT, replacements: { groupId: classGroup.id, academicYear: classGroup.academicYear || "" } });
    return { classGroup, students };
  }

  async learnerScorecard(admissionRecordId: string, classGroupId?: string) {
    // Duration has several catalog sources without a precedence rule. The input
    // diploma number is an undergraduate degree, so neither is inferred here.
    const [student] = await this.sequelize.query<any>(`
      ${TRANSCRIPT_PROFILE_SQL} WHERE ar.id = :admissionRecordId
    `, { type: QueryTypes.SELECT, replacements: { admissionRecordId } });
    if (!student) throw new NotFoundException("Không tìm thấy học viên.");
    const groups = await this.sequelize.query<any>(`
      SELECT DISTINCT cg.id, cg.code, cg.name, cg.program, cg.academic_year AS "academicYear",
        cg.curriculum_id AS "curriculumId"
      FROM class_group_members cm JOIN class_groups cg ON cg.id = cm.class_group_id
      LEFT JOIN admission_records member_record ON member_record.id = cm.admission_record_id
      WHERE cm.admission_record_id = :admissionRecordId OR
        (:studentId IS NOT NULL AND (cm.student_id = :studentId OR member_record.student_id = :studentId))
      ORDER BY "academicYear" DESC NULLS LAST, cg.code, cg.id
    `, { type: QueryTypes.SELECT, replacements: { admissionRecordId, studentId: student.studentId } });
    const selected = classGroupId ? groups.find(group => group.id === classGroupId)
      : groups.find(group => group.academicYear === student.academicYear) || groups[0];
    if (classGroupId && !selected) throw new NotFoundException("Học viên không thuộc lớp được chọn.");
    if (!selected) return { student, groups, group: null, curriculum: null, subjects: [] };
    const report = await this.get({ classGroupId: selected.id }, true, { participantId: student.participantId, includeDetails: true });
    const person = report.rows.find(row => row.participantId === student.participantId);
    if (!person) throw new NotFoundException("Học viên không còn thuộc lớp được chọn.");
    return { student, groups, group: report.group, curriculum: report.curriculum,
      subjects: report.subjects.map(subject => ({ ...subject, grade: person.scores[subject.id] || null })) };
  }

  async transcripts(classGroupId: string) {
    // One complete score resolution + one bulk profile read. Search and UI page
    // are deliberately absent, and the existing score resolver is unchanged.
    const report = await this.get({ classGroupId }, true, { includeDetails: true });
    if (!report.rows.length) return { classGroup: report.group, scorecards: [] };
    const admissionRecordIds = report.rows.map(row => row.admissionRecordId).filter(Boolean);
    const profiles = admissionRecordIds.length ? await this.sequelize.query<any>(`
      ${TRANSCRIPT_PROFILE_SQL} WHERE ar.id IN (:admissionRecordIds)
    `, { type: QueryTypes.SELECT, replacements: { admissionRecordIds } }) : [];
    const byId = new Map(profiles.map(profile => [profile.admissionRecordId, profile]));
    return { classGroup: report.group, scorecards: report.rows.map(row => {
      const student = byId.get(row.admissionRecordId);
      if (!student || student.participantId !== row.participantId) {
        // Preserve identity for exact selected-subset validation. An unavailable
        // unselected profile must not block exporting other learners.
        return { student: { participantId: row.participantId },
          unavailableReason: `Không thể xuất ${row.code || row.participantId}: chưa có hồ sơ học viên phù hợp hoặc hồ sơ không còn khớp danh sách lớp.` };
      }
      return { student, group: report.group, curriculum: report.curriculum,
        subjects: report.subjects.map(subject => ({ ...subject, grade: row.scores[subject.id] || null })) };
    }) };
  }

  async get(query: ClassScoreSummaryQueryDto, exportAll = false, scope: { participantId?: string; includeDetails?: boolean } = {}) {
    const group = await this.groups.findByPk(query.classGroupId, {
      attributes: ["id", "code", "name", "program", "academicYear", "curriculumId"],
      include: [
        { model: Major, attributes: ["id", "name"] },
        { model: Curriculum, attributes: ["id", "code", "name", "totalCredits"] },
      ],
    });
    if (!group) throw new NotFoundException("Không tìm thấy lớp học viên.");
    const subjects = sortCurriculumSubjectsByVietnameseName(group.curriculumId ? await this.sequelize.query<any>(`
      SELECT s.id, COALESCE(NULLIF(s.code_text, ''), s.code) AS code, s.name, s.credits, s.is_required AS "isRequired", COALESCE(catalog_block.name, b.name) AS "blockName",
        ${foreignLanguageSubjectSql('s.id')} AS "isForeignLanguage"
      FROM curriculum_subjects cs
      JOIN subjects s ON s.id = cs.subject_id
      JOIN curriculum_blocks b ON b.id = cs.block_id
      LEFT JOIN curriculum_blocks catalog_block ON catalog_block.curriculum_id = cs.curriculum_id AND catalog_block.code = s.subject_type
      WHERE cs.curriculum_id = :curriculumId
      ORDER BY b.sort_order, cs.sort_order, s.sort_order, s.code, s.id
    `, { type: QueryTypes.SELECT, replacements: { curriculumId: group.curriculumId } }) : []);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 50));
    const [roster] = await this.sequelize.query<any>(`
      ${CLASS_ROSTER_CTE}, filtered AS (
        SELECT "participantId", "admissionRecordId", code, "fullName", "lastName", "firstName", dob, gender, "isExemptForeignLanguage" FROM people WHERE (:participantId = '' OR "participantId" = :participantId)
          AND (:search = '' OR POSITION(LOWER(:search) IN LOWER(code || ' ' || "fullName" || ' ' || "lastName" || ' ' || "firstName")) > 0)
      ), metadata AS (
        SELECT COUNT(*)::int AS total FROM filtered
      ), paging AS (
        SELECT total, LEAST(:page, GREATEST(1, CEIL(total::numeric / :pageSize)::int)) AS page FROM metadata
      ), selected AS (
        SELECT * FROM filtered
        ORDER BY ${ROSTER_ORDER}
        ${exportAll ? "" : "LIMIT :pageSize OFFSET (SELECT (page - 1) * :pageSize FROM paging)"}
      )
      SELECT paging.*, COALESCE((SELECT jsonb_agg(to_jsonb(selected)) FROM selected), '[]'::jsonb) AS rows FROM paging
    `, { type: QueryTypes.SELECT, replacements: {
      groupId: group.id, academicYear: group.academicYear || "", participantId: scope.participantId || "",
      page: exportAll ? 1 : Math.max(1, query.page || 1), pageSize, search: (query.search || "").trim(),
    } });

    const rows: any[] = roster.rows.map((row: any) => ({ ...row, scores: {} }));
    if (subjects.length && rows.length) {
      // The latest saved exam row is authoritative, even when its result is pending or its score is empty.
      // Match aliases by their canonical subject, never by a coincidentally equal name.
      const scores = await this.sequelize.query<any>(`
        WITH candidates AS (
          SELECT attempt.participant_id, attempt.subject_id,
            NULLIF(attempt.grade->>'courseScore', '')::numeric AS score,
            COALESCE(attempt.grade->>'result', 'pending') AS result,
            attempt.recorded_at, attempt.id, 0 AS priority,
            attempt.grade || jsonb_build_object('source', 'gradebook', 'eligibilityPolicy', rules.policy) AS details,
            attempt.course_offering_id::text AS offering_id
          FROM (${examOutcomesSql()}) attempt
          LEFT JOIN LATERAL (SELECT policy FROM shared_grading_rules ORDER BY version DESC LIMIT 1) rules ON true
          WHERE attempt.participant_id IN (:participantIds)
          UNION ALL
          SELECT CASE WHEN ar.student_id IS NOT NULL THEN 'student:' || ar.student_id::text
              ELSE 'admission:' || ar.id::text END, recognition.target_subject_id,
            learning.score, 'passed', recognition.updated_at, recognition.id::text, 1,
            jsonb_build_object('source', 'recognition', 'recognitionId', recognition.id,
              'courseScore', learning.score, 'result', 'passed', 'conversionPolicy', rules.policy), NULL::text
          FROM subject_recognitions recognition
          JOIN admission_records ar ON ar.id = recognition.admission_record_id
          JOIN learner_subject_results learning ON learning.id = recognition.learning_result_id
            AND learning.admission_record_id = ar.id
          LEFT JOIN LATERAL (SELECT policy FROM shared_grading_rules ORDER BY version DESC LIMIT 1) rules ON true
          WHERE recognition.status = 'approved' AND learning.status = 'completed'
            AND learning.source_type IN ('pre_masters', 'early_enrollment', 'external')
            AND learning.result = 'passed' AND learning.score BETWEEN 0 AND 10
            AND (CASE WHEN ar.student_id IS NOT NULL THEN 'student:' || ar.student_id::text
              ELSE 'admission:' || ar.id::text END) IN (:participantIds)
        ), ranked AS (
          SELECT c.participant_id AS "participantId", target.id AS "subjectId", c.score, c.result, c.details,
            ROW_NUMBER() OVER (PARTITION BY c.participant_id, target.id
              ORDER BY c.priority DESC, c.recorded_at DESC, c.id DESC) AS rank
          FROM candidates c JOIN subjects source ON source.id = c.subject_id
          JOIN subjects target ON ${matchesExamSubjectSql('source', 'target', 'c.offering_id', ':groupId')}
          WHERE target.id IN (:subjectIds)
        )
        SELECT "participantId", "subjectId", score, result, details FROM ranked WHERE rank = 1
      `, { type: QueryTypes.SELECT, replacements: {
        groupId: group.id, participantIds: rows.map(row => row.participantId), subjectIds: subjects.map(subject => subject.id), includeDetails: !!scope.includeDetails,
      } });
      const people = new Map(rows.map(row => [row.participantId, row]));
      for (const entry of scores) {
        if (entry.details?.source === "gradebook") {
          const grade = entry.details;
          const policy = grade.eligibilityPolicy || LEGACY_GRADING_POLICY;
          const calculated = resolveSavedExamGrade(grade, policy);
          entry.score = calculated.courseScore;
          entry.result = calculated.result;
          entry.details = { ...grade, ...calculated, eligibilityPolicy: policy };
          if (!grade.studyLeaveFailure && !grade.examExempt && calculateExamEligibility(grade, policy) === false) {
            entry.score = 0;
            entry.result = "failed";
            entry.details = { ...entry.details, examScore: 0, attemptScores: [0] };
          }
        }
        if (entry.details?.source === "recognition") {
          const policy: GradingPolicy = entry.details.conversionPolicy || LEGACY_GRADING_POLICY;
          const band = [...policy.bands].sort((a, b) => b.minimum - a.minimum)
            .find(item => Number(entry.score) >= item.minimum);
          entry.details = { source: "recognition", recognitionId: entry.details.recognitionId,
            courseScore: Number(entry.score), grade4: band?.grade4 ?? null,
            letterGrade: band?.letter || "", result: "passed" };
        }
        const person = people.get(entry.participantId);
        if (person) person.scores[entry.subjectId] = { score: entry.score == null ? null : Number(entry.score), result: entry.result,
          ...(entry.details?.studyLeaveFailure ? { studyLeaveFailure: true } : {}),
          ...(scope.includeDetails ? { details: entry.details } : {}) };
      }
      for (const person of rows) {
        if (!person.isExemptForeignLanguage) continue;
        for (const subject of subjects) {
          if (!subject.isForeignLanguage) continue;
          if (person.scores[subject.id]?.studyLeaveFailure) continue;
          person.scores[subject.id] = { score: null, result: "passed", profileForeignLanguageExempt: true,
            ...(scope.includeDetails ? { details: { ...foreignLanguageExemptGrade(), source: "profile_foreign_language_exemption" } } : {}) };
        }
      }
    }
    const storedCurriculum = typeof group.curriculum?.toJSON === "function" ? group.curriculum.toJSON() : group.curriculum;
    const curriculum = storedCurriculum ? { ...storedCurriculum, totalCredits: subjects.reduce((total: number, subject: any) => total + Number(subject.credits || 0), 0) } : null;
    const plainGroup = typeof group.toJSON === "function" ? group.toJSON() : group;
    return { group: { ...plainGroup, curriculum }, curriculum, subjects, rows, total: roster.total, page: roster.page, pageSize,
      scorePolicy: "Điểm lấy từ kết quả học phần đã được công nhận hoặc danh sách thi, điểm thi đã lưu gần nhất. Ô trống: chưa có điểm; MT: miễn thi. Không đạt do bảo lưu: học phần đã có lịch buổi đầu hoặc đã có điểm khi duyệt bảo lưu." };
  }
}
