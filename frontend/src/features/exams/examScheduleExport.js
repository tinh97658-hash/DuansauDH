import {examInvigilatorName} from './examInvigilators';
import { examPeriods } from "./examCalendar";

function examTimeSummary(session) {
  const start = String(session.startTime || "").slice(0, 5);
  const minutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
  const period = session.period || examPeriods.find(item => minutes >= item.from && minutes < item.to)?.id;
  const periodLabel = period === "AFTERNOON" ? "chiều" : "sáng";
  const day = new Date(`${session.examDate}T00:00:00Z`).getUTCDay();
  const weekday = day === 0 ? "CN" : `T${day + 1}`;
  return `${start.replace(":", "h")} ${periodLabel} ${weekday}`;
}

// Use the teaching schedule's document layout and column positions in every format.
export function buildExamScheduleDocument({ week, end, sessions = [] }) {
  const names = values => [...new Set(values.filter(Boolean))].join(", ");
  const rows = sessions.filter(session => session.status !== "cancelled").sort((a, b) =>
    `${a.examDate} ${a.startTime} ${a.roomCode || ''}`.localeCompare(`${b.examDate} ${b.startTime} ${b.roomCode || ''}`)
  ).map((session, index) => [
    index + 1,
    names((session.groups || []).map(group => group.majorName)),
    names((session.groups || []).map(group => group.code || group.name)) || session.name || "",
    session.subjectName || "",
    [examInvigilatorName(session) || "Chưa phân công",examInvigilatorName(session,true) || "Chưa phân công"].join("\n"),
    examTimeSummary(session),
    session.roomCode || "Chưa có phòng",
    session.note || "",
  ]);
  return { kind: "exam", week, end, discipline: "", major: "", year: "", rows, sessionCount: rows.length };
}
