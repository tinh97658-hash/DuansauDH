import React from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
} from "@mui/material";
import "../styles/dialogs.css";

/**
 * Standardized institutional dialog component.
 * Follows .rulesforai and docs/BAO-CAO-DONG-BO-STYLE.md
 */
const AppDialog = ({
  open,
  onClose,
  title,
  children,
  actions,
  onConfirm,
  onSubmit,
  confirmText = "Lưu",
  cancelText = "Hủy",
  confirmDisabled = false,
  confirmLoading = false,
  saving = false,
  loading = false,
  confirmColor = "primary",
  confirmVariant = "contained",
  confirmButtonProps = {},
  cancelButtonProps = {},
  showCloseButton = true,
  closeButtonAriaLabel = "Đóng",
  hideActions = false,
  maxWidth = "sm",
  fullWidth = true,
  PaperProps = {},
  sx = {},
  contentSx = {},
  actionsSx = {},
  titleSx = {},
  referenceStyle = true,
  className = "",
  ...rest
}) => {
  const isBusy = Boolean(loading || saving || confirmLoading);
  const handleConfirm = onConfirm || onSubmit;

  return (
    <Dialog
      className={[referenceStyle && "app-popup", className].filter(Boolean).join(" ")}
      open={Boolean(open)}
      onClose={isBusy ? undefined : onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      PaperProps={{
        ...PaperProps,
        sx: {
          border: "1px solid #B8C7D6",
          borderRadius: "6px",
          overflow: "hidden",
          boxShadow: "0 12px 36px rgba(15, 39, 75, 0.22), 0 2px 6px rgba(15, 39, 75, 0.08)",
          ...PaperProps.sx,
        },
      }}
      sx={{
        "& .MuiBackdrop-root": {
          backgroundColor: "rgba(15, 39, 75, 0.45)",
          backdropFilter: "blur(1px)",
        },
        ...sx,
      }}
      {...rest}
    >
      {title && (
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2.5,
            py: 1.5,
            color: "var(--dialog-title-text, #000000)",
            fontSize: "15px",
            fontWeight: 700,
            lineHeight: "22px",
            letterSpacing: "0.4px",
            textTransform: "uppercase",
            background: "var(--dialog-title-bg, #b4cae6)",
            borderBottom: "1px solid #B8C7D6",
            "& .MuiTypography-root": { color: "inherit" },
            ...titleSx,
          }}
        >
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
            {title}
          </span>
          {showCloseButton && (
            <IconButton
              aria-label={closeButtonAriaLabel}
              size="small"
              onClick={onClose}
              disabled={isBusy}
              sx={{
                width: 28,
                height: 28,
                color: "inherit",
                fontSize: 20,
                ml: 1,
                flexShrink: 0,
                borderRadius: "4px",
                "&:hover": { bgcolor: "rgba(0, 0, 0, 0.06)", color: "inherit" },
              }}
            >
              ×
            </IconButton>
          )}
        </DialogTitle>
      )}

      <DialogContent sx={{
        p: "var(--dialog-content-inset, 3mm)", bgcolor: "#FFFFFF", ...contentSx,
        // MUI otherwise removes the top padding immediately after a dialog title.
        ".MuiDialogTitle-root + &": { paddingTop: "var(--dialog-content-inset, 3mm)" },
      }}>
        {children}
      </DialogContent>

      {!hideActions && (
        <DialogActions
          sx={{
            px: 2.5,
            py: 1.25,
            gap: 1.25,
            minHeight: 56,
            borderTop: "1px solid #E2E8F0",
            bgcolor: "#F8FAFC",
            ...actionsSx,
          }}
        >
          {actions ? (
            actions
          ) : (
            <>
              {cancelText && (
                <Button
                  onClick={onClose}
                  disabled={isBusy}
                  color="inherit"
                  sx={{
                    minHeight: 36,
                    px: 2.25,
                    py: 0.75,
                    border: "1px solid #CAD5E0",
                    borderRadius: "4px",
                    color: "#3B5166",
                    fontSize: "13px",
                    fontWeight: 600,
                    textTransform: "none",
                    bgcolor: "#FFFFFF",
                    "&:hover": { bgcolor: "#F1F5F9", borderColor: "#A8B8C8" },
                  }}
                  {...cancelButtonProps}
                >
                  {cancelText}
                </Button>
              )}
              {handleConfirm && (
                <Button
                  variant={confirmVariant}
                  onClick={handleConfirm}
                  disabled={isBusy || confirmDisabled}
                  color={confirmColor}
                  sx={{
                    minHeight: 36,
                    px: 2.5,
                    py: 0.75,
                    borderRadius: "4px",
                    fontSize: "13px",
                    fontWeight: 700,
                    textTransform: "none",
                    boxShadow: "none",
                    ...(confirmColor === "error"
                      ? {
                          bgcolor: "var(--danger, #B52D2D)",
                          color: "#FFF",
                          "&:hover": { bgcolor: "#8C2222", boxShadow: "none" },
                        }
                      : confirmColor === "warning"
                      ? {
                          bgcolor: "#D97706",
                          color: "#FFF",
                          "&:hover": { bgcolor: "#B45309", boxShadow: "none" },
                        }
                      : {
                          bgcolor: "var(--primary, #0788B8)",
                          color: "#FFF",
                          "&:hover": { bgcolor: "var(--primary-dark, #056A8F)", boxShadow: "none" },
                        }),
                    "&.Mui-disabled": {
                      bgcolor: "#E2E8F0!important",
                      color: "#94A3B8!important",
                    },
                  }}
                  {...confirmButtonProps}
                >
                  {isBusy ? (
                    <CircularProgress size={18} sx={{ color: "inherit", mr: 1 }} />
                  ) : null}
                  {confirmText}
                </Button>
              )}
            </>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
};

export default AppDialog;
