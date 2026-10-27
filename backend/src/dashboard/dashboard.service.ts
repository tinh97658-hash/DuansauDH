import { Injectable } from "@nestjs/common";
import { RbacService } from "../auth/rbac.service.js";
import { canWriteScheduling } from "../common/scheduling-write.guard.js";
import { Staff } from "../database/models/staff.model.js";
import { MastersService } from "../masters/masters.service.js";
import { SchedulingService } from "../scheduling/scheduling.service.js";
import { SystemService } from "../system/system.service.js";
import { ExamGradebookService } from "../masters/exam-gradebook.service.js";
import { businessCalendarDaysSince } from "../scheduling/scheduling-time.js";

export const operationalPermissions = (user: unknown, permissions: Set<string>, readOnly = false) => {
  const can = (...required: string[]) => user instanceof Staff && required.every((permission) => permissions.has(permission));
  return {
    grouping: !readOnly && can("masters.view", "masters.manage"),
    grades: !readOnly && can("gradebook.view", "gradebook.submit"),
    scheduling: !readOnly && can("scheduling.view", "scheduling.write") && canWriteScheduling(user, permissions),
    progress: !readOnly && can("scheduling.view", "scheduling.write") && canWriteScheduling(user, permissions),
    overview: can("scheduling.view"),
  };
};

const href = (path: string, params: Record<string, string>) => `${path}?${new URLSearchParams(params)}`;
const plain = (value: any) => typeof value?.get === "function" ? value.get({ plain: true }) : value;
const scopeGroup = (offering: any, year: string) => (offering.groupLinks || []).map((link: any) => link.classGroup)
  .find((group: any) => group?.academicYear === year);
export type DashboardSection = "grouping" | "teaching" | "grades";

@Injectable()
export class DashboardService {
  constructor(
    private readonly masters: MastersService,
    private readonly scheduling: SchedulingService,
    private readonly system: SystemService,
    private readonly rbac: RbacService,
    private readonly gradebooks: ExamGradebookService,
  ) {}

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
      ...(permissions.progress ? { progress: { count: pending.length, itemCount: pending.length,
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
      if (!state.componentsEntered) { index = 0; at = state.completedTeachingAt; milestone = 'Hoàn thành môn học'; }
      else if (state.componentsApproved && state.candidateCount > 0 && !state.examCompleted) { index = 1; at = state.componentScoreApprovedAt; milestone = 'Điểm thành phần được duyệt'; }
      else if (state.examCompleted && !state.examGradesComplete) { index = 2; at = state.examCompletedAt; milestone = 'Thi xong'; }
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

  async operational(user: unknown, year: string, section?: DashboardSection) {
    const access = user instanceof Staff ? await this.rbac.effectiveAccess(user) : { permissions: new Set<string>(), groupScope: undefined };
    const permissions = operationalPermissions(user, access.permissions, access.groupScope?.readOnly);
    let majorsPromise: Promise<any[]> | undefined;
    const majors = () => majorsPromise ||= this.system.listMajors("masters").then((rows) => rows.map(plain));
    const loaders: Partial<Record<DashboardSection, () => Promise<any>>> = {
      ...(permissions.grouping ? { grouping: () => this.grouping(year, majors()) } : {}),
      ...(permissions.scheduling || permissions.progress || permissions.overview ? { teaching: () => this.teaching(year, permissions) } : {}),
      ...(permissions.grades ? { grades: () => this.grades(year) } : {}),
    };
    const entries = Object.entries(loaders).filter(([key]) => !section || section === key);
    const results = await Promise.allSettled(entries.map(([, loader]) => loader()));
    return { year, permissions, sources: Object.fromEntries(entries.map(([key], index) => {
      const result = results[index];
      return [key, result.status === "fulfilled" ? { status: "ready", data: result.value }
        : { status: "error", message: "Không thể tải dữ liệu công việc. Vui lòng thử lại." }];
    })) };
  }
}
