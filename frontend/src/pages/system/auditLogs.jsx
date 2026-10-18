import React, { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, CircularProgress, MenuItem, Paper, Stack, TableBody, TableCell,
  TableContainer, TablePagination, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import FeatureLayout from "../../components/FeatureLayout";
import FilterSelectField from "../../components/FilterSelectField";
import ResizableTable from "../../components/ResizableTable";
import { listAuditLogs } from "../../features/accounts/api";
import { AUDIT_ACTION_LABELS, auditActionLabel } from "../../features/accounts/constants";

const columns = [
  { key: "createdAt", label: "Thời gian", width: 180, minWidth: 150 },
  { key: "action", label: "Hành động", width: 200, minWidth: 150 },
  { key: "actor", label: "Người thực hiện", width: 220, minWidth: 150 },
  { key: "target", label: "Đối tượng", width: 220, minWidth: 150 },
  { key: "ip", label: "Địa chỉ IP", width: 140, minWidth: 110 },
  { key: "metadata", label: "Chi tiết", width: 280, minWidth: 160 },
];

const formatTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("vi-VN");
};

const renderActor = (person) => (person ? `${person.name || ""} (${person.email || ""})` : "—");
const renderMetadata = (metadata) => {
  if (!metadata || (typeof metadata === "object" && !Object.keys(metadata).length)) return "—";
  const text = typeof metadata === "string" ? metadata : JSON.stringify(metadata);
  return <Tooltip title={text}><span>{text.length > 60 ? `${text.slice(0, 60)}…` : text}</span></Tooltip>;
};

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listAuditLogs({ action: action || undefined, from: from || undefined, to: to || undefined, page: page + 1, pageSize });
      setLogs(Array.isArray(data?.rows) ? data.rows : []);
      setTotal(Number(data?.total) || 0);
    } catch (failure) {
      setError(failure.response?.data?.message || "Không thể tải nhật ký thao tác.");
    } finally {
      setLoading(false);
    }
  }, [action, from, to, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  return (
    <FeatureLayout title="Nhật ký thao tác" group="Tài khoản & phân quyền" desc="Theo dõi các thao tác quản lý tài khoản và phân quyền.">
      <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, bgcolor: "#FFF", borderColor: "#C6D5E1", borderRadius: "10px", boxShadow: "0 2px 6px rgba(18, 59, 98, 0.07)" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="flex-end">
          <FilterSelectField label="Hành động" value={action} onChange={(event) => { setAction(event.target.value); setPage(0); }} sx={{ width: { xs: "100%", md: 240 } }}>
            <MenuItem value="">Tất cả hành động</MenuItem>
            {Object.entries(AUDIT_ACTION_LABELS).map(([code, label]) => <MenuItem key={code} value={code}>{label}</MenuItem>)}
          </FilterSelectField>
          <TextField label="Từ ngày" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(0); }} size="small" InputLabelProps={{ shrink: true }} sx={{ width: { xs: "100%", md: 180 } }} />
          <TextField label="Đến ngày" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(0); }} size="small" InputLabelProps={{ shrink: true }} sx={{ width: { xs: "100%", md: 180 } }} />
          <Button onClick={load} disabled={loading} startIcon={<RefreshRounded />} sx={{ height: 38, textTransform: "none", fontWeight: 600 }}>Tải lại</Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <ResizableTable columns={columns} storageKey="system-audit-logs-columns" aria-label="Nhật ký thao tác">
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={columns.length} align="center" sx={{ py: 4, color: "text.secondary" }}>Không có bản ghi phù hợp.</TableCell></TableRow>
            ) : logs.map((log) => (
              <TableRow key={log.id} hover>
                <TableCell>{formatTime(log.createdAt)}</TableCell>
                <TableCell>{auditActionLabel(log.action)}</TableCell>
                <TableCell>{renderActor(log.actor)}</TableCell>
                <TableCell>{renderActor(log.target)}</TableCell>
                <TableCell>{log.ip || "—"}</TableCell>
                <TableCell>{renderMetadata(log.metadata)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </ResizableTable>
      </TableContainer>
      <TablePagination
        component="div"
        count={total}
        page={page}
        rowsPerPage={pageSize}
        rowsPerPageOptions={[25, 50, 100]}
        onPageChange={(_, next) => setPage(next)}
        onRowsPerPageChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }}
        getItemAriaLabel={(type) => (type === "next" ? "Trang sau" : "Trang trước")}
        labelDisplayedRows={({ from: start, to: end, count }) => `${start}–${end} / ${count}`}
        labelRowsPerPage="Số dòng mỗi trang"
        sx={{ bgcolor: "#fff", border: "1px solid #D7E4EE", borderTop: 0 }}
      />
      <Typography sx={{ fontSize: 12, color: "#607486", mt: 1 }}>Tổng {total} bản ghi.</Typography>
    </FeatureLayout>
  );
};

export default AuditLogs;
