import { openLearnerTranscriptPdfPreview } from "../../features/learners/learnerTranscriptPdfPreview";
import { createLearnerTranscriptPdf } from "../../features/learners/learnerTranscriptPdf";
import { normalizeLearnerTranscript } from "../../features/learners/learnerTranscript";
jest.mock("../../features/learners/learnerTranscriptPdf", () => ({ createLearnerTranscriptPdf: jest.fn() }));

beforeEach(() => {
  jest.useFakeTimers();
  URL.createObjectURL = jest.fn(() => "blob:transcript");
  URL.revokeObjectURL = jest.fn();
});
afterEach(() => { window.dispatchEvent(new Event("pagehide")); jest.useRealTimers(); });

it("opens the generated PDF inline and keeps its URL alive until the PDF tab closes", async () => {
  const transcript = normalizeLearnerTranscript({ subjects: [] });
  const blob = new Blob(["pdf"], { type: "application/pdf" });
  createLearnerTranscriptPdf.mockResolvedValue(blob);
  const tab = { closed: false, location: { replace: jest.fn() } };
  await openLearnerTranscriptPdfPreview(transcript, tab);
  expect(createLearnerTranscriptPdf).toHaveBeenCalledWith(transcript);
  expect(tab.location.replace).toHaveBeenCalledWith("blob:transcript");
  jest.advanceTimersByTime(60000);
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  tab.closed = true;
  jest.advanceTimersByTime(1000);
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it("does not open a late PDF after cancellation and cleans URLs on page unload", async () => {
  const tab = { closed: false, location: { replace: jest.fn() } };
  createLearnerTranscriptPdf.mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
  await openLearnerTranscriptPdfPreview({}, tab, { isCancelled: () => true });
  expect(tab.location.replace).not.toHaveBeenCalled();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  await openLearnerTranscriptPdfPreview({}, tab);
  window.dispatchEvent(new Event("pagehide"));
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it("rejects a non-PDF result and releases the URL if navigation fails", async () => {
  const tab = { closed: false, location: { replace: jest.fn(() => { throw Error("Navigation failed"); }) } };
  createLearnerTranscriptPdf.mockResolvedValue(new Blob(["word"]));
  await expect(openLearnerTranscriptPdfPreview({}, tab)).rejects.toThrow("PDF");
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  createLearnerTranscriptPdf.mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
  await expect(openLearnerTranscriptPdfPreview({}, tab)).rejects.toThrow("Navigation failed");
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
});

it("preserves authoritative input order and assigns STT without transcript-local sorting", () => {
  const subjects = [{ id: "t", name: "Triết học", code: "T", credits: 3, grade: { score: 0 } }, { id: "a", name: "An toàn", code: "A", credits: 4, grade: null }];
  const transcript = normalizeLearnerTranscript({ subjects });
  expect(transcript.subjects.map(subject => [subject.subjectId, subject.index, subject.score])).toEqual([["t", 1, 0], ["a", 2, null]]);
  expect(subjects.map(subject => subject.id)).toEqual(["t", "a"]);
});
