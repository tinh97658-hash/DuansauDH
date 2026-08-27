import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AccountBalanceRounded, AddTaskRounded, CategoryRounded, CheckCircleRounded,
  EventRounded, EventNoteRounded, FactCheckRounded, FlagRounded, FolderOpenRounded,
  GavelRounded, GradingRounded, GroupAddRounded, GroupsRounded, GroupWorkRounded,
  InfoRounded, LanguageRounded, ListAltRounded, LocationCityRounded, LockRounded, LogoutRounded,
  ManageAccountsRounded, MenuBookRounded, NoteAddRounded, PaymentsRounded, RuleRounded,
  SchoolRounded, ScoreboardRounded, SendRounded, SummarizeRounded, SupervisorAccountRounded,
  SystemUpdateRounded, TableChartRounded, TrackChangesRounded, UploadFileRounded,
  VerifiedRounded, WorkspacePremiumRounded,
} from "@mui/icons-material";
import { API_BASE_URL } from "../config/http";
import { BRAND } from "../config/branding";
import "../styles/ribbon-header.css";

const action = (label, route, icon, color, options = {}) => ({ label, route, icon, color, ...options });
const group = (label, actions) => ({ label, actions });

const tabs = [
  ["system", "HỆ THỐNG"],
  ["plan", "KẾ HOẠCH KHÓA MỚI"],
  ["masters", "ĐÀO TẠO THẠC SĨ"],
  ["doctoral", "ĐÀO TẠO TIẾN SĨ"],
  ["reports", "BÁO CÁO"],
];

