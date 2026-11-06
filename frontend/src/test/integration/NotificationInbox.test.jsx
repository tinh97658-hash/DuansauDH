import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import axios from 'axios';
import { AuthSessionContext } from '../../context/AuthSession';
import NotificationBell, { safeNotificationHref } from '../../features/notifications/NotificationBell';
import RibbonHeader from '../../components/RibbonHeader';

vi.mock('axios', () => ({ default: { defaults: { headers: { common: {} } }, get: vi.fn(), post: vi.fn() } }));
const navigation = vi.hoisted(() => ({ confirm: vi.fn(), discard: vi.fn() }));
vi.mock('../../components/UnsavedChangesGuard', () => ({ useConfirmGradeLeave: () => navigation.confirm, useDiscardUnsavedGrades: () => navigation.discard }));
const session = profile => ({ authenticated: true, user: { id: 'staff-1', role: 'custom', name: 'Người kiểm tra' },
  activeProfile: { id: profile, name: 'Hồ sơ làm việc' }, access: { permissions: [], roles: [] } });
const item = { id: 'delivery-1', type: 'grade.submitted', title: 'Có kết quả điểm chờ phê duyệt', body: 'Lớp học phần 2026',
  href: '/masters/exam-lists?offeringId=123', occurredAt: '2026-11-06T00:00:00Z', readAt: null };
const response = (items = [item], unreadCount = 1, total = items.length, page = 1) => ({ data: { items, unreadCount, total, page, pageSize: 6 } });
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }
const tree = (profile = 'p1', component = <NotificationBell />) => <MemoryRouter initialEntries={['/viewLogged']}><AuthSessionContext.Provider value={session(profile)}>{component}<Location /></AuthSessionContext.Provider></MemoryRouter>;
const bell = () => screen.getByRole('button', { name: 'Thông báo' });
const open = async () => { fireEvent.click(bell()); await screen.findByRole('dialog', { name: 'Thông báo' }); };
beforeEach(() => { axios.get.mockReset(); axios.post.mockReset(); axios.get.mockResolvedValue(response()); navigation.confirm.mockReset().mockResolvedValue(true); navigation.discard.mockReset(); });

