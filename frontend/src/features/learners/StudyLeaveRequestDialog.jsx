import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Alert, Autocomplete, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import AppDialog from '../../components/AppDialog';
import PopupFormField from '../../components/PopupFormField';
import DateField from '../../components/DateField';
import { API_BASE_URL } from '../../config/http';
import { notify } from '../../utils/notify';
import { formatDate } from '../../utils/dateFormat';
import { addDays, formatDateKey } from '../../utils/schedulingCalendar';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const message = error => {
  const value = error.response?.data?.message;
  return Array.isArray(value) ? value.join('. ') : value || 'Không thể tạo yêu cầu bảo lưu. Vui lòng thử lại.';
};

export default function StudyLeaveRequestDialog({ onClose, onCreated }) {
  const [code, setCode] = useState('');
  const [learner, setLearner] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [form, setForm] = useState({ startDate: today(), endDate: '', note: '' });

  useEffect(() => {
    if (learner || code.trim().length < 3) {
      setResults([]); setLoading(false); setLookupError('');
      return;
    }
    const controller = new AbortController();
    setLoading(true); setLookupError('');
    const timer = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/plan/study-leaves/learners`, {
          withCredentials: true, signal: controller.signal, params: { code: code.trim() },
        });
        if (!controller.signal.aborted) setResults(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!controller.signal.aborted) { setResults([]); setLookupError('Không thể tìm hồ sơ học viên. Vui lòng nhập lại mã.'); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 300);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [code, learner]);

  const invalidEnd = Boolean(form.startDate && form.endDate && form.endDate <= form.startDate);
  const invalid = !learner || !form.note.trim() || !form.startDate || form.startDate < today()
    || !form.endDate || form.endDate <= form.startDate;
  const submit = async () => {
    if (submitting.current || invalid) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      await axios.post(`${API_BASE_URL}/plan/admission-records/${learner.id}/study-leaves`, {
        reason: form.note, startDate: form.startDate, endDate: form.endDate,
      }, { withCredentials: true });
    } catch (e) {
      notify.error(message(e)); submitting.current = false; setBusy(false);
      return;
    }
    onCreated(learner);
  };

  return <AppDialog open title="Tạo yêu cầu bảo lưu" onClose={onClose} onConfirm={submit}
    confirmText="Xác nhận" confirmDisabled={invalid} saving={busy}>
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      <PopupFormField label="Mã học viên *" htmlFor="study-leave-learner-code">
      <Autocomplete id="study-leave-learner-code" fullWidth size="small"
        sx={{ '& .MuiOutlinedInput-root': { padding: '0 !important', paddingRight: '64px !important' } }}
        options={results} value={learner} inputValue={code} disabled={busy} loading={loading}
        filterOptions={options => options} isOptionEqualToValue={(option, value) => option.id === value.id}
        getOptionLabel={option => option.code || ''}
        onInputChange={(_, value, reason) => {
          if (reason === 'input' || reason === 'clear') {
            setCode(value); setLearner(null); setResults([]); setLookupError('');
          }
        }}
        onChange={(_, value) => { setLearner(value); setCode(value?.code || ''); setError(''); }}
        noOptionsText={code.trim().length < 3 ? 'Nhập ít nhất 3 ký tự của mã học viên.' : 'Không tìm thấy học viên đang học đủ điều kiện bảo lưu.'}
        loadingText="Đang tìm hồ sơ…"
        renderOption={(props, option) => <li {...props} key={option.id}><Stack>
          <Typography variant="body2" fontWeight={600}>{option.code} — {option.fullName}</Typography>
          <Typography variant="caption">{[option.dob && formatDate(option.dob), option.majorName, option.academicYear].filter(Boolean).join(' · ')}</Typography>
        </Stack></li>}
        renderInput={params => <TextField {...params} required size="small"
          placeholder="Nhập mã học viên để tìm hồ sơ" error={Boolean(lookupError)}
          helperText={lookupError || 'Nhập mã và chọn hồ sơ trong danh sách gợi ý. Chỉ chọn học viên đang học, đã nộp học phí và chưa có yêu cầu đang xử lý.'}
          InputProps={{ ...params.InputProps, endAdornment: <>{loading && <CircularProgress size={18} />}{params.InputProps.endAdornment}</> }} />}
      />
      </PopupFormField>
      {learner && <Alert severity="info"><strong>{learner.fullName}</strong> · {learner.code}
        {learner.majorName && <Typography variant="body2">{learner.majorName}{learner.academicYear ? ` · ${learner.academicYear}` : ''}</Typography>}
      </Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <PopupFormField label="Ngày bắt đầu bảo lưu" htmlFor="study-leave-start-date">
          <DateField id="study-leave-start-date" fullWidth size="small" value={form.startDate} disabled={busy}
            onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} inputProps={{ min: today() }} />
        </PopupFormField>
        <PopupFormField label="Ngày kết thúc bảo lưu" htmlFor="study-leave-end-date">
          <DateField id="study-leave-end-date" fullWidth size="small" value={form.endDate} disabled={busy}
            min={form.startDate ? formatDateKey(addDays(form.startDate, 1)) : undefined} error={invalidEnd}
            helperText="Ngày kết thúc phải sau ngày bắt đầu bảo lưu ít nhất 1 ngày."
            onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} />
        </PopupFormField>
      </Stack>
      <PopupFormField label="Lý do / thông tin quyết định *" htmlFor="study-leave-note">
        <TextField id="study-leave-note" fullWidth size="small" required multiline minRows={3} disabled={busy}
          value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} inputProps={{ maxLength: 4000 }} />
      </PopupFormField>
    </Stack>
  </AppDialog>;
}
