const periodOrder = { MORNING: 0, AFTERNOON: 1 };
const slotKey = (session) => session?.sessionDate && periodOrder[session.period] != null
  ? `${session.sessionDate}:${periodOrder[session.period]}` : null;

// The existing history endpoint omits clock times; date + period identifies a slot.
export function previousRoomSession(sessions, target, rooms) {
  const targetKey = slotKey(target);
  if (!targetKey || !target.courseOfferingId) return null;
  return sessions.filter((row) => {
    const key = slotKey(row);
    const room = rooms.find((item) => item.id === row.roomId) || row.room;
    return (row.courseOfferingId || row.courseOffering?.id) === target.courseOfferingId
      && row.id !== target.id && ["planned", "held"].includes(row.status)
      && key && key < targetKey && row.roomId && room?.id === row.roomId && room.code;
  }).sort((left, right) => slotKey(right).localeCompare(slotKey(left))
    || String(right.id).localeCompare(String(left.id)))[0] || null;
}
