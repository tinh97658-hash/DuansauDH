import { TextEncoder } from "util";
import JSZip from "jszip";
import { createLearnerTranscriptWord } from "../../features/learners/learnerTranscriptWord";
import { learnerTranscriptFilename, normalizeLearnerTranscript, transcriptDocumentDetails, transcriptMetadataRows, transcriptSubjectValues, TRANSCRIPT_HEADERS } from "../../features/learners/learnerTranscript";
import { TRANSCRIPT_TABLE_WIDTH, TRANSCRIPT_PAGE } from "../../features/learners/transcriptForm";
import { transcriptScorecardFixture, longTranscriptScorecardFixture, officialTranscriptScorecardFixture, missingMetadataTranscriptFixture, hardSpecTranscriptScorecardFixture, referenceTranscriptScorecardFixture } from "../fixtures/learnerTranscript.fixture";

const originalEncoder = global.TextEncoder;
beforeAll(() => { global.TextEncoder = TextEncoder; });
afterAll(() => { global.TextEncoder = originalEncoder; });
jest.setTimeout(20000);
const bufferOf = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsArrayBuffer(blob);
});
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const nodes = (parent, name) => Array.from(parent.getElementsByTagNameNS(W, name));
const contents = (parent) => nodes(parent, "t").map(node => node.textContent).join("");

it("prints a passed language exemption with no invented numeric score", async () => {
  const transcript = normalizeLearnerTranscript({ ...transcriptScorecardFixture, subjects: [{
    id: "english", code: "HPTA", name: "Tiếng Anh", credits: 3,
    grade: { score: null, result: "passed", profileForeignLanguageExempt: true, details: { examExempt: true } },
  }] });
  expect(transcript.subjects[0]).toMatchObject({ score: null, note: "Đạt (Miễn thi ngoại ngữ)" });
  const zip = await JSZip.loadAsync(await bufferOf(await createLearnerTranscriptWord(transcript)));
  expect(await zip.file("word/document.xml").async("string")).toContain("Đạt (Miễn thi ngoại ngữ)");
});

it("prints Không đạt for interrupted study leave in the shared transcript dataset and DOCX", async () => {
  const transcript = normalizeLearnerTranscript({ ...transcriptScorecardFixture, subjects: [{
    id: "interrupted", code: "HP01", name: "Triết học", credits: 3,
    grade: { score: null, result: "failed", studyLeaveFailure: true },
  }] });
  expect(transcriptSubjectValues(transcript.subjects[0]).slice(-2)).toEqual(["", "Không đạt"]);
  const zip = await JSZip.loadAsync(await bufferOf(await createLearnerTranscriptWord(transcript)));
  expect(await zip.file("word/document.xml").async("string")).toContain("Không đạt");
});

