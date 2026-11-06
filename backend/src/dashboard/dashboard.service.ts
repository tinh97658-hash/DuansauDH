import { Injectable, Optional } from "@nestjs/common";
import { GroupScopeService } from '../auth/group-scope.service.js';
import { RbacService } from "../auth/rbac.service.js";
import { canWriteScheduling } from "../common/scheduling-write.guard.js";
import { Staff } from "../database/models/staff.model.js";
import { MastersService } from "../masters/masters.service.js";
import { SchedulingService } from "../scheduling/scheduling.service.js";
import { SystemService } from "../system/system.service.js";
import { ExamGradebookService } from "../masters/exam-gradebook.service.js";
import { businessCalendarDaysSince } from "../scheduling/scheduling-time.js";
import { QueryTypes } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { learnerStudyStatusSql } from '../plan/learner-study-status.js';
import { getBusinessWallTime } from '../scheduling/scheduling-time.js';
import { routeViewCode, routeActionCode } from '../auth/route-permissions.js';
import { workingProfileStorage } from '../auth/profile-context.js';

export type DashboardProgram = "masters" | "doctoral";

export const operationalPermissions = (user: unknown, permissions: Set<string>, readOnly = false, program: DashboardProgram = "masters") => {
  const can = (...required: string[]) => user instanceof Staff
    && (program !== "doctoral" || permissions.has("doctoral.view"))
    && required.every((permission) => permissions.has(permission));
  // Internal callers may have legacy grants; HTTP profiles also require the page grant.
  const hasRoutes = !!workingProfileStorage.getStore() || [...permissions].some(permission => permission.startsWith('route.'));
  const page = (path: string, action?: string) => !hasRoutes || (permissions.has(routeViewCode(path))
    && (!action || permissions.has(routeActionCode(path, action))));
  return {
    grouping: !readOnly && can(`${program}.view`, `${program}.manage`) && page(`/${program}/assign-class-groups`, `${program}.manage`),
    grades: !readOnly && can("gradebook.view", "gradebook.submit") && page('/masters/exam-lists', 'gradebook.submit'),
    approvals: !readOnly && can("gradebook.view", "gradebook.approve") && page('/masters/exam-lists', 'gradebook.approve'),
    studyLeaveApproval: !readOnly && can("plan.view", "admission.view", "studyleave.approve") && page('/masters/study-leaves', 'studyleave.approve'),
    majorTransferApproval: !readOnly && can("plan.view", "admission.view", "majortransfer.approve") && page('/plan/admission-records', 'majortransfer.approve'),
    scheduling: !readOnly && can("scheduling.view", "scheduling.write") && canWriteScheduling(user, permissions) && page('/masters/schedule', 'scheduling.write'),
    progress: !readOnly && can("scheduling.view", "scheduling.write") && canWriteScheduling(user, permissions) && page('/masters/schedule', 'scheduling.write'),
    overview: can("scheduling.view") && page('/masters/schedule'),
    learnersOverview: can('admission.view') && page('/plan/admission-records'),
    examsWrite: !readOnly && can('exams.view', 'exams.write') && page('/masters/exam-schedule', 'exams.write'),
    gradebookView: can('gradebook.view') && page('/masters/exam-lists'),
    leaveActivity: can('plan.view') && (can('studyleave.approve') || can('studyleave.request')) && page('/masters/study-leaves'),
    transferActivity: can('admission.view') && (can('majortransfer.approve') || can('majortransfer.request')) && page('/plan/admission-records'),
  };
};

const href = (path: string, params: Record<string, string>) => `${path}?${new URLSearchParams(params)}`;
const plain = (value: any) => typeof value?.get === "function" ? value.get({ plain: true }) : value;
const scopeGroup = (offering: any, year: string) => (offering.groupLinks || []).map((link: any) => link.classGroup)
  .find((group: any) => group?.academicYear === year);
export type DashboardSection = "grouping" | "teaching" | "grades" | "approvals" | "studyLeaveApproval" | "majorTransferApproval"
  | "learnersChart" | "sessionsChart" | "completionChart" | "activity";

@Injectable()
export class DashboardService {
  constructor(
    private readonly masters: MastersService,
    private readonly scheduling: SchedulingService,
    private readonly system: SystemService,
    private readonly rbac: RbacService,
    private readonly gradebooks: ExamGradebookService,
    private readonly db: Sequelize,
    @Optional() private readonly scope?: GroupScopeService,
  ) {}

