import React, { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { Alert, Checkbox, TextField, MenuItem } from "@mui/material";
import { AcademicCapIcon } from "../../components/AppIcons";
import { theme } from "../../theme";

it("renders Heroicons paths while preserving MUI styling, refs and accessible titles", () => {
  const ref = createRef();
  render(<ThemeProvider theme={theme}><AcademicCapIcon ref={ref} titleAccess="Đào tạo" fontSize="small" color="primary" sx={[{ width: 18 }, { height: 18 }]} /></ThemeProvider>);
  const icon = screen.getByRole("img", { name: "Đào tạo" });
  expect(ref.current).toBe(icon);
  expect(icon).toHaveAttribute("data-heroicon", "AcademicCapIcon");
  expect(icon).toHaveAttribute("viewBox", "0 0 24 24");
  expect(icon.querySelector("path")).toBeInTheDocument();
  expect(icon).toHaveStyle({ fill: "none", width: "18px", height: "18px" });
  expect(icon).toHaveClass("MuiSvgIcon-fontSizeSmall", "MuiSvgIcon-colorPrimary");
});

it("keeps checked boxes square and hides decorative form icons from accessibility names", () => {
  const { container } = render(<ThemeProvider theme={theme}>
    <Alert severity="warning">Cần kiểm tra</Alert>
    <Checkbox checked readOnly inputProps={{ "aria-label": "Đã chọn" }} />
    <TextField select label="Trạng thái" value="active" onChange={() => {}}><MenuItem value="active">Hoạt động</MenuItem></TextField>
  </ThemeProvider>);
  expect(container.querySelector('.MuiAlert-icon [data-heroicon="ExclamationTriangleIcon"]')).toBeInTheDocument();
  expect(container.querySelector('.MuiCheckbox-root [data-testid="CheckBoxIcon"]')).toBeInTheDocument();
  expect(container.querySelector('.MuiCheckbox-root [data-heroicon="CheckCircleIcon"]')).not.toBeInTheDocument();
  expect(container.querySelector('.MuiSelect-icon[data-heroicon="ChevronDownIcon"]')).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "Đã chọn" })).toBeChecked();
});