it.each([transcriptScorecardFixture, longTranscriptScorecardFixture, officialTranscriptScorecardFixture, missingMetadataTranscriptFixture, hardSpecTranscriptScorecardFixture, referenceTranscriptScorecardFixture])("creates a real DOCX with the exact shared dataset and a readable multi-page layout", async (scorecard) => {
  const transcript = normalizeLearnerTranscript(scorecard);
  const blob = await createLearnerTranscriptWord(transcript);
  expect(blob).toBeInstanceOf(Blob);
  expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  const zip = await JSZip.loadAsync(await bufferOf(blob));
  const xml = new DOMParser().parseFromString(await zip.file("word/document.xml").async("string"), "application/xml");
  expect(xml.getElementsByTagName("parsererror")).toHaveLength(0);
  expect(contents(xml)).toContain("KẾT QUẢ HỌC TẬP");
  expect(contents(xml)).not.toContain("UNDERGRAD");
  const tables = nodes(xml, "tbl");
  expect(tables).toHaveLength(4);
  expect(nodes(tables[0], "tr")).toHaveLength(6);
  transcriptMetadataRows(transcript).forEach((pair, index) => {
    const cells = nodes(nodes(tables[0], "tr")[index], "tc");
    expect(cells.map(contents)).toEqual(pair.map((field, column) => index === 5 && column === 0
      ? `${field.label}: ${transcript.training.masterDiplomaNumber ? field.value : ""}`
      : `${field.label}:${field.value}`));
    cells.forEach((cell, column) => {
      const runs = nodes(cell, "r");
      expect(nodes(runs[0], "b")[0].getAttributeNS(W, "val")).toBe("false");
      const valueRun = runs[runs.length - 1];
      expect(nodes(valueRun, "b")).toHaveLength(1);
      expect(nodes(valueRun, "b")[0].getAttributeNS(W, "val")).not.toBe("false");
      const stops = nodes(cell, "tab").filter(node => node.parentNode.localName === "tabs");
      const expectedStops = column ? [1042, 1695, 2069, 1889, 1889, 1889] : [1123, 1123, 2460, 1697, 1877, null];
      expect(stops.map(node => Number(node.getAttributeNS(W, "pos"))))
        .toEqual(expectedStops[index] == null ? [] : [expectedStops[index]]);
    });
  });
  const rows = nodes(tables[1], "tr");
  expect(rows).toHaveLength(transcript.subjects.length + 1);
  expect(nodes(rows[0], "tc").map(contents)).toEqual(TRANSCRIPT_HEADERS);
  transcript.subjects.forEach((subject, index) => {
    expect(nodes(rows[index + 1], "tc").map(contents)).toEqual(transcriptSubjectValues(subject).map(String));
  });
  if (scorecard !== referenceTranscriptScorecardFixture) expect(nodes(rows[1], "tc")[4].textContent).toContain("0");
  expect(nodes(rows[2], "tc")[4].textContent).toBe("");
  expect(nodes(rows[0], "trHeight")[0].getAttributeNS(W, "val")).toBe("330");
  expect(nodes(rows[1], "trHeight")[0].getAttributeNS(W, "val")).toBe("283");
  expect(nodes(rows[1], "trHeight")[0].getAttributeNS(W, "hRule")).toBe("atLeast");
  if (scorecard === referenceTranscriptScorecardFixture) {
    expect(nodes(rows[2], "trHeight")[0].getAttributeNS(W, "val")).toBe("566");
    expect(nodes(rows[3], "trHeight")[0].getAttributeNS(W, "val")).toBe("570");
  }
  expect(nodes(rows[0], "tblHeader")).toHaveLength(1);
  expect(rows.every(row => nodes(row, "cantSplit").length === 1)).toBe(true);
  expect(nodes(rows[0], "b")).toHaveLength(6);
  expect(nodes(rows[1], "vAlign").every(node => node.getAttributeNS(W, "val") === "top")).toBe(true);
  expect(nodes(tables[1], "tblInd")[0].getAttributeNS(W, "w")).toBe("70");
  expect(nodes(tables[0], "trHeight").map(node => node.getAttributeNS(W, "val"))).toEqual(["331", "331", "331", "331", "331", "331"]);
  expect(nodes(tables[1], "spacing").every(node => ["285", "345"].includes(node.getAttributeNS(W, "line")) && node.getAttributeNS(W, "lineRule") === "atLeast")).toBe(true);
  expect(nodes(rows[1], "jc").map(node => node.getAttributeNS(W, "val"))).toEqual(["center", "left", "center", "center", "center", "center"]);
  expect(nodes(xml, "pgSz")[0].getAttributeNS(W, "w")).toBe("11910");
  expect(nodes(xml, "pgSz")[0].getAttributeNS(W, "h")).toBe("16840");
  expect(nodes(tables[1], "gridCol").reduce((sum, node) => sum + Number(node.getAttributeNS(W, "w")), 0)).toBe(TRANSCRIPT_TABLE_WIDTH);
  expect(nodes(xml, "pgMar")[0].getAttributeNS(W, "left")).toBe(String(TRANSCRIPT_PAGE.left));
  expect(nodes(xml, "pgMar")[0].getAttributeNS(W, "header")).toBe("0");
  const details = transcriptDocumentDetails(transcript);
  const first = nodes(xml, "body")[0].firstElementChild;
  expect(contents(first)).toBe("Số:/Khóa/SĐH");
  expect(nodes(first, "tab").filter(node => node.parentNode.localName === "r")).toHaveLength(2);
  expect(nodes(first, "tab").filter(node => node.parentNode.localName === "tabs").map(node => [node.getAttributeNS(W, "pos"), node.getAttributeNS(W, "leader")]))
    .toEqual([["1123", "none"], ["2907", "dot"]]);
  expect(nodes(first, "ind")[0].getAttributeNS(W, "left")).toBe("81");
  expect(nodes(first, "spacing")[0].getAttributeNS(W, "before")).toBe("75");
  const cellMargins = nodes(tables[1], "tblCellMar")[0];
  expect(Array.from(cellMargins.children).every(node => node.getAttributeNS(W, "w") === "0")).toBe(true);
  expect(nodes(rows[0], "vAlign").every(node => node.getAttributeNS(W, "val") === "top")).toBe(true);
  expect(contents(xml)).toContain(`${details.gpa.label}: —`);
  expect(contents(xml)).toContain(details.issueDate);
  expect(nodes(xml, "i").some(node => node.parentNode.parentNode.textContent === details.issueDate)).toBe(true);
  details.signatures.flatMap(signature => signature.roles).forEach(role => expect(contents(tables[3])).toContain(role));
  expect(nodes(tables[3], "cantSplit")).toHaveLength(1);
  expect(contents(xml)).not.toContain("Phạm Trung Minh");
  expect(contents(xml)).not.toContain("Nguyễn Kim Phương");
  const footerXml = new DOMParser().parseFromString(await zip.file("word/footer1.xml").async("string"), "application/xml");
  expect(contents(footerXml)).toBe(details.footer.join(""));
  expect(nodes(xml, "footerReference")).toHaveLength(1);
  expect(nodes(xml, "shd")).toHaveLength(0);
  const styles = await zip.file("word/styles.xml").async("string");
  expect(styles).toContain("Times New Roman");
  expect(styles).toContain("000000");
});

it("builds filenames with Vietnamese text, a missing code and filesystem-safe parts", () => {
  const transcript = normalizeLearnerTranscript(transcriptScorecardFixture);
  expect(learnerTranscriptFilename(transcript)).toBe("Bang-diem-HV001-Nguyễn Văn An.docx");
  expect(learnerTranscriptFilename({ ...transcript, learner: { ...transcript.learner, studentCode: null } })).toBe("Bang-diem-Nguyễn Văn An.docx");
  const filename = learnerTranscriptFilename({ ...transcript, learner: { studentCode: 'HV/01:*', fullName: 'Nguyễn\\An<>?\n.' } });
  expect(filename).toMatch(/^Bang-diem-HV-01--Nguyễn-An-\.docx$/);
  expect(filename).not.toMatch(/[<>:"/\\|?*\u0000-\u001f]/);
  expect(learnerTranscriptFilename(normalizeLearnerTranscript({}))).toBe("Bang-diem.docx");
});
