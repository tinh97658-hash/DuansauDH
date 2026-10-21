export const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";

const businessClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export const getBusinessWallTime = (now = new Date()) => {
  const parts = Object.fromEntries(businessClock.formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
};

export const businessCalendarDaysSince = (at: string | Date | null, now = new Date()) => {
  if (!at) return null;
  const date = new Date(at);
  if (!Number.isFinite(date.getTime())) return null;
  const day = (value: Date) => Date.parse(getBusinessWallTime(value).slice(0, 10) + 'T00:00:00Z');
  return Math.max(0, Math.round((day(now) - day(date)) / 86400000));
};

export const isSessionStartedInBusinessTimezone = (session: { sessionDate: string; startTime: string }, now = new Date()) => {
  if (!session?.sessionDate || !session?.startTime) return false;
  const startTime = session.startTime.length === 5 ? `${session.startTime}:00` : session.startTime;
  return `${session.sessionDate} ${startTime}` <= getBusinessWallTime(now);
};

// Persisted DATEONLY/TIME values are Vietnamese wall time, never server-local Dates.
export const isSessionEndedInBusinessTimezone = (session: { sessionDate: string; endTime: string }, now = new Date()) => {
  if (!session?.sessionDate || !session?.endTime) return false;
  const endTime = session.endTime.length === 5 ? `${session.endTime}:00` : session.endTime;
  return `${session.sessionDate} ${endTime}` < getBusinessWallTime(now);
};
