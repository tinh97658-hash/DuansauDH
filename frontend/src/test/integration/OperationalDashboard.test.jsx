import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import axios from 'axios';
import Home from '../../pages/viewLogged';
import { AuthSessionContext } from '../../context/AuthSession';
import DashboardActivity from '../../features/dashboard/DashboardActivity';

vi.mock('axios', () => ({ default: { get: vi.fn(), defaults: {} } }));
vi.mock('../../components/navbarNew', () => ({ default: () => <nav aria-label="Ribbon hiện có">VMU</nav> }));
vi.mock('../../components/footer', () => ({ default: () => <footer>Footer hiện có</footer> }));
const permissions = { grouping: true, scheduling: true, progress: true, grades: true, approvals: true,
  studyLeaveApproval: true, majorTransferApproval: true, overview: true, learnersOverview: true };
const metric = (items = [], extra = {}) => ({ count: items.length, itemCount: items.length, items, href: '/masters/exam-lists?year=2026', ...extra });
const fixture = (year = '2026') => ({ year, program: 'masters', permissions: { ...permissions }, sources: {
  grouping: { status: 'ready', data: metric([{ id: 'm1', title: 'Công nghệ thông tin', count: 7, unit: 'học viên', href: `/masters/assign-class-groups?year=${year}&majorId=m1&disciplineId=d1` }], { count: 7, href: `/masters/assign-class-groups?year=${year}` }) },
  teaching: { status: 'ready', data: {
    scheduling: metric([{ id: 'o1', title: 'Lớp chưa có lịch', href: `/masters/schedule?year=${year}&offeringId=o1` }], { href: `/masters/schedule?year=${year}&queue=unscheduled` }),
    progress: metric([{ id: 'o2', title: 'Lớp chờ xác nhận', count: 3, unit: 'buổi', href: `/masters/schedule?year=${year}&offeringId=o2&queue=pending-confirmation` }], { count: 3, href: `/masters/schedule?year=${year}&queue=pending-confirmation` }),
  } },
  grades: { status: 'ready', data: { ...metric(), stages: ['components_missing', 'awaiting_exam', 'exam_missing', 'result_ready'].map((stage, index) => ({ stage, count: 1,
    items: [{ id: stage, title: `Lớp giai đoạn ${index + 1}`, detail: index === 1 ? 'Đã xếp lịch thi sắp tới' : 'Mốc thời gian đã ghi nhận',
      action: index === 3 ? 'Mở để gửi duyệt' : 'Mở bảng điểm', href: `/masters/exam-lists?year=${year}&offeringId=${stage}&groupId=g1` }] })) } },
  approvals: { status: 'ready', data: { resultApproval: metric([{ id: 'result', title: 'Lớp chờ khóa điểm', href: `/masters/exam-lists?year=${year}&offeringId=result&groupId=g1` }], { count: 28 }) } },
  studyLeaveApproval: { status: 'ready', data: metric([{ id: 'leave', title: 'Học viên bảo lưu', href: '/masters/study-leaves/record1?tab=leave' }]) },
  majorTransferApproval: { status: 'ready', data: metric([{ id: 'transfer', title: 'Học viên chuyển ngành', href: '/plan/admission-records/record2?tab=profile' }]) },
  learnersChart: { status: 'ready', data: { title: 'Tình trạng hồ sơ / học viên', kind: 'donut', unit: 'hồ sơ', values: [{ label: 'Đang học', count: 12 }, { label: 'Bảo lưu', count: 2 }] } },
  sessionsChart: { status: 'ready', data: { title: 'Buổi học trong tuần', kind: 'donut', unit: 'buổi', values: [{ label: 'Đã diễn ra', count: 3 }] } },
  completionChart: { status: 'ready', data: { title: 'Hoàn thành giảng dạy', kind: 'bar', unit: 'lớp học phần', values: [{ label: '11/2026', count: 2 }] } },
} });
const session = id => ({ user: { id: 'staff', name: 'Tên nhân sự' }, activeProfile: { id, name: `Hồ sơ ${id}` } });
const Location = () => { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; };
function view(profile = 'a') { return <MemoryRouter useTransitions={false} initialEntries={['/viewLogged?year=2026']}><AuthSessionContext.Provider value={session(profile)}><Location /><Home /></AuthSessionContext.Provider></MemoryRouter>; }
const open = async () => { let result; await act(async () => { result = render(view()); }); return result; };
const work = () => screen.getByRole('region', { name: 'Công việc cần xử lý' });
const approvals = () => screen.getByRole('region', { name: 'Chờ phê duyệt' });
const tab = label => fireEvent.click(screen.getByRole('tab', { name: label }));
beforeEach(() => { vi.clearAllMocks(); axios.get.mockResolvedValue({ data: fixture() }); });


