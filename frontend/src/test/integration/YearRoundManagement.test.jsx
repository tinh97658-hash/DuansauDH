import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import axios from 'axios';
import TrainingYears from '../../pages/system/trainingYears';
import { AuthSessionContext } from '../../context/AuthSession';

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), defaults: {} } }));
vi.mock('../../components/FeatureLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
const round = { id: 'round-1', name: 'Đợt mùa thu', academicYear: '2026', majorThresholds: [{ majorId: 'major-1', cutoff: 15 }],
  rules: { direct: 2 }, regulationNo: 'QC01', decisionNo: 'QD01', decisionDate: '2026-09-01' };
const catalog = [
  { path: '/system/training-years', actions: ['catalog.manage'] },
  { path: '/masters/admission-scores', actions: ['admission.manage'] },
];
const grants = ['catalog.view', 'catalog.manage', 'route.system.training-years.view', 'route.system.training-years.catalog-manage',
  'admission.view', 'admission.manage', 'route.masters.admission-scores.view', 'route.masters.admission-scores.admission-manage'];
let rounds;
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); rounds = [round];
  axios.get.mockImplementation(async url => {
    if (url.endsWith('/training-years')) return { data: [{ id: 'year-1', name: '2026', startDate: '2000-01-01', active: true }] };
    if (url.endsWith('/admission-rounds')) return { data: { rows: rounds } };
    return { data: [] };
  });
  axios.post.mockResolvedValue({ data: round }); axios.put.mockResolvedValue({ data: round });
});
function Destination() { return <output>{useLocation().search}</output>; }
function mount(permissions = grants, entry = '/system/training-years?tab=rounds') {
  return render(<MemoryRouter initialEntries={[entry]}><AuthSessionContext.Provider value={{ user: { id: 'staff' }, currentPath: '/system/training-years', access: { permissions, routeCatalog: catalog } }}>
    <Routes><Route path="/system/training-years" element={<TrainingYears />} /><Route path="/masters/admission-scores" element={<Destination />} /></Routes>
  </AuthSessionContext.Provider></MemoryRouter>);
}
it('manages years and rounds in the same page and filters rounds by name and year', async () => {
  rounds = [round, { ...round, id: 'old', name: 'Đợt mùa xuân', academicYear: '2025' }];
  mount();
  expect(await screen.findByText('Hiển thị 2 / 2 đợt xét tuyển')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Tìm đợt xét tuyển'), { target: { value: 'mua thu' } });
  expect(screen.getByText('Hiển thị 1 / 2 đợt xét tuyển')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Tìm đợt xét tuyển'), { target: { value: '' } });
  fireEvent.mouseDown(screen.getByLabelText('Lọc năm tuyển sinh'));
  fireEvent.click(await screen.findByRole('option', { name: '2025' }));
  expect(screen.queryByText(round.name)).not.toBeInTheDocument();
  expect(screen.getByText('Đợt mùa xuân')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Năm đào tạo' }));
  expect(await screen.findByText('2026')).toBeInTheDocument();
});
it('creates a shared round using a configured year', async () => {
  mount();
  await screen.findByText(round.name);
  fireEvent.click(screen.getByRole('button', { name: 'Tạo đợt mới' }));
  const dialog = within(screen.getByRole('dialog'));
  fireEvent.change(dialog.getByLabelText('Tên đợt xét tuyển'), { target: { value: 'Đợt bổ sung' } });
  expect(dialog.getByLabelText('Năm tuyển sinh')).toHaveTextContent('2026');
  fireEvent.click(dialog.getByRole('button', { name: 'Lưu đợt xét tuyển' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/plan/admission-rounds'),
    { name: 'Đợt bổ sung', academicYear: '2026', majorThresholds: [] }, { withCredentials: true }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it('preserves thresholds, rules and decision information when renaming a round', async () => {
  mount();
  fireEvent.click(await screen.findByRole('button', { name: `Sửa đợt ${round.name}` }));
  const dialog = within(screen.getByRole('dialog'));
  fireEvent.change(dialog.getByLabelText('Tên đợt xét tuyển'), { target: { value: 'Tên đợt mới' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Lưu thay đổi' }));
  const { id, ...payload } = round;
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining(`/plan/admission-rounds/${id}`),
    { ...payload, name: 'Tên đợt mới' }, { withCredentials: true }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it('opens the selected round in admission scoring', async () => {
  mount();
  fireEvent.click(await screen.findByRole('button', { name: `Chọn đợt ${round.name}` }));
  expect(await screen.findByText('?roundId=round-1')).toBeInTheDocument();
});
it('refreshes and paginates the round list', async () => {
  rounds = Array.from({ length: 12 }, (_, index) => ({ ...round, id: `round-${index}`, name: `Đợt số ${index + 1}` }));
  mount();
  await screen.findByText('Hiển thị 12 / 12 đợt xét tuyển');
  expect(screen.queryByText('Đợt số 12')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  expect(screen.getByText('Đợt số 12')).toBeInTheDocument();
  rounds = [{ ...round, name: 'Đợt mới cập nhật' }];
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại danh sách' }));
  expect(await screen.findByText('Đợt mới cập nhật')).toBeInTheDocument();
});
it('does not grant round management through catalog editing permissions', async () => {
  mount(grants.filter(p => p !== 'route.masters.admission-scores.admission-manage'));
  await screen.findByText(round.name);
  expect(screen.queryByRole('button', { name: 'Tạo đợt mới' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: `Sửa đợt ${round.name}` })).not.toBeInTheDocument();
});
it('hides rounds without admission page access and makes no round request', async () => {
  mount(grants.filter(p => p !== 'route.masters.admission-scores.view'));
  expect(screen.queryByRole('tab', { name: 'Đợt xét tuyển' })).not.toBeInTheDocument();
  await screen.findByText('2026');
  expect(axios.get.mock.calls.some(([url]) => url.endsWith('/admission-rounds'))).toBe(false);
});
