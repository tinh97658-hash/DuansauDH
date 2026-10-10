import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/sequelize";
import { Op, Transaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { AdmissionRecord } from "../database/models/plan/admission-record.model.js";
import { AdmissionEvaluation, AdmissionEvaluationHistory, AdmissionRound } from "../database/models/plan/admission-evaluation.model.js";
import { Major } from "../database/models/common/major.model.js";
import { MajorTransfer } from "../database/models/training/major-transfer.model.js";
import { ADMISSION_CORE_FIELDS, ADMISSION_SOURCE, admissionBirthYear, admissionRecordSnapshot, DEFAULT_ADMISSION_RULES, normalizedAdmissionValue, rankAdmissions, scoreAdmission } from "./admission-scoring.js";
import { BulkAdmissionScoresDto, ConfirmAdmissionBatchDto, ConfirmAdmissionTuitionBatchDto, DecideAdmissionDto, SaveAdmissionEvaluationDto, SaveAdmissionRoundDto, UpdateAdmissionTuitionDto } from "./dto/admission.dto.js";

@Injectable()
export class AdmissionEvaluationService {
  constructor(
    @InjectModel(AdmissionRecord) private readonly records: typeof AdmissionRecord,
    @InjectModel(AdmissionRound) private readonly rounds: typeof AdmissionRound,
    @InjectModel(AdmissionEvaluation) private readonly evaluations: typeof AdmissionEvaluation,
    @InjectModel(AdmissionEvaluationHistory) private readonly history: typeof AdmissionEvaluationHistory,
    @InjectModel(Major) private readonly majors: typeof Major,
    @InjectConnection() private readonly sequelize: Sequelize,
    @InjectModel(MajorTransfer) private readonly majorTransfers: typeof MajorTransfer,
  ) {}

  async listRounds() {
    return { rows: await this.rounds.findAll({ order: [["academicYear", "DESC"], ["createdAt", "DESC"]] }), defaultRules: DEFAULT_ADMISSION_RULES, source: ADMISSION_SOURCE };
  }
  async saveRound(id: string | undefined, dto: SaveAdmissionRoundDto) {
    return this.sequelize.transaction(async (transaction) => {
      const majorIds = dto.majorThresholds.map((row) => row.majorId);
      if (new Set(majorIds).size !== majorIds.length) throw new BadRequestException("Không được nhập trùng ngành trong một đợt.");
      const majors = await this.majors.findAll({ where: { id: { [Op.in]: majorIds }, program: "masters", active: true }, transaction });
      if (majors.length !== majorIds.length) throw new BadRequestException("Chọn các chuyên ngành thạc sĩ đang hoạt động.");
      if (!dto.name.trim()) throw new BadRequestException("Tên đợt không được để trống.");
      const payload = { ...dto, majorThresholds: [...dto.majorThresholds].sort((a, b) => a.majorId.localeCompare(b.majorId)).map((row) => ({ majorId: row.majorId, cutoff: row.cutoff ?? null })), name: dto.name.trim(), regulationNo: dto.regulationNo?.trim() || "", decisionNo: dto.decisionNo?.trim() || null, decisionDate: dto.decisionDate || null, rules: { ...(dto.rules || DEFAULT_ADMISSION_RULES) } };
      if (!id) return this.rounds.create(payload as any, { transaction });
      const round = await this.rounds.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!round) throw new NotFoundException("Không tìm thấy đợt xét tuyển.");
      const decided = await this.evaluations.count({ where: { roundId: id, decision: { [Op.ne]: "pending" } }, transaction });
      if (decided) throw new ConflictException("Đợt đã có hồ sơ được duyệt. Mở lại các kết quả trước khi sửa cấu hình.");
      const assigned = await this.evaluations.count({ where: { roundId: id }, transaction });
      if (assigned && (round.academicYear !== dto.academicYear || !isDeepStrictEqual(round.rules, payload.rules))) throw new ConflictException("Đợt đã có hồ sơ: không thể đổi năm hoặc bảng quy đổi.");
      return round.update(payload as any, { transaction });
    });
  }
  private requireVersion(row: AdmissionEvaluation | null, version: number) {
    if ((row?.version ?? 0) !== version) throw new ConflictException("Dữ liệu xét tuyển đã thay đổi. Tải lại trước khi lưu hoặc duyệt.");
  }
  private view(record: any, evaluation: any, round: any) {
    const stale = !isDeepStrictEqual(admissionRecordSnapshot(record), evaluation.recordSnapshot);
    return { ...evaluation.toJSON(), result: scoreAdmission(record, evaluation.inputs, round), stale, round: round.toJSON() };
  }
  async detail(id: string) {
    const record = await this.records.findByPk(id);
    if (!record) throw new NotFoundException("Không tìm thấy hồ sơ.");
    const evaluation = await this.evaluations.findOne({ where: { admissionRecordId: id } });
    const round = evaluation ? await this.rounds.findByPk(evaluation.roundId) : null;
    const history = await this.history.findAll({ where: { admissionRecordId: id }, order: [["createdAt", "DESC"], ["id", "DESC"]] });
    const majorIds = [...new Set([evaluation?.recordSnapshot?.majorId, ...history.map((entry) => entry.snapshot?.record?.majorId)].filter(Boolean))];
    const majors = await this.majors.findAll({ where: { id: { [Op.in]: majorIds } } });
    const majorNames = new Map(majors.map((major) => [major.id, major.name]));
    const entries = history.map((entry) => ({ ...entry.toJSON(), snapshot: { ...entry.snapshot,
      record: { ...entry.snapshot?.record, majorName: entry.snapshot?.record?.majorName || majorNames.get(entry.snapshot?.record?.majorId) || null } } }));
    const savedDecision = evaluation?.decision !== "pending" ? entries.find((entry) =>
      entry.snapshot?.evaluation?.id === evaluation?.id && entry.snapshot?.evaluation?.version === evaluation?.version
      && entry.snapshot?.result && entry.snapshot?.round) : null;
    const view = evaluation && round ? savedDecision ? { ...evaluation.toJSON(), result: savedDecision.snapshot.result,
      round: savedDecision.snapshot.round, recordSnapshot: savedDecision.snapshot.record, stale: false } : this.view(record, evaluation, round) : null;
    return { evaluation: view ? { ...view, majorName: view.recordSnapshot?.majorName || majorNames.get(view.recordSnapshot?.majorId) || null } : null, history: entries };
  }
  private async appendHistory(record: AdmissionRecord, evaluation: AdmissionEvaluation, round: AdmissionRound, action: string, actor: any, extra: any, transaction: Transaction) {
    const majors = await this.majors.findAll({ where: { id: record.majorId }, transaction });
    await this.history.create({ admissionRecordId: record.id, action,
      actor: String(actor?.name || actor?.email || actor?.id || "unknown"),
      snapshot: { actorId: actor?.id || null, evaluation: evaluation.toJSON(), round: round.toJSON(), record: { ...admissionRecordSnapshot(record), majorName: majors[0]?.name || record.majorName || null }, result: scoreAdmission(record, evaluation.inputs, round), ...extra },
    } as any, { transaction });
  }
  async save(id: string, dto: SaveAdmissionEvaluationDto, actor: any, existingTransaction?: Transaction) {
    if (!dto.inputs) throw new BadRequestException("Thiếu dữ liệu xét tuyển.");
    const execute = async (transaction: Transaction) => {
      const round = await this.rounds.findByPk(dto.roundId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!round) throw new NotFoundException("Không tìm thấy đợt xét tuyển.");
      const record = await this.records.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!record) throw new NotFoundException("Không tìm thấy hồ sơ.");
      if (record.trainingLevel !== "Thạc sĩ" || record.academicYear !== round.academicYear) throw new BadRequestException("Đợt xét tuyển phải cùng năm tuyển sinh với hồ sơ thạc sĩ.");
      let evaluation = await this.evaluations.findOne({ where: { admissionRecordId: id }, transaction, lock: transaction.LOCK.UPDATE });
      this.requireVersion(evaluation, dto.version);
      if (evaluation && evaluation.decision !== "pending") throw new ConflictException("Hồ sơ đã được duyệt. Mở lại kết quả trước khi sửa.");
      if (!evaluation && (record.status === "admitted" || record.status === "approved" || ["Đã trúng tuyển", "Đang học"].includes(record.studyStatus || ""))) throw new ConflictException("Hồ sơ đã trúng tuyển theo dữ liệu cũ. Cần đối soát quyết định trước khi đưa vào luồng xét tuyển mới.");
      const payload = { roundId: round.id, inputs: dto.inputs, recordSnapshot: admissionRecordSnapshot(record), version: dto.version + 1 };
      if (evaluation) await evaluation.update(payload as any, { transaction });
      else evaluation = await this.evaluations.create({ ...payload, admissionRecordId: id, decision: "pending" } as any, { transaction });
      await this.appendHistory(record, evaluation, round, "saved", actor, {}, transaction);
      return this.view(record, evaluation, round);
    };
    return existingTransaction ? execute(existingTransaction) : this.sequelize.transaction(execute);
  }
  async ranking(roundId: string, transaction?: Transaction) {
    const query = transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {};
    const round = await this.rounds.findByPk(roundId, query);
    if (!round) throw new NotFoundException("Không tìm thấy đợt xét tuyển.");
    const records = await this.records.findAll({ where: { trainingLevel: "Thạc sĩ", academicYear: round.academicYear }, order: [["id", "ASC"]], ...query });
    const majors = await this.majors.findAll({ where: { id: { [Op.in]: records.map((record) => record.majorId).filter(Boolean) } }, transaction });
    const majorMap = new Map(majors.map((major) => [major.id, major]));
    const evaluations = await this.evaluations.findAll({ where: { admissionRecordId: { [Op.in]: records.map((row) => row.id) } }, ...query });
    const evaluationMap = new Map(evaluations.map((row) => [row.admissionRecordId, row]));
    const rows = records.flatMap((record) => {
      const evaluation = evaluationMap.get(record.id);
      // Hồ sơ đã gán đợt khác hoặc trúng tuyển theo dữ liệu cũ cần xử lý ở luồng riêng.
      if (evaluation && evaluation.roundId !== roundId) return [];
      if (!evaluation && (record.status === "admitted" || record.status === "approved" || ["Đã trúng tuyển", "Đang học"].includes(record.studyStatus || ""))) return [];
      const view = evaluation ? this.view(record, evaluation, round) : {
        id: record.id, admissionRecordId: record.id, version: 0, decision: "pending", inputs: {}, stale: false,
        recordSnapshot: admissionRecordSnapshot(record), result: scoreAdmission(record, {}, round),
      };
      return [{ ...view, fullName: record.fullName, code: record.code, dob: record.dob, birthYear: admissionBirthYear(record.dob), gender: record.gender,
        phone: record.phone, email: record.email, academicYear: record.academicYear,
        studyStatus: record.studyStatus,
        majorId: record.majorId, majorName: majorMap.get(record.majorId)?.name || "Chưa xác định ngành", ...view.result, rank: null as number | null }];
    });
    rankAdmissions(rows.filter((row) => !row.stale && row.eligibility === "eligible" && row.decision !== "rejected"));
    rows.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.fullName.localeCompare(b.fullName, "vi"));
    return { round, rows, admittedCount: rows.filter((row) => row.decision === "admitted").length };
  }
  async saveScores(roundId: string, dto: BulkAdmissionScoresDto, actor: any) {
    return this.sequelize.transaction(async (transaction) => {
      const round = await this.rounds.findByPk(roundId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!round) throw new NotFoundException("Không tìm thấy đợt xét tuyển.");
      const ids = dto.rows.map((row) => row.admissionRecordId);
      if (!ids.length || new Set(ids).size !== ids.length) throw new BadRequestException("Danh sách điểm trống hoặc trùng hồ sơ.");
      for (const row of [...dto.rows].sort((a, b) => a.admissionRecordId.localeCompare(b.admissionRecordId))) {
        if (!Number.isFinite(row.score) || row.score < 0 || row.score > 20) throw new BadRequestException("Điểm phải từ 0 đến 20.");
        const current = await this.evaluations.findOne({ where: { admissionRecordId: row.admissionRecordId }, transaction });
        if (current && current.roundId !== roundId) throw new ConflictException("Hồ sơ đã thuộc đợt khác. Tải lại bảng điểm.");
        await this.save(row.admissionRecordId, { roundId, version: row.version, inputs: { ...current?.inputs, manualTotal: row.score } }, actor, transaction);
      }
      return { savedCount: dto.rows.length };
    });
  }
  private batchPreview(data: Awaited<ReturnType<AdmissionEvaluationService["ranking"]>>) {
    if (!data.round.majorThresholds.some((row) => row.cutoff != null)) throw new BadRequestException("Nhập điểm ngưỡng các ngành trong đợt trước khi xét tuyển.");
    const rows = data.rows.filter((row) => row.decision === "pending" && !row.stale && row.eligibility === "eligible" && row.meetsCutoff === true);
    const signature = {
      round: data.round.toJSON(),
      rows: [...data.rows].sort((a, b) => a.admissionRecordId.localeCompare(b.admissionRecordId)).map((row) => ({
        id: row.admissionRecordId, version: row.version, decision: row.decision, stale: row.stale,
        inputs: row.inputs, record: row.recordSnapshot, result: row.result, fullName: row.fullName, code: row.code,
        birthYear: row.birthYear, gender: row.gender, phone: row.phone, email: row.email,
      })),
    };
    return { round: data.round, rows,
      previewToken: createHash("sha256").update(JSON.stringify(signature)).digest("hex") };
  }
  async preview(roundId: string) {
    return this.sequelize.transaction(async (transaction) => this.batchPreview(await this.ranking(roundId, transaction)));
  }
  async confirmBatch(roundId: string, dto: ConfirmAdmissionBatchDto, actor: any) {
    return this.sequelize.transaction(async (transaction) => {
      const preview = this.batchPreview(await this.ranking(roundId, transaction));
      if (dto.previewToken !== preview.previewToken) throw new ConflictException("Điểm hoặc hồ sơ đã thay đổi. Bấm Xét tuyển để kiểm tra lại danh sách.");
      const selected = new Set(dto.admissionRecordIds);
      if (!selected.size || selected.size !== dto.admissionRecordIds.length) throw new BadRequestException("Chọn danh sách hồ sơ không trùng để duyệt.");
      const candidates = preview.rows.filter((row) => selected.has(row.admissionRecordId));
      if (candidates.length !== selected.size) throw new BadRequestException("Danh sách có hồ sơ không đủ điều kiện hoặc không thuộc đợt.");
      for (const row of [...candidates].sort((a, b) => a.admissionRecordId.localeCompare(b.admissionRecordId))) {
        await this.decide(row.admissionRecordId, { decision: "admitted", version: row.version,
          note: "Quản lý xác nhận danh sách đạt điểm ngưỡng của ngành." }, actor, transaction);
      }
      return { admittedCount: candidates.length };
    });
  }
  async decide(id: string, dto: DecideAdmissionDto, actor: any, existingTransaction?: Transaction) {
    const existing = await this.evaluations.findOne({ where: { admissionRecordId: id }, transaction: existingTransaction });
    if (!existing) throw new BadRequestException("Lưu dữ liệu xét tuyển trước khi duyệt.");
    const execute = async (transaction: Transaction) => {
      const round = await this.rounds.findByPk(existing.roundId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!round) throw new NotFoundException("Không tìm thấy đợt.");
      const record = await this.records.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      const evaluation = await this.evaluations.findOne({ where: { admissionRecordId: id }, transaction, lock: transaction.LOCK.UPDATE });
      if (!record || !evaluation) throw new NotFoundException("Không tìm thấy hồ sơ xét tuyển.");
      this.requireVersion(evaluation, dto.version);
      if (evaluation.roundId !== round.id) throw new ConflictException("Hồ sơ đã chuyển đợt. Tải lại dữ liệu.");
      if (!dto.note.trim()) throw new BadRequestException("Nhập ghi chú/lý do duyệt.");
      const previousDecision = evaluation.decision;
      if (dto.decision === "reopen" ? previousDecision === "pending" : previousDecision !== "pending") throw new ConflictException("Mở lại kết quả đã duyệt trước khi ra quyết định mới.");
      const result = scoreAdmission(record, evaluation.inputs, round);
      if (dto.decision === "admitted") {
        if (!isDeepStrictEqual(admissionRecordSnapshot(record), evaluation.recordSnapshot)) throw new ConflictException("Thông tin hồ sơ đã thay đổi. Xác minh và lưu lại xét tuyển trước khi duyệt.");
        if (result.eligibility !== "eligible") throw new BadRequestException([...result.failed, ...result.missing].join(" "));
        if (result.meetsCutoff !== true) throw new BadRequestException("Chưa nhập điểm ngưỡng hoặc tổng điểm chưa đạt ngưỡng của ngành.");
        if (record.studyStatus === "Đang học") throw new ConflictException("Hồ sơ đã vào học, cần đối soát trước khi duyệt lại.");
      }
      if (dto.decision === "reopen" && record.studyStatus === "Đang học") throw new ConflictException("Hồ sơ đã vào học, cần xử lý nghiệp vụ học viên trước khi mở lại xét tuyển.");
      await evaluation.update({ decision: dto.decision === "reopen" ? "pending" : dto.decision, version: evaluation.version + 1 }, { transaction });
      await record.update({ status: dto.decision === "admitted" ? "approved" : dto.decision === "rejected" ? "rejected" : "pending",
        studyStatus: dto.decision === "admitted" ? "Đã trúng tuyển" : dto.decision === "rejected" ? "Không trúng tuyển" : "Nộp hồ sơ đầu vào" }, { transaction });
      await this.appendHistory(record, evaluation, round, dto.decision, actor, { previousDecision, decisionNo: dto.decisionNo?.trim() || null, decisionDate: dto.decisionDate || null, note: dto.note.trim() }, transaction);
      return this.view(record, evaluation, round);
    };
    return existingTransaction ? execute(existingTransaction) : this.sequelize.transaction(execute);
  }
  async confirmTuitionBatch(dto: ConfirmAdmissionTuitionBatchDto, actor: any) {
    const ids = dto.rows.map((row) => row.admissionRecordId);
    if (!ids.length || ids.length > 500 || new Set(ids).size !== ids.length) throw new BadRequestException("Chọn từ 1 đến 500 học viên, không trùng hồ sơ.");
    return this.sequelize.transaction(async (transaction) => {
      for (const row of [...dto.rows].sort((a, b) => a.admissionRecordId.localeCompare(b.admissionRecordId))) {
        await this.updateTuition(row.admissionRecordId, { paid: true, updatedAt: row.updatedAt }, actor, transaction);
      }
      return { confirmedCount: ids.length };
    });
  }
  async updateTuition(id: string, dto: UpdateAdmissionTuitionDto, actor: any, existingTransaction?: Transaction) {
    const execute = async (transaction: Transaction) => {
      const record = await this.records.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!record) throw new NotFoundException("Không tìm thấy hồ sơ học viên.");
      if (new Date(record.updatedAt).getTime() !== new Date(dto.updatedAt).getTime()) throw new ConflictException("Hồ sơ đã thay đổi. Tải lại dữ liệu trước khi xác nhận học phí.");
      const evaluation = await this.evaluations.findOne({ where: { admissionRecordId: id }, transaction });
      if (record.trainingLevel !== "Thạc sĩ" || (evaluation ? evaluation.decision !== "admitted" : !["approved", "admitted"].includes(record.status))) {
        throw new BadRequestException("Chỉ xác nhận học phí nhập học cho hồ sơ thạc sĩ đã trúng tuyển.");
      }
      if (!["Đã trúng tuyển", "Đang học"].includes(record.studyStatus || "")) throw new ConflictException("Chỉ cập nhật học phí nhập học khi học viên đang ở trạng thái Đã trúng tuyển hoặc Đang học.");
      if (!dto.paid && !record.extraData?.tuitionPayment?.paid) throw new BadRequestException("Hồ sơ chưa có xác nhận học phí để hủy.");
      const previousPayment = record.extraData?.tuitionPayment || null;
      if (previousPayment?.paid === dto.paid) return { id: record.id, extraData: record.extraData, studyStatus: record.studyStatus, updatedAt: record.updatedAt };
      const payment = { paid: dto.paid, updatedAt: new Date().toISOString(), updatedBy: String(actor?.name || actor?.email || actor?.id || "unknown"), updatedById: actor?.id || null };
      await record.update({ extraData: { ...record.extraData, tuitionPayment: payment }, studyStatus: dto.paid ? "Đang học" : "Đã trúng tuyển" }, { transaction });
      await this.history.create({ admissionRecordId: id, action: dto.paid ? "tuition_paid" : "tuition_unpaid", actor: payment.updatedBy,
        snapshot: { actorId: payment.updatedById, tuitionPayment: payment, previousPayment, record: { ...admissionRecordSnapshot(record), fullName: record.fullName, studyStatus: record.studyStatus } },
      } as any, { transaction });
      return { id: record.id, extraData: record.extraData, studyStatus: record.studyStatus, updatedAt: record.updatedAt };
    };
    return existingTransaction ? execute(existingTransaction) : this.sequelize.transaction(execute);
  }
  async guardRecordUpdate(record: AdmissionRecord | null, dto: any, transaction?: Transaction) {
    if ((record?.trainingLevel || dto.trainingLevel || "Thạc sĩ") !== "Thạc sĩ") return;
    const startsAdmission = dto.status === "admitted"
      || (dto.status === "approved" && record?.status !== "approved")
      || (["Đã trúng tuyển", "Đang học"].includes(dto.studyStatus) && !["Đã trúng tuyển", "Đang học"].includes(record?.studyStatus || ""));
    if (startsAdmission) throw new BadRequestException("Duyệt trúng tuyển tại mục Xét tuyển với quyết định và điểm chuẩn.");
    if (dto.extraData !== undefined && !isDeepStrictEqual(dto.extraData?.tuitionPayment ?? null, record?.extraData?.tuitionPayment ?? null)) {
      throw new BadRequestException("Xác nhận học phí bằng ô Đã nộp học phí nhập học trong danh sách học viên hoặc chi tiết hồ sơ.");
    }
    if (!record) return;
    if (dto.studyStatus === "Đang học" && record.studyStatus !== "Đang học" && record.extraData?.tuitionPayment?.paid !== true) {
      throw new BadRequestException("Xác nhận đã nộp học phí trước khi chuyển sang Đang học.");
    }
    const evaluation = await this.evaluations.findOne({ where: { admissionRecordId: record.id }, transaction });
    if (!evaluation || evaluation.decision === "pending") return;
    if (ADMISSION_CORE_FIELDS.some((key) => dto[key] !== undefined && !isDeepStrictEqual(normalizedAdmissionValue(key, dto[key]), normalizedAdmissionValue(key, record[key] ?? null)))
      || (dto.status !== undefined && dto.status !== record.status)
      || (dto.studyStatus !== undefined && dto.studyStatus !== record.studyStatus && !(evaluation.decision === "admitted" && dto.studyStatus === "Đang học"))) {
      throw new ConflictException("Thông tin xét tuyển đã được duyệt. Mở lại kết quả trước khi thay đổi.");
    }
  }

  // This closes a completed business transition, not a manual edit or a reopen.
  // Read the persisted approval in the caller's transaction; never accept a bypass flag from a DTO.
  async archiveForApprovedMajorTransfer(transferId: string, actor: any, transaction: Transaction) {
    if (!transaction) throw new BadRequestException("Chuyển chuyên ngành phải được xử lý trong một transaction.");
    const transfer = await this.majorTransfers.findByPk(transferId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!transfer || transfer.status !== "approved" || !transfer.toCurriculumId || !transfer.decidedAt
      || transfer.fromMajorId === transfer.toMajorId) {
      throw new ConflictException("Chỉ kết thúc chu kỳ xét tuyển khi chuyển chuyên ngành đã được duyệt.");
    }
    const record = await this.records.findByPk(transfer.admissionRecordId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!record || record.majorId !== transfer.toMajorId || record.status !== "pending"
      || record.studyStatus !== "Nộp hồ sơ đầu vào") {
      throw new ConflictException("Hồ sơ không khớp quyết định chuyển chuyên ngành. Tải lại trước khi xử lý.");
    }
    const evaluation = await this.evaluations.findOne({ where: { admissionRecordId: record.id }, transaction, lock: transaction.LOCK.UPDATE });
    if (!evaluation) return;
    if (evaluation.recordSnapshot?.majorId !== transfer.fromMajorId) {
      throw new ConflictException("Chu kỳ xét tuyển không thuộc chuyên ngành trước khi chuyển. Cần đối soát dữ liệu.");
    }
    const entries = await this.history.findAll({ where: { admissionRecordId: record.id }, order: [["createdAt", "DESC"], ["id", "DESC"]], transaction });
    const saved = entries.find((entry) => entry.snapshot?.evaluation?.id === evaluation.id
      && entry.snapshot?.evaluation?.version === evaluation.version
      && entry.snapshot?.evaluation?.decision === evaluation.decision
      && entry.snapshot?.record?.majorId === transfer.fromMajorId
      && entry.snapshot?.round && entry.snapshot?.result);
    // A decided result must keep its original threshold and decision, not be recalculated
    // against today's round. Missing historical evidence requires reconciliation.
    if (!saved && evaluation.decision !== "pending") {
      throw new ConflictException("Thiếu snapshot quyết định xét tuyển cũ. Cần đối soát lịch sử trước khi chuyển chuyên ngành.");
    }
    let snapshot = saved?.snapshot;
    if (!snapshot) {
      const round = await this.rounds.findByPk(evaluation.roundId, { transaction });
      if (!round) throw new NotFoundException("Không tìm thấy đợt xét tuyển cũ.");
      const majors = await this.majors.findAll({ where: { id: transfer.fromMajorId }, transaction });
      snapshot = { record: { ...evaluation.recordSnapshot, majorName: majors[0]?.name || null },
        round: round.toJSON(), result: scoreAdmission(evaluation.recordSnapshot, evaluation.inputs, round) };
    }
    await this.history.create({ admissionRecordId: record.id, action: "major_transfer",
      actor: String(actor?.name || actor?.email || actor?.id || "unknown"),
      snapshot: { ...snapshot, evaluation: evaluation.toJSON(), actorId: actor?.id || null,
        sourceHistoryId: saved?.id || null,
        majorTransfer: { id: transfer.id, fromMajorId: transfer.fromMajorId, toMajorId: transfer.toMajorId, toCurriculumId: transfer.toCurriculumId },
        note: transfer.decisionNote || "Kết thúc chu kỳ xét tuyển sau khi duyệt chuyển chuyên ngành." },
    } as any, { transaction });
    // History has no FK to this current slot. A new cycle gets its own evaluation ID
    // and version; the old admitted evaluation and all snapshots remain in history.
    await evaluation.destroy({ transaction });
  }
}
