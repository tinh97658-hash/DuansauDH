import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import axios from 'axios';
import AdmittedRecords from '../../pages/masters/admittedRecords';
import LearnerCodeRedirect from '../../features/learnerCodes/LearnerCodeRedirect';
import { AuthSessionContext } from '../../context/AuthSession';

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../config/http', () => ({ API_BASE_URL: '/api' }));
vi.mock('../../components/FeatureLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../../pages/plan/admissionRecords', () => ({ default: ({ embedded }) => <p>{embedded ? 'Danh sách hồ sơ tích hợp' : 'Trang riêng'}</p> }));

const codePath = '/plan/learner-codes';
const admittedPath = '/masters/admitted-records';
const routeCatalog = [
  { path: admittedPath, actions: ['admission.manage'] },
  { path: codePath, actions: ['learnercode.preview', 'learnercode.issue'] },
];
const permissions = ['admission.view', 'route.masters.admitted-records.view', 'route.plan.learner-codes.view',
  'learnercode.preview', 'learnercode.issue', 'route.plan.learner-codes.learnercode-preview', 'route.plan.learner-codes.learnercode-issue'];
function CurrentPath() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}
function mount(entry = admittedPath, grants = permissions) {
  return render(<MemoryRouter initialEntries={[entry]}>
    <AuthSessionContext.Provider value={{ user: { id: 'staff' }, currentPath: admittedPath, access: { permissions: grants, routeCatalog } }}>
      <Routes>
        <Route path={admittedPath} element={<AdmittedRecords />} />
        <Route path={codePath} element={<LearnerCodeRedirect />} />
      </Routes>
      <CurrentPath />
    </AuthSessionContext.Provider>
  </MemoryRouter>);
}
beforeEach(() => {
  vi.clearAllMocks();
  axios.get.mockImplementation(async url => {
    if (url.endsWith('/options')) return { data: { types: [], groups: [{ id: 'class-1', code: 'CN26', name: 'Lớp 1' }] } };
    if (url.includes('/class/')) return { data: [{ id: 'record-1', code: 'TN001', full_name: 'Nguyễn An', learner_code_state: 'provisional' }] };
    if (url.endsWith('/preview')) return { data: { fingerprint: 'preview-1', rows: [{ id: 'record-1', fullName: 'Nguyễn An', code: 'CN2611001', components: ['CN', '26', '1', '1', '001'] }] } };
    return { data: [] };
  });
  axios.post.mockResolvedValue({ data: {} });
});

it('issues codes inside admitted records using the existing code action grants and returns to the list', async () => {
  mount();
  expect(screen.getByText('Danh sách hồ sơ tích hợp')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Cấp mã học viên' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/masters/admitted-records?tab=learner-codes');
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Chọn Nguyễn An' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xem trước 1 hồ sơ' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận cấp mã' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/learner-codes/issue'), expect.objectContaining({ recordIds: ['record-1'], fingerprint: 'preview-1' })));
  await screen.findByText(/Đã cấp mã\./);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Danh sách hồ sơ' })).toBeEnabled());
  fireEvent.click(screen.getByRole('tab', { name: 'Danh sách hồ sơ' }));
  expect(screen.getByText('Danh sách hồ sơ tích hợp')).toBeInTheDocument();
  expect(screen.getByTestId('location')).not.toHaveTextContent('tab=');
});

it('hides the code panel and makes no code requests without its page grant', () => {
  mount(`${admittedPath}?tab=learner-codes`, permissions.filter(p => p !== 'route.plan.learner-codes.view'));
  expect(screen.queryByRole('tab', { name: 'Cấp mã học viên' })).not.toBeInTheDocument();
  expect(screen.getByText(/chưa có quyền truy cập/)).toBeInTheDocument();
  expect(axios.get).not.toHaveBeenCalled();
});

it('preserves the separate issuance action grant inside the embedded panel', async () => {
  mount(`${admittedPath}?tab=learner-codes`, permissions.filter(p => p !== 'route.plan.learner-codes.learnercode-issue'));
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Chọn Nguyễn An' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xem trước 1 hồ sơ' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).queryByRole('button', { name: 'Xác nhận cấp mã' })).not.toBeInTheDocument();
});

it('redirects legacy links to the integrated panel without losing the record and class', async () => {
  mount(`${codePath}?classGroupId=class-1&recordId=record-1`);
  expect(await screen.findByRole('checkbox', { name: 'Chọn Nguyễn An' })).toBeChecked();
  expect(screen.getByTestId('location')).toHaveTextContent('/masters/admitted-records?classGroupId=class-1&recordId=record-1&tab=learner-codes');
});
