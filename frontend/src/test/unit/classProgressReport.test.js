import JSZip from "jszip";
import ExcelJS from "exceljs";
import { buildClassProgressReport, PROGRESS_FORM_WIDTHS, progressMetadataRows } from "../../features/scheduling/classProgressReport";
import { createReportExcel, createReportWord, normalizeReport } from "../../utils/reportExport";

const groups = [{ id: "a", code: "CNTT 2026.1.1", academicYear: "2026", memberCount: 18, curriculum: { code: "CT26", name: "Chương trình đào tạo Công nghệ thông tin" } },
  { id: "b", code: "CNTT 2026.1.2", academicYear: "2026", memberCount: 20 }];
const subjects = [{ name: "Triết học", code: "HPTH", credits: 3, byClass: {
  a: { curriculumSubjectId: "ca", status: "completed", completion: { passedCount: 0, totalCount: 18 }, needsGradeEntry: true, waitingRetakeCount: 2 },
  b: { curriculumSubjectId: "cb", status: "scheduled" },
} }, { name: "Học phần tự chọn", code: "TC01", credits: 0, byClass: { a: { curriculumSubjectId: "cc", status: "not_started" } } }];
const report = () => normalizeReport(buildClassProgressReport({ classes: groups, visibleSubjects: subjects,
  major: { name: "Công nghệ thông tin" }, discipline: { name: "Khoa học máy tính" } }), new Date(2026, 10, 3));
const bytes = blob => new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsArrayBuffer(blob);
});

it("keeps separate class progress, zero counts and credits, and never invents an individual grade", () => {
  const data = report();
  expect(data.sections).toHaveLength(2);
  expect(data.sections[0].rows).toEqual([[1, "Triết học", "HPTH", 3, "Hoàn thành 0/18", "Cần nhập đủ điểm; Chờ bố trí học lại: 2"],
    [2, "Học phần tự chọn", "TC01", 0, "Chưa tổ chức", ""]]);
  expect(data.sections[1].rows).toEqual([[1, "Triết học", "HPTH", 3, "Đã xếp lịch", ""]]);
  expect(data.sections[0].summary).toBe("Số học phần hoàn thành: 1/2");
  expect(data.sections[0].metadata).toContainEqual(["Lớp", groups[0].code]);
  expect(data.sections[0].headers).not.toContain("Điểm");
});

it("only exports filtered subjects applicable to each class", () => {
  const data = buildClassProgressReport({ classes: groups, visibleSubjects: [subjects[1]], status: "not_started", search: "tự chọn" });
  expect(data.sections).toHaveLength(1);
  expect(data.sections[0].metadata.map(([label]) => label)).not.toContain("Tìm kiếm");
  expect(data.sections[0].metadata.map(([label]) => label)).not.toContain("Trạng thái lọc");
  expect(data.sections[0].rows).toHaveLength(1);
  expect(progressMetadataRows({ metadata: [["Lớp", "CNTT 2026.1.1"], ["Trạng thái lọc", "Tất cả"], ["Tìm kiếm", "Tất cả"]] }))
    .toEqual([[["Lớp", "CNTT 2026.1.1"]]]);
});

it("exports Word using the reference font, A4 geometry, black table and sign-off for every class", async () => {
  const zip = await JSZip.loadAsync(await bytes(await createReportWord(report())));
  const xml = await zip.file("word/document.xml").async("string");
  expect(xml).toContain('w:w="11910"');
  expect(xml).toContain('w:h="16840"');
  expect(xml).toContain('w:ascii="Times New Roman"');
  expect(xml).toContain('w:color="000000"');
  for (const label of ["THEO DÕI TIẾN ĐỘ HỌC TẬP", ...groups.map(group => group.code), "Hoàn thành 0/18", "CHUYÊN VIÊN", "VIỆN TRƯỞNG VIỆN ĐTSĐH", "Hải Phòng, ngày 03/11/2026"]) expect(xml).toContain(label);
  expect(xml).not.toContain("Điểm trung bình");
  expect(xml).not.toContain("BỘ XÂY DỰNG");
  expect(xml).toContain(`w:w="${PROGRESS_FORM_WIDTHS[1]}"`);
});

it("exports a worksheet for every class with the same form fields and a complete table", async () => {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await bytes(await createReportExcel(report())));
  expect(book.worksheets).toHaveLength(2);
  const sheet = book.worksheets[0];
  expect(sheet.getCell("A3").value).toBe("THEO DÕI TIẾN ĐỘ HỌC TẬP");
  const values = [];
  sheet.eachRow(row => row.eachCell(cell => { values.push(cell.value); }));
  expect(values).toContain("Hoàn thành 0/18");
  expect(values).toContain("CHUYÊN VIÊN");
  const header = sheet.getRow(11);
  const logicalCells = row => {
    const cells = [];
    row.eachCell(cell => { if (!cell.isMerged || cell.master.address === cell.address) cells.push(cell); });
    return cells;
  };
  expect(logicalCells(header).map(cell => cell.value)).toEqual(report().sections[0].headers);
  expect(logicalCells(sheet.getRow(13))[3].value).toBe(0);
  expect(sheet.getCell("A11").fill?.fgColor).toBeUndefined();
  expect(values).not.toContain("Trạng thái lọc");
  expect(values).not.toContain("Tìm kiếm");
});
