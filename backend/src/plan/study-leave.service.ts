import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { QueryTypes, type Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { RequestStudyLeaveDto, StudyLeaveActionDto } from './dto/study-leave.dto.js';
import { BUSINESS_DATE_SQL, businessDate, studyLeaveEffectiveAt, validDate } from './study-leave-policy.js';

const columns = `id, admission_record_id AS "admissionRecordId", reason,
  start_date::text AS "startDate", end_date::text AS "endDate", status,
  activated_at AS "activatedAt", closed_date::text AS "closedDate", decision_note AS "decisionNote",
  extensions, history, created_at AS "createdAt", updated_at AS "updatedAt"`;

@Injectable()
export class StudyLeaveService {
  constructor(private readonly db: Sequelize) {}

  private select<T = any>(sql: string, replacements: Record<string, any> = {}, transaction?: Transaction) {
    return this.db.query<T & object>(sql, { type: QueryTypes.SELECT, replacements, transaction });
  }

  private async write(sql: string, replacements: Record<string, any>, transaction: Transaction) {
    await this.db.query(sql, { replacements, transaction });
  }

  private event(action: string, actor: any, note?: string, extra: Record<string, any> = {}) {
    return { action, at: new Date().toISOString(), actorId: actor?.id || null,
      actor: actor?.name || actor?.email || 'Hệ thống', note: note?.trim() || '', ...extra };
  }

  private requireNote(note?: string) {
    if (!note?.trim()) throw new BadRequestException('Vui lòng nhập lý do / thông tin quyết định.');
  }

  private dates(start: string, end: string) {
    if (!validDate(start) || !validDate(end) || end < start) throw new BadRequestException('Khoảng thời gian bảo lưu không hợp lệ.');
  }

  // Runs before relevant HTTP requests. This also catches dates crossed while the server
  // was offline; no browser session or background worker is required for correctness.
  async synchronize() {
    const due = await this.select(`SELECT id FROM study_leaves WHERE status = 'approved'
      AND (NOT history @> '[{"action":"roster_withdrawn"}]'::jsonb
      OR (start_date <= ${BUSINESS_DATE_SQL} AND (activated_at IS NULL OR EXISTS (
        SELECT 1 FROM admission_records ar WHERE ar.id = admission_record_id
          AND ar.study_status IS DISTINCT FROM CASE WHEN end_date < ${BUSINESS_DATE_SQL}
            THEN 'Bảo lưu quá hạn' ELSE 'Đang bảo lưu' END)))) LIMIT 1`);
    if (!due.length) return;
    await this.db.transaction(async transaction => {
      await this.write('SELECT pg_advisory_xact_lock(21026)', {}, transaction);
      const rows = await this.select(`SELECT ${columns} FROM study_leaves WHERE status = 'approved'
        AND (start_date <= ${BUSINESS_DATE_SQL} OR NOT history @> '[{"action":"roster_withdrawn"}]'::jsonb)
        ORDER BY admission_record_id FOR UPDATE`, {}, transaction);
      for (const leave of rows) {
        if (!leave.history?.some((event: any) => event.action === 'roster_withdrawn')) await this.withdrawOnApproval(leave, transaction);
        if (leave.startDate <= businessDate()) await this.activate(leave, transaction);
      }
    });
  }

  private async withdrawOfferings(leave: any, transaction: Transaction, effectiveAt: string) {
    // Finish any concurrent grade save / class completion before taking the history snapshot.
    await this.select(`SELECT offering.id FROM course_offerings offering
      WHERE (offering.status = 'active' OR offering.completed_at >= CAST(:effectiveAt AS timestamptz))
        AND (EXISTS (SELECT 1 FROM course_offering_class_groups link JOIN class_group_members member
          ON member.class_group_id = link.class_group_id JOIN admission_records record ON record.id = :recordId
          WHERE link.course_offering_id = offering.id AND (member.admission_record_id = record.id OR member.student_id = record.student_id))
        OR EXISTS (SELECT 1 FROM course_offering_students individual WHERE individual.course_offering_id = offering.id
          AND individual.admission_record_id = :recordId)) ORDER BY offering.id FOR UPDATE`, {
      effectiveAt, recordId: leave.admissionRecordId,
    }, transaction);
    const affected = await this.affected(leave.admissionRecordId, transaction, effectiveAt);
    for (const offering of affected) {
      if (offering.phase === 'studying') Object.assign(offering, { result: 'failed', studyLeaveFailure: true });
      await this.write(`INSERT INTO course_offering_withdrawals
        (id, study_leave_id, admission_record_id, course_offering_id, class_group_id, participant_id, effective_date, snapshot)
        VALUES (:id,:leaveId,:recordId,:offeringId,:groupId,:participantId,:date,CAST(:snapshot AS jsonb))
        ON CONFLICT (admission_record_id,course_offering_id) DO NOTHING`, {
        id: randomUUID(), leaveId: leave.id, recordId: leave.admissionRecordId, offeringId: offering.courseOfferingId,
        groupId: offering.classGroupId, participantId: offering.participantId, date: businessDate(new Date(effectiveAt)),
        snapshot: JSON.stringify(offering),
      }, transaction);
    }
    return affected.length;
  }

  private async withdrawOnApproval(leave: any, transaction: Transaction) {
    const approvedAt = leave.history?.find((event: any) => event.action === 'approve')?.at
      || new Date(leave.createdAt).toISOString();
    const offeringCount = await this.withdrawOfferings(leave, transaction, approvedAt);
    await this.write(`UPDATE study_leaves SET history = history || CAST(:event AS jsonb), updated_at = NOW() WHERE id = :id`, {
      id: leave.id, event: JSON.stringify([this.event('roster_withdrawn', null, '', { offeringCount })]),
    }, transaction);
  }

  private async activate(leave: any, transaction: Transaction) {
    if (!leave.activatedAt) {
      const offeringCount = await this.withdrawOfferings(leave, transaction, studyLeaveEffectiveAt(leave));
      await this.write(`UPDATE study_leaves SET activated_at = NOW(), updated_at = NOW(),
        history = history || CAST(:event AS jsonb) WHERE id = :id`, {
        id: leave.id, event: JSON.stringify([this.event('activated', null, '', { offeringCount })]),
      }, transaction);
    }
    await this.write(`UPDATE admission_records SET study_status = CASE WHEN CAST(:endDate AS date) < ${BUSINESS_DATE_SQL}
      THEN 'Bảo lưu quá hạn' ELSE 'Đang bảo lưu' END, updated_at = NOW() WHERE id = :id
      AND study_status IS DISTINCT FROM CASE WHEN CAST(:endDate AS date) < ${BUSINESS_DATE_SQL}
        THEN 'Bảo lưu quá hạn' ELSE 'Đang bảo lưu' END`, { id: leave.admissionRecordId, endDate: leave.endDate }, transaction);
  }

  private async affected(recordId: string, transaction?: Transaction, effectiveAt = new Date().toISOString()) {
    return this.select(`SELECT DISTINCT ON (offering.id) offering.id AS "courseOfferingId",
      offering.name AS "offeringName", subject.id AS "subjectId", subject.name AS "subjectName",
      link.class_group_id AS "classGroupId", groups.code AS "classCode",
      CASE WHEN record.student_id IS NOT NULL THEN 'student:' || record.student_id::text
        ELSE 'admission:' || record.id::text END AS "participantId",
      CASE WHEN EXISTS (SELECT 1 FROM teaching_sessions session WHERE session.course_offering_id = offering.id
        AND session.created_at <= CAST(:effectiveAt AS timestamptz)) OR EXISTS (
          SELECT 1 FROM course_exam_gradebooks book CROSS JOIN LATERAL jsonb_array_elements(book.grades) grade
          WHERE book.course_offering_id = offering.id AND (grade->>'participantId' = 'admission:' || record.id::text
            OR grade->>'participantId' = 'student:' || record.student_id::text)
            AND (jsonb_typeof(grade->'testScore') = 'number' OR jsonb_typeof(grade->'assignmentScore') = 'number'
              OR jsonb_typeof(grade->'examScore') = 'number')) THEN 'studying' ELSE 'not_started' END AS phase,
      COALESCE((SELECT jsonb_agg(grade) FROM course_exam_gradebooks book CROSS JOIN LATERAL jsonb_array_elements(book.grades) grade
        WHERE book.course_offering_id = offering.id AND (grade->>'participantId' = 'admission:' || record.id::text
          OR grade->>'participantId' = 'student:' || record.student_id::text)), '[]'::jsonb) AS grades
      FROM admission_records record CROSS JOIN course_offerings offering
      JOIN subjects subject ON subject.id = offering.subject_id
      LEFT JOIN course_offering_class_groups link ON link.course_offering_id = offering.id
      LEFT JOIN class_groups groups ON groups.id = link.class_group_id
      WHERE record.id = :recordId
        AND (offering.status = 'active' OR offering.completed_at >= CAST(:effectiveAt AS timestamptz))
        AND (EXISTS (SELECT 1 FROM class_group_members member WHERE member.class_group_id = link.class_group_id
          AND (member.admission_record_id = record.id OR member.student_id = record.student_id)
          AND (link.participant_ids IS NULL OR ('admission:' || record.id::text) = ANY(link.participant_ids)
            OR ('student:' || record.student_id::text) = ANY(link.participant_ids)))
          OR EXISTS (SELECT 1 FROM course_offering_students individual WHERE individual.course_offering_id = offering.id
            AND individual.admission_record_id = record.id))
        AND NOT EXISTS (SELECT 1 FROM course_offering_withdrawals prior
          WHERE prior.admission_record_id = record.id AND prior.course_offering_id = offering.id)
      ORDER BY offering.id, link.class_group_id`, { recordId, effectiveAt }, transaction);
  }

  async detail(recordId: string) {
    const [record] = await this.select('SELECT id FROM admission_records WHERE id = :id', { id: recordId });
    if (!record) throw new NotFoundException('Không tìm thấy học viên.');
    const leaves = await this.select(`SELECT ${columns}, CASE
        WHEN status = 'approved' AND start_date > ${BUSINESS_DATE_SQL} THEN 'scheduled'
        WHEN status = 'approved' AND end_date < ${BUSINESS_DATE_SQL} THEN 'overdue'
        WHEN status = 'approved' THEN 'active' ELSE status END AS "effectiveStatus"
      FROM study_leaves WHERE admission_record_id = :recordId ORDER BY created_at DESC, id`, { recordId });
    const withdrawals = await this.select(`SELECT study_leave_id AS "studyLeaveId", effective_date::text AS "effectiveDate", snapshot
      FROM course_offering_withdrawals WHERE admission_record_id = :recordId ORDER BY created_at, id`, { recordId });
    return { leaves: leaves.map(leave => ({ ...leave, withdrawals: withdrawals.filter(row => row.studyLeaveId === leave.id) })),
      affectedOfferings: await this.affected(recordId) };
  }

  async list(query: { status?: string; search?: string; page?: string; pageSize?: string }) {
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize || '', 10) || 20));
    const page = Math.min(1000000, Math.max(1, Number.parseInt(query.page || '', 10) || 1));
    const rows = await this.select(`WITH leaves AS (
      SELECT leave.id, leave.admission_record_id AS "admissionRecordId", record.code, record.full_name AS "fullName",
        record.training_level AS "trainingLevel", record.study_status AS "studyStatus", record.academic_year AS "academicYear",
        (SELECT string_agg(DISTINCT groups.code, ', ') FROM class_group_members member JOIN class_groups groups ON groups.id = member.class_group_id
          WHERE member.admission_record_id = record.id OR member.student_id = record.student_id) AS "classCode",
        leave.start_date::text AS "startDate", leave.end_date::text AS "endDate", leave.reason,
        leave.extensions, GREATEST(0, ${BUSINESS_DATE_SQL} - leave.end_date) AS "overdueDays",
        CASE WHEN leave.status = 'approved' AND leave.start_date > ${BUSINESS_DATE_SQL} THEN 'scheduled'
          WHEN leave.status = 'approved' AND leave.end_date < ${BUSINESS_DATE_SQL} THEN 'overdue'
          WHEN leave.status = 'approved' AND leave.end_date <= ${BUSINESS_DATE_SQL} + 30 THEN 'expiring'
          WHEN leave.status = 'approved' THEN 'active' ELSE leave.status END AS status,
        leave.created_at FROM study_leaves leave JOIN admission_records record ON record.id = leave.admission_record_id
      WHERE (:search = '' OR record.full_name ILIKE :pattern OR record.code ILIKE :pattern)
    ), filtered AS (SELECT * FROM leaves WHERE (:status = '' OR status = :status
      OR (:status = 'extension_pending' AND EXISTS (SELECT 1 FROM jsonb_array_elements(extensions) extension WHERE extension->>'status' = 'pending'))))
    SELECT (SELECT COUNT(*)::int FROM filtered) AS total,
      COALESCE((SELECT jsonb_agg(row) FROM (SELECT * FROM filtered ORDER BY created_at DESC, id LIMIT :limit OFFSET :offset) row), '[]') AS rows`, {
      search: (query.search || '').trim(), pattern: `%${(query.search || '').trim().slice(0, 100)}%`, status: query.status || '', limit: pageSize, offset: (page - 1) * pageSize,
    });
    return { ...(rows[0] || { total: 0, rows: [] }), page, pageSize };
  }

  async request(recordId: string, dto: RequestStudyLeaveDto, actor: any) {
    this.requireNote(dto.reason); this.dates(dto.startDate, dto.endDate);
    if (dto.startDate < businessDate()) throw new BadRequestException('Ngày bắt đầu bảo lưu không được trước hôm nay.');
    await this.db.transaction(async transaction => {
      const [record] = await this.select('SELECT id, study_status FROM admission_records WHERE id = :id FOR UPDATE', { id: recordId }, transaction);
      if (!record) throw new NotFoundException('Không tìm thấy học viên.');
      if (record.study_status !== 'Đang học') throw new ConflictException('Chỉ tạo yêu cầu bảo lưu cho học viên đang học.');
      const open = await this.select("SELECT id FROM study_leaves WHERE admission_record_id = :id AND status IN ('pending','approved')", { id: recordId }, transaction);
      if (open.length) throw new ConflictException('Học viên đang có yêu cầu hoặc đợt bảo lưu chưa kết thúc.');
      const transfers = await this.select("SELECT id FROM major_transfers WHERE admission_record_id = :id AND status = 'pending'", { id: recordId }, transaction);
      if (transfers.length) throw new ConflictException('Cần xử lý yêu cầu chuyển chuyên ngành trước khi bảo lưu.');
      await this.write(`INSERT INTO study_leaves (id, admission_record_id, reason, start_date, end_date, history)
        VALUES (:id,:recordId,:reason,:startDate,:endDate,CAST(:history AS jsonb))`, {
        id: randomUUID(), recordId, reason: dto.reason.trim(), startDate: dto.startDate, endDate: dto.endDate,
        history: JSON.stringify([this.event('requested', actor, dto.reason)]),
      }, transaction);
    });
    return this.detail(recordId);
  }

  async action(id: string, dto: StudyLeaveActionDto, actor: any) {
    let recordId = '';
    await this.db.transaction(async transaction => {
      // Same order as synchronization prevents an approval/date rollover race.
      await this.write('SELECT pg_advisory_xact_lock(21026)', {}, transaction);
      const [leave] = await this.select(`SELECT ${columns} FROM study_leaves WHERE id = :id FOR UPDATE`, { id }, transaction);
      if (!leave) throw new NotFoundException('Không tìm thấy yêu cầu bảo lưu.');
      recordId = leave.admissionRecordId;
      const [record] = await this.select('SELECT id, study_status FROM admission_records WHERE id = :id FOR UPDATE', { id: recordId }, transaction);
      const today = businessDate();
      const extensions: any[] = leave.extensions || [];
      let state = leave.status; let endDate = leave.endDate; let closedDate = leave.closedDate;
      if (['approve', 'reject'].includes(dto.action)) {
        if (state !== 'pending') throw new ConflictException('Yêu cầu đã được xử lý. Hãy tải lại.');
        if (dto.action === 'approve') {
          if (record.study_status !== 'Đang học') throw new ConflictException('Học viên không còn ở trạng thái đang học.');
          if (leave.startDate < today) throw new ConflictException('Ngày bắt đầu đã qua. Hãy từ chối và tạo yêu cầu với thời gian mới.');
          state = 'approved';
        } else { this.requireNote(dto.note); state = 'rejected'; }
      } else {
        if (state !== 'approved') throw new ConflictException('Đợt bảo lưu chưa được duyệt hoặc đã kết thúc.');
        if (leave.startDate > today) throw new ConflictException('Đợt bảo lưu chưa đến ngày hiệu lực.');
        await this.activate(leave, transaction);
        if (dto.action === 'request_extension') {
          this.requireNote(dto.note); this.dates(leave.startDate, dto.endDate || '');
          if (extensions.some(row => row.status === 'pending')) throw new ConflictException('Đã có yêu cầu gia hạn đang chờ duyệt.');
          if (dto.endDate! <= endDate || dto.endDate! < today) throw new BadRequestException('Hạn mới phải sau hạn cũ và không trước hôm nay.');
          extensions.push({ id: randomUUID(), endDate: dto.endDate, previousEndDate: endDate,
            reason: dto.note!.trim(), status: 'pending', requestedAt: new Date().toISOString(), requestedBy: this.event('request_extension', actor).actor });
        } else if (['approve_extension', 'reject_extension'].includes(dto.action)) {
          const pending = extensions.find(row => row.status === 'pending');
          if (!pending) throw new ConflictException('Không có yêu cầu gia hạn chờ duyệt.');
          if (dto.action === 'approve_extension') {
            if (pending.endDate < today) throw new ConflictException('Hạn gia hạn đã qua, cần tạo yêu cầu mới.');
            endDate = pending.endDate;
          } else this.requireNote(dto.note);
          Object.assign(pending, { status: dto.action === 'approve_extension' ? 'approved' : 'rejected',
            decidedAt: new Date().toISOString(), decidedBy: this.event(dto.action, actor).actor, decisionNote: dto.note?.trim() || '' });
        } else if (['resume', 'withdraw'].includes(dto.action)) {
          this.requireNote(dto.note); state = dto.action === 'resume' ? 'resumed' : 'withdrawn'; closedDate = today;
          for (const pending of extensions.filter(row => row.status === 'pending')) Object.assign(pending, { status: 'cancelled', decisionNote: 'Đợt bảo lưu đã kết thúc.' });
          await this.write('UPDATE admission_records SET study_status = :status, updated_at = NOW() WHERE id = :id', {
            id: recordId, status: state === 'resumed' ? 'Đang học' : 'Thôi học',
          }, transaction);
        } else throw new BadRequestException('Thao tác không hợp lệ.');
      }
      const decisionEvent = this.event(dto.action, actor, dto.note, { endDate });
      await this.write(`UPDATE study_leaves SET status = :status, end_date = :endDate, closed_date = :closedDate,
        extensions = CAST(:extensions AS jsonb), decision_note = :note,
        history = history || CAST(:event AS jsonb), updated_at = NOW() WHERE id = :id`, {
        id, status: state, endDate, closedDate: closedDate || null, note: dto.note?.trim() || '',
        extensions: JSON.stringify(extensions), event: JSON.stringify([decisionEvent]),
      }, transaction);
      if (dto.action === 'approve') await this.withdrawOnApproval({ ...leave,
        history: [...(leave.history || []), decisionEvent] }, transaction);
      if (state === 'approved' && leave.startDate <= today) await this.activate({ ...leave, endDate,
        history: [...(leave.history || []), decisionEvent],
        activatedAt: dto.action === 'approve' ? leave.activatedAt : leave.activatedAt || new Date() }, transaction);
    });
    await this.synchronize();
    return this.detail(recordId);
  }
}
