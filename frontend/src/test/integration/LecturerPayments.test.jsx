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

let paid, paymentDate, note, paymentVersion;
const row = { courseOfferingId: 'offering-1', lecturerId: 'lecturer-1', lecturerName: 'Nguyễn An', offeringName: 'Lớp CNTT', sessionCount: 3, completedAt: '2026-11-02T18:00:00Z', paymentDate: null, note: '', paymentVersion: null };
const mount = (permissions = ['reports.view', 'reports.payments.manage', 'reports.export'], readOnly = false) => render(
  <AuthSessionContext.Provider value={{ user: {}, access: { permissions, groupScope: { readOnly } } }}><LecturerPayments /></AuthSessionContext.Provider>);

beforeEach(() => {
  vi.clearAllMocks(); paid = false; paymentDate = null; note = ''; paymentVersion = null;
  axios.get.mockImplementation(async url => url.endsWith('/options')
    ? { data: { lecturers: [{ id: 'lecturer-1', name: 'Nguyễn An', unitId: 'unit-1' }], units: [{ id: 'unit-1', name: 'Khoa CNTT' }] } }
    : { data: { rows: [{ ...row, paid, paymentDate, note, paymentVersion }] } });
  axios.put.mockImplementation(async (_url, body) => {
    paid = body.paid; paymentDate = body.paymentDate === undefined ? paymentDate : body.paymentDate;
    if (body.note !== undefined) note = body.note;
    paymentVersion = 'saved-version'; return { data: { paid, paymentDate, note, paymentVersion } };
  });
});

it('saves the exact pair, reloads persisted state, and can uncheck after remount', async () => {
  const view = mount();
  const checkbox = await screen.findByRole('checkbox', { name: /^Đã thanh toán:/ });
  expect(checkbox).not.toBeChecked();
  fireEvent.click(checkbox);
  expect(screen.getByLabelText(/^Ghi chú:/)).not.toBeRequired();
  expect(screen.getByLabelText(/^Ghi chú:/)).toHaveValue('');
  expect(screen.queryByRole('button', { name: /^(Lưu|Hủy):/ })).not.toBeInTheDocument();
  await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(1));
  expect(axios.put.mock.calls[0][1]).toMatchObject({ paid: true, paymentVersion: null });
  expect(axios.put.mock.calls[0][1]).not.toHaveProperty('note');
  await waitFor(() => expect(checkbox).toBeEnabled());
  fireEvent.change(screen.getByLabelText(/^Ngày thanh toán:/), { target: { value: '04/11/2026' } });
  fireEvent.blur(screen.getByLabelText(/^Ngày thanh toán:/));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/offering-1/lecturer-1'),
    { paid: true, paymentDate: '2026-11-04', paymentVersion: 'saved-version' }, { withCredentials: true }));
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  view.unmount(); mount();
  expect(await screen.findByRole('checkbox', { name: /^Đã thanh toán:/ })).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: /^Đã thanh toán:/ }));
  expect(screen.getByRole('dialog', { name: 'Xác nhận bỏ thanh toán' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ thanh toán' }));
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
  expect(screen.getByLabelText(/^Ngày thanh toán:/)).toBeDisabled();
  expect(screen.getByLabelText(/^Ghi chú:/)).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Xuất Excel' })).not.toBeInTheDocument();
  expect(axios.put).not.toHaveBeenCalled();
});

it('keeps the saved state when a write fails', async () => {
  axios.put.mockRejectedValue(new Error('failure'));
  mount(); fireEvent.click(await screen.findByRole('checkbox', { name: /^Đã thanh toán:/ }));
  await screen.findByRole('alert');
  expect(screen.getByRole('checkbox', { name: /^Đã thanh toán:/ })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: /^Đã thanh toán:/ })).toBeEnabled();
});

