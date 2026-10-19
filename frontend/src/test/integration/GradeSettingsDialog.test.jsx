import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import GradeSettingsDialog from "../../features/exams/GradeSettingsDialog";
import { notifySubjectCatalogChanged } from "../../utils/subjectCatalog";
import { clonePolicy } from "../../features/exams/gradingPolicy";

jest.mock("axios");
jest.mock("@mui/icons-material", () => ({ SearchRounded: () => null }));
jest.setTimeout(60000);
const majors = [{ id: "m1", name: "Công nghệ thông tin" }, { id: "m2", name: "Cơ khí" }];
const catalog = [
  { id: "s1", majorId: "m1", name: "Triết học", code: "TH01", credits: 3 },
  { id: "s2", majorId: "m1", name: "Mạng máy tính", code: "MMT01", credits: 4 },
  { id: "s3", majorId: "m2", name: "Cơ học", code: "CH01", credits: 2 },
];
const groups = [{ majorId: "m1", academicYear: "2025" }, { majorId: "m1", academicYear: "2026" }];
const choose = async (label, option) => {
  fireEvent.mouseDown(screen.getByLabelText(label));
  fireEvent.click(await screen.findByRole("option", { name: option }));
};
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear();
  axios.get.mockImplementation(async (url) => ({ data:
    url.endsWith("/training-plan") ? majors : url.endsWith("/subjects") ? catalog : url.endsWith("/grading-rules") ? clonePolicy() : [],
  }));
});

it("edits independent percentages from 0 to 100 and formats them when leaving the cell", async () => {
  render(<GradeSettingsDialog initialMajorId="m1" initialYear="2026" onClose={jest.fn()} />);
  const test = await screen.findByLabelText("Tỷ trọng điểm kiểm tra TH01");
  await waitFor(() => expect(test).toBeEnabled());
  const assignment = screen.getByLabelText("Tỷ trọng điểm btl/tl/kt TH01");
  fireEvent.focus(test);
  fireEvent.change(test, { target: { value: "25" } });
  expect(test).toHaveValue("25");
  fireEvent.blur(test);
  fireEvent.focus(assignment);
  expect(test).toHaveValue("25%");
  fireEvent.change(assignment, { target: { value: "0" } });
  fireEvent.blur(assignment);
  expect(assignment).toHaveValue("0%");
  fireEvent.focus(test);
  expect(test).toHaveValue("25");
  fireEvent.change(test, { target: { value: "100" } });
  fireEvent.change(test, { target: { value: "101" } });
  expect(test).toHaveValue("100");
  fireEvent.change(test, { target: { value: "-1" } });
  expect(test).toHaveValue("100");
  fireEvent.change(test, { target: { value: "12,5" } });
  fireEvent.blur(test);
  expect(test).toHaveValue("12.5%");
  expect(screen.getByLabelText("Tỷ trọng điểm kiểm tra MMT01")).toHaveValue("25%");
  fireEvent.focus(test);
  fireEvent.change(test, { target: { value: "" } });
  fireEvent.blur(test);
  expect(test).toHaveValue("");
  expect(axios.put).not.toHaveBeenCalled();
});

it.each(["same tab", "another tab"])("refreshes an open popup after a catalog change in %s without changing its filters", async (source) => {
  render(<GradeSettingsDialog initialMajorId="m1" initialYear="2026" onClose={jest.fn()} />);
  expect(await screen.findByText("Triết học")).toBeInTheDocument();
  const original = axios.get.getMockImplementation();
  axios.get.mockImplementation(async (url) => url.endsWith("/subjects")
    ? { data: catalog.map(subject => subject.id === "s1" ? { ...subject, name: "Triết học cập nhật", credits: 5 } : subject) }
    : original(url));
  act(() => {
    if (source === "same tab") notifySubjectCatalogChanged();
    else {
      localStorage.setItem("subject-catalog-revision", "updated-in-other-tab");
      window.dispatchEvent(new StorageEvent("storage", { key: "subject-catalog-revision" }));
    }
  });
  expect(await screen.findByText("Triết học cập nhật")).toBeInTheDocument();
  expect(screen.queryByText("Triết học")).not.toBeInTheDocument();
  expect(screen.getByRole("row", { name: /TH01 Triết học cập nhật 5/ })).toBeInTheDocument();
  expect(screen.getByLabelText("Năm")).toHaveTextContent("2026");
  expect(screen.getByLabelText("Chuyên ngành")).toHaveTextContent("Công nghệ thông tin");
});

