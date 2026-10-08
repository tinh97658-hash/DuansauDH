import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { TextEncoder } from "util";
import Schedule from "../../features/scheduling/Schedule";
import SchedulePreview from "../../features/scheduling/SchedulePreview";
import SchedulePrintTemplate from "../../features/scheduling/SchedulePrintTemplate";
import { buildScheduleDocument, createScheduleExcel, createScheduleWord, exportSchedule, readSchedulePreview, readScheduleReturnView, scheduleDocumentColumns, scheduleExportRows } from "../../features/scheduling/scheduleExport";

jest.mock("axios");
jest.mock("@mui/material", () => ({ Dialog: ({ children, open }) => open ? <div>{children}</div> : null }));
const snapshot = {
  week: "2026-10-05", end: "2026-10-11", discipline: "Công nghệ thông tin",
  major: "Khoa học máy tính", year: "2026",
  rows: [[1, "05/10/2026", "Sáng", "Công nghệ thông tin", "Khoa học máy tính", "Cơ sở dữ liệu",
    "CNTT-2026", "Nguyễn An", "A101", "Ghi chú tiếng Việt"]],
};
const specificHeaders = ["STT", "Ngày học", "Buổi", "Học phần", "Lớp", "Giảng viên", "Phòng", "Ghi chú"];
const specificValues = [1, "05/10/2026", "Sáng", "Cơ sở dữ liệu", "CNTT-2026", "Nguyễn An", "A101", "Ghi chú tiếng Việt"];
const bufferOf = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsArrayBuffer(blob);
});
let tab;
const originalRevokeUrl = URL.revokeObjectURL;
const originalTextEncoder = global.TextEncoder;
beforeAll(() => { URL.revokeObjectURL = jest.fn(); global.TextEncoder = TextEncoder; });
afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1100));
  URL.revokeObjectURL = originalRevokeUrl;
  global.TextEncoder = originalTextEncoder;
});
beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  tab = { sessionStorage: { setItem: jest.fn() }, location: { replace: jest.fn() }, opener: window, close: jest.fn() };
  jest.spyOn(window, "open").mockReturnValue(tab);
  jest.spyOn(window, "print").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
const previewUrl = () => tab.location.replace.mock.calls[tab.location.replace.mock.calls.length - 1][0];
const previewId = () => new URL(previewUrl(), "http://localhost").searchParams.get("preview");
const renderPreview = () => render(<MemoryRouter initialEntries={[previewUrl()]}><SchedulePreview /></MemoryRouter>);

it("opens an isolated snapshot in a new tab, keeps each export and survives remount/reload", () => {
  exportSchedule(snapshot);
  const firstId = previewId();
  expect(window.print).not.toHaveBeenCalled();
  expect(window.open).toHaveBeenCalledWith("about:blank", "_blank");
  expect(tab.opener).toBeNull();
  expect(JSON.parse(tab.sessionStorage.setItem.mock.calls[0][1])).toMatchObject(snapshot);
  exportSchedule({ ...snapshot, week: "2026-10-12", rows: [] });
  expect(readSchedulePreview(firstId)).toMatchObject(snapshot);
  expect(readSchedulePreview(previewId()).rows).toEqual([]);
});

it("shows the existing document without system navigation, and only prints when In is clicked", () => {
  exportSchedule(snapshot);
  const first = renderPreview();
  expect(screen.getByText("BỘ XÂY DỰNG")).toBeInTheDocument();
  expect(screen.getByText("LỊCH HỌC SAU ĐẠI HỌC")).toBeInTheDocument();
  expect(screen.getByText("Tuần từ 05/10/2026 đến 11/10/2026")).toBeInTheDocument();
  expect(screen.getByText("Tổng số: 1 buổi học")).toBeInTheDocument();
  expect(screen.getByRole("table")).toHaveTextContent("Cơ sở dữ liệu");
  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect(window.print).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "In / Lưu PDF", exact: true }));
  expect(window.print).toHaveBeenCalledTimes(1);
  first.unmount();
  renderPreview();
  expect(screen.getByRole("table")).toHaveTextContent("Ghi chú tiếng Việt");
});

it("reports missing or corrupt preview data instead of loading another week", () => {
  window.sessionStorage.setItem("schedule-preview:bad", "{");
  expect(readSchedulePreview("bad")).toBeNull();
  render(<MemoryRouter initialEntries={["/masters/schedule/preview?preview=bad"]}><SchedulePreview /></MemoryRouter>);
  expect(screen.getByRole("alert")).toHaveTextContent("Không tìm thấy dữ liệu xem trước");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(axios.get).not.toHaveBeenCalled();
});

