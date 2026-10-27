import type { RetakeResult } from "./retake-groups.js";

export function latestParticipantResults(results: RetakeResult[], classGroupId: string, subjectIds: Set<string>) {
  const latest = new Map<string, RetakeResult>();
  for (const row of results) {
    if (row.classGroupId !== classGroupId || !subjectIds.has(row.subjectId) || !row.participantId) continue;
    const previous = latest.get(row.participantId);
    const time = (value: RetakeResult) => new Date(value.attemptedAt || value.recordedAt).getTime();
    if (!previous || time(row) > time(previous) || (time(row) === time(previous)
      && (new Date(row.recordedAt).getTime() > new Date(previous.recordedAt).getTime()
        || (new Date(row.recordedAt).getTime() === new Date(previous.recordedAt).getTime()
          && row.bookId > previous.bookId)))) latest.set(row.participantId, row);
  }
  return latest;
}

export function retakeProgress(
  latest: Map<string, RetakeResult>,
  activeRosters: Array<{ id: string; participantIds: string[] }>,
  eligibleParticipants: Set<string>,
) {
  const passed = (id: string) => ["passed", "exempt"].includes(latest.get(id)?.result || "");
  const active = new Set(activeRosters.flatMap(roster => roster.participantIds)
    .filter(id => eligibleParticipants.has(id) && !passed(id)));
  const waiting = [...latest.values()].filter(row => eligibleParticipants.has(row.participantId)
    && row.result === "failed" && row.sourceStatus === "completed" && !active.has(row.participantId));
  return {
    activeRetakeCount: active.size,
    waitingRetakeCount: waiting.length,
    activeRetakeOfferingIds: activeRosters.filter(roster => roster.participantIds.some(id => active.has(id))).map(roster => roster.id),
  };
}
