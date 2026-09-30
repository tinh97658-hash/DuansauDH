import React from "react";
import { Box, InputAdornment, TextField } from "@mui/material";
import { SearchRounded } from "@mui/icons-material";

/**
 * Search control shared by page-level filter bars.
 * Its dimensions and colours mirror the progress tracking filter bar.
 */
const FilterSearchField = ({
  label = "Tìm kiếm",
  inputLabel = label,
  sx,
  inputProps,
  InputProps,
  ...props
}) => (
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
    {label && (
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
    )}
    <TextField
      {...props}
      size="small"
      inputProps={{ "aria-label": inputLabel, ...inputProps }}
      InputProps={{
        ...InputProps,
        startAdornment: InputProps?.startAdornment ?? (
          <InputAdornment position="start">
            <SearchRounded sx={{ width: 16, height: 16, color: "#5B6F87" }} />
          </InputAdornment>
        ),
      }}
      sx={{
        width: "100%",
        "& .MuiOutlinedInput-root": {
          height: 38,
          bgcolor: "#fff",
          borderRadius: "7px",
          color: "#12263F",
          fontSize: 12,
          transition: "border-color .15s ease, box-shadow .15s ease",
          "& fieldset": { borderColor: "#B9CBD8" },
          "&:hover fieldset": { borderColor: "#9FB5C6" },
          "&.Mui-focused": { boxShadow: "0 0 0 3px rgba(11,127,163,.13)" },
          "&.Mui-focused fieldset": { borderColor: "#0B7FA3", borderWidth: 1 },
          "&.Mui-disabled": { bgcolor: "#F8FAFC" },
        },
        "& .MuiInputBase-input": { py: 0 },
        "& .MuiInputBase-input::placeholder": { color: "#5B6F87", opacity: 1 },
        "& .MuiInputAdornment-root": { mr: "8px" },
      }}
    />
  </Box>
);

export default FilterSearchField;
