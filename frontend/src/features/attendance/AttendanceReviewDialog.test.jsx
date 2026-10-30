import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AttendanceReviewDialog from "./AttendanceReviewDialog";
import { listSessionReviews, resolveReview } from "./attendanceApi";

vi.mock("./attendanceApi", () => ({ listSessionReviews: vi.fn(), resolveReview: vi.fn() }));
const review = { id: "review-00001", suggestedSubjectId: null, createdAt: "2026-10-28T01:00:00Z" };
const roster = [{ studentId: "student:1", fullName: "Học viên A", code: "HV01" }];
const renderDialog = (props = {}) => render(<AttendanceReviewDialog session={{ id: "session-1" }} roster={roster} open onClose={vi.fn()} {...props} />);

beforeEach(() => { vi.clearAllMocks(); listSessionReviews.mockResolvedValue([review]); resolveReview.mockResolvedValue({}); });
afterEach(cleanup);

describe("Attendance review", () => {
  it("requires a roster participant for a case without an AI suggestion", async () => {
    const refreshed = vi.fn();
    renderDialog({ onReviewResolved: refreshed });
    await screen.findByText("Xử lý ca: review-0...");
    expect(screen.getByRole("button", { name: "Xác nhận duyệt" })).toBeDisabled();
    fireEvent.mouseDown(screen.getByLabelText("Chọn học viên trong lớp"));
    fireEvent.click(await screen.findByRole("option", { name: "Học viên A (HV01)" }));
    listSessionReviews.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận duyệt" }));
    await waitFor(() => expect(resolveReview).toHaveBeenCalledWith(review.id, {
      resolution: "ASSIGN_OTHER", participantId: "student:1", status: "PRESENT", note: undefined,
    }));
    expect(await screen.findByText(/Không có ca nào/)).toBeInTheDocument();
    expect(refreshed).toHaveBeenCalledOnce();
  });

  it("accepts a suggested participant and reloads pending cases", async () => {
    listSessionReviews.mockResolvedValue([{ ...review, suggestedSubjectId: "student:1" }]);
    renderDialog();
    await screen.findByText("Xử lý ca: review-0...");
    listSessionReviews.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận duyệt" }));
    await waitFor(() => expect(resolveReview).toHaveBeenCalledWith(review.id, expect.objectContaining({ resolution: "ACCEPT_SUGGESTED", participantId: "student:1" })));
    expect(await screen.findByText(/Không có ca nào/)).toBeInTheDocument();
  });
});
