import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import axios from "axios";
import AdmissionEvaluationPanel, { AdmissionResult } from "../../features/admission/AdmissionEvaluationPanel";
jest.mock("axios", () => ({ get: jest.fn(), put: jest.fn(), post: jest.fn(), defaults: {} }));
const record = { id: "record-1", majorId: "major-2", academicYear: "2027" };
const evaluation = { decision: "admitted", round: { name: "Đợt 2/2026", academicYear: "2026" }, majorName: "Công nghệ thông tin", result: { total: 16.5, cutoff: 15, meetsCutoff: true } };
const history = [{ id: "history-1", action: "admitted", actor: "Quản lý", createdAt: "2026-10-07T01:00:00Z", snapshot: { evaluation: { decision: "admitted" }, round: evaluation.round, record: { majorName: "Công nghệ thông tin" }, result: evaluation.result, note: "Đã duyệt danh sách" } }];
beforeEach(() => { jest.clearAllMocks(); axios.get.mockResolvedValue({ data: { evaluation, history } }); });

it("tab chỉ hiển thị kết quả và lịch sử, không có nhập điểm hoặc duyệt", async () => {
  render(<AdmissionEvaluationPanel record={record} />);
  expect(await screen.findByText("Tổng điểm: 16.5")).toBeInTheDocument();
  expect(screen.getByText("KẾT QUẢ XÉT TUYỂN")).toBeInTheDocument();
  expect(screen.getByText("LỊCH SỬ XÉT TUYỂN")).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Duyệt|Lưu/ })).not.toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledTimes(1);
  expect(axios.put).not.toHaveBeenCalled(); expect(axios.post).not.toHaveBeenCalled();
});
it("hiển thị năm, ngành, điểm và ngưỡng đã lưu trong lịch sử dù hồ sơ hiện tại khác năm", async () => {
  render(<AdmissionEvaluationPanel record={record} />);
  expect(await screen.findByText(/Năm: 2026 · Đợt: Đợt 2\/2026 · Ngành: Công nghệ thông tin/)).toBeInTheDocument();
  expect(screen.getByText(/Điểm hồ sơ: 16.5 · Điểm ngưỡng ngành: 15 · Kết quả: Đã trúng tuyển/)).toBeInTheDocument();
  expect(screen.getByText("Đã duyệt danh sách")).toBeInTheDocument();
});
it("hồ sơ chưa xét tuyển có thông báo rõ ràng", async () => {
  axios.get.mockResolvedValue({ data: { evaluation: null, history: [] } });
  render(<AdmissionEvaluationPanel record={record} />);
  expect(await screen.findByText("Hồ sơ chưa có kết quả xét tuyển.")).toBeInTheDocument();
  expect(screen.getByText("Chưa có lịch sử xét tuyển.")).toBeInTheDocument();
});
it("có thể tải lại khi đọc dữ liệu thất bại", async () => {
  axios.get.mockRejectedValueOnce(new Error("network"));
  render(<AdmissionEvaluationPanel record={record} />);
  fireEvent.click(await screen.findByRole("button", { name: "Tải lại" }));
  expect(await screen.findByText("Tổng điểm: 16.5")).toBeInTheDocument();
});
it("điểm chưa nhập không hiển thị thành 0", () => {
  render(<AdmissionResult evaluation={{ ...evaluation, result: { total: null, cutoff: null, meetsCutoff: null } }} />);
  expect(screen.getByText("Tổng điểm: Chưa nhập điểm")).toBeInTheDocument();
  expect(screen.getByText("Điểm ngưỡng ngành: Chưa nhập")).toBeInTheDocument();
});