it('loads a real count and opening the bell never writes read state', async () => {
  render(tree()); await waitFor(() => expect(screen.getByLabelText('1 thông báo chưa đọc')).toBeInTheDocument());
  await open(); await screen.findByText(item.title);
  expect(axios.post).not.toHaveBeenCalled();
  expect(axios.get.mock.calls.every(([url]) => url.endsWith('/notifications'))).toBe(true);
});
it('marks only the selected notification, then follows the freshly authorized target', async () => {
  axios.post.mockImplementation(async () => { axios.get.mockResolvedValue(response([{ ...item, readAt: '2026-11-06' }], 0)); return { data: { item } }; });
  render(tree()); await open(); fireEvent.click(await screen.findByRole('button', { name: /Có kết quả điểm chờ phê duyệt/ }));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/masters/exam-lists?offeringId=123'));
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post.mock.calls[0][0]).toMatch(/\/notifications\/delivery-1\/read$/);
  expect(navigation.discard).toHaveBeenCalledTimes(1);
});
it('keeps unsaved work and does not mark read when navigation is cancelled', async () => {
  navigation.confirm.mockResolvedValue(false);
  render(tree()); await open(); fireEvent.click(await screen.findByRole('button', { name: /Có kết quả điểm/ }));
  await waitFor(() => expect(navigation.confirm).toHaveBeenCalled());
  expect(axios.post).not.toHaveBeenCalled(); expect(navigation.discard).not.toHaveBeenCalled();
  expect(screen.getByTestId('location')).toHaveTextContent('/viewLogged');
});
it('keeps notifications after mark-all, and refresh keeps the persisted all-read state', async () => {
  axios.post.mockImplementation(async () => { axios.get.mockResolvedValue(response([{ ...item, readAt: '2026-11-06' }], 0)); return { data: { updated: 1 } }; });
  const view = render(tree()); await open(); await screen.findByText(item.title);
  fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }));
  await screen.findByText('Không có thông báo chưa đọc.');
  expect(screen.getByText(item.title)).toBeInTheDocument();
  expect(axios.post.mock.calls[0][0]).toMatch(/\/notifications\/read-all$/);
  view.unmount(); render(tree()); await open(); await screen.findByText('Không có thông báo chưa đọc.');
  expect(screen.queryByLabelText('1 thông báo chưa đọc')).not.toBeInTheDocument();
});
it('separates empty inbox, loading and API errors, and supports retry', async () => {
  axios.get.mockRejectedValue(new Error('network'));
  render(tree()); await open(); await screen.findByText('Chưa tải được thông báo.');
  expect(screen.queryByText('Bạn chưa có thông báo.')).not.toBeInTheDocument();
  axios.get.mockResolvedValue(response([], 0)); fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  await screen.findByText('Bạn chưa có thông báo.');
});
it('shows loading while a response is pending', async () => {
  axios.get.mockImplementation(() => new Promise(() => {}));
  render(tree()); await open(); expect(screen.getByRole('status')).toHaveTextContent('Đang tải thông báo');
});
it('does not navigate or hide an error when marking read fails', async () => {
  axios.post.mockRejectedValue(new Error('forbidden'));
  render(tree()); await open(); fireEvent.click(await screen.findByRole('button', { name: /Có kết quả điểm/ }));
  await screen.findByText('Chưa đánh dấu đã đọc được. Vui lòng thử lại.');
  expect(screen.getByTestId('location')).toHaveTextContent('/viewLogged');
  expect(navigation.discard).not.toHaveBeenCalled();
});
it('rejects old-profile responses even when the network mock ignores abort', async () => {
  let resolveOld;
  axios.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValue(response([], 0));
  const view = render(tree('p1')); await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
  view.rerender(tree('p2')); await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
  await act(async () => resolveOld(response([item], 99)));
  await open(); await screen.findByText('Bạn chưa có thông báo.');
  expect(screen.queryByText(item.title)).not.toBeInTheDocument();
  expect(axios.get.mock.calls.at(-1)[1].headers['X-Working-Profile-Id']).toBe('p2');
});
it('paginates six rows at a time through the notification API', async () => {
  axios.get.mockImplementation(async (_url, options) => response([item], 7, 7, options.params.page));
  render(tree()); await open(); await screen.findByText(item.title); fireEvent.click(screen.getByRole('button', { name: 'Tiếp' }));
  await screen.findByText('2/2'); expect(axios.get.mock.calls.at(-1)[1].params.page).toBe(2);
});
it('discards a read response after switching profiles and never navigates using the old profile', async () => {
  let resolveRead;
  axios.post.mockImplementation(() => new Promise(resolve => { resolveRead = resolve; }));
  const view = render(tree('p1')); await open(); fireEvent.click(await screen.findByRole('button', { name: /Có kết quả điểm/ }));
  await waitFor(() => expect(axios.post).toHaveBeenCalled());
  axios.get.mockResolvedValue(response([], 0)); view.rerender(tree('p2'));
  await act(async () => resolveRead({ data: { item } }));
  expect(screen.getByTestId('location')).toHaveTextContent('/viewLogged');
  await open(); await screen.findByText('Bạn chưa có thông báo.');
});
it('polls at 45 seconds only while visible and cleans up on unmount', async () => {
  vi.useFakeTimers();
  const visibility = vi.spyOn(document, 'visibilityState', 'get');
  let view;
  try {
    visibility.mockReturnValue('visible');
    await act(async () => { view = render(tree()); });
    expect(axios.get).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(45000); });
    expect(axios.get).toHaveBeenCalledTimes(2);
    visibility.mockReturnValue('hidden');
    await act(async () => { vi.advanceTimersByTime(90000); });
    expect(axios.get).toHaveBeenCalledTimes(2);
    visibility.mockReturnValue('visible');
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(axios.get).toHaveBeenCalledTimes(3);
    view.unmount();
    await act(async () => { vi.advanceTimersByTime(90000); window.dispatchEvent(new Event('focus')); });
    expect(axios.get).toHaveBeenCalledTimes(3);
  } finally { view?.unmount(); visibility.mockRestore(); vi.useRealTimers(); }
});
it.each(['/masters/schedule', '/plan/admission-records', '/reports/lecturer-payments'])('shows the common header bell on %s without changing the menu', async route => {
  render(<MemoryRouter initialEntries={[route]}><AuthSessionContext.Provider value={session('p1')}><RibbonHeader /></AuthSessionContext.Provider></MemoryRouter>);
  expect(bell()).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Mở menu tác vụ' })).toBeInTheDocument();
  await waitFor(() => expect(axios.get).toHaveBeenCalled());
});
it('accepts only recognized internal business targets', () => {
  expect(safeNotificationHref(item.href)).toBe(true);
  for (const href of ['https://example.com', '//example.com', 'javascript:alert(1)', '/system/roles']) expect(safeNotificationHref(href)).toBe(false);
});
