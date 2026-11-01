import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import axios from 'axios';
import theme from '../../theme';
import Units from '../../pages/system/units';
import { AuthSessionContext } from '../../context/AuthSession';

vi.mock('axios');
vi.mock('../../components/FeatureLayout', () => ({ default: ({ children }) => <div>{children}</div> }));

it('keeps the catalog status control and data layout for supervisors while blocking changes', async () => {
  axios.get.mockResolvedValue({ data: [{ id: 'unit', code: 'DV1', name: 'Đơn vị 1', active: true }] });
  const view = permissions => <AuthSessionContext.Provider value={{ user: { role: permissions.includes('catalog.manage') ? 'admin' : 'supervisor' }, access: { permissions } }}><Units /></AuthSessionContext.Provider>;
  const { rerender } = render(view(['catalog.view', 'catalog.manage']));
  const cell = await screen.findByRole('cell', { name: 'Đơn vị 1' });
  const status = screen.getByRole('checkbox', { name: /Vô hiệu hóa/ });
  expect(status).toBeChecked();
  expect(status).toBeEnabled();
  const headers = screen.getAllByRole('columnheader').map(header => header.textContent).filter(label => !label.includes('Thao tác'));
  rerender(view(['catalog.view']));
  expect(screen.getByRole('cell', { name: 'Đơn vị 1' })).toBe(cell);
  expect(screen.getByRole('checkbox', { name: /Vô hiệu hóa/ })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: /Vô hiệu hóa/ })).toBeDisabled();
  expect(screen.getAllByRole('columnheader').map(header => header.textContent)).toEqual(headers);
  fireEvent.doubleClick(cell);
  fireEvent.click(screen.getByRole('checkbox', { name: /Vô hiệu hóa/ }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Thêm mới' })).not.toBeInTheDocument();
  expect(axios.put).not.toHaveBeenCalled();
});

it('limits catalog rendering, navigates to later rows, searches the entire catalog and reuses the verified role', async () => {
  const rows = Array.from({ length: 30 }, (_, index) => ({ id: `unit-${index}`, code: `DV${index + 1}`, name: `Đơn vị ${index + 1}`, active: true }));
  axios.get.mockResolvedValue({ data: rows });
  render(<ThemeProvider theme={theme}><CssBaseline /><AuthSessionContext.Provider value={{ authenticated: true, user: { role: 'custom' }, access: { permissions: ['catalog.manage'] } }}><Units /></AuthSessionContext.Provider></ThemeProvider>);
  const table = await screen.findByRole('table', { name: 'Đơn vị' });
  await screen.findByRole('cell', { name: 'DV1' });
  expect(within(table).getAllByRole('row')).toHaveLength(26);
  expect(screen.queryByText('Đơn vị 30')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  expect(screen.getByText('Đơn vị 30')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Tìm kiếm' }), { target: { value: 'Đơn vị 1' } });
  expect(screen.getByText('Đơn vị 1')).toBeInTheDocument();
  expect(screen.queryByText('Đơn vị 30')).not.toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledTimes(1);
  expect(axios.get.mock.calls[0][0]).toContain('/system/units');
});
