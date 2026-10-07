import { createTheme } from "@mui/material/styles";

export const APP_FONT_FAMILY = '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif';
export const TABLE_BORDER_COLOR = "#D7E4EE";
export const TABLE_ROW_BORDER_COLOR = "#E2EBF2";
export const TABLE_HEADER_BACKGROUND = "#EDF4FA";
export const TABLE_BORDER_RADIUS = 12;
export const TABLE_HOVER_BACKGROUND = "#F5FAFE";
export const CONTROL_BORDER_RADIUS = 8;

/**
 * Institutional Theme for University Postgraduate Operations System
 * Strictly following .rulesforai and operational workspace reference design
 */
export const theme = createTheme({
  palette: {
    primary: {
      main: "#0788B8",
      light: "#EBF5FB",
      dark: "#056A8F",
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
      primary: "#172B3A",
      secondary: "#607486",
      disabled: "#8A9AAA",
    },
    divider: "#DFE4E8",
    success: {
      main: "#137B3B",
      light: "#E6F4EA",
      dark: "#0E5E2D",
      contrastText: "#FFFFFF",
    },
    warning: {
      main: "#B86216",
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
      main: "#0788B8",
      light: "#EBF5FB",
      dark: "#056A8F",
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
    subtitle1: { fontSize: "13px", fontWeight: 600, color: "#172B3A" },
    subtitle2: { fontSize: "12.5px", fontWeight: 600, color: "#172B3A" },
    body1: { fontSize: "12.5px", color: "#172B3A", lineHeight: 1.5 },
    body2: { fontSize: "12.5px", color: "#172B3A", lineHeight: 1.45 },
    caption: { fontSize: "11px", color: "#607486" },
    button: { textTransform: "none", fontWeight: 600, fontSize: "12.5px" },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#F5F7F8",
          color: "#172B3A",
          fontFamily: APP_FONT_FAMILY,
          fontSize: "12.5px",
          lineHeight: 1.5,
          margin: 0,
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
          borderRadius: 3,
          boxShadow: "none",
          padding: "6px 14px",
          "&:hover": {
            boxShadow: "none",
          },
        },
        containedPrimary: {
          backgroundColor: "#0788B8",
          "&:hover": {
            backgroundColor: "#056A8F",
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
          borderColor: "#DFE4E8",
          color: "#172B3A",
          "&:hover": {
            borderColor: "#0788B8",
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
          borderRadius: 3,
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
          borderColor: "#DFE4E8",
          borderRadius: 4,
          boxShadow: "none",
        },
        elevation1: {
          boxShadow: "none",
          border: "1px solid #DFE4E8",
          borderRadius: 4,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid #DFE4E8",
          borderRadius: 4,
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
          color: "#172B3A",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#DFE4E8",
            top: 0,
          },
          "& .MuiOutlinedInput-notchedOutline legend": {
            display: "none",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#A0AEC0",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#0788B8",
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
          color: "#607486",
          fontSize: "13px",
          fontFamily: "inherit",
          "&.Mui-focused": { color: "#0788B8" },
        },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: {
        label: {
          color: "#172B3A",
          fontSize: "12.5px",
          fontFamily: "inherit",
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: "#172B3A",
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
            color: "#172B3A",
            fontWeight: 700,
            fontSize: "12px",
            borderBottom: `1px solid ${TABLE_BORDER_COLOR}`,
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
          borderRadius: 999,
          fontWeight: 600,
          fontSize: "11px",
          height: "22px",
        },
        outlined: {
          borderColor: "#DFE4E8",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 4,
          border: "1px solid #DFE4E8",
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: "15px",
          fontWeight: 700,
          color: "#173E75",
          borderBottom: "1px solid #DFE4E8",
          padding: "12px 18px",
          backgroundColor: "#FAFBFC",
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: "16px 18px",
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          borderTop: "1px solid #DFE4E8",
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
          backgroundColor: "#0788B8",
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
          color: "#607486",
          "&.Mui-selected": {
            color: "#0788B8",
            fontWeight: 700,
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 3,
          fontSize: "12.5px",
        },
      },
    },
  },
});

export default theme;
