import "reflect-metadata";
import { DEFAULT_ROLE_PERMISSIONS } from "../../src/auth/permissions.js";
import { validate } from "class-validator";
import { Sequelize } from "sequelize-typescript";
import { Staff } from "../../src/database/models/staff.model.js";
import { Student } from "../../src/database/models/student.model.js";
import { databaseModels } from "../../src/database/database.module.js";
import { DashboardService, operationalPermissions } from "../../src/dashboard/dashboard.service.js";
import { OperationalDashboardQuery } from "../../src/dashboard/dashboard.controller.js";
import { businessCalendarDaysSince } from '../../src/scheduling/scheduling-time.js';

let db: Sequelize;
beforeAll(() => { db = new Sequelize({ dialect: "postgres", database: "test", logging: false, models: databaseModels }); });
afterAll(async () => { await db.close(); });
const user = (role = "admin", canManageScheduling = true) => Staff.build({ role, canManageScheduling });
const major = { id: "m1", name: "Công nghệ thông tin", program: "masters", active: true, disciplineId: "d1", discipline: { id: "d1", name: "Khoa học máy tính" } };
const offering = (id: string, summary: any, status = "active") => ({ id, name: id, status,
  subject: { name: "Cơ sở dữ liệu" }, sessionSummary: summary,
  groupLinks: [{ classGroup: { id: 'g1', code: "CNTT 2026.1.1", majorId: "m1", academicYear: "2026" } }],
});
function fixture() {
  const masters = { listEligibleStudents: jest.fn().mockResolvedValue([
    { id: "waiting", majorId: "m1", assignedGroup: null, tuitionPaid: false },
    { id: "paid", majorId: "m1", assignedGroup: null, tuitionPaid: true },
    { id: "assigned", majorId: "m1", assignedGroup: { id: "old" } },
    { id: "outside-major", majorId: "other", assignedGroup: null },
  ]) };
  const scheduling = {
    listCourseOfferings: jest.fn().mockResolvedValue([
      offering("unscheduled", { totalCount: 0, heldCount: 0, pendingCount: 0 }),
      offering("pending", { totalCount: 3, heldCount: 1, pendingCount: 2 }),
      offering("completed", { totalCount: 4, heldCount: 4, pendingCount: 0 }, "completed"),
      offering("cancelled", { totalCount: 0 }, "cancelled"),
      offering("not-held", { totalCount: 1, notHeldCount: 1, heldCount: 0, pendingCount: 0 }),
    ]),
    getClassCurriculumProgress: jest.fn().mockResolvedValue({ classes: [
      { id: "g1", code: "CNTT 2026.1.1", subjects: [
        { subjectId: "s1", logicalSubjectId: "s1", status: "completed", needsGradeEntry: true, incompleteCourseOfferingId: "completed-missing" },
        { subjectId: "s2", status: "completed", needsGradeEntry: true, incompleteCourseOfferingId: "other-missing" },
      ] },
      { id: "complete", subjects: [{ status: "completed", needsGradeEntry: false }] },
      { id: "active", subjects: [{ status: "in_progress", needsGradeEntry: false }] },
    ] }),
  };
  const system = { listMajors: jest.fn().mockResolvedValue([major, { ...major, id: "m2", name: "Kế toán" }]) };
  const groups = { findAll: jest.fn().mockResolvedValue([{ id: "g1", majorId: "m1" }]) };
  const rbac = { effectiveAccess: jest.fn(async (actor) => ({ permissions: new Set(DEFAULT_ROLE_PERMISSIONS[actor.role] || []), roleCodes: [actor.role] })) };
  const gradebooks = { tracking: jest.fn().mockResolvedValue(new Map()) };
  return { masters, scheduling, system, groups, rbac, gradebooks, service: new DashboardService(masters as any, scheduling as any, system as any, rbac as any, gradebooks as any) };
}

