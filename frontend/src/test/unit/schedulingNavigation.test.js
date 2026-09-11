// Decorative icons are not under test; keep real Ribbon buttons and routing.
jest.mock("@mui/icons-material", () => new Proxy({}, { get: () => () => null }));

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RibbonHeader, { isRibbonRouteActive, ribbons } from "../../components/RibbonHeader";

describe("Masters scheduling ribbon", () => {
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
      await act(async () => { render(<MemoryRouter initialEntries={[path]}><RibbonHeader /></MemoryRouter>); });
      const active = screen.getByRole("button", { name: activeLabel });
      const other = screen.getByRole("button", { name: otherLabel });
      expect(active).toHaveAttribute("aria-current", "page");
      expect(active).toHaveClass("active");
      expect(other).not.toHaveAttribute("aria-current");
      expect(other).not.toHaveClass("active");
      await act(async () => { fireEvent.click(other); });
      expect(other).toHaveAttribute("aria-current", "page");
      expect(other).toHaveClass("active");
      expect(active).not.toHaveAttribute("aria-current");
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Tạo nhóm học phần" })); });
      expect(active).not.toHaveAttribute("aria-current");
      expect(other).not.toHaveAttribute("aria-current");
      expect(screen.getByRole("button", { name: "Tạo nhóm học phần" })).toHaveClass("active");
      expect(screen.getByRole("button", { name: "Tạo nhóm học phần" })).toHaveAttribute("aria-current", "page");
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