it("shows every catalog subject of one major regardless of year or curriculum membership", async () => {
  render(<GradeSettingsDialog initialMajorId="m1" initialYear="2026" groups={groups} onClose={jest.fn()} />);
  expect(await screen.findByText("Triết học")).toBeInTheDocument();
  expect(screen.getByText("Mạng máy tính")).toBeInTheDocument();
  expect(screen.queryByText("Cơ học")).not.toBeInTheDocument();
  expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
    "STT", "Mã học phần", "Tên học phần", "Số TC", "Điểm kiểm tra", "Điểm BTL/TL/KT", "Điểm thi hết môn",
    "Điểm học phần",
  ]);
  await choose("Năm", "2025");
  expect(await screen.findByText("Mạng máy tính")).toBeInTheDocument();
  expect(screen.getByText("Triết học")).toBeInTheDocument();
  await choose("Năm", "Tất cả năm");
  expect(await screen.findByText("Triết học")).toBeInTheDocument();
  expect(screen.getByText("Mạng máy tính")).toBeInTheDocument();
  expect(await screen.findByText("2 học phần", { selector: ".MuiChip-label" })).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("Tìm theo mã, tên học phần..."), { target: { value: "mang may tinh" } });
  const row = screen.getByRole("row", { name: /^1 MMT01 Mạng máy tính 4/ });
  expect(within(row).getAllByRole("cell").slice(0, 4).map((cell) => cell.textContent)).toEqual(["1", "MMT01", "Mạng máy tính", "4"]);
  expect(screen.queryByText("Triết học")).not.toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("Tìm theo mã, tên học phần..."), { target: { value: "" } });
  await choose("Chuyên ngành", "Cơ khí");
  fireEvent.change(screen.getByPlaceholderText("Tìm theo mã, tên học phần..."), { target: { value: "CH01" } });
  expect(screen.getByText("Cơ học")).toBeInTheDocument();
  expect(axios.put).not.toHaveBeenCalled();
  expect(axios.post).not.toHaveBeenCalled();
  expect(axios.get.mock.calls.some(([url]) => url.includes("/curriculums"))).toBe(false);
});

it.each(["", "missing-major"])("always selects a concrete major when the initial selection is %s", async (initialMajorId) => {
  render(<GradeSettingsDialog initialMajorId={initialMajorId} initialYear="2026" onClose={jest.fn()} />);
  await waitFor(() => expect(majors.map(major => major.name)).toContain(screen.getByLabelText("Chuyên ngành").textContent));
  fireEvent.mouseDown(screen.getByLabelText("Chuyên ngành"));
  expect(screen.queryByRole("option", { name: "Tất cả chuyên ngành" })).not.toBeInTheDocument();
  expect(screen.getAllByRole("option")).toHaveLength(2);
  expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(expect.arrayContaining(["Cơ khí", "Công nghệ thông tin"]));
});

