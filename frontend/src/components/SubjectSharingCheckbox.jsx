import React, { useEffect, useMemo, useState } from "react";
import { Checkbox, Divider, ListItemText, ListSubheader, MenuItem, Select, TextField, Typography } from "@mui/material";
import { toast } from "react-toastify";
import { isCommonMajor } from "../utils/majorScope";
import { matchingSharingMajorIds } from "../utils/subjectSharing";

// Select annotates every direct child as an option; the search header is not one.
function SharingMenuHeader(props) {
  return <ListSubheader {...props} role="presentation" aria-selected={undefined} />;
}
SharingMenuHeader.muiSkipListHighlight = true;
function SharingMenuDivider(props) {
  return <Divider {...props} role="separator" aria-selected={undefined} />;
}
SharingMenuDivider.muiSkipListHighlight = true;

export default function SubjectSharingCheckbox({ subject, majors = [], subjects = [], disabled = false, onChange }) {
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [, refreshLayout] = useState(0);
  useEffect(() => {
    if (!open) return undefined;
    const refresh = () => refreshLayout(value => value + 1);
    window.addEventListener("resize", refresh);
    window.visualViewport?.addEventListener("resize", refresh);
    window.visualViewport?.addEventListener("scroll", refresh);
    return () => {
      window.removeEventListener("resize", refresh);
      window.visualViewport?.removeEventListener("resize", refresh);
      window.visualViewport?.removeEventListener("scroll", refresh);
    };
  }, [open]);
  const candidates = useMemo(() => majors.filter((major) => (
    major.id !== subject.majorId && !isCommonMajor(major) && major.active !== false && major.program === subject.program
  )), [majors, subject.majorId, subject.program]);
  const candidateIds = useMemo(() => new Set(candidates.map((major) => major.id)), [candidates]);
  const matchingIds = useMemo(() => matchingSharingMajorIds(subject, subjects), [subject, subjects]);
  const eligible = candidates.filter(major => matchingIds.has(major.id));
  const selected = Array.isArray(subject.sharedMajorIds)
    ? subject.sharedMajorIds.filter((id) => candidateIds.has(id))
    : [];
  const invalidSelected = selected.filter(id => !matchingIds.has(id));
  const validSelected = selected.filter(id => matchingIds.has(id));

  const handleChange = async (event) => {
    const rawValue = typeof event.target.value === "string" ? event.target.value.split(",") : event.target.value;
    if (rawValue.some(id => !["__ALL__", "__CLEAN__"].includes(id) && !matchingIds.has(id) && !selected.includes(id))) return;
    const sharedMajorIds = rawValue.includes("__ALL__")
      ? (validSelected.length === eligible.length && invalidSelected.length === 0 ? [] : eligible.map((major) => major.id))
      : rawValue.includes("__CLEAN__") ? validSelected : rawValue.filter((id) => candidateIds.has(id) && matchingIds.has(id));
    setSaving(true);
    try {
      await onChange({
        sharedMajorIds,
        allowCrossMajor: sharedMajorIds.length > 0,
        canonicalSubjectId: null,
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể cập nhật phạm vi học chung");
    } finally {
      setSaving(false);
    }
  };

  const allSelected = eligible.length > 0 && validSelected.length === eligible.length && invalidSelected.length === 0;
  const searchKey = value => String(value || "").toLocaleLowerCase("vi").normalize("NFD")
    .replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d").trim();
  const visibleCandidates = candidates.filter(major => searchKey(`${major.code || ""} ${major.name}`).includes(searchKey(search)));

  return (
      <Select multiple size="small" value={selected} disabled={disabled || saving || candidates.length === 0}
        title={invalidSelected.length ? `${selected.length} ngành đã chọn; ${invalidSelected.length} ngành chưa phù hợp. Mở danh sách để xem chi tiết.` : undefined}
        data-dropdown-min-width="380" onOpen={() => { setSearch(""); setOpen(true); }} onClose={() => setOpen(false)}
        onChange={handleChange} onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()} displayEmpty
        renderValue={(values) => invalidSelected.length ? `${values.length} ngành ⚠`
          : values.length ? (values.length === candidates.length ? "Tất cả ngành" : `${values.length} ngành`) : "Riêng ngành"}
        inputProps={{ "aria-label": `Phạm vi học chung: ${subject.name || "Học phần mới"}` }}
        sx={{
          width: "100%",
          minWidth: 0,
          maxWidth: "100%",
          height: 30,
          fontSize: 11,
          color: invalidSelected.length ? "warning.dark" : "text.primary",
          bgcolor: "transparent",
          borderRadius: 0,
          "& .MuiSelect-select": { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", pl: "6px !important", pr: "22px !important" },
          "& .MuiOutlinedInput-notchedOutline, &:hover .MuiOutlinedInput-notchedOutline, &.Mui-focused .MuiOutlinedInput-notchedOutline": {
            border: 0,
          },
        }}
        MenuProps={{
          autoFocus: false,
          MenuListProps: { autoFocusItem: false },
          PaperProps: { sx: { maxHeight: 360 } },
          sx: {
            "&& .MuiMenuItem-root": { gap: 1, alignItems: "flex-start", overflowWrap: "normal", wordBreak: "normal" },
            "&& .MuiCheckbox-root": { flexShrink: 0, p: 0.5 },
            "&& .MuiListItemText-primary": { whiteSpace: "normal", overflowWrap: "normal", wordBreak: "normal", lineHeight: 1.5 },
          },
        }}>
        <SharingMenuHeader component="div" sx={{ bgcolor: "#fff", px: 1.5, py: 1, lineHeight: 1.5 }}
          onClick={event => event.stopPropagation()}
          onKeyDown={event => { if (event.key !== "Escape") event.stopPropagation(); }}>
          <Typography fontSize={13} fontWeight={700}>Phạm vi học chung</Typography>
          <Typography fontSize={12} color="text.secondary" sx={{ mb: 1 }}>
            Chỉ chọn ngành có học phần đang hoạt động, cùng tên, số tín chỉ và bậc đào tạo.
          </Typography>
          <TextField autoFocus fullWidth size="small" placeholder="Tìm chuyên ngành…" value={search}
            inputProps={{ "aria-label": "Tìm chuyên ngành học chung" }} onChange={event => setSearch(event.target.value)} />
          <Typography fontSize={12} color="text.secondary" sx={{ mt: 1 }}>Đã chọn {validSelected.length} / {eligible.length} ngành đủ điều kiện</Typography>
          {invalidSelected.length > 0 && <Typography fontSize={12} color="warning.main">Có {invalidSelected.length} ngành đã chọn trước đây không còn phù hợp.</Typography>}
        </SharingMenuHeader>
        <MenuItem value="__ALL__" aria-label="Chọn tất cả" disabled={!eligible.length && !selected.length} sx={{ fontWeight: 700 }}>
          <Checkbox size="small" checked={allSelected} indeterminate={selected.length > 0 && !allSelected} />
          <ListItemText primary="Chọn tất cả" secondary="Chỉ gồm các ngành đủ điều kiện" />
        </MenuItem>
        {invalidSelected.length > 0 && <MenuItem value="__CLEAN__"><ListItemText primary="Bỏ các ngành không phù hợp" /></MenuItem>}
        <SharingMenuDivider />
        {visibleCandidates.map((major) => (
          <MenuItem key={major.id} value={major.id} aria-label={major.code ? `${major.code} — ${major.name}` : major.name} disabled={!matchingIds.has(major.id)}>
            <Checkbox size="small" checked={selected.includes(major.id)} />
            <ListItemText primary={major.code ? `${major.code} — ${major.name}` : major.name}
              secondary={matchingIds.has(major.id) ? undefined : "Chưa có học phần cùng tên và số tín chỉ"} />
          </MenuItem>
        ))}
        {!visibleCandidates.length && <SharingMenuHeader component="div" sx={{ whiteSpace: "normal", lineHeight: 1.5, py: 2 }}>Không tìm thấy chuyên ngành phù hợp.</SharingMenuHeader>}
      </Select>
  );
}
