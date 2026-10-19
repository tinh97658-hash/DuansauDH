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
  const guard = new SchedulingWriteGuard();
  const staffUser = (canManageScheduling: boolean) => Object.assign(
    Object.create(Staff.prototype),
    { canManageScheduling },
  ) as Staff;

  it("allows only the Staff member assigned to manage scheduling", () => {
    const staff = staffUser(true);
    expect(guard.canActivate(contextFor(staff))).toBe(true);
  });

  it("rejects another Staff member with read-only scheduling access", () => {
    const staff = staffUser(false);
    expect(() => guard.canActivate(contextFor(staff))).toThrow(ForbiddenException);
  });

  it("rejects non-Staff users", () => {
    expect(() => guard.canActivate(contextFor({ canManageScheduling: true }))).toThrow(ForbiddenException);
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
    expect(() => guard.canActivate(contextFor(admin))).toThrow(ForbiddenException);
    await expect(new CourseOfferingWriteGuard(rbac).canActivate(contextFor(Object.assign(staffUser(false), { role: "admin" })))).rejects.toThrow(ForbiddenException);
    await expect(new CourseOfferingWriteGuard(rbac).canActivate(contextFor(Object.assign(staffUser(false), { role: "examiner" })))).rejects.toThrow(ForbiddenException);
  });

  it("keeps unresolved-session reads under the view permission without requiring scheduling write access", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, SchedulingController)).toContain(PermissionsGuard);
    expect(Reflect.getMetadata(GUARDS_METADATA, SchedulingController.prototype.listUnresolvedTeachingSessions) || []).not.toContain(SchedulingWriteGuard);
  });
});
