import { AdmissionEvaluationService } from "../../src/plan/admission-evaluation.service.js";
import { MajorTransferService } from "../../src/plan/major-transfer.service.js";
import { PlanService } from "../../src/plan/plan.service.js";
import { SubjectRecognitionService } from "../../src/plan/subject-recognition.service.js";
import { admissionRecordSnapshot, DEFAULT_ADMISSION_RULES } from "../../src/plan/admission-scoring.js";

const clone = (value: any) => JSON.parse(JSON.stringify(value));
function model(values: any) {
  const row: any = { ...values };
  row.toJSON = () => clone({ ...row, toJSON: undefined });
  row.update = jest.fn(async (patch) => Object.assign(row, patch));
  return row;
}

// Connect the real transfer, admission and normal record-update services to the
// same model stores. In particular, the admission guard is never mocked away.
async function setup() {
  const tx = { LOCK: { UPDATE: "UPDATE" } };
  const db = { transaction: jest.fn(async (callback) => callback(tx)) };
  const actor = { id: "admin", name: "Quản trị viên" };
  const record = model({ id: "record", code: "HV26001", studentId: "student", fullName: "Nguyễn Văn A",
    majorId: "A", majorName: "Ngành A", trainingLevel: "Thạc sĩ", academicYear: "2026",
    status: "pending", studyStatus: "Nộp hồ sơ đầu vào", extraData: { existing: "keep" } });
  const records = { findByPk: jest.fn(async () => record), findAll: jest.fn(async () => [record]) };
  const majorA = { id: "A", name: "Ngành A", active: true, program: "masters" };
  const majorB = { id: "B", name: "Ngành B", active: true, program: "masters" };
  const majors = { findByPk: jest.fn(async (id) => id === "A" ? majorA : majorB),
    findAll: jest.fn(async ({ where }) => typeof where.id === "string" ? [where.id === "A" ? majorA : majorB] : [majorA, majorB]) };
  const roundA = model({ id: "round-A", name: "Đợt A", academicYear: "2026", majorThresholds: [{ majorId: "A", cutoff: 15 }, { majorId: "B", cutoff: 17 }], rules: DEFAULT_ADMISSION_RULES });
  const roundB = model({ ...roundA.toJSON(), id: "round-B", name: "Đợt B" });
  const rounds = { findByPk: jest.fn(async (id) => id === roundA.id ? roundA : roundB) };
  let current: any = model({ id: "eval-A", admissionRecordId: record.id, roundId: roundA.id,
    decision: "pending", version: 1, inputs: { manualTotal: 16 }, recordSnapshot: admissionRecordSnapshot(record) });
  const attachDestroy = (evaluation: any) => {
    evaluation.destroy = jest.fn(async () => { current = null; });
    return evaluation;
  };
  attachDestroy(current);
  const evaluations = { findOne: jest.fn(async () => current), findAll: jest.fn(async () => current ? [current] : []),
    create: jest.fn(async (values) => { current = attachDestroy(model({ id: "eval-B", ...values })); return current; }) };
  const entries: any[] = [];
  const history = { create: jest.fn(async (values) => {
    const entry = model({ id: `history-${entries.length + 1}`, createdAt: new Date().toISOString(), ...clone(values) });
    entries.push(entry); return entry;
  }), findAll: jest.fn(async () => [...entries].reverse()) };
  let transfer: any;
  const transfers = { findOne: jest.fn(async () => transfer?.status === "pending" ? transfer : null),
    create: jest.fn(async (values) => { transfer = model({ id: "transfer", ...values }); return transfer; }),
    findByPk: jest.fn(async () => transfer) };
  const curriculum = { id: "curriculum-B", majorId: "B", program: "masters", applicableFromYear: "2026", active: true };
  const curriculums = { findByPk: jest.fn(async () => curriculum) };
  const membership = { classGroupId: "class-A", $get: jest.fn(async () => ({ curriculumId: "curriculum-A" })) };
  const memberships = { findOne: jest.fn(async () => membership), create: jest.fn(), destroy: jest.fn() };
  const offeringGroups = { findAll: jest.fn(async () => [{ courseOfferingId: "completed-1" }, { courseOfferingId: "completed-2" }]) };
  const offeringStudents = { bulkCreate: jest.fn() };
  const recognitions = { proposeForRecord: jest.fn(), decide: jest.fn() };
  const admission = new AdmissionEvaluationService(records as never, rounds as never, evaluations as never,
    history as never, majors as never, db as never, transfers as never);
  const service = new MajorTransferService(transfers as never, records as never, majors as never, curriculums as never,
    memberships as never, offeringGroups as never, offeringStudents as never, recognitions as never, db as never, admission);
  const plan = new PlanService({} as never, {} as never, {} as never, majors as never, records as never,
    db as never, {} as never, {} as never, recognitions as never, memberships as never, admission);
  // Generate the actual admitted snapshot via the existing decision workflow.
  await admission.decide(record.id, { decision: "admitted", version: 1, note: "Trúng tuyển A", decisionNo: "QD-A", decisionDate: "2026-10-09" }, actor);
  const oldEvaluation = current;
  const oldHistory = clone(entries[0]);
  record.update.mockClear(); history.create.mockClear(); oldEvaluation.update.mockClear();
  const request = () => service.request(record.id, { toMajorId: "B", reason: "Chuyển chuyên ngành" });
  const approve = () => service.decide("transfer", { decision: "approved", toCurriculumId: curriculum.id, note: "Đồng ý chuyển A sang B" }, actor);
  return { service, admission, plan, request, approve, record, records, majorB, majors, curriculum, curriculums, rounds,
    roundA, roundB, oldEvaluation, oldHistory, evaluations, history, entries, transfers, memberships, membership,
    offeringGroups, offeringStudents, recognitions, actor, tx, db, current: () => current, transfer: () => transfer };
}

