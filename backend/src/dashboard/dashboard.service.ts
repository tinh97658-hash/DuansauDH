import { Injectable } from "@nestjs/common";
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

export type DashboardProgram = "masters" | "doctoral";

export const operationalPermissions = (user: unknown, permissions: Set<string>, readOnly = false, program: DashboardProgram = "masters") => {
  const can = (...required: string[]) => user instanceof Staff
    && (program !== "doctoral" || permissions.has("doctoral.view"))
    && required.every((permission) => permissions.has(permission));
  return {
    grouping: !readOnly && can(`${program}.view`, `${program}.manage`),
    grades: !readOnly && can("gradebook.view", "gradebook.submit"),
    approvals: !readOnly && can("gradebook.view", "gradebook.approve"),
    studyLeaveApproval: !readOnly && can("plan.view", "admission.view", "studyleave.approve"),
    majorTransferApproval: !readOnly && can("plan.view", "admission.view", "majortransfer.approve"),
    scheduling: !readOnly && can("scheduling.view", "scheduling.write") && canWriteScheduling(user, permissions),
    progress: !readOnly && can("scheduling.view", "scheduling.write") && canWriteScheduling(user, permissions),
    overview: can("scheduling.view"),
  };
};

const href = (path: string, params: Record<string, string>) => `${path}?${new URLSearchParams(params)}`;
const plain = (value: any) => typeof value?.get === "function" ? value.get({ plain: true }) : value;
const scopeGroup = (offering: any, year: string) => (offering.groupLinks || []).map((link: any) => link.classGroup)
  .find((group: any) => group?.academicYear === year);
export type DashboardSection = "grouping" | "teaching" | "grades" | "approvals" | "studyLeaveApproval" | "majorTransferApproval";

@Injectable()
export class DashboardService {
  constructor(
    private readonly masters: MastersService,
    private readonly scheduling: SchedulingService,
    private readonly system: SystemService,
    private readonly rbac: RbacService,
    private readonly gradebooks: ExamGradebookService,
    private readonly db: Sequelize,
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
      count: learners.filter((learner) => learner.majorId === major.id && !learner.assignedGroup).length,
      href: href("/masters/assign-class-groups", { year, disciplineId: major.disciplineId || major.discipline.id, majorId: major.id }),
    })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "vi"));
    return { count: items.reduce((sum, item) => sum + item.count, 0), itemCount: items.length,
      href: href("/masters/assign-class-groups", { year }), items: items.slice(0, 5) };
  }

  private async teaching(year: string, permissions: ReturnType<typeof operationalPermissions>) {
    const offerings = (await this.scheduling.listCourseOfferings({ program: "masters", academicYear: year })).map(plain);
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
        href: href("/masters/schedule", { year, queue: "unscheduled" }), items: unscheduled.slice(0, 5).map(item) } } : {}),
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

  private async grades(year: string) {
    const offerings = (await this.scheduling.listCourseOfferings({ program: 'masters', academicYear: year })).map(plain);
    const tracking = await this.gradebooks.tracking(offerings, true);
    const warningGroups = [
      { key: 'components', title: 'CHỜ NHẬP ĐIỂM THÀNH PHẦN', items: [] as any[] },
      { key: 'exam', title: 'CHỜ TỔ CHỨC THI', items: [] as any[] },
      { key: 'examGrades', title: 'CHỜ NHẬP ĐIỂM THI', items: [] as any[] },
    ];
    for (const offering of offerings) {
      const state = tracking.get(offering.id);
      if (!state || state.legacy) continue;
      let index: number, at: string | Date | null, milestone: string;
      if (state.gradebookStage === 'components_missing') { index = 0; at = state.completedTeachingAt; milestone = 'Hoàn thành môn học'; }
      else if (state.gradebookStage === 'awaiting_exam') { index = 1; at = state.componentScoreApprovedAt; milestone = 'Điểm thành phần được duyệt'; }
      else if (state.gradebookStage === 'exam_missing') { index = 2; at = state.examCompletedAt; milestone = 'Thi xong'; }
      else continue;
      const group = scopeGroup(offering, year);
      const days = businessCalendarDaysSince(at);
      const params = { year, offeringId: offering.id, ...(group?.id ? { groupId: group.id } : {}), ...(group?.majorId ? { majorId: group.majorId } : {}) };
      warningGroups[index].items.push({ id: offering.id,
        title: [offering.subject?.name, offering.name || group?.code].filter(Boolean).join(' · '),
        detail: days === null ? milestone : `${milestone} ${days} ngày trước`,
        elapsedDays: days, href: href(index === 1 ? '/masters/exam-schedule' : '/masters/exam-lists', params) });
    }
    for (const group of warningGroups) group.items.sort((a, b) => (b.elapsedDays ?? -1) - (a.elapsedDays ?? -1) || a.title.localeCompare(b.title, 'vi'));
    const items = warningGroups[0].items;
    return { count: items.length, itemCount: items.length, items: items.slice(0, 5), warningGroups: warningGroups.slice(1),
      href: items[0]?.href || href("/masters/exam-lists", { year }) };
  }

  private async approvals(year: string) {
    const offerings = (await this.scheduling.listCourseOfferings({ program: 'masters', academicYear: year })).map(plain);
    const tracking = await this.gradebooks.tracking(offerings);
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

  async operational(user: unknown, year: string, section?: DashboardSection, program: DashboardProgram = "masters") {
    const access = user instanceof Staff ? await this.rbac.effectiveAccess(user) : { permissions: new Set<string>(), groupScope: undefined };
    const permissions = operationalPermissions(user, access.permissions, access.groupScope?.readOnly, program);
    let majorsPromise: Promise<any[]> | undefined;
    const majors = () => majorsPromise ||= this.system.listMajors("masters").then((rows) => rows.map(plain));
    // Each program supplies the same section contract. Add doctoral providers here as
    // those workflows ship; never fall back to masters data or fabricated zero counts.
    const providers: Record<DashboardProgram, Partial<Record<DashboardSection, () => Promise<any>>>> = {
      masters: {
        grouping: () => this.grouping(year, majors()),
        teaching: () => this.teaching(year, permissions),
        grades: () => this.grades(year),
        approvals: () => this.approvals(year),
        studyLeaveApproval: () => this.learnerRequests(year, "studyLeaveApproval"),
        majorTransferApproval: () => this.learnerRequests(year, "majorTransferApproval"),
      },
      doctoral: {},
    };
    const enabled: Record<DashboardSection, boolean> = {
      grouping: permissions.grouping, teaching: permissions.scheduling || permissions.progress || permissions.overview,
      grades: permissions.grades, approvals: permissions.approvals,
      studyLeaveApproval: permissions.studyLeaveApproval, majorTransferApproval: permissions.majorTransferApproval,
    };
    const entries = (Object.keys(enabled) as DashboardSection[])
      .filter(key => enabled[key] && (!section || section === key))
      .map(key => [key, providers[program][key]] as const);
    const results = await Promise.allSettled(entries.map(([, loader]) => loader?.()));
    return { year, program, permissions, sources: Object.fromEntries(entries.map(([key, loader], index) => {
      const result = results[index];
      return [key, !loader ? { status: "not_implemented", message: "Chức năng dành cho hệ Tiến sĩ chưa được triển khai." }
        : result.status === "fulfilled" ? { status: "ready", data: result.value }
        : { status: "error", message: "Không thể tải dữ liệu công việc. Vui lòng thử lại." }];
    })) };
  }
}
