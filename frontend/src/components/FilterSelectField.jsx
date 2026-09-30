import React from "react";
import { Box, FormControl, Select } from "@mui/material";

/** Select control shared by page-level filter bars. */
const FilterSelectField = ({ label, inputLabel = label, children, sx, selectSx, ...props }) => (
  <Box
    component="label"
    sx={{
      display: "grid",
      gap: "6px",
      minWidth: 0,
      m: 0,
      ...sx,
    }}
  >
    <Box
      component="span"
      sx={{
        color: "#526A82",
        fontSize: "10.5px",
        fontWeight: 700,
        letterSpacing: ".025em",
        lineHeight: 1.2,
        textTransform: "uppercase",
      }}
    >
      {label}
    </Box>
    <FormControl size="small" sx={{ minWidth: 0, width: "100%" }}>
      <Select
        {...props}
        displayEmpty
        inputProps={{ "aria-label": inputLabel, ...props.inputProps }}
        sx={{
          width: "100%",
          height: 38,
          bgcolor: "#fff",
          borderRadius: "7px",
          color: "#12263F",
          fontSize: 12,
          textAlign: "left",
          transition: "border-color .15s ease, box-shadow .15s ease",
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#B9CBD8" },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#9FB5C6" },
          "&.Mui-focused": { boxShadow: "0 0 0 3px rgba(11,127,163,.13)" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#0B7FA3", borderWidth: 1 },
          "&.Mui-disabled": { bgcolor: "#F8FAFC" },
          "& .MuiSelect-select": { py: 0, pr: "34px !important" },
          ...selectSx,
        }}
      >
        {children}
      </Select>
    </FormControl>
  </Box>
);

export default FilterSelectField;
