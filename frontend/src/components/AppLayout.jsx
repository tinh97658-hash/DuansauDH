import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import {
  Avatar, Box, Button, Chip, Collapse, Divider, Drawer,
  IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Menu, MenuItem, Stack, Tooltip, Typography, useMediaQuery, useTheme,
} from "@mui/material";
import {
  AccountCircleRounded, AddTaskRounded, AssessmentRounded, CategoryRounded,
  CheckCircleRounded, ChevronRightRounded, ClassRounded, DashboardRounded,
  DeleteRounded, EditRounded, EventNoteRounded, EventRounded, ExpandLessRounded,
  ExpandMoreRounded, FactCheckRounded, FlagRounded, FolderOpenRounded, GavelRounded,
  GradingRounded, GroupAddRounded, GroupsRounded, GroupWorkRounded, InfoRounded,
  LanguageRounded, LibraryBooksRounded, ListAltRounded, LocationCityRounded,
  LockRounded, LogoutRounded, ManageAccountsRounded, MenuBookRounded, MenuRounded,
  NoteAddRounded, PaymentsRounded, RuleRounded, SchoolRounded, ScoreboardRounded, MeetingRoomRounded,
  SendRounded, SummarizeRounded, SupervisorAccountRounded, SystemUpdateRounded,
  TableChartRounded, TrackChangesRounded, UploadFileRounded, VerifiedRounded,
  WorkspacePremiumRounded,
} from "@mui/icons-material";
import { API_BASE_URL } from "../config/http";
import { BRAND } from "../config/branding";

