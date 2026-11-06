import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import LecturerPayments from '../../pages/reports/lecturerPayments';
import { AuthSessionContext } from '../../context/AuthSession';

vi.mock('axios');
vi.mock('../../components/FeatureLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
const row = i => ({ courseOfferingId: `offering-${i}`, lecturerId: `lecturer-${i}`, lecturerName: `Teacher ${i}`,
  offeringName: `Class ${i}`, sessionCount: 3, completedAt: '2026-11-02T18:00:00Z', paid: false, paymentDate: null, note: '', paymentVersion: null });
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
  for (const i of [0, 39, 79]) {
    fireEvent.click(box(i));
  }
  await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(3));
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
  fireEvent.click(box(0));
  fireEvent.click(box(0));
  await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(1));
  await act(async () => reject({ response: { data: { message: 'Save failed' } } }));
  expect(await screen.findByText('Save failed')).toBeInTheDocument();
  expect(box(0)).not.toBeChecked(); expect(box(0)).toBeEnabled(); expect(box(1)).toBeEnabled();
  axios.put.mockResolvedValue({ data: { paid: true, paymentDate: '2026-11-05', note: '', paymentVersion: 'retry' } });
  fireEvent.click(box(0));
  await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(box(0)).toBeEnabled());
  expect(box(0)).toBeChecked();
});

it('saves a note only on Enter or blur and does not duplicate the Enter request on blur', async () => {
  data = [row(0)]; let resolve;
  axios.put.mockImplementation(() => new Promise(done => { resolve = done; }));
  mount(); await screen.findByText('Teacher 0');
  const note = screen.getByLabelText('Ghi chú: Teacher 0 – Class 0');
  fireEvent.focus(note); fireEvent.blur(note);
  expect(axios.put).not.toHaveBeenCalled();
  fireEvent.change(note, { target: { value: 'Chờ' } });
  fireEvent.change(note, { target: { value: 'Chờ chứng từ' } });
  expect(axios.put).not.toHaveBeenCalled();
  fireEvent.keyDown(note, { key: 'Enter' }); fireEvent.blur(note);
  await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(1));
  expect(axios.put.mock.calls[0][1]).toEqual({ paid: false, paymentVersion: null, note: 'Chờ chứng từ' });
  await act(async () => resolve({ data: { paid: false, paymentDate: null, note: 'Chờ chứng từ', paymentVersion: 'v1' } }));
  fireEvent.blur(note);
  expect(axios.put).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: /^(Lưu|Hủy):/ })).not.toBeInTheDocument();
});

it('serializes checkbox and note saves with the latest version and keeps newer typing during an older save', async () => {
  data = [row(0)]; const resolve = [];
  axios.put.mockImplementation(() => new Promise(done => resolve.push(done)));
  mount(); await screen.findByText('Teacher 0');
  const note = screen.getByLabelText('Ghi chú: Teacher 0 – Class 0');
  fireEvent.click(box(0));
  await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(1));
  expect(axios.put.mock.calls[0][1]).not.toHaveProperty('note');
  fireEvent.change(note, { target: { value: 'Bản đầu' } }); fireEvent.keyDown(note, { key: 'Enter' });
  expect(axios.put).toHaveBeenCalledTimes(1);
  await act(async () => resolve[0]({ data: { paid: true, paymentDate: '2026-11-05', note: '', paymentVersion: 'v1' } }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(2));
  expect(axios.put.mock.calls[1][1]).toEqual({ paid: true, paymentVersion: 'v1', note: 'Bản đầu' });
  fireEvent.change(note, { target: { value: 'Bản mới đang nhập' } });
  await act(async () => resolve[1]({ data: { paid: true, paymentDate: '2026-11-05', note: 'Bản đầu', paymentVersion: 'v2' } }));
  expect(note).toHaveValue('Bản mới đang nhập');
  fireEvent.blur(note);
  await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(3));
  expect(axios.put.mock.calls[2][1]).toEqual({ paid: true, paymentVersion: 'v2', note: 'Bản mới đang nhập' });
  await act(async () => resolve[2]({ data: { paid: true, paymentDate: '2026-11-05', note: 'Bản mới đang nhập', paymentVersion: 'v3' } }));
  expect(note).toHaveValue('Bản mới đang nhập');
  expect(box(0)).toBeChecked();
});

it('preserves a failed note and retries when the user leaves the field again', async () => {
  data = [row(0)]; axios.put.mockRejectedValueOnce({ response: { data: { message: 'Ghi chú chưa lưu được' } } });
  mount(); await screen.findByText('Teacher 0');
  const note = screen.getByLabelText('Ghi chú: Teacher 0 – Class 0');
  fireEvent.change(note, { target: { value: 'Nội dung cần giữ' } }); fireEvent.blur(note);
  await screen.findByText('Ghi chú chưa lưu được');
  expect(note).toHaveValue('Nội dung cần giữ');
  axios.put.mockResolvedValue({ data: { paid: false, paymentDate: null, note: 'Nội dung cần giữ', paymentVersion: 'v1' } });
  fireEvent.focus(note); fireEvent.blur(note);
  await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByText('Ghi chú chưa lưu được')).not.toBeInTheDocument());
});

it('keeps the latest note visible when queued edits return to an earlier value', async () => {
  data = [row(0)]; const resolve = [];
  axios.put.mockImplementation(() => new Promise(done => resolve.push(done)));
  mount(); await screen.findByText('Teacher 0');
  const note = screen.getByLabelText('Ghi chú: Teacher 0 – Class 0');
  for (const value of ['Nội dung A', 'Nội dung B', 'Nội dung A']) {
    fireEvent.change(note, { target: { value } }); fireEvent.keyDown(note, { key: 'Enter' });
  }
  await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(1));
  for (let i = 0; i < 3; i++) {
    await act(async () => resolve[i]({ data: { paid: false, paymentDate: null, note: i === 1 ? 'Nội dung B' : 'Nội dung A', paymentVersion: `v${i+1}` } }));
    expect(note).toHaveValue('Nội dung A');
    if (i < 2) await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(i+2));
  }
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

it('anchors the adjacent visible row and keeps horizontal position when a saved row leaves the unpaid filter', async () => {
  data = [row(0), row(1), row(2)]; axios.put.mockResolvedValue({ data: { paid: true, paymentDate: '2026-11-04', note: '', paymentVersion: 'new' } });
  mount(); await screen.findByText('Teacher 2');
  fireEvent.change(screen.getByLabelText('Trạng thái thanh toán'), { target: { value: 'unpaid' } });
  await waitFor(() => expect(box(2)).toBeEnabled());
  const anchor = box(2).closest('tr'), scroll = anchor.closest('.tp-table-scroll');
  scroll.scrollLeft = 123;
  vi.spyOn(anchor, 'getBoundingClientRect').mockImplementation(() => ({
    top: screen.queryByText('Teacher 1') ? 500 : 440, bottom: 560, left: 0, right: 100, width: 100, height: 60,
  }));
  const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
  fireEvent.click(box(1));
  await waitFor(() => expect(screen.queryByText('Teacher 1')).not.toBeInTheDocument());
  expect(scrollBy).toHaveBeenCalledWith({ top: -60, left: 0, behavior: 'instant' });
  expect(scroll.scrollLeft).toBe(123);
  expect(box(2).closest('tr')).toBe(anchor);
  expect(box(2)).toHaveFocus();
  scrollBy.mockRestore();
});
