import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SubjectSigningPrint from "../../features/exams/SubjectSigningPrint";
import GradebookPreview from "../../features/exams/GradebookPreview";
import { buildSubjectSigningDocument } from "../../features/exams/subjectSigningExport";
import { readChromePdf } from "../fixtures/readChromePdf";

const makeDocument = (count = 31) => buildSubjectSigningDocument([
  { code: "CKTM 2026.1.1", academicYear: "2026", major: { name: "Cơ khí thông minh và Robot" } },
  { code: "QLSX 2026.1.1", academicYear: "2026", major: { name: "Quản lý sản xuất" } },
], { subject: { name: "Hệ thống sản xuất linh hoạt và tích hợp", credits: 2 } },
Array.from({ length: count }, (_, i) => ({ fullName: `Nguyễn Văn An ${i + 1}`, testScore: i ? 8 : 0, assignmentScore: 9, result: "passed", finalized: true })));

it("previews all signing sheets with the original form's columns, notes and signing roles", () => {
  sessionStorage.setItem("subject-signing-preview:form", JSON.stringify({ ...makeDocument(), version: 1 }));
  vi.spyOn(window, "print").mockImplementation(() => {});
  render(<MemoryRouter initialEntries={["/masters/exam-lists/preview?preview=form"]}><GradebookPreview /></MemoryRouter>);
  expect(screen.getAllByRole("table")).toHaveLength(1);
  expect(screen.getByText("Nguyễn Văn An 31")).toBeInTheDocument();
  expect(screen.getAllByRole("columnheader", { name: "Theo dõi số tiết học của học viên" })).toHaveLength(1);
  expect(screen.getAllByText("BM.02-QT.SDH.03")).toHaveLength(1);
  expect(screen.getAllByText("GIẢNG VIÊN GIẢNG DẠY")).toHaveLength(1);
  const metadataRows = document.querySelectorAll(".subject-signing-fields");
  expect(metadataRows).toHaveLength(4);
  expect(metadataRows[0]).toHaveTextContent("Tên học phần:");
  expect(metadataRows[0]).not.toHaveTextContent("Chuyên ngành:");
  expect(metadataRows[1]).toHaveTextContent("Chuyên ngành:");
  expect(metadataRows[1]).toHaveTextContent("Lớp:");
  fireEvent.click(screen.getByRole("button", { name: "In / Lưu PDF" }));
  expect(window.print).toHaveBeenCalledOnce();
});

const browser = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(file => fs.existsSync(file));
(browser ? it : it.skip).each([11, 15, 55])("prints %i learners continuously with one final signing block", count => {
  const folder = path.resolve("../.tmp"); fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, `subject-signing-preview-${count}.html`), pdf = path.join(folder, `subject-signing-preview-${count}.pdf`);
  const document = makeDocument(count);
  if (count <= 15) {
    document.subject = "Vật liệu tiên tiến";
    document.group = "CKTM 2026.1.1";
    document.major = "Cơ khí thông minh và Robot";
  }
  const markup = renderToStaticMarkup(<SubjectSigningPrint document={document} />);
  const css = ["src/index.css", "src/styles/tables.css", "src/features/exams/subjectSigningPrint.css"].map(p => fs.readFileSync(p, "utf8")).join("\n");
  fs.writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root">${markup}</div></body></html>`);
  const url = `file:///${file.replaceAll("\\", "/")}`;
  const args = ["--headless", "--disable-gpu", "--no-sandbox", "--disable-background-networking", "--no-pdf-header-footer", "--window-size=1500,1000"];
  const options = { windowsHide: true, timeout: 30000, stdio: "ignore" };
  execFileSync(browser, [...args, `--screenshot=${path.join(folder, `subject-signing-preview-${count}.png`)}`, url], options);
  execFileSync(browser, [...args, `--print-to-pdf=${pdf}`, url], options);
  const pages = readChromePdf(fs.readFileSync(pdf));
  if (count === 11) expect(pages).toHaveLength(1);
  else if (count === 55) expect(pages.length).toBeGreaterThan(1);
  const text = JSON.stringify(pages);
  for (let i = 1; i <= count; i++) expect(text).toContain(`Nguyễn Văn An ${i}`);
  expect(text.match(/GIẢNG VIÊN GIẢNG DẠY/g)).toHaveLength(1);
  expect(text.match(/Có mặt\/Tổng số/g)).toHaveLength(1);
  expect(text.match(/THEO DÕI TÌNH HÌNH HỌC TẬP CỦA HỌC VIÊN/g)).toHaveLength(1);
  expect(pages.at(-1)).toContain("GIẢNG VIÊN GIẢNG DẠY");
}, 90000);
