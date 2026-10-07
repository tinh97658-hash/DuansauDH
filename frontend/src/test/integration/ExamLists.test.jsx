import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import ExamLists from "../../pages/masters/examLists";

jest.mock("axios");
jest.mock("@mui/icons-material", () => ({
  DownloadRounded: () => null, ListAltRounded: () => null,
  SaveRounded: () => null, SearchRounded: () => null,
}));
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });
const savedRow = { participantId: "student:one", code: "HV001", fullName: "Nguyễn Văn An", dob: "1990-01-02", gender: "Nam", eligible: null, examExempt: false, testScore: null, assignmentScore: null, examScore: null, courseScore: null, grade4: null, letterGrade: "", attemptScores: [], result: "pending" };
const data = { revision: 0, rows: [savedRow] };
const setup = (role = "admin", gradeRows = data.rows) => {
  axios.get.mockImplementation(async (url) => ({ data: url.endsWith("/options") ? { groups: [{ id: "g1", name: "CNTT 2026", code: "N01", academicYear: "2026" }] } : url.endsWith("/isStaff") ? { message: role } : url.endsWith("/subjects") ? [{ id: "o1", subject: { code: "HP01", name: "An toàn thông tin" } }] : { revision: 0, rows: gradeRows } }));
};
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); setup(); });

it("loads a real class roster and saves only the edited row with its revision", async () => {
  axios.put.mockResolvedValue({ data: { revision: 1, rows: [{ ...savedRow, courseScore: 8.5 }] } });
  render(<ExamLists />);
  const score = await screen.findByLabelText("Điểm học phần HV001");
  fireEvent.change(score, { target: { value: "8,5" } });
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật cả bảng" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/masters/exam-lists"), expect.objectContaining({ classGroupId: "g1", courseOfferingId: "o1", revision: 0, rows: [expect.objectContaining({ participantId: "student:one", courseScore: 8.5 })] })));
  expect(await screen.findByText("Đã cập nhật bảng điểm cho 1 học viên.")).toBeInTheDocument();
});

it("retains a draft when saving fails", async () => {
  axios.put.mockRejectedValue({ response: { data: { message: "Bảng điểm đã được người khác cập nhật." } } });
  render(<ExamLists />);
  fireEvent.change(await screen.findByLabelText("Điểm kiểm tra HV001"), { target: { value: "7" } });
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật cả bảng" }));
  expect(await screen.findByText("Bảng điểm đã được người khác cập nhật.")).toBeInTheDocument();
  expect(screen.getByLabelText("Điểm kiểm tra HV001")).toHaveValue("7");
});

it("shows blank exam sheets without clearing drafts and keeps supervisors read-only", async () => {
  setup("supervisor", [{ ...savedRow, eligible: true }]);
  render(<ExamLists />);
  expect(await screen.findByLabelText("Điểm học phần HV001")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cập nhật cả bảng" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "DS thi" }));
  expect(screen.getByLabelText("Điểm học phần HV001")).toHaveValue("");
  expect(axios.put).not.toHaveBeenCalled();
});

it("prints all students in the full gradebook and only eligible examinees in DS thi, regardless of search", async () => {
  setup("admin", [
    { ...savedRow, eligible: true },
    { ...savedRow, participantId: "student:two", code: "HV002", eligible: null },
    { ...savedRow, participantId: "student:three", code: "HV003", eligible: false },
    { ...savedRow, participantId: "student:four", code: "HV004", eligible: true, examExempt: true },
  ]);
  render(<ExamLists />);
  const printRows = () => within(screen.getByTestId("exam-print-table")).getAllByRole("row", { hidden: true });
  await screen.findByLabelText("Điểm học phần HV001");
  expect(screen.queryByRole("button", { name: "DS thi có điểm" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Danh sách không đạt" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("Tìm theo mã HV, họ tên..."), { target: { value: "HV002" } });
  expect(printRows()).toHaveLength(5);
  fireEvent.click(screen.getByRole("button", { name: "DS thi" }));
  const printed = printRows();
  expect(printed).toHaveLength(2);
  expect(printed[1]).toHaveTextContent("HV001");
  expect(screen.queryByRole("button", { name: "In danh sách" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Tải lại" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Xuất CSV" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cả bảng điểm" }));
  expect(printRows()).toHaveLength(5);
});

it("renders 15 students per page, preserves drafts across pages, and prints the entire roster", async () => {
  const roster = Array.from({ length: 22 }, (_, index) => ({
    ...savedRow, participantId: `student:${index + 1}`, code: `HV${String(index + 1).padStart(3, "0")}`,
  }));
  setup("admin", roster);
  axios.put.mockResolvedValue({ data: { revision: 1, rows: roster } });
  render(<ExamLists />);
  await screen.findByLabelText("Điểm kiểm tra HV001");
  expect(screen.getAllByRole("textbox", { name: /^Điểm kiểm tra HV/ })).toHaveLength(15);
  expect(screen.queryByLabelText("Điểm kiểm tra HV016")).not.toBeInTheDocument();
  expect(screen.getByText("Hiển thị 1–15 trên 22 học viên")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Điểm kiểm tra HV001"), { target: { value: "7" } });
  fireEvent.click(screen.getByRole("button", { name: /page 2/i }));
  expect(screen.getAllByRole("textbox", { name: /^Điểm kiểm tra HV/ })).toHaveLength(7);
  expect(screen.getByText("Hiển thị 16–22 trên 22 học viên")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Điểm kiểm tra HV016"), { target: { value: "8" } });
  fireEvent.click(screen.getByRole("button", { name: /page 1/i }));
  expect(screen.getByLabelText("Điểm kiểm tra HV001")).toHaveValue("7");
  expect(within(screen.getByTestId("exam-print-table")).getAllByRole("row", { hidden: true })).toHaveLength(23);
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật cả bảng" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ rows: [
    expect.objectContaining({ participantId: "student:1", testScore: 7 }),
    expect.objectContaining({ participantId: "student:16", testScore: 8 }),
  ] })));
  expect(await screen.findByText("Đã cập nhật bảng điểm cho 2 học viên.")).toBeInTheDocument();
});

it("returns to the first page when searching or changing the list mode", async () => {
  setup("admin", Array.from({ length: 22 }, (_, index) => ({
    ...savedRow, participantId: `student:${index + 1}`, code: `HV${String(index + 1).padStart(3, "0")}`, eligible: true,
  })));
  render(<ExamLists />);
  await screen.findByLabelText("Điểm kiểm tra HV001");
  fireEvent.click(screen.getByRole("button", { name: /page 2/i }));
  fireEvent.change(screen.getByPlaceholderText("Tìm theo mã HV, họ tên..."), { target: { value: "HV001" } });
  expect(screen.getByLabelText("Điểm kiểm tra HV001")).toBeInTheDocument();
  expect(screen.getByText("Hiển thị 1–1 trên 1 học viên")).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("Tìm theo mã HV, họ tên..."), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: /page 2/i }));
  fireEvent.click(screen.getByRole("button", { name: "DS thi" }));
  expect(screen.getByText("Hiển thị 1–15 trên 22 học viên")).toBeInTheDocument();
});
