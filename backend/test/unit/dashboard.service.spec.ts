import "reflect-metadata";
import { validate } from "class-validator";
import { Sequelize } from "sequelize-typescript";
import { Staff } from "../../src/database/models/staff.model.js";
import { Student } from "../../src/database/models/student.model.js";
import { databaseModels } from "../../src/database/database.module.js";
import { DashboardService, operationalPermissions } from "../../src/dashboard/dashboard.service.js";
import { OperationalDashboardQuery } from "../../src/dashboard/dashboard.controller.js";

let db: Sequelize;
beforeAll(() => { db = new Sequelize({ dialect: "postgres", database: "test", logging: false, models: databaseModels }); });
afterAll(async () => { await db.close(); });
const user = (role = "admin", canManageScheduling = true) => Staff.build({ role, canManageScheduling });
const major = { id: "m1", name: "Công nghệ thông tin", program: "masters", active: true, disciplineId: "d1", discipline: { id: "d1", name: "Khoa học máy tính" } };
const offering = (id: string, summary: any, status = "active") => ({ id, name: id, status,
  subject: { name: "Cơ sở dữ liệu" }, sessionSummary: summary,
  groupLinks: [{ classGroup: { code: "CNTT 2026.1.1", majorId: "m1", academicYear: "2026" } }],
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
  return { masters, scheduling, system, groups, service: new DashboardService(masters as any, scheduling as any, system as any, groups as any) };
}

describe("operational dashboard permissions", () => {
  it("uses existing write endpoint role metadata and scheduling assignment guard", () => {
    expect(operationalPermissions(user())).toEqual({ grouping: true, grades: true, scheduling: true, progress: true, overview: true });
    expect(operationalPermissions(user("admin", false))).toMatchObject({ scheduling: false, progress: false, grouping: true });
    expect(operationalPermissions(user("supervisor", true))).toEqual({ grouping: false, grades: false, scheduling: true, progress: true, overview: false });
    expect(operationalPermissions(user("examiner", false))).toEqual({ grouping: false, grades: true, scheduling: false, progress: false, overview: false });
    expect(Object.values(operationalPermissions(Student.build({ role: "admin" })))).not.toContain(true);
    expect(Object.values(operationalPermissions({ role: "admin", canManageScheduling: true }))).not.toContain(true);
  });
  it("does not query or expose data for inaccessible queues", async () => {
    const f = fixture();
    const result = await f.service.operational(user("supervisor", false), "2026");
    expect(result.sources).toEqual({});
    expect(f.masters.listEligibleStudents).not.toHaveBeenCalled();
    expect(f.scheduling.listCourseOfferings).not.toHaveBeenCalled();
    expect(f.groups.findAll).not.toHaveBeenCalled();
    expect(f.system.listMajors).not.toHaveBeenCalled();
  });
  it("rejects malformed years and unknown sections at the API boundary", async () => {
    expect(await validate(Object.assign(new OperationalDashboardQuery(), { year: "2026", section: "grades" }))).toHaveLength(0);
    expect((await validate(Object.assign(new OperationalDashboardQuery(), { year: "all", section: "tuition" }))).length).toBe(2);
  });
});

describe("operational dashboard aggregation", () => {
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
  it("counts distinct administrative groups flagged by progress, and links to the exact incomplete offering", async () => {
    const f = fixture();
    const result = await f.service.operational(user("examiner", false), "2026");
    expect(result.sources.grades).toMatchObject({ status: "ready", data: { count: 1, items: [{ id: "g1", count: 2 }] } });
    expect(result.sources.grades.data.items[0].href).toContain("groupId=g1&offeringId=completed-missing");
    expect(f.scheduling.getClassCurriculumProgress).toHaveBeenCalledTimes(1);
    expect(result.sources.teaching).toBeUndefined();
    expect(result.sources.grouping).toBeUndefined();
  });
  it("isolates source failures, supports section retries, and avoids fetching unused sources", async () => {
    const f = fixture();
    f.scheduling.getClassCurriculumProgress.mockRejectedValue(new Error("driver details"));
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
