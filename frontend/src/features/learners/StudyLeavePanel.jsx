import DateField from "../../components/DateField";
import { formatDate, formatDateTime } from "../../utils/dateFormat";
import { addDays, formatDateKey } from "../../utils/schedulingCalendar";
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Alert, Box, Button, Chip, CircularProgress, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import AppDialog from '../../components/AppDialog';
import PopupFormField from '../../components/PopupFormField';
import { API_BASE_URL } from '../../config/http';

export const leaveStatusLabels = {
  pending: 'Chờ duyệt', scheduled: 'Đã duyệt — chưa đến hạn', active: 'Đang bảo lưu', expiring: 'Sắp hết hạn',
  overdue: 'Bảo lưu quá hạn', rejected: 'Đã từ chối', resumed: 'Đã tiếp nhận học lại', withdrawn: 'Đã thôi học',
};
const actionLabels = { requested: 'Tạo yêu cầu', approve: 'Duyệt bảo lưu', reject: 'Từ chối bảo lưu',
  roster_withdrawn: 'Rút khỏi danh sách lớp', activated: 'Bảo lưu có hiệu lực', request_extension: 'Đề nghị gia hạn', approve_extension: 'Duyệt gia hạn',
  reject_extension: 'Từ chối gia hạn', resume: 'Tiếp nhận học lại', withdraw: 'Xác nhận thôi học' };
const options = { withCredentials: true };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const leaveDate = formatDate;
const errorMessage = error => {
  const message = error.response?.data?.message;
  return Array.isArray(message) ? message.join('. ') : message || 'Không thể xử lý bảo lưu. Vui lòng thử lại.';
};

function OfferingTable({ rows, history = false }) {
  return <Box sx={{ overflowX: 'auto' }}><Table size="small" aria-label={history ? 'Lịch sử dừng học phần' : 'Học phần dự kiến dừng'}>
    <TableHead><TableRow><TableCell>Học phần</TableCell><TableCell>Lớp</TableCell><TableCell>Xử lý</TableCell>{history && <TableCell>Điểm cũ để tra cứu</TableCell>}</TableRow></TableHead>
    <TableBody>{rows.map((item, index) => {
      const row = item.snapshot || item;
      return <TableRow key={`${row.courseOfferingId}-${index}`}><TableCell>{row.subjectName}</TableCell>
        <TableCell>{row.offeringName || row.classCode || '—'}</TableCell>
        <TableCell>{row.notEnrolled ? 'Chưa tham gia lớp học phần' : 'Không đạt do bảo lưu; học lại từ đầu khi trở lại'}</TableCell>
        {history && <TableCell>{row.grades?.length ? row.grades.map((grade, gradeIndex) => <Typography variant="body2" key={gradeIndex}>
          Kiểm tra: {grade.testScore ?? '—'} · Bài tập: {grade.assignmentScore ?? '—'} · Thi: {grade.examScore ?? '—'} · Tổng: {grade.courseScore ?? '—'}
        </Typography>) : 'Chưa có điểm'}</TableCell>}</TableRow>;
    })}{!rows.length && <TableRow><TableCell colSpan={history ? 4 : 3}>Không có lớp học phần cần dừng.</TableCell></TableRow>}</TableBody>
  </Table></Box>;
}

