import theme from "../../theme";

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
    expect(theme.components.MuiButton.styleOverrides.root.fontFamily).toBe("inherit");
    expect(theme.components.MuiButton.styleOverrides.root.fontSize).toBe("12.5px");
    expect(theme.components.MuiMenuItem.styleOverrides.root.fontSize).toBe("12.5px");
    expect(theme.components.MuiFormControlLabel.styleOverrides.label.fontSize).toBe("12.5px");
  });
});
