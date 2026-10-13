import { paginateTranscriptRows } from "../../features/learners/transcriptPagination";

it("keeps course order, whole rows and repeated-page capacity without blank trailing pages", () => {
  expect(paginateTranscriptRows(Array(22).fill(20), 460, 650)).toEqual([Array.from({ length: 22 }, (_, i) => i)]);
  const pages = paginateTranscriptRows(Array(28).fill(42), 460, 650);
  expect(pages).toHaveLength(3);
  expect(pages.flat()).toEqual(Array.from({ length: 28 }, (_, i) => i));
  expect(pages.every(page => page.length > 0)).toBe(true);
  expect(paginateTranscriptRows([20, 20], 40, 40)).toEqual([[0, 1]]);
  expect(paginateTranscriptRows([], 40, 40)).toEqual([[]]);
});
