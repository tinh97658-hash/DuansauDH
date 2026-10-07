import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AccountBalanceOutlined, AddTaskOutlined, CategoryOutlined, CheckCircleOutline,
  EventOutlined, EventNoteOutlined, FactCheckOutlined, FlagOutlined, FolderOpenOutlined,
  GavelOutlined, GradingOutlined, GroupAddOutlined, GroupsOutlined, GroupWorkOutlined,
  InfoOutlined, LanguageOutlined, ListAltOutlined, LocationCityOutlined, LockOutlined, LogoutOutlined,
  KeyboardArrowDownRounded, KeyboardArrowUpRounded,
  ManageAccountsOutlined, MenuBookOutlined, NoteAddOutlined, PaymentsOutlined, RuleOutlined,
  SchoolOutlined, ScoreboardOutlined, SendOutlined, SummarizeOutlined, SupervisorAccountOutlined,
  MeetingRoomOutlined,
  SystemUpdateOutlined, TableChartOutlined, TrackChangesOutlined, UploadFileOutlined,
  VerifiedOutlined, WorkspacePremiumOutlined,
  HistoryEduOutlined,
} from "@mui/icons-material";
import { API_BASE_URL } from "../config/http";
import { BRAND } from "../config/branding";
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
    group("THÔNG TIN", [
      action("Thông tin về đơn vị", "/system/unit-info", InfoOutlined, "#168bc2"),
      action("License", "/system/license", VerifiedOutlined, "#4b84b8"),
      action("Đổi mật khẩu", "/system/change-password", ManageAccountsOutlined, "#7b5fac"),
      action("QL Người dùng", "/system/users", SupervisorAccountOutlined, "#168b7c", { roles: ["admin"] }),
      action("Thoát chương trình", null, LogoutOutlined, "#227aa6", { action: "logout" }),
    ]),
    group("DANH MỤC CHUNG", [
      action("Dân tộc", "/system/ethnicities", GroupsOutlined, "#c0792a"),
      action("Quốc tịch", "/system/nationalities", FlagOutlined, "#3f8cc3"),
      action("Phường xã", "/system/wards", LocationCityOutlined, "#168b7c"),
      action("Thành phố", "/system/cities", LocationCityOutlined, "#a04f86"),
    ]),
    group("DANH MỤC ĐÀO TẠO", [
      action("Giảng viên", "/system/lecturers", SchoolOutlined, "#3f8cc3", { roles: ["admin"] }),
      action("Phòng học", "/system/rooms", MeetingRoomOutlined, "#168b7c", { roles: ["admin"] }),
      action("Nhóm hình thức đào tạo", "/system/training-mode-groups", CategoryOutlined, "#168bc2"),
      action("Hình thức đào tạo", "/system/training-modes", FactCheckOutlined, "#81952c"),
      action("Ngành đào tạo", "/system/disciplines", AccountBalanceOutlined, "#397c8d"),
      action("Chuyên ngành", "/system/majors", MenuBookOutlined, "#c0792a"),
      action("Trình độ đào tạo", "/system/training-levels", WorkspacePremiumOutlined, "#7b5fac"),
      action("Trạng thái học", "/system/study-statuses", CheckCircleOutline, "#168b7c"),
      action("Bổ sung kiến thức", "/system/bridge-knowledge", AddTaskOutlined, "#397c8d"),
      action("Check Update", "/system/check-update", SystemUpdateOutlined, "#303942"),
    ]),
  ],
  plan: [
    group("KẾ HOẠCH KHÓA MỚI", [
      action("Kế hoạch đào tạo", "/plan/training-plan", EventNoteOutlined, "#168bc2"),
      action("Chỉ tiêu xét tuyển", "/plan/admission-targets", TrackChangesOutlined, "#c0792a"),
      action("Khoản thu đầu năm", "/plan/annual-fees", PaymentsOutlined, "#168b7c"),
      action("Nhập hồ sơ tuyển sinh", "/plan/admission-records", UploadFileOutlined, "#7b5fac"),
    ]),
  ],
  masters: [
    group("THỦ TỤC ĐẦU VÀO", [
      action("Học bổ sung kiến thức", "/masters/bridge-course", AddTaskOutlined, "#168bc2"),
      action("Điểm thi đầu vào thạc sĩ", "/masters/admission-scores", ScoreboardOutlined, "#c0792a"),
      action("Danh sách học viên", "/masters/admitted-records", CheckCircleOutline, "#137b3b"),
      action("Tạo nhóm học viên", "/masters/create-class-groups", GroupAddOutlined, "#168b7c"),
      action("Phân nhóm học viên", "/masters/assign-class-groups", GroupWorkOutlined, "#81952c"),
      action("Thống kê tiến độ", "/masters/class-course-history", HistoryEduOutlined, "#a04f86"),
    ]),
    group("QUÁ TRÌNH HỌC TẬP", [
      action("Tạo lớp học phần", "/masters/course-offerings", NoteAddOutlined, "#0788b8"),
      action("Xếp lịch", "/masters/schedule", EventNoteOutlined, "#7b5fac"),
      action("Ma trận lớp học phần", "/masters/course-matrix", TableChartOutlined, "#168b7c"),
      action("Xét tư cách thi hết môn", "/masters/exam-eligibility", RuleOutlined, "#397c8d"),
      action("Danh sách thi, điểm thi", "/masters/exam-lists", ListAltOutlined, "#a04f86"),
    ]),
    group("THỦ TỤC ĐẦU RA", [
      action("Tạo đợt thi English", "/masters/english-exam", EventOutlined, "#168bc2"),
      action("Điểm thi English", "/masters/english-scores", GradingOutlined, "#c0792a"),
      action("Đăng ký đạt chuẩn ngoại ngữ", "/masters/english-certification", LanguageOutlined, "#168b7c"),
      action("Bảo vệ tốt nghiệp", "/masters/final-defense", GavelOutlined, "#7b5fac"),
      action("Hồ sơ tốt nghiệp", "/masters/graduation-docs", FolderOpenOutlined, "#397c8d"),
    ]),
  ],
  doctoral: [
    group("ĐÀO TẠO", [
      action("Điểm đầu vào TS", "/doctoral/admission-scores", ScoreboardOutlined, "#c0792a"),
      action("Tạo nhóm học phần TS", "/doctoral/create-class-groups", GroupAddOutlined, "#168b7c"),
      action("Phân nhóm học phần TS", "/doctoral/assign-class-groups", GroupWorkOutlined, "#81952c"),
      action("Xét tư cách thi hết môn", "/doctoral/exam-eligibility", RuleOutlined, "#397c8d"),
      action("ĐIỂM THI", "/doctoral/exam-scores", GradingOutlined, "#a04f86"),
      action("Danh sách thi, điểm thi", "/doctoral/exam-lists", ListAltOutlined, "#168bc2"),
    ]),
    group("TIỂU LUẬN, HỘI THẢO VÀ BẢO VỆ", [
      action("Tổng quan, chuyên đề", "/doctoral/overview-topics", MenuBookOutlined, "#168bc2"),
      action("Hội thảo cấp trường", "/doctoral/university-workshops", GroupsOutlined, "#c0792a"),
      action("Bảo vệ cấp cơ sở", "/doctoral/faculty-defense", AccountBalanceOutlined, "#168b7c"),
      action("Phản biện kín 2 người", "/doctoral/closed-review", LockOutlined, "#7b5fac"),
      action("Bảo vệ cấp trường", "/doctoral/university-defense", SchoolOutlined, "#397c8d"),
      action("Hồ sơ tốt nghiệp", "/doctoral/graduation-docs", FolderOpenOutlined, "#a04f86"),
    ]),
  ],
  reports: [
    group("BÁO CÁO CHUNG", [
      action("Danh sách lớp", "/reports/class-lists", GroupsOutlined, "#168bc2"),
      action("Bảng điểm môn học", "/reports/course-scores", TableChartOutlined, "#c0792a"),
      action("Tổng hợp điểm cả lớp", "/reports/class-score-summary", SummarizeOutlined, "#168b7c"),
      action("Báo cáo gửi Bộ", "/reports/ministerial-report", SendOutlined, "#7b5fac"),
    ]),
    group("BẢNG ĐIỂM TẠM THỜI", [
      action("Bảng điểm Thạc sĩ", "/reports/temp-score-masters", TableChartOutlined, "#81952c"),
      action("Bảng điểm Tiến sĩ", "/reports/temp-score-doctoral", TableChartOutlined, "#a04f86"),
    ]),
    group("PHỤ LỤC VĂN BẰNG", [
      action("Phụ lục văn bằng Thạc sĩ", "/reports/diploma-appendix-masters", NoteAddOutlined, "#397c8d"),
      action("Phụ lục văn bằng Tiến sĩ", "/reports/diploma-appendix-doctoral", NoteAddOutlined, "#168bc2"),
    ]),
  ],
};

