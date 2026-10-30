// Example attendance status policy.
//
// This is NOT a validated institutional policy. The late threshold and status
// set must be approved before the pilot. Replace this function or inject a
// policy provider with the approved rules. PGSMS stores the policy version on
// each attendance row/event so old decisions remain explainable.

import { getBusinessWallTime } from "../scheduling/scheduling-time.js";

export const DEFAULT_LATE_AFTER_MINUTES = 15;
export const DEFAULT_ATTENDANCE_POLICY_VERSION = "attendance-policy-example-v0";

export function attendanceWindow(session: SessionClock, now = new Date()) {
  const start = Date.parse(`${session.sessionDate}T${session.startTime}Z`);
  const end = Date.parse(`${session.sessionDate}T${session.endTime || session.startTime}Z`);
  const current = Date.parse(`${getBusinessWallTime(now).replace(" ", "T")}Z`);
  return { valid: Number.isFinite(start) && Number.isFinite(end) && end > start && current >= start - 30 * 60_000 && current <= end };
}

export interface SessionClock {
  sessionDate: string;
  startTime: string;
  endTime?: string;
}

export function resolveFaceAttendanceStatus(
  session: SessionClock,
  options: { lateAfterMinutes: number; now?: Date },
): "PRESENT" | "LATE" {
  const { lateAfterMinutes, now = new Date() } = options;
  if (!session?.sessionDate || !session?.startTime) return "PRESENT";
  const startTime =
    session.startTime.length === 5 ? `${session.startTime}:00` : session.startTime;
  const startMs = Date.parse(`${session.sessionDate}T${startTime}Z`);
  const nowMs = Date.parse(`${getBusinessWallTime(now).replace(" ", "T")}Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(nowMs)) return "PRESENT";
  const lateAfterMs = startMs + Math.max(0, lateAfterMinutes) * 60_000;
  return nowMs > lateAfterMs ? "LATE" : "PRESENT";
}
