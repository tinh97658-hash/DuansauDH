import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ClassProgressPrint from "../../features/scheduling/ClassProgressPrint";
import ReportPreview from "../../components/ReportPreview";
import { buildClassProgressReport } from "../../features/scheduling/classProgressReport";
import { normalizeReport } from "../../utils/reportExport";
import { readChromePdf } from "../fixtures/readChromePdf";

const makeReport = () => normalizeReport(buildClassProgressReport({
  classes: [{ id: "g1", code: "CNTT 2026.1.1", academicYear: "2026", memberCount: 18, curriculum: { code: "CT26", name: "Chương trình đào tạo Công nghệ thông tin - Khóa 2026" } },
    { id: "g2", code: "CNTT 2026.1.2", academicYear: "2026", memberCount: 20 }],
  visibleSubjects: Array.from({ length: 24 }, (_, index) => ({ code: `HP${index + 1}`, name: index === 0 ? "Phương pháp nghiên cứu khoa học" : `Học phần số ${index + 1}`, credits: 2,
    byClass: { g1: { curriculumSubjectId: `cs${index}`, status: index < 3 ? "completed" : "not_started", ...(index < 3 ? { completion: { passedCount: index ? 17 : 0, totalCount: 18 } } : {}) },
      g2: { curriculumSubjectId: `cs${index}`, status: "scheduled" } } })),
  major: { name: "Công nghệ thông tin" }, discipline: { name: "Khoa học máy tính" },
}), new Date(2026, 10, 3));

it("opens the class form through the frozen report preview and prints on request", () => {
  const report = makeReport();
  sessionStorage.setItem("report-preview:progress-form", JSON.stringify({ ...report, version: 1 }));
  vi.spyOn(window, "print").mockImplementation(() => {});
  render(<MemoryRouter initialEntries={["/reports/export-preview?preview=progress-form"]}><ReportPreview /></MemoryRouter>);
  expect(screen.getAllByRole("table")).toHaveLength(2);
  expect(screen.getAllByRole("columnheader", { name: "Tiến độ" })).toHaveLength(2);
  expect(screen.getByText("Hoàn thành 0/18")).toBeInTheDocument();
  expect(screen.queryByText("BỘ XÂY DỰNG")).not.toBeInTheDocument();
  expect(screen.queryByText("Điểm trung bình chung học phần")).not.toBeInTheDocument();
  expect(screen.getAllByText("CHUYÊN VIÊN")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "In / Lưu PDF" }));
  expect(window.print).toHaveBeenCalledOnce();
});

const browser = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(file => fs.existsSync(file));
(browser ? it : it.skip)("fits 24 subjects per A4 form and keeps every class and sign-off in the printed PDF", () => {
  const folder = path.resolve("../.tmp"); fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, "class-progress-form.html"), pdf = path.join(folder, "class-progress-form.pdf");
  const markup = renderToStaticMarkup(<ClassProgressPrint report={makeReport()} />);
  const css = ["src/index.css", "src/styles/tables.css", "src/features/scheduling/classProgressPrint.css"].map(file => fs.readFileSync(file, "utf8")).join("\n");
  fs.writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root">${markup}</div><script>
    const checks=[...document.querySelectorAll('article')].map(article=>({rows:article.querySelector('tbody').rows.length,width:article.offsetWidth,
      fits:article.querySelector('table').getBoundingClientRect().right<=article.getBoundingClientRect().right,
      font:getComputedStyle(article.querySelector('table')).fontFamily,fontSize:getComputedStyle(article.querySelector('td')).fontSize,
      padding:getComputedStyle(article.querySelector('td')).paddingTop,header:getComputedStyle(article.querySelector('th')).backgroundColor,
      border:getComputedStyle(article.querySelector('td')).borderTopColor,
      dateFont:getComputedStyle(article.querySelector('.progress-form-date')).fontStyle,
      dateCenter:article.querySelector('.progress-form-date').getBoundingClientRect().x+article.querySelector('.progress-form-date').getBoundingClientRect().width/2,
      signerCenter:article.querySelector('.progress-form-signatures').lastElementChild.getBoundingClientRect().x+article.querySelector('.progress-form-signatures').lastElementChild.getBoundingClientRect().width/2}));
    document.body.insertAdjacentHTML('beforeend','<pre id="checks">'+JSON.stringify(checks)+'</pre>');
  </script></body></html>`);
  const args = ["--headless", "--disable-gpu", "--no-sandbox", "--disable-background-networking", "--no-pdf-header-footer", "--window-size=1200,1100"];
  const url = `file:///${file.replaceAll("\\", "/")}`;
  const options = { windowsHide: true, timeout: 30000, stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" };
  const dom = execFileSync(browser, [...args, "--dump-dom", url], options);
  const checks = JSON.parse([...dom.matchAll(/<pre id="checks">(.*?)<\/pre>/gs)].at(-1)[1]);
  expect(checks).toHaveLength(2);
  checks.forEach(check => {
    expect(check).toMatchObject({ rows: 24, fits: true, border: "rgb(0, 0, 0)", fontSize: "16px", padding: "0px", header: "rgb(255, 255, 255)", dateFont: "normal" });
    expect(Math.abs(check.dateCenter-check.signerCenter)).toBeLessThan(1);
    expect(check.font).toContain("Times New Roman");
  });
  execFileSync(browser, [...args, `--screenshot=${path.join(folder, "class-progress-form.png")}`, url], options);
  // Remove the measurement text from the printed artifact.
  fs.writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root">${markup}</div></body></html>`);
  execFileSync(browser, [...args, `--print-to-pdf=${pdf}`, url], options);
  const pages = readChromePdf(fs.readFileSync(pdf));
  expect(pages).toHaveLength(2);
  expect(JSON.stringify(pages)).toContain("Hoàn thành 0/18");
  expect(JSON.stringify(pages)).toContain("CNTT 2026.1.2");
  for (const page of pages) expect(JSON.stringify(page)).toContain("CHUYÊN VIÊN");
}, 90000);
