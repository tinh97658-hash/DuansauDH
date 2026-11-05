import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { useConfirmGradeLeave, useDiscardUnsavedGrades } from "./UnsavedChangesGuard";
import { AcademicCapIcon, AdjustmentsHorizontalIcon, ArrowDownOnSquareIcon, ArrowRightStartOnRectangleIcon, ArrowUpTrayIcon, BanknotesIcon, Bars3Icon, BookOpenIcon, BuildingLibraryIcon, BuildingOffice2Icon, BuildingOfficeIcon, CalendarDaysIcon, CalendarIcon, ChartBarIcon, CheckBadgeIcon, CheckCircleIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ClipboardDocumentCheckIcon, ClipboardDocumentListIcon, ClockIcon, DocumentChartBarIcon, DocumentCheckIcon, DocumentPlusIcon, DocumentTextIcon, FlagIcon, FolderOpenIcon, HomeModernIcon, InformationCircleIcon, LanguageIcon, LockClosedIcon, MagnifyingGlassIcon, PaperAirplaneIcon, ScaleIcon, ShieldCheckIcon, Squares2X2Icon, TableCellsIcon, TrophyIcon, UserCircleIcon, UserGroupIcon, UserPlusIcon, UsersIcon } from "./AppIcons";
import { API_BASE_URL } from "../config/http";
import { BRAND } from "../config/branding";
import { useAuthSession } from "../context/AuthSession";
import { routeViewCode } from '../features/accounts/routePermissions';
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

const tabIcons = { system: ShieldCheckIcon, plan: CalendarDaysIcon, masters: AcademicCapIcon, doctoral: TrophyIcon, reports: DocumentChartBarIcon };
const normalizeSearch = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
const breadcrumbLabel = (value) => value.charAt(0) + value.slice(1).toLocaleLowerCase("vi");

