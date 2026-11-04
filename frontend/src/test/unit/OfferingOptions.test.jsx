import React from 'react';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import FilterSelectField from '../../components/FilterSelectField';
import { offeringOptions, offeringMenuProps } from '../../features/exams/OfferingOptions';

it('keeps group headers unselectable and selects offering IDs with the keyboard', async () => {
  const change = vi.fn();
  const choices = ['teaching', 'components_missing', 'eligibility_ready'].map((gradebookStage, i) => ({
    offering: { id: `o${i}`, gradebookStage, name: `Class ${i}` }, group: {},
  }));
  render(<FilterSelectField label="Class" value="o0" onChange={change} MenuProps={offeringMenuProps}>
    {offeringOptions(choices, item => item.offering.name)}
  </FilterSelectField>);
  fireEvent.mouseDown(screen.getByLabelText('Class'));
  const list = screen.getByRole('listbox');
  expect(within(list).getAllByRole('option')).toHaveLength(3);
  expect(within(list).getAllByRole('presentation')).toHaveLength(2);
  expect(within(list).getByText('2 lớp')).toBeInTheDocument();
  expect(within(list).queryByText('Đang giảng dạy')).not.toBeInTheDocument();
  expect(within(list).getByText('Thiếu điểm TP')).toBeInTheDocument();
  await userEvent.keyboard('{ArrowDown}{Enter}');
  expect(change).toHaveBeenCalledWith(expect.objectContaining({ target: expect.objectContaining({ value: 'o1' }) }), expect.anything());
});

it('opens at the first option instead of a deep selection and closes with Escape or outside click', async () => {
  const choices = Array.from({ length: 30 }, (_, i) => ({ offering: { id: `o${i}`, gradebookStage: 'teaching', name: `Class ${i}` }, group: {} }));
  render(<FilterSelectField label="Class" value="o29" onChange={vi.fn()} MenuProps={offeringMenuProps}>
    {offeringOptions(choices, item => item.offering.name)}
  </FilterSelectField>);
  fireEvent.mouseDown(screen.getByLabelText('Class'));
  const list = screen.getByRole('listbox');
  expect(within(list).getByRole('option', { name: 'Class 0' })).toHaveFocus();
  expect(list.closest('.exam-stage-menu')).toHaveStyle({ overflowY: 'auto', overscrollBehaviorY: 'contain' });
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  fireEvent.mouseDown(screen.getByLabelText('Class'));
  fireEvent.click(document.querySelector('.MuiBackdrop-root'));
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
});
