import React from "react";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithPermissions } from "../renderWithPermissions";
const render = (ui) => renderWithPermissions(ui, ["scheduling.view", "scheduling.write"]);
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import axios from "axios";
import Schedule from "../../features/scheduling/Schedule";

vi.mock("axios", () => ({ default: { get: vi.fn(), put: vi.fn(), defaults: {} } }));
vi.mock("../../features/scheduling/SchedulePrintTemplate", () => ({ default: () => null }));
vi.mock("../../features/scheduling/scheduleExport", () => ({
  readScheduleReturnView: () => null, clearScheduleReturnView: vi.fn(),
  buildScheduleDocument: vi.fn(), createScheduleExcel: vi.fn(), createScheduleWord: vi.fn(),
  downloadScheduleFile: vi.fn(), exportSchedule: vi.fn(),
}));
const makeOffering = (id, year, totalCount, pendingCount = 0) => ({
  id, name: id, status: "active", participantCount: 1,
  subject: { id: `subject-${id}`, name: "Cơ sở dữ liệu", code: "CSDL" },
  groupLinks: [{ classGroup: { id: `g-${id}`, name: id, code: id, majorId: "m1", academicYear: year } }],
  sessionSummary: { totalCount, heldCount: 0, plannedCount: totalCount, pendingCount, futurePlannedCount: 0 },
});
const current = makeOffering("LỚP CHƯA CÓ LỊCH", "2026", 0);
const scheduled = makeOffering("LỚP ĐÃ CÓ LỊCH", "2026", 1);
const old = makeOffering("LỚP KHÓA CŨ", "2025", 0);
const pending = makeOffering("LỚP CHỜ XÁC NHẬN", "2026", 1, 1);
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  axios.get.mockImplementation(async (url) => ({ data: url.includes("/system/majors") ? [{ id: "m1", name: "Công nghệ thông tin", disciplineId: "d1", discipline: { id: "d1", name: "Khoa học máy tính" } }]
    : url.includes("/pending-teaching-sessions") ? [
      { id: "p1", courseOfferingId: pending.id, courseOffering: pending, sessionDate: "2026-01-10", period: "MORNING" },
      { id: "p2", courseOfferingId: old.id, courseOffering: old, sessionDate: "2025-01-10", period: "MORNING" },
    ] : url.includes("/course-offerings") ? [current, scheduled, old, pending] : [] }));
});

it("lands on only unscheduled offerings from the dashboard year and allows clearing the queue filter", async () => {
  render(<MemoryRouter useTransitions={false} initialEntries={["/masters/schedule?year=2026&queue=unscheduled"]}><Schedule user={{ role: "admin", canManageScheduling: true }} /></MemoryRouter>);
  await screen.findByRole("button", { name: /^LỚP CHƯA CÓ LỊCH/ });
  expect(screen.queryByRole("button", { name: /^LỚP KHÓA CŨ/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^LỚP ĐÃ CÓ LỊCH/ })).not.toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Khóa / Năm" })).toHaveValue("2026");
  fireEvent.click(screen.getByRole("button", { name: "Bỏ lọc công việc" }));
  await screen.findByRole("button", { name: /^LỚP ĐÃ CÓ LỊCH/ });
});

it("opens the pending confirmation workflow scoped to the selected year and offering", async () => {
  render(<MemoryRouter useTransitions={false} initialEntries={[`/masters/schedule?year=2026&queue=pending-confirmation&offeringId=${encodeURIComponent(pending.id)}`]}><Schedule user={{ role: "admin", canManageScheduling: true }} /></MemoryRouter>);
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => expect(within(dialog).getByText("LỚP CHỜ XÁC NHẬN")).toBeInTheDocument());
  expect(within(dialog).queryByText("LỚP KHÓA CŨ")).not.toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: /Đã diễn ra/ })).toBeInTheDocument();
});