export const ribbons = {
  system: [
    group("TÀI KHOẢN & PHÂN QUYỀN", [
      action("Tài khoản nhân sự", "/system/accounts", UsersIcon, "var(--icon-teal)", { permissions: ["account.view"] }),
      action("Vai trò & phân quyền", "/system/roles", ShieldCheckIcon, "var(--icon-purple)", { permissions: ["role.view"] }),
      action("Nhật ký thao tác", "/system/audit-logs", ClockIcon, "var(--icon-primary)", { permissions: ["audit.view"] }),
    ]),
    group("THÔNG TIN", [
      action("Thông tin về đơn vị", "/system/unit-info", InformationCircleIcon, "var(--icon-primary)"),
      action("License", "/system/license", CheckBadgeIcon, "var(--icon-blue)"),
      action("Đổi mật khẩu", "/system/change-password", UserCircleIcon, "var(--icon-purple)"),
      action("Thoát chương trình", null, ArrowRightStartOnRectangleIcon, "var(--icon-primary)", { action: "logout" }),
    ]),
    group("DANH MỤC CHUNG", [
      action("Dân tộc", "/system/ethnicities", UsersIcon, "var(--icon-warning)", { permissions: ["catalog.view"] }),
      action("Phường xã", "/system/wards", BuildingOfficeIcon, "var(--icon-teal)", { permissions: ["catalog.view"] }),
      action("Quốc tịch", "/system/nationalities", FlagIcon, "var(--icon-blue)", { permissions: ["catalog.view"] }),
      action("Thành phố", "/system/cities", BuildingOfficeIcon, "var(--icon-rose)", { permissions: ["catalog.view"] }),
    ]),
    group("DANH MỤC ĐÀO TẠO", [
      action("Giảng viên", "/system/lecturers", AcademicCapIcon, "var(--icon-blue)", { permissions: ["catalog.view"] }),
      action("Đơn vị", "/system/units", BuildingOffice2Icon, "var(--icon-teal)", { permissions: ["catalog.view"] }),
      action("Phòng học", "/system/rooms", HomeModernIcon, "var(--icon-teal)", { permissions: ["catalog.view"] }),
      action("Nhóm hình thức đào tạo", "/system/training-mode-groups", Squares2X2Icon, "var(--icon-primary)", { permissions: ["catalog.view"] }),
      action("Hình thức đào tạo", "/system/training-modes", ClipboardDocumentCheckIcon, "var(--icon-olive)", { permissions: ["catalog.view"] }),
      action("Ngành đào tạo", "/system/disciplines", BuildingLibraryIcon, "var(--icon-primary)", { permissions: ["catalog.view"] }),
      action("Chuyên ngành", "/system/majors", BookOpenIcon, "var(--icon-warning)", { permissions: ["catalog.view"] }),
      action("Trình độ đào tạo", "/system/training-levels", TrophyIcon, "var(--icon-purple)", { permissions: ["catalog.view"] }),
      action("Trạng thái học", "/system/study-statuses", CheckCircleIcon, "var(--icon-teal)", { permissions: ["catalog.view"] }),
      action("Bổ sung kiến thức", "/system/bridge-knowledge", ClipboardDocumentCheckIcon, "var(--icon-primary)", { permissions: ["catalog.view"] }),
      action("Check Update", "/system/check-update", ArrowDownOnSquareIcon, "var(--icon-neutral)"),
    ]),
  ],
  plan: [
    group("KẾ HOẠCH KHÓA MỚI", [
      action("Kế hoạch đào tạo", "/plan/training-plan", CalendarDaysIcon, "var(--icon-primary)", { permissions: ["plan.view"] }),
      action("Chỉ tiêu xét tuyển", "/plan/admission-targets", AdjustmentsHorizontalIcon, "var(--icon-warning)", { permissions: ["admission.view"] }),
      action("Khoản thu đầu năm", "/plan/annual-fees", BanknotesIcon, "var(--icon-teal)", { permissions: ["plan.view"] }),
      action("Nhập hồ sơ tuyển sinh", "/plan/admission-records", ArrowUpTrayIcon, "var(--icon-purple)", { permissions: ["admission.view"] }),
    ]),
  ],
  masters: [
    group("THỦ TỤC ĐẦU VÀO", [
      action("Học bổ sung kiến thức", "/masters/bridge-course", ClipboardDocumentCheckIcon, "var(--icon-primary)", { permissions: ["masters.view"] }),
      action("Điểm xét tuyển thạc sĩ", "/masters/admission-scores", ChartBarIcon, "var(--icon-warning)", { permissions: ["admission.view"] }),
      action("Hồ sơ trúng tuyển", "/masters/admitted-records", CheckCircleIcon, "var(--icon-success)", { permissions: ["admission.view"] }),
      action("Quản lý bảo lưu", "/masters/study-leaves", DocumentTextIcon, "var(--icon-rose)", { permissions: ["plan.view"] }),
      action("Tạo nhóm học viên", "/masters/create-class-groups", UserPlusIcon, "var(--icon-teal)", { permissions: ["masters.view"] }),
      action("Phân nhóm học viên", "/masters/assign-class-groups", UserGroupIcon, "var(--icon-olive)", { permissions: ["masters.view"] }),
      action("Thống kê tiến độ", "/masters/class-course-history", DocumentTextIcon, "var(--icon-rose)", { permissions: ["plan.view", "scheduling.view"] }),
    ]),
    group("XẾP LỊCH HỌC", [
      action("Tạo lớp học phần", "/masters/course-offerings", DocumentPlusIcon, "var(--icon-primary)", { permissions: ["scheduling.view"] }),
      action("Xếp lịch", "/masters/schedule", CalendarDaysIcon, "var(--icon-purple)", { permissions: ["scheduling.view"] }),
      action("Ma trận lớp học phần", "/masters/course-matrix", TableCellsIcon, "var(--icon-teal)", { permissions: ["scheduling.view"] }),
    ]),
    group("QUẢN LÝ ĐIỂM", [
      action("Danh sách thi, điểm thi", "/masters/exam-lists", ClipboardDocumentListIcon, "var(--icon-rose)", { permissions: ["gradebook.view"] }),
      action('Xếp lịch thi', '/masters/exam-schedule', CalendarDaysIcon, 'var(--icon-rose)', { permissions: ['exams.view'] }),
      action("Tổng hợp điểm của lớp", "/reports/class-score-summary", DocumentChartBarIcon, "var(--icon-teal)", { permissions: ["reports.view"] }),
    ]),
    group("THỦ TỤC ĐẦU RA", [
      action("Tạo đợt thi English", "/masters/english-exam", CalendarIcon, "var(--icon-primary)", { permissions: ["masters.view"] }),
      action("Điểm thi English", "/masters/english-scores", DocumentCheckIcon, "var(--icon-warning)", { permissions: ["masters.view"] }),
      action("Đăng ký đạt chuẩn ngoại ngữ", "/masters/english-certification", LanguageIcon, "var(--icon-teal)", { permissions: ["masters.view"] }),
      action("Bảo vệ tốt nghiệp", "/masters/final-defense", ScaleIcon, "var(--icon-purple)", { permissions: ["masters.view"] }),
      action("Hồ sơ tốt nghiệp", "/masters/graduation-docs", FolderOpenIcon, "var(--icon-primary)", { permissions: ["masters.view"] }),
    ]),
  ],
  doctoral: [
    group("ĐÀO TẠO", [
      action("Điểm đầu vào TS", "/doctoral/admission-scores", ChartBarIcon, "var(--icon-warning)", { permissions: ["doctoral.view"] }),
      action("Tạo nhóm học phần TS", "/doctoral/create-class-groups", UserPlusIcon, "var(--icon-teal)", { permissions: ["doctoral.view"] }),
      action("Phân nhóm học phần TS", "/doctoral/assign-class-groups", UserGroupIcon, "var(--icon-olive)", { permissions: ["doctoral.view"] }),
      action("Xét tư cách thi hết môn", "/doctoral/exam-eligibility", ClipboardDocumentCheckIcon, "var(--icon-primary)", { permissions: ["doctoral.view"] }),
      action("ĐIỂM THI", "/doctoral/exam-scores", DocumentCheckIcon, "var(--icon-rose)", { permissions: ["doctoral.view"] }),
      action("Danh sách thi, điểm thi", "/doctoral/exam-lists", ClipboardDocumentListIcon, "var(--icon-primary)", { permissions: ["doctoral.view"] }),
    ]),
    group("TIỂU LUẬN, HỘI THẢO VÀ BẢO VỆ", [
      action("Tổng quan, chuyên đề", "/doctoral/overview-topics", BookOpenIcon, "var(--icon-primary)", { permissions: ["doctoral.view"] }),
      action("Hội thảo cấp trường", "/doctoral/university-workshops", UsersIcon, "var(--icon-warning)", { permissions: ["doctoral.view"] }),
      action("Bảo vệ cấp cơ sở", "/doctoral/faculty-defense", BuildingLibraryIcon, "var(--icon-teal)", { permissions: ["doctoral.view"] }),
      action("Phản biện kín 2 người", "/doctoral/closed-review", LockClosedIcon, "var(--icon-purple)", { permissions: ["doctoral.view"] }),
      action("Bảo vệ cấp trường", "/doctoral/university-defense", AcademicCapIcon, "var(--icon-primary)", { permissions: ["doctoral.view"] }),
      action("Hồ sơ tốt nghiệp", "/doctoral/graduation-docs", FolderOpenIcon, "var(--icon-rose)", { permissions: ["doctoral.view"] }),
    ]),
  ],
  reports: [
    group("BÁO CÁO CHUNG", [
      action("Thanh toán giảng viên", "/reports/lecturer-payments", TableCellsIcon, "var(--icon-teal)", { permissions: ["reports.view"] }),
      action("Danh sách lớp", "/reports/class-lists", UsersIcon, "var(--icon-primary)", { permissions: ["reports.view"] }),
      action("Bảng điểm môn học", "/reports/course-scores", TableCellsIcon, "var(--icon-warning)", { permissions: ["reports.view"] }),
      action("Báo cáo gửi Bộ", "/reports/ministerial-report", PaperAirplaneIcon, "var(--icon-purple)", { permissions: ["reports.view"] }),
    ]),
    group("BẢNG ĐIỂM TẠM THỜI", [
      action("Bảng điểm Thạc sĩ", "/reports/temp-score-masters", TableCellsIcon, "var(--icon-olive)", { permissions: ["reports.view"] }),
      action("Bảng điểm Tiến sĩ", "/reports/temp-score-doctoral", TableCellsIcon, "var(--icon-rose)", { permissions: ["reports.view"] }),
    ]),
    group("PHỤ LỤC VĂN BẰNG", [
      action("Phụ lục văn bằng Thạc sĩ", "/reports/diploma-appendix-masters", DocumentPlusIcon, "var(--icon-primary)", { permissions: ["reports.view"] }),
      action("Phụ lục văn bằng Tiến sĩ", "/reports/diploma-appendix-doctoral", DocumentPlusIcon, "var(--icon-primary)", { permissions: ["reports.view"] }),
    ]),
  ],
};

