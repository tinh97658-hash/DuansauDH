import { sortOfferingChoices, stageOf } from '../../features/exams/offeringStages';

it('orders stage before Vietnamese natural names and retains same-name IDs', () => {
  const entry = (id, name, gradebookStage) => ({ offering: { id, name, gradebookStage }, group: { code: id } });
  const choices = [entry('pending', 'A', 'eligibility_pending'), entry('10', 'Ánh 10', 'components_missing'),
    entry('2b', 'Ánh 2', 'components_missing'), entry('2a', 'Ánh 2', 'components_missing'),
    entry('ready', 'Z', 'eligibility_ready'), entry('teach', 'Z', 'teaching')];
  expect(sortOfferingChoices(choices).map(item => item.offering.id)).toEqual(['teach', '2a', '2b', '10', 'ready', 'pending']);
  expect(stageOf({ status: 'completed', gradebookCompletionStatus: 'incomplete' }).label).toBe('Cần rà soát');
});
