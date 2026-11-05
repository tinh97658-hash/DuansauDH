import { fireEvent, render as baseRender, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthSessionContext } from "../../context/AuthSession";
import RibbonHeader, { isRibbonRouteActive, ribbons } from "../../components/RibbonHeader";



const authorizedSession = { user: { role: "custom" }, access: { permissions: [...new Set(Object.values(ribbons).flatMap(sections => sections.flatMap(section => section.actions.flatMap(item => item.permissions || []))))] } };
const AuthorizedRibbon = () => <AuthSessionContext.Provider value={authorizedSession}><RibbonHeader /></AuthSessionContext.Provider>;

const render = (...args) => {
  const result = baseRender(...args);
  const toggle = screen.queryByRole("button", { name: "Mở menu tác vụ" });
  if (toggle) fireEvent.click(toggle);
  return result;
};
describe("Masters scheduling ribbon", () => {
  it("nests actions directly below their expanded section and supports action focus", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ message: "admin" }) });
    try {
      render(<MemoryRouter useTransitions={false} initialEntries={["/masters/class-course-history"]}><AuthorizedRibbon /></MemoryRouter>);
      const sectionNavigation = await screen.findByRole("navigation", { name: "Nhóm chức năng" });
      const actionRail = screen.getByRole("region", { name: "Tác vụ chức năng" });
      const action = within(actionRail).getByRole("button", { name: "Thống kê tiến độ" });

      expect(sectionNavigation).toContainElement(actionRail);
      expect(actionRail).toContainElement(action);
      action.focus();
      expect(action).toHaveFocus();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("starts collapsed and opens an overlay that closes with the tab, Escape or backdrop", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ message: "admin" }) });
    try {
      const { container } = baseRender(<MemoryRouter useTransitions={false} initialEntries={["/system/majors"]}><AuthorizedRibbon /></MemoryRouter>);
      const toggle = screen.getByRole("button", { name: "Mở menu tác vụ" });
      const sidebar = container.querySelector("#ribbon-sidebar");
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(sidebar).not.toBeVisible();
      expect(screen.queryByRole("button", { name: "Chuyên ngành" })).not.toBeInTheDocument();
      fireEvent.click(toggle);
      expect(sidebar).toBeVisible();
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("button", { name: "HỆ THỐNG" })).toHaveFocus();
      fireEvent.click(toggle);
      expect(sidebar).not.toBeVisible();
      fireEvent.click(toggle);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(sidebar).not.toBeVisible();
      expect(toggle).toHaveFocus();
      fireEvent.click(toggle);
      fireEvent.click(container.querySelector(".ribbon-menu-backdrop"));
      expect(sidebar).not.toBeVisible();
      fireEvent.click(toggle);
      fireEvent.click(screen.getByRole("button", { name: "Chuyên ngành" }));
      expect(sidebar).not.toBeVisible();
      expect(toggle).toHaveFocus();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("separates scheduling and grade management without changing routes", () => {
    const entryGroup = ribbons.masters.find((section) => section.label === "THỦ TỤC ĐẦU VÀO");
    const learningGroup = ribbons.masters.find((section) => section.label === "XẾP LỊCH HỌC");
    const gradeGroup = ribbons.masters.find((section) => section.label === "QUẢN LÝ ĐIỂM");
    expect(learningGroup.actions).toHaveLength(3);
    expect(gradeGroup.actions.map(({ label, route }) => ({ label, route }))).toEqual([
      { label: "Danh sách thi, điểm thi", route: "/masters/exam-lists" },
      { label: "Xếp lịch thi", route: "/masters/exam-schedule" },
      { label: "Tổng hợp điểm của lớp", route: "/reports/class-score-summary" },
    ]);
    expect(ribbons.reports.flatMap(section => section.actions).map(item => item.route)).not.toContain("/reports/class-score-summary");

    expect(entryGroup.actions.map((item) => item.label)).not.toEqual(expect.arrayContaining(["Tạo lớp học phần", "Xếp lịch"]));
    expect(learningGroup.actions.slice(0, 2).map(({ label, route }) => ({ label, route }))).toEqual([
      { label: "Tạo lớp học phần", route: "/masters/course-offerings" },
      { label: "Xếp lịch", route: "/masters/schedule" },
    ]);
    expect(learningGroup.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Ma trận lớp học phần", route: "/masters/course-matrix" }),
      ])
    );
    expect(entryGroup.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Hồ sơ trúng tuyển", route: "/masters/admitted-records" }),
        expect.objectContaining({ label: "Thống kê tiến độ", route: "/masters/class-course-history" }),
      ])
    );
  });

  it("does not expose Masters scheduling routes in the Doctoral ribbon", () => {
    const routes = ribbons.doctoral.flatMap((section) => section.actions.map((item) => item.route));

    expect(routes).not.toContain("/masters/course-offerings");
    expect(routes).not.toContain("/masters/schedule");
    expect(routes).not.toContain("/masters/course-matrix");
  });

  it.each([
    ["/masters/course-offerings", "Tạo lớp học phần", "Xếp lịch", "Xếp lịch học"],
    ["/masters/schedule?offeringId=persisted-id", "Xếp lịch", "Tạo lớp học phần", "Xếp lịch học"],
    ["/masters/course-matrix", "Ma trận lớp học phần", "Xếp lịch", "Xếp lịch học"],
    ["/reports/class-score-summary", "Tổng hợp điểm của lớp", "Danh sách thi, điểm thi", "Quản lý điểm"],
  ])("highlights only the current scheduling route %s and follows navigation", async (path, activeLabel, otherLabel, groupLabel) => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ message: "admin" }) });
    try {
      render(<MemoryRouter useTransitions={false} initialEntries={[path]}><AuthorizedRibbon /></MemoryRouter>);
      const active = await screen.findByRole("button", { name: activeLabel });
      const other = screen.getByRole("button", { name: otherLabel });
      const breadcrumb = screen.getByLabelText("Vị trí hiện tại");
      expect([...breadcrumb.querySelectorAll("span, strong")].map(item => item.textContent)).toEqual(["Đào tạo thạc sĩ", groupLabel, activeLabel]);
      expect(document.querySelector(".ribbon-titlebar img")).toBeNull();
      expect(active).toHaveAttribute("aria-current", "page");
      expect(active).toHaveClass("active");
      expect(other).not.toHaveAttribute("aria-current");
      expect(other).not.toHaveClass("active");
      fireEvent.click(other);
      expect(breadcrumb.querySelector("strong")).toHaveTextContent(otherLabel);
      expect(screen.getByRole("button", { name: "Mở menu tác vụ" })).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(screen.getByRole("button", { name: "Mở menu tác vụ" }));
      expect(other).toHaveAttribute("aria-current", "page");
      expect(other).toHaveClass("active");
      expect(active).not.toHaveAttribute("aria-current");
      fireEvent.click(screen.getByRole("button", { name: "Tạo nhóm học viên" }));
      expect([...breadcrumb.querySelectorAll("span, strong")].map(item => item.textContent)).toEqual(["Đào tạo thạc sĩ", "Thủ tục đầu vào", "Tạo nhóm học viên"]);
      fireEvent.click(screen.getByRole("button", { name: "Mở menu tác vụ" }));
      expect(active).not.toHaveAttribute("aria-current");
      expect(other).not.toHaveAttribute("aria-current");
      expect(screen.getByRole("button", { name: "Tạo nhóm học viên" })).toHaveClass("active");
      expect(screen.getByRole("button", { name: "Tạo nhóm học viên" })).toHaveAttribute("aria-current", "page");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("matches exact, trailing-slash and nested function routes without matching similar prefixes", () => {
    expect(isRibbonRouteActive("/system/users", "/system/users")).toBe(true);
    expect(isRibbonRouteActive("/system/users/", "/system/users")).toBe(true);
    expect(isRibbonRouteActive("/system/users/edit/123", "/system/users")).toBe(true);
    expect(isRibbonRouteActive("/system/users-archive", "/system/users")).toBe(false);
    expect(isRibbonRouteActive("/system/users", null)).toBe(false);
  });
});
