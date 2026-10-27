import { PERMISSIONS_KEY } from "../../src/common/permissions.decorator.js";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { Staff } from "../../src/database/models/staff.model.js";
import { SchedulingWriteGuard } from "../../src/common/scheduling-write.guard.js";
import { CourseOfferingWriteGuard } from "../../src/common/course-offering-write.guard.js";
import { PermissionsGuard } from "../../src/common/permissions.guard.js";
import { RbacService } from "../../src/auth/rbac.service.js";
import { SchedulingController } from "../../src/scheduling/scheduling.controller.js";

const contextFor = (user: unknown) => ({
  switchToHttp: () => ({ getRequest: () => ({ user }) }),
}) as unknown as ExecutionContext;

describe("SchedulingWriteGuard", () => {
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
