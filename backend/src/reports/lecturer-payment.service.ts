import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { LecturerPaymentQueryDto, UpdateLecturerPaymentDto } from './dto/lecturer-payment.dto.js';

// Aggregate links separately so joining multiple groups never multiplies the session count.
const PARTICIPATING_GROUPS_SQL = `SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id',g.id,'code',g.code,'name',g.name) ORDER BY COALESCE(NULLIF(g.code,''),g.name),g.id),'[]'::jsonb) AS groups,
  COALESCE(string_agg(COALESCE(g.code,'') || ' ' || COALESCE(g.name,''),' '),'') AS search
  FROM course_offering_class_groups link JOIN class_groups g ON g.id=link.class_group_id
  WHERE link.course_offering_id=t."courseOfferingId"`;

// Count confirmed, actually held sessions at the saved completion time. Never infer completion.
export const PAYMENT_SESSIONS_SQL = `
  FROM course_offerings o
  JOIN teaching_sessions s ON s.course_offering_id=o.id AND s.status='held'
    AND s.confirmed_at<=o.completed_at AND s.created_at<=o.completed_at
    AND (s.session_date + s.end_time) AT TIME ZONE 'Asia/Ho_Chi_Minh' <= o.completed_at
  JOIN lecturers l ON l.id=s.lecturer_id
  JOIN subjects subject ON subject.id=o.subject_id
  WHERE o.status='completed' AND o.completed_at IS NOT NULL`;

@Injectable()
export class LecturerPaymentService {
  private readonly fallbackSecret = randomBytes(32);
  constructor(@InjectConnection() private readonly db: Sequelize, private readonly config?: ConfigService) {}

