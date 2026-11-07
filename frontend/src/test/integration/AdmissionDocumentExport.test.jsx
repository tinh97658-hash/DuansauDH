import { renderWithPermissions } from "../renderWithPermissions";
import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TextEncoder } from "util";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import axios from "axios";
import { toast } from "react-toastify";
import AdmissionRecordDetail from "../../pages/plan/admissionRecordDetail";
import AdmissionRecords from "../../pages/plan/admissionRecords";
import AdmissionPreview from "../../features/admission/AdmissionPreview";
import AdmissionPrintTemplate from "../../features/admission/AdmissionPrintTemplate";
import { buildAdmissionDocument } from "../../features/admission/admissionDocument";
import { createAdmissionWord, openAdmissionPreview, readAdmissionPreview } from "../../features/admission/admissionDocumentExport";

const render = (ui, options) => renderWithPermissions(ui, ["admission.manage"], options);

vi.mock("axios", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), isCancel: vi.fn(() => false), defaults: {} } }));
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });
jest.mock("react-toastify", () => ({ ToastContainer: () => null, toast: { success: jest.fn(), error: jest.fn() } }));

jest.setTimeout(20000);
const major = { id: "major", name: "Khoa học máy tính", program: "masters" };
const record = {
  id: "record", code: "HV001", fullName: "Nguyễn Văn An", trainingLevel: "Thạc sĩ", academicYear: "2026",
  majorId: major.id, majorName: major.name, major, dob: "1995-02-03", gender: "Nam", idCard: "0123456789",
  phone: "0901234567", email: "an@example.test", pob: "Hải Phòng", ward: "Phường A", city: "Thành phố Hải Phòng",
  nationality: "Việt Nam", ethnicity: "Kinh", trainingModeGroup: "Chính quy", trainingModeName: "Định hướng nghiên cứu",
  language: "Tiếng Việt", isExemptForeignLanguage: true, receiptType: "Trực tiếp", profileCategory: "Đầy đủ",
  studyStatus: "Đã trúng tuyển", admissionDate: "2026-09-01", gradSchool: "Trường Đại học Hàng hải Việt Nam",
  gradMajor: "Tin học", gradDegreeType: "Chính quy", gradYear: "2017", gpa: "8.2", gradClassification: "Giỏi",
  diplomaNumber: "D001", registryBookNumber: "S001", workplace: "Công ty A", job: "Kỹ sư", priorityObject: "Không",
  supplementSubjectsCount: 2, note: "Ghi chú hồ sơ", documents: { docDegree: true, docTranscript: true },
};
const bufferOf = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsArrayBuffer(blob);
});
const docxXml = async (blob) => {
  const zip = await JSZip.loadAsync(await bufferOf(blob));
  return new DOMParser().parseFromString(await zip.file("word/document.xml").async("string"), "application/xml");
};
let tab;
const originalEncoder = global.TextEncoder;
const originalCreateUrl = URL.createObjectURL;
const originalRevokeUrl = URL.revokeObjectURL;
beforeAll(() => { global.TextEncoder = TextEncoder; });
afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1100));
  global.TextEncoder = originalEncoder; URL.createObjectURL = originalCreateUrl; URL.revokeObjectURL = originalRevokeUrl;
});
beforeEach(() => {
  jest.clearAllMocks(); sessionStorage.clear(); localStorage.clear();
  tab = { sessionStorage: { setItem: jest.fn() }, location: { replace: jest.fn() }, close: jest.fn(), opener: window };
  jest.spyOn(window, "open").mockReturnValue(tab);
  jest.spyOn(window, "print").mockImplementation(() => {});
  URL.createObjectURL = jest.fn(() => "blob:admission"); URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  axios.get.mockImplementation(async (url) => {
    if (url.endsWith("/auth/isStaff")) return { data: { message: "admin" } };
    if (url.includes("/system/majors")) return { data: [major] };
    if (url.includes("/system/training-years")) return { data: [{ name: String(new Date().getFullYear()), active: true, startDate: "2000-01-01" }] };
    if (url.includes("/admission-records?")) return { data: { data: [record, { ...record, id: "other", code: "HV002", fullName: "Hồ sơ khác" }], pagination: { total: 2, totalPages: 1 }, stats: {} } };
    if (url.endsWith("/admission-records/record")) return { data: record };
    if (url.endsWith("/recognized-credits")) return { data: { credits: 0 } };
    return { data: [] };
  });
});
afterEach(() => jest.restoreAllMocks());
const previewUrl = () => tab.location.replace.mock.calls[0][0];
const previewId = () => new URL(previewUrl(), "http://localhost").searchParams.get("preview");
const mountPreview = (url = previewUrl()) => render(<MemoryRouter useTransitions={false} initialEntries={[url]}><AdmissionPreview /></MemoryRouter>);

