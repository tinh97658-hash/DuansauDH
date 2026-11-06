import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import ExcelJS from "exceljs";
import GradebookImportDialog from "../../features/exams/GradebookImportDialog";
import { buildSubjectSigningDocument, createSubjectSigningExcel } from "../../features/exams/subjectSigningExport";

jest.mock("axios");
const current = { participantId: "student:one", fullName: "Nguyễn Văn An", code: "HV001", testScore: 7, assignmentScore: 8 };
const bytes = blob => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsArrayBuffer(blob); });
async function file(people = [current], mutate = () => {}) {
  const doc = buildSubjectSigningDocument([{ id: "g1", code: "CNTT" }], { id: "o1", subject: { name: "Học phần" } }, people);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(await bytes(await createSubjectSigningExcel(doc)));
  const metadata = book.getWorksheet("_SDH_IMPORT");
  book.worksheets[0].getCell(10, metadata.getCell("A3").value).value = 9;
  book.worksheets[0].getCell(10, metadata.getCell("B3").value).value = "";
  mutate(book.worksheets[0], metadata);
  return new File([await book.xlsx.writeBuffer()], "diem-giang-vien.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue({ data: { page: 1, total: 1, revision: 3, rows: [current], componentImportAllowed: true } });
  axios.post.mockResolvedValue({ data: { revision: 4 } });
});

it("previews actual exported Excel and saves only the two permitted fields after confirmation", async () => {
  const onSaved = jest.fn();
  render(<GradebookImportDialog classGroupId="g1" offeringId="o1" onClose={jest.fn()} onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText("Chọn file điểm Excel"), { target: { files: [await file()] } });
  await screen.findByRole("table", { name: "Xem trước điểm nhập từ Excel" });
  expect(screen.getByText("7 → 9")).toBeInTheDocument(); expect(screen.getByText("8 → Giữ nguyên")).toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận cập nhật điểm" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ revision: 4 }, 1));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/exam-lists/import-components"), {
    classGroupId: "g1", courseOfferingId: "o1", rosterScope: "offering", revision: 3, rows: [{ participantId: "student:one", testScore: 9 }],
  });
});

it("refuses preview when scheduling has closed import", async () => {
  axios.get.mockResolvedValue({ data: { componentImportAllowed: false } });
  render(<GradebookImportDialog classGroupId="g1" offeringId="o1" onClose={jest.fn()} onSaved={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Chọn file điểm Excel"), { target: { files: [await file()] } });
  await screen.findByText(/Chỉ nhập Excel sau khi hoàn thành giảng dạy/);
  expect(screen.getByRole("button", { name: "Xác nhận cập nhật điểm" })).toBeDisabled(); expect(axios.post).not.toHaveBeenCalled();
});

it("requires another preview when a schedule is created between preview and save", async () => {
  const onSaved = jest.fn();
  axios.post.mockRejectedValue({ response: { status: 409, data: { code: "COMPONENT_IMPORT_CLOSED", message: "Lớp học phần đã tạo lịch thi, không được nhập điểm từ Excel." } } });
  render(<GradebookImportDialog classGroupId="g1" offeringId="o1" onClose={jest.fn()} onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText("Chọn file điểm Excel"), { target: { files: [await file()] } });
  await screen.findByRole("table", { name: "Xem trước điểm nhập từ Excel" });
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận cập nhật điểm" }));
  await screen.findByText("Lớp học phần đã tạo lịch thi, không được nhập điểm từ Excel.");
  expect(onSaved).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: "Xác nhận cập nhật điểm" })).toBeDisabled();
});

it("loads the whole offering across pages before matching imported scores", async () => {
  const people = Array.from({ length: 31 }, (_, i) => ({ ...current, participantId: `student:${i}`, code: `HV${i}`, fullName: `Học viên ${i}` }));
  axios.get.mockImplementation(async (_url, { params }) => ({ data: { page: params.page, total: 31, revision: 3, componentImportAllowed: true,
    rows: people.slice((params.page - 1) * 15, params.page * 15) } }));
  render(<GradebookImportDialog classGroupId="g1" offeringId="o1" onClose={jest.fn()} onSaved={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Chọn file điểm Excel"), { target: { files: [await file(people, (sheet, metadata) => {
    sheet.getCell(40, metadata.getCell("A3").value).value = 10;
  })] } });
  await screen.findByRole("table", { name: "Xem trước điểm nhập từ Excel" });
  expect(screen.getByText("Học viên 0")).toBeInTheDocument(); expect(screen.getByText("Học viên 30")).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledTimes(3); expect(axios.post).not.toHaveBeenCalled();
});

it("rejects a revision change during the paginated roster read", async () => {
  axios.get.mockImplementation(async (_url, { params }) => ({ data: { page: params.page, total: 16, revision: params.page,
    componentImportAllowed: true, rows: [current] } }));
  render(<GradebookImportDialog classGroupId="g1" offeringId="o1" onClose={jest.fn()} onSaved={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Chọn file điểm Excel"), { target: { files: [await file()] } });
  await screen.findByText(/Bảng điểm đã thay đổi trong lúc đọc file/);
  expect(screen.queryByRole("table")).not.toBeInTheDocument(); expect(axios.post).not.toHaveBeenCalled();
});
