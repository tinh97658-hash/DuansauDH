import React from "react";
import { Typography } from "@mui/material";
import AppDialog from "./AppDialog";

/**
 * Standardized institutional ConfirmDialog.
 * Replaces native window.confirm() and inconsistent alert popups.
 */
const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title = "XÁC NHẬN",
  content,
  children,
  confirmText,
  cancelText = "Hủy",
  loading = false,
  saving = false,
  severity = "primary", // "primary" | "error" | "warning" | "info"
  maxWidth = "xs",
  ...rest
}) => {
  const isDestructive = severity === "error";
  const defaultConfirmText = isDestructive ? "Xóa" : "Xác nhận";

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      confirmText={confirmText || defaultConfirmText}
      cancelText={cancelText}
      loading={loading}
      saving={saving}
      confirmColor={isDestructive ? "error" : severity === "warning" ? "warning" : "primary"}
      maxWidth={maxWidth}
      {...rest}
    >
      {content ? (
        <Typography
          sx={{
            fontSize: "13.5px",
            color: "var(--text-primary, #172B3A)",
            lineHeight: 1.5,
            whiteSpace: "pre-line",
          }}
        >
          {content}
        </Typography>
      ) : (
        children
      )}
    </AppDialog>
  );
};

export default ConfirmDialog;
