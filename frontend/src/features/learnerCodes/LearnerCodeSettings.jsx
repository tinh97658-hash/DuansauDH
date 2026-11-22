import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Alert, Box, Button, Checkbox, Chip, FormControl, FormControlLabel, MenuItem,
  Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material';
import { PencilSquareIcon, PlusIcon } from '../../components/AppIcons';
import AppDialog from '../../components/AppDialog';
import DateField from '../../components/DateField';
import FeatureLayout from '../../components/FeatureLayout';
import PopupFormField from '../../components/PopupFormField';
import { API_BASE_URL } from '../../config/http';
import { usePermissions } from '../accounts/usePermissions';
import { useAuthSession } from '../../context/AuthSession';

const root = `${API_BASE_URL}/learner-codes`;
const defaults = [{ kind: 'major' }, { kind: 'year', width: 2 }, { kind: 'round', width: 1 }, { kind: 'group', width: 1 }, { kind: 'sequence', width: 3 }];
const kinds = { major: 'Viết tắt chuyên ngành', year: 'Năm', round: 'Đợt', group: 'Thứ tự lớp', sequence: 'Số tự tăng và chữ loại', literal: 'Giá trị cố định', manual: 'Giá trị nhập tay' };
const scopes = { class: 'Theo lớp và loại hồ sơ', major_round: 'Theo chuyên ngành, năm, đợt và loại', major_year: 'Theo chuyên ngành, năm và loại', year: 'Theo năm và loại', global: 'Theo bậc và loại hồ sơ' };

const sectionCardSx = {
  p: 2,
  mb: 2,
  bgcolor: '#FFFFFF',
  borderColor: '#C6D5E1',
  borderRadius: '10px',
  boxShadow: '0 2px 6px rgba(18, 59, 98, 0.07)',
};
const sectionTitleSx = { fontSize: 15, fontWeight: 700, color: '#173E75' };
const primaryBtnSx = {
  minHeight: 34,
  px: 1.75,
  bgcolor: '#0788B8',
  borderRadius: '6px',
  boxShadow: 'none',
  textTransform: 'none',
  fontWeight: 700,
  '&:hover': { bgcolor: '#056A8F', boxShadow: 'none' },
};
const outlineBtnSx = {
  borderRadius: '6px',
  textTransform: 'none',
  fontWeight: 600,
  borderColor: '#B9CBD8',
  color: '#173E75',
  bgcolor: '#FFFFFF',
  '&:hover': { borderColor: '#0788B8', bgcolor: '#F1F7FB' },
};

export default function LearnerCodeSettings() {
  const session = useAuthSession();
  return <SettingsContent key={`${session?.user?.id}:${session?.activeProfile?.id}`} />;
}

