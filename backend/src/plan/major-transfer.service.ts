import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { Major } from "../database/models/common/major.model.js";
import { AdmissionRecord } from "../database/models/plan/admission-record.model.js";
import { Curriculum } from "../database/models/plan/curriculum.model.js";
import { Subject } from "../database/models/plan/subject.model.js";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { ClassGroupMember } from "../database/models/training/class-group-member.model.js";
import { CourseOffering } from "../database/models/training/course-offering.model.js";
import { CourseOfferingClassGroup } from "../database/models/training/course-offering-class-group.model.js";
import { CourseOfferingStudent } from "../database/models/training/course-offering-student.model.js";
import { LearnerSubjectResult } from "../database/models/training/learner-subject-result.model.js";
import { MajorTransfer } from "../database/models/training/major-transfer.model.js";
import { SubjectRecognition } from "../database/models/training/subject-recognition.model.js";
import { DecideMajorTransferDto, RequestMajorTransferDto, UpdateSubjectRecognitionDto } from "./dto/plan.dto.js";
import { SubjectRecognitionService } from "./subject-recognition.service.js";

@Injectable()
export class MajorTransferService {
  constructor(
    @InjectModel(MajorTransfer) private readonly transfers: typeof MajorTransfer,
    @InjectModel(AdmissionRecord) private readonly records: typeof AdmissionRecord,
    @InjectModel(Major) private readonly majors: typeof Major,
    @InjectModel(Curriculum) private readonly curriculums: typeof Curriculum,
    @InjectModel(ClassGroupMember) private readonly memberships: typeof ClassGroupMember,
    @InjectModel(CourseOfferingClassGroup) private readonly offeringGroups: typeof CourseOfferingClassGroup,
    @InjectModel(CourseOfferingStudent) private readonly offeringStudents: typeof CourseOfferingStudent,
    private readonly subjectRecognitionService: SubjectRecognitionService,
    private readonly sequelize: Sequelize,
  ) {}

  private readonly include = [
    { model: Major, as: "fromMajor", attributes: ["id", "code", "name"] },
    { model: Major, as: "toMajor", attributes: ["id", "code", "name"] },
    { model: ClassGroup, as: "fromClassGroup", attributes: ["id", "code", "name"] },
    { model: Curriculum, as: "fromCurriculum", attributes: ["id", "code", "name"] },
    { model: Curriculum, as: "toCurriculum", attributes: ["id", "code", "name"] },
    {
      model: SubjectRecognition,
      as: "recognitions",
      include: [
        { model: Subject, as: "sourceSubject", attributes: ["id", "codeNumber", "codeText", "name"] },
        { model: Subject, as: "targetSubject", attributes: ["id", "codeNumber", "codeText", "name"] },
        {
          model: LearnerSubjectResult,
          as: "learningResult",
          include: [{ model: Subject, as: "subject", attributes: ["id", "codeNumber", "codeText", "name", "credits"] }],
        },
      ],
    },
  ];

  list(admissionRecordId: string) {
    return this.transfers.findAll({
      where: { admissionRecordId }, include: this.include as never,
      order: [["requestedAt", "DESC"], ["createdAt", "DESC"]],
    });
  }

