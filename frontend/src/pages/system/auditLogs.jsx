import React, { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, CircularProgress, MenuItem, Paper, TableBody, TableCell,
  TableContainer, TablePagination, TableRow, Tab, Tabs, Tooltip, Typography,
} from "@mui/material";
import FeatureLayout from "../../components/FeatureLayout";
import FilterSelectField from "../../components/FilterSelectField";
import FilterSearchField from "../../components/FilterSearchField";
import ResizableTable from "../../components/ResizableTable";
import { listAuditLogs, listChangeLogs, listChangeLogTables } from "../../features/accounts/api";
import { AUDIT_ACTION_LABELS, auditActionLabel, changeOperationLabel, tableLabel } from "../../features/accounts/constants";

const managementColumns = [
  { key: "createdAt", label: "Thời gian", width: 180, minWidth: 150 },
  { key: "action", label: "Hành động", width: 200, minWidth: 150 },
  { key: "actor", label: "Người thực hiện", width: 220, minWidth: 150 },
  { key: "target", label: "Đối tượng", width: 220, minWidth: 150 },
  { key: "ip", label: "Địa chỉ IP", width: 140, minWidth: 110 },
  { key: "metadata", label: "Chi tiết", width: 280, minWidth: 180 },
];

const changeColumns = [
  { key: "changedAt", label: "Thời gian", width: 180, minWidth: 150 },
  { key: "operation", label: "Hành động", width: 120, minWidth: 100 },
  { key: "tableName", label: "Bảng dữ liệu", width: 220, minWidth: 160 },
  { key: "rowPk", label: "Khóa bản ghi", width: 180, minWidth: 140 },
  { key: "actor", label: "Người thực hiện", width: 220, minWidth: 150 },
  { key: "changedColumns", label: "Cột thay đổi", width: 220, minWidth: 160 },
  { key: "payload", label: "Dữ liệu", width: 280, minWidth: 180 },
];

const formatTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("vi-VN");
};

const renderActor = (person) => (person ? `${person.name || ""} (${person.email || ""})` : "—");
const renderChangeActor = (log) => log.actorEmail || log.actorStaffId || "—";
const renderMetadata = (metadata) => {
  if (!metadata || (typeof metadata === "object" && !Object.keys(metadata).length)) return "—";
  const text = typeof metadata === "string" ? metadata : JSON.stringify(metadata);
  return <Tooltip title={text}><span>{text.length > 60 ? `${text.slice(0, 60)}…` : text}</span></Tooltip>;
};

const renderChangedColumns = (columns) => {
  if (!Array.isArray(columns) || columns.length === 0) return "—";
  const text = columns.join(", ");
  return <Tooltip title={text}><span>{text.length > 40 ? `${text.slice(0, 40)}…` : text}</span></Tooltip>;
};

const payloadOf = (log) => (log.operation === "DELETE" ? log.oldData : log.newData);

const filterPaperSx = {
  p: 1.5, mb: 1.5, bgcolor: "#FFF", borderColor: "#C6D5E1",
  borderRadius: "10px", boxShadow: "0 2px 6px rgba(18, 59, 98, 0.07)",
};

const DateFilter = ({ label, value, onChange }) => (
  <FilterSearchField
    label={label}
    type="date"
    value={value}
    onChange={onChange}
    InputProps={{ startAdornment: false }}
    sx={{ width: { xs: "100%", md: 180 } }}
  />
);

const ManagementLogs = () => {
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
    <>
      <Paper variant="outlined" sx={filterPaperSx}>
        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 1.5, alignItems: "flex-end", flexWrap: "wrap" }}>
          <FilterSelectField label="Hành động" value={action} onChange={(event) => { setAction(event.target.value); setPage(0); }} sx={{ width: { xs: "100%", md: 240 } }}>
            <MenuItem value="">Tất cả hành động</MenuItem>
            {Object.entries(AUDIT_ACTION_LABELS).map(([code, label]) => <MenuItem key={code} value={code}>{label}</MenuItem>)}
          </FilterSelectField>
          <DateFilter label="Từ ngày" value={from} onChange={(event) => { setFrom(event.target.value); setPage(0); }} />
          <DateFilter label="Đến ngày" value={to} onChange={(event) => { setTo(event.target.value); setPage(0); }} />
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <ResizableTable columns={managementColumns} storageKey="system-audit-logs-columns" aria-label="Nhật ký thao tác">
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={managementColumns.length} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={managementColumns.length} align="center" sx={{ py: 4, color: "text.secondary" }}>Không có bản ghi phù hợp.</TableCell></TableRow>
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
    </>
  );
};