function SettingsContent() {
  const { can, access } = usePermissions();
  const [data, setData] = useState({ types: [], rules: [], abbreviations: [], majors: [], groups: [] });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null);
  const [counters, setCounters] = useState([]);
  const [countersLoaded, setCountersLoaded] = useState(false);
  const globalWrite = !access?.groupScope?.readOnly && !access?.groupScope?.restrictEdit;
  const canManage = can('learnercode.config.manage') && globalWrite;

  const load = async () => {
    try {
      setData((await axios.get(`${root}/config`)).data);
      setError('');
    } catch (e) {
      setError(e.response?.data?.message || 'Không thể tải cấu hình.');
    }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const { kind, id, ...form } = edit;
      if (kind === 'type') {
        await axios({
          method: id ? 'put' : 'post',
          url: `${root}/types${id ? `/${id}` : ''}`,
          data: {
            ...form,
            key: form.key?.trim() || undefined,
            usesSpecialCode: Boolean(form.usesSpecialCode),
            letter: form.usesSpecialCode ? (form.letter?.trim().toUpperCase() || undefined) : undefined,
          },
        });
      }
      if (kind === 'abbreviation') await axios.put(`${root}/abbreviations/${form.majorId}`, { abbreviation: form.abbreviation });
      if (kind === 'rule') await axios({ method: id ? 'put' : 'post', url: `${root}/rules${id ? `/${id}` : ''}`, data: form });
      if (kind === 'counter') await axios.post(`${root}/counters/advance`, { key: form.key, nextNumber: form.nextNumber, reason: form.reason });
      setEdit(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Không thể lưu.');
    } finally {
      setBusy(false);
    }
  };

  const renderField = (key, label, options) => {
    const id = `lc-field-${key}`;
    if (options) {
      return (
        <PopupFormField label={label} htmlFor={id}>
          <FormControl fullWidth size="small">
            <Select
              id={id}
              displayEmpty
              disabled={key === 'counterScope' && !!edit.id}
              value={edit[key] ?? ''}
              inputProps={{ 'aria-label': label }}
              onChange={e => setEdit({ ...edit, [key]: e.target.value || undefined })}
            >
              <MenuItem value="">Không giới hạn</MenuItem>
              {options.map(o => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
            </Select>
          </FormControl>
        </PopupFormField>
      );
    }
    return (
      <PopupFormField label={label} htmlFor={id}>
        <TextField
          id={id}
          fullWidth
          size="small"
          disabled={key === 'counterScope' && !!edit.id}
          value={edit[key] ?? ''}
          inputProps={{ 'aria-label': label }}
          onChange={e => setEdit({ ...edit, [key]: e.target.value || undefined })}
        />
      </PopupFormField>
    );
  };

  const openRule = r => setEdit({
    kind: 'rule', id: r.id, name: r.name, active: r.active, program: r.program || undefined, majorId: r.major_id || undefined,
    academicYear: r.academic_year || undefined, intakeRound: r.intake_round || undefined, classGroupId: r.class_group_id || undefined,
    typeId: r.type_id || undefined, counterScope: r.counter_scope, startNumber: Number(r.start_number), parts: r.parts, version: r.version, effectiveFrom: r.effective_from,
  });

  const abbreviationTargetMajor = edit?.kind === 'abbreviation' ? data.majors.find(m => m.id === edit.majorId) : null;

  return <FeatureLayout title="Quy tắc mã học viên" group="Hệ thống" desc="Cấu hình chữ cái, mẫu mã và bộ đếm độc lập cho từng loại hồ sơ.">
    {error && !edit && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {!globalWrite && <Alert severity="info" sx={{ mb: 2 }}>Cấu hình dùng chung chỉ được sửa với hồ sơ có phạm vi sửa toàn viện.</Alert>}

    <Paper variant="outlined" sx={sectionCardSx}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1.5} flexWrap="wrap" sx={{ mb: 1.5 }}>
        <Typography variant="h6" sx={sectionTitleSx}>Loại hồ sơ</Typography>
        {canManage && <Button variant="contained" size="small" startIcon={<PlusIcon fontSize="small" />} sx={primaryBtnSx}
          onClick={() => setEdit({ kind: 'type', name: '', key: '', usesSpecialCode: false, letter: '', active: false, requiresAdmission: true })}>Thêm loại</Button>}
      </Stack>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Loại hồ sơ">
          <TableHead><TableRow>
            <TableCell>Tên loại</TableCell>
            <TableCell>Chế độ cấp mã</TableCell>
            <TableCell align="center" sx={{ width: 90 }}>Chữ cái</TableCell>
            <TableCell>Điều kiện</TableCell>
            <TableCell align="center" sx={{ width: 150 }}>Trạng thái</TableCell>
            {canManage && <TableCell align="center" sx={{ width: 120 }}>Thao tác</TableCell>}
          </TableRow></TableHead>
          <TableBody>
            {data.types.map(t => {
              const isSpecial = Boolean(t.uses_special_code ?? t.letter);
              return <TableRow key={t.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{t.name}</TableCell>
                <TableCell>{isSpecial ? 'Mã đặc biệt (gắn chữ cái)' : 'Mã chuẩn'}</TableCell>
                <TableCell align="center">{isSpecial && t.letter ? <Chip size="small" label={t.letter} color="primary" variant="outlined" sx={{ fontWeight: 700 }} /> : '—'}</TableCell>
                <TableCell>{t.requires_admission ? 'Đã trúng tuyển' : 'Theo danh sách lớp đã tiếp nhận'}</TableCell>
                <TableCell align="center"><Chip size="small" label={t.active ? 'Đang dùng' : 'Chưa kích hoạt'} color={t.active ? 'success' : 'default'} variant={t.active ? 'filled' : 'outlined'} /></TableCell>
                {canManage && <TableCell align="center">
                  <Button variant="outlined" size="small" startIcon={<PencilSquareIcon fontSize="small" />} sx={outlineBtnSx}
                    onClick={() => setEdit({ kind: 'type', id: t.id, key: t.key, name: t.name, usesSpecialCode: isSpecial, letter: t.letter || undefined, active: t.active, requiresAdmission: t.requires_admission, version: t.version })}>Sửa</Button>
                </TableCell>}
              </TableRow>;
            })}
            {!data.types.length && <TableRow><TableCell colSpan={canManage ? 6 : 5} align="center" sx={{ color: 'text.secondary' }}>Chưa có loại hồ sơ.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>

    <Paper variant="outlined" sx={sectionCardSx}>
      <Typography variant="h6" sx={{ ...sectionTitleSx, mb: 1.5 }}>Viết tắt chuyên ngành</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Viết tắt chuyên ngành">
          <TableHead><TableRow>
            <TableCell align="center" sx={{ width: 64 }}>STT</TableCell>
            <TableCell>Chuyên ngành</TableCell>
            <TableCell align="center" sx={{ width: 180 }}>Viết tắt</TableCell>
            {canManage && <TableCell align="center" sx={{ width: 140 }}>Thao tác</TableCell>}
          </TableRow></TableHead>
          <TableBody>
            {data.majors.map((m, index) => {
              const abbreviation = data.abbreviations.find(a => a.major_id === m.id)?.abbreviation;
              return <TableRow key={m.id} hover>
                <TableCell align="center">{index + 1}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{m.name}</TableCell>
                <TableCell align="center">{abbreviation ? <Chip size="small" label={abbreviation} color="primary" variant="outlined" sx={{ fontWeight: 700 }} /> : <Typography variant="body2" color="text.secondary">Chưa cấu hình</Typography>}</TableCell>
                {canManage && <TableCell align="center">
                  <Button variant="outlined" size="small" startIcon={<PencilSquareIcon fontSize="small" />} sx={outlineBtnSx}
                    onClick={() => setEdit({ kind: 'abbreviation', majorId: m.id, abbreviation: abbreviation || '' })}>Cấu hình</Button>
                </TableCell>}
              </TableRow>;
            })}
            {!data.majors.length && <TableRow><TableCell colSpan={canManage ? 4 : 3} align="center" sx={{ color: 'text.secondary' }}>Chưa có chuyên ngành.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>

    <Paper variant="outlined" sx={sectionCardSx}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1.5} flexWrap="wrap" sx={{ mb: 1.5 }}>
        <Typography variant="h6" sx={sectionTitleSx}>Mẫu và phạm vi cấp mã</Typography>
        {canManage && <Button variant="contained" size="small" startIcon={<PlusIcon fontSize="small" />} sx={primaryBtnSx}
          onClick={() => setEdit({ kind: 'rule', name: '', active: false, counterScope: 'class', startNumber: 1, parts: defaults })}>Thêm quy tắc</Button>}
      </Stack>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Mẫu và phạm vi cấp mã">
          <TableHead><TableRow>
            <TableCell>Tên quy tắc</TableCell>
            <TableCell align="center" sx={{ width: 100 }}>Phiên bản</TableCell>
            <TableCell>Thành phần ghép mã</TableCell>
            <TableCell>Phạm vi bộ đếm</TableCell>
            <TableCell align="center" sx={{ width: 130 }}>Trạng thái</TableCell>
            {canManage && <TableCell align="center" sx={{ width: 120 }}>Thao tác</TableCell>}
          </TableRow></TableHead>
          <TableBody>
            {data.rules.map(r => <TableRow key={r.id} hover>
              <TableCell sx={{ fontWeight: 600 }}>{r.name}</TableCell>
              <TableCell align="center">v{r.version}</TableCell>
              <TableCell>{r.parts.map(p => kinds[p.kind]).join(' + ')}</TableCell>
              <TableCell>{scopes[r.counter_scope]}</TableCell>
              <TableCell align="center"><Chip size="small" label={r.active ? 'Đang dùng' : 'Ngừng dùng'} color={r.active ? 'success' : 'default'} variant={r.active ? 'filled' : 'outlined'} /></TableCell>
              {canManage && <TableCell align="center">
                <Button variant="outlined" size="small" startIcon={<PencilSquareIcon fontSize="small" />} sx={outlineBtnSx}
                  onClick={() => openRule(r)}>Sửa</Button>
              </TableCell>}
            </TableRow>)}
            {!data.rules.length && <TableRow><TableCell colSpan={canManage ? 6 : 5} align="center" sx={{ color: 'text.secondary' }}>Chưa có quy tắc cấp mã.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>

    <Paper variant="outlined" sx={sectionCardSx}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1.5} flexWrap="wrap" sx={{ mb: countersLoaded ? 1.5 : 0 }}>
        <Typography variant="h6" sx={sectionTitleSx}>Bộ đếm đã dùng</Typography>
        <Button variant="outlined" size="small" sx={outlineBtnSx}
          onClick={async () => {
            try {
              setCounters((await axios.get(`${root}/counters`)).data);
              setCountersLoaded(true);
            } catch (e) {
              setError(e.response?.data?.message || 'Không tải được bộ đếm.');
            }
          }}>Xem bộ đếm đã dùng</Button>
      </Stack>
      {countersLoaded && <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Bộ đếm đã dùng">
          <TableHead><TableRow>
            <TableCell>Loại hồ sơ</TableCell>
            <TableCell>Phạm vi / Lớp</TableCell>
            <TableCell align="center" sx={{ width: 120 }}>Số tiếp theo</TableCell>
            <TableCell>Giới hạn</TableCell>
            {can('learnercode.counter.advance') && globalWrite && <TableCell align="center" sx={{ width: 180 }}>Thao tác</TableCell>}
          </TableRow></TableHead>
          <TableBody>
            {counters.map(c => <TableRow key={c.key} hover>
              <TableCell sx={{ fontWeight: 600 }}>{c.type_name}</TableCell>
              <TableCell>{c.group_code || scopes[JSON.parse(c.key)[0]]}</TableCell>
              <TableCell align="center">{c.next_number}</TableCell>
              <TableCell>{c.maxNumber != null ? `Giới hạn ${c.maxNumber}` : 'Chưa có quy tắc hợp lệ'}</TableCell>
              {can('learnercode.counter.advance') && globalWrite && <TableCell align="center">
                <Button variant="outlined" size="small" sx={outlineBtnSx} disabled={c.maxNumber == null || Number(c.next_number) >= c.maxNumber}
                  onClick={() => setEdit({ kind: 'counter', key: c.key, nextNumber: Number(c.next_number) + 1, maxNumber: c.maxNumber, reason: '' })}>Tăng số tiếp theo</Button>
              </TableCell>}
            </TableRow>)}
            {!counters.length && <TableRow><TableCell colSpan={can('learnercode.counter.advance') && globalWrite ? 5 : 4} align="center" sx={{ color: 'text.secondary' }}>Chưa có bộ đếm nào được sử dụng.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>}
    </Paper>

    <AppDialog
      open={!!edit}
      onClose={() => !busy && setEdit(null)}
      maxWidth={edit?.kind === 'rule' ? 'md' : 'sm'}
      title={edit?.kind === 'type' ? 'LOẠI HỒ SƠ' : edit?.kind === 'rule' ? 'QUY TẮC MÃ HỌC VIÊN' : edit?.kind === 'counter' ? 'ĐIỀU CHỈNH BỘ ĐẾM' : 'VIẾT TẮT CHUYÊN NGÀNH'}
      confirmText="Lưu"
      cancelText="Hủy"
      onConfirm={save}
      saving={busy}
    >
      {edit && <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        {edit.kind === 'type' && <>
          {renderField('name', 'Tên loại hồ sơ')}
          {!edit.id && renderField('key', 'Khóa loại hồ sơ (tùy chọn — tự tạo từ tên nếu bỏ trống)')}
          <Box sx={{ p: 1.5, border: '1px solid #d7e1e8', borderRadius: '6px', bgcolor: '#fbfcfd' }}>
            <Stack spacing={0.5}>
              <FormControlLabel
                control={
                  <Checkbox
                    disabled={edit.key === 'regular'}
                    checked={Boolean(edit.usesSpecialCode)}
                    onChange={e => setEdit({ ...edit, usesSpecialCode: e.target.checked, letter: e.target.checked ? (edit.letter || '') : '' })}
                  />
                }
                label="Cấp mã đặc biệt (gắn chữ cái phân biệt ở cuối mã)"
              />
              {edit.key !== 'regular' && edit.usesSpecialCode && (
                <Box sx={{ pt: 0.75, pb: 0.5 }}>
                  {renderField('letter', 'Chữ cái của loại hồ sơ (A–Z)')}
                </Box>
              )}
              <FormControlLabel control={<Checkbox disabled={edit.key === 'regular'} checked={edit.active} onChange={e => setEdit({ ...edit, active: e.target.checked })} />} label="Kích hoạt (cho phép cấp mã)" />
              <FormControlLabel control={<Checkbox disabled={edit.key === 'regular'} checked={edit.requiresAdmission} onChange={e => setEdit({ ...edit, requiresAdmission: e.target.checked })} />} label="Yêu cầu xác nhận trúng tuyển trước khi cấp mã" />
            </Stack>
          </Box>
          {!edit.requiresAdmission && <Alert severity="warning">Chỉ tắt yêu cầu trúng tuyển khi loại hồ sơ có quy trình tiếp nhận riêng. Hồ sơ vẫn phải thuộc lớp hành chính phù hợp.</Alert>}
        </>}
        {edit.kind === 'abbreviation' && <>
          {abbreviationTargetMajor && <Typography variant="body2" color="text.secondary">Chuyên ngành: <strong>{abbreviationTargetMajor.name}</strong></Typography>}
          {renderField('abbreviation', 'Viết tắt (2–12 chữ/số)')}
        </>}
        {edit.kind === 'rule' && <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {renderField('name', 'Tên quy tắc')}
            {renderField('program', 'Bậc đào tạo', [{ id: 'masters', name: 'Thạc sĩ' }, { id: 'doctoral', name: 'Tiến sĩ' }])}
            <PopupFormField label="Hiệu lực từ" htmlFor="lc-rule-effective-from">
              <DateField id="lc-rule-effective-from" fullWidth size="small" value={edit.effectiveFrom || ''}
                inputProps={{ 'aria-label': 'Hiệu lực từ' }}
                onChange={e => setEdit({ ...edit, effectiveFrom: e.target.value || undefined })} />
            </PopupFormField>
            {renderField('majorId', 'Chuyên ngành', data.majors)}
            {renderField('academicYear', 'Năm (4 số, bỏ trống nếu không giới hạn)')}
            <PopupFormField label="Đợt (bỏ trống nếu không giới hạn)" htmlFor="lc-rule-intake-round">
              <TextField id="lc-rule-intake-round" fullWidth size="small" type="number" value={edit.intakeRound || ''}
                inputProps={{ 'aria-label': 'Đợt (bỏ trống nếu không giới hạn)' }}
                onChange={e => setEdit({ ...edit, intakeRound: e.target.value ? Number(e.target.value) : undefined })} />
            </PopupFormField>
            {renderField('typeId', 'Loại hồ sơ', data.types)}
            {renderField('classGroupId', 'Lớp áp dụng riêng', data.groups.map(g => ({ id: g.id, name: `${g.code} · ${g.name}` })))}
            {renderField('counterScope', 'Phạm vi bộ đếm', Object.entries(scopes).map(([id, name]) => ({ id, name })))}
            <PopupFormField label="Số bắt đầu" htmlFor="lc-rule-start-number">
              <TextField id="lc-rule-start-number" fullWidth size="small" type="number" value={edit.startNumber}
                inputProps={{ 'aria-label': 'Số bắt đầu' }}
                onChange={e => setEdit({ ...edit, startNumber: Number(e.target.value) })} />
            </PopupFormField>
          </Box>
          <Box sx={{ p: 1.75, border: '1px solid #d7e1e8', borderRadius: '6px', bgcolor: '#fbfcfd' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#4b5e68', textTransform: 'uppercase' }}>Các thành phần theo thứ tự ghép mã</Typography>
              <Button variant="outlined" size="small" startIcon={<PlusIcon fontSize="small" />} sx={outlineBtnSx}
                onClick={() => setEdit({ ...edit, parts: [...edit.parts, { kind: 'literal', value: '-' }] })}>Thêm thành phần</Button>
            </Stack>
            <Stack spacing={1.25}>
              {edit.parts.map((p, i) => <Stack key={i} direction="row" gap={1} alignItems="flex-end" flexWrap="wrap">
                <PopupFormField label={`Thành phần ${i + 1}`} htmlFor={`lc-part-kind-${i}`}>
                  <FormControl fullWidth size="small" sx={{ minWidth: 200 }}>
                    <Select id={`lc-part-kind-${i}`} value={p.kind} inputProps={{ 'aria-label': 'Thành phần' }}
                      onChange={e => setEdit({ ...edit, parts: edit.parts.map((x, j) => j === i ? { kind: e.target.value, width: e.target.value === 'year' ? 2 : ['sequence', 'manual'].includes(e.target.value) ? 3 : 1 } : x) })}>
                      {Object.entries(kinds).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </PopupFormField>
                {!['major', 'literal'].includes(p.kind) && <Box sx={{ width: 120 }}>
                  <PopupFormField label="Độ dài" htmlFor={`lc-part-width-${i}`}>
                    <TextField id={`lc-part-width-${i}`} fullWidth size="small" type="number" value={p.width || 1}
                      inputProps={{ 'aria-label': 'Độ dài' }}
                      onChange={e => setEdit({ ...edit, parts: edit.parts.map((x, j) => j === i ? { ...x, width: Number(e.target.value) } : x) })} />
                  </PopupFormField>
                </Box>}
                {p.kind === 'literal' && <Box sx={{ flex: 1, minWidth: 160 }}>
                  <PopupFormField label="Chữ/số hoặc dấu phân cách" htmlFor={`lc-part-literal-${i}`}>
                    <TextField id={`lc-part-literal-${i}`} fullWidth size="small" value={p.value || ''}
                      inputProps={{ 'aria-label': 'Chữ/số hoặc dấu phân cách' }}
                      onChange={e => setEdit({ ...edit, parts: edit.parts.map((x, j) => j === i ? { ...x, value: e.target.value.toUpperCase() } : x) })} />
                  </PopupFormField>
                </Box>}
                <Stack direction="row" gap={0.75} sx={{ pb: 0.5 }}>
                  <Button variant="outlined" size="small" sx={outlineBtnSx} disabled={!i}
                    onClick={() => { const parts = [...edit.parts]; [parts[i - 1], parts[i]] = [parts[i], parts[i - 1]]; setEdit({ ...edit, parts }); }}>Lên</Button>
                  <Button variant="outlined" size="small" color="error" sx={{ borderRadius: '6px', textTransform: 'none', fontWeight: 600 }}
                    onClick={() => setEdit({ ...edit, parts: edit.parts.filter((_, j) => j !== i) })}>Bỏ</Button>
                </Stack>
              </Stack>)}
            </Stack>
          </Box>
          <FormControlLabel control={<Checkbox checked={edit.active} onChange={e => setEdit({ ...edit, active: e.target.checked })} />} label="Áp dụng quy tắc" />
          <Alert severity="info">Loại đặc biệt dùng một ký tự cuối cho chữ cái: đuôi dài 3 ký tự gồm 2 số và 1 chữ. Thay quy tắc không đổi mã đã cấp.</Alert>
        </>}
        {edit.kind === 'counter' && <>
          <PopupFormField label="Số tiếp theo" htmlFor="lc-counter-next">
            <TextField id="lc-counter-next" fullWidth size="small" type="number" value={edit.nextNumber}
              inputProps={{ min: 1, max: edit.maxNumber, 'aria-label': 'Số tiếp theo' }}
              helperText={`Giới hạn theo quy tắc hiện tại: ${edit.maxNumber}`}
              onChange={e => setEdit({ ...edit, nextNumber: Number(e.target.value) })} />
          </PopupFormField>
          {renderField('reason', 'Lý do tăng bộ đếm')}
        </>}
      </Stack>}
    </AppDialog>
  </FeatureLayout>;
}