  async request(admissionRecordId: string, dto: RequestMajorTransferDto) {
    return this.sequelize.transaction(async (transaction) => {
      const record = await this.records.findByPk(admissionRecordId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!record) throw new NotFoundException("Không tìm thấy hồ sơ học viên.");
      if (!record.majorId) throw new BadRequestException("Học viên chưa có chuyên ngành hiện tại.");
      if (record.majorId === dto.toMajorId) throw new BadRequestException("Chuyên ngành mới phải khác chuyên ngành hiện tại.");
      const pending = await this.transfers.findOne({ where: { admissionRecordId, status: "pending" }, transaction });
      if (pending) throw new ConflictException("Học viên đang có một yêu cầu chuyển chuyên ngành chờ xử lý.");

      const targetMajor = await this.majors.findByPk(dto.toMajorId, { transaction });
      const expectedProgram = record.trainingLevel === "Tiến sĩ" ? "doctoral" : "masters";
      if (!targetMajor || targetMajor.active === false || targetMajor.program !== expectedProgram) {
        throw new BadRequestException("Chuyên ngành mới không tồn tại hoặc không cùng bậc đào tạo.");
      }
      const membershipWhere = {
        [Op.or]: [
          { admissionRecordId },
          ...(record.studentId ? [{ studentId: record.studentId }] : []),
        ],
      };
      const membership = await this.memberships.findOne({
        where: membershipWhere as never,
        include: [{ model: ClassGroup, as: "classGroup" }] as never,
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const transfer = await this.transfers.create({
        admissionRecordId,
        fromMajorId: record.majorId,
        toMajorId: targetMajor.id,
        fromClassGroupId: membership?.classGroupId || null,
        fromCurriculumId: membership?.classGroup?.curriculumId || null,
        status: "pending",
        reason: dto.reason || null,
        previousAdmissionStatus: record.status,
        previousStudyStatus: record.studyStatus,
        requestedAt: new Date(),
      } as never, { transaction });

      // Preserve completed-course history before detaching the learner from the old class.
      if (membership) {
        const links = await this.offeringGroups.findAll({
          where: { classGroupId: membership.classGroupId },
          include: [{ model: CourseOffering, as: "courseOffering", where: { status: "completed" }, required: true }] as never,
          transaction,
        });
        if (links.length > 0) {
          await this.offeringStudents.bulkCreate(
            links.map((link) => ({ courseOfferingId: link.courseOfferingId, admissionRecordId })) as never,
            { transaction, ignoreDuplicates: true },
          );
        }
      }
      await this.memberships.destroy({ where: membershipWhere as never, transaction });
      await record.update({
        majorId: targetMajor.id,
        majorName: targetMajor.name,
        status: "pending",
        studyStatus: "Nộp hồ sơ đầu vào",
      } as never, { transaction });
      return this.transfers.findByPk(transfer.id, { include: this.include as never, transaction });
    });
  }

  async decide(id: string, dto: DecideMajorTransferDto) {
    return this.sequelize.transaction(async (transaction) => {
      const transfer = await this.transfers.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!transfer) throw new NotFoundException("Không tìm thấy yêu cầu chuyển chuyên ngành.");
      if (transfer.status !== "pending") throw new ConflictException("Yêu cầu chuyển chuyên ngành đã được xử lý.");
      const record = await this.records.findByPk(transfer.admissionRecordId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!record) throw new NotFoundException("Không tìm thấy hồ sơ học viên.");

      if (dto.decision === "rejected") {
        const oldMajor = await this.majors.findByPk(transfer.fromMajorId, { transaction });
        await record.update({
          majorId: transfer.fromMajorId,
          majorName: oldMajor?.name || record.majorName,
          status: transfer.previousAdmissionStatus || "approved",
          studyStatus: transfer.previousStudyStatus || "Đang học",
        } as never, { transaction });
        if (transfer.fromClassGroupId) {
          const existing = await this.memberships.findOne({
            where: { [Op.or]: [{ admissionRecordId: record.id }, ...(record.studentId ? [{ studentId: record.studentId }] : [])] } as never,
            transaction,
          });
          if (!existing) await this.memberships.create({
            classGroupId: transfer.fromClassGroupId, admissionRecordId: record.id, studentId: record.studentId, enrolledAt: new Date(),
            note: "Khôi phục sau khi yêu cầu chuyển chuyên ngành bị từ chối.",
          } as never, { transaction });
        }
      } else {
        if (!dto.toCurriculumId) throw new BadRequestException("Phải chọn chương trình đào tạo mới khi duyệt chuyển chuyên ngành.");
        const curriculum = await this.curriculums.findByPk(dto.toCurriculumId, { transaction });
        const expectedProgram = record.trainingLevel === "Tiến sĩ" ? "doctoral" : "masters";
        if (!curriculum || curriculum.majorId !== transfer.toMajorId || curriculum.program !== expectedProgram
          || curriculum.applicableFromYear !== (record.academicYear || "")) {
          throw new BadRequestException("Chương trình đào tạo mới không phù hợp với chuyên ngành, bậc hoặc khóa của học viên.");
        }
        // Cùng một cơ chế công nhận dùng chung: đối chiếu kết quả học phần cá nhân với CTĐT mới.
        await this.subjectRecognitionService.proposeForRecord(transfer.admissionRecordId, {
          curriculumId: curriculum.id,
          majorTransferId: transfer.id,
        }, transaction);
        await transfer.update({ toCurriculumId: curriculum.id } as never, { transaction });
      }
      await transfer.update({ status: dto.decision, decisionNote: dto.note || null, decidedAt: new Date() } as never, { transaction });
      return this.transfers.findByPk(id, { include: this.include as never, transaction });
    });
  }

  async updateRecognition(id: string, dto: UpdateSubjectRecognitionDto) {
    return this.subjectRecognitionService.decide(id, { decision: dto.status, note: dto.note });
  }
}