describe("operational dashboard permissions", () => {
  it("uses effective permissions and the scheduling assignment guard", () => {
    expect(operationalPermissions(user(), new Set(DEFAULT_ROLE_PERMISSIONS[user().role]))).toEqual({ grouping: true, grades: true, scheduling: true, progress: true, overview: true });
    expect(operationalPermissions(user("admin", false), new Set(DEFAULT_ROLE_PERMISSIONS[user("admin", false).role]))).toMatchObject({ scheduling: false, progress: false, grouping: true });
    expect(operationalPermissions(user("supervisor", true), new Set(DEFAULT_ROLE_PERMISSIONS[user("supervisor", true).role]))).toEqual({ grouping: false, grades: false, scheduling: true, progress: true, overview: true });
    expect(operationalPermissions(user("examiner", false), new Set(DEFAULT_ROLE_PERMISSIONS[user("examiner", false).role]))).toEqual({ grouping: false, grades: true, scheduling: false, progress: false, overview: true });
    expect(Object.values(operationalPermissions(Student.build({ role: "admin" }), new Set(DEFAULT_ROLE_PERMISSIONS.admin)))).not.toContain(true);
    expect(Object.values(operationalPermissions({ role: "admin", canManageScheduling: true }, new Set(DEFAULT_ROLE_PERMISSIONS.admin)))).not.toContain(true);
  });
  it("does not query or expose data for inaccessible queues", async () => {
    const f = fixture();
    f.rbac.effectiveAccess.mockResolvedValue({ permissions: new Set(), roleCodes: [] });
    const result = await f.service.operational(user("admin", true), "2026");
    expect(result.sources).toEqual({});
    expect(f.masters.listEligibleStudents).not.toHaveBeenCalled();
    expect(f.scheduling.listCourseOfferings).not.toHaveBeenCalled();
    expect(f.groups.findAll).not.toHaveBeenCalled();
    expect(f.system.listMajors).not.toHaveBeenCalled();
  });
  it("uses custom grants and ignores a legacy admin role after revocation", async () => {
    const f = fixture();
    f.rbac.effectiveAccess.mockResolvedValue({ permissions: new Set(["masters.view", "masters.manage"]), roleCodes: ["custom"] });
    const granted = await f.service.operational(user("custom", false), "2026");
    expect(granted.permissions.grouping).toBe(true);
    expect(granted.sources.grouping.status).toBe("ready");
    expect(granted.permissions.grades).toBe(false);
    f.rbac.effectiveAccess.mockResolvedValue({ permissions: new Set(), roleCodes: [] });
    const revoked = await f.service.operational(user(), "2026");
    expect(Object.values(revoked.permissions)).not.toContain(true);
    expect(revoked.sources).toEqual({});
  });
  it("rejects malformed years and unknown sections at the API boundary", async () => {
    expect(await validate(Object.assign(new OperationalDashboardQuery(), { year: "2026", section: "grades" }))).toHaveLength(0);
    expect((await validate(Object.assign(new OperationalDashboardQuery(), { year: "all", section: "tuition" }))).length).toBe(2);
  });
});

