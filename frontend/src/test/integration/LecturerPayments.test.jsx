import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import LecturerPayments from '../../pages/reports/lecturerPayments';
import { AuthSessionContext } from '../../context/AuthSession';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

vi.mock('axios');
vi.mock('../../components/FeatureLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../../features/scheduling/OfferingDetails', () => ({ default: ({ offering, readOnly, readBasePath }) =>
  <div role="dialog" data-read-only={String(readOnly)} data-base={readBasePath}>{offering.id}</div> }));

let paid;
const row = { courseOfferingId: 'offering-1', lecturerId: 'lecturer-1', lecturerName: 'Nguyễn An', offeringName: 'Lớp CNTT', sessionCount: 3, completedAt: '2026-11-02T18:00:00Z' };
const mount = (permissions = ['reports.view', 'reports.payments.manage', 'reports.export'], readOnly = false) => render(
  <AuthSessionContext.Provider value={{ user: {}, access: { permissions, groupScope: { readOnly } } }}><LecturerPayments /></AuthSessionContext.Provider>);

beforeEach(() => {
  vi.clearAllMocks(); paid = false;
  axios.get.mockImplementation(async url => url.endsWith('/options')
    ? { data: { lecturers: [{ id: 'lecturer-1', name: 'Nguyễn An', unitId: 'unit-1' }], units: [{ id: 'unit-1', name: 'Khoa CNTT' }] } }
    : { data: { rows: [{ ...row, paid }] } });
  axios.put.mockImplementation(async (_url, body) => { paid = body.paid; return { data: { paid } }; });
});

it('saves the exact pair, reloads persisted state, and can uncheck after remount', async () => {
  const view = mount();
  const checkbox = await screen.findByRole('checkbox', { name: /^Đã thanh toán:/ });
  expect(checkbox).not.toBeChecked();
  fireEvent.click(checkbox);
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/offering-1/lecturer-1'), { paid: true }, { withCredentials: true }));
  await waitFor(() => expect(screen.getByRole('checkbox', { name: /^Đã thanh toán:/ })).toBeChecked());
  view.unmount(); mount();
  expect(await screen.findByRole('checkbox', { name: /^Đã thanh toán:/ })).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: /^Đã thanh toán:/ }));
  await waitFor(() => expect(screen.getByRole('checkbox', { name: /^Đã thanh toán:/ })).not.toBeChecked());
});

it('passes completion dates, unit, lecturer, payment status and search together', async () => {
  mount(); await screen.findByRole('checkbox', { name: /^Đã thanh toán:/ });
  fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-11-01' } });
  fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-11-03' } });
  fireEvent.change(screen.getByLabelText('Đơn vị'), { target: { value: 'unit-1' } });
  fireEvent.change(screen.getByLabelText('Giảng viên'), { target: { value: 'lecturer-1' } });
  fireEvent.change(screen.getByLabelText('Trạng thái thanh toán'), { target: { value: 'unpaid' } });
  fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'CNTT' } });
  await waitFor(() => expect(axios.get).toHaveBeenLastCalledWith(expect.stringMatching(/lecturer-payments$/), {
    params: { from: '2026-11-01', to: '2026-11-03', unitId: 'unit-1', lecturerId: 'lecturer-1', paymentStatus: 'unpaid', search: 'CNTT' }, withCredentials: true,
  }));
});

it('opens the shared detail and shows session count and completion date without an export button', async () => {
  mount(); await screen.findByRole('checkbox', { name: /^Đã thanh toán:/ });
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.getByText('3/11/2026')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Lớp CNTT' }));
  expect(screen.getByRole('dialog')).toHaveAttribute('data-base', '/reports/lecturer-payments/offerings');
  expect(screen.getByRole('dialog')).toHaveAttribute('data-read-only', 'true');
  expect(screen.queryByRole('button', { name: 'Xuất Excel' })).not.toBeInTheDocument();
});

