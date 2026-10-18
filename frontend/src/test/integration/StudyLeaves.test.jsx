import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import StudyLeaves from '../../pages/masters/studyLeaves';

jest.mock('axios');
jest.mock('../../components/FeatureLayout', () => ({ children }) => <div>{children}</div>);
const row = { id: 'leave', admissionRecordId: 'record', fullName: 'Nguyễn Văn A', code: 'HV001', trainingLevel: 'Thạc sĩ',
  classCode: 'K24', startDate: '2026-01-01', endDate: '2026-06-30', status: 'overdue', overdueDays: 3,
  extensions: [{ status: 'pending' }] };
beforeEach(() => { jest.resetAllMocks(); axios.get.mockResolvedValue({ data: { rows: [row], total: 1 } }); });

it('shows overdue days, a pending extension and a direct link to the learner leave tab', async () => {
  render(<MemoryRouter><StudyLeaves /></MemoryRouter>);
  expect(await screen.findByText('Nguyễn Văn A')).toBeInTheDocument();
  expect(screen.getByText('3 ngày')).toBeInTheDocument();
  expect(screen.getByText('Có gia hạn chờ duyệt')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Mở hồ sơ' })).toHaveAttribute('href', '/plan/admission-records/record?tab=leave');
});

it('passes search and an overdue filter to the API and keeps the list empty when nothing matches', async () => {
  render(<MemoryRouter><StudyLeaves /></MemoryRouter>);
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