it("reloads an older preview snapshot using the current document columns", () => {
  const legacy = { ...snapshot, version: 1, rows: [[1, "05/10/2026", "Sáng", "08:00 - 11:00", "00123", "Cơ sở dữ liệu", "SEED_TEST_2026: MERGED",
    "CNTT-2026", snapshot.discipline, snapshot.major, "Nguyễn An", "A101", 30, "Đã xếp", "Ghi chú tiếng Việt"]] };
  sessionStorage.setItem("schedule-preview:older", JSON.stringify(legacy));
  expect(readSchedulePreview("older").rows).toEqual(snapshot.rows);
});

it("joins the existing major catalog to every participating class and synchronizes document scope without changing filters", () => {
  const first = { id: "first", name: "Tất cả vẫn là tên chuyên ngành", disciplineId: "parent-a", discipline: { id: "parent-a", name: "Ngành A" } };
  const second = { id: "second", name: "Chuyên ngành B", disciplineId: "parent-b", discipline: { id: "parent-b", name: "Ngành B" } };
  const sessions = [{ sessionDate: "2026-10-05", period: "MORNING", startTime: "07:00", endTime: "12:00", status: "planned", note: "Ghi chú buổi học",
    lecturer: { name: "Nguyễn An" }, room: { name: "Phòng thực hành" }, courseOffering: { name: "SEED_TEST_2026: MERGED", subject: { name: "Học phần ghép", majorId: first.id }, groupLinks: [
      { classGroup: { code: "LOP 2026.1", majorId: first.id, major: { id: first.id, name: first.name } } },
      { classGroup: { code: "LOP 2026.2", majorId: second.id, major: { id: second.id, name: second.name } } },
    ] } }];
  const inputs = { ...snapshot, disciplineId: "", majorId: first.id, majors: [first, second], sessions };
  const before = JSON.stringify(inputs);
  const data = buildScheduleDocument(inputs);
  expect(data).toMatchObject({ disciplineId: "parent-a", discipline: "Ngành A", major: first.name, majorId: first.id });
  expect(data.rows).toEqual([[1, "05/10/2026", "Sáng", "Ngành A, Ngành B", `${first.name}, ${second.name}`, "Học phần ghép", "LOP 2026.1, LOP 2026.2", "Nguyễn An", "Phòng thực hành", "Ghi chú buổi học"]]);
  expect(scheduleDocumentColumns(data).map((column) => column.label)).toEqual(specificHeaders);
  expect(JSON.stringify(inputs)).toBe(before);
  expect(JSON.stringify(data.rows)).not.toMatch(/SEED_TEST_2026|07:00|12:00|planned/);
});

it("creates a readable XLSX with the scope, current columns and unchanged values", async () => {
  const blob = await createScheduleExcel(snapshot);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await bufferOf(blob));
  const sheet = book.getWorksheet("Lịch học");
  expect(sheet.getCell("A4").value).toBe("LỊCH HỌC SAU ĐẠI HỌC");
  expect(sheet.getCell("A1").value).toBe("BỘ XÂY DỰNG");
  expect(sheet.getCell("F1").value).toBe("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM");
  expect(sheet.getCell("F2").value).toBe("Độc lập - Tự do - Hạnh phúc");
  expect(sheet.getCell("F1").alignment.horizontal).toBe("center");
  expect(sheet.getCell("A5").value).toBe("Tuần từ 05/10/2026 đến 11/10/2026");
  expect(sheet.getCell("A6").value).toBe(`Ngành: ${snapshot.discipline}`);
  expect(sheet.getCell("A7").value).toBe(`Chuyên ngành: ${snapshot.major}`);
  expect(sheet.getCell("A8").value).toBe("Khóa / Năm học: 2026");
  expect(sheet.getRow(10).values.slice(1)).toEqual(specificHeaders);
  expect(sheet.getRow(11).values.slice(1)).toEqual(specificValues);
  expect(sheet.pageSetup.orientation).toBe("landscape");
  expect(sheet.getCell("A12").value).toBe("Tổng số: 1 buổi học");
  expect(sheet.getCell("F11").font.name).toBe("Times New Roman");
  expect(sheet.getCell("F11").alignment.wrapText).toBe(true);
  expect(sheet.getCell("B11").alignment.wrapText).not.toBe(true);
  expect(sheet.getColumn(4).width).toBeGreaterThanOrEqual(30);
  expect(sheet.getColumn(2).width).toBeGreaterThanOrEqual(12);
  expect(sheet.views[0].ySplit).toBe(10);
  expect(sheet.autoFilter).toBe("A10:H11");
  expect(sheet.model.merges).toEqual(expect.arrayContaining(["A1:E1", "F1:H1", "A4:H4", "A12:H12"]));
  expect(sheet.getCell("A12").alignment.horizontal).toBe("right");
  expect(sheet.getCell("D10").border.bottom.style).toBe("thin");
  expect(sheet.getCell("D11").border.bottom.style).toBe("thin");
  expect(sheet.getCell("D10").fill.fgColor.argb).toBe("FFEAF1F6");
  expect(sheet.getCell("D10").alignment).toMatchObject({ horizontal: "center", vertical: "middle" });
  expect(sheet.pageSetup).toMatchObject({ paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "10:10", printArea: "A1:H12" });
  expect(sheet.pageSetup.margins.left).toBeCloseTo(0.3);
  expect(sheet.model.merges.some((range) => /\b[A-Z]+1[01]\b/.test(range))).toBe(false);
});

