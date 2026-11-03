// Read the existing print template's computed geometry. Only Word/Excel call
// this helper; PDF keeps its original HTML, CSS and automatic table layout.
export async function measureReportPrintLayout(report, landscape) {
  if (typeof document === "undefined" || !document.documentElement.clientWidth) return null;
  const [{ createElement }, { renderToStaticMarkup }, { ReportPrintSheet }, { default: css }] = await Promise.all([
    import("react"), import("react-dom/server"), import("../components/ReportPreview"), import("../components/reportPreview.css?inline"),
  ]);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = `position:fixed;left:-20000px;top:0;width:${landscape ? 297 : 210}mm;height:297mm;visibility:hidden;border:0;pointer-events:none`;
  document.body.appendChild(frame);
  try {
    const markup = renderToStaticMarkup(createElement(ReportPrintSheet, { report }));
    const target = frame.contentDocument;
    target.open();
    target.write(`<!doctype html><html><head><meta charset="utf-8"><style>${css}\nhtml,body{margin:0;padding:0}.report-preview{padding:0;min-height:0}.report-print-sheet{max-width:none}</style></head><body><div id="root"><main class="report-preview${landscape ? " report-landscape" : ""}">${markup}</main></div></body></html>`);
    target.close();
    await target.fonts?.ready;
    return readReportPrintLayout(target);
  } finally { frame.remove(); }
}

export function readReportPrintLayout(target) {
    const view = target.defaultView;
    const points = pixels => pixels * .75;
    return [...target.querySelectorAll(".report-print-section table")].map(table => {
      const headings = [...table.tHead.rows[0].cells];
      return {
        widths: headings.map(cell => points(cell.getBoundingClientRect().width)),
        headerHeight: points(table.tHead.rows[0].getBoundingClientRect().height),
        rowHeights: [...table.tBodies[0].rows].map(row => points(row.getBoundingClientRect().height)),
        cells: headings.map((cell, column) => {
          const sample = table.tBodies[0].rows[0]?.cells[column] || cell;
          const style = view.getComputedStyle(sample);
          return { align: style.textAlign, vertical: style.verticalAlign, wrap: style.whiteSpace !== "nowrap",
            padding: { top: points(parseFloat(style.paddingTop)), bottom: points(parseFloat(style.paddingBottom)),
              left: points(parseFloat(style.paddingLeft)), right: points(parseFloat(style.paddingRight)) } };
        }),
      };
    });
}