  private async learnerRequests(year: string, kind: "studyLeaveApproval" | "majorTransferApproval") {
    const leave = kind === "studyLeaveApproval";
    const rows = await this.db.query<any>(leave ? `
      SELECT request.id, record.id AS "recordId", record.full_name AS "fullName", record.code,
        request.reason, request.created_at AS "requestedAt",
        request.status = 'approved' AS "extensionPending"
      FROM study_leaves request JOIN admission_records record ON record.id = request.admission_record_id
      WHERE record.training_level = 'Thạc sĩ' AND record.academic_year = :year
        AND (request.status = 'pending' OR (request.status = 'approved' AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(request.extensions) extension WHERE extension->>'status' = 'pending')))
      ORDER BY request.created_at, request.id` : `
      SELECT request.id, record.id AS "recordId", record.full_name AS "fullName", record.code,
        request.reason, request.requested_at AS "requestedAt", source.name AS "fromMajor", target.name AS "toMajor"
      FROM major_transfers request JOIN admission_records record ON record.id = request.admission_record_id
      JOIN majors source ON source.id = request.from_major_id JOIN majors target ON target.id = request.to_major_id
      WHERE request.status = 'pending' AND record.training_level = 'Thạc sĩ' AND record.academic_year = :year
      ORDER BY request.requested_at, request.id`, { type: QueryTypes.SELECT, replacements: { year } });
    const items = rows.map(row => ({
      id: row.id, title: [row.fullName, row.code].filter(Boolean).join(" · "),
      detail: [leave ? (row.extensionPending ? "Gia hạn bảo lưu chờ duyệt" : "Bảo lưu chờ duyệt")
        : `${row.fromMajor} → ${row.toMajor}`, row.reason].filter(Boolean).join(" · "),
      href: href(leave ? `/masters/study-leaves/${row.recordId}` : `/plan/admission-records/${row.recordId}`,
        { tab: leave ? "leave" : "profile" }),
    }));
    return { count: items.length, itemCount: items.length, items,
      href: items[0]?.href || (leave ? "/masters/study-leaves" : "/plan/admission-records") };
  }

