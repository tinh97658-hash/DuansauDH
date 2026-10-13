import { openDocumentPreview, sanitizeDocumentFilenamePart } from "../../utils/documentFiles";
import { displayGradeDate, RESULT_LABELS } from "../exams/gradebook";
import { getBusinessTodayKey } from "../../utils/schedulingCalendar";
import { TRANSCRIPT_FORM } from "./transcriptForm";
export { TRANSCRIPT_COLUMN_WIDTHS, TRANSCRIPT_TABLE_WIDTH } from "./transcriptForm";

const PREFIX = "learner-transcript-preview:";
const text = (input) => input == null || input === "" ? null : String(input);
const display = (input) => input == null || input === "" ? "—" : String(input);
export const TRANSCRIPT_HEADERS = ["Stt", "Học Phần", "Mã số", "Số tín chỉ", "Điểm", "Ghi chú"];

// A report dataset, not a second score resolver. Scores, codes, credits and
// subject ordering are taken unchanged from learner-scorecard.
export function normalizeLearnerTranscript(scorecard, { now = new Date() } = {}) {
  const student = scorecard.student || {};
  const group = scorecard.group || {};
  return {
    schemaVersion: 3,
    title: "KẾT QUẢ HỌC TẬP",
    learner: {
      participantId: text(student.participantId), admissionRecordId: text(student.admissionRecordId),
      studentCode: text(student.code), fullName: text(student.fullName), dob: text(student.dob), pob: text(student.pob),
    },
    training: {
      majorName: text(student.major?.name), academicYear: text(student.academicYear), admissionDate: text(student.admissionDate),
      trainingLevel: text(student.trainingLevel), trainingModeName: text(student.trainingModeName),
      trainingModeGroup: text(student.trainingModeGroup), language: text(student.language),
      durationYears: student.durationYears ?? null, masterDiplomaNumber: text(student.masterDiplomaNumber),
    },
    classGroup: { id: text(group.id), code: text(group.code), name: text(group.name) },
    curriculumName: text(scorecard.curriculum?.name),
    // There is no canonical postgraduate GPA, issue-number or transcript signer
    // source in the current API. Never reuse undergraduate GPA or the login user.
    summary: { gpa: null, gradeScale: null },
    issuance: { number: null, date: getBusinessTodayKey(now) },
    signers: { specialistName: null, instituteDirectorName: null },
    form: { code: TRANSCRIPT_FORM.code, publishedOn: TRANSCRIPT_FORM.publishedOn, revision: TRANSCRIPT_FORM.revision },
    subjects: (scorecard.subjects || []).map((subject, index) => {
      const grade = subject.grade;
      const note = grade?.result === "exempt" && grade.details?.source !== "gradebook"
        ? "Miễn học" : grade?.result === "pending" ? "" : RESULT_LABELS[grade?.result] || "";
      return { index: index + 1, subjectId: text(subject.id), name: text(subject.name), code: text(subject.code),
        credits: subject.credits ?? null, score: grade?.score ?? null, note };
    }),
  };
}

// One presentation map is shared by HTML and DOCX, including all missing values.
export function transcriptMetadataRows(transcript) {
  const { learner, training } = transcript;
  const field = (label, input) => ({ label, value: display(input) });
  return [
    [field("Học viên", learner.fullName), field("Nơi sinh", learner.pob)],
    [field("Ngày sinh", displayGradeDate(learner.dob)), field("Chuyên ngành", training.majorName)],
    [field("Học viên cao học khoá", training.academicYear), field("Định hướng đào tạo", training.trainingModeName)],
    [field("Ngày nhập học", displayGradeDate(training.admissionDate)), field("Hình thức đào tạo", training.trainingModeGroup)],
    [field("Trình độ đào tạo", training.trainingLevel), field("Thời gian đào tạo", training.durationYears == null ? null : `${training.durationYears} năm`)],
    [field("Số hiệu văn bằng", training.masterDiplomaNumber), field("Ngôn ngữ đào tạo", training.language)],
  ];
}

export const transcriptSubjectValues = (subject) => [subject.index, subject.name || "", subject.code || "",
  subject.credits ?? "", subject.score ?? "", subject.score == null && subject.note === "Chưa có điểm" ? "" : subject.note || ""];
export const transcriptClassLabel = (transcript) => transcript.classGroup.code || transcript.classGroup.name || "";

export function transcriptDocumentDetails(transcript) {
  const [year, month, day] = transcript.issuance.date.split("-");
  return {
    numberLine: `Số:${"\u00a0".repeat(12)}${transcript.issuance.number || ""}/Khóa ${transcript.training.academicYear || ".".repeat(19)}/SĐH`,
    gpa: { label: TRANSCRIPT_FORM.gpaLabel, value: display(transcript.summary.gpa) },
    issueDate: `Hải Phòng, ngày ${day} tháng ${month} năm ${year}`,
    signatures: TRANSCRIPT_FORM.signatureRoles.map((roles, index) => ({ roles,
      name: index === 0 ? transcript.signers.specialistName : transcript.signers.instituteDirectorName })),
    footer: [`NBH:${transcript.form.publishedOn}-REV:${transcript.form.revision}`, transcript.form.code],
  };
}

export function learnerTranscriptFilename(transcript, format = "word") {
  const parts = [transcript.learner.studentCode, transcript.learner.fullName]
    .map(sanitizeDocumentFilenamePart).filter(Boolean);
  return `Bang-diem${parts.length ? `-${parts.join("-")}` : ""}.${format === "pdf" ? "pdf" : "docx"}`;
}

export function openLearnerTranscript(scorecard, reservedTab) {
  openDocumentPreview({ prefix: PREFIX, path: "/reports/learner-transcript/preview",
    snapshot: normalizeLearnerTranscript(scorecard), fallbackToCurrentTab: false, reservedTab });
}

export function readLearnerTranscript(id) {
  if (!id) return null;
  try {
    const data = JSON.parse(window.sessionStorage.getItem(`${PREFIX}${id}`));
    const nullableText = (input) => input === null || typeof input === "string";
    const scalar = (input) => nullableText(input) || (typeof input === "number" && Number.isFinite(input));
    const fields = (object, keys) => object && keys.every(key => nullableText(object[key]));
    return data?.version === 1 && data.schemaVersion === 3 && data.title === "KẾT QUẢ HỌC TẬP"
      && fields(data.learner, ["participantId", "admissionRecordId", "studentCode", "fullName", "dob", "pob"])
      && fields(data.training, ["majorName", "academicYear", "admissionDate", "trainingLevel", "trainingModeName", "trainingModeGroup", "language", "masterDiplomaNumber"])
      && scalar(data.training.durationYears) && fields(data.classGroup, ["id", "code", "name"]) && nullableText(data.curriculumName)
      && data.summary && scalar(data.summary.gpa) && scalar(data.summary.gradeScale)
      && fields(data.issuance, ["number", "date"]) && /^\d{4}-\d{2}-\d{2}$/.test(data.issuance.date)
      && fields(data.signers, ["specialistName", "instituteDirectorName"]) && fields(data.form, ["code", "publishedOn", "revision"])
      && Array.isArray(data.subjects) && data.subjects.every(subject => Number.isInteger(subject.index) && subject.index > 0
        && fields(subject, ["subjectId", "name", "code", "note"]) && scalar(subject.credits) && scalar(subject.score)) ? data : null;
  } catch { return null; }
}
