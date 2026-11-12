import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NativeTitleTooltip from '../../components/NativeTitleTooltip';

it('shows title hints in the shared tooltip and restores the title on exit', async () => {
  render(<><button title="Mở bảng điểm">Open</button><NativeTitleTooltip /></>);
  const button = screen.getByRole('button', { name: 'Open' });
  fireEvent.mouseOver(button);
  expect(button).not.toHaveAttribute('title');
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toHaveTextContent('Mở bảng điểm');
  expect(tooltip).toHaveClass('app-title-tooltip');
  expect(button).toHaveAttribute('aria-describedby', tooltip.id);
  fireEvent.mouseOut(button, { relatedTarget: document.body });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  expect(button).toHaveAttribute('title', 'Mở bảng điểm');
  expect(button).not.toHaveAttribute('aria-describedby');
});

it('supports keyboard focus, preserves existing descriptions and closes on Escape', async () => {
  render(<><button title="Sửa" aria-describedby="help">Edit</button><NativeTitleTooltip /></>);
  const button = screen.getByRole('button');
  fireEvent.focusIn(button);
  const tooltip = await screen.findByRole('tooltip');
  expect(button).toHaveAttribute('aria-describedby', `help ${tooltip.id}`);
  fireEvent.keyDown(button, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  expect(button).toHaveAttribute('aria-describedby', 'help');
  expect(button).toHaveAttribute('title', 'Sửa');
});

it('cancels pending hints on click and restores titles when unmounted', async () => {
  const view = render(<><button title="Danh sách thí sinh">Candidates</button><NativeTitleTooltip /></>);
  const button = screen.getByRole('button');
  fireEvent.mouseOver(button);
  fireEvent.pointerDown(button);
  expect(button).toHaveAttribute('title', 'Danh sách thí sinh');
  fireEvent.focusIn(button);
  await screen.findByRole('tooltip');
  view.rerender(<button title="Danh sách thí sinh">Candidates</button>);
  await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  expect(button).toHaveAttribute('title', 'Danh sách thí sinh');
});
