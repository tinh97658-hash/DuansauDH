import { fireEvent, render as baseRender, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RibbonHeader, { ribbons } from "../../components/RibbonHeader";
import { AuthSessionContext } from "../../context/AuthSession";

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
describe("Ribbon read/navigation permission contracts", () => {
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
  it('keeps distinct high contrast tones for teaching and exam scheduling',()=>{
    render(view(session(['scheduling.view','gradebook.view','exams.view']),'/masters/exam-lists'));
    const teaching=screen.getByRole('button',{name:'Xếp lịch'}),exam=screen.getByRole('button',{name:'Xếp lịch thi'});
    expect(teaching.style.getPropertyValue('--ribbon-icon-color')).toBe('var(--icon-purple)');
    expect(exam.style.getPropertyValue('--ribbon-icon-color')).toBe('var(--icon-rose)');
    expect(screen.getByRole('button',{name:'Danh sách thi, điểm thi'}).style.getPropertyValue('--ribbon-icon-color')).toBe('var(--icon-rose)');
    expect(exam.querySelector('[data-heroicon="CalendarDaysIcon"]')).toBeInTheDocument();exam.focus();expect(exam).toHaveFocus();
  });
  it("reflows the Masters grade group with a distinct calendar icon and unchanged gradebook icon", () => {
    render(view(session(["masters.view", "gradebook.view", "exams.view", "reports.view"]), "/masters/exam-schedule"));
    const calendar = screen.getByRole("button", { name: "Xếp lịch thi" });
    const group = calendar.closest(".ribbon-group");
    expect(within(group.querySelector(".ribbon-actions")).getAllByRole("button").map(button => button.textContent)).toEqual([
      "Danh sách thi, điểm thi", "Xếp lịch thi", "Tổng hợp điểm của lớp",
    ]);
    expect(screen.queryByRole("button", { name: "Xét tư cách thi hết môn" })).not.toBeInTheDocument();
    expect(calendar.querySelector('[data-heroicon="CalendarDaysIcon"]')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Danh sách thi, điểm thi" }).querySelector('[data-heroicon="ClipboardDocumentListIcon"]')).toBeInTheDocument();
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
