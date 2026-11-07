import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { AuthSessionContext } from '../../context/AuthSession';
import AdmissionRecordDetail from '../../pages/plan/admissionRecordDetail';
import { createAdmissionWord, openAdmissionPreview } from '../../features/admission/admissionDocumentExport';
import { createLearnerTranscriptWord } from '../../features/learners/learnerTranscriptWord';
import { createLearnerTranscriptExcel } from '../../features/learners/learnerTranscriptExcel';
import { openLearnerTranscriptPdfPreview } from '../../features/learners/learnerTranscriptPdfPreview';
import { reserveReportPreview } from '../../utils/reportPreview';
import { downloadDocumentFile } from '../../utils/documentFiles';
import { normalizeLearnerTranscript, learnerTranscriptFilename } from '../../features/learners/learnerTranscript';
import { transcriptScorecardFixture as scorecard } from '../fixtures/learnerTranscript.fixture';

vi.mock('axios');
vi.mock('../../components/FeatureLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../../features/admission/AdmissionEvaluationPanel', () => ({ default: () => <div /> }));
vi.mock('../../features/learners/StudyLeavePanel', () => ({ default: () => <div /> }));
vi.mock('../../features/learners/LearnerScorecard', () => ({ default: ({ onClassChange }) => <button onClick={() => onClassChange('g2')}>Đổi lớp bảng điểm</button> }));
vi.mock('react-toastify', () => ({ ToastContainer: () => null, toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../features/admission/admissionDocumentExport', () => ({ createAdmissionWord: vi.fn(), openAdmissionPreview: vi.fn() }));
vi.mock('../../features/learners/learnerTranscriptWord', () => ({ createLearnerTranscriptWord: vi.fn() }));
vi.mock('../../features/learners/learnerTranscriptExcel', () => ({ createLearnerTranscriptExcel: vi.fn() }));
vi.mock('../../features/learners/learnerTranscriptPdfPreview', () => ({ openLearnerTranscriptPdfPreview: vi.fn() }));
vi.mock('../../utils/reportPreview', () => ({ reserveReportPreview: vi.fn() }));
vi.mock('../../utils/documentFiles', async () => ({ ...await vi.importActual('../../utils/documentFiles'), downloadDocumentFile: vi.fn() }));

const record = { id: 'ar1', code: 'HV001', fullName: 'Nguyễn Văn An', dob: '1990-01-02', majorId: 'major', trainingLevel: 'Thạc sĩ', documents: {} };
const session = { authenticated: true, user: { role: 'admin' }, access: { permissions: ['admission.view', 'reports.view'] } };
const blobs = { word: new Blob(['word']), excel: new Blob(['excel']), pdf: new Blob(['pdf']) };
const generators = { word: createLearnerTranscriptWord, excel: createLearnerTranscriptExcel };
let previewTab;
const labels = { word: 'Word (.docx)', excel: 'Excel (.xlsx)', pdf: 'PDF (.pdf)' };
beforeEach(() => {
  vi.clearAllMocks();
  createAdmissionWord.mockResolvedValue(blobs.word);
  previewTab = { close: vi.fn(), closed: false };
  reserveReportPreview.mockReturnValue(previewTab);
  openLearnerTranscriptPdfPreview.mockResolvedValue();
  Object.entries(generators).forEach(([key, generate]) => generate.mockResolvedValue(blobs[key]));
  axios.get.mockImplementation(async url => ({ data: url.endsWith('/admission-records/ar1') ? record
    : url.includes('/system/majors') ? [{ id: 'major', name: 'Công nghệ thông tin', program: 'masters' }]
      : url.includes('/reports/learner-scorecard/') ? scorecard : [] }));
});
const mount = async tab => {
  render(<AuthSessionContext.Provider value={session}><MemoryRouter useTransitions={false} initialEntries={[`/masters/admitted-records/ar1?tab=${tab}&classGroupId=g1`]}>
    <Routes><Route path="/masters/admitted-records/:id" element={<AdmissionRecordDetail returnPath="/masters/admitted-records" />} /></Routes>
  </MemoryRouter></AuthSessionContext.Provider>);
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Xuất báo cáo' })[0]).toBeEnabled());
};
const menu = () => { fireEvent.click(screen.getAllByRole('button', { name: 'Xuất báo cáo' })[0]); return within(screen.getByRole('menu', { name: 'Xuất báo cáo' })); };

it.each(['profile', 'admission', 'leave'])('exports the student CV in Word from %s, with no Excel option', async tab => {
  await mount(tab);
  const options = menu();
  expect(options.getAllByRole('menuitem').map(item => item.textContent)).toEqual([labels.word, labels.pdf]);
  fireEvent.click(options.getByRole('menuitem', { name: labels.word }));
  await waitFor(() => expect(downloadDocumentFile).toHaveBeenCalledWith(blobs.word, 'ho-so-HV001.docx'));
  expect(createAdmissionWord).toHaveBeenCalledWith(expect.objectContaining({ fullName: record.fullName }));
  expect(createLearnerTranscriptWord).not.toHaveBeenCalled();
});
it.each(['profile', 'admission', 'leave'])('opens the existing A4 CV for printing/saving PDF from %s', async tab => {
  await mount(tab);
  fireEvent.click(menu().getByRole('menuitem', { name: labels.pdf }));
  await waitFor(() => expect(openAdmissionPreview).toHaveBeenCalledWith(expect.objectContaining({ fullName: record.fullName })));
  expect(downloadDocumentFile).not.toHaveBeenCalled();
});
it.each(['learning', 'grades'].flatMap(tab => ['excel', 'word'].map(format => [tab, format])))('exports the current student transcript directly from %s as %s', async (tab, format) => {
  await mount(tab);
  const options = menu();
  expect(options.getAllByRole('menuitem').map(item => item.textContent)).toEqual([labels.excel, labels.word, labels.pdf]);
  fireEvent.click(options.getByRole('menuitem', { name: labels[format] }));
  await waitFor(() => expect(generators[format]).toHaveBeenCalledTimes(1));
  const transcript = normalizeLearnerTranscript(scorecard);
  expect(generators[format]).toHaveBeenCalledWith(transcript);
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/reports/learner-scorecard/ar1'), expect.objectContaining({ params: { classGroupId: 'g1' } }));
  await waitFor(() => expect(downloadDocumentFile).toHaveBeenCalledWith(blobs[format], learnerTranscriptFilename(transcript, format)));
  expect(screen.queryByRole('dialog', { name: /XUẤT BẢNG ĐIỂM CÁ NHÂN/ })).not.toBeInTheDocument();
  expect(createAdmissionWord).not.toHaveBeenCalled();
});
it.each(['learning', 'grades'])('opens the exact transcript PDF preview before printing/saving from %s', async tab => {
  await mount(tab);
  fireEvent.click(menu().getByRole('menuitem', { name: labels.pdf }));
  await waitFor(() => expect(openLearnerTranscriptPdfPreview).toHaveBeenCalledWith(normalizeLearnerTranscript(scorecard), previewTab, expect.objectContaining({ isCancelled: expect.any(Function) })));
  const scorecardRead = axios.get.mock.calls.findIndex(([url]) => url.includes('/reports/learner-scorecard/'));
  expect(reserveReportPreview.mock.invocationCallOrder[0]).toBeLessThan(axios.get.mock.invocationCallOrder[scorecardRead]);
  expect(downloadDocumentFile).not.toHaveBeenCalled();
  expect(previewTab.close).not.toHaveBeenCalled();
});
it('uses the class selected in the individual scorecard', async () => {
  await mount('grades');
  fireEvent.click(screen.getByRole('button', { name: 'Đổi lớp bảng điểm' }));
  fireEvent.click(menu().getByRole('menuitem', { name: labels.word }));
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/reports/learner-scorecard/ar1'), expect.objectContaining({ params: { classGroupId: 'g2' } })));
});
it.each(['word', 'pdf'])('cancels %s export when the report tab changes during loading', async format => {
  await mount('grades');
  let complete;
  const reads = axios.get.getMockImplementation();
  axios.get.mockImplementation((url, options) => url.includes('/reports/learner-scorecard/') ? new Promise(resolve => { complete = resolve; }) : reads(url, options));
  fireEvent.click(menu().getByRole('menuitem', { name: labels[format] }));
  await waitFor(() => expect(complete).toBeTypeOf('function'));
  fireEvent.click(screen.getByRole('tab', { name: 'Thông tin hồ sơ' }));
  await act(async () => { complete({ data: scorecard }); });
  expect(createLearnerTranscriptWord).not.toHaveBeenCalled();
  expect(openLearnerTranscriptPdfPreview).not.toHaveBeenCalled();
  if (format === 'pdf') expect(previewTab.close).toHaveBeenCalled();
  expect(downloadDocumentFile).not.toHaveBeenCalled();
});
it('shows the API error without producing an empty transcript', async () => {
  await mount('learning');
  const reads = axios.get.getMockImplementation();
  axios.get.mockImplementation((url, options) => url.includes('/reports/learner-scorecard/') ? Promise.reject({ response: { data: { message: 'Không được xem bảng điểm của học viên này.' } } }) : reads(url, options));
  fireEvent.click(menu().getByRole('menuitem', { name: labels.pdf }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Không được xem bảng điểm của học viên này.'));
  expect(previewTab.close).toHaveBeenCalled();
  expect(downloadDocumentFile).not.toHaveBeenCalled();
});
it('reports a blocked preview without requesting or downloading a PDF', async () => {
  await mount('grades');
  reserveReportPreview.mockImplementationOnce(() => { throw new Error('Trình duyệt đã chặn tab xem trước.'); });
  fireEvent.click(menu().getByRole('menuitem', { name: labels.pdf }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Trình duyệt đã chặn tab xem trước.'));
  expect(axios.get.mock.calls.some(([url]) => url.includes('/reports/learner-scorecard/'))).toBe(false);
  expect(downloadDocumentFile).not.toHaveBeenCalled();
});
