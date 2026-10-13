import axios from "axios";
import { API_BASE_URL } from "../../config/http";
import { learnerTranscriptFilename, normalizeLearnerTranscript } from "./learnerTranscript";
import { createLearnerTranscriptWord } from "./learnerTranscriptWord";
import { createLearnerTranscriptPdf } from "./learnerTranscriptPdf";
import { sanitizeDocumentFilenamePart } from "../../utils/documentFiles";

export async function fetchClassTranscripts(classGroupId) {
  const { data } = await axios.get(`${API_BASE_URL}/reports/class-score-summary/transcripts`, { params: { classGroupId } });
  if (data.classGroup?.id !== classGroupId || !Array.isArray(data.scorecards)) throw new Error("Dữ liệu xuất không khớp lớp được chọn.");
  return data;
}

export function selectTranscriptScorecards(scorecards, selectedIds) {
  const byId = new Map();
  for (const scorecard of scorecards) {
    const id = scorecard.student?.participantId;
    if (selectedIds.has(id)) {
      if (byId.has(id)) throw new Error("Định danh học viên trùng lặp trong dữ liệu xuất.");
      byId.set(id, scorecard);
    }
  }
  return Array.from(selectedIds, id => {
    if (!byId.has(id)) throw new Error("Một học viên đã chọn không còn trong dữ liệu của lớp. Vui lòng tải lại danh sách.");
    if (byId.get(id).unavailableReason) throw new Error(byId.get(id).unavailableReason);
    return byId.get(id);
  });
}

export async function generateTranscriptDocuments(scorecards, format, { isCancelled = () => false, now = new Date() } = {}) {
  if (!["word", "pdf"].includes(format)) throw new Error("Định dạng bảng điểm không hợp lệ.");
  if (!scorecards.length) throw new Error("Lớp chưa có học viên để xuất bảng điểm.");
  const generate = format === "pdf" ? createLearnerTranscriptPdf : createLearnerTranscriptWord;
  const used = new Set();
  const documents = [];
  for (const scorecard of scorecards) {
    if (isCancelled()) throw new Error("Đã hủy xuất bảng điểm.");
    const transcript = normalizeLearnerTranscript(scorecard, { now });
    const identity = transcript.learner.participantId || transcript.learner.admissionRecordId;
    if (!identity) throw new Error("Học viên thiếu định danh để xuất bảng điểm.");
    const extension = format === "pdf" ? "pdf" : "docx";
    const base = learnerTranscriptFilename(transcript, format).slice(0, -(extension.length + 1));
    const filename = `${base.slice(0, 160)}-${sanitizeDocumentFilenamePart(identity).slice(0, 64)}.${extension}`.replace(/\.\./g, "-");
    const key = filename.normalize("NFC").toLocaleLowerCase("vi");
    if (used.has(key)) throw new Error("Định danh học viên trùng lặp; không thể tạo gói bảng điểm an toàn.");
    used.add(key);
    try {
      const blob = await generate(transcript);
      if (!blob?.size) throw new Error("File bảng điểm rỗng.");
      documents.push({ filename, blob });
    } catch (failure) {
      throw new Error(`Không thể xuất ${transcript.learner.studentCode || identity}: ${failure.message || "Lỗi tạo bảng điểm."}`);
    }
  }
  if (isCancelled()) throw new Error("Đã hủy xuất bảng điểm.");
  return documents;
}