describe("Approved major transfer and admission cycles", () => {
  it("approves A admitted -> B pending without reopening, preserving the original decision snapshot", async () => {
    const s = await setup();
    await s.request();
    // Today's threshold/name may change; the A result must use its frozen evidence.
    s.roundA.majorThresholds[0].cutoff = 20;
    await s.approve();
    expect(s.record).toMatchObject({ majorId: "B", majorName: "Ngành B", status: "pending", studyStatus: "Nộp hồ sơ đầu vào", code: "HV26001", studentId: "student" });
    expect(s.transfer()).toMatchObject({ status: "approved", toCurriculumId: "curriculum-B", decisionNote: "Đồng ý chuyển A sang B", decidedAt: expect.any(Date) });
    expect(s.oldEvaluation.update).not.toHaveBeenCalled();
    expect(s.oldEvaluation.destroy).toHaveBeenCalledWith({ transaction: s.tx });
    expect(s.current()).toBeNull();
    expect(clone(s.entries[0])).toEqual(s.oldHistory);
    expect(s.entries[1]).toMatchObject({ action: "major_transfer", actor: "Quản trị viên", snapshot: {
      actorId: "admin", sourceHistoryId: "history-1", evaluation: { id: "eval-A", decision: "admitted", inputs: { manualTotal: 16 } },
      record: { majorId: "A", majorName: "Ngành A" }, result: { total: 16, cutoff: 15, meetsCutoff: true }, decisionNo: "QD-A",
      majorTransfer: { id: "transfer", fromMajorId: "A", toMajorId: "B", toCurriculumId: "curriculum-B" },
    } });
    const detail = await s.admission.detail(s.record.id);
    expect(detail.evaluation).toBeNull();
    expect(detail.history).toHaveLength(2);
    expect(detail.history[1].snapshot.evaluation.decision).toBe("admitted");
    expect(detail.history[1].snapshot.record.majorId).toBe("A");
    expect(s.history.create).toHaveBeenCalledWith(expect.anything(), { transaction: s.tx });
  });

  it("normal AdmissionRecord update still blocks a manual A -> B change even with a pending transfer", async () => {
    const s = await setup(); await s.request();
    await expect(s.plan.updateAdmissionRecord(s.record.id, { majorId: "B" })).rejects.toThrow("Mở lại kết quả trước khi thay đổi");
    expect(s.record.update).not.toHaveBeenCalled(); expect(s.oldEvaluation.destroy).not.toHaveBeenCalled();
    expect(s.record.majorId).toBe("A");
  });

  it("a pending request leaves major, admission/study status, membership and history untouched", async () => {
    const s = await setup(); const before = s.record.toJSON();
    const transfer = await s.request();
    expect(transfer).toMatchObject({ status: "pending", fromMajorId: "A", toMajorId: "B", fromClassGroupId: "class-A" });
    expect(s.record.toJSON()).toEqual(before); expect(s.memberships.destroy).not.toHaveBeenCalled();
    expect(s.memberships.create).not.toHaveBeenCalled(); expect(s.history.create).not.toHaveBeenCalled();
    expect(s.oldEvaluation.destroy).not.toHaveBeenCalled();
  });

  it("rejecting keeps A admitted and its existing class and evaluation", async () => {
    const s = await setup(); await s.request(); const before = s.record.toJSON();
    await s.service.decide("transfer", { decision: "rejected", note: "Không đồng ý" }, s.actor);
    expect(s.record.toJSON()).toEqual(before); expect(s.transfer().status).toBe("rejected");
    expect(s.memberships.destroy).not.toHaveBeenCalled(); expect(s.memberships.create).not.toHaveBeenCalled();
    expect(s.oldEvaluation.destroy).not.toHaveBeenCalled(); expect(s.history.create).not.toHaveBeenCalled();
    expect(s.recognitions.proposeForRecord).not.toHaveBeenCalled();
  });

  it("preserves completed offerings, proposes recognition, and detaches membership in the approval transaction", async () => {
    const s = await setup(); await s.request(); await s.approve();
    expect(s.offeringGroups.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { classGroupId: "class-A" },
      include: [expect.objectContaining({ where: { status: "completed" }, required: true })], transaction: s.tx }));
    expect(s.offeringStudents.bulkCreate).toHaveBeenCalledWith([
      { courseOfferingId: "completed-1", admissionRecordId: "record" }, { courseOfferingId: "completed-2", admissionRecordId: "record" },
    ], { transaction: s.tx, ignoreDuplicates: true });
    expect(s.recognitions.proposeForRecord).toHaveBeenCalledWith("record", { curriculumId: "curriculum-B", majorTransferId: "transfer" }, s.tx);
    expect(s.memberships.destroy).toHaveBeenCalledWith(expect.objectContaining({ transaction: s.tx }));
    expect(s.recognitions.proposeForRecord.mock.invocationCallOrder[0]).toBeLessThan(s.memberships.destroy.mock.invocationCallOrder[0]);
    expect(s.offeringStudents.bulkCreate.mock.invocationCallOrder[0]).toBeLessThan(s.memberships.destroy.mock.invocationCallOrder[0]);
  });

  it("starts and admits a separate B cycle in another round while A stays admitted in history", async () => {
    const s = await setup(); await s.request(); await s.approve();
    const ranking = await s.admission.ranking(s.roundB.id);
    expect(ranking.rows[0]).toMatchObject({ majorId: "B", version: 0, decision: "pending", total: null });
    await s.admission.save(s.record.id, { roundId: s.roundB.id, version: 0, inputs: { manualTotal: 18 } }, s.actor);
    expect(s.current()).toMatchObject({ id: "eval-B", roundId: "round-B", decision: "pending", recordSnapshot: { majorId: "B" } });
    expect((await s.admission.detail(s.record.id)).evaluation).toMatchObject({ majorName: "Ngành B", result: { total: 18, cutoff: 17 } });
    await s.admission.decide(s.record.id, { decision: "admitted", version: 1, note: "Trúng tuyển B" }, s.actor);
    expect(s.current().decision).toBe("admitted"); expect(s.record.status).toBe("approved");
    expect(clone(s.entries[0])).toEqual(s.oldHistory);
    const detail = await s.admission.detail(s.record.id);
    expect(detail.evaluation.recordSnapshot.majorId).toBe("B");
    expect(detail.history.find((entry) => entry.id === "history-1")?.snapshot).toMatchObject({ record: { majorId: "A" }, evaluation: { decision: "admitted" } });
    await expect(s.plan.updateAdmissionRecord(s.record.id, { majorId: "A" })).rejects.toThrow("Mở lại");
  });

  it("supports new B scores and batch admission in the same round without reusing A inputs", async () => {
    const s = await setup(); await s.request(); await s.approve();
    await s.admission.saveScores(s.roundA.id, { rows: [{ admissionRecordId: s.record.id, version: 0, score: 18 }] }, s.actor);
    expect(s.current().inputs).toEqual({ manualTotal: 18 });
    const preview = await s.admission.preview(s.roundA.id);
    await s.admission.confirmBatch(s.roundA.id, { previewToken: preview.previewToken, admissionRecordIds: [s.record.id] }, s.actor);
    expect(s.current().decision).toBe("admitted"); expect(clone(s.entries[0])).toEqual(s.oldHistory);
  });

  it("calls the real recognition service with B's current major and still captures the old class before detaching it", async () => {
    const s = await setup(); await s.request();
    const source = { id: "subject-A", name: "Triết học", credits: 3, canonicalSubjectId: "root" };
    const target = { id: "subject-B", name: "Triết học", credits: 3, canonicalSubjectId: "root" };
    const results = { findAll: jest.fn(async ({ attributes }) => attributes ? [] : [
      { id: "result", subjectId: source.id, subject: source, sourceType: "regular", status: "completed", result: "passed", courseOfferingId: "completed-1" },
    ]), bulkCreate: jest.fn() };
    const recognitions = { findAll: jest.fn(async () => []), create: jest.fn(async (values) => model({ id: "recognition", ...values })) };
    const memberships = { findAll: jest.fn(async () => {
      expect(s.memberships.destroy).not.toHaveBeenCalled(); return [{ classGroupId: "class-A" }];
    }) };
    const db = { query: jest.fn(async () => [{ courseOfferingId: "completed-1" }]) };
    const realRecognition = new SubjectRecognitionService(results as never, recognitions as never, {} as never,
      s.records as never, s.curriculums as never, { findAll: jest.fn(async () => [{ subject: target }]) } as never,
      {} as never, { findAll: jest.fn(async () => [{ id: "completed-1", subjectId: source.id }]) } as never,
      { findAll: jest.fn(async () => []) } as never, memberships as never, db as never);
    s.recognitions.proposeForRecord.mockImplementation((id, dto, tx) => realRecognition.proposeForRecord(id, dto, tx));
    await s.approve();
    expect(recognitions.create).toHaveBeenCalledWith(expect.objectContaining({ admissionRecordId: "record",
      majorTransferId: "transfer", targetSubjectId: "subject-B", status: "approved", basis: "canonical_subject" }), { transaction: s.tx });
    expect(results.bulkCreate).toHaveBeenCalled(); expect(s.memberships.destroy).toHaveBeenCalled();
  });

  it.each(["same", "inactive", "wrongProgram", "duplicate"])("rejects invalid request: %s", async (problem) => {
    const s = await setup();
    if (problem === "inactive") s.majorB.active = false;
    if (problem === "wrongProgram") s.majorB.program = "doctoral";
    if (problem === "duplicate") { await s.request(); s.transfers.create.mockClear(); }
    await expect(s.service.request(s.record.id, { toMajorId: problem === "same" ? "A" : "B" })).rejects.toThrow();
    expect(s.transfers.create).not.toHaveBeenCalled(); expect(s.record.update).not.toHaveBeenCalled();
  });

  it.each(["inactiveMajor", "wrongMajorProgram", "missingMajor", "missingCurriculum", "wrongCurriculumMajor", "wrongCurriculumProgram", "wrongYear", "inactiveCurriculum", "sourceChanged", "sameTarget"])("retains approval validation: %s", async (problem) => {
    const s = await setup(); await s.request();
    if (problem === "inactiveMajor") s.majorB.active = false;
    if (problem === "wrongMajorProgram") s.majorB.program = "doctoral";
    if (problem === "missingMajor") s.majors.findByPk.mockResolvedValue(null as never);
    if (problem === "missingCurriculum") s.curriculums.findByPk.mockResolvedValue(null as never);
    if (problem === "wrongCurriculumMajor") s.curriculum.majorId = "A";
    if (problem === "wrongCurriculumProgram") s.curriculum.program = "doctoral";
    if (problem === "wrongYear") s.curriculum.applicableFromYear = "2027";
    if (problem === "inactiveCurriculum") s.curriculum.active = false;
    if (problem === "sourceChanged") s.record.majorId = "other";
    if (problem === "sameTarget") s.transfer().toMajorId = "A";
    await expect(s.approve()).rejects.toThrow();
    expect(s.memberships.destroy).not.toHaveBeenCalled(); expect(s.recognitions.proposeForRecord).not.toHaveBeenCalled();
    expect(s.oldEvaluation.destroy).not.toHaveBeenCalled(); expect(s.history.create).not.toHaveBeenCalled();
  });

  it.each(["pending", "rejected"])("cannot archive admission using a %s transfer as a bypass", async (status) => {
    const s = await setup(); await s.request(); s.transfer().status = status;
    await expect(s.admission.archiveForApprovedMajorTransfer("transfer", s.actor, s.tx as never)).rejects.toThrow("đã được duyệt");
    expect(s.oldEvaluation.destroy).not.toHaveBeenCalled();
    await expect(s.plan.updateAdmissionRecord(s.record.id, { majorId: "B" })).rejects.toThrow("Mở lại");
  });

  it("fails the whole approval transaction if the decided snapshot is missing, instead of inventing A's old threshold", async () => {
    const s = await setup(); await s.request(); s.entries.length = 0;
    await expect(s.approve()).rejects.toThrow("Thiếu snapshot quyết định xét tuyển cũ");
    await expect(s.db.transaction.mock.results.at(-1)?.value).rejects.toThrow("Thiếu snapshot");
    expect(s.oldEvaluation.destroy).not.toHaveBeenCalled(); expect(s.history.create).not.toHaveBeenCalled();
  });

  it("does not clear the evaluation if archiving history fails", async () => {
    const s = await setup(); await s.request(); s.history.create.mockRejectedValueOnce(new Error("history write failed"));
    await expect(s.approve()).rejects.toThrow("history write failed");
    expect(s.oldEvaluation.destroy).not.toHaveBeenCalled();
  });

  it("also handles legacy learners with no current evaluation, and B can start its first evaluation", async () => {
    const s = await setup(); await s.oldEvaluation.destroy(); s.oldEvaluation.destroy.mockClear();
    await s.request(); await s.approve();
    expect(s.oldEvaluation.destroy).not.toHaveBeenCalled();
    await s.admission.save(s.record.id, { roundId: "round-B", version: 0, inputs: { manualTotal: 18 } }, s.actor);
    expect(s.current()).toMatchObject({ decision: "pending", recordSnapshot: { majorId: "B" } });
    expect(clone(s.entries[0])).toEqual(s.oldHistory);
  });

  it("archives a pending A evaluation using its saved evidence rather than copying A's scores to B", async () => {
    const s = await setup();
    await s.admission.decide(s.record.id, { decision: "reopen", version: 2, note: "Đối soát A" }, s.actor);
    await s.request(); await s.approve();
    expect(s.current()).toBeNull();
    expect(s.entries.at(-1)).toMatchObject({ action: "major_transfer", snapshot: { record: { majorId: "A" }, evaluation: { decision: "pending", inputs: { manualTotal: 16 } } } });
    expect(clone(s.entries[0])).toEqual(s.oldHistory);
  });

  it("cannot archive B's own evaluation by replaying the approved A -> B transfer", async () => {
    const s = await setup(); await s.request(); await s.approve();
    await s.admission.save(s.record.id, { roundId: "round-B", version: 0, inputs: { manualTotal: 18 } }, s.actor);
    const evaluationB = s.current();
    await expect(s.admission.archiveForApprovedMajorTransfer("transfer", s.actor, s.tx as never)).rejects.toThrow("không thuộc chuyên ngành");
    expect(evaluationB.destroy).not.toHaveBeenCalled();
  });

  it("requires a caller transaction for the dedicated archive workflow", async () => {
    const s = await setup();
    await expect(s.admission.archiveForApprovedMajorTransfer("transfer", s.actor, undefined as never)).rejects.toThrow("transaction");
    expect(s.oldEvaluation.destroy).not.toHaveBeenCalled();
  });

  it("requires a target curriculum and refuses to decide the same request twice", async () => {
    const s = await setup(); await s.request();
    await expect(s.service.decide("transfer", { decision: "approved" }, s.actor)).rejects.toThrow("Phải chọn chương trình");
    expect(s.record.update).not.toHaveBeenCalled();
    await s.approve();
    await expect(s.approve()).rejects.toThrow("đã được xử lý");
  });
});
