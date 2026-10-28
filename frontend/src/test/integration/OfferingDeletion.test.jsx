import { renderWithPermissions } from "../renderWithPermissions";
const render = (ui, options) => renderWithPermissions(ui, ["scheduling.organize", "scheduling.write"], options);
import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import OfferingDeleteButton from "../../features/scheduling/OfferingDeleteButton";

vi.mock("axios", () => ({ default: { delete: vi.fn(), defaults: {} } }));
const offering = (summary = {}) => ({ id: "offering-1", name: "Lớp Triết học", status: "active",
  sessionSummary: { heldCount: 0, totalCount: 0, ...summary } });
beforeEach(() => { axios.delete.mockReset(); axios.delete.mockResolvedValue({ data: { deleted: true } }); });

it("lets a timetable-only role delete the schedule without class organization access", async () => {
  const onScheduleDeleted = vi.fn();
  renderWithPermissions(<OfferingDeleteButton offering={offering({ totalCount: 2 })} onScheduleDeleted={onScheduleDeleted} />, ["scheduling.view", "scheduling.write"]);
  expect(screen.queryByRole("button", { name: /Xóa lớp học phần/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Xóa lịch học Lớp/ }));
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận xóa lịch học" }));
  await waitFor(() => expect(onScheduleDeleted).toHaveBeenCalledTimes(1));
  expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining("/course-offerings/offering-1/teaching-sessions"), expect.anything());
});

it('uses separate backend capabilities for schedule deletion and class deletion', () => {
  render(<OfferingDeleteButton offering={{ ...offering({ totalCount: 2 }), canWriteSchedule: true, canOrganize: false, scopeWritable: false }} />);
  expect(screen.getByRole('button', { name: /Xóa lịch học Lớp/ })).toBeEnabled();
  expect(screen.queryByRole('button', { name: /Xóa lớp học phần/ })).not.toBeInTheDocument();
});

it("does not let an organizer delete the timetable", () => {
  renderWithPermissions(<OfferingDeleteButton offering={offering({ totalCount: 2 })} />, ["scheduling.view", "scheduling.organize"]);
  fireEvent.click(screen.getByRole("button", { name: /Xóa lớp học phần/ }));
  expect(screen.getByRole("button", { name: "Xóa lịch học" })).toBeDisabled();
  expect(axios.delete).not.toHaveBeenCalled();
});

it.each([["scheduling.view"], ["scheduling.write", "scheduling.organize"]])("hides mutations outside the offering scope for %j", permissions => {
  renderWithPermissions(<OfferingDeleteButton offering={{ ...offering({ totalCount: 2 }), scopeWritable: false }} />, permissions);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("locks deletion after a confirmed held session", () => {
  render(<OfferingDeleteButton offering={offering({ heldCount: 1, totalCount: 2 })} />);
  expect(screen.getByRole("button", { name: /Xóa lớp học phần/ })).toBeDisabled();
  expect(axios.delete).not.toHaveBeenCalled();
});

it("shows the yellow warning and deletes the timetable separately before allowing class deletion", async () => {
  const onScheduleDeleted = vi.fn(); const onDeleted = vi.fn();
  const view = render(<OfferingDeleteButton offering={offering({ totalCount: 2 })} onScheduleDeleted={onScheduleDeleted} onDeleted={onDeleted} />);
  fireEvent.click(screen.getByRole("button", { name: /Xóa lớp học phần/ }));
  expect(screen.getByRole("alert")).toHaveTextContent("Vui lòng xóa lịch học trước khi xóa lớp học phần");
  expect(screen.getByRole("alert")).toHaveClass("MuiAlert-standardWarning");
  expect(axios.delete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Xóa lịch học" }));
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận xóa lịch học" }));
  await waitFor(() => expect(onScheduleDeleted).toHaveBeenCalledTimes(1));
  expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining("/course-offerings/offering-1/teaching-sessions"), expect.anything());
  expect(onDeleted).not.toHaveBeenCalled();
  view.rerender(<OfferingDeleteButton offering={offering()} onDeleted={onDeleted} />);
  fireEvent.click(screen.getByRole("button", { name: /Xóa lớp học phần/ }));
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận xóa lớp" }));
  await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  expect(axios.delete).toHaveBeenLastCalledWith(expect.stringMatching(/\/course-offerings\/offering-1$/), expect.anything());
});

it("does not delete the class when the confirmation is cancelled", () => {
  render(<OfferingDeleteButton offering={offering()} />);
  fireEvent.click(screen.getByRole("button", { name: /Xóa lớp học phần/ }));
  fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
  expect(axios.delete).not.toHaveBeenCalled();
});

it("shows the warning when a schedule was added after the screen loaded", async () => {
  axios.delete.mockRejectedValueOnce({ response: { data: { code: "OFFERING_HAS_SCHEDULE" } } });
  render(<OfferingDeleteButton offering={offering()} />);
  fireEvent.click(screen.getByRole("button", { name: /Xóa lớp học phần/ }));
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận xóa lớp" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Vui lòng xóa lịch học trước khi xóa lớp học phần");
});
