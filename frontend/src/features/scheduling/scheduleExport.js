import { groupsOf, offeringTitle } from "./shared";
import { isSessionPast } from "../../utils/schedulingCalendar";

const STATUS_LABELS = {
  held: "Đã diễn ra",
  not_held: "Không diễn ra",
};

const PERIOD_LABELS = {
  MORNING: "Sáng",
  AFTERNOON: "Chiều",
};

const displayDate = (value) => {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : value || "";
};

const trimTime = (value) => String(value || "").slice(0, 5);

export const SCHEDULE_EXPORT_HEADERS = [
  "STT", "Ngày học", "Buổi", "Thời gian", "Mã HP", "Tên học phần",
  "Lớp học phần", "Lớp / nhóm", "Ngành", "Chuyên ngành", "Giảng viên",
  "Phòng", "Sĩ số", "Kết quả / Trạng thái", "Ghi chú",
];

export function scheduleExportRows(sessions) {
  return [...sessions]
    .sort((left, right) => `${left.sessionDate} ${left.startTime || ""}`.localeCompare(`${right.sessionDate} ${right.startTime || ""}`))
    .map((session, index) => {
      const offering = session.courseOffering || {};
      const groups = groupsOf(offering);
      const majors = [...new Set(groups.map((group) => group.major?.name).filter(Boolean))];
      const status = session.status === "planned"
        ? (isSessionPast(session) ? "Chờ xác nhận" : "Đã xếp")
        : STATUS_LABELS[session.status] || session.status || "";
      return [
        index + 1,
        displayDate(session.sessionDate),
        PERIOD_LABELS[session.period] || session.period || "",
        [trimTime(session.startTime), trimTime(session.endTime)].filter(Boolean).join(" - "),
        offering.subject?.code || "",
        offering.subject?.name || "",
        offeringTitle(offering),
        groups.map((group) => group.code || group.name).filter(Boolean).join(", "),
        offering.subject?.major?.discipline?.name || "",
        majors.join(", "),
        session.lecturer?.name || "Chưa có giảng viên",
        session.room?.code || "Chưa có phòng",
        offering.participantCount ?? "",
        status,
        session.note || "",
      ];
    });
}

export function displayScheduleExportDate(value) {
  return displayDate(value);
}

export function exportSchedule() {
  window.print();
}
