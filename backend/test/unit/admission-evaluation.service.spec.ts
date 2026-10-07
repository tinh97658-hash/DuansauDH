import { AdmissionEvaluationService } from "../../src/plan/admission-evaluation.service.js";
import { admissionRecordSnapshot, DEFAULT_ADMISSION_RULES } from "../../src/plan/admission-scoring.js";

function setup() {
  const tx = { LOCK: { UPDATE: "UPDATE" } };
  const record: any = { id: "record", trainingLevel: "Thạc sĩ", majorId: "major", academicYear: "2026", gradClassification: "Khá", priorityObject: "Không", status: "pending", studyStatus: "Nộp hồ sơ đầu vào" };
  record.update = jest.fn(async (values) => Object.assign(record, values));
  const round: any = { id: "round", academicYear: "2026", majorThresholds: [{ majorId: "major", cutoff: 15 }], rules: DEFAULT_ADMISSION_RULES };
  round.toJSON = () => ({ ...round, toJSON: undefined });
  const evaluation: any = { id: "eval", roundId: "round", admissionRecordId: "record", version: 1, decision: "pending", recordSnapshot: admissionRecordSnapshot(record), inputs: { degreeVerified: true, documentsVerified: true, healthVerified: true, majorFit: "direct", fitEvidence: "DM", englishType: "exam", englishVerified: true, englishEvidence: "Thi", englishScore: 8 } };
  evaluation.toJSON = () => ({ ...evaluation, update: undefined, toJSON: undefined });
  evaluation.update = jest.fn(async (values) => Object.assign(evaluation, values));
  const records = { findByPk: jest.fn().mockResolvedValue(record), findAll: jest.fn().mockResolvedValue([record]) };
  const rounds = { findByPk: jest.fn().mockResolvedValue(round), create: jest.fn(async (values) => values) };
  const majors = { findAll: jest.fn().mockResolvedValue([{ id: "major", name: "Major", active: true, program: "masters" }]) };
  const evaluations = { findOne: jest.fn().mockResolvedValue(evaluation), findAll: jest.fn().mockResolvedValue([evaluation]), count: jest.fn().mockResolvedValue(0) };
  const history = { create: jest.fn().mockResolvedValue({}), findAll: jest.fn().mockResolvedValue([]) };
  const db = { transaction: jest.fn(async (callback) => callback(tx)) };
  const service = new AdmissionEvaluationService(records as never, rounds as never, evaluations as never, history as never, majors as never, db as never);
  const decision = { decision: "admitted" as const, decisionNo: "QD-2", decisionDate: "2026-10-06", note: "Hội đồng duyệt", version: 1 };
  return { service, record, records, rounds, majors, round, evaluation, evaluations, history, tx, decision, db };
}
describe("Duyệt hồ sơ đầu vào", () => {
  it("giữ kết quả đã duyệt theo snapshot dù ngành, năm và ngưỡng hiện tại thay đổi", async () => {
    const { service, history, evaluation, record, round } = setup();
    evaluation.decision = "admitted";
    const snapshot = { evaluation: { id: evaluation.id, version: evaluation.version, decision: "admitted" },
      record: { majorId: "major", majorName: "Ngành năm trước", academicYear: "2026" },
      round: { id: "round", name: "Đợt năm trước", academicYear: "2026" },
      result: { total: 16, cutoff: 15, meetsCutoff: true, eligibility: "eligible" } };
    const entry: any = { id: "history", snapshot, action: "admitted" };
    entry.toJSON = () => ({ id: entry.id, snapshot, action: entry.action });
    history.findAll.mockResolvedValue([entry]);
    record.majorId = "new-major"; record.academicYear = "2027";
    round.majorThresholds = [{ majorId: "major", cutoff: 20 }];
    const detail = await service.detail(record.id);
    expect(detail.evaluation).toMatchObject({ majorName: "Ngành năm trước", stale: false,
      round: { academicYear: "2026", name: "Đợt năm trước" }, result: { total: 16, cutoff: 15, meetsCutoff: true } });
    expect(detail.history[0].snapshot.record.majorName).toBe("Ngành năm trước");
  });
  it("lịch sử lưu tên ngành cùng điểm và ngưỡng tại thời điểm xét tuyển", async () => {
    const { service, history, decision } = setup();
    await service.decide("record", decision, {});
    expect(history.create).toHaveBeenCalledWith(expect.objectContaining({ snapshot: expect.objectContaining({
      record: expect.objectContaining({ majorName: "Major", academicYear: "2026" }),
      result: expect.objectContaining({ total: 16.5, cutoff: 15 }),
    }) }), expect.anything());
  });
  it("cập nhật trạng thái, phiên bản, lịch sử trong cùng transaction", async () => {
    const { service, record, evaluation, history, tx, decision } = setup();
    await service.decide("record", decision, { id: "admin" });
    expect(record.status).toBe("approved"); expect(record.studyStatus).toBe("Đã trúng tuyển");
    expect(evaluation.update).toHaveBeenCalledWith({ decision: "admitted", version: 2 }, { transaction: tx });
    expect(history.create).toHaveBeenCalledWith(expect.objectContaining({ action: "admitted", actor: "admin", snapshot: expect.objectContaining({ decisionNo: "QD-2", result: expect.objectContaining({ total: 16.5 }) }) }), { transaction: tx });
  });
  it.each(["missing", "cutoff", "stale", "version"])("chặn trúng tuyển khi %s", async (problem) => {
    const { service, record, round, evaluation, decision } = setup();
    if (problem === "missing") evaluation.inputs.healthVerified = false;
    if (problem === "cutoff") round.majorThresholds[0].cutoff = null;
    if (problem === "stale") record.gradClassification = "Giỏi";
    if (problem === "version") evaluation.version = 2;
    await expect(service.decide("record", decision, {})).rejects.toThrow();
    expect(record.update).not.toHaveBeenCalled(); expect(evaluation.update).not.toHaveBeenCalled();
  });
  it("không cho đổi điểm của hồ sơ đã duyệt", async () => {
    const { service, record, evaluation } = setup(); evaluation.decision = "admitted";
    await expect(service.guardRecordUpdate(record, { gpa: "9.9" })).rejects.toThrow("Mở lại");
  });
  it("không cho đánh dấu trúng tuyển qua API hồ sơ chung", async () => {
    const { service, record } = setup();
    await expect(service.guardRecordUpdate(record, { studyStatus: "Đã trúng tuyển" })).rejects.toThrow("Duyệt trúng tuyển");
    await expect(service.guardRecordUpdate(null, { status: "admitted" })).rejects.toThrow();
  });
  it("mở lại kết quả cần quyết định và lưu lịch sử", async () => {
    const { service, record, evaluation, decision, history } = setup(); evaluation.decision = "admitted"; record.status = "admitted";
    await service.decide("record", { ...decision, decision: "reopen" }, { id: "admin" });
    expect(evaluation.decision).toBe("pending"); expect(record.status).toBe("pending"); expect(history.create).toHaveBeenCalled();
  });
});
describe("Nhập điểm và duyệt danh sách", () => {
  it("trả thông tin nhận diện cho bảng và Excel mẫu", async () => {
    const { service, record } = setup();
    Object.assign(record, { dob: "21/08/1996", gender: "Nữ", phone: "0900000001", email: "demo@example.com" });
    expect((await service.ranking("round")).rows[0]).toMatchObject({ birthYear: 1996, gender: "Nữ", phone: record.phone, email: record.email });
    record.dob = null;
    expect((await service.ranking("round")).rows[0].birthYear).toBeNull();
  });
  it("liệt kê hồ sơ chưa được gán đợt để nhập điểm", async () => {
    const { service, evaluations } = setup(); evaluations.findAll.mockResolvedValue([]);
    const result = await service.ranking("round");
    expect(result.rows[0]).toMatchObject({ admissionRecordId: "record", version: 0, total: null, decision: "pending" });
  });
  it("không liệt kê hồ sơ thuộc đợt khác hoặc đã trúng tuyển từ dữ liệu cũ", async () => {
    const { service, evaluation, evaluations, record } = setup(); evaluation.roundId = "other";
    expect((await service.ranking("round")).rows).toHaveLength(0);
    evaluations.findAll.mockResolvedValue([]); record.status = "approved";
    expect((await service.ranking("round")).rows).toHaveLength(0);
  });
  it("lưu tổng điểm và lịch sử trong một transaction, không chuyển trạng thái", async () => {
    const { service, record, evaluation, tx, db, history } = setup();
    await service.saveScores("round", { rows: [{ admissionRecordId: "record", version: 1, score: 18 }] }, { id: "admin" });
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(evaluation.inputs.manualTotal).toBe(18);
    expect(evaluation.update).toHaveBeenCalledWith(expect.objectContaining({ version: 2 }), { transaction: tx });
    expect(history.create).toHaveBeenCalled(); expect(record.update).not.toHaveBeenCalled();
  });
  it.each(["version", "decided", "otherRound", "duplicate", "outOfRange"])("chặn nhập hàng loạt khi %s", async (problem) => {
    const { service, evaluation, record } = setup();
    const row = { admissionRecordId: "record", version: 1, score: 18 };
    if (problem === "version") evaluation.version = 2;
    if (problem === "decided") evaluation.decision = "admitted";
    if (problem === "otherRound") evaluation.roundId = "other";
    if (problem === "outOfRange") row.score = 21;
    await expect(service.saveScores("round", { rows: problem === "duplicate" ? [row, row] : [row] }, {})).rejects.toThrow();
    expect(evaluation.update).not.toHaveBeenCalled(); expect(record.update).not.toHaveBeenCalled();
  });
  it("Xét tuyển chỉ trả danh sách đạt ngưỡng, không ghi trạng thái", async () => {
    const { service, record, evaluation } = setup(); evaluation.inputs = { manualTotal: 16 };
    const preview = await service.preview("round");
    expect(preview.rows).toHaveLength(1);
    expect(preview).not.toHaveProperty("availableSeats");
    expect(preview.previewToken).toMatch(/^[a-f0-9]{64}$/);
    expect(record.update).not.toHaveBeenCalled(); expect(evaluation.update).not.toHaveBeenCalled();
    evaluation.inputs.manualTotal = 14;
    expect((await service.preview("round")).rows).toHaveLength(0);
  });
  it("chỉ khi xác nhận mới cập nhật hồ sơ và ghi lịch sử", async () => {
    const { service, record, evaluation, db } = setup(); evaluation.inputs = { manualTotal: 16 };
    const preview = await service.preview("round"); db.transaction.mockClear();
    await service.confirmBatch("round", { previewToken: preview.previewToken, admissionRecordIds: ["record"] }, { id: "admin" });
    expect(record.studyStatus).toBe("Đã trúng tuyển"); expect(evaluation.version).toBe(2);
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });
  it.each(["score", "cutoff", "stale", "wrongRecord", "duplicate"])("chặn duyệt khi %s", async (problem) => {
    const { service, record, evaluation, round } = setup(); evaluation.inputs = { manualTotal: 16 };
    const preview = await service.preview("round");
    if (problem === "score") evaluation.inputs.manualTotal = 17;
    if (problem === "cutoff") round.majorThresholds[0].cutoff = 17;
    if (problem === "stale") record.gpa = "9";
    const ids = problem === "wrongRecord" ? ["other"] : problem === "duplicate" ? ["record", "record"] : ["record"];
    await expect(service.confirmBatch("round", { previewToken: preview.previewToken, admissionRecordIds: ids }, {})).rejects.toThrow();
    expect(record.update).not.toHaveBeenCalled();
  });
  it("thiết lập ngành và điểm ngưỡng không cần chỉ tiêu, văn bản hay quyết định", async () => {
    const { service, rounds } = setup();
    const result = await service.saveRound(undefined, { name: "Ngành 2026", academicYear: "2026", majorThresholds: [{ majorId: "major", cutoff: 15 }] });
    expect(result).toMatchObject({ majorThresholds: [{ majorId: "major", cutoff: 15 }], regulationNo: "", decisionNo: null, decisionDate: null });
    expect(rounds.create).toHaveBeenCalled();
    expect(result).not.toHaveProperty("quota");
  });
  it("duyệt theo điểm ngưỡng không đếm giới hạn số hồ sơ", async () => {
    const { service, evaluation, evaluations, history } = setup(); evaluation.inputs = { manualTotal: 15 };
    evaluations.count.mockResolvedValue(100);
    const preview = await service.preview("round");
    await service.confirmBatch("round", { previewToken: preview.previewToken, admissionRecordIds: ["record"] }, { id: "admin" });
    expect(evaluation.decision).toBe("admitted");
    expect(evaluations.count).not.toHaveBeenCalled();
    expect(history.create).toHaveBeenLastCalledWith(expect.objectContaining({ snapshot: expect.objectContaining({ decisionNo: null, decisionDate: null }) }), expect.anything());
  });
  it("một đợt nhận hồ sơ nhiều ngành và áp dụng ngưỡng riêng khi duyệt", async () => {
    const { service, round, record, records, evaluation, evaluations, majors } = setup();
    record.fullName = "A"; evaluation.inputs = { manualTotal: 16 };
    const secondRecord: any = { ...record, id: "record-2", majorId: "major-2", fullName: "B" };
    secondRecord.update = jest.fn(async (values) => Object.assign(secondRecord, values));
    const secondEvaluation: any = { ...evaluation, id: "eval-2", admissionRecordId: secondRecord.id, inputs: { manualTotal: 16 }, recordSnapshot: admissionRecordSnapshot(secondRecord) };
    secondEvaluation.toJSON = () => ({ ...secondEvaluation, toJSON: undefined, update: undefined });
    secondEvaluation.update = jest.fn(async (values) => Object.assign(secondEvaluation, values));
    round.majorThresholds.push({ majorId: "major-2", cutoff: 17 });
    majors.findAll.mockResolvedValue([{ id: "major", name: "Ngành A" }, { id: "major-2", name: "Ngành B" }] as any);
    records.findAll.mockResolvedValue([record, secondRecord]);
    records.findByPk.mockImplementation(async (id) => id === record.id ? record : secondRecord);
    evaluations.findAll.mockResolvedValue([evaluation, secondEvaluation]);
    evaluations.findOne.mockImplementation(async ({ where }) => where.admissionRecordId === record.id ? evaluation : secondEvaluation);
    const ranking = await service.ranking("round");
    expect(records.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { trainingLevel: "Thạc sĩ", academicYear: "2026" } }));
    expect(ranking.rows).toHaveLength(2);
    expect(ranking.rows.find((row) => row.majorId === "major-2")).toMatchObject({ cutoff: 17, meetsCutoff: false, majorName: "Ngành B" });
    expect((await service.preview("round")).rows.map((row) => row.admissionRecordId)).toEqual([record.id]);
    await service.saveScores("round", { rows: [{ admissionRecordId: secondRecord.id, score: 18, version: 1 }] }, {});
    const preview = await service.preview("round");
    await service.confirmBatch("round", { previewToken: preview.previewToken, admissionRecordIds: preview.rows.map((row) => row.admissionRecordId) }, {});
    expect(record.studyStatus).toBe("Đã trúng tuyển"); expect(secondRecord.studyStatus).toBe("Đã trúng tuyển");
  });
});
