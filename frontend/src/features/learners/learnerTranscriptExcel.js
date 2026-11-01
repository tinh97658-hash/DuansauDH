import { createReportExcel, normalizeReport } from "../../utils/reportExport";
import { TRANSCRIPT_HEADERS, transcriptMetadataRows, transcriptSubjectValues } from "./learnerTranscript";

export async function createLearnerTranscriptExcel(transcript) {
  return createReportExcel(normalizeReport({ title: transcript.title,
    metadata: [["Mã học viên", transcript.learner.studentCode], ...transcriptMetadataRows(transcript).flatMap(pair => pair.map(field => [field.label, field.value]))],
    sections: [{ title: "Kết quả các học phần", headers: TRANSCRIPT_HEADERS, rows: transcript.subjects.map(transcriptSubjectValues) }] }));
}
