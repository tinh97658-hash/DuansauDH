import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Alert, Button, Chip, MenuItem, Paper, Stack, TableBody, TableCell, TableContainer, TablePagination, TableRow, Typography } from '@mui/material';
import FeatureLayout from '../../components/FeatureLayout';
import FilterSearchField from '../../components/FilterSearchField';
import FilterSelectField from '../../components/FilterSelectField';
import ResizableTable from '../../components/ResizableTable';
import { preloadPage } from '../../utils/lazyPage';
import { API_BASE_URL } from '../../config/http';
import { leaveDate, leaveStatusLabels } from '../../features/learners/StudyLeavePanel';

const COLUMNS = [
  { key: 'learner', label: 'Học viên', width: 280, minWidth: 220 },
  { key: 'class', label: 'Lớp hành chính', width: 170, minWidth: 140 },
  { key: 'dates', label: 'Thời gian bảo lưu', width: 220, minWidth: 200 },
  { key: 'status', label: 'Trạng thái', width: 220, minWidth: 200, align: 'center' },
  { key: 'overdue', label: 'Quá hạn', width: 100, minWidth: 90, align: 'center' },
  { key: 'actions', label: 'Thao tác', width: 140, minWidth: 120, align: 'center' },
];

export default function StudyLeaves() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
  }, [status, debouncedSearch, page]);
  return <FeatureLayout title="Quản lý bảo lưu" group="Đào tạo Thạc sĩ">
    <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, bgcolor: '#FFF', borderColor: '#C6D5E1', borderRadius: '10px', boxShadow: '0 2px 6px rgba(18, 59, 98, 0.07)' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'flex-end' }}>
      <FilterSearchField label="Tìm kiếm" inputLabel="Tìm mã hoặc tên học viên" placeholder="Tìm mã hoặc tên học viên..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} sx={{ flex: '2 1 320px', minWidth: 0, width: '100%', '@media (max-width:599px)': { flex: 'none' } }} />
      <FilterSelectField label="Trạng thái bảo lưu" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }} sx={{ flex: '1 1 240px', minWidth: 0, width: '100%', '@media (max-width:599px)': { flex: 'none' } }}>
        <MenuItem value="">Tất cả</MenuItem>{Object.entries(leaveStatusLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        <MenuItem value="extension_pending">Có gia hạn chờ duyệt</MenuItem>
      </FilterSelectField>
      </Stack>
    </Paper>
    <Alert severity="info" sx={{ mb: 1.5, fontSize: 12 }}>Sắp hết hạn: còn tối đa 30 ngày. Quá hạn vẫn chờ xử lý, chưa tự động thôi học.</Alert>
    {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
    <Paper variant="outlined" sx={{ borderColor: '#D7E4EE', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(23, 62, 117, 0.04)' }}>
      <TableContainer sx={{ overflow: 'auto' }}>
      <ResizableTable columns={COLUMNS} storageKey="study-leaves-table-widths" aria-label="Danh sách bảo lưu"><TableBody>{result.rows.map(row => <TableRow hover key={row.id}>
        <TableCell><Typography variant="body2" fontWeight={600}>{row.fullName}</Typography><Typography variant="caption" color="text.secondary">{row.code} · {row.trainingLevel}</Typography></TableCell>
        <TableCell>{row.classCode || '—'}</TableCell><TableCell>{leaveDate(row.startDate)} – {leaveDate(row.endDate)}</TableCell>
        <TableCell align="center"><Chip size="small" color={row.status === 'overdue' ? 'error' : row.status === 'expiring' ? 'warning' : 'default'} label={leaveStatusLabels[row.status] || row.status} />
          {row.extensions?.some(extension => extension.status === 'pending') && <Typography variant="caption" display="block">Có gia hạn chờ duyệt</Typography>}</TableCell>
        <TableCell align="center">{row.status === 'overdue' ? `${row.overdueDays} ngày` : '—'}</TableCell>
        <TableCell align="center"><Button size="small" component={Link} to={`/plan/admission-records/${row.admissionRecordId}?tab=leave`} onPointerEnter={() => preloadPage(`/plan/admission-records/${row.admissionRecordId}`)} onFocus={() => preloadPage(`/plan/admission-records/${row.admissionRecordId}`)}>Mở hồ sơ</Button></TableCell>
      </TableRow>)}{!result.rows.length && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5, color: 'text.secondary' }}>{loading ? 'Đang tải…' : 'Không có hồ sơ bảo lưu phù hợp.'}</TableCell></TableRow>}</TableBody></ResizableTable>
      </TableContainer>
      <TablePagination component="div" count={result.total} page={page} rowsPerPage={20} rowsPerPageOptions={[20]} onPageChange={(_, next) => setPage(next)} labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`} />
    </Paper>
  </FeatureLayout>;
}
