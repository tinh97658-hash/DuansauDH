import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import axios from 'axios';
import theme from '../../theme';
import Units from '../../pages/system/units';
import { AuthSessionContext } from '../../context/AuthSession';

vi.mock('axios');
vi.mock('../../components/FeatureLayout', () => ({ default: ({ children }) => <div>{children}</div> }));

it('limits catalog rendering, navigates to later rows, searches the entire catalog and reuses the verified role', async () => {
  const rows = Array.from({ length: 30 }, (_, index) => ({ id: `unit-${index}`, code: `DV${index + 1}`, name: `Đơn vị ${index + 1}`, active: true }));
  axios.get.mockResolvedValue({ data: rows });
  render(<ThemeProvider theme={theme}><CssBaseline /><AuthSessionContext.Provider value={{ authenticated: true, user: { role: 'admin' } }}><Units /></AuthSessionContext.Provider></ThemeProvider>);
  const table = await screen.findByRole('table', { name: 'Đơn vị' });
  await screen.findByRole('button', { name: 'Sửa mã đơn vị DV1' });
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
