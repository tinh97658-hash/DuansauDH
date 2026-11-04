import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PendingConfirmationButton from '../../features/scheduling/PendingConfirmationButton';

it('distinguishes zero, loading, error and open states while retaining a usable view action', () => {
  const click = vi.fn(); const view = render(<PendingConfirmationButton count={0} open={false} controls="queue" onClick={click} />);
  const button = screen.getByRole('button', { name: 'Chờ xác nhận (0)' });
  expect(button).toBeEnabled(); fireEvent.click(button); expect(click).toHaveBeenCalledOnce();
  view.rerender(<PendingConfirmationButton count={7} loading open controls="queue" onClick={click} />);
  expect(button).toHaveAttribute('aria-busy', 'true'); expect(button).toHaveAttribute('aria-controls', 'queue');
  expect(button).toHaveAttribute('aria-expanded', 'true'); expect(button).toHaveTextContent('Đang tải');
  view.rerender(<PendingConfirmationButton error="Network error" open={false} onClick={click} />);
  expect(button).toHaveTextContent('Lỗi tải danh sách');
});
