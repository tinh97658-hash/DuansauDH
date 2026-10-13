import fs from "fs";
import path from "path";
import { TextEncoder, TextDecoder } from "util";
import { createLearnerTranscriptPdf, transcriptPdfDefinition, TRANSCRIPT_PDF_FONTS } from "../../features/learners/learnerTranscriptPdf";
import { normalizeLearnerTranscript, transcriptDocumentDetails, transcriptMetadataRows, transcriptSubjectValues, TRANSCRIPT_HEADERS } from "../../features/learners/learnerTranscript";
import { officialTranscriptScorecardFixture, longTranscriptScorecardFixture, missingMetadataTranscriptFixture, hardSpecTranscriptScorecardFixture, referenceTranscriptScorecardFixture } from "../fixtures/learnerTranscript.fixture";
import { readTranscriptPdf, readTranscriptPdfLayout } from "../fixtures/readTranscriptPdf";

const original = { fetch: global.fetch, TextEncoder: global.TextEncoder, TextDecoder: global.TextDecoder };
beforeAll(() => {
  global.TextEncoder = TextEncoder; global.TextDecoder = TextDecoder;
  global.fetch = async url => {
    const buffer = fs.readFileSync(path.join(process.cwd(), "public", url));
    return { ok: true, arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) };
  };
});
afterAll(() => Object.assign(global, original));
jest.setTimeout(30000);
const renderedText = node => typeof node === "string" ? node : Array.isArray(node) ? node.map(renderedText).join("") : renderedText(node.text || node.columns || "");
const bufferOf = blob => new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(Buffer.from(reader.result)); reader.onerror = reject; reader.readAsArrayBuffer(blob);
});

it.each([[officialTranscriptScorecardFixture, 1], [longTranscriptScorecardFixture, 2], [missingMetadataTranscriptFixture, 1], [hardSpecTranscriptScorecardFixture, 1], [referenceTranscriptScorecardFixture, 1]])("creates a real Unicode PDF and uses the exact shared presentation", async (scorecard, minimumPages) => {
  const transcript = normalizeLearnerTranscript(scorecard);
  const definition = transcriptPdfDefinition(transcript);
  expect(definition.content[1].stack[0].columns.map(renderedText)).toEqual(["Số:", "/Khóa", "/SĐH"]);
  expect(renderedText(definition.content[3])).toBe(transcript.title);
  expect(definition.content[5].table.body.map(pair => pair.map(cell => renderedText(cell))))
    .toEqual(transcriptMetadataRows(transcript).map((pair, row) => pair.map((field, column) =>
      `${field.label}: ${row === 5 && column === 0 && !transcript.training.masterDiplomaNumber ? "" : field.value}`)));
  expect(definition.content[5].table.body.flat().every(cell =>
    (cell.columns ? cell.columns[1].text : cell.text).some(run => run.bold))).toBe(true);
  const table = definition.content[7].table;
  expect(table.body[0].map(cell => renderedText(cell))).toEqual(TRANSCRIPT_HEADERS);
  expect(table.body.slice(1).map(row => row.map(cell => renderedText(cell)))).toEqual(transcript.subjects.map(subject => transcriptSubjectValues(subject).map(String)));
  expect(table.body[0].every(cell => cell.noWrap)).toBe(true);
  expect(definition.pageSize).toEqual({ width: 595.32, height: 841.92 });
  expect(definition.pageMargins).toEqual([42.5, 20, 28.3, 34]);
  expect(table.widths.reduce((sum, width) => sum + width, 0) + 5.25).toBeCloseTo(518.28);
  expect(table.headerRows).toBe(1); expect(table.dontBreakRows).toBe(true);
  if (scorecard !== referenceTranscriptScorecardFixture) {
    expect(renderedText(table.body[1][4])).toBe("0");
    expect(renderedText(table.body[2][4])).toBe("");
    expect(renderedText(table.body[2][5])).toBe("");
    expect(renderedText(table.body[3][5])).toBe("Miễn thi");
  }
  expect(TRANSCRIPT_HEADERS).toEqual(["Stt", "Học Phần", "Mã số", "Số tín chỉ", "Điểm", "Ghi chú"]);
  expect(definition.content[8].stack[0].columns[1]).toMatchObject({ alignment: "right" });
  expect(JSON.stringify(definition.content)).not.toContain("UNDERGRAD");
  expect(definition.content[8].unbreakable).toBe(true);
  expect(renderedText(definition.content[8].stack[0].columns[0]).split(": ")[1]).toBe("—");
  expect(definition.content[8].stack[2].columns.filter(column => column.stack).every(column => renderedText(column.stack[3]) === " ")).toBe(true);
  expect(definition.footer().stack[2].columns.map(cell => renderedText(cell))).toEqual(transcriptDocumentDetails(transcript).footer);
  const blob = await createLearnerTranscriptPdf(transcript);
  expect(blob.type).toBe("application/pdf");
  const buffer = await bufferOf(blob);
  expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  expect(buffer.toString("latin1")).toContain("%%EOF");
  expect((buffer.toString("latin1").match(/\/Type \/Page\b/g) || []).length).toBeGreaterThanOrEqual(minimumPages);
  expect(buffer.toString("latin1")).toContain("/ToUnicode");
  const pages = readTranscriptPdf(buffer);
  expect(pages.length).toBe(scorecard === longTranscriptScorecardFixture ? 2 : 1);
  const actualText = pages.join("").replace(/\s/g, "");
  for (const expected of [transcript.title, transcript.learner.fullName, ...transcript.subjects.map(subject => subject.name), ...transcriptDocumentDetails(transcript).footer]) {
    expect(actualText).toContain(expected.replace(/\s/g, ""));
  }
  pages.forEach(page => transcriptDocumentDetails(transcript).footer.forEach(label => expect(page).toContain(label)));
  expect(actualText).not.toContain("PhạmTrungMinh");
  expect(actualText).not.toContain("NguyễnKimPhương");
  if (scorecard === referenceTranscriptScorecardFixture) {
    const [page] = readTranscriptPdfLayout(buffer);
    const horizontals = page.lines.filter(line => line.x1 === 45 && line.y1 === line.y2);
    const tableRules = horizontals.filter(line => line.y1 < 700);
    expect(tableRules[0].y1 - 0.375).toBeCloseTo(201.24, 2);
    expect(tableRules[tableRules.length - 1].y1 + 0.375).toBeCloseTo(579.066, 3);
    expect(horizontals[horizontals.length - 1]).toMatchObject({ x1: 45, x2: 563.28, y1: 804.12 });
    const run = prefix => page.runs.find(run => run.text.startsWith(prefix));
    const referenceTop = item => item.baseline - item.size * 0.891;
    expect(referenceTop(run("Số:"))).toBeCloseTo(25.19, 2);
    expect(referenceTop(run("KẾT"))).toBeCloseTo(56.61, 2);
    const metadata = page.runs.filter(run => Math.abs(run.x - 46.55) < 0.01 && run.baseline > 100 && run.baseline < 200);
    expect(metadata).toHaveLength(6);
    expect(referenceTop(metadata[0])).toBeCloseTo(98.15, 2);
    metadata.slice(1).forEach((item, index) => expect(item.baseline - metadata[index].baseline).toBeCloseTo(16.56, 2));
    // Check emitted PDF coordinates against the supplied MPS value starts,
    // independent of the renderer's layout constants.
    const valueStarts = [
      ["Vũ", 102.72, 0], ["11/09/2002", 102.72, 1], ["2025-2027", 169.56, 2],
      ["26/03/2025", 131.40, 3], ["Thạc", 140.40, 4],
      ["Hải", 342.00, 0], ["Công", 374.64, 1], ["Ứng", 393.36, 2],
      ["Chính", 384.36, 3], ["02", 384.36, 4], ["Tiếng", 384.36, 5],
    ];
    valueStarts.forEach(([prefix, x, row]) => {
      const value = page.runs.find(item => item.text.startsWith(prefix)
        && Math.abs(item.baseline - metadata[row].baseline) < 0.01);
      expect(value).toBeDefined();
      expect(value.x).toBeCloseTo(x, 2);
      expect(value.size).toBe(12);
    });
    expect(page.runs.some(item => item.text === "—" && item.x < 289.92
      && Math.abs(item.baseline - metadata[5].baseline) < 0.01)).toBe(false);
    expect(Math.abs(referenceTop(run("CHUYÊN")) - 610.07)).toBeLessThan(1.5);
    expect(run("NBH:").baseline).toBeCloseTo(813.72, 2);
    expect(page.runs.filter(run => run.size > 1 && run.baseline > 200 && run.baseline < 590).every(run => run.size === 12)).toBe(true);
  }
});

