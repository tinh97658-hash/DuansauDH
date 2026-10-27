import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Alert, Button, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material';
import AppDialog from '../../components/AppDialog';
import { API_BASE_URL } from '../../config/http';
import { usePermissions } from './usePermissions';

export function ResponsibleStaffSelect({ value, onChange, disabled = false }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    axios.get(`${API_BASE_URL}/groups/assignees`, { withCredentials: true })
      .then(({ data }) => { if (active) setStaff(data); })
      .catch(() => { if (active) setError('Không tải được danh sách chuyên viên. Hãy đóng và mở lại hộp thoại để thử lại.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <Stack spacing={1}>
    {error && <Alert severity="error">{error}</Alert>}
    <FormControl fullWidth size="small" required>
      <InputLabel id="responsible-staff-label">Chuyên viên phụ trách</InputLabel>
      <Select labelId="responsible-staff-label" label="Chuyên viên phụ trách" value={value || ''}
        disabled={disabled || loading || Boolean(error)} onChange={event => onChange(event.target.value)}>
        {staff.map(person => <MenuItem key={person.id} value={person.id}>{person.name} — {person.email}</MenuItem>)}
      </Select>
    </FormControl>
  </Stack>;
}

export default function GroupResponsibleStaff({ group, onSaved }) {
  const { can, access } = usePermissions();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const canAssign = can('groups.assign') && !access?.groupScope?.readOnly && group.canEdit !== false;
  const save = async () => {
    if (!value || saving) return;
    setSaving(true); setError('');
    try {
      await axios.put(`${API_BASE_URL}/groups/${group.id}/responsible-staff`, { responsibleStaffId: value }, { withCredentials: true });
      setOpen(false);
      await onSaved?.();
    } catch (failure) { setError(failure.response?.data?.message || 'Không thể phân công chuyên viên.'); }
    finally { setSaving(false); }
  };
  return <>
    <Typography variant="body2">{group.responsibleStaff?.name || 'Chưa phân công'}</Typography>
    {group.responsibleStaff?.status === 'disabled' && <Typography variant="caption" color="error">Tài khoản đã khóa — cần phân công lại</Typography>}
    {canAssign && !group.responsibleStaffId && <Button size="small" onClick={event => { event.stopPropagation(); setValue(group.responsibleStaffId || ''); setError(''); setOpen(true); }}>
      Phân công
    </Button>}
    {open && <AppDialog open title="PHÂN CÔNG CHUYÊN VIÊN PHỤ TRÁCH" onClose={saving ? undefined : () => setOpen(false)}
      onConfirm={save} confirmText="Lưu phân công" saving={saving} maxWidth="sm">
      <Stack spacing={2}>
        <Typography>Nhóm: {group.code || group.name}</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <ResponsibleStaffSelect value={value} onChange={setValue} disabled={saving} />
        <Typography variant="caption">Mỗi nhóm có một chuyên viên. Một chuyên viên có thể phụ trách nhiều nhóm. Việc phân công không tự cấp thêm quyền xem hoặc sửa.</Typography>
      </Stack>
    </AppDialog>}
  </>;
}
