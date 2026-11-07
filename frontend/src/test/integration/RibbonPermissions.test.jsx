import { fireEvent, render as baseRender, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import RibbonHeader, { ribbons } from "../../components/RibbonHeader";
import { AuthSessionContext } from "../../context/AuthSession";
import * as lazyPages from '../../utils/lazyPage';

// Independent navigation contract. Optional page dialogs do not add page gates.
const routesByPermission = {
  "account.view": ["/system/accounts"],
  "role.view": ["/system/roles"],
  "audit.view": ["/system/audit-logs"],
  "catalog.view": ["ethnicities", "nationalities", "wards", "cities", "lecturers", "units", "rooms", "training-mode-groups", "training-modes", "disciplines", "majors", "training-years", "training-levels", "study-statuses", "bridge-knowledge"].map(s => "/system/" + s),
  "plan.view": ["/plan/training-plan", "/plan/annual-fees", "/masters/study-leaves"],
  "admission.view": ["/plan/admission-targets", "/plan/admission-records", "/masters/admission-scores", "/masters/admitted-records"],
  "masters.view": ["bridge-course", "create-class-groups", "assign-class-groups", "english-exam", "english-scores", "english-certification", "final-defense", "graduation-docs"].map(s => "/masters/" + s),
  "scheduling.view": ["course-offerings", "schedule", "course-matrix"].map(s => "/masters/" + s),
  "gradebook.view": ["/masters/exam-lists"],
  "exams.view": ["/masters/exam-schedule"],
  "reports.view": ["/reports/lecturer-payments", "/reports/class-score-summary", ...["class-lists", "course-scores", "ministerial-report", "temp-score-masters", "temp-score-doctoral", "diploma-appendix-masters", "diploma-appendix-doctoral"].map(s => "/reports/" + s)],
  "doctoral.view": ["admission-scores", "create-class-groups", "assign-class-groups", "exam-eligibility", "exam-scores", "exam-lists", "overview-topics", "university-workshops", "faculty-defense", "closed-review", "university-defense", "graduation-docs"].map(s => "/doctoral/" + s),
};
const expected = new Map(Object.entries(routesByPermission).flatMap(([permission, routes]) => routes.map(route => [route, [permission]])));
expected.set("/masters/class-course-history", ["plan.view", "scheduling.view"]);
for (const route of ["/system/appearance", "/system/unit-info", "/system/license", "/system/change-password", "/system/check-update", null]) expected.set(route, []);
const items = Object.values(ribbons).flatMap(sections => sections.flatMap(section => section.actions));
const session = (permissions, role = "custom") => ({ user: { role }, access: permissions === null ? null : { permissions, roles: [] } });
const view = (value, route = "/") => <MemoryRouter useTransitions={false} initialEntries={[route]}><AuthSessionContext.Provider value={value}><RibbonHeader /></AuthSessionContext.Provider></MemoryRouter>;
const visibleLabels = container => [...container.querySelectorAll(".ribbon-action span")].map(e => e.textContent);

const render = (...args) => {
  const result = baseRender(...args);
  const toggle = screen.queryByRole("button", { name: "Mở menu tác vụ" });
  if (toggle) fireEvent.click(toggle);
  return result;
};
beforeEach(() => sessionStorage.removeItem('sdh.sidebar.open'));
describe("Ribbon read/navigation permission contracts", () => {
  it('navigates directly to the dashboard from the compact logo without opening the menu', () => {
    const CurrentPath = () => <output data-testid="current-path">{useLocation().pathname}</output>;
    baseRender(<MemoryRouter initialEntries={['/masters/schedule']}><AuthSessionContext.Provider value={session(['scheduling.view'])}>
      <RibbonHeader /><CurrentPath />
    </AuthSessionContext.Provider></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Về trang chủ' }).querySelector('img'));
    expect(screen.getByTestId('current-path')).toHaveTextContent(/^\/$/);
    expect(document.querySelector('.ribbon-sidebar')).toHaveClass('is-compact');
    expect(sessionStorage.getItem('sdh.sidebar.open')).toBe('false');
    expect(screen.queryByRole('searchbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mở menu tác vụ' }));
    expect(document.querySelector('.ribbon-sidebar')).toHaveClass('is-expanded');
  });

  it('does not preload pages when the pointer only passes across menu items', () => {
    vi.useFakeTimers();
    const preload = vi.spyOn(lazyPages, 'preloadPage').mockImplementation(() => {});
    try {
      render(view(session(['scheduling.view']), '/masters/schedule'));
      preload.mockClear();
      const target = screen.getByRole('button', { name: 'Tạo lớp học phần' });
      fireEvent.pointerEnter(target);
      fireEvent.pointerLeave(target);
      vi.advanceTimersByTime(700);
      expect(preload).not.toHaveBeenCalled();
      fireEvent.pointerEnter(target);
      vi.advanceTimersByTime(160);
      expect(preload).toHaveBeenCalledWith('/masters/course-offerings');
      preload.mockClear();
      fireEvent.pointerDown(target);
      expect(preload).toHaveBeenCalledWith('/masters/course-offerings');
    } finally { preload.mockRestore(); vi.useRealTimers(); }
  });

  it('does not recenter a manually scrolled menu when an unrelated subgroup opens or closes', () => {
    render(view(session(['masters.view', 'scheduling.view']), '/masters/schedule'));
    const scroller = document.querySelector('.ribbon-command-scroll');
    scroller.scrollTop = 120;
    const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if (this.classList.contains('ribbon-command-scroll')) return { top: 100, bottom: 500 };
      if (this.classList.contains('ribbon-action')) return { top: 600, bottom: 640 };
      return { top: 0, bottom: 0 };
    });
    try {
      fireEvent.click(screen.getByRole('button', { name: 'THỦ TỤC ĐẦU VÀO' }));
      expect(scroller.scrollTop).toBe(120);
      fireEvent(document.querySelector('.ribbon-group-body'), Object.assign(new Event('transitionend', { bubbles: true }), { propertyName: 'grid-template-rows' }));
      expect(scroller.scrollTop).toBe(120);
    } finally { bounds.mockRestore(); }
  });

  it('switches categories in a separate icon rail while preserving the brand and account blocks', () => {
    render(view(session(['catalog.view', 'scheduling.view']), '/system/majors'));
    const brand = document.querySelector('.ribbon-sidebar-brand');
    const footer = document.querySelector('.ribbon-sidebar-footer');
    const brandMarkup = brand.innerHTML, footerMarkup = footer.innerHTML;
    const rail = within(screen.getByRole('navigation', { name: 'Nhóm chức năng' }));
    expect(rail.getByRole('button', { name: 'HỆ THỐNG' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Chuyên ngành' }).closest('.ribbon-navigation-rail')).toBeNull();
    fireEvent.click(rail.getByRole('button', { name: 'ĐÀO TẠO THẠC SĨ' }));
    expect(screen.getByRole('button', { name: 'Xếp lịch' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Chuyên ngành' })).toBeNull();
    expect(brand.innerHTML).toBe(brandMarkup);
    expect(footer.innerHTML).toBe(footerMarkup);
    fireEvent.click(screen.getByRole('button', { name: 'Thu gọn menu tác vụ' }));
    expect(document.querySelector('.ribbon-sidebar')).toHaveClass('is-compact');
    fireEvent.click(screen.getByRole('button', { name: 'Mở menu tác vụ' }));
    expect(screen.getByRole('button', { name: 'Chuyên ngành' })).toHaveAttribute('aria-current', 'page');
    expect(brand.innerHTML).toBe(brandMarkup);
    expect(footer.innerHTML).toBe(footerMarkup);
  });

  it('searches across categories and clears the results without losing the active category', () => {
    render(view(session(['catalog.view', 'scheduling.view']), '/masters/schedule'));
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: 'chuyen nganh' } });
    expect(screen.getByRole('button', { name: 'Chuyên ngành' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Xếp lịch' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm chức năng' }));
    expect(search).toHaveFocus();
    expect(search).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Xếp lịch' })).toHaveAttribute('aria-current', 'page');
  });

  it('reveals scheduling again after the reopening width transition changes wrapped label heights', () => {
    let actionTop = 2200;
    const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if (this.classList.contains('ribbon-command-scroll')) return { top: 100, bottom: 500 };
      if (this.classList.contains('ribbon-action')) {
        const top = actionTop - this.closest('.ribbon-command-scroll').scrollTop;
        return { top, bottom: top + 40 };
      }
      return { top: 0, bottom: 0 };
    });
    try {
      render(view(session(['masters.view', 'scheduling.view']), '/masters/schedule'));
      fireEvent.keyDown(document, { key: 'Escape' });
      fireEvent.click(screen.getByRole('button', { name: 'Mở menu tác vụ' }));
      const sidebar = screen.getByRole('complementary', { name: 'Menu chức năng' });
      const current = screen.getByRole('button', { name: 'Xếp lịch' });
      const scroller = document.querySelector('.ribbon-command-scroll');
      expect(current).toHaveAttribute('aria-current', 'page');
      expect(scroller.scrollTop).toBe(1920);
      // At the final expanded width, labels stop wrapping and the action moves up.
      actionTop = 700;
      expect(current.getBoundingClientRect().top).toBeLessThan(100);
      fireEvent(sidebar, Object.assign(new Event('transitionend', { bubbles: true }), { propertyName: 'width' }));
      expect(current.getBoundingClientRect().top).toBeGreaterThanOrEqual(100);
      expect(current.getBoundingClientRect().bottom).toBeLessThanOrEqual(500);
      expect(scroller.scrollTop).toBe(420);
      expect((current.getBoundingClientRect().top + current.getBoundingClientRect().bottom) / 2).toBe(300);
    } finally { bounds.mockRestore(); }
  });

  it('centers the current action on opening, navigation and remount even if already visible', () => {
    const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if (this.classList.contains('ribbon-command-scroll')) return { top: 100, bottom: 500 };
      if (this.classList.contains('ribbon-action')) {
        const scroller = this.closest('.ribbon-command-scroll');
        return { top: 700 - scroller.scrollTop, bottom: 740 - scroller.scrollTop };
      }
      return { top: 0, bottom: 0 };
    });
    try {
      const first = render(view(session(['catalog.view']), '/system/majors'));
      const scroller = document.querySelector('.ribbon-command-scroll');
      expect(scroller.scrollTop).toBe(420);
      expect(screen.getByRole('button', { name: 'Chuyên ngành' })).toHaveFocus();
      scroller.scrollTop = 300;
      fireEvent.click(screen.getByRole('button', { name: 'Ngành đào tạo' }));
      expect(scroller.scrollTop).toBe(420);
      first.unmount();
      render(view(session(['catalog.view']), '/system/majors'));
      expect(document.querySelector('.ribbon-command-scroll').scrollTop).toBe(420);
    } finally { bounds.mockRestore(); }
  });

  it('keeps actions near the beginning at the top instead of adding empty space to center them', () => {
    const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if (this.classList.contains('ribbon-command-scroll')) return { top: 100, bottom: 500 };
      if (this.classList.contains('ribbon-action')) return { top: 120, bottom: 160 };
      return { top: 0, bottom: 0 };
    });
    try {
      render(view(session([]), '/system/appearance'));
      const scroller = document.querySelector('.ribbon-command-scroll');
      expect(scroller.scrollTop).toBe(0);
      fireEvent.keyDown(document, { key: 'Escape' });
      fireEvent.click(screen.getByRole('button', { name: 'Mở menu tác vụ' }));
      expect(scroller.scrollTop).toBe(0);
    } finally { bounds.mockRestore(); }
  });

  it('reopens the current category and subgroup after browsing and collapsing other menu sections', () => {
    render(view(session(['catalog.view', 'scheduling.view']), '/system/majors'));
    fireEvent.click(screen.getByRole('button', { name: 'DANH MỤC ĐÀO TẠO' }));
    fireEvent.click(screen.getByRole('button', { name: 'ĐÀO TẠO THẠC SĨ' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Mở menu tác vụ' }));
    expect(screen.getByRole('button', { name: 'Chuyên ngành' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Chuyên ngành' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'DANH MỤC ĐÀO TẠO' })).toHaveAttribute('aria-expanded', 'true');
  });

  it.each(['.ribbon-sidebar', '.ribbon-sidebar-brand', '.ribbon-command-scroll', '.ribbon-sidebar-footer'])("opens the compact sidebar by clicking its blank area: %s", selector => {
    const { container } = baseRender(view(session(['scheduling.view']), '/masters/schedule'));
    expect(screen.getByRole('button', { name: 'Mở menu tác vụ' })).toBeInTheDocument();
    fireEvent.click(container.querySelector(selector));
    expect(document.querySelector('.ribbon-sidebar')).toHaveClass('is-expanded');
    expect(document.querySelector('.ribbon-menu-tab')).toBeNull();
    expect(screen.getByRole('button', { name: 'Xếp lịch' })).toHaveAttribute('aria-current', 'page');
  });

  it("closes on an outside click without swallowing the page action or stealing focus", () => {
    const clicked = jest.fn();
    render(<>{view(session(['scheduling.view']), '/masters/schedule')}<button onClick={clicked}>Nội dung trang</button></>);
    fireEvent.click(screen.getByRole('searchbox'));
    expect(document.querySelector('.ribbon-sidebar')).toHaveClass('is-expanded');
    const outside = screen.getByRole('button', { name: 'Nội dung trang' });
    outside.focus();
    fireEvent.click(outside);
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(outside).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Mở menu tác vụ' })).toBeInTheDocument();
    expect(sessionStorage.getItem('sdh.sidebar.open')).toBe('false');
  });

  it("only changes sidebar visibility through explicit controls, not pointer movement or focus", () => {
    const { unmount } = baseRender(view(session(['scheduling.view']), '/masters/schedule'));
    const sidebar = screen.getByRole('complementary', { name: 'Menu chức năng' });
    expect(sidebar).toBeVisible();
    expect(document.documentElement).toHaveAttribute('data-ribbon-sidebar', 'compact');
    expect(screen.getByRole('button', { name: 'ĐÀO TẠO THẠC SĨ' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xếp lịch' })).toBeNull();
    fireEvent.pointerEnter(sidebar);
    expect(document.documentElement).toHaveAttribute('data-ribbon-sidebar', 'compact');
    fireEvent.click(screen.getByRole('button', { name: 'Mở menu tác vụ' }));
    expect(document.documentElement).toHaveAttribute('data-ribbon-sidebar', 'expanded');
    expect(screen.getByRole('button', { name: 'Xếp lịch' })).toHaveAttribute('aria-current', 'page');
    fireEvent.pointerLeave(sidebar);
    fireEvent.blur(sidebar, { relatedTarget: document.body });
    expect(document.documentElement).toHaveAttribute('data-ribbon-sidebar', 'expanded');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.documentElement).toHaveAttribute('data-ribbon-sidebar', 'compact');
    expect(sidebar).toBeVisible();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xếp lịch' })).toBeNull();
    unmount();
    expect(document.documentElement).not.toHaveAttribute('data-ribbon-sidebar');
  });

  it("opens the rail search and requires activation to open a compact category", () => {
    baseRender(view(session(['scheduling.view']), '/masters/schedule'));
    fireEvent.click(screen.getByRole('button', { name: 'Mở tìm kiếm chức năng' }));
    expect(screen.getByRole('searchbox', { name: 'Tìm kiếm chức năng' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.focus(screen.getByRole('button', { name: 'ĐÀO TẠO THẠC SĨ' }));
    expect(screen.queryByRole('button', { name: 'Xếp lịch' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'ĐÀO TẠO THẠC SĨ' }));
    expect(screen.getByRole('button', { name: 'Xếp lịch' })).toBeInTheDocument();
  });

  it("keeps the sidebar open on navigation and restores that choice when the page remounts", () => {
    const first = render(view(session(['scheduling.view']), '/masters/schedule'));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo lớp học phần' }));
    expect(document.querySelector('.ribbon-sidebar')).toHaveClass('is-expanded');
    expect(sessionStorage.getItem('sdh.sidebar.open')).toBe('true');
    first.unmount();
    baseRender(view(session(['scheduling.view']), '/masters/course-offerings'));
    expect(document.querySelector('.ribbon-sidebar')).toHaveClass('is-expanded');
    expect(screen.getByRole('button', { name: 'Tạo lớp học phần' })).toHaveAttribute('aria-current', 'page');
  });

  it("keeps touch navigation behind a toggle and does not reserve a desktop column on mobile", () => {
    const previous = window.matchMedia;
    window.matchMedia = jest.fn(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
    try {
      baseRender(view(session(['scheduling.view']), '/masters/schedule'));
      expect(screen.queryByRole('complementary')).toBeNull();
      expect(document.documentElement).not.toHaveAttribute('data-ribbon-sidebar');
      fireEvent.click(screen.getByRole('button', { name: 'Mở menu tác vụ' }));
      const sidebar = screen.getByRole('complementary', { name: 'Menu chức năng' });
      fireEvent.pointerLeave(sidebar);
      expect(sidebar).toBeVisible();
      fireEvent.click(document.querySelector('.ribbon-menu-backdrop'));
      expect(screen.queryByRole('complementary')).toBeNull();
    } finally { window.matchMedia = previous; }
  });

  it('omits notifications while retaining staff identity, profile switching and logout', () => {
    const value = { ...session(['scheduling.view']), user: { role: 'admin', name: 'Nguyễn Trang' },
      activeProfile: { id: 'p1', code: 'admin', name: 'Quản trị hệ thống' }, profiles: [{ id: 'p1' }, { id: 'p2' }], chooseProfile: vi.fn() };
    render(view(value, '/viewLogged'));
    expect(screen.queryByRole('button', { name: 'Thông báo' })).not.toBeInTheDocument();
    const identity = document.querySelector('.od-header-identity');
    expect(identity).toHaveAttribute('aria-hidden', 'true');
    expect(identity).toHaveStyle({ visibility: 'hidden' });
    const footer = within(document.querySelector('.ribbon-sidebar-footer'));
    expect(footer.getByText('Nguyễn Trang')).toBeVisible();
    expect(footer.getByText('Quản trị hệ thống')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Đổi phiên làm việc' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thu gọn menu tác vụ' }));
    expect(document.querySelector('.od-header-identity')).toBe(identity);
    expect(identity).toBeVisible();
    expect(identity).toHaveAttribute('aria-hidden', 'false');
  });
  it("collapses subgroup labels independently and reveals matching actions during search", () => {
    render(view(session(["masters.view", "scheduling.view"]), "/masters/schedule"));
    const heading = screen.getByRole("button", { name: "THỦ TỤC ĐẦU VÀO" });
    expect(heading).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(heading);
    expect(heading).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Học bổ sung kiến thức" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xếp lịch" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "hoc bo sung" } });
    expect(screen.getByRole("button", { name: "Học bổ sung kiến thức" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(heading).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(heading);
    expect(screen.getByRole("button", { name: "Học bổ sung kiến thức" })).toBeInTheDocument();
  });

  it("filters across groups without accents while respecting permissions", () => {
    render(view(session(["scheduling.view", "exams.view"]), "/masters/schedule"));
    const search = screen.getByRole("searchbox", { name: "Tìm kiếm chức năng" });
    fireEvent.change(search, { target: { value: "xep lich thi" } });
    expect(screen.getByRole("button", { name: "Xếp lịch thi" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Danh sách thi, điểm thi" })).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "tai khoan nhan su" } });
    expect(screen.getByRole("status")).toHaveTextContent("Không tìm thấy chức năng phù hợp");
    expect(screen.queryByRole("button", { name: "Tài khoản nhân sự" })).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Xếp lịch" })).toHaveAttribute("aria-current", "page");
  });

  it("collapses groups, keeps the current breadcrumb and preserves the institute logo", () => {
    const { container } = render(view(session(["catalog.view"]), "/system/majors"));
    const group = screen.getByRole("button", { name: "HỆ THỐNG" });
    const breadcrumb = container.querySelector(".ribbon-breadcrumb");
    expect(breadcrumb).toHaveTextContent("Chuyên ngành");
    expect(screen.getByRole("img", { name: /Biểu trưng/ })).toHaveAttribute("src", "https://sdh.vimaru.edu.vn/sites/sdh.vimaru.edu.vn/files/vmu-new-logo_0.png");
    fireEvent.click(group);
    expect(group).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Chuyên ngành" })).not.toBeInTheDocument();
    expect(breadcrumb).toHaveTextContent("Chuyên ngành");
    fireEvent.click(group);
    expect(screen.getByRole("button", { name: "Chuyên ngành" })).toHaveAttribute("aria-current", "page");
  });

  it("opens and focuses function search with slash, then restores focus on Escape", () => {
    baseRender(view(session([])));
    fireEvent.keyDown(document, { key: "/" });
    expect(screen.getByRole("searchbox", { name: "Tìm kiếm chức năng" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Mở menu tác vụ" })).toHaveFocus();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("uses identical navigation tiles for admin and supervisor with the same view permissions", () => {
    const permissions = Object.keys(routesByPermission);
    const { container, rerender } = render(view(session(permissions, "admin"), "/masters/assign-class-groups"));
    const tileMarkup = () => [...container.querySelectorAll('.ribbon-action')].map(button => button.outerHTML);
    const admin = tileMarkup();
    rerender(view(session(permissions, "supervisor"), "/masters/assign-class-groups"));
    expect(tileMarkup()).toEqual(admin);
    expect(screen.getByRole('button', { name: 'Phân nhóm học viên' })).toHaveAttribute('aria-current', 'page');
  });
  it('keeps category icons while showing plain text actions below the search and category heading',()=>{
    render(view(session(['scheduling.view','gradebook.view','exams.view']),'/masters/exam-lists'));
    const panel = document.querySelector('.ribbon-navigation-panel');
    expect(panel.children[0]).toHaveClass('ribbon-search-wrap');
    expect(panel.children[1]).toHaveClass('ribbon-panel-heading');
    for (const action of panel.querySelectorAll('.ribbon-action')) expect(action.querySelector('svg')).toBeNull();
    for (const category of document.querySelectorAll('.ribbon-tab-toggle')) expect(category.querySelector('svg')).not.toBeNull();
    const exam=screen.getByRole('button',{name:'Xếp lịch thi'});
    exam.focus();expect(exam).toHaveFocus();
  });
  it("keeps the Masters grade actions in order and highlights the current page", () => {
    render(view(session(["masters.view", "gradebook.view", "exams.view", "reports.view"]), "/masters/exam-schedule"));
    const calendar = screen.getByRole("button", { name: "Xếp lịch thi" });
    const group = calendar.closest(".ribbon-group");
    expect(within(group.querySelector(".ribbon-actions")).getAllByRole("button").map(button => button.textContent)).toEqual([
      "Danh sách thi, điểm thi", "Xếp lịch thi", "Tổng hợp điểm của lớp",
    ]);
    expect(screen.queryByRole("button", { name: "Xét tư cách thi hết môn" })).not.toBeInTheDocument();
    expect(calendar).toHaveAttribute("aria-current", "page");
    expect(group.querySelectorAll(".ribbon-action")).toHaveLength(3);
  });
  it("classifies all 66 actions against the independent contract", () => {
    expect(items).toHaveLength(66);expect(expected.size).toBe(66);
    for (const item of items) {
      expect(expected.has(item.route)).toBe(true);
      expect(item.permissions || []).toEqual(expected.get(item.route));
      expect(item.roles).toBeUndefined();
    }
  });
  const cases = [
    ["no permissions", []], ["catalog read", ["catalog.view"]], ["catalog manage only", ["catalog.manage"]],
    ...Object.keys(routesByPermission).filter(p => p !== "catalog.view").map(p => [p, [p]]),
    ["all three administrative reads", ["account.view", "role.view", "audit.view"]],
    ["planning and scheduling", ["plan.view", "scheduling.view"]],
    ["action permissions only", ["admission.manage", "plan.manage", "masters.manage", "scheduling.write", "scheduling.organize", "gradebook.submit", "gradebook.approve", "gradebook.policy", "reports.export", "account.manage", "role.manage"]],
  ];
  it.each(cases)("renders exactly the permitted actions across all tabs: %s", (_name, permissions) => {
    const { container } = render(view(session(permissions)));
    const nav = screen.getByRole("navigation", { name: "Nhóm chức năng" });
    const seen = new Set();
    for (const tab of [...nav.querySelectorAll(".ribbon-tab-toggle")]) {
      if (tab.getAttribute("aria-expanded") !== "true") fireEvent.click(tab);
      const labels = visibleLabels(container);
      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) seen.add(label);
      for (const section of container.querySelectorAll(".ribbon-group")) expect(section.querySelectorAll(".ribbon-action").length).toBeGreaterThan(0);
    }
    const allowed = items.filter(item => expected.get(item.route).every(p => permissions.includes(p))).map(item => item.label);
    expect([...seen].sort()).toEqual(allowed.sort());
  });
  it("hides gated actions while access loads, then shows only loaded permissions", () => {
    const { container, rerender } = render(view(session(null, "admin"), "/plan/admission-records"));
    const utilities = items.filter(item => expected.get(item.route).length === 0).map(item => item.label).sort();
    expect(visibleLabels(container).sort()).toEqual(utilities);
    expect(screen.getByRole("navigation", { name: "Nhóm chức năng" }).querySelectorAll(".ribbon-tab-toggle")).toHaveLength(1);
    rerender(view(session(["admission.view"], "admin"), "/plan/admission-records"));
    expect(screen.getByRole("button", { name: "Nhập hồ sơ tuyển sinh" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button", { name: "Kế hoạch đào tạo" })).not.toBeInTheDocument();
    rerender(view(session([], "admin")));
    expect(visibleLabels(container).sort()).toEqual(utilities);
    expect(screen.queryByText("Nhập hồ sơ tuyển sinh")).not.toBeInTheDocument();
  });
  it("requires both essential progress-view permissions, but only masters.view for group list", () => {
    const { rerender } = render(view(session(["masters.view"]), "/masters/class-course-history"));
    expect(screen.getByRole("button", { name: "Tạo nhóm học viên" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thống kê tiến độ" })).not.toBeInTheDocument();
    rerender(view(session(["plan.view"]), "/masters/class-course-history"));
    expect(screen.queryByRole("button", { name: "Thống kê tiến độ" })).not.toBeInTheDocument();
    rerender(view(session(["plan.view", "scheduling.view"]), "/masters/class-course-history"));
    expect(screen.getByRole("button", { name: "Thống kê tiến độ" })).toHaveAttribute("aria-current", "page");
  });
  it("falls back safely when the selected tab loses all commands", () => {
    const { container, rerender } = render(view(session(["doctoral.view"]), "/doctoral/admission-scores"));
    expect(screen.getByRole("button", { name: "ĐÀO TẠO TIẾN SĨ" })).toHaveClass("active");
    rerender(view(session([])));
    expect(screen.queryByRole("button", { name: "ĐÀO TẠO TIẾN SĨ" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "HỆ THỐNG" })).toHaveClass("active");
    expect(visibleLabels(container)).toHaveLength(6);
  });
  it("supports a verified fallback identity without inferring admin permissions", async () => {
    const original = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ message: "admin" }) });
    try {
      const { container } = render(<MemoryRouter useTransitions={false}><RibbonHeader /></MemoryRouter>);
      fireEvent.click(await screen.findByRole("button", { name: "Mở menu tác vụ" }));
      expect(screen.getByRole("button", { name: "Đổi mật khẩu" })).toBeInTheDocument();
      expect(visibleLabels(container)).toHaveLength(6);
      expect(screen.queryByText("Tài khoản nhân sự")).not.toBeInTheDocument();
    } finally { global.fetch = original; }
  });
});

describe("Breadcrumb quick navigation", () => {
  const open = name => {
    const trigger = within(screen.getByRole("navigation", { name: "Vị trí hiện tại" })).getByRole("button", { name });
    trigger.getBoundingClientRect = () => ({ top: 0, bottom: 30, left: 60, right: 260, width: 200, height: 30 });
    trigger.focus();
    fireEvent.click(trigger);
    return trigger;
  };

  it("shows the three sibling account routes and navigates to the selected one", async () => {
    baseRender(view(session(["account.view", "role.view", "audit.view"]), "/system/accounts"));
    open("Tài khoản & phân quyền");
    const menu = screen.getByRole("menu", { name: "Truy cập nhanh: Tài khoản & phân quyền" });
    expect(within(menu).getAllByRole("menuitem").map(item => item.textContent)).toEqual([
      "Tài khoản nhân sự", "Vai trò & phân quyền", "Nhật ký thao tác",
    ]);
    expect(within(menu).getByRole("menuitem", { name: "Tài khoản nhân sự" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Vai trò & phân quyền" }));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(within(screen.getByRole("navigation", { name: "Vị trí hiện tại" })).getByText("Vai trò & phân quyền")).toHaveAttribute("aria-current", "page");
  });

  it("lists the root's child routes in groups while respecting effective permissions", () => {
    baseRender(view(session(["account.view"]), "/system/accounts"));
    open("Hệ thống");
    const menu = screen.getByRole("menu", { name: "Truy cập nhanh: Hệ thống" });
    expect(within(menu).getByRole("menuitem", { name: "Tài khoản nhân sự" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Cài đặt giao diện" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Vai trò & phân quyền" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Nhật ký thao tác" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Thoát chương trình" })).not.toBeInTheDocument();
  });

  it("supports keyboard dismissal and restores focus to the breadcrumb", async () => {
    baseRender(view(session(["account.view"]), "/system/accounts"));
    const trigger = open("Tài khoản & phân quyền");
    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(1);
    fireEvent.keyDown(menu, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("removes the group menu immediately on outside click without flashing all root routes", () => {
    baseRender(view(session(["masters.view", "scheduling.view", "gradebook.view", "exams.view", "reports.view"]), "/masters/exam-lists"));
    const trigger = open("Quản lý điểm");
    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map(item => item.textContent)).toEqual([
      "Danh sách thi, điểm thi", "Xếp lịch thi", "Tổng hợp điểm của lớp",
    ]);
    fireEvent.click(document.querySelector("#ribbon-breadcrumb-menu .MuiBackdrop-root"));
    expect(screen.queryByRole("menu", { hidden: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { hidden: true })).not.toBeInTheDocument();
    expect(document.querySelector("#ribbon-breadcrumb-menu")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toHaveAccessibleName("Truy cập nhanh: Quản lý điểm");
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  });
});
