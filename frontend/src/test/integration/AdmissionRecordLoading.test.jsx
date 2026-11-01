import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import axios from 'axios';
import theme from '../../theme';
import AdmissionRecordDetail from '../../pages/plan/admissionRecordDetail';
import { AuthSessionContext } from '../../context/AuthSession';

vi.mock('axios');
vi.mock('../../components/FeatureLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('react-toastify', () => ({ ToastContainer: () => null, toast: { error: vi.fn(), success: vi.fn() } }));

const record = { id: 'record', fullName: 'Nguyễn Văn A', code: 'HV001', majorId: 'major', trainingLevel: 'Thạc sĩ', documents: {} };
const session = { authenticated: true, user: { role: 'admin' }, access: { permissions: ['admission.view', 'admission.manage', 'studyleave.request', 'studyleave.approve'] } };
const StudyManagementReturn = () => <p>Danh sách quản lý bảo lưu {useLocation().search}</p>;
const mount = (entry = '/plan/admission-records/record', auth = session) => render(<ThemeProvider theme={theme}><CssBaseline /><AuthSessionContext.Provider value={auth}>
  <MemoryRouter useTransitions={false} initialEntries={[entry]}><Routes>
    <Route path='/plan/admission-records/:id' element={<AdmissionRecordDetail />} />
    <Route path='/masters/admitted-records/:id' element={<AdmissionRecordDetail returnPath="/masters/admitted-records" />} />
    <Route path='/masters/study-leaves/:id' element={<AdmissionRecordDetail returnPath="/masters/study-leaves" />} />
    <Route path='/masters/study-leaves' element={<StudyManagementReturn />} />
  </Routes></MemoryRouter>
</AuthSessionContext.Provider></ThemeProvider>);

beforeEach(() => {
  axios.get.mockImplementation(async url => {
    if (url.endsWith('/admission-records/record')) return { data: record };
    if (url.includes('/system/majors')) return { data: [{ id: 'major', name: 'CNTT', program: 'masters' }] };
    if (url.endsWith('/study-leaves')) return { data: { leaves: [], affectedOfferings: [] } };
    return { data: [] };
  });
});

it.each([false, true])('shows major transfer creation independently from approval: approval=%s', async approve => {
  const reads = axios.get.getMockImplementation();
  axios.get.mockImplementation(url => url.endsWith('/major-transfers')
    ? Promise.resolve({ data: [{ id: 'transfer', status: 'pending', fromMajor: { name: 'CNTT' }, toMajor: { name: 'Kinh tế' } }] }) : reads(url));
  mount('/plan/admission-records/record', { ...session, access: { permissions: ['admission.view', ...(approve ? ['majortransfer.approve'] : ['majortransfer.request'])] } });
  await screen.findByText('CNTT → Kinh tế');
  if (approve) {
    expect(screen.queryByRole('button', { name: 'Chuyển chuyên ngành' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duyệt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeInTheDocument();
  } else {
    expect(screen.getByRole('button', { name: 'Chuyển chuyên ngành' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duyệt' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Từ chối' })).not.toBeInTheDocument();
  }
});
it.each([
  '/masters/admitted-records/record?tab=leave',
  '/masters/study-leaves/record?tab=leave',
])('keeps pending leave details readable without approval buttons: %s', async entry => {
  const reads = axios.get.getMockImplementation();
  axios.get.mockImplementation(url => url.endsWith('/study-leaves')
    ? Promise.resolve({ data: { leaves: [{ id: 'leave', status: 'pending', effectiveStatus: 'pending', reason: 'Điều trị', startDate: '2099-01-01', endDate: '2099-06-01', history: [{ action: 'requested', at: '2026-10-28T01:00:00Z', actor: 'Quản trị' }] }], affectedOfferings: [] } })
    : reads(url));
  mount(entry);
  await screen.findByText('Lý do: Điều trị');
  expect(screen.queryByRole('button', { name: 'Tạo yêu cầu bảo lưu' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Duyệt bảo lưu' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Từ chối' })).toBeNull();
  expect(screen.getByText(/Tạo yêu cầu · Quản trị/)).toBeInTheDocument();
});

it('opens the leave tab from management and returns to the managed-profile list', async () => {
  mount('/masters/study-leaves/record?tab=leave&returnView=records');
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Bảo lưu' })).toHaveAttribute('aria-selected', 'true'));
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/admission-records/record/study-leaves'), expect.objectContaining({ withCredentials: true })));
  fireEvent.click(screen.getByRole('button', { name: 'Quay lại danh sách' }));
  expect(await screen.findByText('Danh sách quản lý bảo lưu ?view=records')).toBeInTheDocument();
});
it('keeps the disabled reload tooltip free of MUI console warnings while loading', async () => {
  const errors=vi.spyOn(console,'error').mockImplementation(()=>{});
  axios.get.mockImplementation(()=>new Promise(()=>{}));
  try {
    mount();
    await screen.findByText('Quay lại danh sách');
    expect(errors.mock.calls.filter(args=>args.some(value=>String(value).includes('disabled `button` child')))).toHaveLength(0);
  } finally { errors.mockRestore(); }
});

it('shows the profile without fetching unopened learning tabs or rechecking the verified session', async () => {
  mount('/plan/admission-records/record?tab=learning');
  expect(await screen.findByDisplayValue('HV001')).toBeInTheDocument();
  expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Thông tin hồ sơ', 'Xét tuyển']);
  expect(screen.getByRole('tab', { name: 'Thông tin hồ sơ' })).toHaveAttribute('aria-selected', 'true');
  const paths = axios.get.mock.calls.map(([url]) => url);
  expect(paths.some(url => /learning-results|studied-subjects|subject-recognitions|recognized-credits|bridge-knowledge|\/plan\/subjects/.test(url))).toBe(false);
  expect(paths.some(url => url.includes('/auth/'))).toBe(false);
});

it('loads learning on demand, shows progress during a slow request and keeps the profile available', async () => {
  let resolveStudied;
  const reads = axios.get.getMockImplementation();
  axios.get.mockImplementation(url => url.includes('/studied-subjects')
    ? new Promise(resolve => { resolveStudied = resolve; }) : reads(url));
  mount('/masters/admitted-records/record');
  await screen.findByDisplayValue('HV001');
  fireEvent.click(screen.getByRole('tab', { name: 'Học tập' }));
  expect(await screen.findByText('Đang tải dữ liệu học tập...')).toBeVisible();
  await waitFor(() => expect(resolveStudied).toBeTypeOf('function'));
  fireEvent.click(screen.getByRole('tab', { name: 'Thông tin hồ sơ' }));
  expect(screen.getByDisplayValue('HV001')).toBeVisible();
  await act(async () => resolveStudied({ data: [] }));
});
