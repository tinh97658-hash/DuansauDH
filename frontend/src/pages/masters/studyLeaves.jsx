import { notify } from "../../utils/notify";
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Alert, Box, Button, Chip, IconButton, MenuItem, Paper, Stack, Tab, Tabs, TableBody, TableCell, TableContainer, TableRow, Tooltip, Typography } from '@mui/material';
import FeatureLayout from '../../components/FeatureLayout';
import InlineReportExport from '../../components/InlineReportExport';
import { useReportExport } from '../../components/ReportExportContext';
import { collectReportPages } from '../../utils/reportExport';
import FilterSearchField from '../../components/FilterSearchField';
import FilterSelectField from '../../components/FilterSelectField';
import ListPagination from "../../components/ListPagination";
import ResizableTable from '../../components/ResizableTable';
import { preloadPage } from '../../utils/lazyPage';
import { API_BASE_URL } from '../../config/http';
import { leaveDate, leaveStatusLabels } from '../../features/learners/StudyLeavePanel';
import StudyLeaveRequestDialog from '../../features/learners/StudyLeaveRequestDialog';
import StudyLeaveDecisionDialog from '../../features/learners/StudyLeaveDecisionDialog';
import StudyLeaveExtensionDialog from '../../features/learners/StudyLeaveExtensionDialog';
import { usePermissions } from '../../features/accounts/usePermissions';
import StudyManagementRecords from '../../features/learners/StudyManagementRecords';
import { CalendarDaysIcon, EyeIcon } from '../../components/AppIcons';
import './studyLeaves.css';

const COLUMNS = [
  { key: 'learner', label: 'Học viên', width: 190, minWidth: 180, stretch: false },
  { key: 'class', label: 'Lớp hành chính', width: 130, minWidth: 130, stretch: false },
  { key: 'dates', label: 'Thời gian bảo lưu', width: 190, minWidth: 190, stretch: false },
  { key: 'status', label: 'Trạng thái', width: 170, minWidth: 170, align: 'center', stretch: false },
  { key: 'overdue', label: 'Quá hạn', width: 190, minWidth: 190, align: 'center' },
  { key: 'approval', label: 'Phê duyệt', width: 190, minWidth: 190, align: 'center' },
  { key: 'actions', label: 'Thao tác', width: 240, minWidth: 240, align: 'center', stretch: false },
];

export default function StudyLeaves() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'records' ? 'records' : 'leaves';
  const viewTabs = <Tabs value={view} onChange={(_, value) => setParams({ view: value })} aria-label="Phạm vi quản lý bảo lưu" sx={{ mb: 1.5, minHeight: 40, flexShrink: 0, '& .MuiTab-root': { minHeight: 40, px: 2 } }}>
      <Tab value="leaves" id="study-leaves-tab" aria-controls="study-leaves-panel" label="Các đợt bảo lưu" />
      <Tab value="records" id="study-records-tab" aria-controls="study-records-panel" label="Hồ sơ bảo lưu" />
    </Tabs>;
  return <FeatureLayout title="Quản lý bảo lưu" group="Đào tạo Thạc sĩ" exportConfig={{ formats: ["excel"] }}>
    {viewTabs}
    <Box role="tabpanel" id={view === 'leaves' ? 'study-leaves-panel' : 'study-records-panel'} aria-labelledby={view === 'leaves' ? 'study-leaves-tab' : 'study-records-tab'}>
      {view === 'leaves' ? <StudyLeaveList /> : <StudyManagementRecords />}
    </Box>
  </FeatureLayout>;
}

