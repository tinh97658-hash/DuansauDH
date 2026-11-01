import { groupsOf, offeringTitle } from '../../features/scheduling/shared';

it('reads a retake group after private participant IDs have been removed from the API response', () => {
  const offering = { subject: { name: 'Triết học' }, groupLinks: [{
    studyRole: 'retake', classGroup: { id: 'retake', code: 'CNTT-HL', name: 'Nhóm học lại' },
  }] };
  expect(groupsOf(offering)).toEqual([expect.objectContaining({ id: 'retake', isRetake: true, name: 'CNTT-HL' })]);
  expect(offeringTitle(offering)).toBe('CNTT-HL');
});

it('keeps the server member count and legacy participant snapshot fallback', () => {
  expect(groupsOf({ groupLinks: [{ studyRole: 'retake', classGroup: { id: 'a', memberCount: 3 } }] })[0].memberCount).toBe(3);
  expect(groupsOf({ groupLinks: [{ participantIds: ['student:1'], classGroup: { id: 'b' } }] })[0].memberCount).toBe(1);
});
