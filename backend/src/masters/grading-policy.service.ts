import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/sequelize";
import { QueryTypes, type Transaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { Subject } from "../database/models/plan/subject.model.js";
import { GradingPoliciesQueryDto, SaveGradingPoliciesDto } from "./dto/grading-policy.dto.js";
import { GradingPolicy, gradingPolicyError, LEGACY_GRADING_POLICY } from "./grading-policy.js";

@Injectable()
export class GradingPolicyService {
  constructor(@InjectModel(Subject) private readonly subjects: typeof Subject, @InjectConnection() private readonly sequelize: Sequelize) {}

  async list(query: GradingPoliciesQueryDto) {
    return this.sequelize.query<{ subjectId: string; policy: GradingPolicy }>(`
      SELECT DISTINCT ON (p.subject_id) p.subject_id AS "subjectId", p.policy
      FROM course_grading_policies p JOIN subjects s ON s.id = p.subject_id
      WHERE s.major_id = :majorId AND s.program = 'masters' AND p.academic_year = :year
      ORDER BY p.subject_id, p.version DESC
    `, { type: QueryTypes.SELECT, replacements: { majorId: query.majorId, year: query.year } });
  }

  async shared(transaction?: Transaction): Promise<GradingPolicy> {
    const [row] = await this.sequelize.query<{ policy: GradingPolicy }>(
      "SELECT policy FROM shared_grading_rules ORDER BY version DESC LIMIT 1", { type: QueryTypes.SELECT, transaction });
    return row?.policy || structuredClone(LEGACY_GRADING_POLICY);
  }

  async latest(subjectId: string, year: string, transaction?: Transaction): Promise<GradingPolicy> {
    const [row] = await this.sequelize.query<{ policy: GradingPolicy }>(`
      SELECT policy FROM course_grading_policies WHERE subject_id = :subjectId AND academic_year = :year ORDER BY version DESC LIMIT 1
    `, { type: QueryTypes.SELECT, replacements: { subjectId, year }, transaction });
    const weights = row?.policy || LEGACY_GRADING_POLICY;
    const shared = await this.shared(transaction);
    return { ...shared, version: weights.version, weights: { ...weights.weights }, rulesVersion: shared.version };
  }

  async save(dto: SaveGradingPoliciesDto, actorId?: string) {
    if (!dto.rows.length && !dto.shared) throw new BadRequestException("Chưa có cấu hình cần lưu.");
    const keys = dto.rows.map(row => `${row.subjectId}:${row.year}`);
    if (new Set(keys).size !== keys.length) throw new BadRequestException("Mỗi môn và năm chỉ được lưu một cấu hình trong một lần cập nhật.");
    return this.sequelize.transaction(async transaction => {
      // Serialize shared edits, including first creation, and keep batch saves atomic.
      await this.sequelize.query("SELECT pg_advisory_xact_lock(714055)", { transaction });
      let shared = await this.shared(transaction);
      if (dto.shared) {
        if (shared.version !== dto.shared.revision) throw new ConflictException("Cấu hình chung đã được người khác sửa. Hãy tải lại trước khi lưu.");
        shared = { ...structuredClone(LEGACY_GRADING_POLICY), minimums: { ...dto.shared.minimums }, courseMinimum: dto.shared.courseMinimum, useDefaultBands: dto.shared.useDefaultBands, version: shared.version + 1,
          bands: (dto.shared.useDefaultBands ? LEGACY_GRADING_POLICY.bands : dto.shared.bands).map(band => ({ ...band, letter: band.letter.trim().toUpperCase() })).sort((a, b) => b.minimum - a.minimum) };
        const invalid = gradingPolicyError(shared);
        if (invalid) throw new BadRequestException(invalid);
        await this.sequelize.query("INSERT INTO shared_grading_rules (version, policy, created_by, created_at) VALUES (:version, CAST(:policy AS jsonb), :actorId, NOW())", {
          transaction, replacements: { version: shared.version, policy: JSON.stringify(shared), actorId: actorId || null },
        });
      }
      const saved: Array<{ subjectId: string; year: string; policy: GradingPolicy }> = [];
      for (const row of [...dto.rows].sort((a, b) => `${a.subjectId}:${a.year}`.localeCompare(`${b.subjectId}:${b.year}`))) {
        const subject = await this.subjects.findByPk(row.subjectId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!subject || subject.program !== "masters") throw new NotFoundException("Không tìm thấy học phần Thạc sĩ.");
        const previous = await this.latest(row.subjectId, row.year, transaction);
        if (previous.version !== row.revision) throw new ConflictException(`Cấu hình môn ${subject.name} đã được người khác sửa. Hãy tải lại trước khi lưu.`);
        const policy: GradingPolicy = {
          ...shared, version: previous.version + 1, weights: { ...row.weights }, rulesVersion: shared.version,
        };
        const invalid = gradingPolicyError(policy);
        if (invalid) throw new BadRequestException(`${subject.name}: ${invalid}`);
        await this.sequelize.query(`INSERT INTO course_grading_policies (id, subject_id, academic_year, version, policy, created_by, created_at)
          VALUES (:id, :subjectId, :year, :version, CAST(:policy AS jsonb), :actorId, NOW())`, {
          replacements: { id: randomUUID(), subjectId: row.subjectId, year: row.year, version: policy.version, policy: JSON.stringify(policy), actorId: actorId || null }, transaction,
        });
        saved.push({ subjectId: row.subjectId, year: row.year, policy });
      }
      return saved;
    });
  }
}