const ribbons = {
  system: [
    group("THÔNG TIN", [
      action("Thông tin về đơn vị", "/system/unit-info", InfoRounded, "#168bc2"),
      action("License", "/system/license", VerifiedRounded, "#4b84b8"),
      action("Đổi mật khẩu", "/system/change-password", ManageAccountsRounded, "#7b5fac"),
      action("QL Người dùng", "/system/users", SupervisorAccountRounded, "#168b7c", { roles: ["admin"] }),
      action("Thoát chương trình", null, LogoutRounded, "#227aa6", { action: "logout" }),
    ]),
    group("DANH MỤC CHUNG", [
      action("Dân tộc", "/system/ethnicities", GroupsRounded, "#c0792a"),
      action("Quốc tịch", "/system/nationalities", FlagRounded, "#3f8cc3"),
      action("Phường xã", "/system/wards", LocationCityRounded, "#168b7c"),
      action("Thành phố", "/system/cities", LocationCityRounded, "#a04f86"),
    ]),
    group("DANH MỤC ĐÀO TẠO", [
      action("Giảng viên", "/system/lecturers", SchoolRounded, "#3f8cc3", { roles: ["admin"] }),
      action("Nhóm hình thức đào tạo", "/system/training-mode-groups", CategoryRounded, "#168bc2"),
      action("Hình thức đào tạo", "/system/training-modes", FactCheckRounded, "#81952c"),
      action("Ngành học", "/system/majors", MenuBookRounded, "#c0792a"),
      action("Trình độ đào tạo", "/system/training-levels", WorkspacePremiumRounded, "#7b5fac"),
      action("Trạng thái học", "/system/study-statuses", CheckCircleRounded, "#168b7c"),
      action("Bổ sung kiến thức", "/system/bridge-knowledge", AddTaskRounded, "#397c8d"),
      action("Check Update", "/system/check-update", SystemUpdateRounded, "#303942"),
    ]),
  ],
  plan: [
    group("KẾ HOẠCH KHÓA MỚI", [
      action("Kế hoạch đào tạo", "/plan/training-plan", EventNoteRounded, "#168bc2"),
      action("Chỉ tiêu xét tuyển", "/plan/admission-targets", TrackChangesRounded, "#c0792a"),
      action("Khoản thu đầu năm", "/plan/annual-fees", PaymentsRounded, "#168b7c"),
      action("Nhập hồ sơ tuyển sinh", "/plan/admission-records", UploadFileRounded, "#7b5fac"),
    ]),
  ],
  masters: [
    group("THỦ TỤC ĐẦU VÀO", [
      action("Học bổ sung kiến thức", "/masters/bridge-course", AddTaskRounded, "#168bc2"),
      action("Điểm thi đầu vào thạc sĩ", "/masters/admission-scores", ScoreboardRounded, "#c0792a"),
      action("Tạo nhóm học phần", "/masters/create-class-groups", GroupAddRounded, "#168b7c"),
      action("Phân nhóm học phần", "/masters/assign-class-groups", GroupWorkRounded, "#81952c"),
    ]),
    group("QUÁ TRÌNH HỌC TẬP", [
      action("Xét tư cách thi hết môn", "/masters/exam-eligibility", RuleRounded, "#397c8d"),
      action("Danh sách thi, điểm thi", "/masters/exam-lists", ListAltRounded, "#a04f86"),
    ]),
    group("THỦ TỤC ĐẦU RA", [
      action("Tạo đợt thi English", "/masters/english-exam", EventRounded, "#168bc2"),
      action("Điểm thi English", "/masters/english-scores", GradingRounded, "#c0792a"),
      action("Đăng ký đạt chuẩn ngoại ngữ", "/masters/english-certification", LanguageRounded, "#168b7c"),
      action("Bảo vệ tốt nghiệp", "/masters/final-defense", GavelRounded, "#7b5fac"),
      action("Hồ sơ tốt nghiệp", "/masters/graduation-docs", FolderOpenRounded, "#397c8d"),
    ]),
  ],
  doctoral: [
    group("ĐÀO TẠO", [
      action("Điểm đầu vào TS", "/doctoral/admission-scores", ScoreboardRounded, "#c0792a"),
      action("Tạo nhóm học phần TS", "/doctoral/create-class-groups", GroupAddRounded, "#168b7c"),
      action("Phân nhóm học phần TS", "/doctoral/assign-class-groups", GroupWorkRounded, "#81952c"),
      action("Xét tư cách thi hết môn", "/doctoral/exam-eligibility", RuleRounded, "#397c8d"),
      action("ĐIỂM THI", "/doctoral/exam-scores", GradingRounded, "#a04f86"),
      action("Danh sách thi, điểm thi", "/doctoral/exam-lists", ListAltRounded, "#168bc2"),
    ]),
    group("TIỂU LUẬN, HỘI THẢO VÀ BẢO VỆ", [
      action("Tổng quan, chuyên đề", "/doctoral/overview-topics", MenuBookRounded, "#168bc2"),
      action("Hội thảo cấp trường", "/doctoral/university-workshops", GroupsRounded, "#c0792a"),
      action("Bảo vệ cấp cơ sở", "/doctoral/faculty-defense", AccountBalanceRounded, "#168b7c"),
      action("Phản biện kín 2 người", "/doctoral/closed-review", LockRounded, "#7b5fac"),
      action("Bảo vệ cấp trường", "/doctoral/university-defense", SchoolRounded, "#397c8d"),
      action("Hồ sơ tốt nghiệp", "/doctoral/graduation-docs", FolderOpenRounded, "#a04f86"),
    ]),
  ],
  reports: [
    group("BÁO CÁO CHUNG", [
      action("Danh sách lớp", "/reports/class-lists", GroupsRounded, "#168bc2"),
      action("Bảng điểm môn học", "/reports/course-scores", TableChartRounded, "#c0792a"),
      action("Tổng hợp điểm cả lớp", "/reports/class-score-summary", SummarizeRounded, "#168b7c"),
      action("Báo cáo gửi Bộ", "/reports/ministerial-report", SendRounded, "#7b5fac"),
    ]),
    group("BẢNG ĐIỂM TẠM THỜI", [
      action("Bảng điểm Thạc sĩ", "/reports/temp-score-masters", TableChartRounded, "#81952c"),
      action("Bảng điểm Tiến sĩ", "/reports/temp-score-doctoral", TableChartRounded, "#a04f86"),
    ]),
    group("PHỤ LỤC VĂN BẰNG", [
      action("Phụ lục văn bằng Thạc sĩ", "/reports/diploma-appendix-masters", NoteAddRounded, "#397c8d"),
      action("Phụ lục văn bằng Tiến sĩ", "/reports/diploma-appendix-doctoral", NoteAddRounded, "#168bc2"),
    ]),
  ],
};

const roleNames = { admin: "Quản trị viên", supervisor: "Giảng viên hướng dẫn", examiner: "Giám khảo", student: "Học viên" };

const RibbonHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("system");
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
    <header className="ribbon-header">
      <div className="ribbon-titlebar">
        <div className="ribbon-brand-group">
          <button className="ribbon-brand" type="button" onClick={() => navigate("/")} aria-label="Về trang chủ">
            <img src={BRAND.logoUrl} alt={`Biểu trưng ${BRAND.university}`} />
          </button>
          <div className="ribbon-title">
            <strong>{BRAND.institute}</strong>
            <span>{BRAND.university} · {BRAND.systemName}</span>
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
      <div className="ribbon-command-scroll"><div className="ribbon-commands">
        {ribbons[activeTab].map((itemGroup) => {
          const visibleActions = itemGroup.actions.filter((item) => !item.roles || item.roles.includes(role));
          if (!visibleActions.length) return null;
          return <section className="ribbon-group" key={itemGroup.label}><div className="ribbon-actions">
            {visibleActions.map((item) => { const Icon = item.icon; return <button type="button" className="ribbon-action" key={item.label} onClick={() => runAction(item)} title={item.label}><Icon className="ribbon-action-icon" style={{ color: item.color }} /><span>{item.label}</span></button>; })}
          </div><div className="ribbon-group-label">{itemGroup.label}</div></section>;
        })}
      </div></div>
    </header>
  );
};
export default RibbonHeader;
