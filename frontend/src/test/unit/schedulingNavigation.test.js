import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RibbonHeader, { isRibbonRouteActive, ribbons } from "../../components/RibbonHeader";

// Decorative icons are not under test; keep real Ribbon buttons and routing.
jest.mock("@mui/icons-material", () => new Proxy({}, { get: () => () => null }));

describe("Masters scheduling ribbon", () => {
  it("keeps section navigation outside the collapsible action rail and supports action focus", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ message: "admin" }) });
    try {
      render(<MemoryRouter initialEntries={["/masters/class-course-history"]}><RibbonHeader /></MemoryRouter>);
      const sectionNavigation = await screen.findByRole("navigation", { name: "Nhóm chức năng" });
      const actionRail = screen.getByRole("region", { name: "Tác vụ chức năng" });
      const action = within(actionRail).getByRole("button", { name: "Thống kê tiến độ" });

      expect(sectionNavigation).not.toContainElement(actionRail);
      expect(actionRail).toContainElement(action);
      action.focus();
      expect(action).toHaveFocus();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("moves both scheduling actions into the learning-process group without changing routes", () => {
    const entryGroup = ribbons.masters.find((section) => section.label === "THỦ TỤC ĐẦU VÀO");
    const learningGroup = ribbons.masters.find((section) => section.label === "QUÁ TRÌNH HỌC TẬP");

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
    ["/masters/course-offerings", "Tạo lớp học phần", "Xếp lịch"],
    ["/masters/schedule?offeringId=persisted-id", "Xếp lịch", "Tạo lớp học phần"],
    ["/masters/course-matrix", "Ma trận lớp học phần", "Xếp lịch"],
  ])("highlights only the current scheduling route %s and follows navigation", async (path, activeLabel, otherLabel) => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ message: "admin" }) });
    try {
      render(<MemoryRouter initialEntries={[path]}><RibbonHeader /></MemoryRouter>);
      const active = await screen.findByRole("button", { name: activeLabel });
      const other = screen.getByRole("button", { name: otherLabel });
      expect(active).toHaveAttribute("aria-current", "page");
      expect(active).toHaveClass("active");
      expect(other).not.toHaveAttribute("aria-current");
      expect(other).not.toHaveClass("active");
      fireEvent.click(other);
      expect(other).toHaveAttribute("aria-current", "page");
      expect(other).toHaveClass("active");
      expect(active).not.toHaveAttribute("aria-current");
      fireEvent.click(screen.getByRole("button", { name: "Tạo nhóm học viên" }));
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
