import React from "react";
import { Box, MenuItem, Pagination, Select, Stack, Typography } from "@mui/material";

const DEFAULT_PAGE_SIZE_OPTIONS = [20, 50, 100];

export default function ListPagination({
  count, page, pageSize, onPageChange, onPageSizeChange = null,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  disabled = false,
  recordLabel = "bản ghi", showSinglePageSummary = false,
  "aria-label": ariaLabel = "Phân trang danh sách", className,
}) {
  const totalPages = Math.ceil(count / pageSize);
  const sizeChoices = onPageSizeChange
    ? [...new Set([...pageSizeOptions, pageSize])].filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
    : [];
  const showPageSize = Boolean(onPageSizeChange && sizeChoices.length > 1 && count > sizeChoices[0]);
  if (totalPages <= 1 && !showPageSize && (!showSinglePageSummary || count === 0)) return null;

  return (
    <Box className={className} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) auto minmax(0, 1fr)" }, alignItems: "center", gap: 1, minHeight: 48, px: 0.5, pb: 0.5 }}>
      <Typography variant="caption" data-export-pagination="true" sx={{ color: "#607486", fontWeight: 600 }}>
        Hiển thị {page * pageSize + 1}–{Math.min((page + 1) * pageSize, count)} trên {count} {recordLabel}
      </Typography>
      {totalPages > 1 ? <Pagination
        aria-label={ariaLabel}
        disabled={disabled}
        page={page + 1}
        count={totalPages}
        onChange={(_, nextPage) => onPageChange(nextPage - 1)}
        color="primary"
        size="medium"
        showFirstButton
        showLastButton
        getItemAriaLabel={(type, itemPage, selected) => ({
          first: "Trang đầu", last: "Trang cuối", next: "Trang sau", previous: "Trang trước",
        }[type] || `${selected ? "Trang hiện tại, trang" : "Trang"} ${itemPage}`)}
        sx={{ justifySelf: "center", "& .MuiPagination-ul": { justifyContent: "center" }, "& .MuiPaginationItem-root": { minWidth: 38, height: 38, fontSize: 14, fontWeight: 600 } }}
      /> : <Box />}
      {showPageSize && (
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ justifySelf: { xs: "start", lg: "end" } }}>
          <Typography variant="caption" sx={{ color: "#607486", fontWeight: 600, whiteSpace: "nowrap" }}>
            Hiển thị
          </Typography>
          <Select
            size="small"
            value={pageSize}
            disabled={disabled}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            inputProps={{ "aria-label": "Số dòng mỗi trang" }}
            sx={{
              height: 32,
              fontSize: 12.5,
              fontWeight: 600,
              color: "#1c2936",
              bgcolor: "#fff",
              borderRadius: "4px",
              "& .MuiSelect-select": { py: "4px", pl: "10px", pr: "28px !important" },
              "& fieldset": { borderColor: "#c5d1db" },
              "&:hover fieldset": { borderColor: "#8fa6b9" },
            }}
          >
            {sizeChoices.map((size) => (
              <MenuItem key={size} value={size}>{size} / trang</MenuItem>
            ))}
          </Select>
        </Stack>
      )}
    </Box>
  );
}
