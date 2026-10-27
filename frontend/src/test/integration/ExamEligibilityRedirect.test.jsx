import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ExamEligibility from '../../pages/masters/examEligibility';

it('preserves bookmarked scope when opening the current eligibility workflow', () => {
  const Destination = () => <output>{useLocation().search}</output>;
  render(<MemoryRouter useTransitions={false} initialEntries={['/masters/exam-eligibility?year=2026&groupId=g1&offeringId=o1']}>
    <Routes><Route path="/masters/exam-eligibility" element={<ExamEligibility/>}/>
      <Route path="/masters/exam-lists" element={<Destination/>}/></Routes>
  </MemoryRouter>);
  expect(screen.getByRole('status')).toHaveTextContent('?year=2026&groupId=g1&offeringId=o1');
});
