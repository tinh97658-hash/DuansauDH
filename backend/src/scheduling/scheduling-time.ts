export const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";

const businessClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export const getBusinessWallTime = (now = new Date()) => {
  const parts = Object.fromEntries(businessClock.formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
};

// Persisted DATEONLY/TIME values are Vietnamese wall time, never server-local Dates.
export const isSessionEndedInBusinessTimezone = (session: { sessionDate: string; endTime: string }, now = new Date()) => {
  if (!session?.sessionDate || !session?.endTime) return false;
  const endTime = session.endTime.length === 5 ? `${session.endTime}:00` : session.endTime;
  return `${session.sessionDate} ${endTime}` < getBusinessWallTime(now);
};
