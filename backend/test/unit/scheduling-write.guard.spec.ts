import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { Staff } from "../../src/database/models/staff.model.js";
import { SchedulingWriteGuard } from "../../src/common/scheduling-write.guard.js";
import { CourseOfferingWriteGuard } from "../../src/common/course-offering-write.guard.js";
import { RolesGuard } from "../../src/common/roles.guard.js";
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

  it("allows administrators to organize classes without granting scheduling writes", () => {
    const admin = Object.assign(staffUser(false), { role: "admin" });
    expect(new CourseOfferingWriteGuard().canActivate(contextFor(admin))).toBe(true);
    expect(() => guard.canActivate(contextFor(admin))).toThrow(ForbiddenException);
    expect(() => new CourseOfferingWriteGuard().canActivate(contextFor(Object.assign(staffUser(false), { role: "examiner" })))).toThrow(ForbiddenException);
  });

  it("keeps unresolved-session reads under RolesGuard without requiring scheduling write access", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, SchedulingController)).toContain(RolesGuard);
    expect(Reflect.getMetadata(GUARDS_METADATA, SchedulingController.prototype.listUnresolvedTeachingSessions) || []).not.toContain(SchedulingWriteGuard);
  });
});
