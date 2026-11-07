import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { vi } from 'vitest';
import theme from '../../theme';
import DashboardSelect from '../../features/dashboard/DashboardSelect';

const bounds = { top: 420, bottom: 458, left: 200, right: 405, width: 205, height: 38, x: 200, y: 420, toJSON: () => ({}) };
function setup() {
  const onChange = vi.fn();
  render(<ThemeProvider theme={theme}><DashboardSelect aria-label="Chủ đề" value="learners" onChange={onChange}>
    <option value="learners">Hồ sơ</option><option value="sessions">Buổi học</option><option value="monthly">Theo tháng</option>
  </DashboardSelect></ThemeProvider>);
  const control = screen.getByRole('combobox', { name: 'Chủ đề' });
  control.getBoundingClientRect = () => bounds;
  return { control, onChange };
}
it('opens the real options and selects their unchanged values with the product theme enabled', async () => {
  const { control, onChange } = setup();
  fireEvent.mouseDown(control, { button: 0 });
  const list = await screen.findByRole('listbox', { name: 'Chủ đề' });
  expect(list.closest('.od-select-popper')).toHaveAttribute('role', 'presentation');
  expect(control).toHaveAttribute('aria-expanded', 'true');
  expect(within(list).getByRole('option', { name: 'Hồ sơ' })).toHaveAttribute('aria-selected', 'true');
  fireEvent.click(within(list).getByRole('option', { name: 'Theo tháng' }));
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange.mock.calls[0][0].target.value).toBe('monthly');
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  expect(control).toHaveFocus();
});
it('supports keyboard navigation, Escape and restoring control focus without changing a value', async () => {
  const { control, onChange } = setup();
  control.focus(); await userEvent.keyboard('{ArrowDown}');
  const list = await screen.findByRole('listbox');
  await userEvent.keyboard('{End}');
  expect(within(list).getByRole('option', { name: 'Theo tháng' })).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(control).toHaveFocus(); expect(onChange).not.toHaveBeenCalled();
});
