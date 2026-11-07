import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AdmissionPrintTemplate from "../../features/admission/AdmissionPrintTemplate";
import { buildAdmissionDocument } from "../../features/admission/admissionDocument";
import { readChromePdf } from "../fixtures/readChromePdf";

const browser = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(file => file && fs.existsSync(file));
const cssFiles = ["node_modules/bootstrap/dist/css/bootstrap.css", "src/index.css", "src/styles/tables.css", "src/styles/dialogs.css", "src/styles/dropdowns.css", "src/styles/appearance.css", "src/styles/adaptive-layout.css", "src/features/admission/admissionPrint.css"];

(browser ? it : it.skip).each([false, true])("saves all three signatures with the full application CSS (long notes: %s)", long => {
  const folder = path.resolve("../.tmp/admission-print-regression");
  fs.mkdirSync(folder, { recursive: true });
  const html = path.join(folder, `profile-${long ? "long" : "standard"}.html`);
  const pdf = html.replace(/\.html$/, ".pdf");
  const data = buildAdmissionDocument({
    code: "HS-2026-017-001", fullName: "Nguyễn Minh An", trainingLevel: "Thạc sĩ", academicYear: "2026",
    majorName: "Công nghệ thông tin", gradSchool: "Trường Đại học Hàng hải Việt Nam", gradMajor: "Công nghệ thông tin",
    dob: "1990-01-01", city: "Thành phố Hải Phòng", email: "minhan@example.com",
    note: long ? "Thông tin ghi chú dài trong hồ sơ học viên. ".repeat(60) + "KẾT THÚC GHI CHÚ" : "Thông tin hồ sơ học viên.",
  }, { now: new Date(2026, 10, 7) });
  const markup = renderToStaticMarkup(<main className="admission-preview"><section className="admission-print-page"><AdmissionPrintTemplate document={data} /></section></main>);
  const css = cssFiles.map(file => fs.readFileSync(file, "utf8")).join("\n");
  fs.writeFileSync(html, `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root">${markup}</div><script>
    const sheet=document.querySelector('.admission-sheet');
    const result={headings:[...document.querySelectorAll('.admission-sheet h1,.admission-sheet h2')].map(e=>({color:getComputedStyle(e).color,font:getComputedStyle(e).fontFamily})),
      widths:[...document.querySelectorAll('.admission-sheet-masthead td')].map(e=>e.getBoundingClientRect().width),
      personal:document.querySelector('.admission-sheet-personal-info').getBoundingClientRect().width,
      photo:[document.querySelector('.admission-sheet-photo').getBoundingClientRect().width,document.querySelector('.admission-sheet-photo').getBoundingClientRect().height],
      photoWithinMargins:document.querySelector('.admission-sheet-photo').getBoundingClientRect().right<=document.querySelector('.admission-sheet-personal').getBoundingClientRect().right+1,
      singleLines:[...document.querySelectorAll('.admission-sheet-single-line,.admission-sheet-masthead td:first-child>strong:nth-child(2)')].map(e=>({fits:e.scrollWidth<=e.clientWidth+1,nowrap:getComputedStyle(e).whiteSpace})),
      bodyFont:getComputedStyle(document.querySelector('.admission-sheet-field')).fontSize};
    document.body.insertAdjacentHTML('beforeend','<pre id="checks">'+JSON.stringify(result)+'</pre>');
    document.querySelector('#checks').style.display='none';
  </script></body></html>`);
  const args = ["--headless", "--disable-gpu", "--no-sandbox", "--disable-background-networking", "--no-pdf-header-footer", `--user-data-dir=${path.join(folder, long ? "chrome-long" : "chrome-standard")}`];
  const url = `file:///${html.replaceAll("\\", "/")}`;
  const options = { windowsHide: true, timeout: 30000, stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" };
  const dom = execFileSync(browser, [...args, "--dump-dom", url], options);
  const checks = JSON.parse([...dom.matchAll(/<pre id="checks"[^>]*>(.*?)<\/pre>/gs)].at(-1)[1]);
  for (const heading of checks.headings) {
    expect(heading.color).toBe("rgb(0, 0, 0)");
    expect(heading.font).toContain("Times New Roman");
  }
  expect(checks.widths[0]).toBeCloseTo(81.5*96/25.4,0);
  expect(checks.widths[1]).toBeCloseTo(83.5*96/25.4,0);
  expect(checks.personal).toBeCloseTo(132.5*96/25.4,0);
  expect(checks.photo[0]).toBeCloseTo(30*96/25.4,0);
  expect(checks.photo[1]).toBeCloseTo(40*96/25.4,0);
  expect(checks.photoWithinMargins).toBe(true);
  expect(checks.bodyFont).toBe('14px');
  expect(checks.singleLines.length).toBe(3);
  for(const line of checks.singleLines)expect(line).toEqual({fits:true,nowrap:'nowrap'});
  execFileSync(browser, [...args, `--print-to-pdf=${pdf}`, url], options);
  const pages = readChromePdf(fs.readFileSync(pdf));
  if (long) expect(pages.length).toBeGreaterThanOrEqual(1);
  else expect(pages).toHaveLength(1);
  for (const signature of data.signatures) {
    expect(pages.at(-1)).toContain(signature.title);
    expect(pages.at(-1)).toContain(signature.instruction);
    expect(pages.join("").split(signature.title)).toHaveLength(2);
  }
  expect(pages.at(-1)).toContain(data.fullName.toUpperCase());
  expect(pages.join("")).toContain(data.checklistTitle);
  if (long) expect(pages.join("")).toContain("KẾT THÚC GHI CHÚ");
}, 90000);
