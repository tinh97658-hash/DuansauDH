import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import AdmissionScores from "../../pages/masters/admissionScores";
import { CssBaseline, ThemeProvider } from "@mui/material";
import theme from "../../theme";
import { AuthSessionContext } from "../../context/AuthSession";
vi.mock("axios", () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), defaults: {} } }));
jest.mock("@mui/icons-material", () => new Proxy({}, { get: () => () => null }));
jest.mock("../../components/FeatureLayout", () => ({ children }) => <div>{children}</div>);
const round = { id: "round-1", name: "Đợt 2/2026", academicYear: "2026", majorThresholds: [{ majorId: "major-1", cutoff: 15 }, { majorId: "major-2", cutoff: 17 }] };
const majors = [{ id: "major-1", name: "Công nghệ thông tin", code: "CNTT", program: "masters", active: true }, { id: "major-2", name: "Quản trị kinh doanh", code: "QTKD", program: "masters", active: true }];
const record = { admissionRecordId: "record-1", majorId: "major-1", majorName: "Công nghệ thông tin", code: "HS001", fullName: "Nguyễn Văn An", version: 1, total: 16, cutoff: 15, decision: "pending", stale: false, meetsCutoff: true };
const ranking = { round, admittedCount: 0, rows: [record, { ...record, admissionRecordId: "record-2", majorId: "major-2", majorName: "Quản trị kinh doanh", code: "HS002", fullName: "Trần Văn Bình", cutoff: 17, meetsCutoff: false }] };
function configure(rounds = [round]) {
  axios.get.mockImplementation((url) => {
    if (url.endsWith("/admission-rounds")) return Promise.resolve({ data: { rows: rounds } });
    if (url.endsWith("/system/majors")) return Promise.resolve({ data: majors });
    if (url.endsWith("/auth/session")) return Promise.resolve({ data: { user: { role: "admin" } } });
    if (url.endsWith("/ranking")) return Promise.resolve({ data: ranking });
    return Promise.reject(new Error(url));
  });
}
const mount = (session = null) => render(<ThemeProvider theme={theme}><CssBaseline /><AuthSessionContext.Provider value={{ ...session, access: { permissions: ["admission.manage"] } }}><MemoryRouter useTransitions={false}><AdmissionScores /></MemoryRouter></AuthSessionContext.Provider></ThemeProvider>);
beforeEach(() => { jest.clearAllMocks(); configure(); });
it("switches between pending applications and eligible applications without changing decisions", async () => {
  const originalGet = axios.get.getMockImplementation();
  const rows = [record, ranking.rows[1],
    { ...record, admissionRecordId: "admitted", code: "HS003", fullName: "Đã duyệt", decision: "admitted" },
    { ...record, admissionRecordId: "stale", code: "HS004", fullName: "Cần xác minh", stale: true },
    { ...record, admissionRecordId: "rejected", code: "HS005", fullName: "Từ chối", decision: "rejected" },
    { ...record, admissionRecordId: "unscored", code: "HS006", fullName: "Chưa điểm", total: null, meetsCutoff: null }];
  axios.get.mockImplementation(url => url.endsWith("/ranking")
    ? Promise.resolve({ data: { ...ranking, rows, admittedCount: 1 } }) : originalGet(url));
  mount();
  await screen.findByText("HS001");
  const toggle = screen.getByRole("switch", { name: "Hiển thị hồ sơ đủ điều kiện" });
  expect(toggle).not.toBeChecked();
  expect(screen.getByText("HS002")).toBeInTheDocument();
  expect(screen.getByText("HS004")).toBeInTheDocument();
  expect(screen.getByText("HS006")).toBeInTheDocument();
  expect(screen.queryByText("HS003")).not.toBeInTheDocument();
  expect(screen.queryByText("HS005")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Điểm HS002"), { target: { value: "14" } });
  fireEvent.click(toggle);
  expect(toggle).toBeChecked();
  expect(screen.getByText("HS001")).toBeInTheDocument();
  expect(screen.getByText("HS003")).toBeInTheDocument();
  for (const code of ["HS002", "HS004", "HS005", "HS006"]) expect(screen.queryByText(code)).not.toBeInTheDocument();
  fireEvent.click(toggle);
  expect(screen.getByText("HS002")).toBeInTheDocument();
  expect(screen.getByLabelText("Điểm HS002")).toHaveValue(14);
  expect(screen.queryByText("HS003")).not.toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
  expect(axios.put).not.toHaveBeenCalled();
});
it("loads rounds and ranking from a verified session without requesting auth again", async () => {
  mount({ authenticated: true, user: { role: "admin" } });
  expect(await screen.findByText("HS001")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Tạo đợt xét tuyển" })).toBeEnabled();
  expect(screen.queryByText("Không tải được đợt xét tuyển.")).not.toBeInTheDocument();
  expect(axios.get.mock.calls.some(([url]) => url.includes("/auth/session"))).toBe(false);
});
it("một đợt hiển thị nhiều ngành và lọc theo đúng ngưỡng từng ngành", async () => {
  mount(); await screen.findByText("HS001");
  expect(screen.getByText("HS002")).toBeInTheDocument();
  expect(screen.getByLabelText("Điểm ngưỡng Công nghệ thông tin")).toHaveValue(15);
  expect(screen.getByLabelText("Điểm ngưỡng Quản trị kinh doanh")).toHaveValue(17);
  expect(screen.queryByText(/chỉ tiêu/i)).not.toBeInTheDocument();
  fireEvent.mouseDown(screen.getByLabelText("Lọc hồ sơ"));
  fireEvent.click(await screen.findByRole("option", { name: "Đạt ngưỡng" }));
  expect(screen.getByText("HS001")).toBeInTheDocument();
  expect(screen.queryByText("HS002")).not.toBeInTheDocument();
});
it("tạo đợt chung bằng tên và năm, không chọn riêng một ngành", async () => {
  configure([]); axios.post.mockImplementation(async () => { configure([round]); return { data: round }; }); mount();
  fireEvent.click(await screen.findByRole("button", { name: "Tạo đợt xét tuyển" }));
  fireEvent.change(screen.getByLabelText("Tên đợt xét tuyển"), { target: { value: "Đợt 2/2026" } });
  expect(screen.queryByLabelText("Chuyên ngành thạc sĩ")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Lưu đợt xét tuyển" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/admission-rounds"), { name: "Đợt 2/2026", academicYear: "2026", majorThresholds: [] }, { withCredentials: true }));
  await screen.findByText("HS001");
  expect(screen.getByText("HS002")).toBeInTheDocument();
});
it("lưu ngưỡng nhiều ngành trong cùng đợt và khóa xét tuyển khi chưa lưu", async () => {
  axios.put.mockResolvedValue({ data: round }); mount(); await screen.findByText("HS001");
  fireEvent.change(screen.getByLabelText("Điểm ngưỡng Công nghệ thông tin"), { target: { value: "14" } });
  fireEvent.change(screen.getByLabelText("Điểm ngưỡng Quản trị kinh doanh"), { target: { value: "16" } });
  expect(screen.getByRole("button", { name: "Xét tuyển" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Lưu điểm ngưỡng các ngành" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/admission-rounds/round-1"), expect.objectContaining({ majorThresholds: [{ majorId: "major-1", cutoff: 14 }, { majorId: "major-2", cutoff: 16 }] }), { withCredentials: true }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Xét tuyển" })).toBeEnabled());
});
it("lọc ngành chỉ thay đổi bảng hiển thị, xét tuyển vẫn gọi cho toàn đợt", async () => {
  axios.post.mockResolvedValue({ data: { round, rows: [record], previewToken: "token" } }); mount(); await screen.findByText("HS001");
  fireEvent.mouseDown(screen.getByLabelText("Lọc ngành"));
  fireEvent.click(await screen.findByRole("option", { name: "Quản trị kinh doanh" }));
  expect(screen.queryByText("HS001")).not.toBeInTheDocument();
  expect(screen.getByText("HS002")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Xét tuyển" }));
  await screen.findByRole("dialog");
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/admission-rounds/round-1/preview"), {}, { withCredentials: true });
});