it.each(["detail", "list"])("%s keeps every A4 field, checklist, headings and signatures identical in DOCX and PDF", async (variant) => {
  const data = buildAdmissionDocument(record, { variant, now: new Date(2026, 9, 8) });
  const xml = await docxXml(await createAdmissionWord(data));
  expect(xml.querySelector("parsererror")).toBeNull();
  render(<AdmissionPrintTemplate document={data} />);
  const sheet = screen.getByTestId("admission-document");
  for (const text of [...data.masthead, ...data.nationalHeading, data.displayCode, data.dateLine, data.title, data.subtitle, data.checklistTitle]) {
    expect(sheet).toHaveTextContent(text); expect(xml.documentElement.textContent).toContain(text);
  }
  for (const section of data.sections) {
    expect(sheet).toHaveTextContent(section.title); expect(xml.documentElement.textContent).toContain(section.title);
    for (const field of [...section.fields, ...(section.extra ? [section.extra] : [])]) {
      expect(sheet).toHaveTextContent(`${field.label} ${field.value}`);
      expect(xml.documentElement.textContent).toContain(`${field.label} ${field.uppercase ? field.value.toUpperCase() : field.value}`);
    }
  }
  for (const item of data.documents) {
    expect(sheet).toHaveTextContent(item.label);
    expect(xml.documentElement.textContent).toContain(`${item.checked ? "☑" : "☐"} ${item.label}`);
  }
  for (const item of data.signatures) {
    expect(sheet).toHaveTextContent(item.title); expect(xml.documentElement.textContent).toContain(item.title);
  }
  const page = xml.getElementsByTagName("w:pgSz")[0];
  expect(Number(page.getAttribute("w:w"))).toBeLessThan(Number(page.getAttribute("w:h")));
  const margins = xml.getElementsByTagName("w:pgMar")[0];
  expect(["top", "bottom", "left", "right"].map(side => Number(margins.getAttribute(`w:${side}`)))).toEqual([1134, 1134, 1701, 850]);
  const sectionHeading = [...xml.getElementsByTagName("w:p")].find(p => p.textContent === data.sections[2].title);
  expect([...sectionHeading.getElementsByTagName("w:pageBreakBefore")].every(node=>node.getAttribute("w:val")==="false")).toBe(true);
  const mainField = [...xml.getElementsByTagName("w:p")].find(p => p.textContent === `${data.sections[1].fields[0].label} ${data.sections[1].fields[0].value}`);
  expect([...mainField.getElementsByTagName("w:sz")].map(size => size.getAttribute("w:val"))).toEqual(["21", "21"]);
  for (const paragraph of [...xml.getElementsByTagName("w:p")].filter(p=>p.textContent.trim())) {
    const spacing=paragraph.getElementsByTagName("w:spacing")[0];
    expect(Number(spacing.getAttribute("w:after"))).toBeGreaterThanOrEqual(60);
  }
  const header=xml.getElementsByTagName("w:tbl")[0];
  const rules=[...header.getElementsByTagName("w:p")].filter(p=>p.getElementsByTagName("w:pBdr").length);
  expect(rules).toHaveLength(2);
  rules.forEach((rule,index)=>{
    const indent=rule.getElementsByTagName("w:ind")[0];
    expect([4620,4734][index]-Number(indent.getAttribute("w:left"))-Number(indent.getAttribute("w:right"))).toBe(1814);
  });
  expect([...header.getElementsByTagName("w:gridCol")].map(col=>col.getAttribute("w:w"))).toEqual(["4620","4734"]);
  const school=[...header.getElementsByTagName("w:p")].find(p=>p.textContent===data.masthead[1]);
  expect(school.getElementsByTagName("w:sz")[0].getAttribute("w:val")).toBe("24");
  for (const [index,text] of data.nationalHeading.entries()) {
    const paragraph=[...header.getElementsByTagName("w:p")].find(p=>p.textContent===text);
    expect(paragraph.getElementsByTagName("w:sz")[0].getAttribute("w:val")).toBe(index===0?"24":"26");
  }
  for (const [text,size] of [[data.masthead[2],"24"],[data.title,"28"]]) {
    const paragraph=[...xml.getElementsByTagName("w:p")].find(p=>p.textContent===text);
    expect(paragraph.getElementsByTagName("w:sz")[0].getAttribute("w:val")).toBe(size);
    expect(paragraph.getElementsByTagName("w:b")).toHaveLength(1);
  }
});

