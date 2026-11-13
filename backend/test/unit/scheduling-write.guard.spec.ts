import { PERMISSIONS_KEY } from "../../src/common/permissions.decorator.js";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { Staff } from "../../src/database/models/staff.model.js";
import { SchedulingWriteGuard } from "../../src/common/scheduling-write.guard.js";
import { CourseOfferingWriteGuard } from "../../src/common/course-offering-write.guard.js";
import { PermissionsGuard } from "../../src/common/permissions.guard.js";
import { RbacService } from "../../src/auth/rbac.service.js";
import { SchedulingController } from "../../src/scheduling/scheduling.controller.js";
import { PERMISSION_CODES } from "../../src/auth/permissions.js";
import { PERMISSION_ROUTES } from "../../src/auth/route-permissions.js";

const contextFor = (user: unknown) => ({
  switchToHttp: () => ({ getRequest: () => ({ user }) }),
}) as unknown as ExecutionContext;

describe("SchedulingWriteGuard", () => {
  it("retires coordinator assignment while retaining timetable and account actions", () => {
    expect(PERMISSION_CODES).not.toContain("scheduling.assign");
    expect(PERMISSION_CODES).toEqual(expect.arrayContaining([
      "scheduling.view", "scheduling.organize", "scheduling.write", "groups.assign",
      "account.view", "account.manage", "account.password.reset", "exams.view", "exams.write",
    ]));
    const routes = new Map(PERMISSION_ROUTES.map(route => [route.path, route]));
    expect(routes.get("/masters/course-offerings")?.actions).toEqual(["scheduling.organize"]);
    expect(routes.get("/masters/schedule")?.actions).toEqual(["scheduling.write"]);
    expect(routes.get("/system/accounts")?.actions).toEqual(["account.manage", "account.password.reset"]);
    const prototype = SchedulingController.prototype;
    const paths = Object.getOwnPropertyNames(prototype)
      .filter(name => name !== "constructor")
      .map(name => Reflect.getMetadata(PATH_METADATA, (prototype as any)[name]));
    expect(paths).not.toContain("assignee");
  });
  const rbac = { effectiveAccess: async (user: any) => ({ permissions: new Set<string>(user.permissions || []), groupScope: { readOnly: user.readOnly === true } }) } as unknown as RbacService;
  const guard = new SchedulingWriteGuard(rbac);
  const staffUser = (canManageScheduling: boolean) => Object.assign(
    Object.create(Staff.prototype),
    { canManageScheduling },
  ) as Staff;

  it("allows scheduling.write without the old assignment flag", async () => {
    const staff = Object.assign(staffUser(false), { permissions: ["scheduling.write"] });
    await expect(guard.canActivate(contextFor(staff))).resolves.toBe(true);
  });

  it("does not grant write access from the assignment flag alone", async () => {
    const staff = staffUser(true);
    await expect(guard.canActivate(contextFor(staff))).rejects.toThrow(ForbiddenException);
  });

  it("rejects non-Staff users", async () => {
    await expect(guard.canActivate(contextFor({ canManageScheduling: true }))).rejects.toThrow(ForbiddenException);
  });

  it("read-only blocks writes even with both permission and assignment", async () => {
    const staff = Object.assign(staffUser(true), { permissions: ["scheduling.write"], readOnly: true });
    await expect(guard.canActivate(contextFor(staff))).rejects.toThrow(ForbiddenException);
  });

  it("does not use a coordinator flag to bypass organization permission or read-only", async () => {
    await expect(new CourseOfferingWriteGuard(rbac).canActivate(contextFor(staffUser(true)))).rejects.toThrow(ForbiddenException);
    const readonly = Object.assign(staffUser(true), { permissions: ["scheduling.organize"], readOnly: true });
    await expect(new CourseOfferingWriteGuard(rbac).canActivate(contextFor(readonly))).rejects.toThrow(ForbiddenException);
  });

  it("separates class organization from timetable writes at the API boundary", () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, SchedulingController.prototype.createCourseOffering)).toEqual(["scheduling.organize"]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, SchedulingController.prototype.deleteCourseOfferingSchedule)).toEqual(["scheduling.write"]);
  });

  it("protects every scheduling mutation endpoint", () => {
    for (const handler of [SchedulingController.prototype.createCourseOffering, SchedulingController.prototype.previewCourseOfferingParticipants, SchedulingController.prototype.previewCourseOfferingRoster, SchedulingController.prototype.individualStudents]) {
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(CourseOfferingWriteGuard);
    }
    for (const handler of [
      SchedulingController.prototype.createTeachingSession,
      SchedulingController.prototype.updateTeachingSession,
      SchedulingController.prototype.confirmTeachingSession,
      SchedulingController.prototype.deleteTeachingSession,
      SchedulingController.prototype.completeCourseOffering,
    ]) {
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(SchedulingWriteGuard);
    }
  });

  it("uses scheduling.organize for any staff role without granting scheduling writes", async () => {
    const rbac = {
      effectiveAccess: async (user: any) => ({ superadmin: user?.role === "admin", permissions: new Set<string>(user?.permissions || []), roleCodes: user?.role ? [user.role] : [] }),
    } as unknown as RbacService;
    const admin = Object.assign(staffUser(false), { role: "custom", permissions: ["scheduling.organize"] });
    expect(await new CourseOfferingWriteGuard(rbac).canActivate(contextFor(admin))).toBe(true);
    await expect(guard.canActivate(contextFor(admin))).rejects.toThrow(ForbiddenException);
    await expect(new CourseOfferingWriteGuard(rbac).canActivate(contextFor(Object.assign(staffUser(false), { role: "admin" })))).rejects.toThrow(ForbiddenException);
    await expect(new CourseOfferingWriteGuard(rbac).canActivate(contextFor(Object.assign(staffUser(false), { role: "examiner" })))).rejects.toThrow(ForbiddenException);
  });

  it("keeps unresolved-session reads under the view permission without requiring scheduling write access", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, SchedulingController)).toContain(PermissionsGuard);
    expect(Reflect.getMetadata(GUARDS_METADATA, SchedulingController.prototype.listUnresolvedTeachingSessions) || []).not.toContain(SchedulingWriteGuard);
  });
});
