import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Alert, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import AppDialog from '../../components/AppDialog';
import DateField from '../../components/DateField';
import PopupFormField from '../../components/PopupFormField';
import { API_BASE_URL } from '../../config/http';
import { addDays, formatDateKey, getBusinessTodayKey } from '../../utils/schedulingCalendar';
import { usePermissions } from '../accounts/usePermissions';
import { leaveDate } from './StudyLeavePanel';

const titles = {
  request_extension: 'Đề nghị gia hạn',
  approve_extension: 'Duyệt gia hạn',
  reject_extension: 'Từ chối gia hạn',
};
const errorMessage = error => {
  const value = error.response?.data?.message;
  return Array.isArray(value) ? value.join('. ') : value || 'Không thể xử lý gia hạn bảo lưu. Vui lòng thử lại.';
};

export default function StudyLeaveExtensionDialog({ leave, action, onClose, onCompleted }) {
  const { can } = usePermissions();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [endDate, setEndDate] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const requesting = action === 'request_extension';
  const approving = action === 'approve_extension';
  const permitted = can(requesting ? 'studyleave.request' : 'studyleave.approve');

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
  const pending = current?.extensions?.find(item => item.status === 'pending');
  const today = getBusinessTodayKey();
  const active = current?.status === 'approved' && current.startDate <= today;
  const stale = Boolean(detail) && (!active || (requesting ? Boolean(pending) : !pending));
  const expiredProposal = approving && pending?.endDate < today;
  const minEndDate = current ? [today, formatDateKey(addDays(current.endDate, 1))].sort().at(-1) : undefined;
  const invalid = !permitted || loading || !current || stale || expiredProposal
    || (!approving && !note.trim())
    || (requesting && (!endDate || endDate <= current.endDate || endDate < today));

  const submit = async () => {
    if (submitting.current || invalid) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      await axios.post(`${API_BASE_URL}/plan/study-leaves/${leave.id}/actions`, {
        action, note: note.trim(), ...(requesting ? { endDate } : {}),
      }, { withCredentials: true });
    } catch (e) {
      setError(errorMessage(e)); submitting.current = false; setBusy(false);
      return;
    }
    onCompleted();
  };

  return <AppDialog open title={titles[action]} onClose={onClose} onConfirm={submit}
    confirmText="Xác nhận" confirmColor={action === 'reject_extension' ? 'error' : 'primary'}
    confirmDisabled={invalid} saving={busy} maxWidth={requesting ? false : 'sm'}
    PaperProps={{ sx: requesting ? {
      width: { xs: 'calc(100vw - 2 * var(--app-dialog-gap, 24px))', md: '46vw' },
      maxWidth: 'calc(100vw - 2 * var(--app-dialog-gap, 24px))',
      height: '86dvh',
      '--app-dialog-max-height': '86dvh',
    } : {} }}>
    <Stack spacing={2}>
      <Typography fontWeight={600}>{leave.fullName} · {leave.code}</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {!permitted && <Alert severity="warning">Bạn không có quyền thực hiện thao tác này.</Alert>}
      {loading ? <CircularProgress size={24} aria-label="Đang tải thông tin gia hạn" /> : <>
        {stale && <Alert severity="warning">Đợt bảo lưu hoặc yêu cầu gia hạn đã thay đổi. Vui lòng đóng cửa sổ và tải lại danh sách.</Alert>}
        {current && <Typography>Hạn hiện tại: {leaveDate(current.endDate)}</Typography>}
        {pending && <>
          <Typography>Hạn đề nghị: {leaveDate(pending.endDate)}</Typography>
          <Typography sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>Lý do đề nghị: {pending.reason}</Typography>
        </>}
        {expiredProposal && <Alert severity="warning">Hạn đề nghị gia hạn đã qua. Cần từ chối yêu cầu cũ và tạo đề nghị mới.</Alert>}
        {requesting && current && <>
          <Alert severity="info">Hạn bảo lưu hiện tại được giữ nguyên cho đến khi đề nghị gia hạn được phê duyệt.</Alert>
          <PopupFormField label="Ngày kết thúc mới" htmlFor="study-leave-extension-end-date">
            <DateField id="study-leave-extension-end-date" fullWidth size="small" value={endDate}
              disabled={busy || stale} min={minEndDate} onChange={e => setEndDate(e.target.value)}
              helperText="Hạn mới phải sau hạn hiện tại và không trước hôm nay." />
          </PopupFormField>
        </>}
        <PopupFormField label={requesting ? 'Lý do đề nghị gia hạn *' : approving ? 'Ghi chú quyết định' : 'Lý do từ chối gia hạn *'} htmlFor="study-leave-extension-note">
          <TextField id="study-leave-extension-note" fullWidth size="small" multiline minRows={3}
            required={!approving} disabled={busy || stale} value={note} onChange={e => setNote(e.target.value)}
            inputProps={{ maxLength: 4000 }} />
        </PopupFormField>
      </>}
    </Stack>
  </AppDialog>;
}
