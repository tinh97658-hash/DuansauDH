import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import BulkAdmissionWorkflow from "../../features/admission/BulkAdmissionWorkflow";
import { createScoreTemplate, parseScoreExcel, readExcelFile } from "../../features/admission/admissionExcel";
jest.mock("../../features/admission/admissionExcel", () => ({ createScoreTemplate: jest.fn(), parseScoreExcel: jest.fn(), readExcelFile: jest.fn(), EXCEL_MIME: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
jest.mock("axios", () => ({ put: jest.fn(), post: jest.fn(), defaults: {} }));
const row = { admissionRecordId: "record-1", code: "HS001", fullName: "Nguyễn Văn An", birthYear: 1996, gender: "Nam", phone: "0900000001", email: "demo@example.com", version: 0, total: null, decision: "pending", stale: false, meetsCutoff: null };
const data = { round: { id: "round-1", majorThresholds: [{ majorId: "major-1", cutoff: 15 }] }, rows: [row], admittedCount: 0 };
const mount = (props = {}) => render(<MemoryRouter><BulkAdmissionWorkflow data={data} visibleRows={data.rows} admin onRefresh={jest.fn().mockResolvedValue()} {...props} /></MemoryRouter>);
const preview = { round: data.round, rows: [{ ...row, total: 16 }], previewToken: "token" };
beforeEach(() => {
  jest.clearAllMocks(); axios.put.mockResolvedValue({ data: { savedCount: 1 } });
  createScoreTemplate.mockResolvedValue(new Uint8Array([1, 2]));
  readExcelFile.mockResolvedValue(new Uint8Array([1, 2]));
  parseScoreExcel.mockResolvedValue({ rows: [{ admissionRecordId: "record-1", score: 16.5, version: 0 }], skippedCount: 0 });
  URL.createObjectURL = jest.fn(() => "blob:sample"); URL.revokeObjectURL = jest.fn();
});
it("hiển thị năm sinh, giới tính và liên hệ của hồ sơ", () => {
  mount();
  for (const value of ["1996", "Nam", row.phone, row.email]) expect(screen.getByText(value)).toBeInTheDocument();
});
it("tải file mẫu .xlsx cho đúng danh sách đang hiển thị", async () => {
  const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const filtered = [row]; mount({ visibleRows: filtered });
  fireEvent.click(screen.getByRole("button", { name: "Tải file Excel mẫu" }));
  await screen.findByText(/Đã tải file mẫu với 1 hồ sơ/);
  expect(createScoreTemplate).toHaveBeenCalledWith(data.round, filtered);
  expect(click).toHaveBeenCalled(); expect(URL.createObjectURL).toHaveBeenCalled();
  expect(click.mock.instances[0].download).toMatch(/\.xlsx$/);
  expect(axios.put).not.toHaveBeenCalled(); click.mockRestore();
});
it("lưu điểm hàng loạt kèm phiên bản và khóa xét tuyển khi chưa lưu", async () => {
  mount();
  fireEvent.change(screen.getByLabelText("Điểm HS001"), { target: { value: "16.5" } });
  expect(screen.getByRole("button", { name: "Xét tuyển" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /Lưu điểm hàng loạt/ }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/round-1/scores"), { rows: [{ admissionRecordId: "record-1", score: 16.5, version: 0 }] }, { withCredentials: true }));
  await screen.findByText(/Đã lưu điểm của 1 hồ sơ/);
  expect(axios.post).not.toHaveBeenCalled();
});
it("import file Excel hợp lệ tự lưu hàng loạt và không đổi trạng thái", async () => {
  mount(); const file = new File(["xlsx"], "diem.xlsx");
  fireEvent.change(screen.getByLabelText("Chọn file Excel nhập điểm"), { target: { files: [file] } });
  await screen.findByText(/Đã import và lưu điểm 1 hồ sơ/);
  expect(readExcelFile).toHaveBeenCalledWith(file);
  expect(parseScoreExcel).toHaveBeenCalledWith(expect.any(Uint8Array), "round-1", data.rows);
  expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/round-1/scores"), { rows: [{ admissionRecordId: "record-1", score: 16.5, version: 0 }] }, { withCredentials: true });
  expect(axios.post).not.toHaveBeenCalled();
});
it("file sai bị chặn trước khi ghi bất kỳ điểm nào", async () => {
  parseScoreExcel.mockRejectedValue(new Error("File mẫu thuộc đợt xét tuyển khác.")); mount();
  fireEvent.change(screen.getByLabelText("Chọn file Excel nhập điểm"), { target: { files: [new File(["xlsx"], "diem.xlsx")] } });
  await screen.findByText("File mẫu thuộc đợt xét tuyển khác.");
  expect(axios.put).not.toHaveBeenCalled();
});
it("mở danh sách không cập nhật trạng thái, hủy không gọi xác nhận", async () => {
  axios.post.mockResolvedValue({ data: preview }); mount();
  fireEvent.click(screen.getByRole("button", { name: "Xét tuyển" }));
  await screen.findByText("Duyệt danh sách hồ sơ đạt điểm xét tuyển");
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/preview"), {}, { withCredentials: true });
  fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
  expect(axios.post).toHaveBeenCalledTimes(1);
});
it("chỉ nút Đồng ý duyệt mới gửi danh sách kèm phiên bản xem trước", async () => {
  axios.post.mockResolvedValueOnce({ data: preview }).mockResolvedValueOnce({ data: { admittedCount: 1 } }); mount();
  fireEvent.click(screen.getByRole("button", { name: "Xét tuyển" }));
  fireEvent.click(await screen.findByRole("button", { name: "Đồng ý duyệt" }));
  await waitFor(() => expect(axios.post).toHaveBeenLastCalledWith(expect.stringContaining("/confirm"), { previewToken: "token", admissionRecordIds: ["record-1"] }, { withCredentials: true }));
  await screen.findByText(/Đã duyệt 1 hồ sơ sang trạng thái/);
});
it("chọn sẵn mọi hồ sơ đạt ngưỡng và cho duyệt không giới hạn số lượng", async () => {
  axios.post.mockResolvedValue({ data: { ...preview, rows: [preview.rows[0], { ...preview.rows[0], admissionRecordId: "record-2", code: "HS002" }] } }); mount();
  fireEvent.click(screen.getByRole("button", { name: "Xét tuyển" }));
  expect(await screen.findByRole("button", { name: "Đồng ý duyệt" })).toBeEnabled();
  expect(screen.getByLabelText("Duyệt HS001")).toBeChecked();
  expect(screen.getByLabelText("Duyệt HS002")).toBeChecked();
  expect(screen.queryByText(/chỉ tiêu/i)).not.toBeInTheDocument();
});
it("dữ liệu thay đổi khi duyệt thì đóng danh sách và yêu cầu xét lại", async () => {
  axios.post.mockResolvedValueOnce({ data: preview }).mockRejectedValueOnce({ response: { status: 409, data: { message: "Điểm đã thay đổi. Xét tuyển lại." } } }); mount();
  fireEvent.click(screen.getByRole("button", { name: "Xét tuyển" }));
  fireEvent.click(await screen.findByRole("button", { name: "Đồng ý duyệt" }));
  await screen.findByText("Điểm đã thay đổi. Xét tuyển lại.");
  await waitFor(() => expect(screen.queryByRole("button", { name: "Đồng ý duyệt" })).not.toBeInTheDocument());
});
it("người xem không có thao tác nhập hoặc duyệt", () => {
  mount({ admin: false });
  expect(screen.queryByRole("button", { name: "Xét tuyển" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Điểm HS001")).not.toBeInTheDocument();
});