it("creates a genuine DOCX with the official headings, scope, full table and A4 landscape", async () => {
  const blob = await createScheduleWord(snapshot);
  const zip = await JSZip.loadAsync(await bufferOf(blob));
  const xml = await zip.file("word/document.xml").async("string");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  expect(doc.querySelector("parsererror")).toBeNull();
  expect(doc.documentElement.textContent).toContain("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM");
  expect(doc.documentElement.textContent).toContain("Tuần từ 05/10/2026 đến 11/10/2026");
  expect(doc.documentElement.textContent).toContain(`Chuyên ngành: ${snapshot.major}`);
  expect(doc.documentElement.textContent).toContain("Khóa / Năm học: 2026");
  const tables = doc.getElementsByTagName("w:tbl");
  expect(tables).toHaveLength(2);
  const dataRows = tables[1].getElementsByTagName("w:tr");
  const cells = Array.from(dataRows[1].getElementsByTagName("w:tc"), (cell) => cell.textContent);
  expect(cells).toHaveLength(8);
  expect(cells).toEqual(specificValues.map(String));
  expect(Array.from(dataRows[0].getElementsByTagName("w:tc"), (cell) => cell.textContent)).toEqual(specificHeaders);
  const widths = Array.from(tables[1].getElementsByTagName("w:gridCol"), (column) => Number(column.getAttribute("w:w")));
  expect(widths).toHaveLength(8);
  expect(widths.reduce((sum, width) => sum + width, 0)).toBe(16838 - 908);
  expect(tables[1].getElementsByTagName("w:tblLayout")[0].getAttribute("w:type")).toBe("fixed");
  expect(Array.from(tables[1].getElementsByTagName("w:sz")).every((size) => size.getAttribute("w:val") === "21")).toBe(true);
  const page = doc.getElementsByTagName("w:pgSz")[0];
  expect(page.getAttribute("w:orient")).toBe("landscape");
  expect(Number(page.getAttribute("w:w"))).toBeGreaterThan(Number(page.getAttribute("w:h")));
});

it.each([
  ["all scopes", "Tất cả ngành", "Tất cả chuyên ngành", ["Ngành", "Chuyên ngành"], [3, 4]],
  ["one discipline", snapshot.discipline, "Tất cả chuyên ngành", ["Chuyên ngành"], [4]],
  ["one major", snapshot.discipline, snapshot.major, [], []],
  ["one major without a discipline filter", "Tất cả ngành", snapshot.major, [], []],
])("uses the same ordered columns for %s in Preview, Word and Excel", async (_, discipline, major, scopeHeaders, scopeIndices) => {
  const row = [...snapshot.rows[0]];
  row[6] = "CNTT 2025.1.1, CNTT 2025.2.1";
  row[4] = "Khoa học máy tính, Hệ thống thông tin";
  const schedule = { ...snapshot, discipline, major, rows: [row] };
  const expectedHeaders = [...specificHeaders.slice(0, 3), ...scopeHeaders, ...specificHeaders.slice(3)];
  const expectedValues = [0, 1, 2, ...scopeIndices, 5, 6, 7, 8, 9].map((index) => row[index]);
  const { container } = render(<SchedulePrintTemplate schedule={schedule} />);
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(expectedHeaders);
  expect(within(table).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(expectedValues.map(String));
  for (const value of ["00123", "SEED_TEST_2026: MERGED", "Đã xếp", "08:00 - 11:00"]) expect(table).not.toHaveTextContent(value);
  expect(container.querySelector(".sl-print-scope")).toHaveTextContent(major);
  expect(container.querySelector(".sl-print-scope")).toHaveTextContent(discipline);
  expect(container.querySelector(".sl-print-scope")).toHaveTextContent("2026");
  const zip = await JSZip.loadAsync(await bufferOf(await createScheduleWord(schedule)));
  const doc = new DOMParser().parseFromString(await zip.file("word/document.xml").async("string"), "application/xml");
  const wordTable = doc.getElementsByTagName("w:tbl")[1];
  const wordRows = wordTable.getElementsByTagName("w:tr");
  expect(Array.from(wordRows[0].getElementsByTagName("w:tc"), (cell) => cell.textContent)).toEqual(expectedHeaders);
  expect(Array.from(wordRows[1].getElementsByTagName("w:tc"), (cell) => cell.textContent)).toEqual(expectedValues.map(String));
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await bufferOf(await createScheduleExcel(schedule)));
  const sheet = book.getWorksheet("Lịch học");
  expect(sheet.getRow(10).values.slice(1)).toEqual(expectedHeaders);
  expect(sheet.getRow(11).values.slice(1)).toEqual(expectedValues);
  expect(schedule.rows[0]).toEqual(row);
});

