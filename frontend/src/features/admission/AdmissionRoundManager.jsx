import React, { useState } from "react";
import { Alert, Button, Chip, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from "@mui/material";
import { ArrowRightEndOnRectangleIcon, PencilSquareIcon } from "../../components/AppIcons";
import AppDialog from "../../components/AppDialog";
import FilterSearchField from "../../components/FilterSearchField";
import FilterSelectField from "../../components/FilterSelectField";
import ListPagination from "../../components/ListPagination";
import { formatDate } from "../../utils/dateFormat";

const PAGE_SIZE = 15;
const roundActionSx = {
  "--app-table-icon-size": "24px",
  "--app-table-action-size": "36px",
  color: "#075985",
  bgcolor: "transparent",
  border: 0,
  boxShadow: "none",
  "&:hover": { color: "#0c4a6e", bgcolor: "transparent" },
  "&.Mui-disabled": { color: "#64748b", bgcolor: "transparent" },
};
const searchKey = value => String(value || "").toLocaleLowerCase("vi")
  .normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d").trim();

export default function AdmissionRoundManager({ open, onClose, rounds, selectedRoundId, admin,
  loading, error, onRefresh, onSelect, onEdit, onCreate }) {
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("all");
  const [page, setPage] = useState(0);
  const years = [...new Set(rounds.map(round => round.academicYear).filter(Boolean))]
    .sort((a, b) => String(b).localeCompare(String(a), "vi", { numeric: true }));
  const query = searchKey(search);
  const filtered = rounds.filter(round => (year === "all" || round.academicYear === year)
    && searchKey(`${round.name} ${round.academicYear}`).includes(query));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return <AppDialog open={open} onClose={onClose} title="DANH SÁCH ĐỢT XÉT TUYỂN" maxWidth={false} cancelText="Đóng"
    PaperProps={{ sx: {
      width: "94vw", maxWidth: "calc(100vw - 2 * var(--app-dialog-gap, 24px))",
      height: "88dvh", "--app-dialog-max-height": "88dvh",
    } }}
    contentSx={{ display: "flex", overflow: "hidden", paddingBottom: "0 !important" }}
    actions={<>
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <ListPagination count={filtered.length} page={currentPage} pageSize={PAGE_SIZE} onPageChange={setPage}
          disabled={loading} showSinglePageSummary recordLabel="đợt xét tuyển" aria-label="Phân trang đợt xét tuyển" />
      </Stack>
      <Button variant="outlined" onClick={onClose}>Đóng</Button>
    </>}>
    <Stack spacing={2} sx={{ flex: 1, minWidth: 0, minHeight: 0, "& > :not(.admission-round-table-frame)": { flexShrink: 0 } }}>
      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="flex-end">
        <FilterSearchField label="Tìm đợt xét tuyển" placeholder="Nhập tên đợt hoặc năm…" value={search}
          onChange={event => { setSearch(event.target.value); setPage(0); }} sx={{ flex: "1 1 240px" }} />
        <FilterSelectField label="Lọc năm tuyển sinh" value={year}
          onChange={event => { setYear(event.target.value); setPage(0); }} sx={{ width: { xs: "100%", sm: 180 } }}>
          <MenuItem value="all">Tất cả năm</MenuItem>
          {years.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
        </FilterSelectField>
        <Button variant="outlined" disabled={loading} onClick={onRefresh}>Tải lại danh sách</Button>
        {admin && <Button variant="contained" disabled={loading} onClick={onCreate}>Tạo đợt mới</Button>}
      </Stack>
      <Typography variant="body2" role="status">{loading ? "Đang tải danh sách đợt…" : `Hiển thị ${filtered.length} / ${rounds.length} đợt xét tuyển`}</Typography>
      <Stack className="admission-round-table-frame" sx={{ flex: 1, minHeight: 0, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
      <TableContainer sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <Table stickyHeader size="small" aria-label="Danh sách đợt xét tuyển" sx={{ minWidth: 720 }}>
          <TableHead><TableRow>
            <TableCell>Tên đợt</TableCell><TableCell>Năm tuyển sinh</TableCell>
            <TableCell align="center">Ngành đã nhập ngưỡng</TableCell><TableCell>Ngày tạo</TableCell><TableCell>Thao tác</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {visible.map(round => <TableRow key={round.id} selected={round.id === selectedRoundId}>
              <TableCell><Stack spacing={0.5} alignItems="flex-start">
                <Typography variant="body2" fontWeight={600}>{round.name}</Typography>
                {round.id === selectedRoundId && <Chip size="small" label="Đang chọn" color="primary" variant="outlined" />}
              </Stack></TableCell>
              <TableCell>{round.academicYear}</TableCell>
              <TableCell align="center">{(round.majorThresholds || []).filter(entry => entry.cutoff != null).length}</TableCell>
              <TableCell>{formatDate(round.createdAt)}</TableCell>
              <TableCell><Stack direction="row" gap={1}>
                <Tooltip title={`Chọn đợt ${round.name}`} arrow>
                  <span style={{ display: "inline-flex" }}>
                    <IconButton size="small" color="primary" sx={roundActionSx} disabled={loading || round.id === selectedRoundId}
                      aria-label={`Chọn đợt ${round.name}`} onClick={() => onSelect(round.id)}>
                      <ArrowRightEndOnRectangleIcon sx={{ fontSize: 24 }} />
                    </IconButton>
                  </span>
                </Tooltip>
                {admin && <Tooltip title={`Sửa đợt ${round.name}`} arrow>
                  <span style={{ display: "inline-flex" }}>
                    <IconButton size="small" color="primary" sx={roundActionSx} disabled={loading} aria-label={`Sửa đợt ${round.name}`} onClick={() => onEdit(round)}>
                      <PencilSquareIcon sx={{ fontSize: 24 }} />
                    </IconButton>
                  </span>
                </Tooltip>}
              </Stack></TableCell>
            </TableRow>)}
            {!visible.length && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>
              {loading ? "Đang tải…" : !rounds.length ? "Chưa có đợt xét tuyển." : "Không tìm thấy đợt phù hợp. Thử đổi từ khóa hoặc chọn tất cả năm."}
            </TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
      </Stack>
    </Stack>
  </AppDialog>;
}
