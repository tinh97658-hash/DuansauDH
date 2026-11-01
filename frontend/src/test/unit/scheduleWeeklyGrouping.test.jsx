import { buildScheduleDocument, scheduleDocumentMetadata, scheduleExportRows } from '../../features/scheduling/scheduleExport';

const offering = { id: 'hai-van', subject: { id: 'subject', name: 'Hải văn' },
  groupLinks: [{ classGroup: { id: 'class', code: 'XDCT 2026.1.1', major: { name: 'Công trình thủy' } } }] };
const session = (date, period, overrides = {}) => ({ sessionDate: date, period, courseOffering: offering,
  lecturer: { id: 'teacher', name: 'Nguyễn An' }, room: { id: 'room', code: 'A61P02' }, ...overrides });

it('combines both periods and multiple dates into one weekly course row, retaining the true session total', () => {
  const sessions = [session('2026-10-26', 'MORNING'), session('2026-10-26', 'AFTERNOON'),
    session('2026-10-28', 'MORNING'), session('2026-10-28', 'AFTERNOON'), session('2026-11-01', 'AFTERNOON')];
  const original = JSON.stringify(sessions);
  const schedule = buildScheduleDocument({ week: '2026-10-26', end: '2026-11-01', sessions });
  expect(schedule.rows).toEqual([[1, 'Công trình thủy', 'XDCT 2026.1.1', 'Hải văn', 'Nguyễn An',
    'Cả ngày T2, T4; Chiều CN', 'A61P02', '']]);
  expect(scheduleDocumentMetadata(schedule).total).toBe('Tổng số: 5 buổi học');
  expect(JSON.stringify(sessions)).toBe(original);
});

it('keeps morning and afternoon days distinct without inventing a full day', () => {
  const rows = scheduleExportRows([session('2026-10-27', 'MORNING'), session('2026-10-29', 'AFTERNOON'),
    session('2026-10-30', 'MORNING')]);
  expect(rows[0][5]).toBe('Sáng T3, T6; Chiều T5');
});

it.each([
  { lecturer: { id: 'other-teacher', name: 'Nguyễn An' } },
  { room: { id: 'other-room', code: 'A61P03' } },
  { courseOffering: { ...offering, id: 'other-course' } },
  { courseOffering: { ...offering, groupLinks: [{ classGroup: { id: 'other-class', code: 'CNTT 2026.1.1' } }] } },
  { note: 'Buổi đổi lịch' },
  { sessionDate: '2026-11-02' },
])('preserves a separate row when the assignment, note or week changes: %j', overrides => {
  expect(scheduleExportRows([session('2026-10-26', 'MORNING'), session('2026-10-27', 'MORNING', overrides)])).toHaveLength(2);
});