let previewHeight = 224;
const resizeCallbacks = new Set();
beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback) { this.callback = callback; resizeCallbacks.add(callback); }
    observe() {}
    disconnect() { resizeCallbacks.delete(this.callback); }
  });
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function () {
    return this.classList.contains('od-task-viewport') ? previewHeight : 900;
  });
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    return this.classList.contains('od-task-row') ? new DOMRect(0, 0, 600, 56) : original.call(this);
  });
});
afterAll(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
beforeEach(() => { previewHeight = 224; });
const taskList = () => within(work()).getByRole('list', { name: 'Danh sách công việc' });

it('keeps the greeting, shared navigation, notification and header filters', async () => {
  await open();
  expect(screen.getByRole('heading', { name: 'Xin chào, Tên nhân sự' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Ribbon hiện có' })).toBeInTheDocument();
  expect(screen.getByText('Footer hiện có')).toBeInTheDocument();
  expect(document.querySelector('.od-header')).toContainElement(screen.getByRole('group', { name: 'Bộ lọc dashboard' }));
});
it('replaces the aggregate view with four direct record tabs', async () => {
  await open();
  expect(screen.getAllByRole('tab').map(element => element.textContent)).toEqual(['Phân nhóm', 'Xếp lịch', 'Xác nhận', 'Điểm']);
  expect(screen.queryByRole('tab', { name: 'Tất cả' })).not.toBeInTheDocument();
  expect(within(taskList()).getByText('Công nghệ thông tin')).toBeInTheDocument();
  expect(within(taskList()).getByText('7 học viên')).toBeInTheDocument();
  expect(within(work()).queryByRole('button', { expanded: false })).not.toBeInTheDocument();
});
it.each([
  ['Chờ phân nhóm', '/masters/assign-class-groups?year=2026'],
  ['Chưa xếp lịch', '/masters/schedule?year=2026&queue=unscheduled'],
  ['Chờ xác nhận buổi học', '/masters/schedule?year=2026&queue=pending-confirmation'],
  ['Theo dõi điểm', '/masters/exam-lists?year=2026'],
])('keeps the %s KPI as a shortcut to the original feature', async (label, href) => {
  await open();
  const link = screen.getByRole('link', { name: `Xem công việc: ${label}` });
  expect(link).toHaveAttribute('href', href);
  fireEvent.click(link);
  expect(screen.getByTestId('location')).toHaveTextContent(href);
  expect(screen.getByRole('tab', { name: 'Phân nhóm' })).toHaveAttribute('aria-selected', 'true');
});
it('lists positive grouping queues in descending learner count and preserves their major deep links', async () => {
  const data = fixture();
  data.sources.grouping.data.items = [
    { id: 'low', title: 'Ít học viên', count: 2, href: '/masters/assign-class-groups?year=2026&majorId=low' },
    { id: 'zero', title: 'Đã phân nhóm', count: 0 },
    { id: 'high', title: 'Nhiều học viên', count: 12, href: '/masters/assign-class-groups?year=2026&majorId=high' },
  ];
  axios.get.mockResolvedValue({ data }); await open();
  const rows = within(taskList()).getAllByRole('listitem');
  expect(rows.map(row => row.querySelector('strong').textContent)).toEqual(['Nhiều học viên', 'Ít học viên']);
  fireEvent.click(within(rows[0]).getByRole('link'));
  expect(screen.getByTestId('location')).toHaveTextContent('/masters/assign-class-groups?year=2026&majorId=high');
});
it('shows unscheduled offerings immediately without an accordion or aggregate zero row', async () => {
  await open(); tab('Xếp lịch');
  expect(within(taskList()).getByText('Lớp chưa có lịch')).toBeInTheDocument();
  expect(within(taskList()).getByText('Chưa xếp lịch')).toBeInTheDocument();
  expect(within(taskList()).getByRole('link')).toHaveAttribute('href', '/masters/schedule?year=2026&offeringId=o1');
  expect(within(work()).queryByRole('button', { expanded: false })).not.toBeInTheDocument();
});
it('keeps confirmations grouped by offering with accurate session counts and stable priority', async () => {
  const data = fixture();
  data.sources.teaching.data.progress.items.push({ id: 'older', title: 'Lớp nhiều buổi', count: 9, unit: 'buổi', href: '/masters/schedule?year=2026&offeringId=older&queue=pending-confirmation' });
  data.sources.teaching.data.progress.itemCount = 2;
  data.sources.teaching.data.progress.count = 12;
  axios.get.mockResolvedValue({ data }); await open(); tab('Xác nhận');
  const rows = within(taskList()).getAllByRole('listitem');
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveTextContent('Lớp nhiều buổi');
  expect(rows[0]).toHaveTextContent('9 buổi');
  expect(rows[1]).toHaveTextContent('3 buổi');
  expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', expect.stringContaining('queue=pending-confirmation'));
  expect(work()).not.toHaveTextContent('quá hạn');
});
it('uses a compact stage selector and shows only the chosen grade stage', async () => {
  await open(); tab('Điểm');
  const picker = within(work()).getByRole('group', { name: 'Giai đoạn điểm' });
  expect(within(picker).getAllByRole('button')).toHaveLength(4);
  expect(within(taskList()).getByText('Lớp giai đoạn 1')).toBeInTheDocument();
  fireEvent.click(within(picker).getByRole('button', { name: /Tổ chức thi/ }));
  expect(within(taskList()).getByText('Lớp giai đoạn 2')).toBeInTheDocument();
  expect(within(taskList()).queryByText('Lớp giai đoạn 1')).not.toBeInTheDocument();
  expect(within(taskList()).getByText('Đã xếp lịch thi sắp tới')).toBeInTheDocument();
  expect(document.querySelector('.od-stage-toggle,.od-grade-stages,[aria-controls^="od-stage-"]')).toBeNull();
});
it('uses each grade record URL without upgrading exam permissions', async () => {
  const data = fixture();
  data.sources.grades.data.stages[1].items[0] = { id: 'exam', title: 'Lớp được xếp thi', action: 'Xếp lịch thi', href: '/masters/exam-schedule?year=2026&offeringId=exam' };
  axios.get.mockResolvedValue({ data }); await open(); tab('Điểm');
  fireEvent.click(within(work()).getByRole('button', { name: /Tổ chức thi/ }));
  expect(within(taskList()).getByRole('link', { name: /Xếp lịch thi/ })).toHaveAttribute('href', '/masters/exam-schedule?year=2026&offeringId=exam');
});
it('removes zero grade stages and renders a single remaining stage directly', async () => {
  const data = fixture();
  data.sources.grades.data.stages.forEach((stage, index) => { if (index !== 2) { stage.count = 0; stage.items = []; } });
  axios.get.mockResolvedValue({ data }); await open(); tab('Điểm');
  expect(within(work()).queryByRole('group', { name: 'Giai đoạn điểm' })).not.toBeInTheDocument();
  expect(within(work()).getByText('Điểm thi')).toBeInTheDocument();
  expect(within(taskList()).getByText('Lớp giai đoạn 3')).toBeInTheDocument();
});
it.each(['Phân nhóm', 'Xếp lịch', 'Xác nhận', 'Điểm'])('shows a compact empty state for %s without a view-all link', async label => {
  const data = fixture();
  data.sources.grouping.data = metric();
  data.sources.teaching.data = { scheduling: metric(), progress: metric() };
  data.sources.grades.data.stages.forEach(stage => { stage.count = 0; stage.items = []; });
  axios.get.mockResolvedValue({ data }); await open(); tab(label);
  expect(within(work()).getByText(/^Không có/)).toBeInTheDocument();
  expect(within(work()).queryByRole('link', { name: 'Xem tất cả' })).not.toBeInTheDocument();
  expect(within(work()).queryByRole('list')).not.toBeInTheDocument();
});
it('adapts the preview to measured space and only offers view-all for hidden records', async () => {
  const data = fixture();
  data.sources.grouping.data.items = Array.from({ length: 8 }, (_, i) => ({ id: `m-${i}`, title: `Chuyên ngành ${i}`, count: 8 - i, href: `/masters/assign-class-groups?year=2026&majorId=m${i}` }));
  data.sources.grouping.data.itemCount = 8;
  axios.get.mockResolvedValue({ data }); await open();
  expect(within(taskList()).getAllByRole('listitem')).toHaveLength(4);
  expect(within(work()).getByRole('link', { name: 'Xem tất cả' })).toHaveAttribute('href', '/masters/assign-class-groups?year=2026');
  previewHeight = 112;
  await act(async () => { resizeCallbacks.forEach(callback => callback()); await new Promise(resolve => requestAnimationFrame(resolve)); });
  expect(within(taskList()).getAllByRole('listitem')).toHaveLength(2);
  expect(work()).toHaveTextContent('Hiển thị 2/8 mục');
  previewHeight = 560;
  await act(async () => { resizeCallbacks.forEach(callback => callback()); await new Promise(resolve => requestAnimationFrame(resolve)); });
  expect(within(taskList()).getAllByRole('listitem')).toHaveLength(8);
  expect(within(work()).queryByRole('link', { name: 'Xem tất cả' })).not.toBeInTheDocument();
});
it('uses itemCount for partial previews instead of learner totals or preview length', async () => {
  const data = fixture(); data.sources.grouping.data.itemCount = 25;
  axios.get.mockResolvedValue({ data }); await open();
  expect(work()).toHaveTextContent('Hiển thị 1/25 mục');
  expect(within(work()).getByRole('link', { name: 'Xem tất cả' })).toBeInTheDocument();
});
it('does not invent the number of specialties from the learner count when itemCount is absent', async () => {
  const data = fixture(); delete data.sources.grouping.data.itemCount;
  data.sources.grouping.data.count = 200;
  axios.get.mockResolvedValue({ data }); await open();
  expect(within(taskList()).getAllByRole('listitem')).toHaveLength(1);
  expect(within(work()).queryByRole('link', { name: 'Xem tất cả' })).not.toBeInTheDocument();
  expect(work()).not.toHaveTextContent('/200');
});
it('isolates source errors, hides failed KPI links and retries only the failed source', async () => {
  const data = fixture(); data.sources.grouping = { status: 'error' };
  axios.get.mockResolvedValue({ data }); await open();
  expect(within(work()).getByRole('alert')).toHaveTextContent('Chưa tải được dữ liệu');
  expect(screen.queryByRole('link', { name: 'Xem công việc: Chờ phân nhóm' })).not.toBeInTheDocument();
  expect(screen.getByRole('figure')).toBeInTheDocument();
  axios.get.mockResolvedValue({ data: { permissions, sources: { grouping: fixture().sources.grouping } } });
  await act(async () => fireEvent.click(within(work()).getByRole('button', { name: 'Thử lại' })));
  expect(axios.get).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ params: { year: '2026', program: 'masters', section: 'grouping' } }));
  expect(within(taskList()).getByText('Công nghệ thông tin')).toBeInTheDocument();
});
it('switches overview topics in one chart and preserves real monthly zero values', async () => {
  const data = fixture();
  data.sources.completionChart.data.values = ['06/2026', '07/2026', '08/2026', '09/2026', '10/2026', '11/2026'].map((label, index) => ({ label, count: index === 5 ? 3 : 0 }));
  axios.get.mockResolvedValue({ data }); await open();
  fireEvent.change(screen.getByRole('combobox', { name: 'Chủ đề tổng quan' }), { target: { value: 'completionChart' } });
  const figure = screen.getByRole('figure', { name: 'Hoàn thành giảng dạy' });
  expect(screen.getAllByRole('figure')).toHaveLength(1);
  expect([...figure.querySelectorAll('.od-column-track>i')].map(bar => bar.style.height)).toEqual(['0%', '0%', '0%', '0%', '0%', '100%']);
  expect(figure).not.toHaveTextContent('Tổng:');
});
it('keeps a zero-valued chart empty and does not fabricate donut segments', async () => {
  const data = fixture(); data.sources.learnersChart.data.values = [];
  axios.get.mockResolvedValue({ data }); await open();
  expect(screen.getByText('Chưa có dữ liệu trong phạm vi này.')).toBeInTheDocument();
  expect(document.querySelector('.od-donut')).toBeNull();
});
it('supports roving keyboard focus across the four work tabs', async () => {
  await open(); const first = screen.getByRole('tab', { name: 'Phân nhóm' }); first.focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'Xếp lịch' })).toHaveFocus();
  expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Xếp lịch');
  await userEvent.keyboard('{End}');
  expect(screen.getByRole('tab', { name: 'Điểm' })).toHaveFocus();
});

