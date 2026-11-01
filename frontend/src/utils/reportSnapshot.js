import { reportText } from "./reportExport";

const excluded = node => !!node.closest('[data-export-exclude], [aria-hidden="true"], [hidden], .exam-print-sheet, .MuiTablePagination-root');
const visible = node => {
  for (let current = node; current; current = current.parentElement) {
    if (excluded(current)) return false;
    const style = getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") return false;
  }
  return true;
};

export function exportCellText(node) {
  const clone = node.cloneNode(true);
  clone.querySelectorAll('script, style, svg, [aria-hidden="true"], [data-export-exclude], [role="slider"], input[type="password"], input[type="file"], input[type="hidden"]').forEach(item => item.remove());
  clone.querySelectorAll("details:not([open])").forEach(details => { details.textContent = details.querySelector("summary")?.textContent || ""; });
  const originals = [...node.querySelectorAll("input, textarea, select")];
  clone.querySelectorAll("input, textarea, select").forEach((field, index) => {
    const original = originals.find(item => item.id && item.id === field.id) || originals[index] || field;
    const text = original.matches("select") ? original.selectedOptions?.[0]?.textContent || ""
      : ["checkbox", "radio"].includes(original.type) ? original.checked ? "Có" : "Không" : original.value || "";
    field.replaceWith(document.createTextNode(String(text)));
  });
  return reportText(clone.textContent.replace(/\s+/g, " ").trim());
}

function tableSection(table, title) {
  const headerRows = [...table.querySelectorAll(":scope > thead > tr")];
  const grid = [];
  for (const [rowIndex, row] of headerRows.entries()) {
    grid[rowIndex] ||= [];
    let column = 0;
    for (const cell of row.children) {
      while (grid[rowIndex][column] !== undefined) column++;
      const text = exportCellText(cell);
      for (let r = 0; r < (cell.rowSpan || 1); r++) {
        grid[rowIndex + r] ||= [];
        for (let c = 0; c < (cell.colSpan || 1); c++) grid[rowIndex + r][column + c] = text;
      }
      column += cell.colSpan || 1;
    }
  }
  const count = Math.max(0, ...grid.map(row => row.length));
  if (!count) return null;
  const headers = Array.from({ length: count }, (_, index) => [...new Set(grid.map(row => row[index]).filter(Boolean))].join(" / "));
  const keep = headers.map((label, index) => ({ label, index })).filter(({ label }) => label && !/^(Thao tác|Hành động|Xóa|Chọn học viên|Chọn tất cả)$/i.test(label));
  const bodyGrid = [];
  const bodyRows = [...table.querySelectorAll(":scope > tbody > tr")].filter(row => visible(row));
  bodyRows.forEach((row, rowIndex) => {
    bodyGrid[rowIndex] ||= [];
    let column = 0;
    for (const cell of row.children) {
      while (bodyGrid[rowIndex][column] !== undefined) column++;
      const text = exportCellText(cell);
      for (let r = 0; r < (cell.rowSpan || 1); r++) {
        bodyGrid[rowIndex + r] ||= [];
        for (let c = 0; c < (cell.colSpan || 1); c++) bodyGrid[rowIndex + r][column + c] = text;
      }
      column += cell.colSpan || 1;
    }
  });
  const rows = bodyGrid.slice(0, bodyRows.length).filter((_, index) => count === 1 || bodyRows[index].children.length > 1 || bodyRows[index].children[0]?.colSpan !== count)
    .map(values => keep.map(({ index }) => values[index] ?? ""));
  return rows.length ? { title: table.getAttribute("aria-label") || table.caption?.textContent || title, headers: keep.map(({ label }) => label), rows } : null;
}

export function snapshotReport(root, title = "Báo cáo dữ liệu") {
  const sections = [...root.querySelectorAll("table")].filter(table => visible(table) && !table.parentElement.closest("table"))
    .map(table => tableSection(table, title)).filter(Boolean);
  if (!sections.length) {
    const cards = [...root.querySelectorAll(".od-card, .od-work-category, .od-warning-group, dl")].filter(visible);
    if (cards.length) sections.push({ title, headers: ["Nội dung", "Thông tin"], rows: cards.map(card => [
      card.querySelector("h2, h3, dt")?.textContent || "Thông tin", exportCellText(card),
    ]) });
  }
  if (!sections.length) {
    const paragraphs = [...root.querySelectorAll(".MuiCardContent-root > p, .MuiCardContent-root > ol > li, .MuiCardContent-root > ul > li")].filter(visible);
    if (paragraphs.length) sections.push({ title, headers: ["STT", "Nội dung"], rows: paragraphs.map((node, index) => [index + 1, exportCellText(node)]) });
  }
  const metadata = [["Phạm vi", "Dữ liệu đang hiển thị theo bộ lọc hiện tại"]];
  const labels = new Set();
  root.querySelectorAll('input:not([type="password"]):not([type="file"]):not([type="hidden"]), select, [role="combobox"], [role="button"][aria-haspopup="listbox"]').forEach(field => {
    if (!visible(field) || field.closest("table") || ["checkbox", "radio"].includes(field.type)) return;
    const labelNode = field.labels?.[0]?.cloneNode(true);
    labelNode?.querySelectorAll("input, select, textarea, button, svg").forEach(node => node.remove());
    const label = field.getAttribute("aria-label") || labelNode?.textContent?.trim();
    const value = field.matches("select") ? field.selectedOptions?.[0]?.textContent : field.value ?? field.textContent;
    if (label && value && !labels.has(label)) { metadata.push([label, reportText(value)]); labels.add(label); }
  });
  const tab = root.querySelector('[role="tab"][aria-selected="true"]')?.textContent;
  if (tab) metadata.push(["Nội dung đang xem", tab]);
  const pagination = [...root.querySelectorAll("[data-export-pagination]")];
  pagination.forEach((node, index) => metadata.push([pagination.length === 1 ? "Trang" : `Trang bảng ${index + 1}`, node.textContent]));
  return { title, metadata, sections };
}

export function admissionFormReport(document) {
  return { title: document.title, filename: document.filename?.replace(/\.docx$/i, ""), metadata: [["Mã hồ sơ", document.displayCode]],
    sections: [...document.sections.map(section => ({ title: section.title, headers: ["Thông tin", "Nội dung"],
      rows: [...section.fields, ...(section.extra ? [section.extra] : [])].map(field => [field.label, field.value]) })),
    { title: document.checklistTitle, headers: ["Giấy tờ", "Đã nộp"], rows: document.documents.map(item => [item.label, item.checked ? "Có" : "Không"]) }] };
}
