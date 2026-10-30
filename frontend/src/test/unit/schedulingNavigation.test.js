import { vi } from "vitest";

// Navigation tests exercise labels/routes/focus; avoid loading the entire icon catalog.
vi.mock(import("@mui/icons-material"), () => ({
  AccountBalanceOutlined: () => null,
  AddTaskOutlined: () => null,
  CategoryOutlined: () => null,
  CheckCircleOutline: () => null,
  EventOutlined: () => null,
  EventNoteOutlined: () => null,
  FactCheckOutlined: () => null,
  FlagOutlined: () => null,
  FolderOpenOutlined: () => null,
  GavelOutlined: () => null,
  GradingOutlined: () => null,
  GroupAddOutlined: () => null,
  GroupsOutlined: () => null,
  GroupWorkOutlined: () => null,
  InfoOutlined: () => null,
  LanguageOutlined: () => null,
  ListAltOutlined: () => null,
  LocationCityOutlined: () => null,
  LockOutlined: () => null,
  LogoutOutlined: () => null,
  KeyboardArrowDownRounded: () => null,
  KeyboardArrowUpRounded: () => null,
  ManageAccountsOutlined: () => null,
  MenuBookOutlined: () => null,
  NoteAddOutlined: () => null,
  PaymentsOutlined: () => null,
  RuleOutlined: () => null,
  SchoolOutlined: () => null,
  ScoreboardOutlined: () => null,
  SendOutlined: () => null,
  SummarizeOutlined: () => null,
  SupervisorAccountOutlined: () => null,
  MeetingRoomOutlined: () => null,
  BusinessOutlined: () => null,
  SystemUpdateOutlined: () => null,
  TableChartOutlined: () => null,
  TrackChangesOutlined: () => null,
  UploadFileOutlined: () => null,
  VerifiedOutlined: () => null,
  WorkspacePremiumOutlined: () => null,
  HistoryEduOutlined: () => null,
}));

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthSessionContext } from "../../context/AuthSession";
import RibbonHeader, { isRibbonRouteActive, ribbons } from "../../components/RibbonHeader";



const authorizedSession = { user: { role: "custom" }, access: { permissions: [...new Set(Object.values(ribbons).flatMap(sections => sections.flatMap(section => section.actions.flatMap(item => item.permissions || []))))] } };
const AuthorizedRibbon = () => <AuthSessionContext.Provider value={authorizedSession}><RibbonHeader /></AuthSessionContext.Provider>;

describe("Masters scheduling ribbon", () => {
  it("keeps section navigation outside the collapsible action rail and supports action focus", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ message: "admin" }) });
    try {
      render(<MemoryRouter initialEntries={["/masters/class-course-history"]}><AuthorizedRibbon /></MemoryRouter>);
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

  it("keeps the action menu open until its toggle is clicked", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ message: "admin" }) });
    try {
      const { container } = render(<MemoryRouter initialEntries={["/system/majors"]}><AuthorizedRibbon /></MemoryRouter>);
      const collapse = await screen.findByRole("button", { name: "Thu gọn menu tác vụ" });
      const header = container.querySelector(".ribbon-header");

      expect(header).not.toHaveClass("ribbon-commands-collapsed");
      expect(collapse).toHaveAttribute("aria-expanded", "true");
      fireEvent.click(collapse);
      expect(header).toHaveClass("ribbon-commands-collapsed");
      expect(screen.getByRole("button", { name: "Mở menu tác vụ" })).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(screen.getByRole("button", { name: "Mở menu tác vụ" }));
      expect(header).not.toHaveClass("ribbon-commands-collapsed");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("separates scheduling and grade management without changing routes", () => {
    const entryGroup = ribbons.masters.find((section) => section.label === "THỦ TỤC ĐẦU VÀO");
    const learningGroup = ribbons.masters.find((section) => section.label === "XẾP LỊCH HỌC");
    const gradeGroup = ribbons.masters.find((section) => section.label === "QUẢN LÝ ĐIỂM");
    expect(learningGroup.actions).toHaveLength(4);
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
        expect.objectContaining({ label: "Điểm danh khuôn mặt", route: "/masters/attendance" }),
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
    ["/masters/course-offerings", "Tạo lớp học phần", "Xếp lịch"],
    ["/masters/schedule?offeringId=persisted-id", "Xếp lịch", "Tạo lớp học phần"],
    ["/masters/course-matrix", "Ma trận lớp học phần", "Xếp lịch"],
    ["/reports/class-score-summary", "Tổng hợp điểm của lớp", "Danh sách thi, điểm thi"],
  ])("highlights only the current scheduling route %s and follows navigation", async (path, activeLabel, otherLabel) => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ message: "admin" }) });
    try {
      render(<MemoryRouter initialEntries={[path]}><AuthorizedRibbon /></MemoryRouter>);
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
