import React from "react";
import { render, screen } from "@testing-library/react";
import { Alert } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import {
  default as theme,
  CONTROL_BORDER_RADIUS,
  TABLE_BORDER_COLOR,
  TABLE_BORDER_RADIUS,
  TABLE_HEADER_BACKGROUND,
  TABLE_ROW_BORDER_COLOR,
} from "../../theme";

describe("shared application typography", () => {
  it("uses the same base typography and text colors as Create Course Offering", () => {
    expect(theme.typography.fontFamily).toContain("Segoe UI");
    expect(theme.typography.body1.fontSize).toBe("12.5px");
    expect(theme.typography.body2.fontSize).toBe("12.5px");
    expect(theme.typography.button.fontSize).toBe("12.5px");
    expect(theme.palette.text.primary).toBe("#102333");
    expect(theme.palette.text.secondary).toBe("#354959");
  });

  it("propagates the shared font and size to common MUI controls", () => {
    expect(theme.components.MuiTypography.styleOverrides.root.fontFamily).toBe("inherit");
    expect(theme.components.MuiButton.styleOverrides.root.fontFamily).toBe("inherit");
    expect(theme.components.MuiButton.styleOverrides.root.fontSize).toBe("12.5px");
    expect(theme.components.MuiMenuItem.styleOverrides.root.fontSize).toBe("12.5px");
    expect(theme.components.MuiFormControlLabel.styleOverrides.label.fontSize).toBe("12.5px");
  });

  it("keeps tables and rounded text controls visually consistent", () => {
    expect(theme.shape.borderRadius).toBe(CONTROL_BORDER_RADIUS);
    expect(theme.components.MuiOutlinedInput.styleOverrides.root.borderRadius).toBe(CONTROL_BORDER_RADIUS);
    expect(theme.components.MuiTableContainer.styleOverrides.root.borderRadius).toBe(TABLE_BORDER_RADIUS);
    expect(theme.components.MuiTableContainer.styleOverrides.root.border).toBe(`1px solid ${TABLE_BORDER_COLOR}`);
    expect(theme.components.MuiTableHead.styleOverrides.root.backgroundColor).toBe(TABLE_HEADER_BACKGROUND);
    expect(theme.components.MuiTableCell.styleOverrides.root.borderColor).toBe(TABLE_ROW_BORDER_COLOR);
  });

  it("renders high-contrast backgrounds and left accent borders on alerts", () => {
    render(
      <ThemeProvider theme={theme}>
        <Alert severity="error">Lỗi nghiêm trọng</Alert>
        <Alert severity="warning">Cảnh báo quan trọng</Alert>
        <Alert severity="info">Thông tin lưu ý</Alert>
        <Alert severity="success">Thành công</Alert>
      </ThemeProvider>,
    );
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(4);
    expect(alerts[0]).toHaveStyle({ backgroundColor: "rgb(253, 236, 236)", color: "rgb(127, 29, 29)" });
    expect(alerts[1]).toHaveStyle({ backgroundColor: "rgb(254, 243, 199)", color: "rgb(120, 53, 15)" });
    expect(alerts[2]).toHaveStyle({ backgroundColor: "rgb(230, 243, 250)", color: "rgb(11, 58, 83)" });
    expect(alerts[3]).toHaveStyle({ backgroundColor: "rgb(230, 246, 236)", color: "rgb(11, 81, 40)" });
  });
});
