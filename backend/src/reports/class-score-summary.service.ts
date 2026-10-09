import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/sequelize";
import { QueryTypes } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { Major } from "../database/models/common/major.model.js";
import { Discipline } from "../database/models/common/discipline.model.js";
import { Curriculum } from "../database/models/plan/curriculum.model.js";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { ClassScoreSummaryQueryDto } from "./dto/class-score-summary.dto.js";

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

  async learnerScorecard(admissionRecordId: string, classGroupId?: string) {
    const [student] = await this.sequelize.query<any>(`
      SELECT id AS "admissionRecordId", student_id AS "studentId", code, full_name AS "fullName",
        last_name AS "lastName", first_name AS "firstName", dob, gender, academic_year AS "academicYear",
        CASE WHEN student_id IS NOT NULL THEN 'student:' || student_id::text
          ELSE 'admission:' || id::text END AS "participantId"
      FROM admission_records WHERE id = :admissionRecordId
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

  async get(query: ClassScoreSummaryQueryDto, exportAll = false, scope: { participantId?: string; includeDetails?: boolean } = {}) {
    const group = await this.groups.findByPk(query.classGroupId, {
      attributes: ["id", "code", "name", "program", "academicYear", "curriculumId"],
      include: [
        { model: Major, attributes: ["id", "name"] },
        { model: Curriculum, attributes: ["id", "code", "name", "totalCredits"] },
      ],
    });
    if (!group) throw new NotFoundException("Không tìm thấy lớp học viên.");
    const subjects = group.curriculumId ? await this.sequelize.query<any>(`
      SELECT s.id, s.code, s.name, cs.credits, cs.is_required AS "isRequired", b.name AS "blockName"
      FROM curriculum_subjects cs
      JOIN subjects s ON s.id = cs.subject_id
      JOIN curriculum_blocks b ON b.id = cs.block_id
      WHERE cs.curriculum_id = :curriculumId
      ORDER BY b.sort_order, cs.sort_order, s.sort_order, s.code, s.id
    `, { type: QueryTypes.SELECT, replacements: { curriculumId: group.curriculumId } }) : [];
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 50));
    const [roster] = await this.sequelize.query<any>(`
      WITH identities AS (
        SELECT cm.id AS member_id, ar.id AS admission_id, ar.id AS "admissionRecordId",
          CASE WHEN COALESCE(cm.student_id, ar.student_id) IS NOT NULL
            THEN 'student:' || COALESCE(cm.student_id, ar.student_id)::text
            WHEN ar.id IS NOT NULL THEN 'admission:' || ar.id::text END AS "participantId",
          COALESCE(NULLIF(ar.code, ''), st.reg_no, '') AS code,
          COALESCE(NULLIF(ar.full_name, ''), st.full_name, '') AS "fullName",
          COALESCE(ar.last_name, '') AS "lastName", COALESCE(ar.first_name, '') AS "firstName",
          COALESCE(ar.dob, '') AS dob, COALESCE(ar.gender, '') AS gender
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
        SELECT DISTINCT ON ("participantId") "participantId", "admissionRecordId", code, "fullName", "lastName", "firstName", dob, gender
        FROM identities WHERE "participantId" IS NOT NULL
        ORDER BY "participantId", admission_id NULLS LAST, member_id
      ), filtered AS (
        SELECT * FROM people WHERE (:participantId = '' OR "participantId" = :participantId)
          AND (:search = '' OR POSITION(LOWER(:search) IN LOWER(code || ' ' || "fullName" || ' ' || "lastName" || ' ' || "firstName")) > 0)
      ), metadata AS (
        SELECT COUNT(*)::int AS total FROM filtered
      ), paging AS (
        SELECT total, LEAST(:page, GREATEST(1, CEIL(total::numeric / :pageSize)::int)) AS page FROM metadata
      ), selected AS (
        SELECT * FROM filtered
        ORDER BY LOWER(COALESCE(NULLIF("firstName", ''), SUBSTRING(TRIM("fullName") FROM '[^ ]+$'))), LOWER("fullName"), "participantId"
        ${exportAll ? "" : "LIMIT :pageSize OFFSET (SELECT (page - 1) * :pageSize FROM paging)"}
      )
      SELECT paging.*, COALESCE((SELECT jsonb_agg(to_jsonb(selected)) FROM selected), '[]'::jsonb) AS rows FROM paging
    `, { type: QueryTypes.SELECT, replacements: {
      groupId: group.id, academicYear: group.academicYear || "", participantId: scope.participantId || "",
      page: exportAll ? 1 : Math.max(1, query.page || 1), pageSize, search: (query.search || "").trim(),
    } });

    const rows: any[] = roster.rows.map((row: any) => ({ ...row, scores: {} }));
    if (subjects.length && rows.length) {
      // Preserve the summary's latest saved total. The scorecard also shows component-only entries when no total exists.
      // Match aliases by their canonical subject, never by a coincidentally equal name.
      const scores = await this.sequelize.query<any>(`
        WITH candidates AS (
          SELECT g.value->>'participantId' AS participant_id, co.subject_id,
            NULLIF(g.value->>'courseScore', '')::numeric AS score,
            CASE WHEN g.value->>'examExempt' = 'true' THEN 'exempt'
              ELSE COALESCE(g.value->>'result', 'pending') END AS result,
            book.updated_at AS recorded_at, book.id, 1 AS priority,
            g.value || jsonb_build_object('source', 'gradebook') AS details
          FROM course_exam_gradebooks book
          JOIN course_offerings co ON co.id = book.course_offering_id
          CROSS JOIN LATERAL jsonb_array_elements(book.grades) g(value)
          WHERE book.class_group_id = :groupId AND g.value->>'participantId' IN (:participantIds)
            AND EXISTS (SELECT 1 FROM course_offering_class_groups link
              WHERE link.course_offering_id = co.id AND link.class_group_id = :groupId)
          UNION ALL
          SELECT CASE WHEN ar.student_id IS NOT NULL THEN 'student:' || ar.student_id::text
              ELSE 'admission:' || ar.id::text END,
            r.subject_id, r.score, r.result, r.updated_at, r.id, 0,
            jsonb_build_object('courseScore', r.score, 'source', 'individual')
          FROM learner_subject_results r JOIN admission_records ar ON ar.id = r.admission_record_id
          WHERE r.status = 'completed' AND r.subject_id IS NOT NULL
            AND (CASE WHEN ar.student_id IS NOT NULL THEN 'student:' || ar.student_id::text
              ELSE 'admission:' || ar.id::text END) IN (:participantIds)
          UNION ALL
          SELECT CASE WHEN ar.student_id IS NOT NULL THEN 'student:' || ar.student_id::text
              ELSE 'admission:' || ar.id::text END,
            recognition.target_subject_id, r.score, r.result, recognition.updated_at, recognition.id, 0,
            jsonb_build_object('courseScore', r.score, 'source', 'recognition')
          FROM subject_recognitions recognition
          JOIN learner_subject_results r ON r.id = recognition.learning_result_id
          JOIN admission_records ar ON ar.id = recognition.admission_record_id
          WHERE recognition.status = 'approved' AND r.status = 'completed' AND r.result IN ('passed', 'exempt')
            AND (CASE WHEN ar.student_id IS NOT NULL THEN 'student:' || ar.student_id::text
              ELSE 'admission:' || ar.id::text END) IN (:participantIds)
        ), ranked AS (
          SELECT c.participant_id AS "participantId", target.id AS "subjectId", c.score, c.result, c.details,
            ROW_NUMBER() OVER (PARTITION BY c.participant_id, target.id
              ORDER BY (c.score IS NOT NULL OR c.result = 'exempt') DESC, c.recorded_at DESC, c.priority DESC, c.id DESC) AS rank
          FROM candidates c JOIN subjects source ON source.id = c.subject_id
          JOIN subjects target ON COALESCE(target.canonical_subject_id, target.id) = COALESCE(source.canonical_subject_id, source.id)
          WHERE target.id IN (:subjectIds) AND (c.score IS NOT NULL OR c.result = 'exempt'
            OR (:includeDetails AND (
              NULLIF(c.details->>'testScore', '') IS NOT NULL OR NULLIF(c.details->>'assignmentScore', '') IS NOT NULL
              OR NULLIF(c.details->>'examScore', '') IS NOT NULL OR NULLIF(c.details->>'grade4', '') IS NOT NULL
              OR NULLIF(c.details->>'letterGrade', '') IS NOT NULL
              OR CASE WHEN jsonb_typeof(c.details->'attemptScores') = 'array' THEN jsonb_array_length(c.details->'attemptScores') ELSE 0 END > 0
            )))
        )
        SELECT "participantId", "subjectId", score, result, details FROM ranked WHERE rank = 1
      `, { type: QueryTypes.SELECT, replacements: {
        groupId: group.id, participantIds: rows.map(row => row.participantId), subjectIds: subjects.map(subject => subject.id), includeDetails: !!scope.includeDetails,
      } });
      const people = new Map(rows.map(row => [row.participantId, row]));
      for (const entry of scores) {
        const person = people.get(entry.participantId);
        if (person) person.scores[entry.subjectId] = { score: entry.score == null ? null : Number(entry.score), result: entry.result,
          ...(scope.includeDetails ? { details: entry.details } : {}) };
      }
    }
    return { group, curriculum: group.curriculum, subjects, rows, total: roster.total, page: roster.page, pageSize,
      scorePolicy: "Điểm học phần đã lưu gần nhất; gồm kết quả cá nhân đã hoàn thành. Ô trống: chưa có điểm; MT: miễn thi." };
  }
}
