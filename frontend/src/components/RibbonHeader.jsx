import { useEffect, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import AdminPanelSettingsOutlined from "@mui/icons-material/AdminPanelSettingsOutlined";
import AccountBalanceOutlined from "@mui/icons-material/AccountBalanceOutlined";
import AddTaskOutlined from "@mui/icons-material/AddTaskOutlined";
import CategoryOutlined from "@mui/icons-material/CategoryOutlined";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline";
import EventOutlined from "@mui/icons-material/EventOutlined";
import EventNoteOutlined from "@mui/icons-material/EventNoteOutlined";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import FactCheckOutlined from "@mui/icons-material/FactCheckOutlined";
import FlagOutlined from "@mui/icons-material/FlagOutlined";
import FolderOpenOutlined from "@mui/icons-material/FolderOpenOutlined";
import GavelOutlined from "@mui/icons-material/GavelOutlined";
import GradingOutlined from "@mui/icons-material/GradingOutlined";
import GroupAddOutlined from "@mui/icons-material/GroupAddOutlined";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import GroupWorkOutlined from "@mui/icons-material/GroupWorkOutlined";
import HistoryOutlined from "@mui/icons-material/HistoryOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import LanguageOutlined from "@mui/icons-material/LanguageOutlined";
import ListAltOutlined from "@mui/icons-material/ListAltOutlined";
import LocationCityOutlined from "@mui/icons-material/LocationCityOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowUpRounded from "@mui/icons-material/KeyboardArrowUpRounded";
import ManageAccountsOutlined from "@mui/icons-material/ManageAccountsOutlined";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import NoteAddOutlined from "@mui/icons-material/NoteAddOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import RuleOutlined from "@mui/icons-material/RuleOutlined";
import SchoolOutlined from "@mui/icons-material/SchoolOutlined";
import ScoreboardOutlined from "@mui/icons-material/ScoreboardOutlined";
import SendOutlined from "@mui/icons-material/SendOutlined";
import SummarizeOutlined from "@mui/icons-material/SummarizeOutlined";
import SupervisorAccountOutlined from "@mui/icons-material/SupervisorAccountOutlined";
import MeetingRoomOutlined from "@mui/icons-material/MeetingRoomOutlined";
import BusinessOutlined from "@mui/icons-material/BusinessOutlined";
import SystemUpdateOutlined from "@mui/icons-material/SystemUpdateOutlined";
import TableChartOutlined from "@mui/icons-material/TableChartOutlined";
import TrackChangesOutlined from "@mui/icons-material/TrackChangesOutlined";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import VerifiedOutlined from "@mui/icons-material/VerifiedOutlined";
import WorkspacePremiumOutlined from "@mui/icons-material/WorkspacePremiumOutlined";
import HistoryEduOutlined from "@mui/icons-material/HistoryEduOutlined";
import { API_BASE_URL } from "../config/http";
import { BRAND } from "../config/branding";
import { useAuthSession } from "../context/AuthSession";
import { preloadPage } from "../utils/lazyPage";
import "../styles/ribbon-header.css";

const action = (label, route, icon, color, options = {}) => ({ label, route, icon, color, ...options });
const group = (label, actions) => ({ label, actions });

export const isRibbonRouteActive = (pathname, route) => Boolean(
  route && (pathname === route || pathname === `${route}/` || pathname.startsWith(`${route}/`)),
);

const tabs = [
  ["system", "HỆ THỐNG"],
  ["plan", "KẾ HOẠCH KHÓA MỚI"],
  ["masters", "ĐÀO TẠO THẠC SĨ"],
  ["doctoral", "ĐÀO TẠO TIẾN SĨ"],
  ["reports", "BÁO CÁO"],
];

export const ribbons = {
  system: [
    group("TÀI KHOẢN & PHÂN QUYỀN", [
      action("Tài khoản nhân sự", "/system/accounts", SupervisorAccountOutlined, "#168b7c", { permissions: ["account.view"] }),
      action("Vai trò & phân quyền", "/system/roles", AdminPanelSettingsOutlined, "#7b5fac", { permissions: ["role.view"] }),
      action("Nhật ký thao tác", "/system/audit-logs", HistoryOutlined, "#397c8d", { permissions: ["audit.view"] }),
    ]),
    group("THÔNG TIN", [
      action("Thông tin về đơn vị", "/system/unit-info", InfoOutlined, "#168bc2"),
      action("License", "/system/license", VerifiedOutlined, "#4b84b8"),
      action("Đổi mật khẩu", "/system/change-password", ManageAccountsOutlined, "#7b5fac"),
      action("Thoát chương trình", null, LogoutOutlined, "#227aa6", { action: "logout" }),
    ]),
    group("DANH MỤC CHUNG", [
      action("Dân tộc", "/system/ethnicities", GroupsOutlined, "#c0792a", { permissions: ["catalog.view"] }),
      action("Phường xã", "/system/wards", LocationCityOutlined, "#168b7c", { permissions: ["catalog.view"] }),
      action("Quốc tịch", "/system/nationalities", FlagOutlined, "#3f8cc3", { permissions: ["catalog.view"] }),
      action("Thành phố", "/system/cities", LocationCityOutlined, "#a04f86", { permissions: ["catalog.view"] }),
    ]),
    group("DANH MỤC ĐÀO TẠO", [
      action("Giảng viên", "/system/lecturers", SchoolOutlined, "#3f8cc3", { permissions: ["catalog.view"] }),
      action("Đơn vị", "/system/units", BusinessOutlined, "#168b7c", { permissions: ["catalog.view"] }),
      action("Phòng học", "/system/rooms", MeetingRoomOutlined, "#168b7c", { permissions: ["catalog.view"] }),
      action("Nhóm hình thức đào tạo", "/system/training-mode-groups", CategoryOutlined, "#168bc2", { permissions: ["catalog.view"] }),
      action("Hình thức đào tạo", "/system/training-modes", FactCheckOutlined, "#81952c", { permissions: ["catalog.view"] }),
      action("Ngành đào tạo", "/system/disciplines", AccountBalanceOutlined, "#397c8d", { permissions: ["catalog.view"] }),
      action("Chuyên ngành", "/system/majors", MenuBookOutlined, "#c0792a", { permissions: ["catalog.view"] }),
      action("Trình độ đào tạo", "/system/training-levels", WorkspacePremiumOutlined, "#7b5fac", { permissions: ["catalog.view"] }),
      action("Trạng thái học", "/system/study-statuses", CheckCircleOutline, "#168b7c", { permissions: ["catalog.view"] }),
      action("Bổ sung kiến thức", "/system/bridge-knowledge", AddTaskOutlined, "#397c8d", { permissions: ["catalog.view"] }),
      action("Check Update", "/system/check-update", SystemUpdateOutlined, "#303942"),
    ]),
  ],
  plan: [
    group("KẾ HOẠCH KHÓA MỚI", [
      action("Kế hoạch đào tạo", "/plan/training-plan", EventNoteOutlined, "#168bc2", { permissions: ["plan.view"] }),
      action("Chỉ tiêu xét tuyển", "/plan/admission-targets", TrackChangesOutlined, "#c0792a", { permissions: ["admission.view"] }),
      action("Khoản thu đầu năm", "/plan/annual-fees", PaymentsOutlined, "#168b7c", { permissions: ["plan.view"] }),
      action("Nhập hồ sơ tuyển sinh", "/plan/admission-records", UploadFileOutlined, "#7b5fac", { permissions: ["admission.view"] }),
    ]),
  ],
  masters: [
    group("THỦ TỤC ĐẦU VÀO", [
      action("Học bổ sung kiến thức", "/masters/bridge-course", AddTaskOutlined, "#168bc2", { permissions: ["masters.view"] }),
      action("Điểm xét tuyển thạc sĩ", "/masters/admission-scores", ScoreboardOutlined, "#c0792a", { permissions: ["admission.view"] }),
      action("Hồ sơ trúng tuyển", "/masters/admitted-records", CheckCircleOutline, "#137b3b", { permissions: ["admission.view"] }),
      action("Quản lý bảo lưu", "/masters/study-leaves", HistoryEduOutlined, "#a04f86", { permissions: ["plan.view"] }),
      action("Tạo nhóm học viên", "/masters/create-class-groups", GroupAddOutlined, "#168b7c", { permissions: ["masters.view"] }),
      action("Phân nhóm học viên", "/masters/assign-class-groups", GroupWorkOutlined, "#81952c", { permissions: ["masters.view"] }),
      action("Thống kê tiến độ", "/masters/class-course-history", HistoryEduOutlined, "#a04f86", { permissions: ["plan.view", "scheduling.view"] }),
    ]),
    group("XẾP LỊCH HỌC", [
      action("Tạo lớp học phần", "/masters/course-offerings", NoteAddOutlined, "#0788b8", { permissions: ["scheduling.view"] }),
      action("Xếp lịch", "/masters/schedule", EventNoteOutlined, "#7b5fac", { permissions: ["scheduling.view"] }),
      action("Ma trận lớp học phần", "/masters/course-matrix", TableChartOutlined, "#168b7c", { permissions: ["scheduling.view"] }),
    ]),
    group("QUẢN LÝ ĐIỂM", [
      action("Danh sách thi, điểm thi", "/masters/exam-lists", ListAltOutlined, "#a04f86", { permissions: ["gradebook.view"] }),
      action('Xếp lịch thi', '/masters/exam-schedule', CalendarMonthOutlined, '#b75c75', { permissions: ['gradebook.view'] }),
      action("Tổng hợp điểm của lớp", "/reports/class-score-summary", SummarizeOutlined, "#168b7c", { permissions: ["reports.view"] }),
    ]),
    group("THỦ TỤC ĐẦU RA", [
      action("Tạo đợt thi English", "/masters/english-exam", EventOutlined, "#168bc2", { permissions: ["masters.view"] }),
      action("Điểm thi English", "/masters/english-scores", GradingOutlined, "#c0792a", { permissions: ["masters.view"] }),
      action("Đăng ký đạt chuẩn ngoại ngữ", "/masters/english-certification", LanguageOutlined, "#168b7c", { permissions: ["masters.view"] }),
      action("Bảo vệ tốt nghiệp", "/masters/final-defense", GavelOutlined, "#7b5fac", { permissions: ["masters.view"] }),
      action("Hồ sơ tốt nghiệp", "/masters/graduation-docs", FolderOpenOutlined, "#397c8d", { permissions: ["masters.view"] }),
    ]),
  ],
  doctoral: [
    group("ĐÀO TẠO", [
      action("Điểm đầu vào TS", "/doctoral/admission-scores", ScoreboardOutlined, "#c0792a", { permissions: ["doctoral.view"] }),
      action("Tạo nhóm học phần TS", "/doctoral/create-class-groups", GroupAddOutlined, "#168b7c", { permissions: ["doctoral.view"] }),
      action("Phân nhóm học phần TS", "/doctoral/assign-class-groups", GroupWorkOutlined, "#81952c", { permissions: ["doctoral.view"] }),
      action("Xét tư cách thi hết môn", "/doctoral/exam-eligibility", RuleOutlined, "#397c8d", { permissions: ["doctoral.view"] }),
      action("ĐIỂM THI", "/doctoral/exam-scores", GradingOutlined, "#a04f86", { permissions: ["doctoral.view"] }),
      action("Danh sách thi, điểm thi", "/doctoral/exam-lists", ListAltOutlined, "#168bc2", { permissions: ["doctoral.view"] }),
    ]),
    group("TIỂU LUẬN, HỘI THẢO VÀ BẢO VỆ", [
      action("Tổng quan, chuyên đề", "/doctoral/overview-topics", MenuBookOutlined, "#168bc2", { permissions: ["doctoral.view"] }),
      action("Hội thảo cấp trường", "/doctoral/university-workshops", GroupsOutlined, "#c0792a", { permissions: ["doctoral.view"] }),
      action("Bảo vệ cấp cơ sở", "/doctoral/faculty-defense", AccountBalanceOutlined, "#168b7c", { permissions: ["doctoral.view"] }),
      action("Phản biện kín 2 người", "/doctoral/closed-review", LockOutlined, "#7b5fac", { permissions: ["doctoral.view"] }),
      action("Bảo vệ cấp trường", "/doctoral/university-defense", SchoolOutlined, "#397c8d", { permissions: ["doctoral.view"] }),
      action("Hồ sơ tốt nghiệp", "/doctoral/graduation-docs", FolderOpenOutlined, "#a04f86", { permissions: ["doctoral.view"] }),
    ]),
  ],
  reports: [
    group("BÁO CÁO CHUNG", [
      action("Danh sách lớp", "/reports/class-lists", GroupsOutlined, "#168bc2", { permissions: ["reports.view"] }),
      action("Bảng điểm môn học", "/reports/course-scores", TableChartOutlined, "#c0792a", { permissions: ["reports.view"] }),
      action("Báo cáo gửi Bộ", "/reports/ministerial-report", SendOutlined, "#7b5fac", { permissions: ["reports.view"] }),
    ]),
    group("BẢNG ĐIỂM TẠM THỜI", [
      action("Bảng điểm Thạc sĩ", "/reports/temp-score-masters", TableChartOutlined, "#81952c", { permissions: ["reports.view"] }),
      action("Bảng điểm Tiến sĩ", "/reports/temp-score-doctoral", TableChartOutlined, "#a04f86", { permissions: ["reports.view"] }),
    ]),
    group("PHỤ LỤC VĂN BẰNG", [
      action("Phụ lục văn bằng Thạc sĩ", "/reports/diploma-appendix-masters", NoteAddOutlined, "#397c8d", { permissions: ["reports.view"] }),
      action("Phụ lục văn bằng Tiến sĩ", "/reports/diploma-appendix-doctoral", NoteAddOutlined, "#168bc2", { permissions: ["reports.view"] }),
    ]),
  ],
};

const roleNames = { admin: "Quản trị viên", supervisor: "Giảng viên hướng dẫn", examiner: "Giám khảo", student: "Học viên" };
const tabForPath = (path) => (tabs.find(([id]) => ribbons[id].some(section => section.actions.some(item => isRibbonRouteActive(path, item.route))))
  || tabs.find(([id]) => path === `/${id}` || path.startsWith(`/${id}/`)))?.[0] || "system";

const RibbonHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useAuthSession();
  const sessionRole = session ? session.user?.role || "student" : null;
  const [activeTab, setActiveTab] = useState(() => tabForPath(location.pathname));
  const [commandsCollapsed, setCommandsCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [fallbackRole, setFallbackRole] = useState();
  const role = sessionRole || fallbackRole;
  useEffect(() => {
    if (sessionRole) return;
    let mounted = true;
    fetch(`${API_BASE_URL}/auth/isStaff`, { credentials: "include" })
      .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data) => mounted && setFallbackRole(data.message))
      .catch(() => mounted && navigate("/login", { replace: true }));
    return () => { mounted = false; };
  }, [navigate, sessionRole]);

  const path = location.pathname;
  useEffect(() => {
    setActiveTab(tabForPath(path));
  }, [path]);

  if (!role) return null;
  // Keep permission-gated navigation hidden until effective access is loaded.
  const access = session?.access;
  const hasPermission = (permission) => access
    ? (access.permissions || []).includes(permission)
    : false;
  const canSee = (item) => (!item.roles || item.roles.includes(role)) && (!item.permissions || item.permissions.every(hasPermission));
  const visibleTabs = tabs.filter(([id]) => ribbons[id].some(section => section.actions.some(canSee)));
  const selectedTab = visibleTabs.some(([id]) => id === activeTab) ? activeTab : visibleTabs[0]?.[0];
  const runAction = async (item) => {
    if (item.action !== "logout") return navigate(item.route);
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      await axios.post(`${API_BASE_URL}/user/logout`, {}, { withCredentials: true });
      navigate("/login", { replace: true });
    } catch {
      setLogoutError("Không thể đăng xuất. Vui lòng thử lại.");
    } finally {
      setLoggingOut(false);
    }
  };
  return (
    <header className={`ribbon-header${commandsCollapsed ? " ribbon-commands-collapsed" : ""}`}>
      <div className="ribbon-titlebar">
        <div className="ribbon-brand-group">
          <button className="ribbon-brand" type="button" onClick={() => navigate("/")} aria-label="Về trang chủ">
            <img src={BRAND.logoUrl} alt={`Biểu trưng ${BRAND.university}`} />
          </button>
          <div className="ribbon-title">
            <strong>{BRAND.university}</strong>
            <span>{BRAND.institute}</span>
          </div>
        </div>
        <div className="ribbon-user" title={`Vai trò: ${roleNames[role] || role}`}>
          <div className="ribbon-user-avatar">{role === "admin" ? "AD" : "NV"}</div>
          <div className="ribbon-user-info">
            <span className="ribbon-user-name">{roleNames[role] || role}</span>
            <span className="ribbon-user-role">{BRAND.institute}</span>
          </div>
        </div>
      </div>
      {logoutError && <div role="alert">{logoutError}</div>}
      <nav className="ribbon-tabs" aria-label="Nhóm chức năng">
        {visibleTabs.map(([id, label]) => <button key={id} type="button" className={selectedTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>{label}</button>)}
      </nav>
      <div className="ribbon-command-scroll" role="region" aria-label="Tác vụ chức năng"><div className="ribbon-commands">
        {(ribbons[selectedTab] || []).map((itemGroup) => {
          const visibleActions = itemGroup.actions.filter(canSee);
          if (!visibleActions.length) return null;
          return <section className="ribbon-group" key={itemGroup.label}><div className="ribbon-actions">
            {visibleActions.map((item) => {
              const Icon = item.icon;
              const isActive = isRibbonRouteActive(path, item.route);
              return <button type="button" className={`ribbon-action${isActive ? " active" : ""}`} key={item.label} onClick={() => runAction(item)}
                disabled={item.action === "logout" && loggingOut}
                onPointerEnter={() => preloadPage(item.route)} onFocus={() => preloadPage(item.route)} onPointerDown={() => preloadPage(item.route)}
                style={{ "--ribbon-icon-color": item.color }}
                aria-current={isActive ? "page" : undefined}>
                <Icon className="ribbon-action-icon" /><span>{item.label}</span>
              </button>;
            })}
          </div><div className="ribbon-group-label">{itemGroup.label}</div></section>;
        })}
      </div></div>
      <button
        type="button"
        className="ribbon-command-toggle"
        aria-label={commandsCollapsed ? "Mở menu tác vụ" : "Thu gọn menu tác vụ"}
        aria-expanded={!commandsCollapsed}
        onClick={() => setCommandsCollapsed((value) => !value)}
      >
        {commandsCollapsed ? <KeyboardArrowDownRounded /> : <KeyboardArrowUpRounded />}
      </button>
    </header>
  );
};
export default RibbonHeader;
