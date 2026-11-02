import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Alert, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import AppDialog from '../../components/AppDialog';
import PopupFormField from '../../components/PopupFormField';
import { API_BASE_URL } from '../../config/http';
import { leaveDate, OfferingTable } from './StudyLeavePanel';
import { notify } from '../../utils/notify';

const errorMessage = error => {
  const value = error.response?.data?.message;
  return Array.isArray(value) ? value.join('. ') : value || 'Không thể xử lý bảo lưu. Vui lòng thử lại.';
};

export default function StudyLeaveDecisionDialog({ leave, action, onClose, onDecided }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const approving = action === 'approve';
  useEffect(() => {
    const controller = new AbortController();
    axios.get(`${API_BASE_URL}/plan/admission-records/${leave.admissionRecordId}/study-leaves`, {
      withCredentials: true, signal: controller.signal,
    }).then(({ data }) => { if (!controller.signal.aborted) setDetail(data); })
      .catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [leave.admissionRecordId]);
  const current = detail?.leaves?.find(item => item.id === leave.id);
  const invalid = loading || current?.status !== 'pending' || (!approving && !note.trim());
  const submit = async () => {
    if (submitting.current || invalid) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      await axios.post(`${API_BASE_URL}/plan/study-leaves/${leave.id}/actions`, { action, note }, { withCredentials: true });
    } catch (e) {
      notify.error(errorMessage(e)); submitting.current = false; setBusy(false);
      return;
    }
    onDecided();
  };
  return <AppDialog open title={approving ? 'Duyệt bảo lưu' : 'Từ chối bảo lưu'} onClose={onClose}
    onConfirm={submit} confirmText="Xác nhận" confirmColor={approving ? 'primary' : 'error'}
    confirmDisabled={invalid} saving={busy}>
    <Stack spacing={2}>
      <Typography fontWeight={600}>{leave.fullName} · {leave.code}</Typography>
      <Typography>{leaveDate(leave.startDate)} – {leaveDate(leave.endDate)}</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {loading ? <CircularProgress size={24} aria-label="Đang tải yêu cầu bảo lưu" /> : <>
        {detail && current?.status !== 'pending' && <Alert severity="warning">Yêu cầu đã được xử lý. Vui lòng tải lại danh sách.</Alert>}
        {current && <Typography variant="body2">Lý do: {current.reason}</Typography>}
        {approving && detail && <>
          <Alert severity="warning">Rút khỏi danh sách lớp ngay khi duyệt và ghi nhận Không đạt cho mọi học phần đã ghép lớp chưa hoàn thành, dù đã xếp lịch hay chưa. Trạng thái bảo lưu có hiệu lực từ {leaveDate(current?.startDate || leave.startDate)}; khi quay lại phải học từ đầu.</Alert>
          <OfferingTable rows={detail.affectedOfferings || []} />
        </>}
      </>}
      <PopupFormField label={approving ? 'Ghi chú quyết định' : 'Lý do / thông tin quyết định *'} htmlFor="study-leave-decision-note">
        <TextField id="study-leave-decision-note" fullWidth size="small" multiline minRows={3} required={!approving}
          disabled={busy} value={note} onChange={e => setNote(e.target.value)} inputProps={{ maxLength: 4000 }} />
      </PopupFormField>
    </Stack>
  </AppDialog>;
}
