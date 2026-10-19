import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ROLES_KEY } from "../common/auth-user.js";
import { canWriteScheduling } from "../common/scheduling-write.guard.js";
import { Staff } from "../database/models/staff.model.js";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { MastersController } from "../masters/masters.controller.js";
import { MastersService } from "../masters/masters.service.js";
import { SchedulingController } from "../scheduling/scheduling.controller.js";
import { SchedulingService } from "../scheduling/scheduling.service.js";
import { SystemService } from "../system/system.service.js";

export const operationalPermissions = (user: unknown) => {
  const allowed = (controller: any, handler?: any) => {
    const roles: string[] = Reflect.getMetadata(ROLES_KEY, handler || controller) || Reflect.getMetadata(ROLES_KEY, controller) || [];
    return user instanceof Staff && roles.includes(user.role);
  };
  return {
    // Read the same role metadata that RolesGuard uses on the existing write endpoints.
    grouping: allowed(MastersController, MastersController.prototype.assignMembers),
    grades: allowed(MastersController, MastersController.prototype.saveExamLists),
    scheduling: allowed(SchedulingController) && canWriteScheduling(user),
    progress: allowed(SchedulingController) && canWriteScheduling(user),
    overview: user instanceof Staff && user.role === "admin",
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
    @InjectModel(ClassGroup) private readonly groups: typeof ClassGroup,
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
        items: pending.slice(0, 5).map((offering) => ({ ...item(offering),
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

  private async grades(year: string, majorsPromise: Promise<any[]>) {
    const [majors, groups] = await Promise.all([majorsPromise, this.groups.findAll({
      where: { program: "masters", academicYear: year, groupType: "ADMINISTRATIVE" },
      attributes: ["id", "majorId"], raw: true,
    })]);
    const majorIds = new Set(groups.map((group: any) => group.majorId));
    // Let the domain service reject an unsupported/inactive scope; never silently omit it and report a healthy zero.
    const scopes = majors.filter((major) => majorIds.has(major.id));
    const items: any[] = [];
    // Bound service-query concurrency. No grade formula or participant eligibility is reimplemented here.
    for (let index = 0; index < scopes.length; index += 2) {
      const reports = await Promise.all(scopes.slice(index, index + 2).map(async (major) => ({
        major, report: await this.scheduling.getClassCurriculumProgress({ majorId: major.id, academicYear: year }),
      })));
      for (const { major, report } of reports) for (const group of report.classes) {
        const missing = group.subjects.filter((subject) => subject.needsGradeEntry === true);
        if (!missing.length) continue;
        items.push({ id: group.id, title: group.code, detail: `${missing.length} học phần chưa nhập đủ điểm`,
          count: missing.length, unit: "HP",
          // Progress already marks the exact incomplete subject. ExamLists resolves its completed offering.
          href: href("/masters/exam-lists", { year, majorId: major.id, groupId: group.id,
            ...(missing[0].incompleteCourseOfferingId ? { offeringId: missing[0].incompleteCourseOfferingId } : {}),
            subjectId: missing[0].subjectId, logicalSubjectId: missing[0].logicalSubjectId || missing[0].subjectId }),
        });
      }
    }
    items.sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "vi"));
    return { count: items.length, itemCount: items.length, items: items.slice(0, 5),
      href: items[0]?.href || href("/masters/exam-lists", { year }) };
  }

  async operational(user: unknown, year: string, section?: DashboardSection) {
    const permissions = operationalPermissions(user);
    let majorsPromise: Promise<any[]> | undefined;
    const majors = () => majorsPromise ||= this.system.listMajors("masters").then((rows) => rows.map(plain));
    const loaders: Partial<Record<DashboardSection, () => Promise<any>>> = {
      ...(permissions.grouping ? { grouping: () => this.grouping(year, majors()) } : {}),
      ...(permissions.scheduling || permissions.progress || permissions.overview ? { teaching: () => this.teaching(year, permissions) } : {}),
      ...(permissions.grades ? { grades: () => this.grades(year, majors()) } : {}),
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