  async list(query: LecturerPaymentQueryDto = {}, transaction?: Transaction) {
    if (query.from && query.to && query.from.slice(0, 10) > query.to.slice(0, 10)) {
      throw new BadRequestException('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
    }
    const data = await this.db.query<any>(`WITH teaching AS (
      SELECT o.id AS "courseOfferingId", l.id AS "lecturerId", l.name AS "lecturerName",
        l.unit_id AS "unitId", o.name AS "offeringName",
        o.completed_at AS "completedAt", COUNT(s.id)::integer AS "sessionCount"
      ${PAYMENT_SESSIONS_SQL}
      GROUP BY o.id,l.id,subject.name
    ) SELECT t.*,groups.groups AS "participatingGroups",COALESCE(p.paid,false) AS paid,
      p.payment_date::text AS "paymentDate",COALESCE(p.note,'') AS note,
      p.updated_by_staff_id AS "updatedByStaffId",p.updated_at::text AS "paymentVersion" FROM teaching t
      LEFT JOIN lecturer_payments p ON p.course_offering_id=t."courseOfferingId" AND p.lecturer_id=t."lecturerId"
      LEFT JOIN LATERAL (${PARTICIPATING_GROUPS_SQL}) groups ON true
      WHERE (:from IS NULL OR (t."completedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date>=CAST(:from AS date))
        AND (:to IS NULL OR (t."completedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date<=CAST(:to AS date))
        AND (:unitId IS NULL OR t."unitId"=CAST(:unitId AS uuid))
        AND (:lecturerId IS NULL OR t."lecturerId"=CAST(:lecturerId AS uuid))
        AND (:paymentStatus = 'all' OR COALESCE(p.paid,false)=(:paymentStatus = 'paid'))
        AND (:search = '' OR POSITION(LOWER(:search) IN LOWER(t."lecturerName" || ' ' || COALESCE(t."offeringName",'') || ' ' || groups.search))>0)
      ORDER BY t."completedAt" DESC,t."lecturerName",t."courseOfferingId",t."lecturerId"`, {
      type: QueryTypes.SELECT, transaction,
      replacements: { from: query.from?.slice(0,10) || null, to: query.to?.slice(0,10) || null,
        unitId: query.unitId || null, lecturerId: query.lecturerId || null,
        paymentStatus: query.paymentStatus || 'all', search: query.search?.trim() || '' },
    });
    return { rows: data };
  }

  async options() {
    const lecturers = await this.db.query(`SELECT DISTINCT l.id,l.name,l.unit_id AS "unitId"
      ${PAYMENT_SESSIONS_SQL} ORDER BY l.name,l.id`, { type: QueryTypes.SELECT });
    const units = await this.db.query(`SELECT id,name FROM units ORDER BY name,id`, { type: QueryTypes.SELECT });
    return { lecturers, units };
  }

  async update(courseOfferingId: string, lecturerId: string, input: UpdateLecturerPaymentDto, actorId: string) {
    if (typeof input.paid !== 'boolean' || (input.paymentVersion !== null && typeof input.paymentVersion !== 'string')) {
      throw new BadRequestException('Trạng thái và phiên bản thanh toán không hợp lệ.');
    }
    if (input.note !== undefined && (typeof input.note !== 'string' || [...input.note].length > 2000)) {
      throw new BadRequestException('Ghi chú phải là văn bản tối đa 2.000 ký tự.');
    }
    if (input.paymentDate != null) this.validateDate(input.paymentDate);
    return this.db.transaction(async transaction => {
      await this.lockPair(courseOfferingId, lecturerId, transaction);
      const [current] = await this.db.query<any>(`SELECT paid,payment_date::text AS "paymentDate",note,
        updated_at::text AS "paymentVersion" FROM lecturer_payments
        WHERE course_offering_id=:courseOfferingId AND lecturer_id=:lecturerId FOR UPDATE`, {
        type: QueryTypes.SELECT, transaction, replacements: { courseOfferingId, lecturerId },
      });
      if ((current?.paymentVersion ?? null) !== input.paymentVersion) {
        throw new ConflictException('Dữ liệu đã được người khác cập nhật. Hãy tải lại để xem bản mới; nội dung đang nhập vẫn được giữ.');
      }
      const paymentDate = input.paid ? input.paymentDate === undefined ? current?.paymentDate ?? null : input.paymentDate : null;
      // Allow a note-only edit on historical paid rows, but never create a new paid state without a date.
      if (input.paid && !paymentDate && (!current?.paid || input.paymentDate !== undefined)) {
        throw new BadRequestException('Hãy nhập ngày thanh toán thực tế hợp lệ.');
      }
      return this.write(courseOfferingId, lecturerId, input.paid, actorId, transaction,
        { paid: current?.paid ?? false, paymentVersion: input.paymentVersion }, {},
        { paymentDate, note: input.note ?? current?.note ?? '' });
    });
  }

  private validateDate(value: string) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000') ||
      !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) !== value) {
      throw new BadRequestException('Ngày thanh toán phải là ngày hợp lệ theo yyyy-mm-dd.');
    }
  }

  private sign(payload: string) {
    return createHmac('sha256', this.config?.get<string>('SESSION_SECRET') || this.fallbackSecret)
      .update('lecturer-payment-batch:').update(payload).digest('base64url');
  }

  async previewBatch(filters: LecturerPaymentQueryDto, paid: boolean, actorId: string, paymentDate?: string) {
    if (paid) this.validateDate(paymentDate!);
    const { rows } = await this.list(filters);
    const targets = rows.filter(row => row.paid !== paid).map(row => ({
      courseOfferingId: row.courseOfferingId, lecturerId: row.lecturerId,
      paid: row.paid, paymentVersion: row.paymentVersion,
    }));
    if (targets.length > 10000) throw new BadRequestException('Hãy thu hẹp bộ lọc xuống tối đa 10.000 bản ghi thay đổi.');
    const payload = Buffer.from(JSON.stringify({ actorId, filters, paid, paymentDate, targets, expires: Date.now() + 10 * 60 * 1000 })).toString('base64url');
    return { token: `${payload}.${this.sign(payload)}`, count: targets.length, total: rows.length, unchanged: rows.length - targets.length };
  }

  async applyBatch(token: string, actorId: string) {
    const [payload, signature, extra] = token.split('.');
    const expected = payload ? this.sign(payload) : '';
    if (!signature || extra || !/^[A-Za-z0-9_-]{43}$/.test(signature) || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw new BadRequestException('Xác nhận thanh toán không hợp lệ. Hãy chọn lại phạm vi.');
    }
    let snapshot: { actorId: string; expires: number; paid: boolean; paymentDate?: string; filters: LecturerPaymentQueryDto;
      targets: Array<{ courseOfferingId: string; lecturerId: string; paid: boolean; paymentVersion: string | null }> };
    try { snapshot = JSON.parse(Buffer.from(payload, 'base64url').toString()); }
    catch { throw new BadRequestException('Xác nhận thanh toán không hợp lệ.'); }
    if (snapshot.actorId !== actorId || snapshot.expires < Date.now()) {
      throw new ConflictException('Xác nhận đã hết hạn hoặc không thuộc tài khoản hiện tại. Hãy chọn lại phạm vi.');
    }
    if (snapshot.paid) this.validateDate(snapshot.paymentDate!);
    return this.db.transaction(async transaction => {
      const targets = [...snapshot.targets].sort((a, b) => `${a.courseOfferingId}:${a.lecturerId}`.localeCompare(`${b.courseOfferingId}:${b.lecturerId}`));
      for (const target of targets) await this.lockPair(target.courseOfferingId, target.lecturerId, transaction);
      const current = new Map((await this.list(snapshot.filters, transaction)).rows.map(row => [`${row.courseOfferingId}:${row.lecturerId}`, row]));
      for (const target of targets) {
        const row = current.get(`${target.courseOfferingId}:${target.lecturerId}`);
        if (!row || row.paid !== target.paid || row.paymentVersion !== target.paymentVersion) {
          throw new ConflictException('Dữ liệu hoặc phạm vi thanh toán đã thay đổi. Chưa cập nhật bản ghi nào; hãy xác nhận lại.');
        }
      }
      const rows = [];
      for (const target of targets) {
        const saved = await this.write(target.courseOfferingId, target.lecturerId, snapshot.paid, actorId, transaction, target, snapshot.filters,
          { paymentDate: snapshot.paid ? snapshot.paymentDate! : null });
        rows.push({ courseOfferingId: target.courseOfferingId, lecturerId: target.lecturerId, ...saved });
      }
      return { updated: rows.length, rows };
    });
  }

  private async lockPair(courseOfferingId: string, lecturerId: string, transaction: Transaction) {
    await this.db.query('SELECT pg_advisory_xact_lock(hashtextextended(:pair, 9026))', {
      transaction, replacements: { pair: `${courseOfferingId}:${lecturerId}` }, type: QueryTypes.SELECT,
    });
  }

  private async write(courseOfferingId: string, lecturerId: string, paid: boolean, actorId: string, transaction: Transaction,
    expected?: { paid: boolean; paymentVersion: string | null }, filters: LecturerPaymentQueryDto = {},
    details: { paymentDate: string | null; note?: string } = { paymentDate: null }) {
    // One atomic statement validates the exact pair and preserves all other payment records.
    const result = await this.db.query<any>(`INSERT INTO lecturer_payments
      (course_offering_id,lecturer_id,paid,payment_date,note,updated_by_staff_id,created_at,updated_at)
      SELECT o.id,l.id,:paid,CAST(:paymentDate AS date),:note,:actorId,now(),now() ${PAYMENT_SESSIONS_SQL}
        AND o.id=:courseOfferingId AND l.id=:lecturerId
        AND (:unitId IS NULL OR l.unit_id=CAST(:unitId AS uuid))
        AND (:lecturerFilter IS NULL OR l.id=CAST(:lecturerFilter AS uuid))
        AND (:from IS NULL OR (o.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date>=CAST(:from AS date))
        AND (:to IS NULL OR (o.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date<=CAST(:to AS date))
        AND (:search = '' OR POSITION(LOWER(:search) IN LOWER(l.name || ' ' || COALESCE(o.name,'') || ' ' ||
          COALESCE((SELECT string_agg(COALESCE(g.code,'') || ' ' || COALESCE(g.name,''),' ')
            FROM course_offering_class_groups link JOIN class_groups g ON g.id=link.class_group_id WHERE link.course_offering_id=o.id),'')))>0)
        AND (:checkVersion = false OR
          (:expectedVersion IS NULL AND NOT EXISTS (SELECT 1 FROM lecturer_payments p WHERE p.course_offering_id=o.id AND p.lecturer_id=l.id)) OR
          EXISTS (SELECT 1 FROM lecturer_payments p WHERE p.course_offering_id=o.id AND p.lecturer_id=l.id
            AND p.updated_at::text=:expectedVersion AND p.paid=:expectedPaid))
        GROUP BY o.id,l.id
      ON CONFLICT(course_offering_id,lecturer_id) DO UPDATE SET paid=EXCLUDED.paid,
        payment_date=EXCLUDED.payment_date,note=CASE WHEN :writeNote THEN EXCLUDED.note ELSE lecturer_payments.note END,
        updated_by_staff_id=EXCLUDED.updated_by_staff_id,updated_at=clock_timestamp()
      WHERE :checkVersion = false OR (lecturer_payments.updated_at::text=:expectedVersion AND lecturer_payments.paid=:expectedPaid)
      RETURNING paid,payment_date::text AS "paymentDate",note,updated_by_staff_id AS "updatedByStaffId",
        updated_at::text AS "paymentVersion"`, { type: QueryTypes.SELECT, transaction,
      replacements: { courseOfferingId, lecturerId, paid, actorId, checkVersion: !!expected,
        expectedVersion: expected?.paymentVersion ?? null, expectedPaid: expected?.paid ?? false,
        paymentDate: details.paymentDate, note: details.note ?? '', writeNote: details.note !== undefined,
        unitId: filters.unitId || null, lecturerFilter: filters.lecturerId || null,
        from: filters.from?.slice(0, 10) || null, to: filters.to?.slice(0, 10) || null, search: filters.search?.trim() || '' } });
    if (!result.length) {
      if (expected) throw new ConflictException('Dữ liệu thanh toán đã thay đổi; toàn bộ thao tác đã được hủy.');
      throw new NotFoundException('Không tìm thấy giảng viên trong lớp học phần đã hoàn thành.');
    }
    return result[0];
  }
}
