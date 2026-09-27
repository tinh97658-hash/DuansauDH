import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op } from "sequelize";
import type { Transaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { BridgeKnowledgeSubject } from "../database/models/common/bridge-knowledge-subject.model.js";
import { AdmissionRecord } from "../database/models/plan/admission-record.model.js";
import { Curriculum } from "../database/models/plan/curriculum.model.js";
import { CurriculumSubject } from "../database/models/plan/curriculum-subject.model.js";
import { Subject } from "../database/models/plan/subject.model.js";
import { ClassGroupMember } from "../database/models/training/class-group-member.model.js";
import { CourseOffering } from "../database/models/training/course-offering.model.js";
import { CourseOfferingStudent } from "../database/models/training/course-offering-student.model.js";
import { LearnerSubjectResult } from "../database/models/training/learner-subject-result.model.js";
import { SubjectRecognition } from "../database/models/training/subject-recognition.model.js";
import {
  CreateLearningResultDto,
  DecideRecognitionDto,
  ProposeRecognitionsDto,
  UpdateLearningResultDto,
} from "./dto/plan.dto.js";

/** Chỉ kết quả đã hoàn thành VÀ đạt mới được công nhận; đăng ký/đang học chỉ được kế thừa. */
export const isRecognizable = (row: Pick<LearnerSubjectResult, "status" | "result">) =>
  row.status === "completed" && (row.result === "passed" || row.result === "exempt");

const normalizeName = (value: unknown) => String(value || "")
  .normalize("NFC")
  .trim()
  .replace(/\s+/g, " ")
  .toLocaleLowerCase("vi");

/**
 * Cơ chế công nhận học phần dùng chung cho cả chuyển chuyên ngành, tiền thạc sĩ và học trước.
 *
 * Nguồn dữ liệu duy nhất là `learner_subject_results` (kết quả học phần cá nhân). Không có
 * ba luồng công nhận riêng: mọi luồng đều gọi chung `proposeForRecord()`.
 */
@Injectable()
export class SubjectRecognitionService {
  constructor(
    @InjectModel(LearnerSubjectResult) private readonly results: typeof LearnerSubjectResult,
    @InjectModel(SubjectRecognition) private readonly recognitions: typeof SubjectRecognition,
    @InjectModel(BridgeKnowledgeSubject) private readonly bridgeSubjects: typeof BridgeKnowledgeSubject,
    @InjectModel(AdmissionRecord) private readonly records: typeof AdmissionRecord,
    @InjectModel(Curriculum) private readonly curriculums: typeof Curriculum,
    @InjectModel(CurriculumSubject) private readonly curriculumSubjects: typeof CurriculumSubject,
    @InjectModel(Subject) private readonly subjects: typeof Subject,
    @InjectModel(CourseOffering) private readonly offerings: typeof CourseOffering,
    @InjectModel(CourseOfferingStudent) private readonly offeringStudents: typeof CourseOfferingStudent,
    @InjectModel(ClassGroupMember) private readonly memberships: typeof ClassGroupMember,
    private readonly sequelize: Sequelize,
  ) {}

  private readonly learningIncludes = [
    { model: Subject, as: "subject", attributes: ["id", "codeNumber", "codeText", "name", "credits", "canonicalSubjectId", "majorId", "program"] },
    { model: BridgeKnowledgeSubject, as: "bridgeKnowledgeSubject", attributes: ["id", "code", "name", "credits", "equivalentSubjectId"] },
    { model: CourseOffering, as: "courseOffering", attributes: ["id", "name", "status"] },
  ];

  private readonly recognitionIncludes = [
    { model: Subject, as: "sourceSubject", attributes: ["id", "codeNumber", "codeText", "name", "credits"] },
    { model: Subject, as: "targetSubject", attributes: ["id", "codeNumber", "codeText", "name", "credits"] },
    {
      model: LearnerSubjectResult,
      as: "learningResult",
      include: [
        { model: Subject, as: "subject", attributes: ["id", "codeNumber", "codeText", "name", "credits"] },
        { model: BridgeKnowledgeSubject, as: "bridgeKnowledgeSubject", attributes: ["id", "code", "name", "credits"] },
      ],
    },
  ];

  // ===================================================================================
  // 1. Kết quả học phần cá nhân
  // ===================================================================================

  async listLearningResults(admissionRecordId: string) {
    await this.requireRecord(admissionRecordId);
    return this.results.findAll({
      where: { admissionRecordId },
      include: this.learningIncludes as never,
      order: [["academicYear", "DESC"], ["createdAt", "DESC"]],
    });
  }

  async createLearningResult(admissionRecordId: string, dto: CreateLearningResultDto) {
    return this.sequelize.transaction(async (transaction) => {
      await this.requireRecord(admissionRecordId, transaction);
      const payload = await this.buildLearningPayload(dto, transaction);
      const created = await this.results.create({
        ...payload,
        admissionRecordId,
        status: dto.status || "registered",
        result: dto.result || (dto.status === "completed" ? "passed" : "pending"),
      } as never, { transaction });
      return this.results.findByPk(created.id, { include: this.learningIncludes as never, transaction });
    });
  }

  async updateLearningResult(id: string, dto: UpdateLearningResultDto) {
    return this.sequelize.transaction(async (transaction) => {
      const row = await this.results.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!row) throw new NotFoundException("Không tìm thấy kết quả học phần cá nhân.");
      const payload = await this.buildLearningPayload(dto, transaction, row);
      await row.update(payload as never, { transaction });
      if (row.status === "completed" && isRecognizable(row)) {
        // Kết quả vừa đạt: đối chiếu lại với CTĐT hiện hành nếu học viên đã vào CTĐT chính thức.
        await this.proposeForRecord(row.admissionRecordId, {}, transaction);
      }
      return this.results.findByPk(id, { include: this.learningIncludes as never, transaction });
    });
  }

  async removeLearningResult(id: string) {
    const row = await this.results.findByPk(id);
    if (!row) throw new NotFoundException("Không tìm thấy kết quả học phần cá nhân.");
    await row.destroy();
    return { success: true, message: "Đã xóa kết quả học phần cá nhân." };
  }

  private async buildLearningPayload(
    dto: CreateLearningResultDto | UpdateLearningResultDto,
    transaction: Transaction,
    current?: LearnerSubjectResult,
  ) {
    const subjectId = dto.subjectId !== undefined ? dto.subjectId : current?.subjectId ?? null;
    const bridgeId = dto.bridgeKnowledgeSubjectId !== undefined ? dto.bridgeKnowledgeSubjectId : current?.bridgeKnowledgeSubjectId ?? null;
    if (Boolean(subjectId) === Boolean(bridgeId)) {
      throw new BadRequestException("Phải chọn đúng một học phần: hoặc học phần CTĐT, hoặc học phần bổ sung kiến thức.");
    }
    const payload: Record<string, unknown> = {};
    for (const key of ["subjectId", "bridgeKnowledgeSubjectId", "sourceType", "courseOfferingId", "academicYear",
      "status", "result", "score", "completedAt", "decisionNo", "institution", "note"]) {
      if ((dto as never as Record<string, unknown>)[key] !== undefined) payload[key] = (dto as never as Record<string, unknown>)[key];
    }
    if (subjectId) {
      const subject = await this.subjects.findByPk(subjectId, { transaction });
      if (!subject || subject.active === false) throw new BadRequestException("Học phần không tồn tại hoặc đã ngừng sử dụng.");
      payload.subjectId = subject.id;
      payload.bridgeKnowledgeSubjectId = null;
    } else {
      const bridge = await this.bridgeSubjects.findByPk(bridgeId as string, { transaction });
      if (!bridge || bridge.active === false) throw new BadRequestException("Học phần bổ sung kiến thức không tồn tại hoặc đã ngừng sử dụng.");
      payload.subjectId = null;
      payload.bridgeKnowledgeSubjectId = bridge.id;
    }
    const score = payload.score as number | null | undefined;
    if (score !== undefined && score !== null && (Number(score) < 0 || Number(score) > 10)) {
      throw new BadRequestException("Điểm phải nằm trong khoảng 0 đến 10.");
    }
    if (payload.status === "completed" && !payload.completedAt && !current?.completedAt) {
      throw new BadRequestException("Kết quả đã hoàn thành phải có ngày hoàn thành.");
    }
    return payload;
  }

  /**
   * Chuyển các lớp học phần đã hoàn thành giảng dạy mà học viên đã tham gia thành
   * kết quả học phần cá nhân nguồn `regular`. Nhờ vậy mọi đối chiếu công nhận chỉ đọc
   * một nguồn dữ liệu duy nhất, kể cả dữ liệu cũ trước khi có bảng kết quả cá nhân.
   */
  async syncRegularResults(admissionRecordId: string, transaction: Transaction) {
    const record = await this.records.findByPk(admissionRecordId, { attributes: ["id", "studentId"], transaction });
    if (!record) throw new NotFoundException("Không tìm thấy hồ sơ học viên.");

    const identities: Array<{ courseOfferingId: string }> = [];
    const individualRows = await this.offeringStudents.findAll({
      where: { admissionRecordId },
      attributes: ["courseOfferingId"],
      transaction,
    });
    identities.push(...individualRows.map((row) => ({ courseOfferingId: row.courseOfferingId })));

    const membershipRows = await this.memberships.findAll({
      where: { [Op.or]: [{ admissionRecordId }, ...(record.studentId ? [{ studentId: record.studentId }] : [])] } as never,
      attributes: ["classGroupId"],
      transaction,
    });
    const classGroupIds = [...new Set(membershipRows.map((row) => row.classGroupId).filter(Boolean))];
    if (classGroupIds.length > 0) {
      const groupOfferings = await this.sequelize.query(`
        SELECT g.course_offering_id AS "courseOfferingId"
        FROM course_offering_class_groups g
        JOIN course_offerings o ON o.id = g.course_offering_id
        WHERE g.class_group_id IN (:classGroupIds) AND o.status = 'completed'
      `, { replacements: { classGroupIds }, transaction }) as unknown as Array<{ courseOfferingId: string }>;
      identities.push(...groupOfferings);
    }

    const offeringIds = [...new Set(identities.map((row) => row.courseOfferingId).filter(Boolean))];
    if (offeringIds.length === 0) return 0;
    const completedOfferings = await this.offerings.findAll({
      where: { id: { [Op.in]: offeringIds }, status: "completed" },
      attributes: ["id", "subjectId"],
      transaction,
    });
    if (completedOfferings.length === 0) return 0;

    const existing = await this.results.findAll({
      where: {
        admissionRecordId,
        sourceType: "regular",
        subjectId: { [Op.in]: completedOfferings.map((offering) => offering.subjectId) },
      },
      attributes: ["subjectId"],
      transaction,
    });
    const known = new Set(existing.map((row) => row.subjectId));
    const rows = completedOfferings
      .filter((offering) => !known.has(offering.subjectId))
      .map((offering) => ({
        admissionRecordId,
        subjectId: offering.subjectId,
        bridgeKnowledgeSubjectId: null,
        courseOfferingId: offering.id,
        sourceType: "regular",
        status: "completed",
        result: "passed",
        note: "Ghi nhận tự động từ lớp học phần đã hoàn thành giảng dạy.",
      }));
    if (rows.length > 0) await this.results.bulkCreate(rows as never, { transaction, ignoreDuplicates: true });
    return rows.length;
  }

  // ===================================================================================
  // 2. Đối chiếu & đề xuất công nhận (dùng chung mọi luồng)
  // ===================================================================================

  /**
   * Đối chiếu toàn bộ kết quả đã hoàn thành & đạt của học viên với CTĐT hiện hành:
   * - Cùng học phần gốc (`canonical_subject_id`) → tự động công nhận.
   * - Khác mã nhưng đã khai báo tương đương → tự động công nhận.
   * - Chỉ trùng tên + số tín chỉ → tạo đề xuất chờ hội đồng.
   * Kết quả mới đăng ký/đang học chỉ được kế thừa đăng ký, không tính tín chỉ.
   */
  async proposeForRecord(admissionRecordId: string, dto: ProposeRecognitionsDto, outerTransaction?: Transaction) {
    const run = async (transaction: Transaction) => {
      const record = await this.records.findByPk(admissionRecordId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!record) throw new NotFoundException("Không tìm thấy hồ sơ học viên.");
      await this.syncRegularResults(admissionRecordId, transaction);

      const curriculum = await this.resolveCurriculum(record, dto.curriculumId, transaction);
      const targets = await this.curriculumSubjects.findAll({
        where: { curriculumId: curriculum.id },
        include: [{ model: Subject, as: "subject", required: true }] as never,
        transaction,
      });
      const allResults = await this.results.findAll({
        where: { admissionRecordId },
        include: this.learningIncludes as never,
        transaction,
      });

      const targetByRoot = new Map<string, Subject>();
      const targetByName = new Map<string, Subject>();
      for (const row of targets) {
        const target = row.subject as Subject;
        targetByRoot.set(target.canonicalSubjectId || target.id, target);
        targetByName.set(`${normalizeName(target.name)}:${Number(target.credits)}`, target);
      }

      // Ràng buộc duy nhất là (admission_record_id, target_subject_id) nên phải tra theo hồ sơ,
      // không phải theo lần chuyển chuyên ngành.
      const existingRows = await this.recognitions.findAll({
        where: { admissionRecordId },
        transaction,
        ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
      });
      const existingByTarget = new Map(existingRows.map((row) => [row.targetSubjectId, row]));

      const summaries = { autoApproved: 0, pendingReview: 0, skipped: 0, carriedOver: 0 };
      const touched: string[] = [];
      for (const result of allResults) {
        if (!isRecognizable(result)) {
          if (result.status === "registered" || result.status === "studying") {
            // Mới đăng ký hoặc đang học: chỉ kế thừa đăng ký và tiếp tục học, tuyệt đối không tính tín chỉ.
            if (result.subjectId) summaries.carriedOver += 1;
          } else {
            // Đã hoàn thành nhưng không đạt (hoặc chưa có kết quả): phải học lại, không công nhận.
            summaries.skipped += 1;
          }
          continue;
        }
        const candidate = await this.matchTarget(result, targetByRoot, targetByName, transaction);
        if (!candidate) {
          summaries.skipped += 1;
          continue;
        }
        const payload = {
          admissionRecordId,
          majorTransferId: dto.majorTransferId || null,
          learningResultId: result.id,
          sourceSubjectId: candidate.sourceSubjectId,
          targetSubjectId: candidate.target.id,
          sourceCourseOfferingId: result.courseOfferingId || null,
          sourceType: result.sourceType,
          status: candidate.status,
          basis: candidate.basis,
          note: candidate.note,
        };
        const previous = existingByTarget.get(candidate.target.id);
        if (previous) {
          // Đã có quyết định cho học phần này: chỉ nâng cấp khi trước đó còn chờ hội đồng.
          if (previous.status === "pending" && candidate.status === "approved") {
            await previous.update({
              status: "approved", basis: candidate.basis, learningResultId: result.id,
              majorTransferId: previous.majorTransferId || dto.majorTransferId || null, note: candidate.note,
            } as never, { transaction });
          }
        } else {
          const created = await this.recognitions.create(payload as never, { transaction });
          existingByTarget.set(candidate.target.id, created);
        }
        touched.push(candidate.target.id);
        if (candidate.status === "approved") summaries.autoApproved += 1;
        else summaries.pendingReview += 1;
      }

      const rows = await this.recognitions.findAll({
        where: { admissionRecordId, ...(touched.length > 0 ? { targetSubjectId: { [Op.in]: [...new Set(touched)] } } : {}) },
        include: this.recognitionIncludes as never,
        transaction,
      });
      return { curriculum, ...summaries, recognitions: rows, totalCredits: curriculum.totalCredits };
    };
    return outerTransaction ? run(outerTransaction) : this.sequelize.transaction(run);
  }

  private async matchTarget(
    result: LearnerSubjectResult,
    targetByRoot: Map<string, Subject>,
    targetByName: Map<string, Subject>,
    transaction: Transaction,
  ): Promise<{ target: Subject; sourceSubjectId: string; basis: string; status: "approved" | "pending"; note: string } | null> {
    const source = result.subject as Subject | null;
    const bridge = result.bridgeKnowledgeSubject as BridgeKnowledgeSubject | null;

    if (source) {
      const root = targetByRoot.get(source.canonicalSubjectId || source.id);
      if (root) {
        const sameRoot = (source.canonicalSubjectId || source.id) === (root.canonicalSubjectId || root.id);
        return {
          target: root, sourceSubjectId: source.id,
          basis: sameRoot ? "canonical_subject" : "declared_equivalence",
          status: "approved",
          note: "Tự động công nhận do hai mã cùng liên kết tới một học phần gốc.",
        };
      }
    }

    if (bridge) {
      // Học bổ sung kiến thức không mặc nhiên là học phần CTĐT: chỉ công nhận khi có khai báo tương đương.
      if (!bridge.equivalentSubjectId) return null;
      const declared = await this.subjects.findByPk(bridge.equivalentSubjectId, { transaction });
      if (!declared) return null;
      const target = targetByRoot.get(declared.canonicalSubjectId || declared.id) || targetByRoot.get(declared.id);
      if (!target) return null;
      return {
        target, sourceSubjectId: target.id,
        basis: "declared_equivalence",
        status: "approved",
        note: `Học bổ sung kiến thức "${bridge.code}" đã được khai báo tương đương với học phần CTĐT.`,
      };
    }

    if (source) {
      const target = targetByName.get(`${normalizeName(source.name)}:${Number(source.credits)}`);
      if (target) {
        return {
          target, sourceSubjectId: source.id,
          basis: "same_name", status: "pending",
          note: "Chỉ trùng tên và số tín chỉ, chưa khai báo tương đương nên chờ hội đồng xác nhận.",
        };
      }
    }
    return null;
  }

  private async resolveCurriculum(record: AdmissionRecord, curriculumId: string | undefined, transaction: Transaction) {
    if (curriculumId) {
      const curriculum = await this.curriculums.findByPk(curriculumId, { transaction });
      if (!curriculum) throw new BadRequestException("Không tìm thấy chương trình đào tạo.");
      if (!record.majorId || curriculum.majorId !== record.majorId) {
        throw new BadRequestException("Chương trình đào tạo không thuộc chuyên ngành hiện tại của học viên.");
      }
      return curriculum;
    }
    if (!record.majorId) throw new BadRequestException("Học viên chưa có chuyên ngành để đối chiếu CTĐT.");
    const program = String(record.trainingLevel || "").toLowerCase().includes("tiến sĩ") ? "doctoral" : "masters";
    const curriculum = await this.curriculums.findOne({
      where: { majorId: record.majorId, program, applicableFromYear: record.academicYear || "" },
      order: [["createdAt", "DESC"]],
      transaction,
    });
    if (!curriculum) throw new BadRequestException("Chưa có chương trình đào tạo phù hợp với chuyên ngành và khóa của học viên.");
    return curriculum;
  }

  // ===================================================================================
  // 3. Quyết định công nhận (độc lập, không bắt buộc có chuyển chuyên ngành)
  // ===================================================================================

  async listRecognitions(admissionRecordId: string) {
    await this.requireRecord(admissionRecordId);
    return this.recognitions.findAll({
      where: { admissionRecordId },
      include: this.recognitionIncludes as never,
      order: [["createdAt", "DESC"]],
    });
  }

  /** Tín chỉ hoàn thành chỉ tính cho học phần đã được công nhận (trạng thái `approved`). */
  async recognizedCredits(admissionRecordId: string): Promise<number> {
    const rows = await this.recognitions.findAll({
      where: { admissionRecordId, status: "approved" },
      include: [{ model: Subject, as: "targetSubject", attributes: ["id"] }] as never,
    });
    if (rows.length === 0) return 0;
    const record = await this.records.findByPk(admissionRecordId, { attributes: ["majorId", "trainingLevel", "academicYear"] });
    if (!record?.majorId) return 0;
    const program = String(record.trainingLevel || "").toLowerCase().includes("tiến sĩ") ? "doctoral" : "masters";
    const curriculum = await this.curriculums.findOne({
      where: { majorId: record.majorId, program, applicableFromYear: record.academicYear || "" },
      order: [["createdAt", "DESC"]],
    });
    if (!curriculum) return 0;
    const entries = await this.curriculumSubjects.findAll({
      where: { curriculumId: curriculum.id, subjectId: { [Op.in]: rows.map((row) => row.targetSubjectId) } },
      attributes: ["credits"],
    });
    return entries.reduce((total, entry) => total + (Number(entry.credits) || 0), 0);
  }

  async decide(id: string, dto: DecideRecognitionDto) {
    return this.sequelize.transaction(async (transaction) => {
      const row = await this.recognitions.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!row) throw new NotFoundException("Không tìm thấy quyết định công nhận học phần.");
      if (dto.decision === "approved" && !row.learningResultId) {
        throw new ConflictException("Đề xuất công nhận không còn gắn với kết quả học phần cá nhân hợp lệ.");
      }
      const result = row.learningResultId
        ? await this.results.findByPk(row.learningResultId, { transaction })
        : null;
      if (dto.decision === "approved" && result && !isRecognizable(result)) {
        throw new ConflictException("Chỉ công nhận học phần đã hoàn thành và đạt.");
      }
      const targetSubjectId = dto.targetSubjectId || row.targetSubjectId;
      if (dto.targetSubjectId && dto.targetSubjectId !== row.targetSubjectId) {
        const duplicate = await this.recognitions.findOne({
          where: { admissionRecordId: row.admissionRecordId, targetSubjectId, id: { [Op.ne]: row.id } },
          transaction,
        });
        if (duplicate) throw new ConflictException("Học phần CTĐT này đã có một quyết định công nhận khác.");
      }
      await row.update({
        status: dto.decision,
        targetSubjectId,
        decisionNo: dto.decisionNo || null,
        decidedAt: new Date(),
        note: dto.note || row.note,
      } as never, { transaction });
      return this.recognitions.findByPk(id, { include: this.recognitionIncludes as never, transaction });
    });
  }

  /**
   * Hủy một quyết định/đề xuất công nhận học phần.
   *
   * Xóa hẳn bản ghi là chủ ý: quyết định đã chốt vẫn phải sửa lại được khi nhập nhầm hoặc khi
   * hội đồng đổi ý. Sau khi xóa, `proposeForRecord()` có thể tạo lại đề xuất mới dựa trên đúng
   * dữ liệu kết quả học phần hiện hành. Vì vậy không dùng trạng thái "rejected" thay cho việc xóa:
   * một dòng đã `rejected` sẽ bị `proposeForRecord()` bỏ qua và không bao giờ được đề xuất lại.
   */
  async removeRecognition(id: string) {
    const row = await this.recognitions.findByPk(id);
    if (!row) throw new NotFoundException("Không tìm thấy quyết định công nhận học phần.");
    await row.destroy();
    return { success: true, message: "Đã hủy công nhận học phần." };
  }

  async recognitionHistoryFor(admissionRecordId: string, majorTransferId: string) {
    return this.recognitions.findAll({
      where: { admissionRecordId, majorTransferId },
      include: this.recognitionIncludes as never,
      order: [["createdAt", "ASC"]],
    });
  }

  private async requireRecord(admissionRecordId: string, transaction?: Transaction) {
    const record = await this.records.findByPk(admissionRecordId, { attributes: ["id"], transaction });
    if (!record) throw new NotFoundException("Không tìm thấy hồ sơ học viên.");
    return record;
  }
}
