import { gradebookColumns } from "./gradebook";

const policies = {
  index: { min: 6, max: 6, nowrap: true }, code: { min: 12, max: 16, nowrap: true },
  lastName: { min: 14, max: 22 }, firstName: { min: 9, max: 14 },
  dob: { min: 12, max: 12, nowrap: true }, gender: { min: 10, max: 10, nowrap: true },
  eligible: { min: 11, max: 18 }, exempt: { min: 10, max: 12 },
  testScore: { min: 10, max: 14, nowrap: true }, assignmentScore: { min: 11, max: 14, nowrap: true },
  examScore: { min: 11, max: 14, nowrap: true }, courseScore: { min: 11, max: 14, nowrap: true },
  grade4: { min: 10, max: 12, nowrap: true }, letter: { min: 10, max: 12, nowrap: true },
  attempts: { min: 14, max: 18 }, result: { min: 12, max: 18 },
};

// Approximate readable text width; merged report headings never participate.
export const measureGradebookText = text => Math.max(0, ...String(text ?? "").split(/\r?\n/).map(line =>
  Array.from(line).reduce((width, character) => width + (/\s/.test(character) ? 0.5 : /[ilI.,;:!|]/.test(character) ? 0.5 : /[MW@]/.test(character) ? 1.4 : 1), 0)));

export function autoFitColumnByContent(values, { minWidth, maxWidth, header = "", includeHeader = true, padding = 2 }) {
  const headerWidth = includeHeader ? Math.max(0, ...String(header).split(/\s+/).map(measureGradebookText)) : 0;
  const contentWidth = values.reduce((longest, value) => Math.max(longest, measureGradebookText(value)), headerWidth);
  return Math.min(maxWidth, Math.max(minWidth, Math.ceil(contentWidth + padding)));
}

export function gradebookDocumentColumns(document) {
  const catalog = gradebookColumns();
  return document.headers.map((label, index) => {
    const key = catalog[index]?.key;
    const policy = policies[key] || { min: 11, max: 18 };
    // Measure header words, allowing the full header to wrap over multiple lines.
    const width = autoFitColumnByContent(document.rows.map(row => row[index]), {
      minWidth: policy.min, maxWidth: policy.max, header: label, includeHeader: !/Score$|^grade4$/.test(key || ""),
    });
    return { key, ...policy, width };
  });
}