it("keeps the selected year and lists the major's catalog even when that year has no curriculum", async () => {
  const onClose = jest.fn();
  render(<GradeSettingsDialog initialMajorId="m1" initialYear="2025" onClose={onClose} />);
  expect(await screen.findByText("Mạng máy tính")).toBeInTheDocument();
  await choose("Chuyên ngành", "Cơ khí");
  expect(await screen.findByText("Cơ học")).toBeInTheDocument();
  expect(screen.queryByText("Mạng máy tính")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Năm")).toHaveTextContent("2025");
  fireEvent.click(screen.getByRole("button", { name: "Đóng", exact: true }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("reports a load failure and can retry without displaying an incomplete subject list", async () => {
  const original = axios.get.getMockImplementation();
  let failed = false;
  axios.get.mockImplementation(async (url, config) => {
    if (url.endsWith("/subjects") && !failed) { failed = true; throw new Error("offline"); }
    return original(url, config);
  });
  render(<GradeSettingsDialog initialMajorId="m1" initialYear="2026" onClose={jest.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Không thể tải danh sách học phần");
  expect(screen.queryByText("Triết học")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  expect(await screen.findByText("Triết học")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
});

it("shares minimums and conversion across all subjects, years and majors, then reloads the saved rules", async () => {
  let saved = [];
  let sharedSaved = clonePolicy();
  const original = axios.get.getMockImplementation();
  axios.get.mockImplementation(async url => url.endsWith("/grading-rules") ? { data: sharedSaved } : url.endsWith("/grading-policies") ? { data: saved } : original(url));
  axios.put.mockImplementation(async (url, { rows, shared }) => {
    if (shared) { const { revision, ...rules } = shared; sharedSaved = { ...clonePolicy(), ...rules, version: revision + 1 }; }
    saved = rows.map(({ subjectId, year, revision, ...policy }) => ({ subjectId, year, policy: { ...policy, version: revision + 1 } }));
    return { data: saved };
  });
  const view = render(<GradeSettingsDialog initialMajorId="m1" initialYear="2026" onClose={jest.fn()} />);
  const conditions = await screen.findByRole("button", { name: "Điều kiện đạt", exact: true });
  await waitFor(() => expect(conditions).toBeEnabled());
  fireEvent.click(conditions);
  expect(screen.getByPlaceholderText("Tìm theo mã, tên học phần...")).toBeInTheDocument();
  expect(screen.getByText("Danh sách học phần")).toBeInTheDocument();
  expect(await screen.findByText("2 học phần", { selector: ".MuiChip-label" })).toBeInTheDocument();
  expect(screen.queryByRole("table", { name: "Học phần theo chuyên ngành" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Quy đổi điểm của môn" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Học phần cấu hình")).not.toBeInTheDocument();
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  fireEvent.change(screen.getByLabelText("Điểm kiểm tra tối thiểu"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Điểm thi hết môn tối thiểu"), { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText("Điểm học phần tối thiểu để đạt"), { target: { value: "5" } });
  await choose("Chuyên ngành", "Cơ khí");
  expect(screen.getByLabelText("Điểm kiểm tra tối thiểu")).toHaveValue(2);
  await choose("Chuyên ngành", "Công nghệ thông tin");
  expect(screen.getByLabelText("Điểm kiểm tra tối thiểu")).toHaveValue(2);
  fireEvent.click(screen.getByRole("button", { name: "Quy đổi thang điểm" }));
  const search = screen.getByPlaceholderText("Tìm theo mã, tên học phần...");
  expect(screen.getByText("Danh sách học phần")).toBeInTheDocument();
  fireEvent.change(search, { target: { value: "TH01" } });
  expect(screen.getByText("1 học phần", { selector: ".MuiChip-label" })).toBeInTheDocument();
  expect(screen.getByText("Quy đổi thang 10 sang thang 4 và điểm chữ · Áp dụng chung cho tất cả học phần")).toBeInTheDocument();
  expect(screen.queryByLabelText("Học phần cấu hình")).not.toBeInTheDocument();
  fireEvent.change(search, { target: { value: "no-matching-subject" } });
  expect(screen.getByRole("table", { name: "Bảng quy đổi điểm" })).toBeInTheDocument();
  expect(screen.getByText("0 học phần", { selector: ".MuiChip-label" })).toBeInTheDocument();
  fireEvent.change(search, { target: { value: "" } });
  expect(screen.getByRole("columnheader", { name: "Thao tác" })).toBeInTheDocument();
  expect(screen.queryByRole("table", { name: "Học phần theo chuyên ngành" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Điều kiện đạt của môn" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Dùng bảng quy đổi chung"));
  fireEvent.change(screen.getByLabelText("Thang 4 mức 6"), { target: { value: "2.2" } });
  fireEvent.change(screen.getByLabelText("Điểm chữ mức 6"), { target: { value: "C*" } });
  fireEvent.change(screen.getByLabelText("Điểm mẫu học phần (thang 10)"), { target: { value: "6" } });
  expect(screen.getByRole("status")).toHaveTextContent("Thang 10: 6.0 · Thang 4: 2.2 · Điểm chữ: C*");
  fireEvent.change(screen.getByLabelText("Ngưỡng thang 10 mức 6"), { target: { value: "5" } });
  expect(screen.getByText(/Các ngưỡng thang 10 không được trùng/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình (1)" }));
  expect(axios.put).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Ngưỡng thang 10 mức 6"), { target: { value: "5.5" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình (1)" }));
  expect(await screen.findByText(/Đã lưu cấu hình chung/)).toBeInTheDocument();
  expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/grading-policies"), { rows: [], shared: expect.objectContaining({
    revision: 0, minimums: { testScore: 2, assignmentScore: 4, examScore: 5 }, courseMinimum: 5, useDefaultBands: false,
    bands: expect.arrayContaining([{ minimum: 5.5, grade4: 2.2, letter: "C*" }]),
  }) });
  view.unmount();
  render(<GradeSettingsDialog initialMajorId="m1" initialYear="2026" onClose={jest.fn()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Quy đổi thang điểm" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Quy đổi thang điểm" }));
  expect(screen.getByLabelText("Dùng bảng quy đổi chung")).not.toBeChecked();
  expect(screen.getByLabelText("Thang 4 mức 6")).toHaveValue(2.2);
  fireEvent.click(screen.getByRole("button", { name: "Điều kiện đạt", exact: true }));
  expect(screen.getByLabelText("Điểm kiểm tra tối thiểu")).toHaveValue(2);
  fireEvent.click(screen.getByRole("button", { name: "Cài đặt điểm", exact: true }));
  expect(screen.getByRole("table", { name: "Học phần theo chuyên ngành" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Điểm kiểm tra tối thiểu")).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Quy đổi điểm của môn" })).not.toBeInTheDocument();
});

it("keeps edits after a save failure and rejects a weight total other than 100", async () => {
  axios.put.mockRejectedValue(new Error("offline"));
  render(<GradeSettingsDialog initialMajorId="m1" initialYear="2026" onClose={jest.fn()} />);
  const weight = await screen.findByLabelText("Tỷ trọng điểm kiểm tra TH01");
  await waitFor(() => expect(weight).toBeEnabled());
  fireEvent.change(weight, { target: { value: "30" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình (1)" }));
  expect(screen.getByText(/Tổng ba tỷ trọng phải bằng 100/)).toBeInTheDocument();
  expect(axios.put).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Tỷ trọng điểm btl/tl/kt TH01"), { target: { value: "20" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình (1)" }));
  expect(await screen.findByText(/Không thể lưu cấu hình/)).toBeInTheDocument();
  expect(screen.getByLabelText("Tỷ trọng điểm kiểm tra TH01")).toHaveValue("30%");
  expect(screen.getByRole("button", { name: "Lưu cấu hình (1)" })).toBeEnabled();
});
