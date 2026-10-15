import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import StudyLeavePanel from '../../features/learners/StudyLeavePanel';

jest.mock('axios');
const record = { id: 'learner', fullName: 'Nguyễn Văn A', studyStatus: 'Đang học' };
const currentDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const leave = { id: 'leave', reason: 'Điều trị', startDate: '2026-01-01', endDate: '2026-06-30', status: 'approved', effectiveStatus: 'overdue',
  history: [], extensions: [], withdrawals: [{ snapshot: { courseOfferingId: 'old-class', subjectName: 'Môn học dở', phase: 'studying', grades: [{ testScore: 0, assignmentScore: 7 }] } }] };
beforeEach(() => { jest.resetAllMocks(); axios.get.mockResolvedValue({ data: { leaves: [], affectedOfferings: [] } }); });

it('creates a dated pending request with a reason and refreshes the record after saving', async () => {
  const onChanged = jest.fn();
  axios.post.mockResolvedValue({ data: { leaves: [{ ...leave, status: 'pending', effectiveStatus: 'pending', withdrawals: [] }], affectedOfferings: [] } });
  render(<StudyLeavePanel record={record} isAdmin onChanged={onChanged} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Tạo yêu cầu bảo lưu' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByRole('button', { name: 'Xác nhận' })).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText(/Ngày bắt đầu bảo lưu/), { target: { value: currentDate() } });
  fireEvent.change(within(dialog).getByLabelText(/Ngày kết thúc bảo lưu/), { target: { value: '2099-06-30' } });
  fireEvent.change(within(dialog).getByLabelText(/Lý do \/ thông tin quyết định/), { target: { value: 'Điều trị' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/admission-records/learner/study-leaves'), {
    reason: 'Điều trị', startDate: currentDate(), endDate: '2099-06-30',
  }, { withCredentials: true }));
  expect(await screen.findByText('Chờ duyệt')).toBeInTheDocument();
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
});

it('shows an overdue extension separately from the unchanged current deadline and keeps zero in old grades', async () => {
  axios.get.mockResolvedValue({ data: { leaves: [{ ...leave, extensions: [{ status: 'pending', endDate: '2027-06-30', reason: 'Xin gia hạn' }] }], affectedOfferings: [] } });
  render(<StudyLeavePanel record={{ ...record, studyStatus: 'Bảo lưu quá hạn' }} isAdmin />);
  expect(await screen.findByText('Bảo lưu quá hạn')).toBeInTheDocument();
  expect(screen.getByText(/Hạn hiện tại vẫn là 30\/06\/2026/)).toBeInTheDocument();
  expect(screen.getByText(/Kiểm tra: 0 · Bài tập: 7/)).toBeInTheDocument();
  expect(screen.getByText('Không đạt do bảo lưu; học lại từ đầu khi trở lại')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Duyệt gia hạn' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Đề nghị gia hạn' })).not.toBeInTheDocument();
});

it('requires confirmation and decision details before resuming, then queues a fresh attempt', async () => {
  axios.get.mockResolvedValue({ data: { leaves: [leave], affectedOfferings: [] } });
  axios.post.mockResolvedValue({ data: { leaves: [{ ...leave, status: 'resumed', effectiveStatus: 'resumed' }], affectedOfferings: [] } });
  render(<StudyLeavePanel record={{ ...record, studyStatus: 'Bảo lưu quá hạn' }} isAdmin />);
  fireEvent.click(await screen.findByRole('button', { name: 'Tiếp nhận học lại' }));
  expect(axios.post).not.toHaveBeenCalled();
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByRole('button', { name: 'Xác nhận' })).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText(/Lý do \/ thông tin quyết định/), { target: { value: 'Quyết định 01' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/study-leaves/leave/actions'), { action: 'resume', note: 'Quyết định 01' }, { withCredentials: true }));
  expect(await screen.findByText(/Các môn đã dừng được đưa vào nhóm cần bố trí học/)).toBeInTheDocument();
});

it('keeps a rejected action open with the server explanation and prevents repeated submission while saving', async () => {
  axios.get.mockResolvedValue({ data: { leaves: [leave], affectedOfferings: [] } });
  let reject;
  axios.post.mockImplementation(() => new Promise((resolve, rejectPromise) => { reject = rejectPromise; }));
  render(<StudyLeavePanel record={{ ...record, studyStatus: 'Bảo lưu quá hạn' }} isAdmin />);
  fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận thôi học' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText(/Lý do \/ thông tin quyết định/), { target: { value: 'Quyết định thôi học' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận' }));
  expect(within(dialog).getByRole('button', { name: /Xác nhận/ })).toBeDisabled();
  reject({ response: { data: { message: 'Đợt bảo lưu đã kết thúc. Hãy tải lại.' } } });
  expect(await within(dialog).findByText('Đợt bảo lưu đã kết thúc. Hãy tải lại.')).toBeInTheDocument();
  expect(axios.post).toHaveBeenCalledTimes(1);
});

it('allows reading history but hides decisions for a non-admin', async () => {
  axios.get.mockResolvedValue({ data: { leaves: [leave], affectedOfferings: [] } });
  render(<StudyLeavePanel record={record} />);
  await screen.findByText('Bảo lưu quá hạn');
  expect(screen.queryByRole('button', { name: 'Tiếp nhận học lại' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Xác nhận thôi học' })).not.toBeInTheDocument();
  expect(screen.getByRole('table', { name: 'Lịch sử dừng học phần' })).toBeInTheDocument();
});

it('does not enable mutations while the profile has unsaved edits', async () => {
  render(<StudyLeavePanel record={record} isAdmin disabled />);
  expect(await screen.findByRole('button', { name: 'Tạo yêu cầu bảo lưu' })).toBeDisabled();
  expect(screen.getByText(/Lưu hoặc hủy thay đổi hồ sơ/)).toBeInTheDocument();
});
