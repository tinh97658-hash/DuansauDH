import { renderToastHost } from "../renderToastHost";
beforeEach(renderToastHost);
import React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import StudyLeaves from '../../pages/masters/studyLeaves';
import AdmissionRecords from '../../pages/plan/admissionRecords';
import { renderWithPermissions } from '../renderWithPermissions';

const render = ui => renderWithPermissions(ui, ['admission.view', 'admission.manage', 'plan.view']);

jest.mock('axios');
jest.mock('../../components/FeatureLayout', () => ({ children }) => <div>{children}</div>);
const row = { id: 'leave', admissionRecordId: 'record', fullName: 'Nguyễn Văn A', code: 'HV001', trainingLevel: 'Thạc sĩ',
  classCode: 'K24', startDate: '2026-01-01', endDate: '2026-06-30', status: 'overdue', overdueDays: 3,
  extensions: [{ status: 'pending' }] };
beforeEach(() => { jest.resetAllMocks(); axios.get.mockResolvedValue({ data: { rows: [row], total: 1 } }); });

it('creates requests from management by selecting a learner code and refreshes the leave list', async () => {
  const learner = { id: 'learner', code: 'HV001', fullName: 'Nguyễn Văn A', majorName: 'Công nghệ thông tin' };
  axios.get.mockImplementation(async url => url.endsWith('/study-leaves/learners')
    ? { data: [learner] } : { data: { rows: [row], total: 1 } });
  axios.post.mockResolvedValue({ data: {} });
  renderWithPermissions(<MemoryRouter useTransitions={false}><StudyLeaves /></MemoryRouter>, ['plan.view', 'studyleave.request', 'studyleave.approve']);
  fireEvent.click(screen.getByRole('button', { name: 'Tạo yêu cầu bảo lưu' }));
  const dialog = within(screen.getByRole('dialog'));
  fireEvent.change(dialog.getByRole('combobox', { name: /Mã học viên/ }), { target: { value: 'HV001' } });
  fireEvent.click(await screen.findByRole('option', { name: /HV001 — Nguyễn Văn A/ }));
  expect(dialog.getByText('Công nghệ thông tin')).toBeInTheDocument();
  fireEvent.change(dialog.getByLabelText('Ngày kết thúc bảo lưu'), { target: { value: '31/12/2099' } });
  fireEvent.change(dialog.getByLabelText(/Lý do \/ thông tin quyết định/), { target: { value: 'Điều trị' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Xác nhận' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/admission-records/learner/study-leaves'),
    expect.objectContaining({ reason: 'Điều trị', endDate: '2099-12-31' }), { withCredentials: true }));
  expect(await screen.findByText('Đã tạo yêu cầu bảo lưu cho Nguyễn Văn A (HV001).')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).toBeNull();
  await waitFor(() => expect(axios.get.mock.calls.filter(([url]) => url.endsWith('/plan/study-leaves')).length).toBeGreaterThan(1));
});

it('hides request creation without study leave management permission', async () => {
  render(<MemoryRouter useTransitions={false}><StudyLeaves /></MemoryRouter>);
  await screen.findByText('Nguyễn Văn A');
  expect(screen.queryByRole('button', { name: 'Tạo yêu cầu bảo lưu' })).toBeNull();
});

const setupPending = (pendingStatus = 'pending') => {
  const pending = { ...row, id: 'pending-leave', status: 'pending', extensions: [], reason: 'Điều trị' };
  axios.get.mockImplementation(async url => url.includes('/admission-records/')
    ? { data: { leaves: [{ ...pending, status: pendingStatus }], affectedOfferings: [{ courseOfferingId: 'offering', subjectName: 'Triết học', offeringName: 'Lớp Triết học' }] } }
    : { data: { rows: [pending, row], total: 2 } });
  return pending;
};
const mountWithDecisions = () => renderWithPermissions(<MemoryRouter useTransitions={false}><StudyLeaves /></MemoryRouter>, ['plan.view', 'studyleave.request', 'studyleave.approve']);

it('allows request-only staff to create but hides approve and reject actions', async () => {
  setupPending();
  renderWithPermissions(<MemoryRouter useTransitions={false}><StudyLeaves /></MemoryRouter>, ['plan.view', 'studyleave.request']);
  await screen.findAllByText('Nguyễn Văn A');
  expect(screen.getByRole('button', { name: 'Tạo yêu cầu bảo lưu' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Duyệt bảo lưu' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Từ chối' })).not.toBeInTheDocument();
});

