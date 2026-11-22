import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Checkbox, Chip, FormControl, MenuItem, Paper, Select, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AppDialog from '../../components/AppDialog';
import FeatureLayout from '../../components/FeatureLayout';
import FilterSelectField from '../../components/FilterSelectField';
import PopupFormField from '../../components/PopupFormField';
import { API_BASE_URL } from '../../config/http';
import { usePermissions } from '../accounts/usePermissions';
import { AuthSessionContext, useAuthSession } from '../../context/AuthSession';

const root = `${API_BASE_URL}/learner-codes`;

const cardSx = {
  p: 2,
  mb: 2,
  bgcolor: '#FFFFFF',
  borderColor: '#C6D5E1',
  borderRadius: '10px',
  boxShadow: '0 2px 6px rgba(18, 59, 98, 0.07)',
};
const outlineBtnSx = {
  minHeight: 38,
  px: 1.75,
  borderRadius: '7px',
  textTransform: 'none',
  fontWeight: 600,
  borderColor: '#B9CBD8',
  color: '#173E75',
  bgcolor: '#FFFFFF',
  '&:hover': { borderColor: '#0788B8', bgcolor: '#F1F7FB' },
};
const actionBtnSx = {
  borderRadius: '6px',
  textTransform: 'none',
  fontWeight: 600,
  borderColor: '#B9CBD8',
  color: '#173E75',
  bgcolor: '#FFFFFF',
  '&:hover': { borderColor: '#0788B8', bgcolor: '#F1F7FB' },
};
const primaryBtnSx = {
  minHeight: 36,
  px: 2,
  bgcolor: '#0788B8',
  borderRadius: '6px',
  boxShadow: 'none',
  textTransform: 'none',
  fontWeight: 700,
  '&:hover': { bgcolor: '#056A8F', boxShadow: 'none' },
};

const filterFieldBoxSx = { display: 'grid', gap: '6px', minWidth: 0, m: 0 };
const filterFieldLabelSx = {
  color: '#526A82',
  fontSize: '10.5px',
  fontWeight: 700,
  letterSpacing: '.025em',
  lineHeight: 1.2,
  textTransform: 'uppercase',
};
const filterTextSx = {
  width: '100%',
  '& .MuiOutlinedInput-root': {
    height: 38,
    bgcolor: '#fff',
    borderRadius: '7px',
    color: '#12263F',
    fontSize: 12,
    transition: 'border-color .15s ease, box-shadow .15s ease',
    '& fieldset': { borderColor: '#B9CBD8' },
    '&:hover fieldset': { borderColor: '#9FB5C6' },
    '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(11,127,163,.13)' },
    '&.Mui-focused fieldset': { borderColor: '#0B7FA3', borderWidth: 1 },
    '&.Mui-disabled': { bgcolor: '#F8FAFC' },
  },
  '& .MuiInputBase-input': { py: 0 },
};

const stateChip = {
  legacy: { label: 'Mã cũ — chưa đối soát', color: 'warning' },
  provisional: { label: 'Mã tiếp nhận', color: 'default' },
  official: { label: 'Chính thức', color: 'success' },
};

export default function LearnerCodeIssue({ embedded = false, onBusyChange }) {
  const session = useAuthSession();
  // The embedded panel retains the existing code-specific route action grants.
  return <AuthSessionContext.Provider value={embedded ? { ...session, currentPath: '/plan/learner-codes' } : session}>
    <IssueContent key={`${session?.user?.id}:${session?.activeProfile?.id}`} embedded={embedded} onBusyChange={onBusyChange} />
  </AuthSessionContext.Provider>;
}
const EmbeddedLayout = ({ children }) => <>{children}</>;

