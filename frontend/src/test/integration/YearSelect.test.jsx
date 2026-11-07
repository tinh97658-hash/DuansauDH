import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import YearSelect from '../../features/scheduling/YearSelect';

it('keeps an open year menu aligned to its control after the font or layout changes', async () => {
  let controlWidth = 160;
  const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    const width = this.classList.contains('MuiInputBase-root') ? controlWidth : 160;
    return { top: 100, bottom: 140, left: 50, right: 50 + width, width, height: 40, x: 50, y: 100 };
  });
  try {
    render(<YearSelect label="Năm học" value="2026" years={['2026', '2027']} onChange={vi.fn()} />);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Năm học' }));
    const paper = (await screen.findByRole('listbox')).closest('.MuiPaper-root');
    expect(paper).toHaveStyle({ width: '160px' });
    controlWidth = 240;
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(paper).toHaveStyle({ width: '240px' }));
    controlWidth = 130;
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(paper).toHaveStyle({ width: '130px' }));
  } finally { rect.mockRestore(); }
});
