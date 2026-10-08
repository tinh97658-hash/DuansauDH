import { admissionRecordSnapshot, DEFAULT_ADMISSION_RULES, scoreAdmission } from "../../plan/admission-scoring.js";
import { TEST_MARKER as tag, seedId as id, mbaMajorId, robotMajorId, financeMajorId, subjectId, mbaSubjects, robotRequired, robotElectives, type SeedRow, type SubjectDefinition } from "./realistic-test-catalog.js";

export const curriculumId = (key: string) => id(`curriculum:${key}`);
export const classId = (key: string) => id(`class:${key}`);
export const offeringId = (key: string) => id(`offering:${key}`);
export const learnerId = (key: string) => id(`learner:${key}`);
export const fixtureAnchor = "2026-10-07";

export function scenarioRows(anchor = fixtureAnchor): SeedRow[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor) || new Date(`${anchor}T12:00:00Z`).toISOString().slice(0, 10) !== anchor) throw new Error("Invalid anchor date");
  const rows: SeedRow[] = [];
  const add = (model: string, key: string, values: Record<string, any>) => rows.push({ model, values: { id: id(key), ...values } });
  const date = (offset: number) => new Date(Date.parse(`${anchor}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
  const note = (text: string) => `${tag}: ${text}`;
  // Confirmation-state CHECK requires an actor FK. Use a separate TEST examiner,
  // without a password, instead of attributing synthetic confirmations to a real admin.
  add("Staff", "actor", { name: note("Người xác nhận dữ liệu giả"), email: "seed-test-2026-actor@example.invalid", role: "examiner", password: null, canManageScheduling: false });
  function curriculum(key: string, majorId: string, year: string, definitions: SubjectDefinition[], group?: string) {
    add("Curriculum", `curriculum:${key}`, { code: `${tag}-${key}`, name: note(key.startsWith("ROBOT") ? `Phương án Robot ${group} - 60 TC` : "Tập con QTKD có căn cứ - 44 TC, chưa đủ CTĐT"),
      majorId, program: "masters", applicableFromYear: year, totalCredits: definitions.reduce((sum, def) => sum + def[2], 0), active: true, note: note("Phương án kiểm thử, không phải quyết định ban hành CTĐT") });
    for (const [index, block] of ["KC", "CS", "CN", "TC", "CH"].entries()) add("CurriculumBlock", `block:${key}:${block}`, {
      curriculumId: curriculumId(key), code: block, name: ({ KC: "Kiến thức chung", CS: "Kiến thức ngành", CN: "Kiến thức chuyên ngành", TC: "Tự chọn", CH: "Thực tập và tốt nghiệp" })[block], sortOrder: index, minCredits: 0,
    });
    if (group) add("CurriculumElectiveGroup", `elective-group:${key}`, { curriculumId: curriculumId(key), code: group, name: `Phương án ${group} - chọn 10 TC`, minCredits: 10, maxCredits: 10, sortOrder: 0 });
    definitions.forEach(([code, , credits, block], index) => add("CurriculumSubject", `entry:${key}:${code}`, {
      curriculumId: curriculumId(key), blockId: id(`block:${key}:${block}`), electiveGroupId: block === "TC" ? id(`elective-group:${key}`) : null,
      subjectId: subjectId(majorId, code), isRequired: block !== "TC", credits, sortOrder: index,
    }));
  }
  curriculum("MBA26", mbaMajorId, "2026", mbaSubjects);
  // Historical test scopes reuse known subjects, explicitly NOT an official 2024/2025 curriculum.
  curriculum("MBA24", mbaMajorId, "2024", mbaSubjects);
  curriculum("MBA25", mbaMajorId, "2025", mbaSubjects);
  for (const group of ["3.2a", "3.2b"]) curriculum(`ROBOT26${group.slice(-1).toUpperCase()}`, robotMajorId, "2026",
    [...robotRequired, ...robotElectives.filter(def => !def[4] || def[4] === group)], group);

  add("TrainingProgram", "training-program", { code: `${tag}-THS`, name: note("Chương trình kiểm thử thạc sĩ"), trainingLevelId: id("master-level"), trainingModeId: id("mode"), durationYears: 2, active: true });
  // TrainingMode/Group are supplied before this row by the runner's reference additions.
  for (const year of ["2024", "2025", "2026"]) {
    add("TrainingPlan", `plan:${year}`, { code: `${tag}-${year}`, name: note(`Kế hoạch giả định ${year}`), programId: id("training-program"), academicYear: year, status: "active", targetStudents: 100, startDate: `${year}-01-01`, endDate: `${year}-12-31`, note: note("TEST") });
    add("AnnualFee", `fee:${year}`, { planId: id(`plan:${year}`), name: note("Học phí giả định, không phải mức thu thực tế"), amount: 1000000, dueDate: `${year}-12-31`, note: note("TEST") });
    for (const majorId of [mbaMajorId, robotMajorId]) add("AdmissionTarget", `target:${year}:${majorId}`, { planId: id(`plan:${year}`), majorId, trainingModeId: id("mode"), quota: 100, note: note("Chỉ tiêu giả định") });
    for (const intake of [1, 2]) add("AdmissionRound", `round:${year}:${intake}`, { name: note(`Đợt ${intake}/${year}`), academicYear: year,
      regulationNo: note("Quy tắc TEST, không phải văn bản hành chính"), decisionNo: note("Quyết định TEST"), decisionDate: `${year}-09-01`,
      majorThresholds: [mbaMajorId, robotMajorId, financeMajorId].map(majorId => ({ majorId, cutoff: 15 })), rules: { ...DEFAULT_ADMISSION_RULES } });
  }
  const groupDefs: Array<[string, string, string, string | null, number, number, string]> = [
    ["EMPTY", financeMajorId, "2026", null, 0, 20, "QLTC 2026.1.901"],
    ["SMALL", mbaMajorId, "2026", "MBA26", 3, 20, `${tag}_MBA_1`],
    ["NEAR", mbaMajorId, "2026", "MBA26", 19, 20, `${tag}_MBA_2`],
    ["FULL", robotMajorId, "2026", "ROBOT26A", 20, 20, `${tag}_ROBOT_1`],
    ["LONG", robotMajorId, "2026", "ROBOT26B", 30, 30, `${tag}_ROBOT_2`],
    ["OLD24", mbaMajorId, "2024", "MBA24", 2, 20, `${tag}_MBA_24`],
    ["OLD25", mbaMajorId, "2025", "MBA25", 2, 20, `${tag}_MBA_25`],
  ];
  const records = new Map<string, any>();
  function learner(key: string, majorId: string, year: string, decision = "admitted", score = 16, paid = true, intake = 1) {
    const majorName = majorId === mbaMajorId ? "Quản trị kinh doanh" : majorId === robotMajorId ? "Cơ khí thông minh và Robot" : "Quản lý tài chính";
    const payment = { paid, updatedAt: `${year}-09-02T00:00:00.000Z`, updatedBy: tag, updatedById: null };
    const record = { id: learnerId(key), code: `${tag}-${key}`, fullName: `TEST Học viên ${key}`, lastName: "TEST Học viên", firstName: key,
      email: `seed-test-2026-${key.toLowerCase()}@example.invalid`, gender: "Nam", dob: "1995-01-01", majorId, majorName,
      trainingLevel: "Thạc sĩ", trainingModeId: id("mode"), trainingModeName: "Chính quy - Tập trung", planId: id(`plan:${year}`), academicYear: year,
      status: decision === "admitted" ? "approved" : decision, studyStatus: decision === "admitted" ? paid ? "Đang học" : "Đã trúng tuyển" : decision === "rejected" ? "Không trúng tuyển" : "Nộp hồ sơ đầu vào",
      gpa: "7.5", gradClassification: "Khá", supplementSubjectsCount: 0, documents: {}, note: note(key), extraData: { seed: tag, scenario: key, ...(decision === "admitted" ? { tuitionPayment: payment } : {}) } };
    rows.push({ model: "AdmissionRecord", values: record }); records.set(key, record);
    const round = rows.find(row => row.model === "AdmissionRound" && row.values.id === id(`round:${year}:${intake}`))!.values;
    const evaluation = { id: id(`evaluation:${key}`), admissionRecordId: record.id, roundId: round.id, inputs: { manualTotal: score }, recordSnapshot: admissionRecordSnapshot(record), decision, version: decision === "pending" ? 1 : 2 };
    rows.push({ model: "AdmissionEvaluation", values: evaluation });
    for (const action of decision === "pending" ? ["saved"] : ["saved", decision]) add("AdmissionEvaluationHistory", `history:${key}:${action}`, {
      admissionRecordId: record.id, action, actor: tag,
      snapshot: { actorId: null, record: { ...evaluation.recordSnapshot, majorName }, evaluation: { ...evaluation, ...(action === "saved" ? { decision: "pending", version: 1 } : {}) }, round, result: scoreAdmission(record, evaluation.inputs, round), note: note(key), decisionNo: round.decisionNo },
    });
    if (decision === "admitted" && paid) add("AdmissionEvaluationHistory", `history:${key}:tuition`, { admissionRecordId: record.id, action: "tuition_paid", actor: tag, snapshot: { actorId: null, record: { ...evaluation.recordSnapshot, fullName: record.fullName, studyStatus: record.studyStatus }, tuitionPayment: payment, previousPayment: null } });
  }
  for (const [key, majorId, year, ct, count, maxStudents, code] of groupDefs) {
    add("ClassGroup", `class:${key}`, { program: "masters", code, name: note(`${key} - ${count}/${maxStudents}`), majorId, academicYear: year,
      curriculumId: ct ? curriculumId(ct) : null, maxStudents, status: "open", note: note(key), groupType: "ADMINISTRATIVE", allowedWeekdays: [1, 2, 3, 4, 5, 6, 0] });
    for (let n = 1; n <= count; n++) {
      const person = `${key}-${String(n).padStart(2, "0")}`;
      learner(person, majorId, year, "admitted", n % 2 ? 15 : 17, true, n % 2 + 1);
      add("ClassGroupMember", `member:${person}`, { classGroupId: classId(key), admissionRecordId: learnerId(person), studentId: null, enrolledAt: `${year}-09-02T00:00:00Z`, note: note(person) });
    }
    if (ct?.startsWith("ROBOT")) for (const [subCode] of robotElectives.filter(def => !def[4] || def[4] === (ct.endsWith("A") ? "3.2a" : "3.2b"))) {
      add("ClassGroupElective", `class-elective:${key}:${subCode}`, { classGroupId: classId(key), curriculumSubjectId: id(`entry:${ct}:${subCode}`) });
    }
  }
  learner("BELOW", mbaMajorId, "2026", "rejected", 14, false);
  learner("AT-PENDING", mbaMajorId, "2026", "pending", 15, false);
  learner("ABOVE-PENDING", robotMajorId, "2026", "pending", 18, false, 2);
  learner("UNPAID", mbaMajorId, "2026", "admitted", 15, false, 2);
  learner("INDIVIDUAL", mbaMajorId, "2026", "admitted", 16, true);
  learner("TRANSFER", mbaMajorId, "2026", "admitted", 16, true);
  learner("RECOGNITION", robotMajorId, "2026", "admitted", 16, true);

  for (const [key, capacity] of [["LARGE", 60], ["EXACT", 22], ["SHORT", 21], ["TINY", 2], ["ONLINE", 60]] as const) add("Room", `room:${key}`, { code: `${tag}-${key}`, name: note(key === "ONLINE" ? "Địa điểm Online giả định (không có meeting thật)" : `Phòng ${key} (${capacity} chỗ)`), capacity, isActive: true });
  for (const [key, majorId, disciplineCode] of [["MBA", mbaMajorId, "8340101"], ["MBA2", mbaMajorId, "8340101"], ["ROBOT", robotMajorId, "8520103"]]) add("Lecturer", `lecturer:${key}`, {
    code: `${tag}-${key}`, name: note(`Giảng viên ${key}`), email: `${key.toLowerCase()}-seed-test-2026@example.invalid`, academicDegree: "Tiến sĩ", disciplineId: id(`discipline:${disciplineCode}`), majorId, active: true,
  });
  add("Lecturer", "lecturer:COMMON", { code: `${tag}-COMMON`, name: note("Giảng viên dùng chung - Triết học"), email: "common-seed-test-2026@example.invalid", disciplineId: id("discipline:8340101"), majorId: mbaMajorId, faculty: "Viện Đào tạo Sau đại học", department: "Bộ môn Lý luận chính trị", active: true });

  const offerings: Array<[string, string, string, string[], boolean]> = [
    ["MERGED", mbaMajorId, "QTKH540", ["SMALL", "NEAR"], false],
    ["FUTURE", mbaMajorId, "QTLK559", ["SMALL"], false],
    ["NOSESSIONS", mbaMajorId, "QTNL560", ["NEAR"], false],
    ["ROBOT-A", robotMajorId, "CKVL504", ["FULL"], false],
    ["ROBOT-B", robotMajorId, "CKRB521", ["LONG"], false],
    ["COMPLETED", mbaMajorId, "QLTK508", ["OLD24"], true],
    ["COMMON", mbaMajorId, "HPTH501", ["FULL", "NEAR"], false],
    ["INDIVIDUAL", mbaMajorId, "QTKN541", ["SMALL"], false],
    ["RETAKE", mbaMajorId, "QLTK508", ["SMALL"], false],
  ];
  for (const [key, majorId, code, groups, complete] of offerings) {
    add("CourseOffering", `offering:${key}`, { subjectId: subjectId(majorId, code), name: note(key), note: note(key),
      status: complete ? "completed" : "active", completedAt: complete ? `${date(-20)}T12:00:00Z` : null, completedByStaffId: complete ? id("actor") : null, participantNotes: [], retakeWeekdays: [1, 2, 3, 4, 5, 6, 0] });
    for (const group of groups) add("CourseOfferingClassGroup", `offering-link:${key}:${group}`, { courseOfferingId: offeringId(key), classGroupId: classId(group) });
  }
  add("CourseOfferingStudent", "individual-link", { courseOfferingId: offeringId("INDIVIDUAL"), admissionRecordId: learnerId("INDIVIDUAL") });
  add("CourseOfferingStudent", "retake-link", { courseOfferingId: offeringId("RETAKE"), admissionRecordId: learnerId("OLD24-01") });
  add("LearnerSubjectResult", "retake-result", { admissionRecordId: learnerId("OLD24-01"), subjectId: subjectId(mbaMajorId, "QLTK508"),
    courseOfferingId: offeringId("COMPLETED"), sourceType: "regular", academicYear: "2024", status: "completed", result: "failed", score: 3, completedAt: date(-20), note: note("Kết quả học lại") });
  function session(key: string, offering: string, offset: number, status: string, lecturer: string, room: string) {
    add("TeachingSession", `session:${key}`, { courseOfferingId: offeringId(offering), sessionDate: date(offset), period: "MORNING", startTime: "07:00:00", endTime: "11:00:00",
      status, lecturerId: id(`lecturer:${lecturer}`), roomId: id(`room:${room}`), note: note(key), confirmedAt: status === "planned" ? null : `${date(offset)}T05:00:00Z`, confirmedByStaffId: status === "planned" ? null : id("actor") });
  }
  session("MERGED-HELD", "MERGED", -7, "held", "MBA", "EXACT");
  session("MERGED-PENDING", "MERGED", -1, "planned", "MBA", "EXACT");
  session("MERGED-FUTURE", "MERGED", 7, "planned", "MBA", "SHORT");
  session("FUTURE", "FUTURE", 8, "planned", "MBA", "LARGE");
  session("ROBOT-HELD", "ROBOT-A", -8, "held", "ROBOT", "LARGE");
  session("ROBOT-NOTHELD", "ROBOT-A", -2, "not_held", "ROBOT", "LARGE");
  session("ROBOT-FUTURE", "ROBOT-A", 14, "planned", "ROBOT", "LARGE");
  session("ROBOT-B", "ROBOT-B", 15, "planned", "ROBOT", "ONLINE");
  session("COMPLETED", "COMPLETED", -21, "held", "MBA", "LARGE");
  session("COMMON", "COMMON", 16, "planned", "COMMON", "LARGE");
  // No overlapping sessions are inserted. The occupied MERGED-FUTURE slot is a UI conflict target.

  const gradeCases = [
    { eligible: true, examExempt: false, examScore: 3, courseScore: 3, result: "failed", grade4: 0, letterGrade: "F" },
    { eligible: true, examExempt: false, examScore: 5, courseScore: 5, result: "passed", grade4: 1, letterGrade: "D" },
    { eligible: true, examExempt: false, examScore: 9, courseScore: 9, result: "passed", grade4: 4, letterGrade: "A" },
    { eligible: true, examExempt: true, examScore: null, courseScore: null, result: "exempt", grade4: null, letterGrade: "" },
    { eligible: false, examExempt: false, examScore: null, courseScore: null, result: "pending", grade4: null, letterGrade: "" },
    { eligible: true, examExempt: false, examScore: null, courseScore: null, result: "pending", grade4: null, letterGrade: "" },
  ];
  add("CourseExamGradebook", "gradebook:LONG", { classGroupId: classId("LONG"), courseOfferingId: offeringId("ROBOT-B"), revision: 1,
    grades: Array.from({ length: 30 }, (_, n) => ({ participantId: `admission:${learnerId(`LONG-${String(n + 1).padStart(2, "0")}`)}`, testScore: null, assignmentScore: null, attemptScores: [], ...gradeCases[n % gradeCases.length] })) });

  add("MajorTransfer", "transfer", { admissionRecordId: learnerId("TRANSFER"), fromMajorId: mbaMajorId, toMajorId: robotMajorId,
    fromClassGroupId: null, fromCurriculumId: null, toCurriculumId: null, status: "pending", reason: note("Chờ hội đồng, chưa đổi ngành/lớp"), previousAdmissionStatus: "approved", previousStudyStatus: "Đang học" });
  for (const [n, status, result, score] of [[0, "registered", "pending", null], [1, "studying", "pending", null], [2, "completed", "passed", 8], [3, "completed", "failed", 3]] as const) {
    const code = ["CKVL504", "KTGC507", "HPTH501", "CKTB505"][n];
    add("LearnerSubjectResult", `result:${n}`, { admissionRecordId: learnerId("RECOGNITION"), subjectId: subjectId(robotMajorId, code), sourceType: "early_enrollment", academicYear: "2026", status, result, score,
      completedAt: status === "completed" ? date(-30) : null, decisionNo: status === "completed" ? note("Kết quả TEST") : null, note: note("Không công nhận registered/studying/failed") });
  }
  add("SubjectRecognition", "recognition", { admissionRecordId: learnerId("RECOGNITION"), learningResultId: id("result:2"), sourceSubjectId: subjectId(robotMajorId, "HPTH501"), targetSubjectId: subjectId(robotMajorId, "HPTH501"),
    status: "approved", basis: "canonical_subject", sourceType: "early_enrollment", decisionNo: note("Công nhận TEST"), decidedAt: `${date(-29)}T00:00:00Z`, note: note("Kết quả đạt được công nhận; các kết quả khác chưa được công nhận") });
  return rows;
}
