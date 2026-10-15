import React from "react";
import { Box, Typography } from "@mui/material";

const PopupFormField = ({ label, htmlFor, children }) => (
  <Box sx={{ flex: 1, minWidth: 0 }}>
    <Typography component="label" htmlFor={htmlFor} sx={{
      display: "block", mb: 0.75, fontSize: 13, fontWeight: 700,
      color: "#4b5e68", lineHeight: 1.5, textTransform: "uppercase",
    }}>
      {label}
    </Typography>
    {children}
  </Box>
);

export default PopupFormField;
