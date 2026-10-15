import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Alert, Box, Button, Chip, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import AppLayout from '../../components/AppLayout';
import { API_BASE_URL } from '../../config/http';
import { leaveDate, leaveStatusLabels } from '../../features/learners/StudyLeavePanel';

export default function StudyLeaves() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true); setError('');
      try {
        const { data } = await axios.get(`${API_BASE_URL}/plan/study-leaves`, { withCredentials: true, params: { status, search, page: page + 1, pageSize: 20 } });
        if (!cancelled) setResult(data);
      } catch (e) { if (!cancelled) setError(e.response?.data?.message || 'Không tải được danh sách bảo lưu.'); }
      finally { if (!cancelled) setLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [status, search, page, refresh]);
  return <AppLayout><Stack spacing={2}>
    <Typography variant="h5">Quản lý bảo lưu</Typography>
    <Typography variant="body2" color="text.secondary">Theo dõi yêu cầu, thời hạn và xử lý tiếp nhận học lại. Sắp hết hạn: còn tối đa 30 ngày. Quá hạn vẫn chờ xử lý, chưa tự động thôi học.</Typography>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <TextField size="small" label="Tìm mã hoặc tên học viên" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      <TextField select size="small" label="Trạng thái bảo lưu" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }} sx={{ minWidth: 240 }}>
        <MenuItem value="">Tất cả</MenuItem>{Object.entries(leaveStatusLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        <MenuItem value="extension_pending">Có gia hạn chờ duyệt</MenuItem>
      </TextField><Button disabled={loading} onClick={() => setRefresh(value => value + 1)}>Tải lại</Button>
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}
    <Box sx={{ bgcolor: 'white', border: '1px solid #DFE4E8', borderRadius: 1, overflowX: 'auto' }}>
      <Table size="small" aria-label="Danh sách bảo lưu"><TableHead><TableRow>
        {['Học viên', 'Lớp hành chính', 'Thời gian bảo lưu', 'Trạng thái', 'Quá hạn', 'Xử lý'].map(label => <TableCell key={label}>{label}</TableCell>)}
      </TableRow></TableHead><TableBody>{result.rows.map(row => <TableRow key={row.id}>
        <TableCell><Typography variant="body2" fontWeight={600}>{row.fullName}</Typography>{row.code} · {row.trainingLevel}</TableCell>
        <TableCell>{row.classCode || '—'}</TableCell><TableCell>{leaveDate(row.startDate)} – {leaveDate(row.endDate)}</TableCell>
        <TableCell><Chip size="small" color={row.status === 'overdue' ? 'error' : row.status === 'expiring' ? 'warning' : 'default'} label={leaveStatusLabels[row.status] || row.status} />
          {row.extensions?.some(extension => extension.status === 'pending') && <Typography variant="caption" display="block">Có gia hạn chờ duyệt</Typography>}</TableCell>
        <TableCell>{row.status === 'overdue' ? `${row.overdueDays} ngày` : '—'}</TableCell>
        <TableCell><Button component={Link} to={`/plan/admission-records/${row.admissionRecordId}?tab=leave`}>Mở hồ sơ</Button></TableCell>
      </TableRow>)}{!result.rows.length && <TableRow><TableCell colSpan={6} align="center">{loading ? 'Đang tải…' : 'Không có hồ sơ bảo lưu phù hợp.'}</TableCell></TableRow>}</TableBody></Table>
      <TablePagination component="div" count={result.total} page={page} rowsPerPage={20} rowsPerPageOptions={[20]} onPageChange={(_, next) => setPage(next)} labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`} />
    </Box>
  </Stack></AppLayout>;
}
