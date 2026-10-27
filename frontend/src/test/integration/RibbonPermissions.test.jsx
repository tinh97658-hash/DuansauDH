import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RibbonHeader, { ribbons } from "../../components/RibbonHeader";
import { AuthSessionContext } from "../../context/AuthSession";

// Independent navigation contract. Optional page dialogs do not add page gates.
const routesByPermission = {
  "account.view": ["/system/accounts"],
  "role.view": ["/system/roles"],
  "audit.view": ["/system/audit-logs"],
  "catalog.view": ["ethnicities", "nationalities", "wards", "cities", "lecturers", "units", "rooms", "training-mode-groups", "training-modes", "disciplines", "majors", "training-levels", "study-statuses", "bridge-knowledge"].map(s => "/system/" + s),
  "plan.view": ["/plan/training-plan", "/plan/annual-fees", "/masters/study-leaves"],
  "admission.view": ["/plan/admission-targets", "/plan/admission-records", "/masters/admission-scores", "/masters/admitted-records"],
  "masters.view": ["bridge-course", "create-class-groups", "assign-class-groups", "english-exam", "english-scores", "english-certification", "final-defense", "graduation-docs"].map(s => "/masters/" + s),
  "scheduling.view": ["course-offerings", "schedule", "course-matrix"].map(s => "/masters/" + s),
  "gradebook.view": ["/masters/exam-lists", "/masters/exam-schedule"],
  "reports.view": ["/reports/class-score-summary", ...["class-lists", "course-scores", "ministerial-report", "temp-score-masters", "temp-score-doctoral", "diploma-appendix-masters", "diploma-appendix-doctoral"].map(s => "/reports/" + s)],
  "doctoral.view": ["admission-scores", "create-class-groups", "assign-class-groups", "exam-eligibility", "exam-scores", "exam-lists", "overview-topics", "university-workshops", "faculty-defense", "closed-review", "university-defense", "graduation-docs"].map(s => "/doctoral/" + s),
  "attendance.view": ["/masters/attendance"],
};
const expected = new Map(Object.entries(routesByPermission).flatMap(([permission, routes]) => routes.map(route => [route, [permission]])));
expected.set("/masters/class-course-history", ["plan.view", "scheduling.view"]);
for (const route of ["/system/unit-info", "/system/license", "/system/change-password", "/system/check-update", null]) expected.set(route, []);
const items = Object.values(ribbons).flatMap(sections => sections.flatMap(section => section.actions));
const session = (permissions, role = "custom") => ({ user: { role }, access: permissions === null ? null : { permissions, roles: [] } });
const view = (value, route = "/") => <MemoryRouter initialEntries={[route]}><AuthSessionContext.Provider value={value}><RibbonHeader /></AuthSessionContext.Provider></MemoryRouter>;
const visibleLabels = container => [...container.querySelectorAll(".ribbon-action span")].map(e => e.textContent);

describe("Ribbon read/navigation permission contracts", () => {
  it('keeps the teaching tile purple and changes only the exam scheduling tile to muted rose',()=>{
    render(view(session(['scheduling.view','gradebook.view']),'/masters/exam-lists'));
    const teaching=screen.getByRole('button',{name:'Xếp lịch'}),exam=screen.getByRole('button',{name:'Xếp lịch thi'});
    expect(teaching.style.getPropertyValue('--ribbon-icon-color')).toBe('#7b5fac');
    expect(exam.style.getPropertyValue('--ribbon-icon-color')).toBe('#b75c75');
    expect(screen.getByRole('button',{name:'Danh sách thi, điểm thi'}).style.getPropertyValue('--ribbon-icon-color')).toBe('#a04f86');
    expect(within(exam).getByTestId('CalendarMonthOutlinedIcon')).toBeInTheDocument();exam.focus();expect(exam).toHaveFocus();
  });
  it("reflows the Masters grade group with a distinct calendar icon and unchanged gradebook icon", () => {
    render(view(session(["masters.view", "gradebook.view", "reports.view"]), "/masters/exam-schedule"));
    const calendar = screen.getByRole("button", { name: "Xếp lịch thi" });
    const group = calendar.closest(".ribbon-group");
    expect(within(group).getAllByRole("button").map(button => button.textContent)).toEqual([
      "Danh sách thi, điểm thi", "Xếp lịch thi", "Tổng hợp điểm của lớp",
    ]);
    expect(screen.queryByRole("button", { name: "Xét tư cách thi hết môn" })).not.toBeInTheDocument();
    expect(within(calendar).getByTestId("CalendarMonthOutlinedIcon")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: "Danh sách thi, điểm thi" })).getByTestId("ListAltOutlinedIcon")).toBeInTheDocument();
    expect(calendar).toHaveAttribute("aria-current", "page");
    expect(group.querySelectorAll(".ribbon-action")).toHaveLength(3);
  });
  it("classifies all 64 actions against the independent contract", () => {
    expect(items).toHaveLength(64);expect(expected.size).toBe(64);
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
    for (const tab of within(nav).getAllByRole("button")) {
      fireEvent.click(tab);
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
    expect(within(screen.getByRole("navigation")).getAllByRole("button")).toHaveLength(1);
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
    expect(visibleLabels(container)).toHaveLength(5);
  });
  it("supports a verified fallback identity without inferring admin permissions", async () => {
    const original = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ message: "admin" }) });
    try {
      const { container } = render(<MemoryRouter><RibbonHeader /></MemoryRouter>);
      expect(await screen.findByRole("button", { name: "Đổi mật khẩu" })).toBeInTheDocument();
      expect(visibleLabels(container)).toHaveLength(5);
      expect(screen.queryByText("Tài khoản nhân sự")).not.toBeInTheDocument();
    } finally { global.fetch = original; }
  });
});
