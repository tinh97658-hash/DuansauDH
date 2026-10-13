import { LEARNER_TRANSCRIPT_LAYOUT as L, TRANSCRIPT_PAGE, TRANSCRIPT_COLUMN_WIDTHS, TRANSCRIPT_TABLE_WIDTH } from "../../features/learners/transcriptForm";
import { normalizeLearnerTranscript, transcriptDocumentDetails } from "../../features/learners/learnerTranscript";
import { transcriptPdfDefinition } from "../../features/learners/learnerTranscriptPdf";
import { hardSpecTranscriptScorecardFixture } from "../fixtures/learnerTranscript.fixture";

it("encodes the measured Word page, zero cell margins and fixed grid", () => {
  expect(TRANSCRIPT_PAGE).toEqual({ width: 11910, height: 16840, left: 850, right: 566, top: 400, bottom: 680, footer: 483 });
  expect(TRANSCRIPT_COLUMN_WIDTHS).toEqual([540, 4693, 1509, 1144, 1115, 1345]);
  expect(TRANSCRIPT_TABLE_WIDTH).toBe(10346);
  expect(L).toMatchObject({ bodyFont: 12, titleFont: 14, footerFont: 9.5,
    metadataRows: [16.56, 16.56, 16.56, 16.56, 16.56, 16.56], metadataLeft: 243.36,
    tableIndent: 3.5, cellHorizontal: 0, cellVertical: 0, border: 0.75, signingSpace: 55.5 });
  const definition = transcriptPdfDefinition(normalizeLearnerTranscript(hardSpecTranscriptScorecardFixture));
  expect(definition.content[7].layout.paddingTop()).toBe(0);
  expect(definition.content[7].layout.paddingBottom()).toBe(0);
  expect(definition.content[7].layout.paddingLeft()).toBe(0);
  expect(definition.content[7].layout.paddingRight()).toBe(0);
  expect(definition.footer().stack[2].columns[0]).toMatchObject({ fontSize: 9.72, color: "#808080" });
});

it("uses twelve non-breaking spaces and nineteen literal dots, preserving a supplied year", () => {
  const missing = transcriptDocumentDetails(normalizeLearnerTranscript({})).numberLine;
  expect(missing).toBe(`Số:${"\u00a0".repeat(12)}/Khóa ${".".repeat(19)}/SĐH`);
  expect(transcriptDocumentDetails(normalizeLearnerTranscript(hardSpecTranscriptScorecardFixture)).numberLine)
    .toBe(`Số:${"\u00a0".repeat(12)}/Khóa 2025/SĐH`);
});
