import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AdmissionRoundManager from '../../features/admission/AdmissionRoundManager';

const rounds = Array.from({ length: 17 }, (_, index) => ({ id: `round-${index + 1}`,
  name: `Đợt số ${index + 1}`, academicYear: '2026', majorThresholds: [] }));
const props = () => ({ open: true, onClose: vi.fn(), rounds, selectedRoundId: 'round-1', admin: true,
  onRefresh: vi.fn(), onSelect: vi.fn(), onEdit: vi.fn(), onCreate: vi.fn() });

it('keeps pagination and accent-insensitive search when embedded in year management', () => {
  render(<AdmissionRoundManager {...props()} embedded />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByText('Đợt số 15')).toBeInTheDocument();
  expect(screen.queryByText('Đợt số 16')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  expect(screen.getByText('Đợt số 17')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Tìm đợt xét tuyển'), { target: { value: 'dot so 1' } });
  expect(screen.getByText('Đợt số 1')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Hiển thị 9 / 17 đợt xét tuyển');
});

it('preserves select, edit, create and refresh actions in the embedded panel', () => {
  const callbacks = props();
  render(<AdmissionRoundManager {...callbacks} embedded />);
  expect(screen.getByRole('button', { name: 'Chọn đợt Đợt số 1' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Chọn đợt Đợt số 2' }));
  expect(callbacks.onSelect).toHaveBeenCalledWith('round-2');
  fireEvent.click(screen.getByRole('button', { name: 'Sửa đợt Đợt số 2' }));
  expect(callbacks.onEdit).toHaveBeenCalledWith(rounds[1]);
  fireEvent.click(screen.getByRole('button', { name: 'Tạo đợt mới' }));
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại danh sách' }));
  expect(callbacks.onCreate).toHaveBeenCalledTimes(1);
  expect(callbacks.onRefresh).toHaveBeenCalledTimes(1);
});

it('keeps the standalone dialog footer and closes through its action button', () => {
  const callbacks = props();
  render(<AdmissionRoundManager {...callbacks} />);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  expect(screen.getByText('Đợt số 17')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: 'Đóng', exact: true }).find(button => button.closest('.MuiDialogActions-root')));
  expect(callbacks.onClose).toHaveBeenCalledTimes(1);
});