const roleNames = { admin: "Quản trị viên", supervisor: "Giảng viên hướng dẫn", examiner: "Giám khảo", student: "Học viên" };
const tabForPath = (path) => (tabs.find(([id]) => ribbons[id].some(section => section.actions.some(item => isRibbonRouteActive(path, item.route))))
  || tabs.find(([id]) => path === `/${id}` || path.startsWith(`/${id}/`)))?.[0] || "system";

const RibbonHeader = () => {
  const confirmLeave = useConfirmGradeLeave();
  const discardUnsaved = useDiscardUnsavedGrades();
  const navigate = useNavigate();
  const location = useLocation();
  const session = useAuthSession();
  const sessionRole = session ? session.activeProfile?.code || session.user?.role || "student" : null;
  const [activeTab, setActiveTab] = useState(() => tabForPath(location.pathname));
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const menuToggleRef = useRef(null);
  const sidebarRef = useRef(null);
  const searchRef = useRef(null);
  const searchRequestedRef = useRef(false);
  const closeMenu = () => {
    setMenuOpen(false);
    setSearchQuery("");
    menuToggleRef.current?.focus();
  };
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
    if (sidebarRef.current?.contains(document.activeElement)) menuToggleRef.current?.focus();
    setMenuOpen(false);
    setSearchQuery("");
  }, [path, location.search]);

  useEffect(() => {
    if (menuOpen) {
      if (searchRequestedRef.current) searchRef.current?.focus();
      else sidebarRef.current?.querySelector(".ribbon-tab-toggle.active")?.focus();
      searchRequestedRef.current = false;
    }
    const onKeyDown = (event) => {
      if (event.defaultPrevented) return;
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target?.closest?.("input, textarea, select, [contenteditable], [role='dialog']")) {
        event.preventDefault();
        if (menuOpen) searchRef.current?.focus();
        else {
          searchRequestedRef.current = true;
          setMenuOpen(true);
        }
      }
      if (menuOpen && event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  if (!role) return null;
  // Keep permission-gated navigation hidden until effective access is loaded.
  const access = session?.access;
  const hasPermission = (permission) => access
    ? (access.permissions || []).includes(permission)
    : false;
  const canSee = (item) => (!item.roles || item.roles.includes(role)) && (!item.permissions || item.permissions.every(hasPermission)) && (!item.anyPermissions || item.anyPermissions.some(hasPermission))
    && (!access?.routeCatalog||!item.permissions||hasPermission(routeViewCode(item.route)));
  const visibleTabs = tabs.filter(([id]) => ribbons[id].some(section => section.actions.some(canSee)));
  const selectedTab = activeTab === null ? null : visibleTabs.some(([id]) => id === activeTab) ? activeTab : visibleTabs[0]?.[0];
  const searchTerm = normalizeSearch(searchQuery);
  const matchesSearch = (item, groupLabel, tabLabel) => !searchTerm || normalizeSearch(`${tabLabel} ${groupLabel} ${item.label}`).includes(searchTerm);
  const filteredTabs = visibleTabs.map(([id, label]) => ({
    id, label,
    groups: ribbons[id].map(section => ({ ...section, actions: section.actions.filter(item => canSee(item) && matchesSearch(item, section.label, label)) })).filter(section => section.actions.length),
  })).filter(tab => tab.groups.length);
  const currentTab = visibleTabs.find(([id]) => ribbons[id].some(section => section.actions.some(item => canSee(item) && isRibbonRouteActive(path, item.route))));
  const currentGroup = currentTab && ribbons[currentTab[0]].find(section => section.actions.some(item => canSee(item) && isRibbonRouteActive(path, item.route)));
  const currentAction = currentGroup?.actions.find(item => canSee(item) && isRibbonRouteActive(path, item.route));
  const userName = session?.user?.name || session?.user?.fullName || roleNames[role] || role;
  const avatar = role === "admin" ? "AD" : "NV";
  const renderAction = (item) => {
    const Icon = item.icon;
    const isActive = isRibbonRouteActive(path, item.route);
    return <button type="button" className={`ribbon-action${isActive ? " active" : ""}`} key={item.label} onClick={() => runAction(item)}
      disabled={item.action === "logout" && loggingOut}
      onPointerEnter={() => preloadPage(item.route)} onFocus={() => preloadPage(item.route)} onPointerDown={() => preloadPage(item.route)}
      style={{ "--ribbon-icon-color": item.color }} aria-current={isActive ? "page" : undefined}>
      <Icon className="ribbon-action-icon" /><span>{item.label}</span>
    </button>;
  };
  const runAction = async (item) => {
    if (item.action === "logout" && loggingOut) return;
    if (item.action !== "logout") {
      if (path === item.route && !location.search) closeMenu();
      return navigate(item.route);
    }
    if (!await confirmLeave()) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      await axios.post(`${API_BASE_URL}/user/logout`, {}, { withCredentials: true });
      discardUnsaved();
      navigate("/login", { replace: true });
    } catch {
      setLogoutError("Không thể đăng xuất. Vui lòng thử lại.");
    } finally {
      setLoggingOut(false);
    }
  };
  return (
    <header className={`ribbon-header${menuOpen ? " ribbon-menu-open" : ""}`}>
      <div className="ribbon-titlebar">
        <div className="ribbon-topbar-start">
          <div className="ribbon-breadcrumb" aria-label="Vị trí hiện tại">
            <span>{currentTab ? breadcrumbLabel(currentTab[1]) : BRAND.institute}</span>
            {currentGroup && <><ChevronRightIcon aria-hidden="true" /><span>{breadcrumbLabel(currentGroup.label)}</span></>}
            {currentAction && <><ChevronRightIcon aria-hidden="true" /><strong aria-current="page">{currentAction.label}</strong></>}
          </div>
        </div>
        <div className="ribbon-user-avatar" title={`${userName} · ${roleNames[role] || role}`}>{avatar}</div>
      </div>
      <button
        ref={menuToggleRef}
        type="button"
        className={`ribbon-menu-tab${menuOpen ? " is-open" : ""}`}
        aria-label={menuOpen ? "Thu gọn menu tác vụ" : "Mở menu tác vụ"}
        aria-expanded={menuOpen}
        aria-controls="ribbon-sidebar"
        onClick={() => menuOpen ? closeMenu() : setMenuOpen(true)}
      >
        {menuOpen ? <ChevronLeftIcon /> : <Bars3Icon />}<span>Menu</span>
      </button>
      {menuOpen && <div className="ribbon-menu-backdrop" aria-hidden="true" onClick={closeMenu} />}
      <aside id="ribbon-sidebar" ref={sidebarRef} className="ribbon-sidebar" aria-label="Menu chức năng" hidden={!menuOpen}>
        <div className="ribbon-sidebar-brand ribbon-brand-group">
          <button className="ribbon-brand" type="button" onClick={() => navigate("/")} aria-label="Về trang chủ">
            <img src={BRAND.logoUrl} alt={`Biểu trưng ${BRAND.university}`} />
          </button>
          <div className="ribbon-title"><strong>{BRAND.university}</strong><span>{BRAND.institute}</span></div>
        </div>
        <div className="ribbon-search-wrap">
          <label className="ribbon-search"><MagnifyingGlassIcon />
            <input ref={searchRef} type="search" aria-label="Tìm kiếm chức năng" placeholder="Tìm kiếm chức năng..." value={searchQuery} onChange={event => setSearchQuery(event.target.value)} />
            <kbd aria-hidden="true">/</kbd>
          </label>
        </div>
        <div className="ribbon-command-scroll">
          <div className="ribbon-navigation-label">Danh mục chức năng</div>
          <nav className="ribbon-tabs" aria-label="Nhóm chức năng">
            {filteredTabs.map(({ id, label, groups }) => {
              const expanded = Boolean(searchTerm) || selectedTab === id;
              const TabIcon = tabIcons[id];
              return <div className="ribbon-tab-section" key={id}>
                <button type="button" className={`ribbon-tab-toggle${expanded ? " active" : ""}`} aria-expanded={expanded} aria-controls={`ribbon-section-${id}`} onClick={() => {
                  setSearchQuery("");
                  setActiveTab(selectedTab === id && !searchTerm ? null : id);
                }}><TabIcon /><span>{label}</span><ChevronDownIcon className={`ribbon-section-chevron${expanded ? " expanded" : ""}`} /></button>
                <div id={`ribbon-section-${id}`} className="ribbon-commands" role="region" aria-label="Tác vụ chức năng" hidden={!expanded}>
                  {expanded && groups.map(itemGroup => <section className="ribbon-group" key={itemGroup.label}>
                    <div className="ribbon-group-label">{itemGroup.label}</div>
                    <div className="ribbon-actions">{itemGroup.actions.map(renderAction)}</div>
                  </section>)}
                </div>
              </div>;
            })}
          </nav>
          {!filteredTabs.length && <p className="ribbon-search-empty" role="status">Không tìm thấy chức năng phù hợp.</p>}
        </div>
        {logoutError && <div className="ribbon-logout-error" role="alert">{logoutError}</div>}
        <div className="ribbon-sidebar-footer" title={`Hồ sơ: ${session?.activeProfile?.name || roleNames[role] || role}`}>
          <div className="ribbon-user-avatar">{avatar}</div>
          <div className="ribbon-user-info"><span className="ribbon-user-name">{userName}</span><span className="ribbon-user-role">{session?.activeProfile?.name || (session?.user?.name || session?.user?.fullName ? roleNames[role] || role : BRAND.institute)}</span>
          {session?.activeProfile && <span className="ribbon-user-role">{session.activeProfile.scopeLabel}</span>}
          {session?.chooseProfile && (session.profiles || []).length > 1 && <button type="button" className="sl-btn" onClick={async () => { if (await confirmLeave()) session.chooseProfile(); }}>Đổi phiên làm việc</button>}
          </div>
          <button type="button" className="ribbon-footer-logout" aria-label="Đăng xuất" title="Đăng xuất" disabled={loggingOut} onClick={() => runAction({ action: "logout" })}><ArrowRightStartOnRectangleIcon /></button>
        </div>
      </aside>
    </header>
  );
};
export default RibbonHeader;
