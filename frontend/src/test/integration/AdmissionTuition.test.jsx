import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { toast } from "react-toastify";
import AdmissionTuitionCheckbox from "../../features/admission/AdmissionTuitionCheckbox";
jest.mock("axios", () => ({ put: jest.fn(), defaults: {} }));
jest.mock("react-toastify", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const record = { id: "record", code: "HV001", trainingLevel: "Thạc sĩ", studyStatus: "Đã trúng tuyển", updatedAt: "2026-10-07T01:00:00Z" };
beforeEach(() => jest.clearAllMocks());
it("lưu xác nhận và đồng bộ trạng thái cùng dữ liệu mới", async () => {
  const updated = { studyStatus: "Đang học", extraData: { tuitionPayment: { paid: true } }, updatedAt: "2026-10-07T02:00:00Z" };
  axios.put.mockResolvedValue({ data: updated });
  const onSaved = jest.fn(); render(<AdmissionTuitionCheckbox record={record} onSaved={onSaved} />);
  fireEvent.click(screen.getByRole("checkbox"));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ ...record, ...updated }));
  expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/admission-records/record/tuition"), { paid: true, updatedAt: record.updatedAt }, { withCredentials: true });
});
it("bỏ tích gửi hủy xác nhận đã nộp và giữ nguyên ô tích nếu lưu thất bại", async () => {
  axios.put.mockRejectedValue({ response: { data: { message: "Hồ sơ đã thay đổi." } } });
  const paid = { ...record, studyStatus: "Đang học", extraData: { tuitionPayment: { paid: true } } };
  const onSaved = jest.fn(); render(<AdmissionTuitionCheckbox record={paid} onSaved={onSaved} />);
  fireEvent.click(screen.getByRole("checkbox"));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Hồ sơ đã thay đổi."));
  expect(axios.put).toHaveBeenCalledWith(expect.any(String), { paid: false, updatedAt: paid.updatedAt }, expect.anything());
  expect(screen.getByRole("checkbox")).toBeChecked(); expect(onSaved).not.toHaveBeenCalled();
});
it.each(["pending", "readonly"])("khóa xác nhận cho %s", (mode) => {
  render(<AdmissionTuitionCheckbox record={{ ...record, studyStatus: mode === "pending" ? "Nộp hồ sơ đầu vào" : record.studyStatus }} disabled={mode === "readonly"} />);
  expect(screen.getByRole("checkbox")).toBeDisabled();
});
