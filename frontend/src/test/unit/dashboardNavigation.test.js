import { dashboardGradeScope, dashboardScheduleQueue, matchesDashboardScheduleQueue } from "../../features/dashboard/navigation";

it("recognizes only operational scheduling filters and distinguishes no-session from already planned or completed", () => {
  expect(dashboardScheduleQueue("invented")).toBe("");
  expect(dashboardScheduleQueue("unscheduled")).toBe("unscheduled");
  expect(matchesDashboardScheduleQueue({ status: "active", sessionSummary: { totalCount: 0 } }, "unscheduled")).toBe(true);
  expect(matchesDashboardScheduleQueue({ status: "active", sessionSummary: { totalCount: 1 } }, "unscheduled")).toBe(false);
  expect(matchesDashboardScheduleQueue({ status: "completed", sessionSummary: { totalCount: 0 } }, "unscheduled")).toBe(false);
  expect(matchesDashboardScheduleQueue({ status: "active", sessionSummary: { pendingCount: 2 } }, "pending-confirmation")).toBe(true);
});

const groups = [{ id: "old", majorId: "m1", academicYear: "2025" }, { id: "current", majorId: "m2", academicYear: "2026" }];
const offerings = [
  { id: "old-offering", groupLinks: [{ classGroupId: "old" }] },
  { id: "active", status: "active", subject: { id: "s1" }, groupLinks: [{ classGroupId: "current" }] },
  { id: "completed", status: "completed", subject: { id: "s1" }, groupLinks: [{ classGroupId: "current" }] },
];
it("restores exact grade scope including the incomplete offering and rejects an out-of-scope ID", () => {
  expect(dashboardGradeScope(new URLSearchParams("year=2026&majorId=m2&groupId=current&offeringId=completed"), groups, offerings)).toEqual({ year: "2026", group: groups[1], offering: offerings[2] });
  const scoped = dashboardGradeScope(new URLSearchParams("year=2026&groupId=old&offeringId=old-offering&subjectId=s1"), groups, offerings);
  expect(scoped.group.id).toBe("current");
  expect(scoped.offering.id).toBe("completed");
  expect(dashboardGradeScope(new URLSearchParams("year=2024"), groups, offerings).group).toBeUndefined();
});
it("preserves the existing first-option behavior without deep-link params", () => {
  expect(dashboardGradeScope(new URLSearchParams(), groups, offerings)).toEqual({ year: "", group: groups[0], offering: offerings[0] });
});
