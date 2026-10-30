import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AttendanceEnrollDialog from "./AttendanceEnrollDialog";
import { enrollParticipant, getParticipantEnrollment, listParticipantAudit } from "./attendanceApi";

vi.mock("./attendanceApi", () => ({ enrollParticipant: vi.fn(), getParticipantEnrollment: vi.fn(), listParticipantAudit: vi.fn(), withdrawParticipantEnrollment: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("URL", { createObjectURL: vi.fn((file) => `blob:${file.name}`), revokeObjectURL: vi.fn() });
  getParticipantEnrollment.mockResolvedValue({ subject: null });
  listParticipantAudit.mockResolvedValue({ events: [] });
  enrollParticipant.mockResolvedValue({ templates_added: 3, rejected_images: [] });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const photos = () => [1, 2, 3].map((n) => new File(["photo"], `${n}.jpg`, { type: "image/jpeg" }));
async function openDialog() {
  const view = render(<AttendanceEnrollDialog participant={{ studentId: "student:1", fullName: "Học viên A" }} open onClose={vi.fn()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Chọn 3–5 ảnh chân dung" })).toBeEnabled());
  return { ...view, input: document.querySelector('input[type="file"]') };
}

describe("Face enrollment dialog", () => {
  it("uploads original files using the participant identifier and frees previews after saving", async () => {
    const { input } = await openDialog();
    const files = photos();
    fireEvent.change(input, { target: { files } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu mẫu khuôn mặt" }));
    expect(await screen.findByText("Đăng ký thành công 3 mẫu khuôn mặt.")).toBeInTheDocument();
    expect(enrollParticipant).toHaveBeenCalledOnce();
    const [id, form] = enrollParticipant.mock.calls[0];
    expect(id).toBe("student:1");
    expect(form.getAll("images")).toEqual(files);
    expect(form.get("replace")).toBe("true");
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
  });

  it("clears the previous selection when the replacement file count is invalid", async () => {
    const { input } = await openDialog();
    fireEvent.change(input, { target: { files: photos() } });
    expect(screen.getByRole("button", { name: "Lưu mẫu khuôn mặt" })).toBeEnabled();
    fireEvent.change(input, { target: { files: photos().slice(0, 1) } });
    expect(screen.getByRole("button", { name: "Lưu mẫu khuôn mặt" })).toBeDisabled();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
    expect(enrollParticipant).not.toHaveBeenCalled();
  });

  it("displays per-image rejections without losing the selected files", async () => {
    enrollParticipant.mockRejectedValue({ response: { data: { message: "only 0 of 3 images passed quality; need at least 3; image 1: no_face: no face detected | image 2: no_face: no face detected | image 3: no_face: no face detected" } } });
    const { input } = await openDialog();
    fireEvent.change(input, { target: { files: photos() } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu mẫu khuôn mặt" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Ảnh #1: Không phát hiện được khuôn mặt");
    expect(alert).toHaveTextContent("Ảnh #3: Không phát hiện được khuôn mặt");
    expect(screen.getByRole("button", { name: "Lưu mẫu khuôn mặt" })).toBeEnabled();
    expect(screen.getAllByRole("img")).toHaveLength(3);
  });
});
