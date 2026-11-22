import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { vi, expect, it } from 'vitest';
import axios from 'axios';
import IntakeRoundSelect, { matchesIntakeRound } from '../../components/IntakeRoundSelect';
import { matchesExam } from '../../features/exams/examPlanner';

vi.mock('axios');
it('scopes round choices to the selected year and keeps unknown distinct', async () => {
  axios.get.mockResolvedValue({ data: [{ academicYear: '2026', intakeRound: 2 }, { academicYear: '2025', intakeRound: 3 }] });
  const change = vi.fn();
  render(<IntakeRoundSelect year="2026" value="" onChange={change} />);
  await screen.findByLabelText('Đợt tuyển sinh');
  fireEvent.mouseDown(screen.getByLabelText('Đợt tuyển sinh'));
  const option = await screen.findByRole('option', { name: 'Đợt 2', exact: true });
  expect(screen.queryByRole('option', { name: 'Đợt 3', exact: true })).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Chưa xác định đợt' })).toBeInTheDocument();
  fireEvent.click(option);
  expect(change).toHaveBeenCalledWith('2');
  expect(matchesIntakeRound({ intakeRound: null }, 'unassigned')).toBe(true);
  expect(matchesIntakeRound({ intakeRound: null }, '1')).toBe(false);
});
it('matches year and round on the same linked exam group', () => {
  const offering = { groups: [{ academicYear: '2026', intakeRound: 1 }, { academicYear: '2025', intakeRound: 2 }] };
  expect(matchesExam(offering, { year: '2026', intakeRound: '2' })).toBe(false);
  expect(matchesExam(offering, { year: '2026', intakeRound: '1' })).toBe(true);
});

it.each(['filter', 'plain', 'scheduling'])('renders %s variant without an overlapping MUI floating label', async (variant) => {
  axios.get.mockResolvedValue({ data: [{ academicYear: '2026', intakeRound: 2 }] });
  const change = vi.fn();
  const { container } = render(<IntakeRoundSelect variant={variant} label="Đợt" year="2026" value="" onChange={change} />);
  const control = await screen.findByLabelText('Đợt');
  expect(container.querySelector('.MuiInputLabel-root')).toBeNull();
  fireEvent.mouseDown(control);
  const option = await screen.findByRole('option', { name: 'Đợt 2', exact: true });
  fireEvent.click(option);
  expect(change).toHaveBeenCalledWith('2');
});
