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
    expect(theme.palette.text.primary).toBe("#172B3A");
    expect(theme.palette.text.secondary).toBe("#607486");
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
});