const DataChangeLogs = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [table, setTable] = useState("");
  const [operation, setOperation] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listChangeLogs({ table: table || undefined, operation: operation || undefined, from: from || undefined, to: to || undefined, page: page + 1, pageSize });
      setLogs(Array.isArray(data?.rows) ? data.rows : []);
      setTotal(Number(data?.total) || 0);
    } catch (failure) {
      setError(failure.response?.data?.message || "Không thể tải nhật ký thay đổi dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, [table, operation, from, to, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    listChangeLogTables()
      .then((data) => setTables(Array.isArray(data) ? data : []))
      .catch(() => setTables([]));
  }, []);

  return (
    <>
      <Paper variant="outlined" sx={filterPaperSx}>
        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 1.5, alignItems: "flex-end", flexWrap: "wrap" }}>
          <FilterSelectField label="Bảng dữ liệu" value={table} onChange={(event) => { setTable(event.target.value); setPage(0); }} sx={{ width: { xs: "100%", md: 240 } }}>
            <MenuItem value="">Tất cả bảng</MenuItem>
            {tables.map((name) => <MenuItem key={name} value={name}>{tableLabel(name)}</MenuItem>)}
          </FilterSelectField>
          <FilterSelectField label="Hành động" value={operation} onChange={(event) => { setOperation(event.target.value); setPage(0); }} sx={{ width: { xs: "100%", md: 180 } }}>
            <MenuItem value="">Tất cả hành động</MenuItem>
            <MenuItem value="INSERT">Thêm mới</MenuItem>
            <MenuItem value="UPDATE">Cập nhật</MenuItem>
            <MenuItem value="DELETE">Xóa</MenuItem>
          </FilterSelectField>
          <DateFilter label="Từ ngày" value={from} onChange={(event) => { setFrom(event.target.value); setPage(0); }} />
          <DateFilter label="Đến ngày" value={to} onChange={(event) => { setTo(event.target.value); setPage(0); }} />
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <ResizableTable columns={changeColumns} storageKey="system-change-logs-columns" aria-label="Nhật ký thay đổi dữ liệu">
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={changeColumns.length} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={changeColumns.length} align="center" sx={{ py: 4, color: "text.secondary" }}>Không có bản ghi phù hợp.</TableCell></TableRow>
            ) : logs.map((log) => (
              <TableRow key={log.id} hover>
                <TableCell>{formatTime(log.changedAt)}</TableCell>
                <TableCell>{changeOperationLabel(log.operation)}</TableCell>
                <TableCell>{tableLabel(log.tableName)}</TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{log.rowPk || "—"}</TableCell>
                <TableCell>{renderChangeActor(log)}</TableCell>
                <TableCell>{renderChangedColumns(log.changedColumns)}</TableCell>
                <TableCell>{renderMetadata(payloadOf(log))}</TableCell>
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
    </>
  );
};

const TAB_DESCRIPTIONS = [
  "Nhật ký thao tác quản lý: các thao tác tài khoản & phân quyền (tạo/sửa/khóa/mở tài khoản, đặt lại mật khẩu, đổi quyền vai trò) cùng các lần đăng nhập/đăng xuất của nhân sự.",
  "Nhật ký thay đổi dữ liệu: mọi thay đổi ở tầng cơ sở dữ liệu (thêm/sửa/xóa bản ghi trên toàn bộ bảng nghiệp vụ, kể cả SQL thủ công); cột người thực hiện được gắn khi thao tác nằm trong một giao dịch.",
];

const AuditLogs = () => {
  const [tab, setTab] = useState(0);

  return (
    <FeatureLayout title="Nhật ký thao tác" group="Tài khoản & phân quyền" desc="Theo dõi thao tác quản lý tài khoản/phân quyền và mọi thay đổi dữ liệu trong hệ thống.">
      <Box sx={{ borderBottom: "1px solid #C6D5E1", mb: 1.5 }}>
        <Tabs value={tab} onChange={(_, next) => setTab(next)} variant="scrollable" allowScrollButtonsMobile>
          <Tab label="Thao tác quản lý" sx={{ textTransform: "none", fontWeight: 600 }} />
          <Tab label="Thay đổi dữ liệu" sx={{ textTransform: "none", fontWeight: 600 }} />
        </Tabs>
      </Box>
      <Typography sx={{ fontSize: 12.5, color: "#526A82", mb: 1.5, lineHeight: 1.5 }}>{TAB_DESCRIPTIONS[tab]}</Typography>
      {tab === 0 ? <ManagementLogs /> : <DataChangeLogs />}
    </FeatureLayout>
  );
};

export default AuditLogs;
