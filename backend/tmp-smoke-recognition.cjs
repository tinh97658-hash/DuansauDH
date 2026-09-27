/**
 * Smoke test tạm thời cho cơ chế công nhận học phần dùng chung.
 * Tự tạo dữ liệu fixture rồi dọn sạch, chạy qua DI container của Nest trên DB thật.
 */
const { NestFactory } = require("@nestjs/core");
const { getModelToken } = require("@nestjs/sequelize");
const { Op } = require("sequelize");

const TAG = "[smoke-recognize]";

(async () => {
  const { AppModule } = require("./dist/app.module.js");
  const { SubjectRecognitionService } = require("./dist/plan/subject-recognition.service.js");
  const { AdmissionRecord } = require("./dist/database/models/plan/admission-record.model.js");
  const { Discipline } = require("./dist/database/models/common/discipline.model.js");
  const { Major } = require("./dist/database/models/common/major.model.js");
  const { Subject } = require("./dist/database/models/plan/subject.model.js");
  const { Curriculum } = require("./dist/database/models/plan/curriculum.model.js");
  const { CurriculumBlock } = require("./dist/database/models/plan/curriculum-block.model.js");
  const { CurriculumSubject } = require("./dist/database/models/plan/curriculum-subject.model.js");
  const { BridgeKnowledgeSubject } = require("./dist/database/models/common/bridge-knowledge-subject.model.js");
  const { LearnerSubjectResult } = require("./dist/database/models/training/learner-subject-result.model.js");
  const { SubjectRecognition } = require("./dist/database/models/training/subject-recognition.model.js");

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const models = {
    records: app.get(getModelToken(AdmissionRecord)),
    disciplines: app.get(getModelToken(Discipline)),
    majors: app.get(getModelToken(Major)),
    subjects: app.get(getModelToken(Subject)),
    curriculums: app.get(getModelToken(Curriculum)),
    blocks: app.get(getModelToken(CurriculumBlock)),
    entries: app.get(getModelToken(CurriculumSubject)),
    bridge: app.get(getModelToken(BridgeKnowledgeSubject)),
    results: app.get(getModelToken(LearnerSubjectResult)),
    recognitions: app.get(getModelToken(SubjectRecognition)),
  };
  const service = app.get(SubjectRecognitionService);
  const created = {};

  try {
    const discipline = await models.disciplines.create({ code: "SMK-N", name: `${TAG} Ngành thử`, sortOrder: 0, active: true });
    created.disciplineId = discipline.id;
    const major = await models.majors.create({ code: "SMK-MAJ", name: `${TAG} Chuyên ngành thử`, disciplineId: discipline.id, program: "masters", active: true });
    created.majorId = major.id;

    const rootSubject = await models.subjects.create({
      code: "SMK-ROOT", codeNumber: 9001, codeText: "SMK-ROOT", name: `${TAG} Học phần gốc`,
      majorId: major.id, program: "masters", credits: 3, allowCrossMajor: true, sharedMajorIds: [], active: true,
    });
    const aliasSubject = await models.subjects.create({
      code: "SMK-ALIAS", codeNumber: 9002, codeText: "SMK-ALIAS", name: `${TAG} Học phần cùng gốc`,
      majorId: major.id, program: "masters", credits: 3, canonicalSubjectId: rootSubject.id, active: true,
    });
    const targetSubject = await models.subjects.create({
      code: "SMK-TARGET", codeNumber: 9003, codeText: "SMK-TARGET", name: `${TAG} Học phần đang học`,
      majorId: major.id, program: "masters", credits: 3, active: true,
    });
    // Hai học phần khác mã nhưng trùng tên + số tín chỉ, chưa khai báo tương đương.
    const curriculumNameSubject = await models.subjects.create({
      code: "SMK-NAME-C", codeNumber: 9004, codeText: "SMK-NAME-C", name: "Phương pháp nghiên cứu khoa học",
      majorId: major.id, program: "masters", credits: 3, active: true,
    });
    const priorNameSubject = await models.subjects.create({
      code: "SMK-NAME-P", codeNumber: 9005, codeText: "SMK-NAME-P", name: "Phương pháp nghiên cứu khoa học",
      majorId: major.id, program: "masters", credits: 3, active: true,
    });
    // Đích riêng cho trường hợp BSKT khai báo tương đương (không trùng với kết quả nào khác).
    const declaredTargetSubject = await models.subjects.create({
      code: "SMK-DECL", codeNumber: 9006, codeText: "SMK-DECL", name: `${TAG} Học phần nhận BSKT`,
      majorId: major.id, program: "masters", credits: 3, active: true,
    });
    created.subjectIds = [rootSubject.id, aliasSubject.id, targetSubject.id, curriculumNameSubject.id, priorNameSubject.id, declaredTargetSubject.id];

    const curriculum = await models.curriculums.create({
      code: "SMK-CTDT", name: `${TAG} CTĐT`, majorId: major.id, program: "masters",
      applicableFromYear: "2026", totalCredits: 6, active: true,
    });
    created.curriculumId = curriculum.id;
    const block = await models.blocks.create({ curriculumId: curriculum.id, code: "CN", name: "Chuyên ngành", minCredits: 6 });
    await models.entries.bulkCreate([
      { curriculumId: curriculum.id, blockId: block.id, subjectId: rootSubject.id, isRequired: true, credits: 3 },
      { curriculumId: curriculum.id, blockId: block.id, subjectId: curriculumNameSubject.id, isRequired: true, credits: 3 },
      { curriculumId: curriculum.id, blockId: block.id, subjectId: declaredTargetSubject.id, isRequired: true, credits: 3 },
    ]);

    const record = await models.records.create({
      code: "SMK-HV01", fullName: `${TAG} Học viên`, majorId: major.id, majorName: major.name,
      trainingLevel: "Thạc sĩ", academicYear: "2026", status: "approved", studyStatus: "Đang học",
    });
    created.recordId = record.id;
    console.log(`Fixture: hồ sơ ${record.code}, CTĐT ${curriculum.code}`);

    // 1. Tiền thạc sĩ đã hoàn thành & đạt, khác mã nhưng cùng học phần gốc.
    const aliasResult = await service.createLearningResult(record.id, {
      subjectId: aliasSubject.id, sourceType: "pre_masters", status: "completed",
      result: "passed", score: 8.5, completedAt: "2025-12-20", academicYear: "2025", note: `${TAG} tiền thạc sĩ`,
    });
    console.log(`1. Kết quả tiền thạc sĩ: status=${aliasResult.status} result=${aliasResult.result} score=${aliasResult.score}`);

    // 2. Học trước đã đạt nhưng chỉ trùng tên -> chờ hội đồng.
    await service.createLearningResult(record.id, {
      subjectId: priorNameSubject.id, sourceType: "early_enrollment", status: "completed",
      result: "passed", score: 7.5, completedAt: "2025-12-21", note: `${TAG} học trước`,
    });

    // 3. BSKT chưa khai báo tương đương -> không công nhận.
    const bridge = await models.bridge.create({ code: "SMK-BSKT", name: `${TAG} BSKT chưa khai báo`, credits: 3, active: true });
    created.bridgeId = bridge.id;
    await service.createLearningResult(record.id, {
      bridgeKnowledgeSubjectId: bridge.id, sourceType: "pre_masters", status: "completed",
      result: "passed", score: 8, completedAt: "2025-12-22", note: `${TAG} BSKT chưa khai báo`,
    });

    // 4. Đang học -> chỉ kế thừa đăng ký.
    await service.createLearningResult(record.id, {
      subjectId: targetSubject.id, sourceType: "early_enrollment", status: "studying",
      academicYear: "2026", note: `${TAG} đang học`,
    });

    const summary = await service.proposeForRecord(record.id, { curriculumId: curriculum.id });
    console.log(`2. Đối chiếu: autoApproved=${summary.autoApproved} pendingReview=${summary.pendingReview} carriedOver=${summary.carriedOver} skipped=${summary.skipped}`);

    const rows = await models.recognitions.findAll({ where: { admissionRecordId: record.id } });
    const byTarget = new Map(rows.map((row) => [row.targetSubjectId, row]));
    const alias = byTarget.get(rootSubject.id);
    const pending = byTarget.get(curriculumNameSubject.id);
    if (!alias || alias.status !== "approved") throw new Error("Học phần cùng gốc phải được tự động công nhận.");
    if (alias.majorTransferId !== null) throw new Error("Quyết định công nhận phải độc lập (majorTransferId = NULL).");
    if (alias.learningResultId !== aliasResult.id) throw new Error("Quyết định phải giữ liên kết tới kết quả học phần.");
    if (!pending || pending.status !== "pending" || pending.basis !== "same_name") throw new Error("Chỉ trùng tên phải chờ hội đồng.");
    if (byTarget.has(bridge.id)) throw new Error("BSKT chưa khai báo tương đương không được công nhận.");
    if (byTarget.has(targetSubject.id)) throw new Error("Học phần đang học không được công nhận.");
    console.log(`3. Quyết định: cùng-gốc approved(${alias.basis}), trùng-tên pending(${pending.basis}), BSKT bỏ qua, đang-học kế thừa`);

    const credits = await service.recognizedCredits(record.id);
    if (credits !== 3) throw new Error(`Tín chỉ đã công nhận phải là 3, nhận được ${credits}.`);
    console.log(`4. Tín chỉ đã công nhận: ${credits}`);

    // 5. BSKT sau khi khai báo tương đương -> tự động công nhận.
    const declaredBridge = await models.bridge.create({
      code: "SMK-BSKT2", name: `${TAG} BSKT có tương đương`, credits: 3, active: true, equivalentSubjectId: declaredTargetSubject.id,
    });
    created.bridgeId2 = declaredBridge.id;
    await service.createLearningResult(record.id, {
      bridgeKnowledgeSubjectId: declaredBridge.id, sourceType: "pre_masters", status: "completed",
      result: "passed", score: 9, completedAt: "2025-12-23", note: `${TAG} BSKT có khai báo`,
    });
    await service.proposeForRecord(record.id, { curriculumId: curriculum.id });
    const bridgeRecognition = await models.recognitions.findOne({
      where: { admissionRecordId: record.id, basis: "declared_equivalence" },
    });
    if (!bridgeRecognition) throw new Error("BSKT đã khai báo tương đương phải được công nhận.");
    if (bridgeRecognition.targetSubjectId !== declaredTargetSubject.id) {
      throw new Error("BSKT phải được công nhận vào đúng học phần đã khai báo tương đương.");
    }
    console.log(`5. BSKT có khai báo tương đương -> approved (basis=${bridgeRecognition.basis})`);

    // 6. Hội đồng duyệt đề xuất "chỉ trùng tên" -> tín chỉ tăng thêm.
    const creditsBeforeApprove = await service.recognizedCredits(record.id);
    const decided = await service.decide(pending.id, { decision: "approved", decisionNo: "QD-SMK-01", note: `${TAG} hội đồng duyệt` });
    if (decided.status !== "approved") throw new Error("Duyệt đề xuất thất bại.");
    const creditsAfterApprove = await service.recognizedCredits(record.id);
    if (creditsAfterApprove !== creditsBeforeApprove + 3) {
      throw new Error(`Duyệt học phần 3 tín chỉ phải tăng tín chỉ công nhận (${creditsBeforeApprove} -> ${creditsAfterApprove}).`);
    }
    console.log(`6. Hội đồng duyệt đề xuất trùng tên -> tín chỉ ${creditsBeforeApprove} -> ${creditsAfterApprove} (decisionNo=${decided.decisionNo})`);

    // 7. Từ chối toàn bộ quyết định -> không còn tín chỉ công nhận.
    const approvedRows = await models.recognitions.findAll({ where: { admissionRecordId: record.id, status: "approved" } });
    for (const row of approvedRows) {
      await service.decide(row.id, { decision: "rejected", note: `${TAG} từ chối toàn bộ` });
    }
    const creditsAfterReject = await service.recognizedCredits(record.id);
    if (creditsAfterReject !== 0) throw new Error(`Từ chối toàn bộ phải còn 0 tín chỉ, nhận được ${creditsAfterReject}.`);
    console.log(`7. Từ chối ${approvedRows.length} quyết định -> tín chỉ còn ${creditsAfterReject}`);

    // 8. Không đạt -> luôn bị bỏ qua.
    await service.createLearningResult(record.id, {
      subjectId: aliasSubject.id, sourceType: "regular", status: "completed",
      result: "failed", score: 4, completedAt: "2025-12-24", note: `${TAG} không đạt`,
    });
    const afterFailed = await service.proposeForRecord(record.id, { curriculumId: curriculum.id });
    if (afterFailed.skipped < 1) throw new Error("Kết quả không đạt phải bị bỏ qua.");
    console.log(`8. Kết quả không đạt bị bỏ qua (skipped=${afterFailed.skipped})`);

    // 9. Chặn tham chiếu đồng thời hai danh mục.
    let rejected = false;
    try {
      await service.createLearningResult(record.id, { subjectId: targetSubject.id, bridgeKnowledgeSubjectId: bridge.id, sourceType: "regular" });
    } catch { rejected = true; }
    if (!rejected) throw new Error("Phải chặn kết quả tham chiếu đồng thời hai danh mục.");
    console.log("9. Chặn kết quả tham chiếu cả hai danh mục");

    console.log("\n=== TAT CA KIEM TRA DEU DAT ===");
  } finally {
    if (created.recordId) {
      await models.recognitions.destroy({ where: { admissionRecordId: created.recordId } });
      await models.results.destroy({ where: { admissionRecordId: created.recordId } });
      await models.records.destroy({ where: { id: created.recordId } });
    }
    await models.results.destroy({ where: { note: { [Op.like]: `${TAG}%` } } });
    await models.recognitions.destroy({ where: { note: { [Op.like]: `${TAG}%` } } });
    if (created.curriculumId) await models.entries.destroy({ where: { curriculumId: created.curriculumId } });
    if (created.curriculumId) await models.blocks.destroy({ where: { curriculumId: created.curriculumId } });
    if (created.curriculumId) await models.curriculums.destroy({ where: { id: created.curriculumId } });
    if (created.bridgeId) await models.bridge.destroy({ where: { id: created.bridgeId } });
    if (created.bridgeId2) await models.bridge.destroy({ where: { id: created.bridgeId2 } });
    if (created.subjectIds) await models.subjects.destroy({ where: { id: created.subjectIds } });
    if (created.majorId) await models.majors.destroy({ where: { id: created.majorId } });
    console.log("Da don du lieu smoke test.");
    await app.close();
  }
})().catch((error) => {
  console.error("SMOKE TEST THAT BAI:", error.message);
  process.exit(1);
});
