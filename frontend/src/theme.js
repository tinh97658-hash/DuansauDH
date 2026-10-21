import { createTheme } from "@mui/material/styles";

export const APP_FONT_FAMILY = '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif';
export const TABLE_BORDER_COLOR = "#687C8E";
export const TABLE_ROW_BORDER_COLOR = "#718292";
export const TABLE_HEADER_BACKGROUND = "#DCE7F1";
export const TABLE_BORDER_RADIUS = 0;
export const TABLE_HOVER_BACKGROUND = "#EAF2F8";
export const CONTROL_BORDER_RADIUS = 0;

/**
 * Institutional Theme for University Postgraduate Operations System
 * Strictly following .rulesforai and operational workspace reference design
 */
export const theme = createTheme({
  palette: {
    primary: {
      main: "#00658A",
      light: "#EBF5FB",
      dark: "#004D6B",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#173E75",
      light: "#EBF2F7",
      dark: "#0F274B",
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#F5F7F8",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#102333",
      secondary: "#354959",
      disabled: "#526576",
    },
    divider: "#718292",
    success: {
      main: "#137B3B",
      light: "#E6F4EA",
      dark: "#0E5E2D",
      contrastText: "#FFFFFF",
    },
    warning: {
      main: "#934B0D",
      light: "#FEF7E0",
      dark: "#8F4B10",
      contrastText: "#FFFFFF",
    },
    error: {
      main: "#B52D2D",
      light: "#FCE8E6",
      dark: "#8C2222",
      contrastText: "#FFFFFF",
    },
    info: {
      main: "#00658A",
      light: "#EBF5FB",
      dark: "#004D6B",
      contrastText: "#FFFFFF",
    },
  },
  shape: {
    borderRadius: CONTROL_BORDER_RADIUS,
  },
  typography: {
    fontFamily: APP_FONT_FAMILY,
    fontSize: 12.5,
    h1: { fontSize: "24px", fontWeight: 700, color: "#173E75" },
    h2: { fontSize: "20px", fontWeight: 700, color: "#173E75" },
    h3: { fontSize: "18px", fontWeight: 700, color: "#173E75" },
    h4: { fontSize: "16px", fontWeight: 700, color: "#173E75" },
    h5: { fontSize: "15px", fontWeight: 700, color: "#173E75" },
    h6: { fontSize: "14px", fontWeight: 700, color: "#173E75" },
    subtitle1: { fontSize: "13px", fontWeight: 600, color: "#102333" },
    subtitle2: { fontSize: "12.5px", fontWeight: 600, color: "#102333" },
    body1: { fontSize: "12.5px", color: "#102333", lineHeight: 1.5 },
    body2: { fontSize: "12.5px", color: "#102333", lineHeight: 1.45 },
    caption: { fontSize: "11px", color: "#354959" },
    button: { textTransform: "none", fontWeight: 600, fontSize: "12.5px" },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // InputBase normally inserts these global rules for every input mount.
        // Keep one copy for the application, including browser autofill support.
        "@keyframes mui-auto-fill": { from: { display: "block" } },
        "@keyframes mui-auto-fill-cancel": { from: { display: "block" } },
        body: {
          backgroundColor: "#F5F7F8",
          color: "#102333",
          fontFamily: APP_FONT_FAMILY,
          fontSize: "12.5px",
          lineHeight: 1.5,
          margin: 0,
        },
      },
    },
    MuiInputBase: {
      defaultProps: { disableInjectingGlobalStyles: true },
      styleOverrides: {
        input: {
          "&::placeholder": { color: "#526576", opacity: 1 },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          fontSize: "12.5px",
          fontFamily: "inherit",
          borderRadius: 0,
          boxShadow: "none",
          padding: "6px 14px",
          "&:hover": {
            boxShadow: "none",
          },
        },
        containedPrimary: {
          backgroundColor: "#00658A",
          "&:hover": {
            backgroundColor: "#004D6B",
          },
        },
        containedSecondary: {
          backgroundColor: "#173E75",
          "&:hover": {
            backgroundColor: "#0F274B",
          },
        },
        containedSuccess: {
          backgroundColor: "#137B3B",
          "&:hover": {
            backgroundColor: "#0E5E2D",
          },
        },
        containedError: {
          backgroundColor: "#B52D2D",
          "&:hover": {
            backgroundColor: "#8C2222",
          },
        },
        outlined: {
          borderColor: "#718292",
          color: "#102333",
          "&:hover": {
            borderColor: "#00658A",
            backgroundColor: "#EBF5FB",
          },
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          fontFamily: "inherit",
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          "&:hover": {
            backgroundColor: "#F0F4F8",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
        outlined: {
          borderColor: "#718292",
          borderRadius: 0,
          boxShadow: "none",
        },
        elevation1: {
          boxShadow: "none",
          border: "1px solid #718292",
          borderRadius: 0,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid #718292",
          borderRadius: 0,
          boxShadow: "none",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: CONTROL_BORDER_RADIUS,
          backgroundColor: "#FFFFFF",
          fontSize: 13,
          color: "#102333",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#718292",
            top: 0,
          },
          "& .MuiOutlinedInput-notchedOutline legend": {
            display: "none",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#A0AEC0",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#00658A",
            borderWidth: 1.5,
          },
        },
        notchedOutline: {
          top: 0,
          "& legend": {
            display: "none",
          },
        },
        input: {
          padding: "7px 10px",
          height: "auto",
        },
        inputSizeSmall: {
          padding: "5px 8px",
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          paddingTop: 6,
          paddingBottom: 6,
          fontSize: 13,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: "#354959",
          fontSize: "13px",
          fontFamily: "inherit",
          "&.Mui-focused": { color: "#00658A" },
        },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: {
        label: {
          color: "#102333",
          fontSize: "12.5px",
          fontFamily: "inherit",
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: "#102333",
          fontSize: "12.5px",
          fontFamily: "inherit",
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          borderCollapse: "collapse",
          fontFamily: "inherit",
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          border: `1px solid ${TABLE_BORDER_COLOR}`,
          borderRadius: TABLE_BORDER_RADIUS,
          backgroundColor: "#FFFFFF",
          boxShadow: "0 5px 18px rgba(23, 62, 117, 0.06)",
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: TABLE_HEADER_BACKGROUND,
          "& .MuiTableCell-root": {
            backgroundColor: TABLE_HEADER_BACKGROUND,
            color: "#102333",
            fontWeight: 700,
            fontSize: "12px",
            borderBottom: `2px solid ${TABLE_BORDER_COLOR}`,
            padding: "9px 16px 9px 8px",
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: TABLE_ROW_BORDER_COLOR,
          borderRight: `1px solid ${TABLE_ROW_BORDER_COLOR}`,
          color: "#102333",
          fontWeight: 500,
          padding: "7px 10px",
          fontSize: "12.5px",
          fontFamily: "inherit",
        },
        sizeSmall: {
          padding: "7px 8px",
          fontSize: "12.5px",
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:hover": {
            backgroundColor: TABLE_HOVER_BACKGROUND,
          },
          "&.Mui-selected": {
            backgroundColor: "#EBF5FB !important",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          fontWeight: 600,
          fontSize: "11px",
          height: "22px",
        },
        outlined: {
          borderColor: "#718292",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
          border: "1px solid #718292",
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: "15px",
          fontWeight: 700,
          color: "var(--dialog-title-text, #000000)",
          borderBottom: "1px solid #718292",
          padding: "12px 18px",
          background: "var(--dialog-title-bg, #b4cae6)",
          "& .MuiTypography-root, & .MuiIconButton-root": { color: "inherit" },
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: "var(--dialog-content-inset, 3mm)",
          ".MuiDialogTitle-root + &": { paddingTop: "var(--dialog-content-inset, 3mm)" },
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          borderTop: "1px solid #718292",
          padding: "10px 18px",
          backgroundColor: "#FAFBFC",
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 38,
        },
        indicator: {
          backgroundColor: "#00658A",
          height: 3,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 38,
          padding: "6px 16px",
          fontSize: "13px",
          fontWeight: 600,
          textTransform: "none",
          color: "#354959",
          "&.Mui-selected": {
            color: "#00658A",
            fontWeight: 700,
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: ({ ownerState, theme }) => ({
          borderRadius: 0,
          fontSize: "12.5px",
          "& .MuiAlert-icon": {
            color: theme.palette[ownerState.color || ownerState.severity || "info"][
              ownerState.variant === "filled" ? "contrastText" : "main"
            ],
            opacity: 1,
          },
        }),
      },
    },
  },
});

export default theme;
