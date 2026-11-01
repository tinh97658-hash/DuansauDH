import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import GradebookHistoryDialog from "../../features/exams/GradebookHistoryDialog";

const grade = { participantId: "student:1", code: "HV001", fullName: "Nguyễn An", testScore: 0,
  assignmentScore: null, examScore: 8, courseScore: 5, result: "failed" };
const event = { id: "event-1", createdAt: "2026-10-29T04:09:33.945Z", actor: { name: "Administrator" }, note: "Căn cứ duyệt điểm" };

it.each([
  ["save", [grade]],
  ["save", { grades: [grade] }],
  ["approve", { snapshot: { rows: [grade] } }],
  ["eligibility.approve", { eligibility_submission: { rows: [grade] } }],
  ["final.approve", { result_snapshot: { rows: [grade] } }],
])("displays recorded grades from %s without turning missing marks into zero", (action, after) => {
  render(<GradebookHistoryDialog events={[{ ...event, action, after }]} onClose={() => {}} />);
  const history = screen.getByRole("table", { name: "Lịch sử bảng điểm" });
  expect(within(history).getByText("29/10/26 11:09:33")).toBeInTheDocument();
  expect(within(history).getByText("Administrator")).toBeInTheDocument();
  expect(within(history).getByText(event.note)).toBeInTheDocument();
  const toggle = screen.getByRole("button", { name: "Xem kết quả (1)" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(toggle);
  const results = screen.getByRole("table", { name: "Kết quả lịch sử lần 1" });
  const cells = within(within(results).getAllByRole("row")[1]).getAllByRole("cell");
  expect(cells.map(cell => cell.textContent)).toEqual(["HV001", "Nguyễn An", "0.0", "—", "8.0", "5.0", "Không đạt"]);
  fireEvent.click(screen.getByRole("button", { name: "Thu gọn" }));
  expect(screen.queryByRole("table", { name: "Kết quả lịch sử lần 1" })).not.toBeInTheDocument();
});

it("does not substitute an eligibility snapshot for a reopened final result", () => {
  render(<GradebookHistoryDialog events={[{ ...event, action: "final.reopen", after: {
    result_snapshot: null, eligibility_submission: { rows: [grade] },
  } }]} onClose={() => {}} />);
  expect(screen.getByText("Mở lại kết quả")).toBeInTheDocument();
  expect(screen.getByText("Không có bản ghi điểm")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Xem kết quả/ })).not.toBeInTheDocument();
});

it("shows an empty history and closes the dialog", () => {
  const close = vi.fn();
  render(<GradebookHistoryDialog events={[]} onClose={close} />);
  expect(screen.getByText("Chưa có lịch sử bảng điểm.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
  expect(close).toHaveBeenCalledTimes(1);
});
