import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DocumentExportMenu from '../../components/DocumentExportMenu';

afterEach(() => vi.restoreAllMocks());
it('keeps a portal menu aligned through layout shifts and scroll, exports and closes', async () => {
  let left = 80;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
    top: 60, bottom: 98, left, right: left + 140, width: 140, height: 38,
  }));
  const excel = vi.fn();
  render(<DocumentExportMenu onWord={vi.fn()} onExcel={excel} onPdf={vi.fn()} />);
  const trigger = screen.getByRole('button', { name: 'Xuất báo cáo' });
  fireEvent.click(trigger);
  const menu = await screen.findByRole('menu');
  expect(menu.parentElement).toBe(document.body);
  await waitFor(() => expect(menu).toHaveStyle({ width: '140px', left: '80px', top: '102px' }));
  left = 170;
  fireEvent.scroll(window);
  await waitFor(() => expect(menu).toHaveStyle({ width: '140px', left: '170px' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Excel (.xlsx)' }));
  expect(excel).toHaveBeenCalledOnce();
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});
it('keeps VT format order and skips a disabled format during keyboard navigation', async () => {
  render(<DocumentExportMenu formats={['excel', 'word']} disabledFormats={['excel']} onExcel={vi.fn()} onWord={vi.fn()} />);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Xuất báo cáo' }), { key: 'ArrowDown' });
  const word = await screen.findByRole('menuitem', { name: 'Word (.docx)' });
  expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Excel (.xlsx)', 'Word (.docx)']);
  expect(word).toHaveFocus();
  fireEvent.keyDown(word, { key: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});
