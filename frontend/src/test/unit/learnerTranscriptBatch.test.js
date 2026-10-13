import axios from "axios";
import { fetchClassTranscripts, generateTranscriptDocuments, selectTranscriptScorecards } from "../../features/learners/learnerTranscriptBatch";
import { createLearnerTranscriptWord } from "../../features/learners/learnerTranscriptWord";
import { createLearnerTranscriptPdf } from "../../features/learners/learnerTranscriptPdf";
import { officialTranscriptScorecardFixture } from "../fixtures/learnerTranscript.fixture";
import { packTranscriptZip } from "../../features/learners/learnerTranscriptZip";
import JSZip from "jszip";
jest.mock("axios");
jest.mock("../../features/learners/learnerTranscriptWord", () => ({ createLearnerTranscriptWord: jest.fn() }));
jest.mock("../../features/learners/learnerTranscriptPdf", () => ({ createLearnerTranscriptPdf: jest.fn() }));
beforeEach(() => {
  createLearnerTranscriptWord.mockResolvedValue(new Blob(["word"]));
  createLearnerTranscriptPdf.mockResolvedValue(new Blob(["pdf"]));
});
const students = [1,2].map(id => ({ ...officialTranscriptScorecardFixture, student: { ...officialTranscriptScorecardFixture.student, participantId: `student:${id}` } }));
const bufferOf = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsArrayBuffer(blob); });
it.each([[3,"word"],[3,"pdf"],[5,"word"],[5,"pdf"],[40,"word"],[40,"pdf"]])("packs exactly %s selected %s files from a 40-student dataset", async (count, format) => {
  const roster = Array.from({ length: 40 }, (_, id) => ({ ...officialTranscriptScorecardFixture, student: { ...officialTranscriptScorecardFixture.student, participantId: `student:${id}` } }));
  const selected = selectTranscriptScorecards(roster, new Set(roster.slice(0, count).map(card => card.student.participantId)));
  const documents = await generateTranscriptDocuments(selected, format);
  const zip = await JSZip.loadAsync(await bufferOf(await packTranscriptZip(documents, format)));
  expect(Object.keys(zip.files)).toHaveLength(count);
  expect(Object.keys(zip.files).every(name => name.endsWith(format === "pdf" ? ".pdf" : ".docx"))).toBe(true);
});
it("selects exactly requested identities and rejects missing or duplicate selected identities before generation", () => {
  expect(selectTranscriptScorecards(students, new Set(["student:2"]))).toEqual([students[1]]);
  expect(() => selectTranscriptScorecards(students, new Set(["unknown"]))).toThrow("không còn");
  expect(() => selectTranscriptScorecards([students[0], students[0]], new Set(["student:1"]))).toThrow("trùng lặp");
  const unavailable = { student: { participantId: "missing" }, unavailableReason: "Hồ sơ thiếu" };
  expect(selectTranscriptScorecards([...students, unavailable], new Set(["student:1"]))).toEqual([students[0]]);
  expect(() => selectTranscriptScorecards([...students, unavailable], new Set(["missing"]))).toThrow("Hồ sơ thiếu");
});
it("fetches by classGroupId only, never the screen search or page", async () => {
  axios.get.mockResolvedValue({ data: { classGroup: { id: "g1" }, scorecards: students } });
  expect((await fetchClassTranscripts("g1")).scorecards).toHaveLength(2);
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/transcripts$/), { params: { classGroupId: "g1" } });
});
it.each(["word", "pdf"])("reuses the single %s renderer, preserves zero and resolves duplicate names with stable identities", async format => {
  const documents = await generateTranscriptDocuments(students, format);
  expect(documents).toHaveLength(2);
  expect(new Set(documents.map(doc => doc.filename)).size).toBe(2);
  expect(documents.every(doc => !/[<>:"/\\|?*]/.test(doc.filename) && !doc.filename.includes(".."))).toBe(true);
  const generate = format === "word" ? createLearnerTranscriptWord : createLearnerTranscriptPdf;
  expect(generate).toHaveBeenCalledTimes(2);
  expect(generate.mock.calls[0][0].subjects[0].score).toBe(0);
  expect(generate.mock.calls[0][0].summary.gpa).toBeNull();
});
it("fails clearly on a generation error, duplicate identity, empty class or cancellation", async () => {
  createLearnerTranscriptWord.mockRejectedValueOnce(new Error("Cannot generate"));
  await expect(generateTranscriptDocuments(students, "word")).rejects.toThrow("Cannot generate");
  await expect(generateTranscriptDocuments([students[0],students[0]], "word")).rejects.toThrow("trùng lặp");
  await expect(generateTranscriptDocuments([], "word")).rejects.toThrow("chưa có học viên");
  await expect(generateTranscriptDocuments(students, "word", { isCancelled: () => true })).rejects.toThrow("hủy");
});
