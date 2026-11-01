import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import ReportPreview from "../../components/ReportPreview";
import { normalizeReport } from "../../utils/reportExport";
import { readChromePdf } from "../fixtures/readChromePdf";

const browser = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(file => file && fs.existsSync(file));
const testBrowser = browser ? it : it.skip;

testBrowser.each([4, 18])("prints every row and column with all table borders for a %i-column report", async columnCount => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "report-print-"));
  const htmlPath = path.join(folder, "preview.html"), pdfPath = path.join(folder, "preview.pdf");
  const report = normalizeReport({ title: "Kiểm tra bản in", metadata: [], sections: [{ title: "Dữ liệu đầy đủ",
    headers: Array.from({ length: columnCount }, (_, index) => index === 0 ? "STT" : index === 1 ? "Năm học" : `FIELD${index + 1}`),
    rows: Array.from({ length: 65 }, (_, row) => Array.from({ length: columnCount }, (_, col) => col === 0 ? row + 1 : col === 1 ? "2026" : `R${row + 1}C${col + 1}`)),
  }] });
  sessionStorage.setItem("report-preview:browser", JSON.stringify({ ...report, version: 1 }));
  const markup = renderToStaticMarkup(<MemoryRouter initialEntries={["/reports/export-preview?preview=browser"]}><ReportPreview /></MemoryRouter>);
  const css = ["src/index.css", "src/components/reportPreview.css", "src/styles/tables.css"].map(file => fs.readFileSync(file, "utf8")).join("\n");
  fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root">${markup}</div><script>
    const tables = [...document.querySelectorAll('table')];
    const result = tables.map(table => {
      const last = table.tBodies[0].rows[table.tBodies[0].rows.length - 1].lastElementChild;
      const first = table.tHead.rows[0].lastElementChild;
      const serial = table.tBodies[0].rows[0].firstElementChild;
      const year = table.tBodies[0].rows[0].querySelector('.report-year-cell');
      return { right: getComputedStyle(last).borderRightWidth, bottom: getComputedStyle(last).borderBottomWidth,
        headerRight: getComputedStyle(first).borderRightWidth,
        serialWidth: serial.getBoundingClientRect().width, serialAlign: getComputedStyle(serial).textAlign, serialVertical: getComputedStyle(serial).verticalAlign,
        yearWidth: year ? year.getBoundingClientRect().width : null, yearPadding: year ? parseFloat(getComputedStyle(year).paddingLeft) + parseFloat(getComputedStyle(year).paddingRight) : null,
        fits: table.getBoundingClientRect().right <= table.closest('article').getBoundingClientRect().right,
        rows: table.tBodies[0].rows.length };
    });
    document.body.insertAdjacentHTML('beforeend', '<pre id="checks">' + JSON.stringify(result) + '</pre>');
  </script></body></html>`, "utf8");
  const args = ["--headless", "--disable-gpu", "--no-sandbox", "--disable-background-networking", "--no-pdf-header-footer"];
  try {
    const dom = execFileSync(browser, [...args, "--dump-dom", `file:///${htmlPath.replaceAll("\\", "/")}`], { encoding: "utf8", windowsHide: true, timeout: 30000, stdio: ["ignore", "pipe", "ignore"] });
    const checks = JSON.parse([...dom.matchAll(/<pre id="checks">(.*?)<\/pre>/gs)].at(-1)[1]);
    for (const table of checks) {
      expect(table).toMatchObject({ right: "1px", bottom: "1px", headerRight: "1px", fits: true, rows: 65, serialAlign: "center", serialVertical: "middle" });
      expect(table.serialWidth).toBeLessThan(55);
      if (table.yearWidth !== null) {
        expect(table.yearWidth).toBeLessThan(55);
        expect(table.yearPadding).toBeLessThanOrEqual(7.57);
      }
    }
    expect(checks.some(table => table.yearWidth !== null)).toBe(true);
    execFileSync(browser, [...args, `--print-to-pdf=${pdfPath}`, `file:///${htmlPath.replaceAll("\\", "/")}`], { windowsHide: true, timeout: 30000, stdio: "ignore" });
    const pages = readChromePdf(fs.readFileSync(pdfPath));
    expect(pages.length).toBeGreaterThan(1);
    const text = JSON.stringify(pages);
    for (let row = 1; row <= 65; row++) for (let col = 3; col <= columnCount; col++) expect(text).toContain(`R${row}C${col}`);
    for (let col = 3; col <= columnCount; col++) expect(text).toContain(`FIELD${col}`);
    expect(text).toContain("2026");
  } finally {
    for (const file of [htmlPath, pdfPath]) if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(folder);
  }
}, 90000);