it.each(['approve', 'reject'])('handles %s in the approval column with confirmation and refreshes the list', async action => {
  setupPending();
  axios.post.mockResolvedValue({ data: {} });
  mountWithDecisions();
  const headers = (await screen.findAllByRole('columnheader')).map(cell => cell.textContent);
  expect(headers.slice(-3)).toEqual(['Quá hạn', 'Phê duyệt', 'Thao tác']);
  const trigger = await screen.findByRole('button', { name: action === 'approve' ? 'Duyệt bảo lưu' : 'Từ chối' });
  expect(within(trigger.closest('tr')).getAllByRole('cell')[5]).toContainElement(trigger);
  expect(screen.getAllByRole('button', { name: 'Duyệt bảo lưu' })).toHaveLength(1);
  fireEvent.click(trigger);
  const dialog = within(screen.getByRole('dialog'));
  await dialog.findByText('Lý do: Điều trị');
  expect(axios.post).not.toHaveBeenCalled();
  if (action === 'approve') {
    expect(dialog.getByText('Triết học')).toBeInTheDocument();
    expect(dialog.getByText(/Rút khỏi danh sách lớp ngay khi duyệt/)).toBeInTheDocument();
  } else {
    expect(dialog.getByRole('button', { name: 'Xác nhận' })).toBeDisabled();
    fireEvent.change(dialog.getByLabelText(/Lý do \/ thông tin quyết định/), { target: { value: 'Thiếu quyết định' } });
  }
  fireEvent.click(dialog.getByRole('button', { name: 'Xác nhận' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/study-leaves/pending-leave/actions'),
    { action, note: action === 'approve' ? '' : 'Thiếu quyết định' }, { withCredentials: true }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(axios.get.mock.calls.filter(([url]) => url.endsWith('/plan/study-leaves')).length).toBeGreaterThan(1));
});

it('hides pending approval actions without management permission', async () => {
  setupPending();
  render(<MemoryRouter useTransitions={false}><StudyLeaves /></MemoryRouter>);
  await screen.findByText('Chờ duyệt');
  expect(screen.queryByRole('button', { name: 'Duyệt bảo lưu' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Từ chối' })).toBeNull();
});

it('blocks approval when the request was already processed', async () => {
  setupPending('approved');
  mountWithDecisions();
  fireEvent.click(await screen.findByRole('button', { name: 'Duyệt bảo lưu' }));
  const dialog = within(screen.getByRole('dialog'));
  await dialog.findByText('Yêu cầu đã được xử lý. Vui lòng tải lại danh sách.');
  expect(dialog.getByRole('button', { name: 'Xác nhận' })).toBeDisabled();
  expect(axios.post).not.toHaveBeenCalled();
});

it('shows overdue days, a pending extension and a direct link to the learner leave tab', async () => {
  render(<MemoryRouter useTransitions={false}><StudyLeaves /></MemoryRouter>);
  expect(await screen.findByText('Nguyễn Văn A')).toBeInTheDocument();
  expect(screen.getByText('3 ngày')).toBeInTheDocument();
  expect(screen.getByText('Có gia hạn chờ duyệt')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Mở hồ sơ' })).toHaveAttribute('href', '/masters/study-leaves/record?tab=leave');
});

it('passes search and an overdue filter to the API and keeps the list empty when nothing matches', async () => {
  render(<MemoryRouter useTransitions={false}><StudyLeaves /></MemoryRouter>);
  await screen.findByText('Nguyễn Văn A');
  axios.get.mockResolvedValue({ data: { rows: [], total: 0 } });
  fireEvent.change(screen.getByLabelText('Tìm mã hoặc tên học viên'), { target: { value: 'HV999' } });
  fireEvent.mouseDown(screen.getByLabelText('Trạng thái bảo lưu'));
  fireEvent.click(screen.getByRole('option', { name: 'Bảo lưu quá hạn' }));
  await waitFor(() => expect(axios.get).toHaveBeenLastCalledWith(expect.stringContaining('/plan/study-leaves'), {
    withCredentials: true, params: { status: 'overdue', search: 'HV999', page: 1, pageSize: 20 },
  }));
  expect(await screen.findByText('Không có hồ sơ bảo lưu phù hợp.')).toBeInTheDocument();
});

const managedStatuses = ['Bảo lưu', 'Đang bảo lưu', 'Bảo lưu quá hạn', 'Thôi học', 'Đã thôi học', 'Tạm hoãn', 'Từ chối'];
const managedRecords = managedStatuses.map((studyStatus, index) => ({
  id: `managed-${index}`, code: `HV${index}`, fullName: `Hồ sơ ${index}`, trainingLevel: 'Thạc sĩ',
  lastName: 'Nguyễn Văn', firstName: `An${index}`, email: `an${index}@example.test`, dob: '1995-04-03',
  studyStatus, academicYear: '2024', major: { name: 'Công nghệ thông tin' }, assignedGroup: null,
}));
const setupManaged = (total = 7) => axios.get.mockImplementation(async url => {
  if (url.includes('/system/training-years')) return { data: [
    { name: '2024', startDate: '2024-01-01', active: true },
    { name: '2026', startDate: '2026-01-01', active: true },
  ] };
  if (url.includes('/system/majors')) return { data: [{ id: 'major', name: 'Công nghệ thông tin', program: 'masters', disciplineId: 'discipline', discipline: { name: 'Ngành CNTT' } }] };
  if (url.includes('/plan/admission-records')) return { data: { data: managedRecords, pagination: { total, totalPages: Math.ceil(total / 15) } } };
  return { data: { rows: [row], total: 1 } };
});

it('adds managed profiles without a leave while retaining the existing leave list', async () => {
  setupManaged();
  render(<MemoryRouter useTransitions={false}><StudyLeaves /></MemoryRouter>);
  await screen.findByText('Nguyễn Văn A');
  fireEvent.click(screen.getByRole('tab', { name: 'Hồ sơ bảo lưu' }));
  const table = await screen.findByRole('table', { name: 'Hồ sơ bảo lưu' });
  await within(table).findByText('HV6');
  expect(within(table).getAllByRole('row')).toHaveLength(8);
  expect(within(table).getAllByText('Thôi học')).toHaveLength(2);
  expect(within(table).getByRole('link', { name: 'An0' })).toHaveAttribute('href', '/masters/study-leaves/managed-0?returnView=records');
  expect(within(table).getByRole('link', { name: 'An6' })).toHaveAttribute('href', '/masters/study-leaves/managed-6?returnView=records');
  const request = axios.get.mock.calls.find(([url]) => url.includes('/plan/admission-records?'));
  const params = new URL(request[0]).searchParams;
  for (const [key, value] of Object.entries({ admissionStage: 'study-management', trainingLevel: 'Thạc sĩ', includeGroup: 'true', page: '1', pageSize: '15' })) expect(params.get(key)).toBe(value);
  expect(params.has('academicYear')).toBe(false);
  expect(screen.queryByText(/Quản lý hồ sơ Bảo lưu, Đang bảo lưu/)).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Các đợt bảo lưu' }));
  expect(await screen.findByText('Nguyễn Văn A')).toBeInTheDocument();
});

it('restores the managed tab from its URL and filters/paginates on the server', async () => {
  setupManaged(45);
  render(<MemoryRouter useTransitions={false} initialEntries={['/masters/study-leaves?view=records']}><StudyLeaves /></MemoryRouter>);
  await screen.findByText('HV0');
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  await waitFor(() => expect(axios.get).toHaveBeenLastCalledWith(expect.stringContaining('page=2'), expect.any(Object)));
  fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'HV001' } });
  fireEvent.mouseDown(screen.getByLabelText('Trạng thái'));
  for (const status of managedStatuses.filter(status => status !== 'Đã thôi học')) expect(screen.getByRole('option', { name: status })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('option', { name: 'Tạm hoãn' }));
  fireEvent.mouseDown(screen.getByLabelText('Năm'));fireEvent.click(screen.getByRole('option', { name: '2024' }));
  await waitFor(() => {
    const params = new URL(axios.get.mock.calls.at(-1)[0]).searchParams;
    for (const [key, value] of Object.entries({ status: 'Tạm hoãn', academicYear: '2024', search: 'HV001', page: '1' })) expect(params.get(key)).toBe(value);
  });
});

it('keeps the profile columns and edit actions without bulk tuition selection in the retained-profile tab', async () => {
  setupManaged();
  const admitted = render(<MemoryRouter useTransitions={false}><AdmissionRecords mode="admitted-masters" /></MemoryRouter>);
  const source = await screen.findByRole('table', { name: 'Hồ sơ trúng tuyển' });
  expect(within(source).getByRole('checkbox', { name: 'Chọn tất cả học viên chưa nộp học phí trên trang này' })).toBeInTheDocument();
  const headers = within(source).getAllByRole('columnheader').slice(1).map(cell => cell.textContent);
  admitted.unmount();
  render(<MemoryRouter useTransitions={false} initialEntries={['/masters/study-leaves?view=records']}><StudyLeaves /></MemoryRouter>);
  const retained = await screen.findByRole('table', { name: 'Hồ sơ bảo lưu' });
  expect(within(retained).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(headers);
  expect(within(retained).queryByRole('checkbox', { name: /Chọn.*học phí/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Xác nhận đã nộp học phí/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Bỏ chọn tất cả' })).not.toBeInTheDocument();
  expect(screen.queryByText(/Đã chọn \d+ học viên/)).not.toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Hồ sơ bảo lưu' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.queryByRole('tab', { name: 'Hồ sơ theo trạng thái' })).toBeNull();
  expect(within(retained).getByText('an0@example.test')).toBeInTheDocument();
  fireEvent.click(within(retained).getByRole('button', { name: 'Sửa hồ sơ HV0' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByDisplayValue('HV0')).toBeInTheDocument();
  expect(within(dialog).getByDisplayValue('An0')).toBeInTheDocument();
});
