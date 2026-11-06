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

it('greets the active working profile and keeps the existing navigation, footer and filters in the header', async () => {
  await open();
  expect(screen.getByRole('heading', { name: 'Xin chào, Hồ sơ a' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Ribbon hiện có' })).toBeInTheDocument();
  expect(screen.getByText('Footer hiện có')).toBeInTheDocument();
  expect(document.querySelector('.od-header')).toContainElement(screen.getByRole('group', { name: 'Bộ lọc dashboard' }));
});
it('separates group details, inline preview and navigation without adding incompatible units', async () => {
  await open();
  const group = within(work()).getByRole('region', { name: 'Học viên chưa phân nhóm' });
  expect(group).toHaveTextContent('7 học viên');
  expect(screen.queryByText('Công nghệ thông tin')).not.toBeInTheDocument();
  fireEvent.click(within(group).getByRole('button', { name: /Xem trước/ }));
  expect(within(group).getByText('Công nghệ thông tin')).toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent('/viewLogged');
  fireEvent.click(within(group).getByRole('button', { name: 'Chi tiết' }));
  expect(screen.getByRole('tab', { name: 'Phân nhóm' })).toHaveAttribute('aria-selected', 'true');
  fireEvent.click(screen.getByRole('link', { name: 'Mở chức năng: Công nghệ thông tin' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/masters/assign-class-groups?year=2026&majorId=m1&disciplineId=d1');
});
it('shows different counts and deep links for unscheduled offerings and pending sessions', async () => {
  await open(); tab('Lịch học');
  expect(within(work()).getByRole('region', { name: 'Lớp học phần chưa xếp lịch' })).toHaveTextContent('1 lớp học phần');
  expect(within(work()).getByRole('region', { name: 'Buổi học chờ xác nhận' })).toHaveTextContent('3 buổi');
  expect(screen.getByRole('link', { name: 'Mở chức năng: Lớp chờ xác nhận' })).toHaveAttribute('href', '/masters/schedule?year=2026&offeringId=o2&queue=pending-confirmation');
});
it('renders four ordered expandable grade stages without a mixed urgency list', async () => {
  await open(); tab('Điểm');
  const titles = ['Chưa hoàn thiện điểm thành phần', 'Chờ tổ chức thi', 'Thi xong, chờ nhập điểm thi', 'Đủ kết quả, chờ gửi duyệt'];
  for (const [index, title] of titles.entries()) {
    const group = within(work()).getByRole('region', { name: title });
    expect(within(group).getByRole('button')).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(within(group).getByRole('button'));
    expect(within(group).getByText(`Lớp giai đoạn ${index + 1}`)).toBeInTheDocument();
  }
  expect(work()).toHaveTextContent('Đã xếp lịch thi sắp tới');
  expect(work()).not.toHaveTextContent(/quá hạn|khẩn cấp|CẢNH BÁO/);
  expect(within(work()).getByRole('link', { name: 'Mở để gửi duyệt: Lớp giai đoạn 4' })).toHaveAttribute('href', expect.stringContaining('offeringId=result_ready'));
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
  expect(within(approvals()).getByText('Lớp chờ khóa điểm')).toBeInTheDocument();
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
  expect(within(approvals()).getByText('Không có yêu cầu chờ phê duyệt')).toBeInTheDocument();
  fireEvent.click(within(approvals()).getByRole('button', { name: /Kết quả điểm chờ duyệt/ }));
  expect(within(approvals()).getByText('Không có mục chờ xử lý.')).toBeInTheDocument();
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
it('displays one chart at a time and excludes admissions topics for scheduling-only viewers', async () => {
  const data = fixture(); data.permissions = { overview: true };
  axios.get.mockResolvedValue({ data }); await open();
  expect(screen.queryByRole('region', { name: 'Công việc cần xử lý' })).not.toBeInTheDocument();
  const select = screen.getByRole('combobox', { name: 'Chủ đề tổng quan' });
  expect(within(select).queryByText('Hồ sơ / học viên trong khóa')).not.toBeInTheDocument();
  expect(screen.getAllByRole('figure')).toHaveLength(1);
  fireEvent.change(select, { target: { value: 'completionChart' } });
  expect(screen.getByRole('figure', { name: 'Hoàn thành giảng dạy' })).toHaveTextContent('11/2026');
});
it('uses real zero data as an empty state, not fabricated chart values', async () => {
  const data = fixture(); data.sources.learnersChart.data.values = [];
  axios.get.mockResolvedValue({ data }); await open();
  expect(screen.getByText('Chưa có dữ liệu trong phạm vi này.')).toBeInTheDocument();
  expect(document.querySelector('.od-donut')).toBeNull();
});
it('renders every returned month as a vertical column, preserving zero heights and the total', async () => {
  const data = fixture();
  data.sources.completionChart.data.values = ['06/2026', '07/2026', '08/2026', '09/2026', '10/2026', '11/2026'].map((label, index) => ({ label, count: index === 5 ? 3 : 0 }));
  axios.get.mockResolvedValue({ data }); await open();
  fireEvent.change(screen.getByRole('combobox', { name: 'Chủ đề tổng quan' }), { target: { value: 'completionChart' } });
  const figure = screen.getByRole('figure', { name: 'Hoàn thành giảng dạy' });
  expect(figure.querySelectorAll('.od-month')).toHaveLength(6);
  expect(figure).toHaveTextContent('Tổng: 3 lớp học phần');
  const bars = [...figure.querySelectorAll('.od-column-track>i')];
  expect(bars.map(bar => bar.style.height)).toEqual(['0%', '0%', '0%', '0%', '0%', '100%']);
});
it('isolates a failed source and retries just that source while other panels remain usable', async () => {
  const data = fixture(); data.sources.grouping = { status: 'error' };
  axios.get.mockResolvedValue({ data }); await open();
  const grouping = within(work()).getByRole('region', { name: 'Học viên chưa phân nhóm' });
  expect(within(grouping).getByRole('alert')).toBeInTheDocument();
  expect(screen.getByRole('figure')).toBeInTheDocument();
  axios.get.mockResolvedValue({ data: { permissions, sources: { grouping: fixture().sources.grouping } } });
  await act(async () => fireEvent.click(within(grouping).getByRole('button', { name: 'Thử lại' })));
  expect(axios.get).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ params: { year: '2026', program: 'masters', section: 'grouping' } }));
  expect(grouping).toHaveTextContent('7 học viên');
  expect(screen.getByRole('region', { name: 'Chờ phê duyệt' })).toBeInTheDocument();
});
it('ignores a late response for the previously selected year', async () => {
  let resolve;
  axios.get.mockImplementation((_url, options) => options.params.year === '2026' ? new Promise(done => { resolve = done; }) : Promise.resolve({ data: fixture('2025') }));
  await open(); fireEvent.change(screen.getByRole('combobox', { name: 'Năm tuyển sinh' }), { target: { value: '2025' } });
  await waitFor(() => expect(screen.getByRole('link', { name: 'Mở chức năng: Học viên chưa phân nhóm' })).toHaveAttribute('href', '/masters/assign-class-groups?year=2025'));
  await act(async () => resolve({ data: fixture('2026') }));
  expect(screen.getByRole('link', { name: 'Mở chức năng: Học viên chưa phân nhóm' })).toHaveAttribute('href', '/masters/assign-class-groups?year=2025');
});
it('clears old profile content immediately and ignores its late response', async () => {
  const result = await open();
  let resolve;
  axios.get.mockImplementation(() => new Promise(done => { resolve = done; }));
  result.rerender(view('b'));
  expect(screen.queryByText('28')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Xin chào, Hồ sơ b' })).toBeInTheDocument();
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
  const current = fixture(); current.permissions = { grouping: true }; current.sources.grouping.data.count = 2;
  await act(async () => finishNew({ data: current }));
  await act(async () => finishOld({ data: fixture() }));
  expect(screen.queryByRole('region', { name: 'Chờ phê duyệt' })).not.toBeInTheDocument();
  expect(work()).toHaveTextContent('2 học viên');
});
it('does not use masters content or charts when doctoral sources are unimplemented', async () => {
  await open();
  const data = fixture(); data.program = 'doctoral';
  data.sources = Object.fromEntries(Object.keys(data.sources).map(key => [key, { status: 'not_implemented', message: 'Nghiệp vụ Tiến sĩ chưa triển khai.' }]));
  axios.get.mockResolvedValue({ data });
  fireEvent.change(screen.getByRole('combobox', { name: 'Hệ đào tạo' }), { target: { value: 'doctoral' } });
  await waitFor(() => expect(screen.getAllByText('Nghiệp vụ Tiến sĩ chưa triển khai.').length).toBeGreaterThan(0));
  expect(screen.queryByRole('figure')).not.toBeInTheDocument();
  expect(screen.queryByText('7 học viên')).not.toBeInTheDocument();
});
it('keeps keyboard tabs and inline expanders accessible', async () => {
  await open(); const all = screen.getByRole('tab', { name: 'Tất cả' }); all.focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'Phân nhóm' })).toHaveFocus();
  expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Phân nhóm');
  await userEvent.keyboard('{End}');
  expect(screen.getByRole('tab', { name: 'Điểm' })).toHaveFocus();
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
