import React from "react";
import { MenuItem, Stack, TextField } from "@mui/material";
export const teachingLoadPayload = (form) => form.teachingUnits !== undefined && form.teachingUnits !== null && form.teachingUnits !== "" ? {
  teachingUnits: Number(form.teachingUnits), teachingUnitType: form.teachingUnitType || "periods",
} : {};
export default function TeachingLoadFields({ value, onChange }) {
  return <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ my: 1 }}>
    <TextField type="number" size="small" label="Tổng giờ/tiết học phần" value={value.teachingUnits ?? ""} onChange={(e) => onChange({ ...value, teachingUnits: e.target.value })} inputProps={{ min: 1, step: 1 }} helperText="Khai báo riêng, không quy đổi từ tín chỉ." />
    <TextField select size="small" label="Đơn vị" value={value.teachingUnitType || "periods"} onChange={(e) => onChange({ ...value, teachingUnitType: e.target.value })}>
      <MenuItem value="periods">Tiết</MenuItem><MenuItem value="hours">Giờ (60 phút)</MenuItem>
    </TextField>
  </Stack>;
}
