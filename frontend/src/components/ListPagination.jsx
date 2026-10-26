import React from "react";
import { Box, Pagination, Typography } from "@mui/material";

export default function ListPagination({
  count, page, pageSize, onPageChange, disabled = false,
  recordLabel = "bản ghi", showSinglePageSummary = false,
  "aria-label": ariaLabel = "Phân trang danh sách", className,
}) {
  const totalPages = Math.ceil(count / pageSize);
  if (totalPages <= 1 && (!showSinglePageSummary || count === 0)) return null;

  return (
    <Box className={className} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) auto minmax(0, 1fr)" }, alignItems: "center", gap: 1, minHeight: 48, px: 0.5, pb: 0.5 }}>
      <Typography variant="caption" sx={{ color: "#607486", fontWeight: 600 }}>
        Hiển thị {page * pageSize + 1}–{Math.min((page + 1) * pageSize, count)} trên {count} {recordLabel}
      </Typography>
      {totalPages > 1 && <Pagination
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
      />}
    </Box>
  );
}