describe("operational dashboard aggregation", () => {
  it('separates the three waiting stages, uses their own business dates and excludes entered/submitted/finished classes', async () => {
    jest.useFakeTimers({now:new Date('2026-10-21T10:00:00Z')});
    try {
      const f=fixture();
      const cases=['components','entered','submitted','exam','exam-grades','finished','legacy'];
      f.scheduling.listCourseOfferings.mockResolvedValue(cases.map(id=>({...offering(id,{},'completed'),groupLinks:[{classGroup:{id:'g1',code:'QTKD 2026.1.1',academicYear:'2026',majorId:'m1'}}]})));
      const base={componentsEntered:true,componentsApproved:false,examCompleted:false,examGradesComplete:false,candidateCount:2,completedTeachingAt:'2026-09-01T00:00:00Z',componentScoreApprovedAt:'2026-10-12T00:00:00Z',examCompletedAt:'2026-10-14T00:00:00Z'};
      f.gradebooks.tracking.mockResolvedValue(new Map([
        ['components',{...base,componentsEntered:false,completedTeachingAt:'2026-10-09T00:00:00Z'}],['entered',base],['submitted',base],
        ['exam',{...base,componentsApproved:true}],['exam-grades',{...base,componentsApproved:true,examCompleted:true}],
        ['finished',{...base,componentsApproved:true,examCompleted:true,examGradesComplete:true}],['legacy',{...base,legacy:true,componentsEntered:false}],
      ]));
      const {warningGroups,items,count}= (await f.service.operational(user(),'2026','grades')).sources.grades.data;
      expect(count).toBe(1);expect(items.map((i:any)=>i.id)).toEqual(['components']);
      expect(items[0].detail).toBe('Hoàn thành môn học 12 ngày trước');
      expect(items[0]).not.toHaveProperty('count');expect(items[0]).not.toHaveProperty('unit');
      expect(warningGroups.map((g:any)=>g.items.map((i:any)=>i.id))).toEqual([['exam'],['exam-grades']]);
      expect(warningGroups[0].items[0].detail).toBe('Điểm thành phần được duyệt 9 ngày trước');
      expect(warningGroups[1].items[0].detail).toBe('Thi xong 7 ngày trước');
      expect(warningGroups[0].items[0].href).toContain('/masters/exam-schedule?year=2026&offeringId=exam&groupId=g1&majorId=m1');
      expect(warningGroups[1].items[0].href).toContain('/masters/exam-lists?year=2026&offeringId=exam-grades&groupId=g1&majorId=m1');
      expect(warningGroups.map((g:any)=>g.key)).not.toContain('components');
      expect(JSON.stringify(warningGroups)).not.toMatch(/chờ duyệt|chưa nhập đủ|6\/10/);
    } finally {jest.useRealTimers();}
  });
  it('counts calendar days in Vietnam and never substitutes an unknown milestone',()=>{
    expect(businessCalendarDaysSince('2026-10-20T16:59:00Z',new Date('2026-10-20T17:01:00Z'))).toBe(1);
    expect(businessCalendarDaysSince('2026-10-20T17:00:00Z',new Date('2026-10-21T16:00:00Z'))).toBe(0);
    expect(businessCalendarDaysSince(null)).toBeNull();expect(businessCalendarDaysSince('invalid')).toBeNull();
  });
  it("uses assignment eligibility, excludes existing memberships and includes unpaid waiting learners", async () => {
    const f = fixture();
    const result = await f.service.operational(user(), "2026", "grouping");
    expect(f.masters.listEligibleStudents).toHaveBeenCalledWith(undefined, "2026");
    expect(result.sources.grouping).toMatchObject({ status: "ready", data: { count: 2, itemCount: 1, items: [
      { count: 2, href: "/masters/assign-class-groups?year=2026&disciplineId=d1&majorId=m1" },
    ] } });
    expect(f.scheduling.listCourseOfferings).not.toHaveBeenCalled();
  });
  it("counts only active offerings with no sessions; warnings reuse server pending confirmation summaries", async () => {
    const f = fixture();
    const result = await f.service.operational(user(), "2026", "teaching");
    expect(f.scheduling.listCourseOfferings).toHaveBeenCalledWith({ program: "masters", academicYear: "2026" });
    expect(result.sources.teaching.data).toMatchObject({
      scheduling: { count: 1, href: "/masters/schedule?year=2026&queue=unscheduled" },
      progress: { count: 1, items: [{ id: "pending", count: 2, href: "/masters/schedule?year=2026&offeringId=pending&queue=pending-confirmation" }] },
      overview: { active: 3, inProgress: 1, unscheduled: 1, completed: 1 },
    });
  });
  it("counts component-entry offerings rather than generic administrative-group grade progress", async () => {
    const f = fixture();
    f.scheduling.listCourseOfferings.mockResolvedValue(['completed','second','third'].map(id=>offering(id,{},'completed')));
    f.gradebooks.tracking.mockResolvedValue(new Map(['completed','second','third'].map(id=>[id,{componentsEntered:false,completedTeachingAt:'2026-10-20T00:00:00Z'}])));
    const result = await f.service.operational(user("examiner", false), "2026");
    expect(result.sources.grades).toMatchObject({ status: "ready", data: { count: 3, itemCount: 3 } });
    expect(result.sources.grades.data.items.map((item:any)=>item.id)).toEqual(['completed','second','third']);
    expect(result.sources.grades.data.items[0].href).toBe('/masters/exam-lists?year=2026&offeringId=completed&groupId=g1&majorId=m1');
    expect(f.scheduling.getClassCurriculumProgress).not.toHaveBeenCalled();
    expect(f.system.listMajors).not.toHaveBeenCalled();
    expect(result.sources.teaching.data.overview).toBeDefined();
    expect(result.sources.grouping).toBeUndefined();
  });
  it("isolates source failures, supports section retries, and avoids fetching unused sources", async () => {
    const f = fixture();
    f.gradebooks.tracking.mockRejectedValue(new Error("driver details"));
    const result = await f.service.operational(user(), "2026");
    expect(result.sources.grouping.status).toBe("ready");
    expect(result.sources.teaching.status).toBe("ready");
    expect(result.sources.grades.status).toBe("error");
    expect(JSON.stringify(result)).not.toContain("driver details");
    expect(f.system.listMajors).toHaveBeenCalledTimes(1);
  });
  it("returns real healthy zeros for empty scoped data", async () => {
    const f = fixture();
    f.masters.listEligibleStudents.mockResolvedValue([]);
    f.scheduling.listCourseOfferings.mockResolvedValue([]);
    f.groups.findAll.mockResolvedValue([]);
    const result = await f.service.operational(user(), "2025");
    expect(result.sources.grouping.data.count).toBe(0);
    expect(result.sources.grades.data.count).toBe(0);
    expect(result.sources.teaching.data.scheduling.count).toBe(0);
    expect(result.sources.teaching.data.progress.count).toBe(0);
    expect(f.scheduling.getClassCurriculumProgress).not.toHaveBeenCalled();
  });
});
