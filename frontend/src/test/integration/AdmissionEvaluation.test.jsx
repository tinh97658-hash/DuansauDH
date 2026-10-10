import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import AdmissionEvaluationPanel, { AdmissionResult } from "../../features/admission/AdmissionEvaluationPanel";
jest.mock("axios", () => ({ get: jest.fn(), put: jest.fn(), post: jest.fn(), defaults: {} }));
const record = { id: "record-1", majorId: "major-2", academicYear: "2027" };
const evaluation = { decision: "admitted", round: { name: "Đợt 2/2026", academicYear: "2026" }, majorName: "Công nghệ thông tin", result: { total: 16.5, cutoff: 15, meetsCutoff: true } };
const history = [{ id: "history-1", action: "admitted", actor: "Quản lý", createdAt: "2026-10-07T01:00:00Z", snapshot: { evaluation: { decision: "admitted" }, round: evaluation.round, record: { majorName: "Công nghệ thông tin" }, result: evaluation.result, note: "Đã duyệt danh sách" } }];
beforeEach(() => { jest.clearAllMocks(); axios.get.mockResolvedValue({ data: { evaluation, history } }); });

it("người không có quyền quản trị chỉ xem kết quả và lịch sử", async () => {
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
const pendingEvaluation = { ...evaluation, decision: "pending", version: 3, stale: false, result: { ...evaluation.result, eligibility: "eligible" } };
it("quản trị viên duyệt với xác nhận, phiên bản và ghi chú rồi đồng bộ hồ sơ", async () => {
  axios.get.mockResolvedValue({ data: { evaluation: pendingEvaluation, history: [] } });
  axios.post.mockResolvedValue({ data: evaluation });
  const onDecided = jest.fn().mockResolvedValue();
  render(<AdmissionEvaluationPanel record={record} isAdmin onDecided={onDecided} />);
  fireEvent.click(await screen.findByRole("button", { name: "Duyệt trúng tuyển" }));
  expect(axios.post).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Xác nhận" })).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox", { name: "Ghi chú / lý do" }), { target: { value: "  Đủ điều kiện  " } });
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
  await waitFor(() => expect(onDecided).toHaveBeenCalledTimes(1));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/record-1/evaluation/decision"), { decision: "admitted", version: 3, note: "Đủ điều kiện" }, { withCredentials: true });
  expect(await screen.findByText("Đã cập nhật kết quả xét tuyển và trạng thái hồ sơ.")).toBeInTheDocument();
});
it.each([
  { stale: true },
  { result: { ...pendingEvaluation.result, meetsCutoff: false } },
  { result: { ...pendingEvaluation.result, eligibility: "ineligible" } },
])("không cho duyệt hồ sơ chưa đủ điều kiện %j", async (patch) => {
  axios.get.mockResolvedValue({ data: { evaluation: { ...pendingEvaluation, ...patch }, history: [] } });
  render(<AdmissionEvaluationPanel record={record} isAdmin />);
  expect(await screen.findByRole("button", { name: "Duyệt trúng tuyển" })).toBeDisabled();
  expect(axios.post).not.toHaveBeenCalled();
});
it("chặn phê duyệt khi hồ sơ còn thay đổi chưa lưu", async () => {
  axios.get.mockResolvedValue({ data: { evaluation: pendingEvaluation, history: [] } });
  render(<AdmissionEvaluationPanel record={record} isAdmin disabled />);
  expect(await screen.findByRole("button", { name: "Duyệt trúng tuyển" })).toBeDisabled();
  expect(screen.getByText("Lưu thay đổi hồ sơ trước khi phê duyệt xét tuyển.")).toBeInTheDocument();
});
it("hồ sơ chưa có điểm có lối chuyển sang màn nhập điểm", async () => {
  axios.get.mockResolvedValue({ data: { evaluation: null, history: [] } });
  render(<AdmissionEvaluationPanel record={record} isAdmin />);
  expect(await screen.findByRole("link", { name: "Mở điểm xét tuyển thạc sĩ" })).toHaveAttribute("href", "/masters/admission-scores");
  expect(screen.queryByRole("button", { name: "Duyệt trúng tuyển" })).not.toBeInTheDocument();
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
it("sau chuyển ngành hiển thị lịch sử A đã trúng tuyển và cho mở điểm xét tuyển mới, không yêu cầu mở lại A", async () => {
  axios.get.mockResolvedValue({ data: { evaluation: null, history: [...history, {
    ...history[0], id: "transfer-history", action: "major_transfer", snapshot: { ...history[0].snapshot, majorTransfer: { fromMajorId: "major-1", toMajorId: "major-2" } },
  }] } });
  render(<AdmissionEvaluationPanel record={{ ...record, status: "pending", studyStatus: "Nộp hồ sơ đầu vào" }} isAdmin />);
  expect(await screen.findByText("Hồ sơ chưa có kết quả xét tuyển.")).toBeInTheDocument();
  expect(screen.getAllByText(/Ngành: Công nghệ thông tin/)).toHaveLength(2);
  expect(screen.getAllByText(/Kết quả: Đã trúng tuyển/)).toHaveLength(2);
  expect(screen.getByText(/Lưu xét tuyển trước chuyển ngành/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Mở điểm xét tuyển thạc sĩ" })).toHaveAttribute("href", "/masters/admission-scores");
  expect(screen.queryByRole("button", { name: "Mở lại xét tuyển" })).not.toBeInTheDocument();
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
