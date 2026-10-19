export const dashboardScheduleQueue = (value) => ["unscheduled", "pending-confirmation"].includes(value) ? value : "";
export const matchesDashboardScheduleQueue = (offering, queue) => !queue || offering.status === "active" && (
  queue === "unscheduled" ? Number(offering.sessionSummary?.totalCount) === 0
    : Number(offering.sessionSummary?.pendingCount) > 0
);

// Resolve only existing options in the supplied year/major. Never select a URL ID outside the current scope.
export function dashboardGradeScope(params, groups, offerings) {
  const year = /^\d{4}$/.test(params.get("year") || "") ? params.get("year") : "";
  const majorId = params.get("majorId") || "";
  const scoped = groups.filter((group) => (!year || group.academicYear === year) && (!majorId || group.majorId === majorId));
  const group = scoped.find((item) => item.id === params.get("groupId")) || scoped[0];
  const candidates = offerings.filter((offering) => offering.groupLinks?.some((link) => link.classGroupId === group?.id));
  const subjectId = params.get("subjectId"), logicalId = params.get("logicalSubjectId") || subjectId;
  const offering = candidates.find((item) => item.id === params.get("offeringId"))
    || (subjectId ? candidates.find((item) => {
      const subject = item.groupLinks.find((link) => link.classGroupId === group.id)?.subject || item.subject;
      return item.status === "completed" && (subject?.id === subjectId || (subject?.canonicalSubjectId || subject?.id) === logicalId);
    }) : candidates[0]);
  return { year, group, offering };
}