function IssueContent({ embedded, onBusyChange }) {
  const { can } = usePermissions();
  const [params] = useSearchParams();
  const [options, setOptions] = useState({ types: [], groups: [] });
  const [group, setGroup] = useState(params.get('classGroupId') || '');
  const [records, setRecords] = useState([]);
  const [selected, setSelected] = useState([]);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState('name');
  const [manual, setManual] = useState('');
  const [edit, setEdit] = useState(null);
  const [history, setHistory] = useState(null);
  const requestId = useRef(null);
  const generation = useRef(0);
  const Layout = embedded ? EmbeddedLayout : FeatureLayout;

  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  const one = records.find(r => r.id === selected[0]);
  const clear = () => { setPreview(null); requestId.current = null; };

  useEffect(() => {
    const c = new AbortController();
    axios.get(`${root}/options`, { signal: c.signal, params: { recordId: params.get('recordId') || undefined } }).then(({ data }) => {
      setOptions(data);
      if (!group && data.requestedRecord && !data.defaultGroupId) {
        setRecords([data.requestedRecord]);
        setSelected([data.requestedRecord.id]);
      } else if (!group && data.groups.length) {
        setGroup(data.defaultGroupId || data.groups[0].id);
      }
    }).catch(e => {
      if (e.code !== 'ERR_CANCELED') setError(e.response?.data?.message || 'Không thể tải danh sách lớp.');
    });
    return () => c.abort();
  }, []);

  const load = async (refreshId) => {
    if (!group) {
      const recordId = refreshId || options.requestedRecord?.id || params.get('recordId');
      if (!recordId) return;
      const current = ++generation.current;
      try {
        const { data } = await axios.get(`${root}/records/${recordId}`);
        if (current !== generation.current) return;
        setOptions(previous => ({ ...previous, requestedRecord: data }));
        setRecords([data]);
        setSelected([data.id]);
      } catch (e) {
        if (current === generation.current) {
          setRecords([]);
          setSelected([]);
          setOptions(previous => ({ ...previous, requestedRecord: undefined }));
          setError(e.response?.data?.message || 'Đã lưu nhưng chưa tải lại được hồ sơ. Vui lòng tải lại trang.');
        }
      }
      return;
    }
    const current = ++generation.current;
    try {
      const { data } = await axios.get(`${root}/class/${group}/records`);
      if (current !== generation.current) return;
      setRecords(data);
      setSelected(data.some(r => r.id === params.get('recordId')) ? [params.get('recordId')] : []);
    } catch (e) {
      if (current === generation.current) setError(e.response?.data?.message || 'Không thể tải hồ sơ.');
    }
  };

  useEffect(() => {
    setRecords([]);
    setSelected([]);
    clear();
    if (!group && options.requestedRecord) {
      setRecords([options.requestedRecord]);
      setSelected([options.requestedRecord.id]);
    } else load();
    return () => { generation.current++; };
  }, [group]);

  const input = () => ({ classGroupId: group, recordIds: selected, order, manual: manual || undefined });
  const run = async work => {
    setBusy(true);
    setError('');
    setMessage('');
    try { await work(); }
    catch (e) { setError(e.response?.data?.message || 'Không thể thực hiện.'); if (e.response?.status === 409) clear(); }
    finally { setBusy(false); }
  };

  const showPreview = () => run(async () => {
    const { data } = await axios.get(`${root}/preview`, { params: { ...input(), recordIds: selected.join(',') } });
    setPreview(data);
    requestId.current = crypto.randomUUID();
  });
  const issue = () => run(async () => {
    await axios.post(`${root}/issue`, { ...input(), fingerprint: preview.fingerprint, requestId: requestId.current });
    clear();
    setMessage('Đã cấp mã. Các bộ đếm được cập nhật riêng theo từng loại hồ sơ.');
    await load();
  });
  const showRecordAction = kind => run(async () => {
    const { data } = await axios.get(`${root}/records/${one.id}`);
    setEdit({ kind, ...data, typeId: data.learner_code_type_id || '', reason: '', newCode: '', requestId: crypto.randomUUID() });
  });
  const saveAction = () => run(async () => {
    const savedId = edit.id;
    if (edit.kind === 'type') await axios.put(`${root}/records/${edit.id}/type`, { typeId: edit.typeId, reason: edit.reason });
    else await axios.post(`${root}/records/${edit.id}/reissue`, { code: edit.newCode.toUpperCase().trim(), reason: edit.reason, fingerprint: edit.fingerprint, requestId: edit.requestId });
    setEdit(null);
    clear();
    setMessage('Đã cập nhật và ghi lịch sử.');
    await load(savedId);
  });
  const toggle = id => { clear(); setSelected(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]); };

  const selectableUnissued = records.filter(r => r.learner_code_state !== 'official');

  return <Layout title="Cấp mã học viên" group="Thủ tục đầu vào" desc="Cấp mã học viên chính thức sau khi xác nhận trúng tuyển; xem trước theo tên với bộ đếm riêng cho từng loại hồ sơ.">
    {error && !edit && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}

    <Paper variant="outlined" sx={cardSx}>
      <Stack gap={2}>
        <Stack className="app-filter-toolbar" direction="row" gap={1.5} alignItems="flex-end" flexWrap="wrap">
          <FilterSelectField
            label="Lớp hành chính"
            value={group}
            disabled={busy}
            onChange={e => setGroup(e.target.value)}
            sx={{ flex: '2 1 280px', minWidth: 240 }}
          >
            {options.requestedRecord && !options.defaultGroupId && <MenuItem value="">Hồ sơ chưa có một lớp hành chính chính phù hợp</MenuItem>}
            {options.groups.map(g => <MenuItem key={g.id} value={g.id}>{g.code} · {g.name} · {g.academic_year}</MenuItem>)}
          </FilterSelectField>
          <FilterSelectField
            label="Thứ tự cấp"
            value={order}
            disabled={busy}
            onChange={e => { setOrder(e.target.value); clear(); }}
            sx={{ flex: '1 1 220px', minWidth: 210 }}
          >
            <MenuItem value="name">Theo tên A–Z, sau đó họ đệm</MenuItem>
            <MenuItem value="selected">Theo thứ tự chọn hồ sơ</MenuItem>
          </FilterSelectField>
          <Box component="label" sx={{ ...filterFieldBoxSx, flex: '1 1 210px', minWidth: 200 }}>
            <Box component="span" sx={filterFieldLabelSx}>Phần nhập tay (nếu mẫu yêu cầu)</Box>
            <TextField
              size="small"
              name="learner-code-manual-segment"
              value={manual}
              disabled={busy}
              inputProps={{ 'aria-label': 'Phần nhập tay (nếu mẫu yêu cầu)', autoComplete: 'off' }}
              onChange={e => { setManual(e.target.value.toUpperCase()); clear(); }}
              sx={filterTextSx}
            />
          </Box>
          {can('learnercode.preview') && (
            <Button variant="outlined" disabled={busy || !group || !selected.length || selected.length > 100} sx={outlineBtnSx} onClick={showPreview}>
              Xem trước {selected.length} hồ sơ
            </Button>
          )}
        </Stack>

        <Alert severity="info">
          <Box component="span" sx={{ fontWeight: 700 }}>Lưu ý: </Box>
          Loại hồ sơ được đồng bộ trực tiếp từ Phân loại hồ sơ và cần xác nhận trúng tuyển trước khi cấp mã (trừ loại tắt yêu cầu này). Hồ sơ cũ giữ nguyên mã cho đến khi bạn chủ động cấp mã chính thức. Mỗi lô tối đa 100 hồ sơ.
        </Alert>

        {selected.length === 1 && (
          <Stack direction="row" gap={1} flexWrap="wrap">
            {((one?.learner_code_state === 'official' && can('learnercode.type.change')) || (one?.learner_code_state !== 'official' && can('learnercode.type.assign'))) && (
              <Button variant="outlined" size="small" sx={actionBtnSx} disabled={busy} onClick={() => showRecordAction('type')}>Gán/đổi loại hồ sơ</Button>
            )}
            {one?.learner_code_state === 'official' && can('learnercode.reissue') && (
              <Button variant="outlined" size="small" sx={actionBtnSx} disabled={busy} onClick={() => showRecordAction('reissue')}>Đổi mã đã cấp</Button>
            )}
            {can('learnercode.history.view') && (
              <Button variant="outlined" size="small" sx={actionBtnSx} disabled={busy} onClick={() => run(async () => setHistory((await axios.get(`${root}/records/${one.id}/history`)).data))}>Lịch sử mã</Button>
            )}
          </Stack>
        )}
      </Stack>
    </Paper>

    <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
      <Table size="small" aria-label="Danh sách hồ sơ cấp mã">
        <TableHead><TableRow>
          <TableCell align="center" sx={{ width: 48 }}>
            <Checkbox
              size="small"
              inputProps={{ 'aria-label': 'Chọn hồ sơ chưa có mã chính thức' }}
              disabled={busy}
              checked={!!records.length && selectableUnissued.length > 0 && selectableUnissued.every(r => selected.includes(r.id))}
              onChange={e => { clear(); setSelected(e.target.checked ? selectableUnissued.slice(0, 100).map(r => r.id) : []); }}
            />
          </TableCell>
          {['Mã hiện tại', 'Họ tên', 'Loại hồ sơ', 'Trạng thái mã'].map(h => <TableCell key={h}>{h}</TableCell>)}
        </TableRow></TableHead>
        <TableBody>
          {records.map(r => {
            const chip = stateChip[r.learner_code_state] || { label: r.learner_code_state, color: 'default' };
            const resolvedType = options.types?.find(t => t.id === r.learner_code_type_id);
            const typeName = r.type_name || resolvedType?.name || '';
            const typeActive = r.type_active ?? resolvedType?.active;
            const usesSpecial = r.uses_special_code ?? resolvedType?.uses_special_code ?? Boolean(r.letter || resolvedType?.letter);
            const typeLetter = r.letter ?? resolvedType?.letter;
            const categoryDiffers = Boolean(r.profile_category && r.profile_category !== typeName);
            return <TableRow key={r.id} hover selected={selected.includes(r.id)}>
              <TableCell align="center"><Checkbox size="small" inputProps={{ 'aria-label': `Chọn ${r.full_name}` }} disabled={busy} checked={selected.includes(r.id)} onChange={() => toggle(r.id)} /></TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{r.code}</TableCell>
              <TableCell>{r.full_name}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                  <span>{typeName || 'Chưa phân loại'}</span>
                  {usesSpecial && typeLetter && (
                    <Chip size="small" label={typeLetter} color="primary" variant="outlined" sx={{ fontWeight: 700, height: 20 }} />
                  )}
                  {typeName && typeActive === false && (
                    <Chip size="small" label="Chưa kích hoạt" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                  )}
                </Stack>
                {categoryDiffers && (
                  <Typography variant="caption" display="block" color="text.secondary">
                    Phân loại gốc: {r.profile_category}
                  </Typography>
                )}
              </TableCell>
              <TableCell><Chip size="small" label={chip.label} color={chip.color} variant={chip.color === 'default' ? 'outlined' : 'filled'} /></TableCell>
            </TableRow>;
          })}
          {!records.length && <TableRow><TableCell colSpan={5} align="center" sx={{ color: 'text.secondary' }}>Chưa có hồ sơ trong lớp được chọn.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </TableContainer>

    <AppDialog
      open={!!preview}
      maxWidth="md"
      onClose={() => !busy && clear()}
      title="XEM TRƯỚC CẤP MÃ"
      actions={<>
        <Button variant="outlined" disabled={busy} onClick={clear} sx={outlineBtnSx}>Đóng</Button>
        {can('learnercode.issue') && <Button variant="contained" disabled={busy} onClick={issue} sx={primaryBtnSx}>Xác nhận cấp mã</Button>}
      </>}
    >
      <Stack spacing={1.5}>
        <Alert severity="info">Bản xem trước chưa giữ chỗ mã. Hệ thống kiểm tra lại trước khi xác nhận; mã của các học viên khác được giữ nguyên.</Alert>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Bảng xem trước cấp mã">
            <TableHead><TableRow>{['STT', 'Họ tên', 'Loại', 'Mã cũ', 'Mã chính thức dự kiến'].map(h => <TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {preview?.rows.map((r, i) => <TableRow key={r.id} hover>
                <TableCell align="center" sx={{ width: 56 }}>{i + 1}</TableCell>
                <TableCell>{r.fullName}</TableCell>
                <TableCell>{r.typeName}</TableCell>
                <TableCell>{r.oldCode}</TableCell>
                <TableCell><strong>{r.code}</strong><Typography variant="caption" display="block" color="text.secondary">{r.components.join(' + ')}</Typography></TableCell>
              </TableRow>)}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </AppDialog>

    <AppDialog
      open={!!edit}
      maxWidth="sm"
      onClose={() => !busy && setEdit(null)}
      title={edit?.kind === 'type' ? 'GÁN/ĐỔI LOẠI HỒ SƠ' : 'XEM TRƯỚC ĐỔI MÃ CHÍNH THỨC'}
      confirmText="Xác nhận"
      cancelText="Hủy"
      onConfirm={saveAction}
      confirmDisabled={!edit?.reason?.trim() || (edit?.kind === 'reissue' && !edit?.newCode?.trim())}
      saving={busy}
    >
      {edit && <Stack gap={2}>
        {error && <Alert severity="error">{error}</Alert>}
        <Typography variant="body2">Mã hiện tại: <strong>{edit.code}</strong></Typography>
        {edit.kind === 'type' ? <>
          <PopupFormField label="Loại hồ sơ" htmlFor="lc-issue-type-select">
            <FormControl fullWidth size="small">
              <Select id="lc-issue-type-select" value={edit.typeId} inputProps={{ 'aria-label': 'Loại hồ sơ' }} onChange={e => setEdit({ ...edit, typeId: e.target.value })}>
                {options.types.filter(t => t.active).map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </Select>
            </FormControl>
          </PopupFormField>
          <Alert severity="info">Đổi loại giữ nguyên mã đã cấp. Nếu cần đổi mã, thực hiện thao tác Đổi mã riêng.</Alert>
        </> : <>
          <Typography variant="body2">Mã tiếp nhận gốc: <strong>{edit.intake_code || '—'}</strong></Typography>
          <PopupFormField label="Mã mới dự kiến" htmlFor="lc-issue-new-code">
            <TextField id="lc-issue-new-code" fullWidth size="small" value={edit.newCode || ''} inputProps={{ 'aria-label': 'Mã mới dự kiến' }}
              onChange={e => setEdit({ ...edit, newCode: e.target.value.toUpperCase() })} />
          </PopupFormField>
          <Alert severity="warning">Mã cũ được giữ chỗ vĩnh viễn. Kiểm tra tài liệu đã phát hành trước khi xác nhận.</Alert>
        </>}
        <PopupFormField label="Lý do bắt buộc" htmlFor="lc-issue-reason">
          <TextField id="lc-issue-reason" fullWidth size="small" multiline minRows={2} value={edit.reason || ''} inputProps={{ 'aria-label': 'Lý do bắt buộc' }}
            onChange={e => setEdit({ ...edit, reason: e.target.value })} />
        </PopupFormField>
      </Stack>}
    </AppDialog>

    <AppDialog
      open={history !== null}
      maxWidth="md"
      onClose={() => setHistory(null)}
      title="LỊCH SỬ MÃ HỌC VIÊN"
      actions={<Button variant="outlined" onClick={() => setHistory(null)} sx={outlineBtnSx}>Đóng</Button>}
    >
      {!history?.length ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>Chưa có lịch sử cấp mã.</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Lịch sử mã học viên">
            <TableHead><TableRow>
              <TableCell>Thời gian</TableCell>
              <TableCell>Thao tác</TableCell>
              <TableCell>Mã trước → sau</TableCell>
              <TableCell>Người thực hiện</TableCell>
              <TableCell>Lý do</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {history.map(h => <TableRow key={h.id} hover>
                <TableCell>{new Date(h.created_at).toLocaleString('vi-VN')}</TableCell>
                <TableCell>{{ issue: 'Cấp mã', reissue: 'Đổi mã', 'type.assign': 'Gán/đổi loại' }[h.action] || h.action}</TableCell>
                <TableCell><strong>{h.before_data?.code || '—'} → {h.after_data?.code || h.before_data?.code || '—'}</strong></TableCell>
                <TableCell>{h.actor_name} · {h.profile_name}</TableCell>
                <TableCell>{h.reason || '—'}</TableCell>
              </TableRow>)}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </AppDialog>
  </Layout>;
}