it.each([[['reports.view'], false], [['reports.view', 'reports.payments.manage'], true]])('disables payment writes for viewers and read-only roles', async (permissions, readOnly) => {
  mount(permissions, readOnly);
  expect(await screen.findByRole('checkbox', { name: /^Đã thanh toán:/ })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Xuất Excel' })).not.toBeInTheDocument();
  expect(axios.put).not.toHaveBeenCalled();
});

it('keeps the saved state when a write fails', async () => {
  axios.put.mockRejectedValue(new Error('failure'));
  mount(); fireEvent.click(await screen.findByRole('checkbox', { name: /^Đã thanh toán:/ }));
  await screen.findByRole('alert');
  expect(screen.getByRole('checkbox', { name: /^Đã thanh toán:/ })).not.toBeChecked();
});

it('defaults to all time and automatically shows an empty result for a catalog unit with no lecturers', async () => {
  axios.get.mockImplementation(async (url, config) => url.endsWith('/options')
    ? { data: { lecturers: [{ id: 'lecturer-1', name: row.lecturerName, unitId: 'unit-1' }],
      units: [{ id: 'unit-1', name: 'Khoa CNTT' }, { id: 'unit-empty', name: 'Đơn vị chưa có giảng viên' }] } }
    : { data: { rows: config.params.unitId === 'unit-empty' ? [] : [{ ...row, paid }] } });
  mount(); await screen.findByRole('checkbox', { name: /^Đã thanh toán:/ });
  expect(screen.getByLabelText('Từ ngày')).toBeVisible();
  expect(screen.getByLabelText('Từ ngày')).toHaveValue('');
  expect(screen.getByLabelText('Đến ngày')).toBeVisible();
  expect(screen.getByLabelText('Đến ngày')).toHaveValue('');
  expect(screen.getByLabelText('Từ ngày')).not.toHaveAttribute('title');
  expect(screen.getByLabelText('Đến ngày')).not.toHaveAttribute('title');
  expect(screen.queryByRole('button', { name: 'Khoảng ngày hoàn thành' })).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Đơn vị chưa có giảng viên' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Giảng viên'), { target: { value: 'lecturer-1' } });
  fireEvent.change(screen.getByLabelText('Đơn vị'), { target: { value: 'unit-empty' } });
  await screen.findByText('Không có dữ liệu phù hợp.');
  expect(screen.getByLabelText('Giảng viên')).toHaveValue('');
  expect(axios.get).toHaveBeenLastCalledWith(expect.stringMatching(/lecturer-payments$/), {
    params: { unitId: 'unit-empty', paymentStatus: 'all' }, withCredentials: true,
  });
  expect(screen.queryByRole('checkbox', { name: /^Đã thanh toán:/ })).not.toBeInTheDocument();
});

