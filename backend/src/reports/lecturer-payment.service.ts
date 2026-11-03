import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { LecturerPaymentQueryDto } from './dto/lecturer-payment.dto.js';

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
  constructor(@InjectConnection() private readonly db: Sequelize) {}

  async list(query: LecturerPaymentQueryDto = {}) {
    if (query.from && query.to && query.from.slice(0, 10) > query.to.slice(0, 10)) {
      throw new BadRequestException('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
    }
    const data = await this.db.query<any>(`WITH teaching AS (
      SELECT o.id AS "courseOfferingId", l.id AS "lecturerId", l.name AS "lecturerName",
        l.unit_id AS "unitId", COALESCE(NULLIF(o.name,''),subject.name) AS "offeringName",
        o.completed_at AS "completedAt", COUNT(s.id)::integer AS "sessionCount"
      ${PAYMENT_SESSIONS_SQL}
      GROUP BY o.id,l.id,subject.name
    ) SELECT t.*,COALESCE(p.paid,false) AS paid FROM teaching t
      LEFT JOIN lecturer_payments p ON p.course_offering_id=t."courseOfferingId" AND p.lecturer_id=t."lecturerId"
      WHERE (:from IS NULL OR (t."completedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date>=CAST(:from AS date))
        AND (:to IS NULL OR (t."completedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date<=CAST(:to AS date))
        AND (:unitId IS NULL OR t."unitId"=CAST(:unitId AS uuid))
        AND (:lecturerId IS NULL OR t."lecturerId"=CAST(:lecturerId AS uuid))
        AND (:paymentStatus = 'all' OR COALESCE(p.paid,false)=(:paymentStatus = 'paid'))
        AND (:search = '' OR POSITION(LOWER(:search) IN LOWER(t."lecturerName" || ' ' || t."offeringName"))>0)
      ORDER BY t."completedAt" DESC,t."lecturerName",t."courseOfferingId",t."lecturerId"`, {
      type: QueryTypes.SELECT,
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

  async update(courseOfferingId: string, lecturerId: string, paid: boolean, actorId: string) {
    // One atomic statement validates the exact pair and preserves all other payment records.
    const result = await this.db.query<any>(`INSERT INTO lecturer_payments
      (course_offering_id,lecturer_id,paid,updated_by_staff_id,created_at,updated_at)
      SELECT o.id,l.id,:paid,:actorId,now(),now() ${PAYMENT_SESSIONS_SQL}
        AND o.id=:courseOfferingId AND l.id=:lecturerId GROUP BY o.id,l.id
      ON CONFLICT(course_offering_id,lecturer_id) DO UPDATE SET paid=EXCLUDED.paid,
        updated_by_staff_id=EXCLUDED.updated_by_staff_id,updated_at=now()
      RETURNING paid`, { type: QueryTypes.SELECT, replacements: { courseOfferingId, lecturerId, paid, actorId } });
    if (!result.length) throw new NotFoundException('Không tìm thấy giảng viên trong lớp học phần đã hoàn thành.');
    return result[0];
  }
}