it("embeds the existing profile photo in a genuine DOCX", async () => {
  const photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6i0AAAAASUVORK5CYII=";
  const data = buildAdmissionDocument({ ...record, photo });
  const zip = await JSZip.loadAsync(await bufferOf(await createAdmissionWord(data)));
  expect(Object.keys(zip.files).some((name) => /^word\/media\/.*\.png$/.test(name))).toBe(true);
  render(<AdmissionPrintTemplate document={data} />);
  expect(screen.getByAltText("Ảnh 3x4")).toHaveAttribute("src", photo);
  const personal = document.querySelector(".admission-sheet-personal");
  expect(personal.firstElementChild).toHaveTextContent(data.sections[0].title);
  expect(personal.lastElementChild).toContainElement(screen.getByAltText("Ảnh 3x4"));
  const xml = await docxXml(await createAdmissionWord(data));
  const photoCell = Array.from(xml.getElementsByTagName("w:tc")).find(cell => cell.getElementsByTagName("w:drawing").length);
  expect(photoCell.parentNode.lastElementChild).toBe(photoCell);
  const rightMargin=photoCell.getElementsByTagName("w:tcMar")[0].getElementsByTagName("w:right")[0];
  expect(rightMargin.getAttribute("w:w")).toBe("0");
  expect(photoCell.parentNode.getElementsByTagName("w:tc")[0].textContent).toContain(data.sections[0].title);
  expect(Array.from(xml.getElementsByTagName("w:color")).every(color => color.getAttribute("w:val") === "000000")).toBe(true);
});

it("preserves snapshots and their dates across previews and reloads, printing only on request", () => {
  const firstData = buildAdmissionDocument(record, { now: new Date(2026, 9, 8) });
  openAdmissionPreview(firstData);
  const firstUrl = previewUrl(); const firstId = previewId();
  expect(window.open).toHaveBeenCalledWith("about:blank", "_blank"); expect(tab.opener).toBeNull();
  expect(JSON.parse(tab.sessionStorage.setItem.mock.calls[0][1])).toEqual(firstData);
  openAdmissionPreview(buildAdmissionDocument({ ...record, fullName: "Hồ sơ khác" }));
  expect(readAdmissionPreview(firstId)).toEqual(firstData);
  const view = mountPreview(firstUrl);
  expect(screen.getByTestId("admission-document")).toHaveTextContent(record.fullName);
  expect(screen.getAllByRole("button")).toHaveLength(1); expect(window.print).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "In / Lưu PDF" }));
  expect(window.print).toHaveBeenCalledTimes(1);
  view.unmount(); mountPreview(firstUrl);
  expect(screen.getByTestId("admission-document")).toHaveTextContent(firstData.dateLine);
  expect(screen.queryByText("Hồ sơ khác")).not.toBeInTheDocument();
});

it("reports corrupt/missing snapshot data instead of fetching a different record", () => {
  sessionStorage.setItem("admission-preview:bad", '{"version":1}');
  expect(readAdmissionPreview("bad")).toBeNull();
  mountPreview("/plan/admission-records/preview?preview=bad");
  expect(screen.getByRole("alert")).toHaveTextContent("Không tìm thấy dữ liệu xem trước");
  expect(axios.get).not.toHaveBeenCalled();
});

it.each(["applications", "admitted-masters"])("%s list keeps the relevant row actions without document export", async (mode) => {
  render(<MemoryRouter useTransitions={false}><AdmissionRecords mode={mode} /></MemoryRouter>);
  await screen.findAllByText(record.email);
  expect(screen.queryByRole("button", { name: /In \/ Xuất/ })).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: /^Sửa hồ sơ / })).toHaveLength(2);
  expect(screen.queryByRole("button", { name: "Xóa hồ sơ" })).not.toBeInTheDocument();
  expect(window.open).not.toHaveBeenCalled();
  expect(axios.put).not.toHaveBeenCalled(); expect(axios.post).not.toHaveBeenCalled();
});

