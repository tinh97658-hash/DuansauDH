import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Alert, FormControl, MenuItem, Select, Stack, TextField } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/http';
import { usePermissions } from '../accounts/usePermissions';
import useTrainingYears from '../../hooks/useTrainingYears';
import AdmissionRoundManager from './AdmissionRoundManager';
import AppDialog from '../../components/AppDialog';
import PopupFormField from '../../components/PopupFormField';

const options = { withCredentials: true };
export default function AdmissionRoundManagement() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [rounds, setRounds] = useState([]), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [form, setForm] = useState(null), [saving, setSaving] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const years = useTrainingYears(year, setYear);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/plan/admission-rounds`, options);
      setRounds(data.rows || []); setError('');
    } catch (err) { setError(err.response?.data?.message || 'Không tải được đợt xét tuyển.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const edit = round => {
    setError('');
    setForm(round ? { id: round.id, intakeRound: round.intakeRound ?? "", name: round.name, academicYear: round.academicYear, majorThresholds: round.majorThresholds || [],
      rules: round.rules, regulationNo: round.regulationNo || '', decisionNo: round.decisionNo || undefined, decisionDate: round.decisionDate || undefined }
      : { name: '', intakeRound: "", academicYear: year, majorThresholds: [] });
  };
  const save = async () => {
    setSaving(true); setError('');
    try {
      const { id, ...payload } = { ...form, intakeRound: Number(form.intakeRound) };
      if (id) await axios.put(`${API_BASE_URL}/plan/admission-rounds/${id}`, payload, options);
      else await axios.post(`${API_BASE_URL}/plan/admission-rounds`, payload, options);
      setForm(null); await load();
    } catch (err) { setError(err.response?.data?.message || 'Không thể lưu đợt xét tuyển.'); }
    finally { setSaving(false); }
  };
  const formYears = [...new Set([...years, form?.academicYear].filter(Boolean))];
  return <>
    <AdmissionRoundManager embedded rounds={rounds} admin={can('admission.manage')} loading={loading || saving} error={form ? '' : error}
      onRefresh={load} onCreate={() => edit(null)} onEdit={edit}
      onSelect={id => navigate(`/masters/admission-scores?roundId=${encodeURIComponent(id)}`)} />
    <AppDialog open={!!form} onClose={() => !saving && setForm(null)} maxWidth="xs"
      title={form?.id ? 'SỬA ĐỢT XÉT TUYỂN TOÀN VIỆN' : 'TẠO ĐỢT XÉT TUYỂN TOÀN VIỆN'}
      confirmText={form?.id ? 'Lưu thay đổi' : 'Lưu đợt xét tuyển'} cancelText="Hủy" onConfirm={save}
      confirmDisabled={saving || !form?.name?.trim() || !form?.academicYear || !Number.isInteger(Number(form?.intakeRound)) || Number(form?.intakeRound) < 1 || Number(form?.intakeRound) > 99} saving={saving}>
      {form && <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        <PopupFormField label="Số đợt" htmlFor="round-intake-number">
          <TextField id="round-intake-number" fullWidth type="number" size="small" value={form.intakeRound}
            inputProps={{ min: 1, max: 99, 'aria-label': 'Số đợt' }} disabled={saving}
            onChange={event => setForm({ ...form, intakeRound: event.target.value })}
            helperText="Cùng số đợt trong hồ sơ và mã lớp (VD 2026.1.1 là đợt 1). Có thể tạo nhiều đợt xét tuyển (chính thức, bổ sung) dùng chung một số đợt." />
        </PopupFormField>
        <PopupFormField label="Tên đợt xét tuyển" htmlFor="round-name">
          <TextField id="round-name" fullWidth size="small" value={form.name} inputProps={{ 'aria-label': 'Tên đợt xét tuyển' }}
            disabled={saving} onChange={event => setForm({ ...form, name: event.target.value })} />
        </PopupFormField>
        <PopupFormField label="Năm tuyển sinh" htmlFor="round-academic-year">
          <FormControl fullWidth size="small">
            <Select id="round-academic-year" value={form.academicYear} disabled={saving}
              inputProps={{ 'aria-label': 'Năm tuyển sinh' }}
              onChange={event => setForm({ ...form, academicYear: event.target.value })}>
              {formYears.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </Select>
          </FormControl>
        </PopupFormField>
        <Alert severity="info">Đợt áp dụng cho tất cả ngành thạc sĩ trong năm. Nhập điểm ngưỡng từng ngành tại Điểm xét tuyển thạc sĩ.</Alert>
      </Stack>}
    </AppDialog>
  </>;
}