it('disables the unpaid date and automatically saves the Vietnam date on checking without note or row buttons', async () => {
  mount(); await screen.findByRole('checkbox', { name: /^Đã thanh toán:/ });
  expect(screen.getByLabelText(/^Ngày thanh toán:/)).toBeDisabled();
  expect(screen.getByLabelText(/^Ngày thanh toán:/)).toHaveValue('');
  fireEvent.click(screen.getByRole('checkbox', { name: /^Đã thanh toán:/ }));
  expect(screen.getByLabelText(/^Ngày thanh toán:/)).toBeEnabled();
  expect(screen.getByLabelText(/^Ngày thanh toán:/).value).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  expect(screen.queryByRole('button', { name: /^(Lưu|Hủy):/ })).not.toBeInTheDocument();
  expect(screen.queryByText('Chưa lưu')).not.toBeInTheDocument();
  await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(1));
  expect(axios.put.mock.calls[0][1].paymentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

it('blocks invalid dates and supports choosing an earlier day from the shared calendar', async () => {
  paid = true; paymentDate = '2026-11-04'; paymentVersion = 'old';
  mount(); await screen.findByRole('checkbox', { name: /^Đã thanh toán:/ });
  fireEvent.change(screen.getByLabelText(/^Ngày thanh toán:/), { target: { value: '31/02/2026' } });
  fireEvent.blur(screen.getByLabelText(/^Ngày thanh toán:/));
  expect(axios.put).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Chọn ngày' }));
  const calendar = screen.getByRole('dialog', { name: /^Chọn ngày:/ });
  fireEvent.change(screen.getByRole('combobox', { name: 'Năm' }), { target: { value: '2025' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Tháng' }), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: '04/10/2025' }));
  expect(calendar).not.toBeVisible();
  expect(screen.getByLabelText(/^Ngày thanh toán:/)).toHaveValue('04/10/2025');
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.any(String),
    { paid: true, paymentDate: '2025-10-04', paymentVersion: 'old' }, expect.any(Object)));
});

it('shows paid legacy rows needing a date and saves a correction without toggling their state', async () => {
  paid = true; paymentVersion = 'legacy';
  mount(); await screen.findByText('Cần bổ sung ngày');
  expect(screen.getByRole('checkbox', { name: /^Đã thanh toán:/ })).toBeChecked();
  expect(screen.getByLabelText(/^Ngày thanh toán:/)).toHaveValue('');
  fireEvent.change(screen.getByLabelText(/^Ngày thanh toán:/), { target: { value: '03/11/2026' } });
  fireEvent.keyDown(screen.getByLabelText(/^Ngày thanh toán:/), { key: 'Enter' });
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.any(String),
    { paid: true, paymentDate: '2026-11-03', paymentVersion: 'legacy' }, expect.any(Object)));
});

it('saves notes on Enter, retains them after reload and unpaying, and can cancel unpay confirmation', async () => {
  paid = true; paymentDate = '2026-11-04'; note = 'Đã đối chiếu'; paymentVersion = 'old';
  const view = mount(); await screen.findByRole('checkbox', { name: /^Đã thanh toán:/ });
  fireEvent.change(screen.getByLabelText(/^Ghi chú:/), { target: { value: 'Chứng từ bổ sung' } });
  expect(axios.put).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByLabelText(/^Ghi chú:/), { key: 'Enter' });
  await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  view.unmount(); mount();
  await screen.findByRole('checkbox', { name: /^Đã thanh toán:/ });
  expect(screen.getByLabelText(/^Ghi chú:/)).toHaveValue('Chứng từ bổ sung');
  fireEvent.click(screen.getByRole('checkbox', { name: /^Đã thanh toán:/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
  expect(axios.put).toHaveBeenCalledTimes(1);
  fireEvent.click(await screen.findByRole('checkbox', { name: /^Đã thanh toán:/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ thanh toán' }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(2));
  expect(axios.put.mock.calls[1][1]).toMatchObject({ paid: false, paymentDate: null });
  expect(axios.put.mock.calls[1][1]).not.toHaveProperty('note');
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  expect(screen.getByLabelText(/^Ghi chú:/)).toHaveValue('Chứng từ bổ sung');
});

it('saves an unpaid note independently and keeps all typed values and row nodes after API failure', async () => {
  axios.put.mockRejectedValue({ response: { data: { message: 'Dữ liệu đã thay đổi' } } });
  mount(); const checkbox = await screen.findByRole('checkbox', { name: /^Đã thanh toán:/ });
  const element = checkbox.closest('tr');
  fireEvent.change(screen.getByLabelText(/^Ghi chú:/), { target: { value: 'Ghi chú đang nhập' } });
  fireEvent.blur(screen.getByLabelText(/^Ghi chú:/));
  await screen.findByText('Dữ liệu đã thay đổi');
  expect(axios.put.mock.calls[0][1]).toMatchObject({ paid: false, note: 'Ghi chú đang nhập' });
  expect(screen.getByLabelText(/^Ghi chú:/)).toHaveValue('Ghi chú đang nhập');
  expect(checkbox.closest('tr')).toBe(element);
});

it('saves a changed payment date on leaving the input with the original version', async () => {
  paid = true; paymentDate = '2026-11-04'; paymentVersion = 'before-correction';
  mount(); await screen.findByRole('checkbox', { name: /^Đã thanh toán:/ });
  fireEvent.change(screen.getByLabelText(/^Ngày thanh toán:/), { target: { value: '02/11/2026' } });
  expect(axios.put).not.toHaveBeenCalled();
  fireEvent.blur(screen.getByLabelText(/^Ngày thanh toán:/));
  await waitFor(() => expect(axios.put.mock.calls[0][1]).toMatchObject({
    paid: true, paymentDate: '2026-11-02', paymentVersion: 'before-correction',
  }));
});

it('displays custom offering names verbatim and each participating class on its own row without an expander', async () => {
  const custom = 'Tên tự đặt - không tách - lớp đặc biệt';
  axios.get.mockImplementation(async url => url.endsWith('/options') ? { data: { units: [], lecturers: [] } } : { data: { rows: [
    { ...row, offeringName: custom, paid: false, participatingGroups: [
      { id: 'g1', code: 'CNTT-26', name: 'Công nghệ thông tin' }, { id: 'g2', code: 'QTKD-26', name: 'Quản trị kinh doanh' },
    ] },
  ] } });
  mount(); await screen.findByRole('button', { name: custom });
  expect(screen.getAllByRole('columnheader').map(item => item.textContent)).toEqual([
    'STT', 'Giảng viên', 'Lớp học phần', 'Lớp tham gia', 'Số buổi', 'Ngày hoàn thành', 'Đã thanh toán', 'Ngày thanh toán', 'Ghi chú',
  ]);
  const first = screen.getByText('Công nghệ thông tin');
  const second = screen.getByText('Quản trị kinh doanh');
  expect(first).toBeVisible();
  expect(second).toBeVisible();
  expect(first.closest('tr')).not.toBe(second.closest('tr'));
  expect(screen.getByRole('button', { name: custom }).closest('td')).toHaveAttribute('rowspan', '2');
  for (const name of [first, second]) expect(name.closest('td').querySelector('details, summary, button')).toBeNull();
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
  const componentCss = [...document.styleSheets].flatMap(sheet => [...sheet.cssRules].map(rule => rule.cssText)).join('\n');
  const css = componentCss + '\n' + ['src/pages/masters/classCourseHistory.css', 'src/pages/reports/lecturerPayments.css'].map(file => fs.readFileSync(file, 'utf8')).join('\n');
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
      const last = cells[8].querySelector('input').getBoundingClientRect(), viewport = scroll.getBoundingClientRect();
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
      expect(checks).toMatchObject({ rows: 80, namesFit: true, lastCheckboxVisible: true, tableLayout: 'fixed', aligns: ['center', 'left', 'left', 'left', 'center', 'center', 'center', 'center', 'left'] });
      checks.widths.forEach((value, index) => expect(Math.abs(value - [4, 13, 20, 12, 5, 9, 7, 14, 16][index])).toBeLessThan(0.2));
      expect(checks.normal).toMatchObject({ color: checks.normal.cellColor, decoration: 'none', weight: '400' });
      expect(checks.maxRowHeight).toBeLessThanOrEqual(80);
      expect(checks.shortTableBottomGap).toBeLessThanOrEqual(2);
      expect(checks.scrolls).toBe(true);
    }
  } finally {
    fs.unlinkSync(htmlPath); fs.rmdirSync(folder);
  }
}, 90000);
