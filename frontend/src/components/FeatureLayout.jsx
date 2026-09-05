import React from "react";
import { Box, Card, Chip, Typography } from "@mui/material";
import ResponsiveAppBar from "./navbarNew";
import Footer from "./footer";

/**
 * Layout dùng chung cho mọi trang chức năng.
 * Thiết kế phẳng, tối ưu không gian làm việc (compact, fluid, no redundant breadcrumbs/gaps).
 */
const FeatureLayout = ({
  title,
  group,
  desc,
  children,
  fluid = true,
  maxWidth,
  hideHeader = true,
  workspaceMode = false,
}) => (
  <Box data-feature-workspace={workspaceMode ? "true" : "false"} sx={{
    minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: "var(--canvas-bg, #F5F7F8)",
    ...(workspaceMode ? { "@media (min-width:1200px)": { height: "100dvh", minHeight: 0, overflow: "hidden" } } : {}),
  }}>
    <Box sx={{ flex: "none" }}>
      <ResponsiveAppBar />
    </Box>
    <Box
      component="main"
      sx={{
        flex: 1, p: "10px 16px 20px", width: "100%", maxWidth: fluid ? "100%" : (maxWidth || 1400), mx: "auto",
        ...(workspaceMode ? { "@media (min-width:1200px)": { minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" } } : {}),
      }}
    >
      {!hideHeader && title && (
        <Box sx={{ mb: "10px", flex: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {group && (
              <Chip
                label={group}
                size="small"
                sx={{
                  fontWeight: 700,
                  fontSize: 11,
                  bgcolor: "#EBF5FB",
                  color: "#0788B8",
                  borderRadius: "2px",
                  height: 20,
                }}
              />
            )}
            <Typography variant="h6" component="h1" sx={{ color: "#173B70", fontWeight: 700, fontSize: "16px" }}>
              {title}
            </Typography>
          </div>
          {desc && (
            <Typography variant="body2" sx={{ color: "#68737D", fontSize: 12, mt: 0.2 }}>
              {desc}
            </Typography>
          )}
        </Box>
      )}

      <Box sx={workspaceMode ? { flex: 1, minHeight: 0, "@media (max-width:1199.95px)": { flex: "initial" } } : undefined}>
        {children || (
          <Card variant="outlined" sx={{ borderRadius: "4px", borderColor: "#DFE4E8", bgcolor: "#FFFFFF", p: 3 }}>
            <Typography variant="body2" sx={{ color: "#68737D", textAlign: "center" }}>
              ⚙️ Chức năng <strong>{title}</strong> đang được cấu hình và phát triển.
            </Typography>
          </Card>
        )}
      </Box>
    </Box>
    {!workspaceMode && <Footer />}
  </Box>
);

export default FeatureLayout;