it.each(['entry', 'approval', 'both'])('shows entry and approval independently for %s access', async kind => {
  const data = fixture(); data.permissions = { grades: kind !== 'approval', approvals: kind !== 'entry' };
  axios.get.mockResolvedValue({ data }); await open();
  expect(!!screen.queryByRole('tab', { name: 'Điểm' })).toBe(kind !== 'approval');
  expect(!!screen.queryByRole('region', { name: 'Chờ phê duyệt' })).toBe(kind !== 'entry');
  expect(screen.queryByRole('button', { name: /Duyệt ngay/ })).not.toBeInTheDocument();
});
it('drills into approvals inside the same panel, keeps the full count and returns to overview', async () => {
  await open();
  expect(approvals()).toHaveTextContent('28');
  expect(screen.queryByText('Lớp chờ khóa điểm')).not.toBeInTheDocument();
  fireEvent.click(within(approvals()).getByRole('button', { name: /Kết quả điểm chờ duyệt/ }));
  expect(within(approvals()).getByRole('list', { name: 'Danh sách chờ phê duyệt' })).toHaveTextContent('Lớp chờ khóa điểm');
  expect(screen.getByTestId('location')).toHaveTextContent('/viewLogged');
  expect(within(approvals()).getByRole('link', { name: /Lớp chờ khóa điểm/ })).toHaveAttribute('href', '/masters/exam-lists?year=2026&offeringId=result&groupId=g1');
  fireEvent.click(within(approvals()).getByRole('button', { name: 'Tổng quan phê duyệt' }));
  expect(within(approvals()).getByRole('button', { name: /Chuyển chuyên ngành/ })).toBeInTheDocument();
});
it('keeps zero-count approval groups accessible inside the compact empty state', async () => {
  const data = fixture();
  data.sources.approvals.data.resultApproval = metric();
  data.sources.studyLeaveApproval.data = metric(); data.sources.majorTransferApproval.data = metric();
  axios.get.mockResolvedValue({ data }); await open();
  expect(within(approvals()).queryByText('Không có yêu cầu chờ phê duyệt')).not.toBeInTheDocument();
  expect(within(approvals()).getAllByText('0')).toHaveLength(3);
  fireEvent.click(within(approvals()).getByRole('button', { name: /Kết quả điểm chờ duyệt/ }));
  expect(within(approvals()).getByText('Không có yêu cầu chờ phê duyệt')).toBeInTheDocument();
  fireEvent.click(within(approvals()).getByRole('button', { name: 'Tổng quan phê duyệt' }));
  expect(within(approvals()).getAllByRole('button')).toHaveLength(3);
});
it('does not show an empty approval state when a permitted source failed to load', async () => {
  const data = fixture();
  data.sources.approvals = { status: 'error' };
  data.sources.studyLeaveApproval.data = metric(); data.sources.majorTransferApproval.data = metric();
  axios.get.mockResolvedValue({ data }); await open();
  expect(within(approvals()).queryByText('Không có yêu cầu chờ phê duyệt')).not.toBeInTheDocument();
  expect(within(approvals()).getByRole('alert')).toHaveTextContent('Chưa tải được dữ liệu.');
  expect(within(approvals()).getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
});
it.each([['Bảo lưu', '/masters/study-leaves/record1?tab=leave'], ['Chuyển chuyên ngành', '/plan/admission-records/record2?tab=profile']])('opens the original %s record', async (label, href) => {
  await open(); fireEvent.click(within(approvals()).getByRole('button', { name: new RegExp(label) }));
  fireEvent.click(within(approvals()).getByRole('link'));
  expect(screen.getByTestId('location')).toHaveTextContent(href);
});

it('ignores a late response for the previously selected year', async () => {
  let resolve;
  axios.get.mockImplementation((_url, options) => options.params.year === '2026' ? new Promise(done => { resolve = done; }) : Promise.resolve({ data: fixture('2025') }));
  await open(); fireEvent.change(screen.getByRole('combobox', { name: 'Năm tuyển sinh' }), { target: { value: '2025' } });
  await waitFor(() => expect(screen.getByRole('link', { name: 'Xem công việc: Chờ phân nhóm' })).toHaveAttribute('href', '/masters/assign-class-groups?year=2025'));
  await act(async () => resolve({ data: fixture('2026') }));
  expect(screen.getByRole('link', { name: 'Xem công việc: Chờ phân nhóm' })).toHaveAttribute('href', '/masters/assign-class-groups?year=2025');
});
it('clears old profile content immediately and ignores its late response', async () => {
  const result = await open();
  let resolve;
  axios.get.mockImplementation(() => new Promise(done => { resolve = done; }));
  result.rerender(view('b'));
  expect(screen.queryByText('28')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Xin chào, Tên nhân sự' })).toBeInTheDocument();
  const data = fixture(); data.permissions = {}; data.sources = {};
  await act(async () => resolve({ data }));
  expect(screen.queryByRole('region', { name: 'Chờ phê duyệt' })).not.toBeInTheDocument();
});
it('rejects an unresolved response from the previous working profile', async () => {
  let finishOld, finishNew;
  axios.get.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { finishNew = resolve; }));
  const result = await open();
  result.rerender(view('b'));
  const current = fixture(); current.permissions = { grouping: true }; current.sources.grouping.data.count = 2; current.sources.grouping.data.items[0].count = 2;
  await act(async () => finishNew({ data: current }));
  await act(async () => finishOld({ data: fixture() }));
  expect(screen.queryByRole('region', { name: 'Chờ phê duyệt' })).not.toBeInTheDocument();
  expect(work()).toHaveTextContent('2 học viên');
});
it.each([true, false])('keeps the doctoral dashboard layout without masters data when unconfigured (permissions: %s)', async withPermissions => {
  await open();
  const data = fixture(); data.program = 'doctoral';
  data.sources = Object.fromEntries(Object.keys(data.sources).map(key => [key, { status: 'not_implemented', message: 'Nghiệp vụ Tiến sĩ chưa triển khai.' }]));
  if (!withPermissions) { data.permissions = {}; data.sources = {}; }
  axios.get.mockResolvedValue({ data });
  await userEvent.click(screen.getByRole('combobox', { name: 'Hệ đào tạo' }));
  await userEvent.click(within(await screen.findByRole('listbox', { name: 'Hệ đào tạo' })).getByRole('option', { name: 'Tiến sĩ' }));
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Hệ đào tạo' })).toHaveValue('doctoral'));
  await waitFor(() => expect(screen.getAllByText('Chưa được phân công hoặc chưa có dữ liệu cho hệ Tiến sĩ.').length).toBeGreaterThan(0));
  expect(within(screen.getByRole('region', { name: 'Chỉ số công việc' })).getAllByRole('article')).toHaveLength(4);
  expect(within(work()).getAllByRole('tab')).toHaveLength(4);
  for (const label of ['Xếp lịch', 'Xác nhận', 'Điểm', 'Phân nhóm']) {
    fireEvent.click(within(work()).getByRole('tab', { name: label }));
    expect(within(work()).getByRole('tabpanel')).toHaveTextContent('Chưa được phân công hoặc chưa có dữ liệu cho hệ Tiến sĩ.');
  }
  expect(screen.getByRole('heading', { name: 'Tổng quan đào tạo' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /^Xem công việc:/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('figure')).not.toBeInTheDocument();
  expect(screen.queryByText('7 học viên')).not.toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent('program=doctoral');
  expect(axios.get).toHaveBeenLastCalledWith(expect.stringContaining('/dashboard/operational'), expect.objectContaining({ params: { year: '2026', program: 'doctoral' } }));
});
it.each([{}, { grouping: true }, { approvals: true }, { overview: true }, { grouping: true, approvals: true }, { grouping: true, overview: true }])('adapts to permission combination %j without empty columns', async allowed => {
  const data = fixture(); data.permissions = allowed;
  axios.get.mockResolvedValue({ data }); await open();
  if (allowed.grouping && (allowed.approvals || allowed.overview)) expect(document.querySelector('.od-layout')).not.toHaveClass('od-layout-single');
  else expect(document.querySelector('.od-layout')).toHaveClass('od-layout-single');
  if (!Object.keys(allowed).length) expect(screen.getByText('Chưa có nội dung phù hợp với quyền hiện tại')).toBeInTheDocument();
});
it('does not cancel a pending request when polling and focus events arrive', async () => {
  vi.useFakeTimers(); let resolve;
  axios.get.mockImplementation(() => new Promise(done => { resolve = done; }));
  try {
    await open(); const signal = axios.get.mock.calls[0][1].signal;
    await act(async () => { window.dispatchEvent(new Event('focus')); vi.advanceTimersByTime(30000); });
    expect(signal.aborted).toBe(false); expect(axios.get).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ data: fixture() }));
    await act(async () => vi.advanceTimersByTime(30000));
    expect(axios.get).toHaveBeenCalledTimes(2);
  } finally { vi.useRealTimers(); }
});
it('shows actual activity without marking work completed or claiming persistent unread state', async () => {
  axios.get.mockResolvedValue({ data: { permissions: {}, sources: { activity: { status: 'ready', data: { readState: 'not_supported', items: [
    { id: 'e1', title: 'Lớp thật', detail: 'Bảng điểm đã duyệt / khóa', at: '2026-11-03T01:00:00Z', href: '/masters/exam-lists?offeringId=real&groupId=g1&year=2026' },
  ] } } } } });
  await act(async () => render(<MemoryRouter initialEntries={['/viewLogged?year=2026']}><DashboardActivity /></MemoryRouter>));
  expect(axios.get).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Thông báo' })));
  expect(screen.getByRole('dialog')).toHaveTextContent('Chưa hỗ trợ lưu trạng thái đã đọc / chưa đọc giữa các phiên.');
  expect(screen.getByRole('link', { name: /Lớp thật/ })).toHaveAttribute('href', '/masters/exam-lists?offeringId=real&groupId=g1&year=2026');
  expect(axios.get).toHaveBeenCalledTimes(1);
});