  private async grouping(year: string, majorsPromise: Promise<any[]>) {
    const [majors, learners] = await Promise.all([majorsPromise, this.masters.listEligibleStudents(undefined, year)]);
    // Same major scope and eligible-student service as the assignment summary; tuition is irrelevant.
    const eligibleMajors = majors.filter((major) => major.disciplineId || major.discipline?.id);
    const items = eligibleMajors.map((major) => ({
      id: major.id, title: major.name,
      detail: major.discipline?.name || "", unit: "HV",
      count: new Set(learners.filter((learner) => learner.majorId === major.id && !learner.assignedGroup).map(learner => learner.id)).size,
      href: href("/masters/assign-class-groups", { year, disciplineId: major.disciplineId || major.discipline.id, majorId: major.id }),
    })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "vi"));
    return { count: items.reduce((sum, item) => sum + item.count, 0), itemCount: items.length,
      href: href("/masters/assign-class-groups", { year }), items };
  }

  private async teaching(year: string, permissions: ReturnType<typeof operationalPermissions>, offeringsPromise: Promise<any[]>) {
    const offerings = await offeringsPromise;
    const item = (offering: any) => {
      const group = scopeGroup(offering, year);
      return { id: offering.id, title: offering.name || group?.code || offering.subject?.name || "Lớp học phần",
        detail: [offering.subject?.name, group?.code].filter(Boolean).join(" · "),
        href: href("/masters/schedule", { year, offeringId: offering.id,
          ...(group?.majorId ? { majorId: group.majorId } : {}) }) };
    };
    const active = offerings.filter((offering) => offering.status === "active");
    // No-session is explicit; do not equate not_started curriculum subjects with unscheduled offerings.
    const unscheduled = active.filter((offering) => Number(offering.sessionSummary?.totalCount) === 0);
    const pending = active.filter((offering) => Number(offering.sessionSummary?.pendingCount) > 0)
      .sort((a, b) => Number(b.sessionSummary.pendingCount) - Number(a.sessionSummary.pendingCount));
    return {
      ...(permissions.scheduling ? { scheduling: { count: unscheduled.length, itemCount: unscheduled.length,
        href: href("/masters/schedule", { year, queue: "unscheduled" }), items: unscheduled.map(item) } } : {}),
      ...(permissions.progress ? { progress: { count: pending.reduce((sum, offering) => sum + Number(offering.sessionSummary.pendingCount), 0), itemCount: pending.length,
        href: href("/masters/schedule", { year, queue: "pending-confirmation" }),
        items: pending.map((offering) => ({ ...item(offering),
          count: Number(offering.sessionSummary.pendingCount), unit: "buổi",
          detail: `${offering.sessionSummary.pendingCount} buổi đã qua giờ, chưa xác nhận`,
          href: href("/masters/schedule", { year, offeringId: offering.id, queue: "pending-confirmation" }),
        })) } } : {}),
      ...(permissions.overview ? { overview: {
        active: active.length,
        inProgress: active.filter((offering) => Number(offering.sessionSummary?.heldCount) > 0).length,
        unscheduled: unscheduled.length,
        completed: offerings.filter((offering) => offering.status === "completed").length,
      } } : {}),
    };
  }

  private async grades(year: string, offeringsPromise: Promise<any[]>, trackingPromise: Promise<Map<string, any>>, examsWrite = false) {
    const [offerings, tracking] = await Promise.all([offeringsPromise, trackingPromise]);
    const warningGroups = [
      { key: 'components', title: 'CHỜ NHẬP ĐIỂM THÀNH PHẦN', items: [] as any[] },
      { key: 'exam', title: 'CHỜ TỔ CHỨC THI', items: [] as any[] },
      { key: 'examGrades', title: 'CHỜ NHẬP ĐIỂM THI', items: [] as any[] },
      { key: 'resultReady', title: 'ĐỦ KẾT QUẢ, CHỜ GỬI DUYỆT', items: [] as any[] },
    ];
    const awaitingIds = offerings.filter(offering => tracking.get(offering.id)?.gradebookStage === 'awaiting_exam').map(offering => offering.id);
    const examSessions = awaitingIds.length ? await this.db.query<any>(`SELECT course_offering_id AS "offeringId",
      COUNT(*) FILTER (WHERE (exam_date+end_time) AT TIME ZONE 'Asia/Ho_Chi_Minh' >= now())::int AS "upcomingCount",
      MIN((exam_date+start_time) AT TIME ZONE 'Asia/Ho_Chi_Minh') FILTER
        (WHERE (exam_date+end_time) AT TIME ZONE 'Asia/Ho_Chi_Minh' >= now()) AS "nextExamAt",
      COUNT(*)::int AS "scheduledCount" FROM course_exam_sessions
      WHERE course_offering_id IN (:ids) AND status='scheduled' GROUP BY course_offering_id`,
      { type: QueryTypes.SELECT, replacements: { ids: awaitingIds } }) : [];
    for (const offering of offerings) {
      const state = tracking.get(offering.id);
      if (!state || state.legacy) continue;
      let index: number, at: string | Date | null, milestone: string;
      if (state.gradebookStage === 'components_missing') { index = 0; at = state.completedTeachingAt; milestone = 'Hoàn thành môn học'; }
      else if (state.gradebookStage === 'awaiting_exam') { index = 1; at = state.componentScoreApprovedAt; milestone = 'Điểm thành phần được duyệt'; }
      else if (state.gradebookStage === 'exam_missing') { index = 2; at = state.examCompletedAt; milestone = 'Thi xong'; }
      else if (state.gradebookStage === 'result_ready') { index = 3; at = null; milestone = 'Đã đủ kết quả, có thể gửi duyệt'; }
      else continue;
      const group = scopeGroup(offering, year);
      const exam = examSessions.find(session => session.offeringId === offering.id);
      const upcoming = Number(exam?.upcomingCount) > 0;
      const eligibilityApproved = state.componentsApproved === true || state.eligibilityStatus === 'approved';
      const openExamSchedule = index === 1 && examsWrite && eligibilityApproved;
      const days = index === 1 && upcoming ? null : businessCalendarDaysSince(at);
      const params = { year, offeringId: offering.id, ...(group?.id ? { groupId: group.id } : {}), ...(group?.majorId ? { majorId: group.majorId } : {}) };
      warningGroups[index].items.push({ id: offering.id,
        title: [offering.subject?.name, offering.name || group?.code].filter(Boolean).join(' · '),
        detail: index === 1 ? !eligibilityApproved ? state.eligibilityStatus === 'submitted' ? 'Danh sách thi đang chờ duyệt' : 'Cần gửi duyệt danh sách thi'
          : upcoming ? 'Đã xếp lịch thi sắp tới' : Number(exam?.scheduledCount) > 0
          ? 'Lịch thi đã qua giờ, cần kiểm tra xác nhận' : 'Chưa có lịch thi đang chờ tổ chức'
          : days === null ? milestone : `${milestone} ${days} ngày trước`,
        nextExamAt: upcoming ? exam.nextExamAt : null,
        examScheduled: Number(exam?.scheduledCount) > 0, upcomingExam: upcoming,
        action: openExamSchedule ? !Number(exam?.scheduledCount) ? 'Xếp lịch thi' : 'Xem lịch thi' : index === 3 ? 'Mở để gửi duyệt' : 'Mở bảng điểm',
        elapsedDays: days, href: href(openExamSchedule ? '/masters/exam-schedule' : '/masters/exam-lists', params) });
    }
    for (const group of warningGroups) group.items.sort((a, b) => (b.elapsedDays ?? -1) - (a.elapsedDays ?? -1) || a.title.localeCompare(b.title, 'vi'));
    const items = warningGroups[0].items;
    return { count: items.length, itemCount: items.length, items, warningGroups: warningGroups.slice(1, 3),
      stages: warningGroups.map((group, index) => ({ ...group, stage: ['components_missing', 'awaiting_exam', 'exam_missing', 'result_ready'][index], count: group.items.length })),
      href: items[0]?.href || href("/masters/exam-lists", { year }) };
  }

  private async approvals(year: string, offeringsPromise: Promise<any[]>, trackingPromise: Promise<Map<string, any>>) {
    const [offerings, tracking] = await Promise.all([offeringsPromise, trackingPromise]);
    const eligibility: any[] = [], results: any[] = [], reopens: any[] = [];
    for (const offering of offerings) {
      const state = tracking.get(offering.id);
      if (!state || offering.status !== 'completed') continue;
      const group = scopeGroup(offering, year);
      const url = href('/masters/exam-lists', { year, offeringId: offering.id,
        ...(group?.id ? { groupId: group.id } : {}), ...(group?.majorId ? { majorId: group.majorId } : {}) });
      const item = (at: string | null, label: string) => {
        const days = businessCalendarDaysSince(at);
        return { id: offering.id, title: [offering.subject?.name, offering.name || group?.code].filter(Boolean).join(' · '),
          detail: days === null ? label : `${label} ${days} ngày trước`, elapsedDays: days, href: url };
      };
      if (!state.legacy && state.eligibilityStatus === 'submitted') eligibility.push(item(state.eligibilitySubmittedAt, 'Đã gửi duyệt tư cách thi'));
      if (!state.legacy && state.eligibilityStatus === 'approved' && state.resultStatus !== 'approved' && state.eligibilityCanReopen && state.eligibilityReopenRequest) {
        reopens.push({...item(state.eligibilityReopenRequest.at, 'Đã xin mở lại tư cách thi'), detail: state.eligibilityReopenRequest.note || 'Đã xin mở lại tư cách thi'});
      }
      if (state.resultStatus === 'submitted') results.push(item(state.resultSubmittedAt, 'Đã gửi duyệt khóa điểm'));
    }
    const metric = (items: any[]) => {
      items.sort((a, b) => (b.elapsedDays ?? -1) - (a.elapsedDays ?? -1) || a.title.localeCompare(b.title, 'vi'));
      return { count: items.length, itemCount: items.length, items,
        href: items[0]?.href || href('/masters/exam-lists', { year }) };
    };
    return { eligibilityApproval: metric(eligibility), resultApproval: metric(results), eligibilityReopen: metric(reopens) };
  }

  private async learnersChart(year: string) {
    // Reuse the learner screen's effective study status. One row per admission record, no membership join.
    const rows = await this.db.query<any>(`SELECT r.status AS "admissionStatus",
      ${learnerStudyStatusSql('r')} AS "studyStatus", COUNT(DISTINCT r.id)::int AS count
      FROM admission_records r WHERE r.training_level='Thạc sĩ' AND r.academic_year=:year
      GROUP BY r.status,${learnerStudyStatusSql('r')} ORDER BY count DESC`,
      { type: QueryTypes.SELECT, replacements: { year } });
    return { title: 'Tình trạng hồ sơ / học viên', unit: 'hồ sơ', kind: 'donut',
      description: 'Mỗi hồ sơ được tính một lần theo trạng thái đào tạo hiện tại; nếu chưa có, dùng trạng thái xét tuyển.',
      values: rows.map(row => ({ label: row.studyStatus || row.admissionStatus || 'Chưa xác định', count: Number(row.count) })) };
  }

  private async sessionsChart(year: string) {
    const rows = await this.db.query<any>(`SELECT CASE WHEN ts.status='held' THEN 'Đã diễn ra'
      WHEN ts.status='not_held' THEN 'Không diễn ra'
      WHEN ts.session_date+ts.end_time < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh') THEN 'Qua giờ, chưa xác nhận'
      ELSE 'Sắp diễn ra' END AS label,COUNT(DISTINCT ts.id)::int AS count
      FROM teaching_sessions ts JOIN course_offerings o ON o.id=ts.course_offering_id
      JOIN subjects s ON s.id=o.subject_id
      WHERE s.program='masters' AND ts.status IN ('planned','held','not_held')
        AND ts.session_date >= date_trunc('week',now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
        AND ts.session_date < date_trunc('week',now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+7
        AND EXISTS(SELECT 1 FROM course_offering_class_groups link JOIN class_groups g ON g.id=link.class_group_id
          WHERE link.course_offering_id=o.id AND g.program='masters' AND g.academic_year=:year)
      GROUP BY label`, { type: QueryTypes.SELECT, replacements: { year } });
    return { title: 'Buổi học trong tuần', unit: 'buổi', kind: 'donut',
      description: 'Tuần hiện tại từ thứ Hai đến Chủ nhật, giờ Việt Nam. Chỉ tính buổi có lịch; không gồm lịch đã hủy.', values: rows };
  }

  private async completionChart(year: string) {
    const rows = await this.db.query<any>(`WITH months AS (
      SELECT generate_series(date_trunc('month',now() AT TIME ZONE 'Asia/Ho_Chi_Minh')-interval '5 months',
        date_trunc('month',now() AT TIME ZONE 'Asia/Ho_Chi_Minh'),interval '1 month') AS month
      ) SELECT to_char(m.month,'MM/YYYY') AS label,COUNT(DISTINCT o.id)::int AS count
      FROM months m LEFT JOIN course_offerings o ON o.status='completed' AND o.completed_at IS NOT NULL
        AND date_trunc('month',o.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')=m.month
        AND EXISTS(SELECT 1 FROM subjects s WHERE s.id=o.subject_id AND s.program='masters')
        AND EXISTS(SELECT 1 FROM course_offering_class_groups link JOIN class_groups g ON g.id=link.class_group_id
          WHERE link.course_offering_id=o.id AND g.program='masters' AND g.academic_year=:year)
      GROUP BY m.month ORDER BY m.month`, { type: QueryTypes.SELECT, replacements: { year } });
    return { title: 'Hoàn thành giảng dạy', unit: 'lớp học phần', kind: 'bar',
      description: 'Sáu tháng gần nhất theo ngày xác nhận hoàn thành. Mỗi lớp học phần chỉ tính một lần, kể cả lớp ghép.', values: rows };
  }

  private async gradeActivity(year: string) {
    const rows = await this.db.query<any>(`SELECT e.id,e.action,e.created_at AS at,o.id AS "offeringId",o.name AS title,
      (SELECT g.id FROM course_offering_class_groups link JOIN class_groups g ON g.id=link.class_group_id
        WHERE link.course_offering_id=o.id AND g.academic_year=:year ORDER BY g.id LIMIT 1) AS "groupId"
      FROM gradebook_events e JOIN course_offerings o ON o.id=e.course_offering_id JOIN subjects s ON s.id=o.subject_id
      WHERE e.action IN ('result.submit','result.approve') AND s.program='masters'
        AND EXISTS(SELECT 1 FROM course_offering_class_groups link JOIN class_groups g ON g.id=link.class_group_id
          WHERE link.course_offering_id=o.id AND g.academic_year=:year AND g.program='masters')
      ORDER BY e.created_at DESC,e.id DESC LIMIT 20`, { type: QueryTypes.SELECT, replacements: { year } });
    return rows.map(row => ({ id: `grade:${row.id}`, title: row.title,
      detail: row.action === 'result.submit' ? 'Bảng điểm đã gửi duyệt' : 'Bảng điểm đã duyệt / khóa', at: row.at,
      href: href('/masters/exam-lists', { year, offeringId: row.offeringId, ...(row.groupId ? { groupId: row.groupId } : {}) }) }));
  }

  private async learnerActivity(year: string, leave: boolean) {
    const rows = await this.db.query<any>(leave ? `SELECT l.id,r.id AS "recordId",r.full_name AS title,
      event->>'action' AS action,event->>'at' AS at FROM study_leaves l
      JOIN admission_records r ON r.id=l.admission_record_id CROSS JOIN LATERAL jsonb_array_elements(l.history) event
      WHERE r.training_level='Thạc sĩ' AND r.academic_year=:year
        AND event->>'action' IN ('requested','approve','reject','request_extension','approve_extension','reject_extension')
      ORDER BY event->>'at' DESC,l.id LIMIT 20` : `SELECT t.id,r.id AS "recordId",r.full_name AS title,
      t.status AS action,COALESCE(t.decided_at,t.requested_at) AS at FROM major_transfers t
      JOIN admission_records r ON r.id=t.admission_record_id
      WHERE r.training_level='Thạc sĩ' AND r.academic_year=:year ORDER BY COALESCE(t.decided_at,t.requested_at) DESC,t.id LIMIT 20`,
      { type: QueryTypes.SELECT, replacements: { year } });
    const labels: Record<string, string> = leave ? { requested: 'Yêu cầu bảo lưu', approve: 'Bảo lưu đã duyệt', reject: 'Bảo lưu bị từ chối',
      request_extension: 'Yêu cầu gia hạn bảo lưu', approve_extension: 'Gia hạn đã duyệt', reject_extension: 'Gia hạn bị từ chối' }
      : { pending: 'Yêu cầu chuyển chuyên ngành', approved: 'Chuyển chuyên ngành đã duyệt', rejected: 'Chuyển chuyên ngành bị từ chối' };
    return rows.map(row => ({ id: `${leave ? 'leave' : 'transfer'}:${row.id}:${row.action}:${row.at}`, title: row.title,
      detail: labels[row.action] || 'Yêu cầu đã được cập nhật', at: row.at,
      href: href(leave ? `/masters/study-leaves/${row.recordId}` : `/plan/admission-records/${row.recordId}`, { tab: leave ? 'leave' : 'profile' }) }));
  }

  async operational(user: unknown, year: string, section?: DashboardSection, program: DashboardProgram = "masters") {
    const access = user instanceof Staff ? await this.rbac.effectiveAccess(user) : { permissions: new Set<string>(), roleCodes: [], groupScope: undefined };
    const permissions = operationalPermissions(user, access.permissions, access.groupScope?.readOnly, program);
    // Enter the same existing read domains used by the destination endpoints. Never alter their rules.
    const domainRead = <T>(domain: 'schedule' | 'gradebook' | 'admission' | 'leave' | 'default', work: () => Promise<T>): Promise<T> => {
      if (!this.scope || !(user instanceof Staff)) return work();
      return this.scope.run(user.id, access, () => {
        const context = this.scope!.current();
        if (context) Object.assign(context, domain === 'schedule' ? { schedulingAction: 'view', schedulingView: true }
          : domain === 'gradebook' ? { academicDomain: 'gradebook', academicPermission: 'gradebook.view' }
          : domain === 'admission' ? { admissionAction: 'view' }
          : domain === 'leave' ? { academicDomain: 'studyleave', academicPermission: access.permissions.has('studyleave.approve') ? 'studyleave.approve' : 'studyleave.request' } : {});
        return this.scope!.withReadTransaction(work);
      }, domain === 'schedule', domain === 'schedule' ? 'view' : undefined);
    };
    let majorsPromise: Promise<any[]> | undefined;
    const majors = () => majorsPromise ||= this.system.listMajors("masters").then((rows) => rows.map(plain));
    // Share only within this request, preserving each user's scope and fresh data on refresh.
    const offeringPromises = new Map<string, Promise<any[]>>();
    const offerings = (domain: 'schedule' | 'gradebook' = 'gradebook') => {
      // Without a scope adapter (unit tests), sharing is safe. Real HTTP readers stay in their own domain.
      const key = this.scope ? domain : 'shared';
      if (!offeringPromises.has(key)) offeringPromises.set(key, domainRead(domain, () =>
        this.scheduling.listCourseOfferings({ program: "masters", academicYear: year })).then(rows =>
          [...new Map(rows.map(row => { const value = plain(row); return [value.id, value] as const; })).values()]));
      return offeringPromises.get(key)!;
    };
    let trackingPromise: Promise<Map<string, any>> | undefined;
    const tracking = () => trackingPromise ||= offerings().then(rows =>
      domainRead('gradebook', () => this.gradebooks.tracking(rows, permissions.grades && (!section || section === 'grades'))));
    // Each program supplies the same section contract. Add doctoral providers here as
    // those workflows ship; never fall back to masters data or fabricated zero counts.
    const providers: Record<DashboardProgram, Partial<Record<DashboardSection, () => Promise<any>>>> = {
      masters: {
        grouping: () => domainRead('default', () => this.grouping(year, majors())),
        teaching: () => this.teaching(year, permissions, offerings('schedule')),
        grades: () => domainRead('gradebook', () => this.grades(year, offerings(), tracking(), permissions.examsWrite)),
        approvals: () => this.approvals(year, offerings(), tracking()),
        studyLeaveApproval: () => domainRead('leave', () => this.learnerRequests(year, "studyLeaveApproval")),
        majorTransferApproval: () => domainRead('default', () => this.learnerRequests(year, "majorTransferApproval")),
        learnersChart: () => domainRead('admission', () => this.learnersChart(year)),
        sessionsChart: () => domainRead('schedule', () => this.sessionsChart(year)),
        completionChart: () => domainRead('schedule', () => this.completionChart(year)),
        activity: async () => {
          const loaders = [
            ...(permissions.gradebookView ? [() => domainRead('gradebook', () => this.gradeActivity(year))] : []),
            ...(permissions.leaveActivity ? [() => domainRead('leave', () => this.learnerActivity(year, true))] : []),
            ...(permissions.transferActivity ? [() => domainRead('default', () => this.learnerActivity(year, false))] : []),
          ];
          const results = await Promise.allSettled(loaders.map(load => load()));
          if (results.length && results.every(result => result.status === 'rejected')) throw new Error('Activity unavailable');
          return { items: results.flatMap(result => result.status === 'fulfilled' ? result.value : [])
            .filter(item => item.at && Number.isFinite(new Date(item.at).getTime()))
            .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 20),
            partial: results.some(result => result.status === 'rejected'), readState: 'not_supported' };
        },
      },
      doctoral: {},
    };
    const enabled: Record<DashboardSection, boolean> = {
      grouping: permissions.grouping, teaching: permissions.scheduling || permissions.progress || permissions.overview,
      grades: permissions.grades, approvals: permissions.approvals,
      studyLeaveApproval: permissions.studyLeaveApproval, majorTransferApproval: permissions.majorTransferApproval,
      learnersChart: permissions.learnersOverview, sessionsChart: permissions.overview, completionChart: permissions.overview,
      activity: permissions.gradebookView || permissions.leaveActivity || permissions.transferActivity,
    };
    const entries = (Object.keys(enabled) as DashboardSection[])
      .filter(key => enabled[key] && (section ? section === key : key !== 'activity'))
      .map(key => [key, providers[program][key]] as const);
    const results = await Promise.allSettled(entries.map(([, loader]) => loader?.()));
    return { year, program, permissions, generatedAt: getBusinessWallTime(), sources: Object.fromEntries(entries.map(([key, loader], index) => {
      const result = results[index];
      return [key, !loader ? { status: "not_implemented", message: "Chức năng dành cho hệ Tiến sĩ chưa được triển khai." }
        : result.status === "fulfilled" ? { status: "ready", data: result.value }
        : { status: "error", message: "Không thể tải dữ liệu công việc. Vui lòng thử lại." }];
    })) };
  }
}
