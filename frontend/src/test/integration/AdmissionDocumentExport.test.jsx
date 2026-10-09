import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TextEncoder } from "util";
import JSZip from "jszip";
import axios from "axios";
import { toast } from "react-toastify";
import AdmissionRecordDetail from "../../pages/plan/admissionRecordDetail";
import AdmissionRecords from "../../pages/plan/admissionRecords";
import AdmissionPreview from "../../features/admission/AdmissionPreview";
import AdmissionPrintTemplate from "../../features/admission/AdmissionPrintTemplate";
import { buildAdmissionDocument } from "../../features/admission/admissionDocument";
import { createAdmissionWord, openAdmissionPreview, readAdmissionPreview } from "../../features/admission/admissionDocumentExport";

jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), isCancel: jest.fn(() => false), defaults: {} }));
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });
jest.mock("react-toastify", () => ({ ToastContainer: () => null, toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@mui/icons-material", () => ({
  AddPhotoAlternateRounded: () => null, ArrowBackRounded: () => null, CheckCircleRounded: () => null,
  DeleteRounded: () => null, FolderSpecialRounded: () => null, PersonRounded: () => null,
  RefreshRounded: () => null, SaveRounded: () => null, SchoolRounded: () => null,
  WarningAmberRounded: () => null, WorkspacePremiumRounded: () => null, SwapHorizRounded: () => null,
  HistoryRounded: () => null, AddRounded: () => null, DeleteOutlineRounded: () => null,
  EditRounded: () => null, FactCheckRounded: () => null, MenuBookRounded: () => null,
  RuleRounded: () => null, CloseRounded: () => null, VisibilityRounded: () => null, SearchRounded: () => null,
}));
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
    if (url.includes("/admission-records?")) return { data: { data: [record, { ...record, id: "other", code: "HV002", fullName: "Hồ sơ khác" }], pagination: { total: 2, totalPages: 1 }, stats: {} } };
    if (url.endsWith("/admission-records/record")) return { data: record };
    if (url.endsWith("/recognized-credits")) return { data: { credits: 0 } };
    return { data: [] };
  });
});
afterEach(() => jest.restoreAllMocks());
const previewUrl = () => tab.location.replace.mock.calls[0][0];
const previewId = () => new URL(previewUrl(), "http://localhost").searchParams.get("preview");
const mountPreview = (url = previewUrl()) => render(<MemoryRouter initialEntries={[url]}><AdmissionPreview /></MemoryRouter>);

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
});

it("embeds the existing profile photo in a genuine DOCX", async () => {
  const photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6i0AAAAASUVORK5CYII=";
  const data = buildAdmissionDocument({ ...record, photo });
  const zip = await JSZip.loadAsync(await bufferOf(await createAdmissionWord(data)));
  expect(Object.keys(zip.files).some((name) => /^word\/media\/.*\.png$/.test(name))).toBe(true);
  render(<AdmissionPrintTemplate document={data} />);
  expect(screen.getByAltText("Ảnh 3x4")).toHaveAttribute("src", photo);
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
  render(<MemoryRouter><AdmissionRecords mode={mode} /></MemoryRouter>);
  await screen.findAllByText(record.email);
  expect(screen.queryByRole("button", { name: /In \/ Xuất/ })).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Sửa hồ sơ" })).toHaveLength(2);
  if (mode === "admitted-masters") {
    expect(screen.queryByRole("button", { name: "Xóa hồ sơ" })).not.toBeInTheDocument();
  } else {
    expect(screen.getAllByRole("button", { name: "Xóa hồ sơ" })).toHaveLength(2);
  }
  expect(window.open).not.toHaveBeenCalled();
  expect(axios.put).not.toHaveBeenCalled(); expect(axios.post).not.toHaveBeenCalled();
});

it("both detail dropdowns export the current unsaved form, and blocked PDF tabs leave it intact", async () => {
  render(<MemoryRouter initialEntries={["/plan/admission-records/record"]}><Routes><Route path="/plan/admission-records/:id" element={<AdmissionRecordDetail />} /></Routes></MemoryRouter>);
  await screen.findByDisplayValue(record.fullName);
  const input = screen.getByDisplayValue(record.fullName);
  fireEvent.change(input, { target: { value: "Tên đang chỉnh sửa" } });
  const triggers = screen.getAllByRole("button", { name: "In / Xuất", exact: true });
  expect(triggers).toHaveLength(2);
  fireEvent.click(triggers[0]);
  for (const format of ["word", "pdf"]) expect(document.querySelector(`.document-export-icon-${format}`)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("menuitem", { name: "Xuất Word" }));
  await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1), { timeout: 10000 });
  expect(window.open).not.toHaveBeenCalled(); expect(sessionStorage.length).toBe(0);
  const xml = await docxXml(URL.createObjectURL.mock.calls[0][0]);
  expect(xml.documentElement.textContent).toContain("TÊN ĐANG CHỈNH SỬA");
  fireEvent.click(triggers[1]);
  for (const format of ["word", "pdf"]) expect(document.querySelector(`.document-export-icon-${format}`)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("menuitem", { name: "Xuất PDF" }));
  expect(readAdmissionPreview(previewId()).fullName).toBe("Tên đang chỉnh sửa");
  await waitFor(() => expect(triggers[1]).toBeEnabled());
  window.open.mockReturnValue(null);
  fireEvent.click(triggers[1]); fireEvent.click(screen.getByRole("menuitem", { name: "Xuất PDF" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Trình duyệt đã chặn tab")));
  expect(input).toHaveValue("Tên đang chỉnh sửa"); expect(window.print).not.toHaveBeenCalled();
  expect(axios.put).not.toHaveBeenCalled(); expect(axios.post).not.toHaveBeenCalled();
});
