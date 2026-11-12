import React from "react";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import AdmissionScores from "../../pages/masters/admissionScores";
import { CssBaseline, ThemeProvider } from "@mui/material";
import theme from "../../theme";
import { AuthSessionContext } from "../../context/AuthSession";
vi.mock("axios", () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), defaults: {} } }));

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
const mount = (session = null) => render(<ThemeProvider theme={theme}><CssBaseline /><AuthSessionContext.Provider value={{ access: { permissions: ["admission.manage"] }, ...session }}><MemoryRouter useTransitions={false}><AdmissionScores /></MemoryRouter></AuthSessionContext.Provider></ThemeProvider>);
beforeEach(() => { jest.clearAllMocks(); configure(); });
it("rejects invalid threshold typing and paste immediately without changing saved thresholds", async () => {
  mount(); await screen.findByText("HS001");
  const input = screen.getByLabelText("Điểm ngưỡng Công nghệ thông tin");
  for (const value of ["abc", "15abc", "1e1", "+15", "-1", "21", "20.01", "1.2.3", "NaN", "Infinity", " 15 "]) {
    userEvent.clear(input);
    userEvent.paste(input, value);
    expect(input).toHaveValue("");
  }
  userEvent.type(input, "20");
  userEvent.type(input, "1e+-abc");
  expect(input).toHaveValue("20");
  expect(axios.put).not.toHaveBeenCalled();
});
it("accepts threshold boundaries, decimal typing and comma paste, and saves numeric values", async () => {
  axios.put.mockResolvedValue({ data: round });
  mount(); await screen.findByText("HS001");
  const input = screen.getByLabelText("Điểm ngưỡng Công nghệ thông tin");
  for (const value of ["0", "20", "19.75"]) {
    userEvent.clear(input);
    userEvent.type(input, value);
    expect(input).toHaveValue(value);
  }
  userEvent.clear(input);
  userEvent.paste(input, "19,5");
  expect(input).toHaveValue("19.5");
  fireEvent.click(screen.getByRole("button", { name: "Lưu điểm ngưỡng các ngành" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
    expect.stringContaining("/admission-rounds/round-1"),
    expect.objectContaining({ majorThresholds: [{ majorId: "major-1", cutoff: 19.5 }, { majorId: "major-2", cutoff: 17 }] }),
    { withCredentials: true },
  ));
});
it("searches rounds without accents and combines the search with the year filter", async () => {
  const oldRound = { ...round, id: "round-old", name: "Đợt tuyển sinh mùa thu", academicYear: "2025" };
  const otherRound = { ...round, id: "round-other", name: "Đợt bổ sung", academicYear: "2026" };
  configure([round, oldRound, otherRound]); mount();
  await screen.findByText("HS001");
  fireEvent.click(screen.getByRole("button", { name: "Quản lý đợt" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("Hiển thị 3 / 3 đợt xét tuyển")).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText("Tìm đợt xét tuyển"), { target: { value: "dot tuyen sinh" } });
  expect(within(dialog).getByText(oldRound.name)).toBeInTheDocument();
  expect(within(dialog).queryByText(otherRound.name)).not.toBeInTheDocument();
  fireEvent.mouseDown(within(dialog).getByLabelText("Lọc năm tuyển sinh"));
  fireEvent.click(await screen.findByRole("option", { name: "2026" }));
  expect(within(dialog).getByText(/Không tìm thấy đợt phù hợp/)).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText("Tìm đợt xét tuyển"), { target: { value: "" } });
  expect(within(dialog).getByText(otherRound.name)).toBeInTheDocument();
  expect(within(dialog).queryByText(oldRound.name)).not.toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled(); expect(axios.put).not.toHaveBeenCalled();
});
it("selects a round from the management list and loads its ranking", async () => {
  const otherRound = { ...round, id: "round-other", name: "Đợt bổ sung" };
  configure([round, otherRound]); mount(); await screen.findByText("HS001");
  fireEvent.click(screen.getByRole("button", { name: "Quản lý đợt" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByRole("button", { name: `Chọn đợt ${round.name}` })).toBeDisabled();
  fireEvent.click(within(dialog).getByRole("button", { name: `Chọn đợt ${otherRound.name}` }));
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/admission-rounds/round-other/ranking"), { withCredentials: true }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
it("refreshes the management list so newly added rounds become available", async () => {
  mount(); await screen.findByText("HS001");
  fireEvent.click(screen.getByRole("button", { name: "Quản lý đợt" }));
  const dialog = await screen.findByRole("dialog");
  const newRound = { ...round, id: "round-new", name: "Đợt mới cập nhật", academicYear: "2027" };
  configure([newRound, round]);
  fireEvent.click(within(dialog).getByRole("button", { name: "Tải lại danh sách" }));
  expect(await within(dialog).findByText(newRound.name)).toBeInTheDocument();
  expect(within(dialog).getByText("Hiển thị 2 / 2 đợt xét tuyển")).toBeInTheDocument();
});
it("keeps unsaved thresholds when cancelling a round change from the management list", async () => {
  const otherRound = { ...round, id: "round-other", name: "Đợt bổ sung" };
  configure([round, otherRound]); mount(); await screen.findByText("HS001");
  fireEvent.change(screen.getByLabelText("Điểm ngưỡng Công nghệ thông tin"), { target: { value: "14" } });
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  try {
    fireEvent.click(screen.getByRole("button", { name: "Quản lý đợt" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: `Chọn đợt ${otherRound.name}` }));
    expect(confirm).toHaveBeenCalled();
    expect(axios.get.mock.calls.some(([url]) => url.endsWith("/round-other/ranking"))).toBe(false);
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Đóng", exact: true }).at(-1));
    expect(screen.getByLabelText("Điểm ngưỡng Công nghệ thông tin")).toHaveValue("14");
  } finally { confirm.mockRestore(); }
});
it("paginates the round list and returns to matching results when searching", async () => {
  const manyRounds = Array.from({ length: 17 }, (_, index) => ({ ...round, id: `round-${index}`, name: `Đợt số ${index + 1}` }));
  configure(manyRounds); mount(); await screen.findByText("HS001");
  fireEvent.click(screen.getByRole("button", { name: "Quản lý đợt" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("Đợt số 15")).toBeInTheDocument();
  expect(within(dialog).queryByText("Đợt số 16")).not.toBeInTheDocument();
  expect(within(dialog).getByText("Hiển thị 1–15 trên 17 đợt xét tuyển")).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Trang sau" }));
  expect(within(dialog).getByText("Đợt số 16")).toBeInTheDocument();
  expect(within(dialog).getByText("Đợt số 17")).toBeInTheDocument();
  expect(within(dialog).getByText("Hiển thị 16–17 trên 17 đợt xét tuyển")).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText("Tìm đợt xét tuyển"), { target: { value: "Đợt số 1" } });
  expect(within(dialog).getByText("Đợt số 1")).toBeInTheDocument();
  expect(within(dialog).getByText("Hiển thị 9 / 17 đợt xét tuyển")).toBeInTheDocument();
});
it("shows pending applications by default and includes old records only when requested", async () => {
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
  const toggle = screen.getByRole("switch", { name: "Hiển thị cả hồ sơ cũ (đã duyệt)" });
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
  for (const code of ["HS002", "HS004", "HS005", "HS006"]) expect(screen.getByText(code)).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByLabelText("Lọc hồ sơ"));
  fireEvent.click(await screen.findByRole("option", { name: "Đạt ngưỡng", exact: true }));
  expect(screen.queryByText("HS006")).not.toBeInTheDocument();
  fireEvent.mouseDown(screen.getByLabelText("Lọc hồ sơ"));
  fireEvent.click(await screen.findByRole("option", { name: "Tất cả", exact: true }));
  expect(toggle).toBeChecked();
  expect(screen.getByText("HS002")).toBeInTheDocument();
  expect(screen.getByLabelText("Điểm HS002")).toHaveValue(14);
  expect(screen.getByText("HS003")).toBeInTheDocument();
  expect(screen.getByText("HS005")).toBeInTheDocument();
  fireEvent.click(toggle);
  expect(toggle).not.toBeChecked();
  expect(screen.getByText("HS002")).toBeInTheDocument();
  expect(screen.getByText("HS006")).toBeInTheDocument();
  expect(screen.queryByText("HS003")).not.toBeInTheDocument();
  expect(screen.queryByText("HS005")).not.toBeInTheDocument();
  fireEvent.mouseDown(screen.getByLabelText("Lọc hồ sơ"));
  fireEvent.click(await screen.findByRole("option", { name: "Không trúng tuyển", exact: true }));
  expect(toggle).toBeChecked();
  expect(screen.getByText("HS005")).toBeInTheDocument();
  expect(screen.queryByText("HS001")).not.toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
  expect(axios.put).not.toHaveBeenCalled();
});

it("lets a view-only specialist see unscored applications and switch to old records without edit controls", async () => {
  const originalGet = axios.get.getMockImplementation();
  const unscored = { ...record, total: null, meetsCutoff: null };
  const old = { ...record, admissionRecordId: "old", code: "HS-OLD", decision: "admitted", studyStatus: "Đang học" };
  axios.get.mockImplementation(url => url.endsWith("/ranking")
    ? Promise.resolve({ data: { ...ranking, rows: [unscored, old], admittedCount: 1 } }) : originalGet(url));
  mount({ access: { permissions: ["admission.view"] } });
  expect(await screen.findByText("HS001")).toBeInTheDocument();
  expect(screen.queryByLabelText("Điểm HS001")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Lưu điểm" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Xét tuyển", exact: true })).not.toBeInTheDocument();
  expect(screen.queryByText("HS-OLD")).not.toBeInTheDocument();
  const toggle = screen.getByRole("switch", { name: "Hiển thị cả hồ sơ cũ (đã duyệt)" });
  expect(toggle).toBeEnabled();
  fireEvent.click(toggle);
  expect(screen.getByText("HS-OLD")).toBeInTheDocument();
  expect(screen.getByText("HS001")).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByLabelText("Lọc hồ sơ"));
  fireEvent.click(await screen.findByRole("option", { name: "Đạt ngưỡng", exact: true }));
  fireEvent.click(toggle);
  expect(screen.getByText("HS001")).toBeInTheDocument();
  expect(screen.queryByText("HS-OLD")).not.toBeInTheDocument();
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
  expect(screen.getByLabelText("Điểm ngưỡng Công nghệ thông tin")).toHaveValue("15");
  expect(screen.getByLabelText("Điểm ngưỡng Quản trị kinh doanh")).toHaveValue("17");
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
