import JSZip from "jszip";
import { Blob as NodeBlob } from "node:buffer";
import { downloadClassProgressBatch } from "../../features/scheduling/classProgressBatchExport";
import { createReportExcel, createReportWord, createReportPdf, reportPdfDefinition, normalizeReport } from "../../utils/reportExport";
import { downloadDocumentFile } from "../../utils/documentFiles";

vi.mock("../../utils/reportExport", async () => ({
  ...await vi.importActual("../../utils/reportExport"),
  createReportWord: vi.fn(), createReportExcel: vi.fn(), createReportPdf: vi.fn(),
}));
vi.mock("../../utils/documentFiles", async () => ({ ...await vi.importActual("../../utils/documentFiles"), downloadDocumentFile: vi.fn() }));

const reports = ["CNTT 2026.1.1", "CNTT 2026.1.2"].map(code => ({
  title: "THEO DÕI TIẾN ĐỘ HỌC TẬP", template: "class-progress", filename: `Tien-do-${code}`,
  sections: [{ title: code, academicYear: "2026", metadata: [["Lớp", code]],
    headers: ["STT", "Học Phần", "Mã số", "Số tín chỉ", "Tiến độ", "Ghi chú"],
    rows: [[1, "Triết học", "HPTH", 3, "Chưa tổ chức", ""]], summary: "Số học phần hoàn thành: 0/1" }],
}));
const bytesOf = blob => new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsArrayBuffer(blob);
});

beforeEach(() => {
  vi.clearAllMocks();
  for (const writer of [createReportExcel, createReportWord, createReportPdf]) writer.mockImplementation(async report => new NodeBlob([report.sections[0].title]));
});

it.each([["word", "docx"], ["excel", "xlsx"], ["pdf", "pdf"]])("packages one independent %s file per class", async (format, extension) => {
  await downloadClassProgressBatch(reports, format);
  const [blob, filename] = downloadDocumentFile.mock.calls[0];
  expect(filename).toBe("Theo-doi-tien-do-2-lop.zip");
  const zip = await JSZip.loadAsync(await bytesOf(blob));
  expect(Object.keys(zip.files)).toHaveLength(2);
  for (const report of reports) expect(await zip.file(`${report.filename}.${extension}`).async("string")).toBe(report.sections[0].title);
});

it("rejects a merged document before generating any file", async () => {
  await expect(downloadClassProgressBatch([{ ...reports[0], sections: reports.flatMap(report => report.sections) }], "pdf")).rejects.toThrow("đúng một lớp");
  expect(downloadDocumentFile).not.toHaveBeenCalled();
});

it("uses the progress form and class metadata for downloadable PDFs", () => {
  const definition = reportPdfDefinition(normalizeReport(reports[0]));
  const content = JSON.stringify(definition);
  expect(content).toContain("CNTT 2026.1.1");
  expect(content).not.toContain("CNTT 2026.1.2");
  expect(content).toContain("CHUYÊN VIÊN");
  expect(content).not.toContain("Ngày xuất");
  expect(definition.defaultStyle.italics).toBe(false);
  expect(definition.content.find(item => item.table).table.headerRows).toBe(1);
});
