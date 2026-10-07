import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import AdmissionRecords from "../../pages/plan/admissionRecords";
jest.mock("axios", () => ({ get: jest.fn(), put: jest.fn(), isCancel: jest.fn(() => false), defaults: {} }));
jest.mock("@mui/icons-material", () => ({
  AddPhotoAlternateRounded: () => null, AddRounded: () => null, CheckCircleRounded: () => null,
  CloseRounded: () => null, DeleteRounded: () => null, EditRounded: () => null,
  PersonRounded: () => null, PrintRounded: () => null, VisibilityRounded: () => null, SearchRounded: () => null,
}));
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });
jest.mock("react-toastify", () => ({ ToastContainer: () => null, toast: { success: jest.fn(), error: jest.fn() } }));
let rows;
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear();
  rows = Array.from({ length: 16 }, (_, index) => ({ id: `record-${index + 1}`, code: `HV${String(index + 1).padStart(3, "0")}`, fullName: `Học viên ${index + 1}`, trainingLevel: "Thạc sĩ", studyStatus: index === 2 ? "Tạm hoãn" : "Đã trúng tuyển", updatedAt: "2026-10-07T01:00:00Z", extraData: index === 1 ? { tuitionPayment: { paid: true } } : {} }));
  axios.get.mockImplementation(async (url) => {
    if (url.endsWith('/auth/isStaff')) return { data: { message: 'admin' } };
    if (url.includes('/admission-records?')) {
      const page = Number(new URL(url, 'http://localhost').searchParams.get('page') || 1);
      return { data: { data: rows.slice((page - 1) * 15, page * 15), pagination: { total: 16, totalPages: 2 }, stats: {} } };
    }
    return { data: [] };
  });
  axios.put.mockImplementation(async (_, payload) => {
    for (const selected of payload.rows) {
      const row = rows.find((item) => item.id === selected.admissionRecordId);
      row.studyStatus = "Đang học"; row.extraData = { tuitionPayment: { paid: true } };
    }
    return { data: { confirmedCount: payload.rows.length } };
  });
});
const mount = () => render(<MemoryRouter><AdmissionRecords mode="admitted-masters" /></MemoryRouter>);
it("chọn cả trang chỉ lấy học viên chưa xác nhận và bỏ qua trạng thái tạm hoãn", async () => {
  mount();
  const all = await screen.findByLabelText("Chọn tất cả học viên chưa nộp học phí trên trang này");
  expect(screen.getByLabelText("Chọn xác nhận học phí HV002")).toBeDisabled();
  expect(screen.getByLabelText("Chọn xác nhận học phí HV003")).toBeDisabled();
  fireEvent.click(all);
  expect(screen.getByText("Đã chọn 13 học viên")).toBeInTheDocument();
  fireEvent.click(all);
  expect(screen.getByText("Đã chọn 0 học viên")).toBeInTheDocument();
});
it("giữ lựa chọn qua nhiều trang và gửi toàn bộ danh sách chỉ trong một yêu cầu", async () => {
  mount(); fireEvent.click(await screen.findByLabelText("Chọn xác nhận học phí HV001"));
  fireEvent.click(screen.getByRole("button", { name: /page 2/i }));
  fireEvent.click(await screen.findByLabelText("Chọn xác nhận học phí HV016"));
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận đã nộp học phí (2)" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/tuition/confirm-batch"), { rows: [
    { admissionRecordId: "record-1", updatedAt: "2026-10-07T01:00:00Z" },
    { admissionRecordId: "record-16", updatedAt: "2026-10-07T01:00:00Z" },
  ] }, { withCredentials: true }));
  await waitFor(() => {
    expect(screen.getByText("Đã chọn 0 học viên")).toBeInTheDocument();
    expect(screen.getByLabelText("Chọn xác nhận học phí HV016")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Bỏ chọn/i })).toBeDisabled();
  });
  expect(axios.put).toHaveBeenCalledTimes(1);
});
it("đổi bộ lọc tìm kiếm sẽ bỏ lựa chọn cũ", async () => {
  mount(); fireEvent.click(await screen.findByLabelText("Chọn xác nhận học phí HV001"));
  fireEvent.change(screen.getByRole("textbox", { name: "Tìm kiếm" }), { target: { value: "An" } });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)); });
  expect(screen.getByText("Đã chọn 0 học viên")).toBeInTheDocument();
});
