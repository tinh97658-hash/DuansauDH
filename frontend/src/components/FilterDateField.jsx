import React from "react";
import { Box } from "@mui/material";
import DateField from "./DateField";

/** Date control matching the labels and dimensions of other filter-bar fields. */
export default function FilterDateField({ label, inputLabel = label, sx, inputProps, ...props }) {
  return <Box component="label" sx={{ display: "grid", gap: "6px", minWidth: 0, m: 0, ...sx }}>
    <Box component="span" sx={{ color: "#526A82", fontSize: "10.5px", fontWeight: 700,
      letterSpacing: ".025em", lineHeight: 1.2, textTransform: "uppercase" }}>{label}</Box>
    <DateField {...props} fullWidth size="small" inputProps={{ "aria-label": inputLabel, ...inputProps }}
      sx={{
        "& .MuiOutlinedInput-root": {
          height: 38, minHeight: 38, bgcolor: "#fff", borderRadius: "7px", color: "#12263F", fontSize: 12,
          "& fieldset": { borderColor: "#B9CBD8" },
          "&:hover fieldset": { borderColor: "#9FB5C6" },
          "&.Mui-focused": { boxShadow: "0 0 0 3px rgba(11,127,163,.13)" },
          "&.Mui-focused fieldset": { borderColor: "#0B7FA3", borderWidth: 1 },
          "&.Mui-disabled": { bgcolor: "#F8FAFC" },
        },
        "& .MuiOutlinedInput-input": { height: "100%", py: 0, px: "10px" },
      }} />
  </Box>;
}