function StudyLeaveList() {
  const { can } = usePermissions();
  const [creating, setCreating] = useState(false);
  const [decision, setDecision] = useState(null);
  const [extension, setExtension] = useState(null);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useReportExport(async () => {
    const rows = await collectReportPages(async nextPage => (await axios.get(`${API_BASE_URL}/plan/study-leaves`, { withCredentials: true, params: { status, search: debouncedSearch, page: nextPage, pageSize: 20 } })).data);
    return { title: 'Danh sách bảo lưu', metadata: [['Tìm kiếm', debouncedSearch || 'Tất cả'], ['Phạm vi', `${rows.length} đợt bảo lưu phù hợp bộ lọc`]],
      sections: [{ title: 'Các đợt bảo lưu', headers: ['Mã HV', 'Học viên', 'Trình độ', 'Lớp', 'Bắt đầu', 'Kết thúc', 'Trạng thái', 'Số ngày quá hạn', 'Lý do'],
        rows: rows.map(row => [row.code, row.fullName, row.trainingLevel, row.classCode, leaveDate(row.startDate), leaveDate(row.endDate), leaveStatusLabels[row.status] || row.status, row.overdueDays || 0, row.note]) }] };
  }, loading || !!error || search !== debouncedSearch);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError('');
      try {
        const { data } = await axios.get(`${API_BASE_URL}/plan/study-leaves`, { withCredentials: true, params: { status, search: debouncedSearch, page: page + 1, pageSize: 20 } });
        if (!cancelled) setResult(data);
      } catch (e) { if (!cancelled) setError(e.response?.data?.message || 'Không tải được danh sách bảo lưu.'); }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [status, debouncedSearch, page, revision]);
  return <>
    <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, bgcolor: '#FFF', borderColor: '#C6D5E1', borderRadius: '10px', boxShadow: '0 2px 6px rgba(18, 59, 98, 0.07)' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'flex-end' }}>
      <FilterSearchField label="Tìm kiếm" inputLabel="Tìm mã hoặc tên học viên" placeholder="Tìm mã hoặc tên học viên..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} sx={{ flex: '2 1 320px', minWidth: 0, width: '100%', '@media (max-width:599px)': { flex: 'none' } }} />
      <FilterSelectField label="Trạng thái bảo lưu" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }} sx={{ flex: '1 1 240px', minWidth: 0, width: '100%', '@media (max-width:599px)': { flex: 'none' } }}>
        <MenuItem value="">Tất cả</MenuItem>{Object.entries(leaveStatusLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        <MenuItem value="extension_pending">Có gia hạn chờ duyệt</MenuItem>
      </FilterSelectField>
      {can('studyleave.request') && <Button variant="contained" sx={{ flexShrink: 0, whiteSpace: 'nowrap', minHeight: 38 }}
        onClick={() => {  setCreating(true); }}>Tạo yêu cầu bảo lưu</Button>}
      <InlineReportExport height={38} />
      </Stack>
    </Paper>
    {creating && <StudyLeaveRequestDialog onClose={() => setCreating(false)} onCreated={learner => {
      setCreating(false); notify.success(`Đã tạo yêu cầu bảo lưu cho ${learner.fullName} (${learner.code}).`);
      setStatus(''); setSearch(''); setDebouncedSearch(''); setPage(0); setRevision(value => value + 1);
    }} />}

    {decision && <StudyLeaveDecisionDialog key={`${decision.leave.id}-${decision.action}`} {...decision}
      onClose={() => setDecision(null)} onDecided={() => {
        notify.success(`Đã ${decision.action === 'approve' ? 'duyệt' : 'từ chối'} bảo lưu cho ${decision.leave.fullName}.`);
        setDecision(null); setRevision(value => value + 1);
      }} />}
    {extension && <StudyLeaveExtensionDialog key={`${extension.leave.id}-${extension.action}`} {...extension}
      onClose={() => setExtension(null)} onCompleted={() => {
        const messages = { request_extension: 'Đã gửi đề nghị gia hạn', approve_extension: 'Đã duyệt gia hạn', reject_extension: 'Đã từ chối gia hạn' };
        notify.success(`${messages[extension.action]} cho ${extension.leave.fullName}.`);
        setExtension(null); setRevision(value => value + 1);
      }} />}
    <Alert severity="info" sx={{ mb: 1.5, fontSize: 12 }}>Sắp hết hạn: còn tối đa 30 ngày. Quá hạn vẫn chờ xử lý, chưa tự động thôi học.</Alert>
    {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
    <Paper variant="outlined" sx={{ borderColor: '#D7E4EE', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(23, 62, 117, 0.04)' }}>
      <TableContainer sx={{ overflow: 'auto' }}>
      <ResizableTable className="study-leaves-table" columns={COLUMNS} storageKey="study-leaves-table-widths:compact-v2" aria-label="Danh sách bảo lưu" sx={{ '& td:first-of-type .MuiTypography-root': { whiteSpace: 'normal', overflowWrap: 'anywhere' } }}><TableBody>{result.rows.map(row => {
        const active = ['active', 'expiring', 'overdue'].includes(row.status);
        const pendingExtension = row.extensions?.some(item => item.status === 'pending');
        return <TableRow hover key={row.id}>
        <TableCell><Typography variant="body2" fontWeight={600}>{row.fullName}</Typography><Typography variant="caption" color="text.secondary">{row.code} · {row.trainingLevel}</Typography></TableCell>
        <TableCell>{row.classCode || '—'}</TableCell><TableCell>{leaveDate(row.startDate)} – {leaveDate(row.endDate)}</TableCell>
        <TableCell align="center"><Chip size="small" color={row.status === 'overdue' ? 'error' : row.status === 'expiring' ? 'warning' : 'default'} label={leaveStatusLabels[row.status] || row.status} />
          {row.extensions?.some(extension => extension.status === 'pending') && <Typography variant="caption" display="block">Có gia hạn chờ duyệt</Typography>}</TableCell>
        <TableCell align="center">{row.status === 'overdue' ? `${row.overdueDays} ngày` : '—'}</TableCell>
        <TableCell align="center">{row.status === 'pending' && can('studyleave.approve') ? <Stack direction="row" justifyContent="center" sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Button size="small" variant="contained" disabled={loading} sx={{ whiteSpace: 'nowrap' }} onClick={() => {  setDecision({ leave: row, action: 'approve' }); }}>Duyệt bảo lưu</Button>
          <Button size="small" color="error" disabled={loading} sx={{ whiteSpace: 'nowrap' }} onClick={() => {  setDecision({ leave: row, action: 'reject' }); }}>Từ chối</Button>
        </Stack> : active && pendingExtension && can('studyleave.approve') ? <Stack direction="row" justifyContent="center" sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Button size="small" variant="contained" disabled={loading} onClick={() => setExtension({ leave: row, action: 'approve_extension' })}>Duyệt gia hạn</Button>
          <Button size="small" color="error" disabled={loading} onClick={() => setExtension({ leave: row, action: 'reject_extension' })}>Từ chối gia hạn</Button>
        </Stack> : '—'}</TableCell>
        <TableCell align="center"><div className="study-leave-row-actions">
          <Tooltip title="Mở hồ sơ" arrow>
            <IconButton component={Link} aria-label="Mở hồ sơ" to={`/masters/study-leaves/${row.admissionRecordId}?tab=leave`}
              onPointerEnter={() => preloadPage(`/masters/study-leaves/${row.admissionRecordId}`)} onFocus={() => preloadPage(`/masters/study-leaves/${row.admissionRecordId}`)}
              sx={{ "--app-table-icon-size": "24px", "--app-table-action-size": "36px", color: '#075985', bgcolor: 'transparent', border: 0, boxShadow: 'none', '&:hover': { color: '#0c4a6e', bgcolor: 'transparent' } }}>
              <EyeIcon sx={{ fontSize: 24 }} />
            </IconButton>
          </Tooltip>
          {active && !pendingExtension && can('studyleave.request') && <Tooltip title="Đề nghị gia hạn bảo lưu" arrow>
            <span style={{ display: 'inline-flex' }}>
              <IconButton aria-label="Đề nghị gia hạn" disabled={loading} onClick={() => setExtension({ leave: row, action: 'request_extension' })}
                sx={{ "--app-table-icon-size": "24px", "--app-table-action-size": "36px", color: '#075985', bgcolor: 'transparent', border: 0, boxShadow: 'none', '&:hover': { color: '#0c4a6e', bgcolor: 'transparent' } }}>
                <CalendarDaysIcon sx={{ fontSize: 24 }} />
              </IconButton>
            </span>
          </Tooltip>}
        </div></TableCell>
      </TableRow>})}{!result.rows.length && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5, color: 'text.secondary' }}>{loading ? 'Đang tải…' : 'Không có hồ sơ bảo lưu phù hợp.'}</TableCell></TableRow>}</TableBody></ResizableTable>
      </TableContainer>
      <ListPagination count={result.total} page={page} pageSize={20} onPageChange={setPage} recordLabel="học viên" />
    </Paper>
  </>;
}