const roleNames = { admin: "Quản trị viên", supervisor: "Giảng viên hướng dẫn", examiner: "Giám khảo", student: "Học viên" };

const RibbonHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("system");
  const [commandsCollapsed, setCommandsCollapsed] = useState(false);
  const [role, setRole] = useState();
  useEffect(() => {
    let mounted = true;
    fetch(`${API_BASE_URL}/auth/isStaff`, { credentials: "include" })
      .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data) => mounted && setRole(data.message))
      .catch(() => mounted && navigate("/login", { replace: true }));
    return () => { mounted = false; };
  }, [navigate]);

  const path = location.pathname;
  useEffect(() => {
    const matched = tabs.find(([id]) => path === `/${id}` || path.startsWith(`/${id}/`));
    if (matched) setActiveTab(matched[0]);
  }, [path]);

  if (!role) return null;
  const runAction = (item) => item.action === "logout" ? window.location.assign(`${API_BASE_URL}/user/logout`) : navigate(item.route);
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
      <nav className="ribbon-tabs" aria-label="Nhóm chức năng">
        {tabs.map(([id, label]) => <button key={id} type="button" className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>{label}</button>)}
      </nav>
      <div className="ribbon-command-scroll" role="region" aria-label="Tác vụ chức năng"><div className="ribbon-commands">
        {ribbons[activeTab].map((itemGroup) => {
          const visibleActions = itemGroup.actions.filter((item) => !item.roles || item.roles.includes(role));
          if (!visibleActions.length) return null;
          return <section className="ribbon-group" key={itemGroup.label}><div className="ribbon-actions">
            {visibleActions.map((item) => {
              const Icon = item.icon;
              const isActive = isRibbonRouteActive(path, item.route);
              return <button type="button" className={`ribbon-action${isActive ? " active" : ""}`} key={item.label} onClick={() => runAction(item)} title={item.label}
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