it("uses every actual ClassGroup and its Major/Discipline without exposing the internal offering name", () => {
  const major = { name: "Khoa học máy tính", discipline: { name: "Công nghệ thông tin" } };
  const sessions = [{
    sessionDate: "2026-10-05", period: "MORNING", status: "planned", startTime: "07:00", endTime: "12:00",
    lecturer: { name: "Nguyễn An" }, room: { code: "A101" }, note: "Lịch học ghép",
    courseOffering: { name: "SEED_TEST_2026: MERGED", subject: { name: "Cơ sở dữ liệu", code: "CS01", major },
      groupLinks: [{ classGroup: { code: "CNTT 2025.1.1", major } }, { classGroup: { name: "CNTT 2025.2.1", major } }] },
  }];
  const schedule = { ...snapshot, discipline: "Tất cả ngành", major: "Tất cả chuyên ngành", year: "Tất cả", rows: scheduleExportRows(sessions) };
  render(<SchedulePrintTemplate schedule={schedule} />);
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
    "1", "05/10/2026", "Sáng", "Công nghệ thông tin", "Khoa học máy tính", "Cơ sở dữ liệu", "CNTT 2025.1.1, CNTT 2025.2.1", "Nguyễn An", "A101", "Lịch học ghép",
  ]);
  expect(table).not.toHaveTextContent("SEED_TEST_2026: MERGED");
});

it("handles empty schedules in preview and both document formats", async () => {
  const empty = { ...snapshot, rows: [] };
  exportSchedule(empty);
  renderPreview();
  expect(screen.getByRole("table")).toHaveTextContent("Không có lịch học trong phạm vi đã chọn.");
  expect(screen.getByText("Tổng số: 0 buổi học")).toBeInTheDocument();
  for (const create of [createScheduleExcel, createScheduleWord]) {
    expect((await create(empty)).size).toBeGreaterThan(100);
  }
});

