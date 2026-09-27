const pad = (value) => String(value).padStart(2, "0");

export const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";
const businessClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
export const getBusinessWallTime = (now = new Date()) => {
  const parts = Object.fromEntries(businessClock.formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
};
export const getBusinessTodayKey = (now = new Date()) => getBusinessWallTime(now).slice(0, 10);

export const normalizeTimeInput = (raw) => {
  const text = String(raw || "").trim();
  const match = text.match(/^(\d{1,2}):(\d{1,2})$/) || text.match(/^(\d{1,2})(\d{2})$/);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return `${pad(Number(match[1]))}:${pad(Number(match[2]))}`;
};

export const isPeriodTimeConsistent = (period, startTime, endTime) => {
  if (!startTime || !endTime) return false;
  const start = startTime.length === 5 ? `${startTime}:00` : startTime;
  const end = endTime.length === 5 ? `${endTime}:00` : endTime;
  return start < end && (period === "MORNING"
    ? start >= "00:00:00" && start < "12:00:00" && end <= "12:00:00"
    : period === "AFTERNOON" && start >= "12:00:00" && end <= "23:59:59");
};

export const SESSION_PERIODS = ["MORNING", "AFTERNOON"];

export const getRoomFloor = (roomCode) => {
  const match = String(roomCode || "").trim().match(/^(\d)/);
  return match ? Number(match[1]) : null;
};

export const parseLocalDate = (value) => {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const formatDateKey = (date) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
);

export const addDays = (date, amount) => {
  const next = parseLocalDate(date);
  next.setDate(next.getDate() + amount);
  return next;
};

export const mondayOf = (date) => {
  const value = parseLocalDate(date);
  const offset = value.getDay() === 0 ? -6 : 1 - value.getDay();
  return addDays(value, offset);
};

export const weekDaysFrom = (monday) => Array.from({ length: 7 }, (_, index) => addDays(monday, index));

export const isSameDate = (left, right) => formatDateKey(parseLocalDate(left)) === formatDateKey(parseLocalDate(right));

export const timesOverlap = (firstStart, firstEnd, secondStart, secondEnd) => (
  Boolean(firstStart && firstEnd && secondStart && secondEnd)
  && firstStart < secondEnd
  && firstEnd > secondStart
);

export const validTimeRange = (startTime, endTime) => Boolean(startTime && endTime && startTime < endTime);

export const shortTime = (value) => String(value || "").slice(0, 5);

export const isSessionEndedInBusinessTimezone = (session, now = new Date()) => {
  if (!session?.sessionDate || !session?.endTime) return false;
  const endTime = session.endTime.length === 5 ? `${session.endTime}:00` : session.endTime;
  return `${session.sessionDate} ${endTime}` < getBusinessWallTime(now);
};
export const isSessionPast = isSessionEndedInBusinessTimezone;

export const vietnameseDate = (date) => new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
}).format(parseLocalDate(date));

export const vietnameseDayLabel = (date) => {
  const value = parseLocalDate(date);
  return `${value.getDay() === 0 ? "Chủ nhật" : `Thứ ${value.getDay() + 1}`} · ${new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  }).format(value)}`;
};

export const vietnameseWeekdayShort = (date) => {
  const value = parseLocalDate(date);
  return value.getDay() === 0 ? "CN" : `T${value.getDay() + 1}`;
};

export const vietnameseDayMonth = (date) => new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
}).format(parseLocalDate(date));