it("both detail dropdowns export the CV in Word or PDF and preserve the current unsaved form", async () => {
  render(<MemoryRouter useTransitions={false} initialEntries={["/plan/admission-records/record"]}><Routes><Route path="/plan/admission-records/:id" element={<AdmissionRecordDetail />} /></Routes></MemoryRouter>);
  await screen.findByDisplayValue(record.fullName);
  const input = screen.getByDisplayValue(record.fullName);
  fireEvent.change(input, { target: { value: "Tên đang chỉnh sửa" } });
  const triggers = screen.getAllByRole("button", { name: "Xuất báo cáo", exact: true });
  expect(triggers).toHaveLength(2);
  for (const [index, trigger] of triggers.entries()) {
    fireEvent.click(trigger);
    expect(screen.getAllByRole("menuitem")).toHaveLength(2);
    expect(screen.queryByRole("menuitem", { name: "Excel (.xlsx)" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "PDF (.pdf)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Word (.docx)" }));
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(index + 1), { timeout: 10000 });
    const xml = await docxXml(URL.createObjectURL.mock.calls[index][0]);
    expect(xml.documentElement.textContent).toContain("TÊN ĐANG CHỈNH SỬA");
    await waitFor(() => expect(trigger).toBeEnabled());
  }
  expect(window.open).not.toHaveBeenCalled(); expect(sessionStorage.length).toBe(0);
  fireEvent.click(triggers[0]);
  fireEvent.click(screen.getByRole("menuitem", { name: "PDF (.pdf)" }));
  await waitFor(() => expect(window.open).toHaveBeenCalledTimes(1));
  expect(readAdmissionPreview(previewId()).fullName).toBe("Tên đang chỉnh sửa");
  expect(input).toHaveValue("Tên đang chỉnh sửa"); expect(window.print).not.toHaveBeenCalled();
  expect(axios.put).not.toHaveBeenCalled(); expect(axios.post).not.toHaveBeenCalled();
});

it.each(["applications", "admitted-masters"])("exports %s only as Excel with every field on the same learner row", async mode => {
  const admitted = mode === "admitted-masters";
  const exportedRecords = [
    { ...record, assignedGroup: { code: "CNTT 2026.1.1" }, major: null, majorName: "Công nghệ thông tin", extraData: { tuitionPayment: { paid: true } } },
    { ...record, id: "other", code: "HV002", assignedGroup: { code: "CNTT 2026.1.2" }, extraData: { tuitionPayment: { paid: false } } },
  ];
  const originalGet = axios.get.getMockImplementation();
  axios.get.mockImplementation(async (url, options) => {
    if (url.includes("/admission-records?")) {
      const page = Number(new URL(url, "http://localhost").searchParams.get("page") || 1);
      return { data: { data: [exportedRecords[page - 1]], pagination: { total: 2, totalPages: 2 }, stats: {} } };
    }
    return originalGet(url, options);
  });
  render(<MemoryRouter useTransitions={false}><AdmissionRecords mode={mode} embedded /></MemoryRouter>);
  await screen.findAllByText(record.email);
  await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
  const trigger = screen.getByRole("button", { name: "Xuất báo cáo", exact: true });
  await waitFor(() => expect(trigger).toBeEnabled());
  fireEvent.click(trigger);
  expect(screen.getAllByRole("menuitem")).toHaveLength(1);
  fireEvent.click(screen.getByRole("menuitem", { name: "Excel (.xlsx)" }));
  await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1), { timeout: 10000 });
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await bufferOf(URL.createObjectURL.mock.calls[0][0]));
  expect(book.worksheets).toHaveLength(1);
  const sheet = book.worksheets[0];
  const logicalValues = row => {
    const values = [];
    row.eachCell(cell => { if (!cell.isMerged || cell.master.address === cell.address) values.push(cell.value); });
    return values;
  };
  let header;
  const exportedRows = [];
  sheet.eachRow(row => {
    const values = logicalValues(row);
    if (values[0] === "STT") header = values;
    if (typeof values[0] === "number") exportedRows.push(values);
    expect(values.some(value => typeof value === "string" && /Phần \d+\//.test(value))).toBe(false);
  });
  expect(header).toEqual(["STT", "Mã HV", ...(admitted ? ["Mã nhóm"] : []), "Họ đệm", "Tên", "Email", "Ngày sinh", "Giới tính", "Số CMND/CCCD", "Năm nhập học", "Trình độ", "Ngành", "Điện thoại", ...(admitted ? ["Học phí"] : []), "Trạng thái"]);
  expect(exportedRows).toEqual(exportedRecords.map((row, index) => [
    index + 1, row.code, ...(admitted ? [row.assignedGroup.code] : []), "Nguyễn Văn", "An", row.email, "03/02/1995", row.gender, row.idCard,
    row.academicYear, row.trainingLevel, row.majorName, row.phone, ...(admitted ? [index === 0 ? "Đã nộp" : "Chưa nộp"] : []), row.studyStatus,
  ]));
  expect(axios.get.mock.calls.some(([url]) => url.includes("/admission-records?") && new URL(url, "http://localhost").searchParams.get("page") === "2")).toBe(true);
  expect(window.open).not.toHaveBeenCalled();
});