export default function StudyLeavePanel({ record, isAdmin = false, disabled = false, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({ note: '', startDate: today(), endDate: '' });
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = await axios.get(`${API_BASE_URL}/plan/admission-records/${record.id}/study-leaves`, options); setData(response.data); }
    catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, [record.id]);
  useEffect(() => { load(); }, [load]);
  const open = (action, leave) => {
    setError(''); setSuccess(''); setForm({ note: '', startDate: today(), endDate: '' }); setDialog({ action, leave });
  };
  const submit = async () => {
    if (busy || disabled || invalid) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      const response = dialog.action === 'request'
        ? await axios.post(`${API_BASE_URL}/plan/admission-records/${record.id}/study-leaves`, { reason: form.note, startDate: form.startDate, endDate: form.endDate }, options)
        : await axios.post(`${API_BASE_URL}/plan/study-leaves/${dialog.leave.id}/actions`, { action: dialog.action, note: form.note,
          ...(dialog.action === 'request_extension' ? { endDate: form.endDate } : {}) }, options);
      setData(response.data); setDialog(null); setSuccess('Đã lưu xử lý bảo lưu.');
      await onChanged?.();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const openLeave = data?.leaves?.find(leave => ['pending', 'approved'].includes(leave.status));
  const needsNote = dialog && !['approve', 'approve_extension'].includes(dialog.action);
  const needsEnd = dialog && ['request', 'request_extension'].includes(dialog.action);
  const minEndDate = dialog?.action === 'request'
    ? (form.startDate ? formatDateKey(addDays(form.startDate, 1)) : undefined)
    : dialog?.action === 'request_extension'
      ? [today(), formatDateKey(addDays(dialog.leave.endDate, 1))].sort().at(-1) : undefined;
  const invalidEndDate = Boolean(dialog?.action === 'request' && form.startDate && form.endDate && form.endDate <= form.startDate);
  const invalid = !dialog || (needsNote && !form.note.trim()) || (needsEnd && !form.endDate)
    || (dialog?.action === 'request' && (!form.startDate || form.startDate < today() || form.endDate <= form.startDate))
    || (dialog?.action === 'request_extension' && (form.endDate <= dialog.leave.endDate || form.endDate < today()));
  return <Stack spacing={2}>
    <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6">Bảo lưu và tiếp nhận học lại</Typography>
      {isAdmin && record.studyStatus === 'Đang học' && !openLeave && data && <Button variant="contained" disabled={disabled || busy} onClick={() => open('request')}>Tạo yêu cầu bảo lưu</Button>}
    </Stack>
    <Alert severity="info">Duyệt bảo lưu sẽ rút học viên khỏi các lớp học phần chưa hoàn thành ngay và ghi nhận Không đạt cho mọi học phần đã ghép lớp, dù đã xếp lịch hay chưa. Giữ lớp hành chính và kết quả môn đã hoàn thành.</Alert>
    {disabled && <Alert severity="warning">Lưu hoặc hủy thay đổi hồ sơ trước khi xử lý bảo lưu.</Alert>}
    {error && !dialog && <Alert severity="error" action={<Button onClick={load} disabled={loading || busy}>Thử lại</Button>}>{error}</Alert>}{success && <Alert severity="success">{success}</Alert>}
    {loading ? <CircularProgress size={24} aria-label="Đang tải bảo lưu" /> : data?.leaves?.length ? data.leaves.map(leave => {
      const pendingExtension = leave.extensions?.find(item => item.status === 'pending');
      const active = leave.status === 'approved' && leave.effectiveStatus !== 'scheduled';
      return <Box key={leave.id} sx={{ bgcolor: 'white', border: '1px solid #DFE4E8', borderRadius: 1, p: 2 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap"><Chip size="small" color={leave.effectiveStatus === 'overdue' ? 'error' : 'default'} label={leaveStatusLabels[leave.effectiveStatus] || leave.status} />
            <Typography fontWeight={600}>{leaveDate(leave.startDate)} – {leaveDate(leave.endDate)}</Typography></Stack>
          <Typography variant="body2">Lý do: {leave.reason}</Typography>
          {leave.closedDate && <Typography variant="body2">Ngày kết thúc xử lý: {leaveDate(leave.closedDate)}</Typography>}
          {pendingExtension && <Alert severity="warning">Có yêu cầu gia hạn đến {leaveDate(pendingExtension.endDate)} đang chờ duyệt. Hạn hiện tại vẫn là {leaveDate(leave.endDate)}. Lý do: {pendingExtension.reason}</Alert>}
          {isAdmin && <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 1 }}>
            {leave.status === 'pending' && <><Button variant="contained" disabled={disabled || busy} onClick={() => open('approve', leave)}>Duyệt bảo lưu</Button><Button color="error" disabled={disabled || busy} onClick={() => open('reject', leave)}>Từ chối</Button></>}
            {active && <><Button variant="contained" disabled={disabled || busy} onClick={() => open('resume', leave)}>Tiếp nhận học lại</Button>
              {!pendingExtension && <Button variant="outlined" disabled={disabled || busy} onClick={() => open('request_extension', leave)}>Đề nghị gia hạn</Button>}
              {pendingExtension && <><Button variant="outlined" disabled={disabled || busy} onClick={() => open('approve_extension', leave)}>Duyệt gia hạn</Button><Button disabled={disabled || busy} onClick={() => open('reject_extension', leave)}>Từ chối gia hạn</Button></>}
              <Button color="error" disabled={disabled || busy} onClick={() => open('withdraw', leave)}>Xác nhận thôi học</Button></>}
          </Stack>}
          {leave.effectiveStatus === 'scheduled' && <Alert severity="info">Đã rút khỏi danh sách lớp ngay khi duyệt và không ghép lớp mới. Trạng thái bảo lưu có hiệu lực từ ngày {leaveDate(leave.startDate)}.</Alert>}
          {leave.effectiveStatus === 'overdue' && <Alert severity="error">Đã quá hạn bảo lưu. Cần quyết định gia hạn, tiếp nhận học lại hoặc thôi học. Học viên chưa được đưa vào danh sách chờ ghép lớp.</Alert>}
          {leave.effectiveStatus === 'resumed' && <Alert severity="success">Đã tiếp nhận học lại. Các môn đã dừng được đưa vào nhóm cần bố trí học để ghép lớp mới và học từ đầu.</Alert>}
          {!!leave.withdrawals?.length && <OfferingTable rows={leave.withdrawals} history />}
          {leave.status === 'pending' && <><Typography variant="subtitle2">Các lớp dự kiến dừng khi duyệt bảo lưu</Typography><OfferingTable rows={data.affectedOfferings || []} /></>}
          <Divider /><Typography variant="subtitle2">Lịch sử xử lý</Typography>
          {leave.history?.map((event, index) => <Typography variant="body2" key={index}>
            {formatDateTime(event.at)} · {actionLabels[event.action] || event.action} · {event.actor}
            {event.endDate ? ` · Hạn: ${leaveDate(event.endDate)}` : ''}{event.note ? ` · ${event.note}` : ''}
          </Typography>)}
        </Stack>
      </Box>;
    }) : data && <Typography color="text.secondary">Học viên chưa có yêu cầu bảo lưu.</Typography>}
    <AppDialog open={Boolean(dialog)} onClose={() => { if (!busy) { setDialog(null); setError(''); } }}
      title={dialog?.action === 'request' ? 'Tạo yêu cầu bảo lưu' : actionLabels[dialog?.action] || ''}
      onConfirm={submit} confirmText="Xác nhận" confirmDisabled={invalid || disabled} saving={busy}
      confirmColor={dialog?.action === 'withdraw' ? 'error' : 'primary'}>
      <Stack spacing={2}>{error && <Alert severity="error">{error}</Alert>}
        {needsEnd && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          {dialog?.action === 'request' && <PopupFormField label="Ngày bắt đầu bảo lưu" htmlFor="study-leave-start-date">
            <DateField id="study-leave-start-date" fullWidth size="small" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} inputProps={{ min: today() }} />
          </PopupFormField>}
          <PopupFormField label={dialog?.action === 'request' ? 'Ngày kết thúc bảo lưu' : 'Ngày kết thúc mới'} htmlFor="study-leave-end-date">
            <DateField id="study-leave-end-date" fullWidth size="small" value={form.endDate}
              min={minEndDate} error={invalidEndDate}
              helperText={dialog?.action === 'request' ? 'Ngày kết thúc phải sau ngày bắt đầu bảo lưu ít nhất 1 ngày.' : 'Hạn mới phải sau hạn bảo lưu hiện tại.'}
              onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} />
          </PopupFormField>
        </Stack>}
        {dialog?.action === 'approve' && <><Alert severity="warning">Rút khỏi danh sách lớp ngay khi duyệt và ghi nhận Không đạt cho mọi học phần đã ghép lớp chưa hoàn thành, dù đã xếp lịch hay chưa. Trạng thái bảo lưu có hiệu lực từ {leaveDate(dialog.leave.startDate)}; khi quay lại phải học từ đầu.</Alert><OfferingTable rows={data?.affectedOfferings || []} /></>}
        {dialog?.action === 'resume' && <Alert severity="info">Tiếp nhận học lại từ hôm nay. Học viên sẽ chờ ghép lớp mới cho các môn đã dừng; các điểm cũ không chuyển sang lần học mới.</Alert>}
        {dialog?.action === 'withdraw' && <Alert severity="warning">Xác nhận quyết định thôi học từ hôm nay. Hồ sơ, lớp hành chính và lịch sử học vẫn được giữ.</Alert>}
        {dialog?.action === 'approve_extension' && <Alert severity="info">Gia hạn đến {leaveDate(dialog.leave.extensions?.find(item => item.status === 'pending')?.endDate)}.</Alert>}
        <PopupFormField label={needsNote ? 'Lý do / thông tin quyết định *' : 'Ghi chú quyết định'} htmlFor="study-leave-note">
          <TextField id="study-leave-note" fullWidth size="small" required={needsNote} multiline minRows={3} value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} inputProps={{ maxLength: 4000 }} />
        </PopupFormField>
      </Stack>
    </AppDialog>
  </Stack>;
}