it("embeds all four real Liberation faces and renders Vietnamese without missing glyphs or fallback", async () => {
  const fontkit = require("fontkit");
  const phrases = ["Học viên", "Nguyễn Hà Vy", "Vũ Minh Dũng", "Chuyên ngành", "Công nghệ thông tin",
    "Định hướng đào tạo", "Ứng dụng", "Hình thức đào tạo", "Chính quy", "Trình độ đào tạo", "Thạc sĩ",
    "Số hiệu văn bằng", "Ngôn ngữ đào tạo", "Tiếng Việt", "KẾT QUẢ HỌC TẬP"];
  const expectedPostscriptNames = [];
  for (const filename of Object.values(TRANSCRIPT_PDF_FONTS.TranscriptSerif)) {
    const face = fontkit.create(fs.readFileSync(path.join(process.cwd(), "public/fonts/transcript", filename)));
    expectedPostscriptNames.push(face.postscriptName);
    for (const char of phrases.join("")) expect(face.glyphForCodePoint(char.codePointAt(0)).id).not.toBe(0);
    for (let code = 0x1ea0; code <= 0x1ef9; code++) expect(face.glyphForCodePoint(code).id).not.toBe(0);
  }
  expect(new Set(expectedPostscriptNames).size).toBe(4);
  // Initialize the exact production font loader, then exercise every face.
  await createLearnerTranscriptPdf(normalizeLearnerTranscript(referenceTranscriptScorecardFixture));
  const { default: pdfMake } = await import("pdfmake/build/pdfmake.js");
  const definition = { defaultStyle: { font: "TranscriptSerif", fontSize: 12 },
    content: [{}, { bold: true }, { italics: true }, { bold: true, italics: true }].map(style => ({
      text: phrases.join(" | "), ...style,
    })) };
  const buffer = await bufferOf(await pdfMake.createPdf(definition).getBlob());
  const text = readTranscriptPdf(buffer).join("").replace(/\s/g, "");
  for (const phrase of phrases) expect(text.split(phrase.replace(/\s/g, "")).length - 1).toBe(4);
  for (const name of expectedPostscriptNames) expect(buffer.toString("latin1")).toContain(name);
  expect(buffer.toString("latin1")).not.toContain("NotoSerif");
  expect(buffer.toString("latin1")).not.toContain("Roboto");
});
