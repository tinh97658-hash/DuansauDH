// Decorative icons are not under test; keep real Ribbon buttons and routing.
jest.mock("@mui/icons-material", () => new Proxy({}, { get: () => () => null }));

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RibbonHeader, { ribbons } from "../../components/RibbonHeader";

describe("Masters scheduling ribbon", () => {
  it("moves both scheduling actions into the learning-process group without changing routes", () => {
    const entryGroup = ribbons.masters.find((section) => section.label === "THỦ TỤC ĐẦU VÀO");
    const learningGroup = ribbons.masters.find((section) => section.label === "QUÁ TRÌNH HỌC TẬP");

    expect(entryGroup.actions.map((item) => item.label)).not.toEqual(expect.arrayContaining(["Tạo lớp học phần", "Xếp lịch"]));
    expect(learningGroup.actions.slice(0, 2).map(({ label, route }) => ({ label, route }))).toEqual([
      { label: "Tạo lớp học phần", route: "/masters/course-offerings" },
      { label: "Xếp lịch", route: "/masters/schedule" },
    ]);
  });

  it("does not expose Masters scheduling routes in the Doctoral ribbon", () => {
    const routes = ribbons.doctoral.flatMap((section) => section.actions.map((item) => item.route));

    expect(routes).not.toContain("/masters/course-offerings");
    expect(routes).not.toContain("/masters/schedule");
  });

  it.each([
    ["/masters/course-offerings", "Tạo lớp học phần", "Xếp lịch"],
    ["/masters/schedule?offeringId=persisted-id", "Xếp lịch", "Tạo lớp học phần"],
  ])("highlights only the current scheduling route %s and follows navigation", async (path, activeLabel, otherLabel) => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ message: "admin" }) });
    try {
      await act(async () => { render(<MemoryRouter initialEntries={[path]}><RibbonHeader /></MemoryRouter>); });
      const active = screen.getByRole("button", { name: activeLabel });
      const other = screen.getByRole("button", { name: otherLabel });
      expect(active).toHaveAttribute("aria-current", "page");
      expect(active).toHaveStyle("background: #e8f3fa; border-color: #78acd0; color: #075a9c; font-weight: 600");
      expect(other).not.toHaveAttribute("aria-current");
      expect(other).not.toHaveAttribute("style");
      await act(async () => { fireEvent.click(other); });
      expect(other).toHaveAttribute("aria-current", "page");
      expect(active).not.toHaveAttribute("aria-current");
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Tạo nhóm học phần" })); });
      expect(active).not.toHaveAttribute("aria-current");
      expect(other).not.toHaveAttribute("aria-current");
      expect(screen.getByRole("button", { name: "Tạo nhóm học phần" })).not.toHaveAttribute("style");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
