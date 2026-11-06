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
import DashboardActivity from '../features/dashboard/DashboardActivity';

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
      action("Tài khoản nhân sự", "/system/accounts", UsersIcon, "#168b7c", { permissions: ["account.view"] }),
      action("Vai trò & phân quyền", "/system/roles", ShieldCheckIcon, "#7b5fac", { permissions: ["role.view"] }),
      action("Nhật ký thao tác", "/system/audit-logs", ClockIcon, "#397c8d", { permissions: ["audit.view"] }),
    ]),
    group("THÔNG TIN", [
      action("Thông tin về đơn vị", "/system/unit-info", InformationCircleIcon, "#168bc2"),
      action("License", "/system/license", CheckBadgeIcon, "#4b84b8"),
      action("Đổi mật khẩu", "/system/change-password", UserCircleIcon, "#7b5fac"),
      action("Thoát chương trình", null, ArrowRightStartOnRectangleIcon, "#227aa6", { action: "logout" }),
    ]),
    group("DANH MỤC CHUNG", [
      action("Dân tộc", "/system/ethnicities", UsersIcon, "#c0792a", { permissions: ["catalog.view"] }),
      action("Phường xã", "/system/wards", BuildingOfficeIcon, "#168b7c", { permissions: ["catalog.view"] }),
      action("Quốc tịch", "/system/nationalities", FlagIcon, "#3f8cc3", { permissions: ["catalog.view"] }),
      action("Thành phố", "/system/cities", BuildingOfficeIcon, "#a04f86", { permissions: ["catalog.view"] }),
    ]),
    group("DANH MỤC ĐÀO TẠO", [
      action("Giảng viên", "/system/lecturers", AcademicCapIcon, "#3f8cc3", { permissions: ["catalog.view"] }),
      action("Đơn vị", "/system/units", BuildingOffice2Icon, "#168b7c", { permissions: ["catalog.view"] }),
      action("Phòng học", "/system/rooms", HomeModernIcon, "#168b7c", { permissions: ["catalog.view"] }),
      action("Nhóm hình thức đào tạo", "/system/training-mode-groups", Squares2X2Icon, "#168bc2", { permissions: ["catalog.view"] }),
      action("Hình thức đào tạo", "/system/training-modes", ClipboardDocumentCheckIcon, "#81952c", { permissions: ["catalog.view"] }),
      action("Ngành đào tạo", "/system/disciplines", BuildingLibraryIcon, "#397c8d", { permissions: ["catalog.view"] }),
      action("Chuyên ngành", "/system/majors", BookOpenIcon, "#c0792a", { permissions: ["catalog.view"] }),
      action("Trình độ đào tạo", "/system/training-levels", TrophyIcon, "#7b5fac", { permissions: ["catalog.view"] }),
      action("Trạng thái học", "/system/study-statuses", CheckCircleIcon, "#168b7c", { permissions: ["catalog.view"] }),
      action("Bổ sung kiến thức", "/system/bridge-knowledge", ClipboardDocumentCheckIcon, "#397c8d", { permissions: ["catalog.view"] }),
      action("Check Update", "/system/check-update", ArrowDownOnSquareIcon, "#303942"),
    ]),
  ],
  plan: [
    group("KẾ HOẠCH KHÓA MỚI", [
      action("Kế hoạch đào tạo", "/plan/training-plan", CalendarDaysIcon, "#168bc2", { permissions: ["plan.view"] }),
      action("Chỉ tiêu xét tuyển", "/plan/admission-targets", AdjustmentsHorizontalIcon, "#c0792a", { permissions: ["admission.view"] }),
      action("Khoản thu đầu năm", "/plan/annual-fees", BanknotesIcon, "#168b7c", { permissions: ["plan.view"] }),
      action("Nhập hồ sơ tuyển sinh", "/plan/admission-records", ArrowUpTrayIcon, "#7b5fac", { permissions: ["admission.view"] }),
    ]),
  ],
  masters: [
    group("THỦ TỤC ĐẦU VÀO", [
      action("Học bổ sung kiến thức", "/masters/bridge-course", ClipboardDocumentCheckIcon, "#168bc2", { permissions: ["masters.view"] }),
      action("Điểm xét tuyển thạc sĩ", "/masters/admission-scores", ChartBarIcon, "#c0792a", { permissions: ["admission.view"] }),
      action("Hồ sơ trúng tuyển", "/masters/admitted-records", CheckCircleIcon, "#137b3b", { permissions: ["admission.view"] }),
      action("Quản lý bảo lưu", "/masters/study-leaves", DocumentTextIcon, "#a04f86", { permissions: ["plan.view"] }),
      action("Tạo nhóm học viên", "/masters/create-class-groups", UserPlusIcon, "#168b7c", { permissions: ["masters.view"] }),
      action("Phân nhóm học viên", "/masters/assign-class-groups", UserGroupIcon, "#81952c", { permissions: ["masters.view"] }),
      action("Thống kê tiến độ", "/masters/class-course-history", DocumentTextIcon, "#a04f86", { permissions: ["plan.view", "scheduling.view"] }),
    ]),
    group("XẾP LỊCH HỌC", [
      action("Tạo lớp học phần", "/masters/course-offerings", DocumentPlusIcon, "#0788b8", { permissions: ["scheduling.view"] }),
      action("Xếp lịch", "/masters/schedule", CalendarDaysIcon, "#7b5fac", { permissions: ["scheduling.view"] }),
      action("Ma trận lớp học phần", "/masters/course-matrix", TableCellsIcon, "#168b7c", { permissions: ["scheduling.view"] }),
    ]),
    group("QUẢN LÝ ĐIỂM", [
      action("Danh sách thi, điểm thi", "/masters/exam-lists", ClipboardDocumentListIcon, "#a04f86", { permissions: ["gradebook.view"] }),
      action('Xếp lịch thi', '/masters/exam-schedule', CalendarDaysIcon, '#b75c75', { permissions: ['exams.view'] }),
      action("Tổng hợp điểm của lớp", "/reports/class-score-summary", DocumentChartBarIcon, "#168b7c", { permissions: ["reports.view"] }),
    ]),
    group("THỦ TỤC ĐẦU RA", [
      action("Tạo đợt thi English", "/masters/english-exam", CalendarIcon, "#168bc2", { permissions: ["masters.view"] }),
      action("Điểm thi English", "/masters/english-scores", DocumentCheckIcon, "#c0792a", { permissions: ["masters.view"] }),
      action("Đăng ký đạt chuẩn ngoại ngữ", "/masters/english-certification", LanguageIcon, "#168b7c", { permissions: ["masters.view"] }),
      action("Bảo vệ tốt nghiệp", "/masters/final-defense", ScaleIcon, "#7b5fac", { permissions: ["masters.view"] }),
      action("Hồ sơ tốt nghiệp", "/masters/graduation-docs", FolderOpenIcon, "#397c8d", { permissions: ["masters.view"] }),
    ]),
  ],
  doctoral: [
    group("ĐÀO TẠO", [
      action("Điểm đầu vào TS", "/doctoral/admission-scores", ChartBarIcon, "#c0792a", { permissions: ["doctoral.view"] }),
      action("Tạo nhóm học phần TS", "/doctoral/create-class-groups", UserPlusIcon, "#168b7c", { permissions: ["doctoral.view"] }),
      action("Phân nhóm học phần TS", "/doctoral/assign-class-groups", UserGroupIcon, "#81952c", { permissions: ["doctoral.view"] }),
      action("Xét tư cách thi hết môn", "/doctoral/exam-eligibility", ClipboardDocumentCheckIcon, "#397c8d", { permissions: ["doctoral.view"] }),
      action("ĐIỂM THI", "/doctoral/exam-scores", DocumentCheckIcon, "#a04f86", { permissions: ["doctoral.view"] }),
      action("Danh sách thi, điểm thi", "/doctoral/exam-lists", ClipboardDocumentListIcon, "#168bc2", { permissions: ["doctoral.view"] }),
    ]),
    group("TIỂU LUẬN, HỘI THẢO VÀ BẢO VỆ", [
      action("Tổng quan, chuyên đề", "/doctoral/overview-topics", BookOpenIcon, "#168bc2", { permissions: ["doctoral.view"] }),
      action("Hội thảo cấp trường", "/doctoral/university-workshops", UsersIcon, "#c0792a", { permissions: ["doctoral.view"] }),
      action("Bảo vệ cấp cơ sở", "/doctoral/faculty-defense", BuildingLibraryIcon, "#168b7c", { permissions: ["doctoral.view"] }),
      action("Phản biện kín 2 người", "/doctoral/closed-review", LockClosedIcon, "#7b5fac", { permissions: ["doctoral.view"] }),
      action("Bảo vệ cấp trường", "/doctoral/university-defense", AcademicCapIcon, "#397c8d", { permissions: ["doctoral.view"] }),
      action("Hồ sơ tốt nghiệp", "/doctoral/graduation-docs", FolderOpenIcon, "#a04f86", { permissions: ["doctoral.view"] }),
    ]),
  ],
  reports: [
    group("BÁO CÁO CHUNG", [
      action("Báo cáo tài chính", "/reports/lecturer-payments", TableCellsIcon, "#168b7c", { permissions: ["reports.view"] }),
      action("Danh sách lớp", "/reports/class-lists", UsersIcon, "#168bc2", { permissions: ["reports.view"] }),
      action("Bảng điểm môn học", "/reports/course-scores", TableCellsIcon, "#c0792a", { permissions: ["reports.view"] }),
      action("Báo cáo gửi Bộ", "/reports/ministerial-report", PaperAirplaneIcon, "#7b5fac", { permissions: ["reports.view"] }),
    ]),
    group("BẢNG ĐIỂM TẠM THỜI", [
      action("Bảng điểm Thạc sĩ", "/reports/temp-score-masters", TableCellsIcon, "#81952c", { permissions: ["reports.view"] }),
      action("Bảng điểm Tiến sĩ", "/reports/temp-score-doctoral", TableCellsIcon, "#a04f86", { permissions: ["reports.view"] }),
    ]),
    group("PHỤ LỤC VĂN BẰNG", [
      action("Phụ lục văn bằng Thạc sĩ", "/reports/diploma-appendix-masters", DocumentPlusIcon, "#397c8d", { permissions: ["reports.view"] }),
      action("Phụ lục văn bằng Tiến sĩ", "/reports/diploma-appendix-doctoral", DocumentPlusIcon, "#168bc2", { permissions: ["reports.view"] }),
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
  const dashboardHome = path === '/' || path === '/viewLogged';
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
        {dashboardHome ? <div className="od-header-account">
          <DashboardActivity />
          <div className="od-header-identity"><strong>{userName}</strong><span>{session?.activeProfile?.name || roleNames[role] || role}</span></div>
          <div className="ribbon-user-avatar" title={userName}>{avatar}</div>
        </div> : <div className="ribbon-user-avatar" title={`${userName} · ${roleNames[role] || role}`}>{avatar}</div>}
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
          {!dashboardHome && <div className="ribbon-user-avatar">{avatar}</div>}
          <div className="ribbon-user-info">{!dashboardHome && <><span className="ribbon-user-name">{userName}</span><span className="ribbon-user-role">{session?.activeProfile?.name || (session?.user?.name || session?.user?.fullName ? roleNames[role] || role : BRAND.institute)}</span></>}
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
