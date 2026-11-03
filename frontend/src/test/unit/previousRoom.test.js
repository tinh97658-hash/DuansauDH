import { previousRoomSession } from '../../features/scheduling/previousRoom';

const rooms = [{ id: 'room-a', code: '301' }, { id: 'room-b', code: '402' }];
const target = { courseOfferingId: 'course', sessionDate: '2026-11-04', period: 'AFTERNOON' };
const session = (id, sessionDate, period = 'MORNING', roomId = 'room-a', extra = {}) =>
  ({ id, courseOfferingId: 'course', sessionDate, period, roomId, status: 'held', ...extra });

it('returns no suggestion for a course without prior room history', () => {
  expect(previousRoomSession([], target, rooms)).toBeNull();
  expect(previousRoomSession([session('future', '2026-11-05')], target, rooms)).toBeNull();
});

it('uses the nearest earlier slot, including morning before afternoon on the same day', () => {
  const history = [session('older', '2026-11-02'), session('morning', '2026-11-04', 'MORNING', 'room-b'),
    session('future', '2026-11-05'), session('same-slot', '2026-11-04', 'AFTERNOON')];
  const original = JSON.stringify(history);
  expect(previousRoomSession(history, target, rooms)?.id).toBe('morning');
  expect(previousRoomSession(history, { ...target, period: 'MORNING' }, rooms)?.id).toBe('older');
  expect(JSON.stringify(history)).toBe(original);
});

it('excludes another offering, cancelled sessions and the current session even when moving it', () => {
  const history = [session('valid', '2026-11-01'), session('other', '2026-11-04', 'MORNING', 'room-b', { courseOfferingId: 'other-course' }),
    session('cancelled', '2026-11-03', 'MORNING', 'room-b', { status: 'not_held' }), session('editing', '2026-11-02')];
  expect(previousRoomSession(history, { ...target, id: 'editing' }, rooms)?.id).toBe('valid');
});

it('keeps planned history before the target but ignores invalid room references', () => {
  const history = [session('planned', '2026-11-01', 'MORNING', 'room-b', { status: 'planned' }),
    session('deleted-room', '2026-11-03', 'MORNING', 'missing'),
    session('no-room', '2026-11-04', 'MORNING', null)];
  expect(previousRoomSession(history, target, rooms)?.roomId).toBe('room-b');
});

it('retains an inactive historical room for informational display without adding it to the catalog', () => {
  const retired = session('retired', '2026-11-04', 'MORNING', 'old-room', {
    room: { id: 'old-room', code: '901', isActive: false },
  });
  expect(previousRoomSession([retired], target, rooms)).toBe(retired);
  expect(rooms).toHaveLength(2);
});
