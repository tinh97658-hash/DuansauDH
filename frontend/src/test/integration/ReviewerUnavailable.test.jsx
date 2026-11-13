import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import axios from 'axios';
import ReviewerDashboard from '../../components/dashboard/reviewerDashboard';

it('explains that reviews are unavailable and never submits an unsaved review', () => {
  const post = vi.spyOn(axios, 'post');
  render(<ReviewerDashboard />);
  expect(screen.getByRole('alert')).toHaveTextContent('Hiện chưa thể gửi nhận xét');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  const submit = screen.getByRole('button', { name: 'Gửi nhận xét' });
  expect(submit).toBeDisabled();
  fireEvent.click(submit);
  expect(post).not.toHaveBeenCalled();
  post.mockRestore();
});
