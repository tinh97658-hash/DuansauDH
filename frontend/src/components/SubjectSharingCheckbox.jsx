import React, { useMemo, useState } from "react";
import { Checkbox, Divider, ListItemText, MenuItem, Select } from "@mui/material";
import { toast } from "react-toastify";
import { isCommonMajor } from "../utils/majorScope";

export default function SubjectSharingCheckbox({ subject, majors = [], disabled = false, onChange }) {
  const [saving, setSaving] = useState(false);
  const candidates = useMemo(() => majors.filter((major) => (
    major.id !== subject.majorId && !isCommonMajor(major) && major.program === subject.program
  )), [majors, subject.majorId, subject.program]);
  const selected = Array.isArray(subject.sharedMajorIds) ? subject.sharedMajorIds : [];

  const handleChange = async (event) => {
    const rawValue = typeof event.target.value === "string" ? event.target.value.split(",") : event.target.value;
    const sharedMajorIds = rawValue.includes("__ALL__")
      ? (selected.length === candidates.length ? [] : candidates.map((major) => major.id))
      : rawValue;
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

  const allSelected = candidates.length > 0 && selected.length === candidates.length;

  return (
      <Select multiple size="small" value={selected} disabled={disabled || saving || candidates.length === 0}
        onChange={handleChange} onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()} displayEmpty
        renderValue={(values) => values.length ? (values.length === candidates.length ? "Tất cả ngành" : `${values.length} ngành`) : "Riêng ngành"}
        inputProps={{ "aria-label": `Phạm vi học chung: ${subject.name || "Học phần mới"}` }}
        sx={{ minWidth: 112, height: 30, fontSize: 11, bgcolor: "#fff" }}
        MenuProps={{ PaperProps: { sx: { maxHeight: 360, minWidth: 300 } } }}>
        <MenuItem value="__ALL__" sx={{ fontWeight: 700 }}>
          <Checkbox size="small" checked={allSelected} indeterminate={selected.length > 0 && !allSelected} />
          <ListItemText primary="Chọn tất cả" />
        </MenuItem>
        <Divider />
        {candidates.map((major) => (
          <MenuItem key={major.id} value={major.id}>
            <Checkbox size="small" checked={selected.includes(major.id)} />
            <ListItemText primary={`${major.code} — ${major.name}`} />
          </MenuItem>
        ))}
      </Select>
  );
}