const browser = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => file && fs.existsSync(file));
(browser ? it : it.skip)('keeps long names and 80 rows within stable columns on desktop and scrolls the complete table on small screens', async () => {
  const longClass = 'Lớp học phần nghiên cứu chuyên sâu '.repeat(16).trim();
  const longLecturer = 'Nguyễn Thị Tên Giảng Viên Rất Dài '.repeat(8).trim();
  const data = Array.from({ length: 80 }, (_, index) => ({ ...row, paid: false, courseOfferingId: `offering-${index}`,
    offeringName: index ? `Lớp CNTT ${index}` : longClass, lecturerName: index ? row.lecturerName : longLecturer }));
  axios.get.mockImplementation(async url => url.endsWith('/options') ? { data: { units: [], lecturers: [] } } : { data: { rows: data } });
  const view = mount();
  await screen.findByRole('button', { name: longClass });
  expect(screen.getByRole('button', { name: longClass })).toHaveAttribute('title', longClass);
  screen.getByRole('button', { name: longClass }).focus();
  expect(screen.getByRole('button', { name: longClass })).toHaveFocus();
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'lecturer-payment-layout-'));
  const htmlPath = path.join(folder, 'table.html');
  const css = ['src/pages/masters/classCourseHistory.css', 'src/pages/reports/lecturerPayments.css'].map(file => fs.readFileSync(file, 'utf8')).join('\n');
  fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing:border-box; } body { margin:0; } main { display:flex; flex-direction:column; min-height:900px; padding:10px 16px 20px; }
    ${css}</style></head><body><main>${view.container.querySelector('.lp-page').outerHTML}</main><script>
      const table = document.querySelector('.lp-table'), scroll = table.closest('.tp-table-scroll');
      const cells = [...table.tBodies[0].rows[0].cells], button = cells[2].querySelector('button');
      const normal = { color:getComputedStyle(button).color, cellColor:getComputedStyle(cells[2]).color,
        decoration:getComputedStyle(button).textDecorationLine, weight:getComputedStyle(button).fontWeight };
      const names = [...table.querySelectorAll('.lp-cell-text')].map(el => ({ height:el.getBoundingClientRect().height, line:parseFloat(getComputedStyle(el).lineHeight) }));
      const desktopFits = table.getBoundingClientRect().right <= scroll.getBoundingClientRect().right + 1;
      scroll.scrollLeft = scroll.scrollWidth;
      const last = cells[5].querySelector('input').getBoundingClientRect(), viewport = scroll.getBoundingClientRect();
      const result = { widths:cells.map(cell => cell.getBoundingClientRect().width / table.getBoundingClientRect().width * 100),
        normal, namesFit:names.every(n => n.height <= n.line * 2 + 1), desktopFits,
        rows:table.tBodies[0].rows.length, aligns:cells.map(cell => getComputedStyle(cell).textAlign),
        maxRowHeight:Math.max(...[...table.tBodies[0].rows].map(el => el.getBoundingClientRect().height)),
        scrolls:scroll.scrollWidth > scroll.clientWidth, lastCheckboxVisible:last.left >= viewport.left && last.right <= viewport.right,
        tableLayout:getComputedStyle(table).tableLayout };
      while (table.tBodies[0].rows.length > 2) table.tBodies[0].lastElementChild.remove();
      result.shortTableBottomGap = table.closest('.tp-table-wrap').getBoundingClientRect().bottom - table.getBoundingClientRect().bottom - (scroll.offsetHeight - scroll.clientHeight);
      document.body.insertAdjacentHTML('beforeend','<pre id="checks">'+JSON.stringify(result)+'</pre>');
    </script></body></html>`, 'utf8');
  try {
    for (const width of [1280, 390]) {
      const dom = execFileSync(browser, ['--headless', '--disable-gpu', '--no-sandbox', '--disable-background-networking', `--window-size=${width},900`, '--dump-dom', `file:///${htmlPath.replaceAll('\\', '/')}`],
        { encoding: 'utf8', windowsHide: true, timeout: 30000, stdio: ['ignore', 'pipe', 'ignore'] });
      const checks = JSON.parse([...dom.matchAll(/<pre id="checks">(.*?)<\/pre>/gs)].at(-1)[1]);
      expect(checks).toMatchObject({ rows: 80, namesFit: true, lastCheckboxVisible: true, tableLayout: 'fixed', aligns: ['center', 'left', 'left', 'center', 'center', 'center'] });
      checks.widths.forEach((value, index) => expect(Math.abs(value - [4, 19, 45, 7, 13, 12][index])).toBeLessThan(0.2));
      expect(checks.normal).toMatchObject({ color: checks.normal.cellColor, decoration: 'none', weight: '400' });
      expect(checks.maxRowHeight).toBeLessThanOrEqual(60);
      expect(checks.shortTableBottomGap).toBeLessThanOrEqual(2);
      expect(width === 1280 ? checks.desktopFits : checks.scrolls).toBe(true);
    }
  } finally {
    fs.unlinkSync(htmlPath); fs.rmdirSync(folder);
  }
}, 90000);
