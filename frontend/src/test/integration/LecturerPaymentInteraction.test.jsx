import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import LecturerPayments from '../../pages/reports/lecturerPayments';
import { AuthSessionContext } from '../../context/AuthSession';

vi.mock('axios');
vi.mock('../../components/FeatureLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
const row = i => ({ courseOfferingId: `offering-${i}`, lecturerId: `lecturer-${i}`, lecturerName: `Teacher ${i}`,
  offeringName: `Class ${i}`, sessionCount: 3, completedAt: '2026-11-02T18:00:00Z', paid: false });
const mount = (permissions = ['reports.view', 'reports.payments.manage']) => render(<AuthSessionContext.Provider
  value={{ user: {}, access: { permissions, groupScope: {} } }}><LecturerPayments /></AuthSessionContext.Provider>);
const box = i => screen.getByLabelText(`Đã thanh toán: Teacher ${i} – Class ${i}`);
let data;
beforeEach(() => {
  vi.clearAllMocks(); data = Array.from({ length: 80 }, (_, i) => row(i));
  axios.get.mockImplementation(async (url, config) => ({ data: url.endsWith('/options') ? { units: [], lecturers: [] }
    : { rows: data.filter(r => !config?.params?.paymentStatus || config.params.paymentStatus === 'all' || r.paid === (config.params.paymentStatus === 'paid')) } }));
});

it('keeps every row mounted for slow saves at the start, middle and end and allows other rows to save', async () => {
  const resolve = new Map();
  axios.put.mockImplementation((url) => new Promise(done => resolve.set(url.split('/').at(-1), done)));
  mount(); await screen.findByText('Teacher 79');
  const table = screen.getByRole('table'), before = [...table.tBodies[0].rows], requests = axios.get.mock.calls.length;
  for (const i of [0, 39, 79]) fireEvent.click(box(i));
  expect(axios.put).toHaveBeenCalledTimes(3);
  expect(table.tBodies[0].rows).toHaveLength(80);
  expect(box(1)).toBeEnabled(); expect(box(39)).toBeDisabled();
  expect(screen.getByLabelText('Tìm kiếm')).toBeEnabled();
  for (const i of [79, 0, 39]) {
    await act(async () => resolve.get(`lecturer-${i}`)({ data: { paid: true } }));
    expect(box(i)).toBeChecked();
  }
  expect([...table.tBodies[0].rows].every((element, i) => element === before[i])).toBe(true);
  expect(axios.get).toHaveBeenCalledTimes(requests);
});

it('prevents overlapping saves for a pair, preserves rows on failure and allows retry', async () => {
  data = [row(0), row(1)]; let reject;
  axios.put.mockImplementation(() => new Promise((_done, fail) => { reject = fail; }));
  mount(); await screen.findByText('Teacher 0');
  fireEvent.click(box(0)); fireEvent.click(box(0));
  expect(axios.put).toHaveBeenCalledTimes(1);
  await act(async () => reject({ response: { data: { message: 'Save failed' } } }));
  expect(await screen.findByText('Save failed')).toBeInTheDocument();
  expect(box(0)).not.toBeChecked(); expect(box(0)).toBeEnabled(); expect(box(1)).toBeEnabled();
});

it('removes only the saved row under the unpaid filter and retains the filter and other DOM rows', async () => {
  data = [row(0), row(1), row(2)]; axios.put.mockResolvedValue({ data: { paid: true } });
  mount(); await screen.findByText('Teacher 2');
  fireEvent.change(screen.getByLabelText('Trạng thái thanh toán'), { target: { value: 'unpaid' } });
  await waitFor(() => expect(box(2)).toBeEnabled());
  const next = box(2).closest('tr'); fireEvent.click(box(1));
  await waitFor(() => expect(screen.queryByText('Teacher 1')).not.toBeInTheDocument());
  expect(box(2).closest('tr')).toBe(next);
  expect(screen.getByLabelText('Trạng thái thanh toán')).toHaveValue('unpaid');
});

it('does not offer bulk writes to report viewers', async () => {
  data = [row(0)]; mount(['reports.view']); await screen.findByText('Teacher 0');
  expect(box(0)).toBeDisabled(); expect(axios.post).not.toHaveBeenCalled();
});

it('offers only per-row payment checkboxes without a select-all or bulk toolbar', async () => {
  data = [row(0), row(1)]; mount(); await screen.findByText('Teacher 1');
  expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  expect(screen.queryByLabelText('Chọn tất cả dòng thanh toán')).not.toBeInTheDocument();
  expect(screen.queryByText('Bỏ chọn tất cả')).not.toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
});