const NAV_GROUPS = [
  {
    title: "TỔNG QUAN",
    items: [
      { label: "Bảng điều khiển", path: "/viewLogged", icon: DashboardRounded },
      { label: "Báo cáo tổng quan", path: "/reports/class-score-summary", icon: AssessmentRounded },
      { label: "Hồ sơ cá nhân", path: "/profile", icon: AccountCircleRounded },
    ],
  },
  {
    title: "KẾ HOẠCH KHÓA MỚI",
    items: [
      { label: "Kế hoạch đào tạo", path: "/plan/training-plan", icon: EventNoteRounded },
      { label: "Chỉ tiêu xét tuyển", path: "/plan/admission-targets", icon: TrackChangesRounded },
      { label: "Khoản thu đầu năm", path: "/plan/annual-fees", icon: PaymentsRounded },
      { label: "Nhập hồ sơ tuyển sinh", path: "/plan/admission-records", icon: UploadFileRounded },
    ],
  },
  {
    title: "ĐÀO TẠO THẠC SĨ",
    items: [
      { label: "Học bổ sung kiến thức", path: "/masters/bridge-course", icon: AddTaskRounded },
      { label: "Điểm thi đầu vào thạc sĩ", path: "/masters/admission-scores", icon: ScoreboardRounded },
      { label: "Tạo nhóm học phần", path: "/masters/create-class-groups", icon: GroupAddRounded },
      { label: "Phân nhóm học phần", path: "/masters/assign-class-groups", icon: GroupWorkRounded },
      { label: "Tạo lớp học phần", path: "/masters/course-offerings", icon: NoteAddRounded },
      { label: "Xếp lịch", path: "/masters/schedule", icon: EventNoteRounded },
      { label: "Xét tư cách thi hết môn", path: "/masters/exam-eligibility", icon: RuleRounded },
      { label: "Danh sách thi, điểm thi", path: "/masters/exam-lists", icon: ListAltRounded },
      { label: "Tạo đợt thi English", path: "/masters/english-exam", icon: EventRounded },
      { label: "Điểm thi English", path: "/masters/english-scores", icon: GradingRounded },
      { label: "Đạt chuẩn ngoại ngữ", path: "/masters/english-certification", icon: LanguageRounded },
      { label: "Bảo vệ tốt nghiệp", path: "/masters/final-defense", icon: GavelRounded },
      { label: "Hồ sơ tốt nghiệp", path: "/masters/graduation-docs", icon: FolderOpenRounded },
    ],
  },
  {
    title: "ĐÀO TẠO TIẾN SĨ",
    items: [
      { label: "Điểm đầu vào TS", path: "/doctoral/admission-scores", icon: ScoreboardRounded },
      { label: "Tạo nhóm học phần TS", path: "/doctoral/create-class-groups", icon: GroupAddRounded },
      { label: "Phân nhóm học phần TS", path: "/doctoral/assign-class-groups", icon: GroupWorkRounded },
      { label: "Xét tư cách thi TS", path: "/doctoral/exam-eligibility", icon: RuleRounded },
      { label: "Điểm thi TS", path: "/doctoral/exam-scores", icon: GradingRounded },
      { label: "Danh sách thi TS", path: "/doctoral/exam-lists", icon: ListAltRounded },
      { label: "Tổng quan, chuyên đề", path: "/doctoral/overview-topics", icon: MenuBookRounded },
      { label: "Hội thảo cấp trường", path: "/doctoral/university-workshops", icon: GroupsRounded },
      { label: "Bảo vệ cấp cơ sở", path: "/doctoral/faculty-defense", icon: SchoolRounded },
      { label: "Phản biện kín 2 người", path: "/doctoral/closed-review", icon: LockRounded },
      { label: "Bảo vệ cấp trường", path: "/doctoral/university-defense", icon: SchoolRounded },
      { label: "Hồ sơ tốt nghiệp TS", path: "/doctoral/graduation-docs", icon: FolderOpenRounded },
    ],
  },
  {
    title: "BÁO CÁO & THỐNG KÊ",
    items: [
      { label: "Danh sách lớp", path: "/reports/class-lists", icon: GroupsRounded },
      { label: "Bảng điểm môn học", path: "/reports/course-scores", icon: TableChartRounded },
      { label: "Tổng hợp điểm cả lớp", path: "/reports/class-score-summary", icon: SummarizeRounded },
      { label: "Báo cáo gửi Bộ", path: "/reports/ministerial-report", icon: SendRounded },
      { label: "Bảng điểm Thạc sĩ", path: "/reports/temp-score-masters", icon: TableChartRounded },
      { label: "Bảng điểm Tiến sĩ", path: "/reports/temp-score-doctoral", icon: TableChartRounded },
      { label: "Phụ lục VB Thạc sĩ", path: "/reports/diploma-appendix-masters", icon: NoteAddRounded },
      { label: "Phụ lục VB Tiến sĩ", path: "/reports/diploma-appendix-doctoral", icon: NoteAddRounded },
    ],
  },
  {
    title: "DANH MỤC & HỆ THỐNG",
    items: [
      { label: "Thông tin về đơn vị", path: "/system/unit-info", icon: InfoRounded },
      { label: "License", path: "/system/license", icon: VerifiedRounded },
      { label: "Quản lý người dùng", path: "/system/users", icon: SupervisorAccountRounded, roles: ["admin"] },
      { label: "Giảng viên", path: "/system/lecturers", icon: SchoolRounded, roles: ["admin"] },
      { label: "Phòng học", path: "/system/rooms", icon: MeetingRoomRounded, roles: ["admin"] },
      { label: "Ngành học", path: "/system/majors", icon: MenuBookRounded },
      { label: "Trình độ đào tạo", path: "/system/training-levels", icon: WorkspacePremiumRounded },
      { label: "Hình thức đào tạo", path: "/system/training-modes", icon: FactCheckRounded },
      { label: "Nhóm hình thức", path: "/system/training-mode-groups", icon: CategoryRounded },
      { label: "Trạng thái học", path: "/system/study-statuses", icon: CheckCircleRounded },
      { label: "Dân tộc", path: "/system/ethnicities", icon: GroupsRounded },
      { label: "Quốc tịch", path: "/system/nationalities", icon: FlagRounded },
      { label: "Thành phố", path: "/system/cities", icon: LocationCityRounded },
      { label: "Phường xã", path: "/system/wards", icon: LocationCityRounded },
      { label: "Bổ sung kiến thức", path: "/system/bridge-knowledge", icon: AddTaskRounded },
      { label: "Đổi mật khẩu", path: "/system/change-password", icon: ManageAccountsRounded },
      { label: "Check Update", path: "/system/check-update", icon: SystemUpdateRounded },
    ],
  },
];

const roleLabels = {
  admin: "Quản trị hệ thống",
  supervisor: "Giảng viên hướng dẫn",
  examiner: "Giám khảo chấm thi",
  student: "Học viên sau đại học",
};

const AppLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [role, setRole] = useState("admin");
  const [currentUser, setCurrentUser] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);

  // Group collapse state
  const [collapsedGroups, setCollapsedGroups] = useState({});

  useEffect(() => {
    let mounted = true;
    axios.get(`${API_BASE_URL}/auth/session`, { withCredentials: true })
      .then(({ data }) => {
        if (!mounted) return;
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});

    axios.get(`${API_BASE_URL}/auth/isStaff`, { withCredentials: true })
      .then(({ data }) => {
        if (!mounted) return;
        setRole(data.message || "admin");
      })
      .catch(() => {});

    return () => { mounted = false; };
  }, []);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleToggleGroup = (title) => {
    setCollapsedGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    window.location.assign(`${API_BASE_URL}/user/logout`);
  };

  // Compute Active Breadcrumb Info
  const activeNavInfo = useMemo(() => {
    const currentPath = location.pathname;
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (item.path === currentPath || (item.path !== "/" && currentPath.startsWith(item.path))) {
          return { groupTitle: group.title, itemLabel: item.label };
        }
      }
    }
    return { groupTitle: "Hệ thống", itemLabel: "Trang chủ" };
  }, [location.pathname]);

  // Sidebar Content
  const sidebarContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: "#FFFFFF", borderRight: "1px solid #DFE4E8" }}>
      {/* Brand Header */}
      <Box
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottom: "1px solid #DFE4E8",
          cursor: "pointer",
          bgcolor: "#FFFFFF",
        }}
        onClick={() => { navigate("/viewLogged"); if (isMobile) setMobileOpen(false); }}
      >
        <img
          src={BRAND.logoUrl}
          alt="Logo VMU"
          style={{ width: 38, height: 38, objectFit: "contain" }}
          onError={(e) => { e.target.style.display = "none"; }}
        />
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#173B70", fontSize: 13, lineHeight: 1.2, letterSpacing: "0.2px" }}>
            VIỆN SAU ĐẠI HỌC VMU
          </Typography>
          <Typography variant="caption" sx={{ color: "#68737D", fontSize: 11, display: "block", mt: 0.2 }}>
            Quản lý đào tạo & nghiên cứu
          </Typography>
        </Box>
      </Box>

      {/* Navigation List */}
      <Box sx={{ flexGrow: 1, overflowY: "auto", py: 1, px: 1 }}>
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => !item.roles || item.roles.includes(role));
          if (visibleItems.length === 0) return null;
          const isCollapsed = Boolean(collapsedGroups[group.title]);

          return (
            <Box key={group.title} sx={{ mb: 1.5 }}>
              <Box
                onClick={() => handleToggleGroup(group.title)}
                sx={{
                  px: 1.5,
                  py: 0.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  userSelect: "none",
                  "&:hover": { opacity: 0.8 },
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#68737D",
                    letterSpacing: "0.5px",
                  }}
                >
                  {group.title}
                </Typography>
                {isCollapsed ? (
                  <ExpandMoreRounded sx={{ fontSize: 16, color: "#8a94a3" }} />
                ) : (
                  <ExpandLessRounded sx={{ fontSize: 16, color: "#8a94a3" }} />
                )}
              </Box>

              <Collapse in={!isCollapsed} timeout="auto" unmountOnExit>
                <List dense disablePadding sx={{ mt: 0.3 }}>
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));

                    return (
                      <ListItem key={item.path} disablePadding sx={{ mb: "2px" }}>
                        <ListItemButton
                          onClick={() => {
                            navigate(item.path);
                            if (isMobile) setMobileOpen(false);
                          }}
                          sx={{
                            py: "7px",
                            px: 1.5,
                            borderRadius: "4px",
                            bgcolor: isActive ? "#0788B8 !important" : "transparent",
                            color: isActive ? "#FFFFFF" : "#20262C",
                            "&:hover": {
                              bgcolor: isActive ? "#0788B8" : "#F0F4F8",
                            },
                          }}
                        >
                          <ListItemIcon
                            sx={{
                              minWidth: 30,
                              color: isActive ? "#FFFFFF" : "#0788B8",
                            }}
                          >
                            <Icon sx={{ fontSize: 18 }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={item.label}
                            primaryTypographyProps={{
                              fontSize: 13,
                              fontWeight: isActive ? 700 : 500,
                              lineHeight: 1.2,
                              color: isActive ? "#FFFFFF" : "inherit",
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
              </Collapse>
            </Box>
          );
        })}
      </Box>

    </Box>
  );

  return (
    <Box sx={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden", bgcolor: "#F5F7F8" }}>
      {/* Desktop Sidebar */}
      <Box
        component="nav"
        sx={{
          width: { md: 260 },
          flexShrink: { md: 0 },
          display: { xs: "none", md: "block" },
          height: "100vh",
        }}
      >
        {sidebarContent}
      </Box>

      {/* Mobile Drawer Sidebar */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { boxSizing: "border-box", width: 260 },
        }}
      >
        {sidebarContent}
      </Drawer>

      {/* Main Container (Topbar + Content Area) */}
      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        {/* Top Header Bar */}
        <Box
          component="header"
          sx={{
            height: 50,
            bgcolor: "#FFFFFF",
            borderBottom: "1px solid #DFE4E8",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: { xs: 1.5, md: 2.5 },
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          {/* Left Context & Breadcrumbs */}
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ display: { md: "none" }, color: "#20262C" }}
            >
              <MenuRounded />
            </IconButton>

            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" sx={{ color: "#68737D", fontSize: 11, display: "block", lineHeight: 1.1 }}>
                Hệ thống Sau đại học · {activeNavInfo.groupTitle}
              </Typography>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 800,
                  color: "#173B70",
                  fontSize: 14,
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                Trường Đại học Hàng hải Việt Nam
              </Typography>
            </Box>
          </Stack>

          {/* Right User & Actions Area */}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              size="small"
              variant="outlined"
              onClick={() => navigate("/reports/class-score-summary")}
              sx={{
                height: 32,
                fontSize: 12,
                fontWeight: 600,
                color: "#0788B8",
                borderColor: "#DFE4E8",
                textTransform: "none",
                borderRadius: "4px",
                display: { xs: "none", sm: "inline-flex" },
                "&:hover": { bgcolor: "#F0F4F8", borderColor: "#0788B8" },
              }}
            >
              Xem báo cáo
            </Button>

            {/* User Capsule */}
            <Box
              onClick={handleMenuOpen}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.2,
                p: "4px 8px 4px 4px",
                borderRadius: "4px",
                cursor: "pointer",
                border: "1px solid #DFE4E8",
                bgcolor: "#FFFFFF",
                "&:hover": { bgcolor: "#F7F9FA", borderColor: "#0788B8" },
              }}
            >
              <Avatar
                variant="rounded"
                sx={{
                  width: 30,
                  height: 30,
                  bgcolor: "#173B70",
                  color: "#FFFFFF",
                  fontSize: 12,
                  fontWeight: 800,
                  borderRadius: "3px",
                }}
              >
                {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : (role === "admin" ? "AD" : "GV")}
              </Avatar>

              <Box sx={{ display: { xs: "none", sm: "block" }, textAlign: "left" }}>
                <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 700, color: "#20262C", lineHeight: 1.1 }}>
                  {currentUser?.name || (role === "admin" ? "Nguyễn Văn A" : "Giảng viên")}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: 10, color: "#68737D", display: "block" }}>
                  {roleLabels[role] || role}
                </Typography>
              </Box>

              <ExpandMoreRounded sx={{ fontSize: 16, color: "#8a94a3" }} />
            </Box>

            {/* Profile Dropdown Menu */}
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              transformOrigin={{ horizontal: "right", vertical: "top" }}
              anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
              PaperProps={{
                sx: {
                  mt: 1,
                  minWidth: 190,
                  borderRadius: "4px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                  border: "1px solid #DFE4E8",
                },
              }}
            >
              <Box sx={{ px: 2, py: 1, borderBottom: "1px solid #F0F4F8" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13 }}>
                  {currentUser?.name || "Tài khoản nội bộ"}
                </Typography>
                <Typography variant="caption" sx={{ color: "#68737D", fontSize: 11 }}>
                  {currentUser?.email || roleLabels[role] || role}
                </Typography>
              </Box>
              <MenuItem onClick={() => { handleMenuClose(); navigate("/profile"); }} sx={{ fontSize: 13, py: 1 }}>
                <ListItemIcon><AccountCircleRounded fontSize="small" sx={{ color: "#0788B8" }} /></ListItemIcon>
                Hồ sơ cá nhân
              </MenuItem>
              <MenuItem onClick={() => { handleMenuClose(); navigate("/system/change-password"); }} sx={{ fontSize: 13, py: 1 }}>
                <ListItemIcon><ManageAccountsRounded fontSize="small" sx={{ color: "#7B5FAC" }} /></ListItemIcon>
                Đổi mật khẩu
              </MenuItem>
              <Divider sx={{ my: 0.5 }} />
              <MenuItem onClick={handleLogout} sx={{ fontSize: 13, py: 1, color: "#B52D2D" }}>
                <ListItemIcon><LogoutRounded fontSize="small" sx={{ color: "#B52D2D" }} /></ListItemIcon>
                Đăng xuất
              </MenuItem>
            </Menu>
          </Stack>
        </Box>

        {/* Main Workspace Scrollable Viewport */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            overflowY: "auto",
            p: { xs: 1.5, sm: 2.5, md: 3 },
            bgcolor: "#F5F7F8",
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default AppLayout;