it.each(["Xuất Word", "Xuất Excel", "Xuất PDF"])("%s uses the selected week, discipline, major and year without changing scheduling", async (format) => {
  const discipline = { id: "discipline", name: snapshot.discipline };
  const major = { id: "major", name: snapshot.major, disciplineId: discipline.id, discipline };
  const group = { id: "group", code: "CNTT-2026", academicYear: "2026", majorId: major.id, major };
  const offering = { id: "offering", status: "active", subject: { code: "CS01", name: "Cơ sở dữ liệu", major }, groupLinks: [{ classGroup: group }] };
  const other = { ...offering, id: "other", subject: { code: "OTHER", name: "Ngoài phạm vi" }, groupLinks: [{ classGroup: { ...group, majorId: "other-major" } }] };
  axios.get.mockImplementation(async (url) => ({ data: url.includes("/system/majors") ? [major]
    : url.includes("/course-offerings?") ? [offering, other]
      : url.includes("/teaching-sessions?") ? [offering, other].map((courseOffering, index) => ({
        id: `session-${index}`, courseOffering, sessionDate: new URL(url, "http://localhost").searchParams.get("from"),
        period: "MORNING", status: "planned", startTime: "08:00", endTime: "11:00",
      })) : [] }));
  const mounted = render(<MemoryRouter><Schedule user={{ canManageScheduling: false }} /></MemoryRouter>);
  await waitFor(() => expect(screen.getByRole("button", { name: "In / Xuất lịch học" })).toBeEnabled());
  fireEvent.focus(screen.getByRole("combobox", { name: "Ngành" }));
  fireEvent.click(screen.getByRole("option", { name: snapshot.discipline }));
  fireEvent.focus(screen.getByRole("combobox", { name: "Chuyên ngành" }));
  fireEvent.click(screen.getByRole("option", { name: snapshot.major }));
  fireEvent.change(screen.getByLabelText("Khóa / Năm"), { target: { value: "2026" } });
  fireEvent.click(screen.getByRole("button", { name: "Tuần sau" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "In / Xuất lịch học" })).toBeEnabled());
  const previous = URL.createObjectURL;
  const createUrl = jest.fn(() => "blob:schedule");
  URL.createObjectURL = createUrl;
  const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  fireEvent.click(screen.getByRole("button", { name: "In / Xuất lịch học" }));
  const menu = screen.getByRole("menu");
  expect(within(menu).getAllByRole("menuitem").map((item) => item.querySelector("span").textContent)).toEqual(["Xuất Word", "Xuất Excel", "Xuất PDF"]);
  within(menu).getAllByRole("menuitem").forEach((item, index) => {
    expect(item.querySelector("svg")).toHaveClass(`document-export-icon-${["word", "excel", "pdf"][index]}`);
    expect(item.querySelector("svg")).toHaveAttribute("width", "20");
  });
  expect(window.open).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("menuitem", { name: format }));
  let data;
  if (format === "Xuất PDF") {
    data = readSchedulePreview(previewId());
    expect(click).not.toHaveBeenCalled();
  } else {
    try {
      await waitFor(() => expect(click).toHaveBeenCalledTimes(1), { timeout: 10000 });
      expect(window.open).not.toHaveBeenCalled();
      expect(window.sessionStorage.length).toBe(0);
      const blob = createUrl.mock.calls[0][0];
      let text;
      if (format === "Xuất Excel") {
        const book = new ExcelJS.Workbook();
        await book.xlsx.load(await bufferOf(blob));
        const sheet = book.getWorksheet("Lịch học");
        text = JSON.stringify(sheet.getSheetValues());
        expect(sheet.getRow(10).values.slice(1)).toEqual(specificHeaders);
        expect(click.mock.instances[0].download).toMatch(/^lich-hoc-.*\.xlsx$/);
      } else {
        const zip = await JSZip.loadAsync(await bufferOf(blob));
        text = await zip.file("word/document.xml").async("string");
        expect(click.mock.instances[0].download).toMatch(/^lich-hoc-.*\.docx$/);
      }
      expect(text).toContain("Cơ sở dữ liệu");
      expect(text).not.toContain("Ngoài phạm vi");
      expect(text).toContain("Khóa / Năm học:");
      await waitFor(() => expect(screen.getByRole("button", { name: "In / Xuất lịch học" })).toBeEnabled());
    } finally { URL.createObjectURL = previous; }
  }
  URL.createObjectURL = previous;
  const lastQuery = new URL(axios.get.mock.calls.filter(([url]) => url.includes("/teaching-sessions?" )).pop()[0], "http://localhost").searchParams;
  if (format === "Xuất PDF") expect(data).toMatchObject({ week: lastQuery.get("from"), end: lastQuery.get("to"), discipline: snapshot.discipline, major: snapshot.major, year: "2026" });
  if (format === "Xuất PDF") { expect(data.rows).toHaveLength(1); expect(data.rows[0][5]).toBe("Cơ sở dữ liệu"); expect(data.rows[0]).toHaveLength(10); }
  expect(window.print).not.toHaveBeenCalled();
  expect(axios.post).not.toHaveBeenCalled();
  expect(axios.put).not.toHaveBeenCalled();
  expect(within(screen.getByRole("table", { name: "Lịch học theo tuần" })).getAllByRole("button", { name: /Cơ sở dữ liệu/ })).toHaveLength(1);
  if (format === "Xuất PDF") {
    expect(readScheduleReturnView()).toMatchObject({ disciplineId: discipline.id, majorId: major.id, year: "2026", week: lastQuery.get("from") });
    mounted.unmount();
    render(<MemoryRouter><Schedule user={{ canManageScheduling: false }} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole("button", { name: "In / Xuất lịch học" })).toBeEnabled());
    expect(screen.getByRole("combobox", { name: "Ngành" })).toHaveValue(discipline.name);
    expect(screen.getByRole("combobox", { name: "Chuyên ngành" })).toHaveValue(major.name);
    expect(screen.getByLabelText("Khóa / Năm")).toHaveValue("2026");
    expect(readScheduleReturnView()).toBeNull();
    const restoredQuery = new URL(axios.get.mock.calls.filter(([url]) => url.includes("/teaching-sessions?")).pop()[0], "http://localhost");
    expect(restoredQuery.searchParams.get("from")).toBe(lastQuery.get("from"));
  }
});
