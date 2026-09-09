import { isSessionEndedInBusinessTimezone } from "./scheduling-time.js";
import { randomUUID } from "node:crypto";
import { QueryTypes } from "sequelize";
import { commonWeekdays, isEarlierAcademicYear, readRetakes } from "./retake-policy.js";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op } from "sequelize";
import type { Transaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { Major } from "../database/models/common/major.model.js";
import { Lecturer } from "../database/models/common/lecturer.model.js";
import { Room } from "../database/models/common/room.model.js";
import { Subject } from "../database/models/plan/subject.model.js";
import { SubjectPackage } from "../database/models/plan/subject-package.model.js";
import { SubjectPackageSubject } from "../database/models/plan/subject-package-subject.model.js";
import { Staff } from "../database/models/staff.model.js";
import { ClassGroup } from "../database/models/training/class-group.model.js";
import { ClassGroupMember } from "../database/models/training/class-group-member.model.js";
import { Student } from "../database/models/student.model.js";
import { AdmissionRecord } from "../database/models/plan/admission-record.model.js";
import { CourseOfferingStudent } from "../database/models/training/course-offering-student.model.js";
import { CourseOffering } from "../database/models/training/course-offering.model.js";
import { CourseOfferingClassGroup } from "../database/models/training/course-offering-class-group.model.js";
import { TeachingSession } from "../database/models/training/teaching-session.model.js";
import {
  CourseOfferingCandidatesQueryDto,
  CreateCourseOfferingDto,
  CreateTeachingSessionDto,
  ListCourseOfferingsQueryDto,
  ListTeachingSessionsQueryDto,
  PreviewCourseOfferingParticipantsDto,
  RetakeQueryDto, RegisterRetakeDto, UpdateRosterNotesDto, SchedulingGroupSettingsDto,
  UpdateTeachingSessionDto,
} from "./dto/scheduling.dto.js";
import { enabledSchedulingPrograms, isSchedulingProgramEnabled } from "./scheduling-program.policy.js";

type OfferingStatus = "active" | "completed";

@Injectable()
export class SchedulingService {
  constructor(
    @InjectModel(CourseOffering) private readonly courseOfferings: typeof CourseOffering,
    @InjectModel(CourseOfferingClassGroup) private readonly offeringGroups: typeof CourseOfferingClassGroup,
    @InjectModel(Subject) private readonly subjects: typeof Subject,
    @InjectModel(SubjectPackage) private readonly packages: typeof SubjectPackage,
    @InjectModel(ClassGroup) private readonly classGroups: typeof ClassGroup,
    @InjectModel(ClassGroupMember) private readonly classGroupMembers: typeof ClassGroupMember,
    @InjectModel(Major) private readonly majors: typeof Major,
    @InjectModel(Staff) private readonly staff: typeof Staff,
    private readonly sequelize: Sequelize,
    @InjectModel(Room) private readonly rooms: typeof Room,
    @InjectModel(Lecturer) private readonly lecturers: typeof Lecturer,
    @InjectModel(TeachingSession) private readonly teachingSessions: typeof TeachingSession,
    @InjectModel(CourseOfferingStudent) private readonly individualStudents: typeof CourseOfferingStudent,
    @InjectModel(AdmissionRecord) private readonly admissionRecords: typeof AdmissionRecord,
  ) {}

  private requireEnabledProgram(program: string) {
    if (!isSchedulingProgramEnabled(program)) {
      throw new BadRequestException(`Chức năng tạo lớp học phần cho chương trình "${program}" chưa được kích hoạt.`);
    }
  }

  private groupSummary(group: ClassGroup | any, localSubject?: Subject | any, memberCount = 0) {
    const value = typeof group?.get === "function" ? group.get({ plain: true }) : group;
    const local = typeof localSubject?.get === "function" ? localSubject.get({ plain: true }) : localSubject;
    return {
      id: value.id,
      code: value.code,
      name: value.name,
      majorId: value.majorId,
      major: value.major || null,
      academicYear: value.academicYear,
      status: value.status,
      memberCount,
      allowedWeekdays: value.allowedWeekdays || [1, 2, 3, 4, 5, 6, 0],
      groupType: value.groupType || "ADMINISTRATIVE",
      ...(local ? {
        localSubject: {
          id: local.id,
          code: local.code,
          name: local.name,
          majorId: local.majorId,
          canonicalSubjectId: local.canonicalSubjectId || null,
        },
      } : {}),
    };
  }

  private sameSubjectAcrossMajors(left: Subject | any, right: Subject | any) {
    const normalizeName = (value: unknown) => String(value || "")
      .normalize("NFC")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("vi");
    return normalizeName(left?.name) !== ""
      && normalizeName(left?.name) === normalizeName(right?.name)
      && Number(left?.credits) === Number(right?.credits)
      && left?.program === right?.program;
  }

  private sharingEnabled(subject: Subject | any) {
    return subject?.allowCrossMajor === true;
  }

  private async loadCanonicalRoots(
    localSubjects: Array<Subject | any>,
    program: string,
    transaction?: Transaction,
  ) {
    const canonicalIds = [...new Set(localSubjects
      .map((subject) => subject?.canonicalSubjectId)
      .filter((id): id is string => Boolean(id)))];
    const roots = canonicalIds.length === 0 ? [] : await this.subjects.findAll({
      where: { id: { [Op.in]: canonicalIds }, program, active: true },
      transaction,
      ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
    });
    return new Map<string, Subject>(roots.map((root) => [root.id, root]));
  }

  private logicalSubjectFor(
    localSubject: Subject | any,
    rootsById: Map<string, Subject>,
    program: string,
  ) {
    if (!localSubject?.canonicalSubjectId) return localSubject as Subject;
    const root = rootsById.get(localSubject.canonicalSubjectId);
    if (!root || root.active === false || root.canonicalSubjectId || root.program !== program) {
      throw new BadRequestException(`Mapping học phần logic của "${localSubject.name || localSubject.id}" không còn hợp lệ.`);
    }
    return root;
  }

  private async resolveLogicalSubject(subject: Subject, transaction?: Transaction) {
    if (!subject.canonicalSubjectId) return subject;
    const roots = await this.loadCanonicalRoots([subject], subject.program, transaction);
    return this.logicalSubjectFor(subject, roots, subject.program);
  }

  private async requireEnabledOfferingSubject(offering: CourseOffering | any, transaction: Transaction) {
    const subject = await this.subjects.findByPk(offering.subjectId, { transaction });
    if (!subject) throw new BadRequestException("Học phần của lớp học phần không còn tồn tại.");
    this.requireEnabledProgram(subject.program);
    return subject;
  }

  private offeringIncludes(subjectWhere?: Record<string, unknown>) {
    return [
      { model: CourseOfferingStudent, as: "individualStudents", include: [{ model: AdmissionRecord, attributes: ["id", "code", "fullName", "studentId"] }] },
      {
        model: Subject,
        as: "subject",
        required: true,
        ...(subjectWhere ? { where: subjectWhere } : {}),
      },
      {
        model: CourseOfferingClassGroup,
        as: "groupLinks",
        include: [{ model: ClassGroup, as: "classGroup", include: [{ model: Major, as: "major", attributes: ["id", "code", "name"] }] }],
      },
      { model: Staff, as: "completedBy", attributes: ["id", "name", "email"] },
    ];
  }

  private memberIdentity(member: ClassGroupMember | any) {
    const value = typeof member?.get === "function" ? member.get({ plain: true }) : member;
    return (value.studentId || value.admissionRecord?.studentId) ? `student:${value.studentId || value.admissionRecord.studentId}`
      : value.admissionRecordId ? `admission:${value.admissionRecordId}`
        : `membership:${value.id}`;
  }

  private setParticipantCount(offering: CourseOffering | any, participantCount: number) {
    if (typeof offering?.setDataValue === "function") offering.setDataValue("participantCount", participantCount);
    else offering.participantCount = participantCount;
  }

  private async attachParticipantCounts(offerings: Array<CourseOffering | any>, transaction?: Transaction) {
    const groupIds = [...new Set(offerings.flatMap((offering) => (
      (offering.groupLinks || []).map((link: CourseOfferingClassGroup | any) => link.classGroupId || link.classGroup?.id)
    )).filter(Boolean))];
    if (groupIds.length === 0) {
      offerings.forEach((offering) => this.setParticipantCount(offering, 0));
      return offerings;
    }
    const members = await this.classGroupMembers.findAll({
      where: { classGroupId: { [Op.in]: groupIds } },
      attributes: ["id", "classGroupId", "studentId", "admissionRecordId"],
      include: [{ model: AdmissionRecord, attributes: ["id", "studentId"] }],
      transaction,
    });
    const byGroup = new Map<string, Set<string>>();
    for (const member of members) {
      const identities = byGroup.get(member.classGroupId) || new Set<string>();
      identities.add(this.memberIdentity(member));
      byGroup.set(member.classGroupId, identities);
    }
    offerings.forEach((offering) => {
      const identities = new Set<string>();
      for (const entry of offering.individualStudents || []) identities.add(this.memberIdentity(entry));
      for (const link of offering.groupLinks || []) {
        const groupId = link.classGroupId || link.classGroup?.id;
        const groupIdentities = byGroup.get(groupId) || new Set<string>();
        if (link.classGroup) {
          if (typeof link.classGroup.setDataValue === "function") {
            link.classGroup.setDataValue("memberCount", groupIdentities.size);
          } else {
            link.classGroup.memberCount = groupIdentities.size;
          }
        }
        for (const identity of groupIdentities) identities.add(identity);
      }
      this.setParticipantCount(offering, identities.size);
    });
    return offerings;
  }

  private async participantCountForGroups(classGroupIds: string[], transaction?: Transaction) {
    const members = await this.classGroupMembers.findAll({
      where: { classGroupId: { [Op.in]: classGroupIds } },
      attributes: ["id", "classGroupId", "studentId", "admissionRecordId"],
      include: [{ model: AdmissionRecord, attributes: ["id", "studentId"] }],
      transaction,
      ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
    });
    return new Set(members.map((member) => this.memberIdentity(member))).size;
  }

  async previewCourseOfferingParticipants(dto: PreviewCourseOfferingParticipantsDto) {
    if (dto.admissionRecordIds?.length) {
      const roster = await this.previewCourseOfferingRoster(dto);
      return { classGroupCount: dto.classGroupIds.length, participantCount: roster.participantCount };
    }
    const groups = await this.classGroups.findAll({
      where: { id: { [Op.in]: dto.classGroupIds } },
      attributes: ["id"],
    });
    if (groups.length !== dto.classGroupIds.length) {
      throw new NotFoundException("Danh sách có nhóm học viên không tồn tại.");
    }
    return {
      classGroupCount: groups.length,
      participantCount: await this.participantCountForGroups(dto.classGroupIds),
    };
  }

  async previewCourseOfferingRoster(dto: PreviewCourseOfferingParticipantsDto) {
    await this.previewCourseOfferingParticipants({ classGroupIds: dto.classGroupIds });
    const individuals = await this.requireIndividualStudents(dto.subjectId, dto.admissionRecordIds || []);
    const members = await this.classGroupMembers.findAll({
      where: { classGroupId: { [Op.in]: dto.classGroupIds } },
      attributes: ["id", "studentId", "admissionRecordId"],
      include: [
        { model: Student, attributes: ["id", "regNo", "fullName"] },
        { model: AdmissionRecord, attributes: ["id", "code", "fullName", "studentId"] },
      ],
      order: [["id", "ASC"]],
    });
    const participants = new Map<string, { id: string; code: string; fullName: string; note: string }>();
    for (const member of [...members, ...individuals.map((record) => ({ admissionRecordId: record.id, admissionRecord: record, studentId: record.studentId, student: null }))]) {
      const id = this.memberIdentity(member);
      const previous = participants.get(id);
      if (previous) {
        continue;
      }
      participants.set(id, { id, code: member.student?.regNo || member.admissionRecord?.code || "",
        fullName: member.student?.fullName || member.admissionRecord?.fullName || "", note: "" });
    }
    const rows = [...participants.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, "vi") || a.code.localeCompare(b.code, "vi", { numeric: true }));
    return { participants: rows, participantCount: rows.length };
  }

  private sessionHasEnded(session: Pick<TeachingSession, "sessionDate" | "endTime"> | any, now = new Date()) {
    return isSessionEndedInBusinessTimezone(session, now);
  }

  async listIndividualStudents(subjectId: string, search = "") {
    const subject = await this.subjects.findByPk(subjectId);
    if (!subject || !subject.active) throw new NotFoundException("Không tìm thấy học phần.");
    this.requireEnabledProgram(subject.program);
    return this.admissionRecords.findAll({
      where: { majorId: subject.majorId, trainingLevel: "Thạc sĩ", status: "approved",
        ...(search.trim() ? { [Op.or]: [{ code: { [Op.iLike]: `%${search.trim().slice(0, 100)}%` } }, { fullName: { [Op.iLike]: `%${search.trim().slice(0, 100)}%` } }] } : {}) },
      attributes: ["id", "code", "fullName", "academicYear", "studentId"], order: [["fullName", "ASC"], ["id", "ASC"]], limit: 100,
    });
  }

  private async requireIndividualStudents(subjectId: string | undefined, ids: string[], transaction?: Transaction) {
    if (!ids.length) return [];
    if (!subjectId || new Set(ids).size !== ids.length) throw new BadRequestException("Danh sách học viên hoặc học phần không hợp lệ.");
    const subject = await this.subjects.findByPk(subjectId, { transaction });
    if (!subject || !subject.active) throw new NotFoundException("Không tìm thấy học phần.");
    this.requireEnabledProgram(subject.program);
    const records = await this.admissionRecords.findAll({
      where: { id: { [Op.in]: ids }, ...(subject.allowCrossMajor ? {} : { majorId: subject.majorId }), trainingLevel: "Thạc sĩ", status: "approved" },
      attributes: ["id", "code", "fullName", "studentId"], order: [["id", "ASC"]], transaction,
      ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
    });
    if (records.length !== ids.length) throw new BadRequestException("Học viên chọn lẻ phải là hồ sơ thạc sĩ đã được duyệt thuộc chuyên ngành của học phần.");
    return records;
  }

  private async offeringMemberIdentities(courseOfferingId: string, groupIds: string[], transaction?: Transaction) {
    const [members, individuals] = await Promise.all([
      this.classGroupMembers.findAll({ where: { classGroupId: { [Op.in]: groupIds } },
        attributes: ["id", "studentId", "admissionRecordId"], include: [{ model: AdmissionRecord, attributes: ["id", "studentId"] }], transaction }),
      this.individualStudents.findAll({ where: { courseOfferingId }, include: [{ model: AdmissionRecord, attributes: ["id", "studentId"] }], transaction }),
    ]);
    return new Set([...members, ...individuals].map((member) => this.memberIdentity(member)));
  }

  private setSessionSummary(offering: CourseOffering | any, summary: Record<string, unknown>) {
    if (typeof offering?.setDataValue === "function") offering.setDataValue("sessionSummary", summary);
    else offering.sessionSummary = summary;
  }

  private async attachSessionSummaries(offerings: Array<CourseOffering | any>, transaction?: Transaction) {
    const offeringIds = [...new Set(offerings.map((offering) => offering.id).filter(Boolean))];
    const emptySummary = () => ({
      totalCount: 0,
      heldCount: 0,
      notHeldCount: 0,
      plannedCount: 0,
      pendingCount: 0,
      futurePlannedCount: 0,
      firstPlannedSessionDate: null as string | null,
      latestTimesByPeriod: {} as Record<string, { sessionId: string; sessionDate: string; startTime: string; endTime: string }>,
    });
    const byOffering = new Map<string, ReturnType<typeof emptySummary>>();
    if (offeringIds.length > 0) {
      const sessions = await this.teachingSessions.findAll({
        where: { courseOfferingId: { [Op.in]: offeringIds } },
        attributes: ["id", "courseOfferingId", "sessionDate", "period", "startTime", "endTime", "status"],
        order: [["sessionDate", "DESC"], ["startTime", "DESC"], ["id", "DESC"]],
        transaction,
      });
      const now = new Date();
      for (const session of sessions) {
        const summary = byOffering.get(session.courseOfferingId) || emptySummary();
        // Latest scheduled date/time across all weeks; only persisted sessions supply defaults.
        if (session.period && !summary.latestTimesByPeriod[session.period]) {
          summary.latestTimesByPeriod[session.period] = {
            sessionId: session.id, sessionDate: session.sessionDate,
            startTime: session.startTime, endTime: session.endTime,
          };
        }
        summary.totalCount += 1;
        if (session.status === "held") summary.heldCount += 1;
        else if (session.status === "not_held") summary.notHeldCount += 1;
        else {
          summary.plannedCount += 1;
          if (this.sessionHasEnded(session, now)) summary.pendingCount += 1;
          else summary.futurePlannedCount += 1;
          if (!summary.firstPlannedSessionDate || session.sessionDate < summary.firstPlannedSessionDate) {
            summary.firstPlannedSessionDate = session.sessionDate;
          }
        }
        byOffering.set(session.courseOfferingId, summary);
      }
    }
    offerings.forEach((offering) => this.setSessionSummary(offering, byOffering.get(offering.id) || emptySummary()));
    return offerings;
  }

  private async attachCourseOfferingMetadata(offerings: Array<CourseOffering | any>, transaction?: Transaction) {
    await this.attachParticipantCounts(offerings, transaction);
    await this.attachSessionSummaries(offerings, transaction);
    offerings.forEach((offering) => {
      const allowedWeekdays = commonWeekdays([...(offering.groupLinks || []).map((link: any) => link.classGroup).filter(Boolean), { allowedWeekdays: offering.retakeWeekdays }]);
      if (typeof offering.setDataValue === "function") offering.setDataValue("allowedWeekdays", allowedWeekdays);
      else offering.allowedWeekdays = allowedWeekdays;
    });
    return offerings;
  }

  async listCourseOfferingCandidates(query: CourseOfferingCandidatesQueryDto) {
    const program = query.program || "masters";
    this.requireEnabledProgram(program);

    const major = await this.majors.findOne({ where: { id: query.majorId, program, active: true } });
    if (!major) throw new NotFoundException("Không tìm thấy ngành đang hoạt động phù hợp với chương trình đào tạo.");

    const groupWhere: Record<string, unknown> = { program };

    const groups = await this.classGroups.findAll({
      where: groupWhere,
      include: [{ model: Major, as: "major", attributes: ["id", "code", "name"] }],
      order: [["code", "ASC"]],
    });
    const anchorGroupIds = new Set(groups.filter((group) => group.majorId === query.majorId && group.academicYear === query.academicYear).map((group) => group.id));
    if (anchorGroupIds.size === 0) {
      return { scope: { program, majorId: query.majorId, academicYear: query.academicYear }, subjects: [] };
    }

    const groupIds = groups.map((group) => group.id);
    const groupMembers = await this.classGroupMembers.findAll({
      where: { classGroupId: { [Op.in]: groupIds } },
      attributes: ["id", "classGroupId"],
    });
    const memberCountByGroup = new Map<string, number>();
    groupMembers.forEach((member) => memberCountByGroup.set(
      member.classGroupId,
      (memberCountByGroup.get(member.classGroupId) || 0) + 1,
    ));
    const packages = await this.packages.findAll({
      where: { classGroupId: { [Op.in]: groupIds }, isOfficial: true, active: true },
      include: [{
        model: SubjectPackageSubject,
        as: "entries",
        required: true,
        include: [{ model: Subject, as: "subject", required: true, where: { program, active: true } }],
      }],
    });

    const groupById = new Map(groups.map((group) => [group.id, group]));
    const localPairs: Array<{ classGroupId: string; localSubject: Subject }> = [];
    for (const pkg of packages) {
      for (const entry of pkg.entries || []) {
        const localSubject = entry.subject as Subject;
        if (!localSubject) continue;
        localPairs.push({ classGroupId: pkg.classGroupId, localSubject });
      }
    }

    const rootsById = await this.loadCanonicalRoots(localPairs.map((pair) => pair.localSubject), program);
    const resolvedPairs = localPairs.flatMap((pair) => {
      const classGroup = groupById.get(pair.classGroupId);
      if (!classGroup || pair.localSubject.majorId !== classGroup.majorId) return [];
      return [{
        ...pair,
        logicalSubject: this.logicalSubjectFor(pair.localSubject, rootsById, program),
      }];
    });
    const sharedAnchorPairs = resolvedPairs.filter((pair) => (
      anchorGroupIds.has(pair.classGroupId) && this.sharingEnabled(pair.logicalSubject)
    ));
    const automaticallyMatchedPairs = resolvedPairs.map((pair) => {
      const classGroup = groupById.get(pair.classGroupId);
      if (!classGroup || classGroup.majorId === query.majorId || anchorGroupIds.has(pair.classGroupId)) return pair;
      const anchor = sharedAnchorPairs.find((candidate) => (
        this.sameSubjectAcrossMajors(candidate.logicalSubject, pair.localSubject)
      ));
      return anchor ? { ...pair, logicalSubject: anchor.logicalSubject } : pair;
    });
    const anchorLogicalIds = new Set(automaticallyMatchedPairs
      .filter((pair) => anchorGroupIds.has(pair.classGroupId))
      .map((pair) => pair.logicalSubject.id));
    const pairByKey = new Map<string, typeof automaticallyMatchedPairs[number]>();
    for (const pair of automaticallyMatchedPairs) {
      const isAnchor = anchorGroupIds.has(pair.classGroupId);
      const group = groupById.get(pair.classGroupId);
      const inRequestedPeriod = group?.academicYear === query.academicYear;
      if (!isAnchor && (!inRequestedPeriod || !anchorLogicalIds.has(pair.logicalSubject.id)
        || (group?.majorId !== query.majorId && !this.sharingEnabled(pair.logicalSubject)))) continue;
      pairByKey.set(`${pair.classGroupId}:${pair.logicalSubject.id}`, pair);
    }
    const candidatePairs = [...pairByKey.values()];
    const subjectIds = [...new Set(candidatePairs.flatMap((pair) => [pair.logicalSubject.id, pair.localSubject.id]))];
    const logicalIdByLocalId = new Map(candidatePairs.map((pair) => [pair.localSubject.id, pair.logicalSubject.id]));
    const stateByPair = new Map<string, OfferingStatus>();
    if (subjectIds.length > 0) {
      const history = await this.offeringGroups.findAll({
        where: { classGroupId: { [Op.in]: groupIds } },
        include: [{
          model: CourseOffering,
          as: "courseOffering",
          required: true,
          where: { subjectId: { [Op.in]: subjectIds }, status: { [Op.in]: ["active", "completed"] } },
        }],
      });
      for (const link of history) {
        const logicalSubjectId = logicalIdByLocalId.get(link.courseOffering.subjectId) || link.courseOffering.subjectId;
        const key = `${link.classGroupId}:${logicalSubjectId}`;
        const nextStatus = link.courseOffering.status as OfferingStatus;
        if (nextStatus === "completed" || !stateByPair.has(key)) stateByPair.set(key, nextStatus);
      }
    }

    const result = new Map<string, {
      subject: any;
      eligibleClassGroups: any[];
      activeClassGroups: any[];
      completedClassGroups: any[];
    }>();
    for (const pair of candidatePairs) {
      const subject = pair.logicalSubject;
      const group = groupById.get(pair.classGroupId)!;
      let row = result.get(subject.id);
      if (!row) {
        const value = typeof (subject as any).get === "function" ? (subject as any).get({ plain: true }) : subject;
        row = { subject: value, eligibleClassGroups: [], activeClassGroups: [], completedClassGroups: [] };
        result.set(subject.id, row);
      }
      const status = stateByPair.get(`${pair.classGroupId}:${subject.id}`);
      const summary = this.groupSummary(group, pair.localSubject, memberCountByGroup.get(group.id) || 0);
      if (status === "completed") row.completedClassGroups.push(summary);
      else if (status === "active") row.activeClassGroups.push(summary);
      else row.eligibleClassGroups.push(summary);
    }

    const subjects = [...result.values()]
      .filter((row) => row.eligibleClassGroups.some((group) => anchorGroupIds.has(group.id)))
      .sort((left, right) => (
        Number(left.subject.sortOrder || 0) - Number(right.subject.sortOrder || 0)
        || Number(left.subject.codeNumber || 0) - Number(right.subject.codeNumber || 0)
        || String(left.subject.name || "").localeCompare(String(right.subject.name || ""), "vi")
      ));

    return {
      scope: { program, majorId: query.majorId, academicYear: query.academicYear },
      subjects,
    };
  }

  async createCourseOffering(dto: CreateCourseOfferingDto) {
    if (!Array.isArray(dto.classGroupIds) || dto.classGroupIds.length === 0) {
      throw new BadRequestException("Lớp học phần phải có ít nhất một nhóm học viên.");
    }
    const uniqueGroupIds = [...new Set(dto.classGroupIds)];
    if (uniqueGroupIds.length !== dto.classGroupIds.length) {
      throw new BadRequestException("Danh sách nhóm học viên bị trùng lặp.");
    }

    return this.sequelize.transaction(async (transaction) => {
      const requestedSubject = await this.subjects.findByPk(dto.subjectId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!requestedSubject || requestedSubject.active === false) throw new NotFoundException("Không tìm thấy học phần đang hoạt động.");
      const subject = await this.resolveLogicalSubject(requestedSubject, transaction);
      this.requireEnabledProgram(subject.program);

      const sortedGroupIds = [...uniqueGroupIds].sort();
      const groups = await this.classGroups.findAll({
        where: { id: { [Op.in]: sortedGroupIds } },
        order: [["id", "ASC"]],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (groups.length !== sortedGroupIds.length) throw new NotFoundException("Danh sách có nhóm học viên không tồn tại.");

      if (groups.some((group) => group.program !== subject.program)) {
        throw new BadRequestException("Nhóm học viên không phù hợp với chương trình đào tạo của học phần.");
      }
      const usesCrossMajorIdentity = groups.some((group) => group.majorId !== subject.majorId);
      if (usesCrossMajorIdentity && !this.sharingEnabled(subject)) {
        throw new BadRequestException("Học phần chưa được tích cho phép học chung khác ngành.");
      }

      const packages = await this.packages.findAll({
        where: { classGroupId: { [Op.in]: sortedGroupIds }, isOfficial: true, active: true },
        include: [{
          model: SubjectPackageSubject,
          as: "entries",
          required: true,
          include: [{ model: Subject, as: "subject", required: true, where: { program: subject.program, active: true } }],
        }],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const packageByGroup = new Map(packages.map((pkg) => [pkg.classGroupId, pkg]));
      const packageSubjects = packages.flatMap((pkg) => (pkg.entries || [])
        .map((entry) => entry.subject as Subject)
        .filter(Boolean));
      const rootsById = await this.loadCanonicalRoots(packageSubjects, subject.program, transaction);
      const matchingSubjectIds = new Set<string>([subject.id, requestedSubject.id]);
      for (const group of groups) {
        const officialPackage = packageByGroup.get(group.id);
        if (!officialPackage) {
          throw new BadRequestException(`Nhóm "${group.code}" chưa có gói học phần chính thức đang hoạt động.`);
        }
        const matchingLocalSubject = (officialPackage.entries || [])
          .map((entry) => entry.subject as Subject)
          .find((localSubject) => (
            localSubject
            && localSubject.majorId === group.majorId
            && (
              this.logicalSubjectFor(localSubject, rootsById, subject.program).id === subject.id
              || (this.sharingEnabled(subject) && this.sameSubjectAcrossMajors(subject, localSubject))
            )
          ));
        if (!matchingLocalSubject) {
          throw new BadRequestException(`Gói học phần chính thức của nhóm "${group.code}" không chứa môn trùng tên và số tín chỉ.`);
        }
        matchingSubjectIds.add(matchingLocalSubject.id);
      }

      const history = await this.offeringGroups.findAll({
        where: { classGroupId: { [Op.in]: sortedGroupIds } },
        include: [{
          model: CourseOffering,
          as: "courseOffering",
          required: true,
          where: { subjectId: { [Op.in]: [...matchingSubjectIds] }, status: { [Op.in]: ["active", "completed"] } },
        }],
        transaction,
      });
      const completedGroupIds = new Set(history.filter((link) => link.courseOffering.status === "completed").map((link) => link.classGroupId));
      const activeGroupIds = new Set(history.filter((link) => link.courseOffering.status === "active").map((link) => link.classGroupId));
      if (completedGroupIds.size > 0) {
        throw new ConflictException("Có nhóm đã hoàn thành học phần này; không thể mở lại cho toàn bộ nhóm.");
      }
      if (activeGroupIds.size > 0) {
        throw new ConflictException("Có nhóm đang thuộc một lớp học phần đang hoạt động của học phần này.");
      }

      const individuals = await this.requireIndividualStudents(subject.id, dto.admissionRecordIds || [], transaction);
      if (!commonWeekdays(groups).length) throw new BadRequestException("Các nhóm đã chọn không có ngày học chung.");
      // majorId is the discovery scope; eligible groups may all belong to other majors.
      // Their eligibility is determined by the official package and subject checks above.
      if (dto.academicYear && groups.some((group) => group.academicYear !== dto.academicYear)) {
        throw new BadRequestException("Các nhóm ghép chung phải thuộc cùng khóa / năm học đang tổ chức.");
      }
      let selectedRetakes: any[] = [];
      if (individuals.length) {
        const retakes = await readRetakes(this.sequelize, subject.id, transaction);
        selectedRetakes = retakes.filter((request) => individuals.some((record) => record.id === request.id));
        if (!commonWeekdays([...groups, ...selectedRetakes]).length) throw new BadRequestException("Học viên học lại không có ngày học chung với nhóm đã chọn.");
        const members = await this.classGroupMembers.findAll({ where: { classGroupId: { [Op.in]: sortedGroupIds } }, include: [{ model: AdmissionRecord, attributes: ["id", "studentId"] }], transaction });
        const memberIds = new Set(members.map((member) => this.memberIdentity(member)));
        if (individuals.some((record) => memberIds.has(this.memberIdentity({ admissionRecordId: record.id, admissionRecord: record })))) {
          throw new BadRequestException("Học viên học lại đã nằm trong nhóm được chọn.");
        }
        const targetYears = dto.academicYear ? [dto.academicYear] : groups.map((group) => group.academicYear || "");
        for (const record of individuals) {
          const request = retakes.find((item) => item.id === record.id);
          if (!request || !targetYears.every((year) => isEarlierAcademicYear(request.academicYear, year))) {
            throw new BadRequestException("Học viên bổ sung phải có nhu cầu học lại đã ghi nhận từ khóa trước và chưa thuộc lớp đang dạy của học phần.");
          }
        }
      }
      const participantNotes = (dto.participantNotes || []).map((entry) => ({ ...entry, note: entry.note.trim() })).filter((entry) => entry.note);
      if (participantNotes.length) {
        const members = await this.classGroupMembers.findAll({
          where: { classGroupId: { [Op.in]: sortedGroupIds } },
          attributes: ["id", "studentId", "admissionRecordId"],
          include: [{ model: AdmissionRecord, attributes: ["id", "studentId"] }],
          transaction,
        });
        const identities = new Set([
          ...members.map((member) => this.memberIdentity(member)),
          ...individuals.map((record) => this.memberIdentity({ admissionRecordId: record.id, admissionRecord: record })),
        ]);
        if (participantNotes.some((entry) => !identities.has(entry.participantId))) {
          throw new BadRequestException("Ghi chú chứa học viên không thuộc danh sách lớp.");
        }
      }
      const offering = await this.courseOfferings.create({
        subjectId: subject.id,
        status: "active",
        note: dto.note || null,
        ...(selectedRetakes.length ? { retakeWeekdays: commonWeekdays(selectedRetakes) } : {}),
        ...(participantNotes.length ? { participantNotes } : {}),
      }, { transaction });
      await this.offeringGroups.bulkCreate(sortedGroupIds.map((classGroupId) => ({
        courseOfferingId: offering.id,
        classGroupId,
      })), { transaction });

      if (individuals.length) await this.individualStudents.bulkCreate(individuals.map((record) => ({ courseOfferingId: offering.id, admissionRecordId: record.id })), { transaction });
      if (individuals.length) await this.sequelize.query(`UPDATE scheduling_retakes SET assigned_course_offering_id = :offeringId WHERE subject_id = :subjectId AND admission_record_id IN (:ids) AND assigned_course_offering_id IS NULL`, {
        replacements: { offeringId: offering.id, subjectId: subject.id, ids: individuals.map((record) => record.id) }, transaction,
      });
      return this.findCourseOfferingById(offering.id, transaction);
    });
  }

  async listCourseOfferings(query: ListCourseOfferingsQueryDto) {
    const program = query.program || "masters";
    this.requireEnabledProgram(program);
    const where: Record<string | symbol, unknown> = {};
    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.status) where.status = query.status;

    if (query.majorId || query.academicYear) {
      const groupWhere: Record<string, unknown> = { program };
      if (query.majorId) groupWhere.majorId = query.majorId;
      if (query.academicYear) groupWhere.academicYear = query.academicYear;
      const matchingGroups = await this.classGroups.findAll({ where: groupWhere, attributes: ["id"] });
      if (matchingGroups.length === 0) return [];
      const links = await this.offeringGroups.findAll({
        where: { classGroupId: { [Op.in]: matchingGroups.map((group) => group.id) } },
        attributes: ["courseOfferingId"],
      });
      const offeringIds = [...new Set(links.map((link) => link.courseOfferingId))];
      if (offeringIds.length === 0) return [];
      where.id = { [Op.in]: offeringIds };
    }

    const offerings = await this.courseOfferings.findAll({
      where,
      include: this.offeringIncludes({ program }),
      order: [["createdAt", "DESC"]],
    });
    return this.attachCourseOfferingMetadata(offerings);
  }

  async getCourseOffering(id: string) {
    return this.findCourseOfferingById(id);
  }

  private normalizeTime(value: string) {
    return value.length === 5 ? `${value}:00` : value;
  }

  private validateTimeRange(startTime: string, endTime: string) {
    if (startTime >= endTime) {
      throw new BadRequestException("Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc.");
    }
  }

  private assertPeriodTimeConsistency(period: string, startTime: string, endTime: string) {
    const valid = period === "MORNING"
      ? startTime >= "00:00:00" && startTime < "12:00:00" && endTime <= "12:00:00"
      : period === "AFTERNOON" && startTime >= "12:00:00" && endTime <= "23:59:59";
    if (!valid) {
      throw new BadRequestException({
        code: "PERIOD_TIME_MISMATCH",
        message: period === "MORNING"
          ? "Giờ học phải nằm trong khoảng Sáng 00:00–12:00."
          : "Giờ học phải nằm trong khoảng Chiều 12:00–23:59.",
        details: { period, startTime, endTime },
      });
    }
  }

  private assertTargetSessionNotEnded(sessionDate: string, startTime: string, endTime: string) {
    if (this.sessionHasEnded({ sessionDate, endTime })) {
      throw new ConflictException({
        code: "SESSION_TIME_IN_PAST",
        message: "Không thể xếp lịch vào một buổi học đã kết thúc.",
        details: { sessionDate, startTime, endTime },
      });
    }
  }

  private sessionIncludes(subjectWhere?: Record<string | symbol, unknown>) {
    return [
      {
        model: CourseOffering,
        as: "courseOffering",
        required: true,
        include: [
          { model: Subject, as: "subject", required: true, ...(subjectWhere ? { where: subjectWhere } : {}) },
          {
            model: CourseOfferingClassGroup,
            as: "groupLinks",
            include: [{ model: ClassGroup, as: "classGroup", include: [{ model: Major, as: "major", attributes: ["id", "code", "name"] }] }],
          },
        ],
      },
      { model: Lecturer, as: "lecturer", attributes: ["id", "code", "name", "active"] },
      { model: Room, as: "room", attributes: ["id", "code", "name", "capacity", "isActive"] },
      { model: Staff, as: "confirmedBy", attributes: ["id", "name", "email"] },
    ];
  }

  private async offeringGroupIds(courseOfferingId: string, transaction: Transaction) {
    const links = await this.offeringGroups.findAll({
      where: { courseOfferingId },
      attributes: ["classGroupId"],
      order: [["classGroupId", "ASC"]],
      transaction,
    });
    return [...new Set(links.map((link) => link.classGroupId))].sort();
  }

  private async lockAndValidateSessionResources(
    courseOfferingId: string,
    roomIds: string[],
    lecturerIds: string[],
    classGroupIds: string[],
    targetRoomId: string,
    targetLecturerId: string,
    transaction: Transaction,
  ) {
    const sortedRoomIds = [...new Set(roomIds)].sort();
    const lockedRooms = await this.rooms.findAll({
      where: { id: { [Op.in]: sortedRoomIds } },
      order: [["id", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const targetRoom = lockedRooms.find((room) => room.id === targetRoomId);
    if (!targetRoom) throw new NotFoundException("Không tìm thấy phòng học.");
    if (targetRoom.isActive !== true) throw new BadRequestException("Phòng học đã ngừng sử dụng.");

    const sortedLecturerIds = [...new Set(lecturerIds)].sort();
    const lockedLecturers = await this.lecturers.findAll({
      where: { id: { [Op.in]: sortedLecturerIds } },
      order: [["id", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const targetLecturer = lockedLecturers.find((lecturer) => lecturer.id === targetLecturerId);
    if (!targetLecturer) throw new NotFoundException("Không tìm thấy giảng viên.");
    if (targetLecturer.active !== true) throw new BadRequestException("Giảng viên đã ngừng sử dụng.");

    if (classGroupIds.length === 0) {
      throw new BadRequestException("Lớp học phần chưa có thành phần nhóm học viên hợp lệ.");
    }
    const lockedGroups = await this.classGroups.findAll({
      where: { id: { [Op.in]: classGroupIds } },
      order: [["id", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (lockedGroups.length !== classGroupIds.length) {
      throw new BadRequestException("Thành phần nhóm học viên của lớp học phần không còn hợp lệ.");
    }

    const offering = await this.courseOfferings.findByPk(courseOfferingId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!offering) throw new NotFoundException("Không tìm thấy lớp học phần.");
    if (offering.status !== "active") {
      throw new ConflictException("Không thể xếp lịch cho lớp học phần đã hoàn thành.");
    }
    const subject = await this.requireEnabledOfferingSubject(offering, transaction);
    if (subject.active !== true) throw new BadRequestException("Học phần của lớp học phần đã ngừng sử dụng hoặc không tồn tại.");
    if (lockedGroups.some((group) => group.program !== subject.program)) {
      throw new BadRequestException("Thành phần nhóm học viên không phù hợp với chương trình của lớp học phần.");
    }

    const participantCount = (await this.offeringMemberIdentities(courseOfferingId, classGroupIds, transaction)).size;
    if (targetRoom.capacity === null || targetRoom.capacity === undefined) {
      throw new ConflictException({
        code: "ROOM_CAPACITY_MISSING",
        message: "Phòng học chưa được khai báo sức chứa.",
        details: { roomId: targetRoom.id, roomCode: targetRoom.code, participantCount },
      });
    }
    if (targetRoom.capacity < participantCount) {
      throw new ConflictException({
        code: "ROOM_CAPACITY_EXCEEDED",
        message: "Sức chứa phòng học không đủ cho lớp học phần.",
        details: {
          roomId: targetRoom.id,
          roomCode: targetRoom.code,
          roomCapacity: targetRoom.capacity,
          participantCount,
        },
      });
    }

    return { offering, subject, groups: lockedGroups, room: targetRoom, lecturer: targetLecturer, participantCount };
  }

  private conflict(
    code: "ROOM_CONFLICT" | "LECTURER_CONFLICT" | "CLASS_GROUP_CONFLICT" | "STUDENT_CONFLICT",
    message: string,
    existing: TeachingSession | any,
    details: Record<string, unknown>,
  ): never {
    const offering = existing.courseOffering;
    const conflictContext = {
      courseOfferingId: existing.courseOfferingId,
      subject: offering?.subject ? {
        id: offering.subject.id,
        code: offering.subject.code,
        name: offering.subject.name,
      } : null,
      classGroups: (offering?.groupLinks || []).map((link: CourseOfferingClassGroup | any) => ({
        id: link.classGroupId || link.classGroup?.id,
        code: link.classGroup?.code || null,
        name: link.classGroup?.name || null,
      })),
      lecturer: existing.lecturer ? {
        id: existing.lecturer.id,
        code: existing.lecturer.code,
        name: existing.lecturer.name,
      } : null,
      room: existing.room ? {
        id: existing.room.id,
        code: existing.room.code,
        name: existing.room.name,
      } : null,
    };
    throw new ConflictException({
      code,
      message,
      details: {
        teachingSessionId: existing.id,
        sessionDate: existing.sessionDate,
        startTime: existing.startTime,
        endTime: existing.endTime,
        conflictingSession: conflictContext,
        ...details,
      },
    });
  }

  private async assertNoSessionConflict(
    values: {
      sessionDate: string;
      startTime: string;
      endTime: string;
      roomId: string;
      lecturerId: string;
      classGroupIds: string[];
      courseOfferingId: string;
    },
    transaction: Transaction,
    excludeSessionId?: string,
  ) {
    const where: Record<string | symbol, unknown> = {
      sessionDate: values.sessionDate,
      status: { [Op.ne]: "not_held" },
      startTime: { [Op.lt]: values.endTime },
      endTime: { [Op.gt]: values.startTime },
    };
    if (excludeSessionId) where.id = { [Op.ne]: excludeSessionId };
    const overlaps = await this.teachingSessions.findAll({
      where,
      include: [{
        model: CourseOffering,
        as: "courseOffering",
        required: true,
        include: [
          { model: Subject, as: "subject", attributes: ["id", "code", "name"] },
          {
            model: CourseOfferingClassGroup,
            as: "groupLinks",
            required: true,
            include: [{ model: ClassGroup, as: "classGroup", attributes: ["id", "code", "name"] }],
          },
        ],
      },
      { model: Lecturer, as: "lecturer", attributes: ["id", "code", "name"] },
      { model: Room, as: "room", attributes: ["id", "code", "name"] }],
      transaction,
      order: [["startTime", "ASC"], ["id", "ASC"]],
    });
    const targetGroups = new Set(values.classGroupIds);
    const targetMembers = await this.offeringMemberIdentities(values.courseOfferingId, values.classGroupIds, transaction);
    for (const existing of overlaps) {
      if (existing.roomId === values.roomId) {
        this.conflict("ROOM_CONFLICT", "Phòng học đã có lịch trong khoảng thời gian này.", existing, { roomId: values.roomId });
      }
      if (existing.lecturerId === values.lecturerId) {
        this.conflict("LECTURER_CONFLICT", "Giảng viên đã có lịch trong khoảng thời gian này.", existing, { lecturerId: values.lecturerId });
      }
      const sharedGroupIds = (existing.courseOffering?.groupLinks || [])
        .map((link: CourseOfferingClassGroup) => link.classGroupId)
        .filter((id: string) => targetGroups.has(id));
      if (sharedGroupIds.length > 0) {
        this.conflict("CLASS_GROUP_CONFLICT", "Nhóm học viên đã có lịch trong khoảng thời gian này.", existing, { classGroupIds: sharedGroupIds });
      }
      const otherGroupIds = (existing.courseOffering?.groupLinks || []).map((link: CourseOfferingClassGroup) => link.classGroupId);
      const otherMembers = await this.offeringMemberIdentities(existing.courseOfferingId, otherGroupIds, transaction);
      if ([...targetMembers].some((id) => otherMembers.has(id))) {
        this.conflict("STUDENT_CONFLICT", "Học viên trong lớp đã có lịch học trong khoảng thời gian này.", existing, {});
      }
    }
  }

  async listTeachingSessions(query: ListTeachingSessionsQueryDto) {
    if (query.from > query.to) throw new BadRequestException("Khoảng ngày tra cứu không hợp lệ.");
    const where: Record<string | symbol, unknown> = { sessionDate: { [Op.between]: [query.from, query.to] } };
    if (query.courseOfferingId) where.courseOfferingId = query.courseOfferingId;
    if (query.lecturerId) where.lecturerId = query.lecturerId;
    if (query.roomId) where.roomId = query.roomId;
    const sessions = await this.teachingSessions.findAll({
      where,
      include: this.sessionIncludes({ program: { [Op.in]: enabledSchedulingPrograms } }),
      order: [["sessionDate", "ASC"], ["startTime", "ASC"], ["id", "ASC"]],
    });
    await this.attachParticipantCounts(sessions.map((session) => session.courseOffering).filter(Boolean));
    return sessions;
  }

  async listPendingTeachingSessions() {
    const sessions = await this.teachingSessions.findAll({
      where: { status: "planned" },
      include: this.sessionIncludes({ program: { [Op.in]: enabledSchedulingPrograms } }),
      order: [["sessionDate", "DESC"], ["endTime", "DESC"], ["id", "DESC"]],
    });
    const pending = sessions.filter((session) => session.status === "planned" && this.sessionHasEnded(session));
    await this.attachParticipantCounts(pending.map((session) => session.courseOffering).filter(Boolean));
    return pending;
  }

  async listUnresolvedTeachingSessions(courseOfferingId: string) {
    const offering = await this.courseOfferings.findByPk(courseOfferingId, {
      include: [{ model: Subject, as: "subject", required: true }],
    });
    if (!offering) throw new NotFoundException("Không tìm thấy lớp học phần.");
    this.requireEnabledProgram(offering.subject.program);
    const sessions = await this.teachingSessions.findAll({
      where: { courseOfferingId, status: "planned" },
      include: this.sessionIncludes(),
      order: [["sessionDate", "ASC"], ["startTime", "ASC"], ["id", "ASC"]],
    });
    await this.attachParticipantCounts(sessions.map((session) => session.courseOffering).filter(Boolean));
    return sessions;
  }

  async getTeachingSession(id: string) {
    return this.findTeachingSessionById(id);
  }

  async createTeachingSession(dto: CreateTeachingSessionDto) {
    const startTime = this.normalizeTime(dto.startTime);
    const endTime = this.normalizeTime(dto.endTime);
    this.validateTimeRange(startTime, endTime);
    this.assertPeriodTimeConsistency(dto.period, startTime, endTime);
    this.assertTargetSessionNotEnded(dto.sessionDate, startTime, endTime);
    return this.sequelize.transaction(async (transaction) => {
      await this.sequelize.query("SELECT pg_advisory_xact_lock(21025)", { transaction });
      const classGroupIds = await this.offeringGroupIds(dto.courseOfferingId, transaction);
      const resources = await this.lockAndValidateSessionResources(
        dto.courseOfferingId,
        [dto.roomId],
        [dto.lecturerId],
        classGroupIds,
        dto.roomId,
        dto.lecturerId,
        transaction,
      );
      if (!commonWeekdays([...resources.groups, { allowedWeekdays: resources.offering.retakeWeekdays }]).includes(new Date(`${dto.sessionDate}T12:00:00Z`).getUTCDay())) {
        throw new BadRequestException("Ngày học không thuộc ngày học chung của các nhóm.");
      }
      const values = {
        courseOfferingId: dto.courseOfferingId,
        sessionDate: dto.sessionDate,
        startTime,
        endTime,
        period: dto.period,
        lecturerId: dto.lecturerId,
        roomId: dto.roomId,
        note: dto.note || null,
        status: "planned" as const,
      };
      await this.assertNoSessionConflict({ ...values, classGroupIds }, transaction);
      const created = await this.teachingSessions.create(values, { transaction });
      return this.findTeachingSessionById(created.id, transaction);
    });
  }

  async updateTeachingSession(id: string, dto: UpdateTeachingSessionDto) {
    return this.sequelize.transaction(async (transaction) => {
      await this.sequelize.query("SELECT pg_advisory_xact_lock(21025)", { transaction });
      const session = await this.teachingSessions.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!session) throw new NotFoundException("Không tìm thấy buổi học.");
      if (session.status !== "planned") throw new ConflictException("Chỉ buổi học đang ở trạng thái đã xếp mới được chỉnh sửa.");
      if (this.sessionHasEnded(session)) {
        throw new ConflictException({
          code: "SESSION_ALREADY_ENDED",
          message: "Buổi học đã kết thúc và đang chờ xác nhận; không thể chỉnh sửa lịch.",
          details: { teachingSessionId: session.id },
        });
      }
      const sessionDate = dto.sessionDate ?? session.sessionDate;
      const startTime = this.normalizeTime(dto.startTime ?? session.startTime);
      const endTime = this.normalizeTime(dto.endTime ?? session.endTime);
      const lecturerId = dto.lecturerId ?? session.lecturerId;
      const roomId = dto.roomId ?? session.roomId;
      this.validateTimeRange(startTime, endTime);
      this.assertPeriodTimeConsistency(dto.period ?? session.period, startTime, endTime);
      this.assertTargetSessionNotEnded(sessionDate, startTime, endTime);
      const classGroupIds = await this.offeringGroupIds(session.courseOfferingId, transaction);
      const resources = await this.lockAndValidateSessionResources(
        session.courseOfferingId,
        [session.roomId, roomId],
        [session.lecturerId, lecturerId],
        classGroupIds,
        roomId,
        lecturerId,
        transaction,
      );
      if (!commonWeekdays([...resources.groups, { allowedWeekdays: resources.offering.retakeWeekdays }]).includes(new Date(`${sessionDate}T12:00:00Z`).getUTCDay())) {
        throw new BadRequestException("Ngày học không thuộc ngày học chung của các nhóm.");
      }
      const values = { sessionDate, startTime, endTime, period: dto.period ?? session.period, lecturerId, roomId };
      await this.assertNoSessionConflict({ ...values, classGroupIds, courseOfferingId: session.courseOfferingId }, transaction, session.id);
      await session.update({
        ...values,
        ...(Object.prototype.hasOwnProperty.call(dto, "note") ? { note: dto.note || null } : {}),
      }, { transaction });
      return this.findTeachingSessionById(session.id, transaction);
    });
  }

  async confirmTeachingSession(id: string, status: "held" | "not_held", staffId: string) {
    return this.sequelize.transaction(async (transaction) => {
      const session = await this.teachingSessions.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!session) throw new NotFoundException("Không tìm thấy buổi học.");
      const offering = await this.courseOfferings.findByPk(session.courseOfferingId, { transaction });
      if (!offering) throw new BadRequestException("Lớp học phần của buổi học không còn tồn tại.");
      await this.requireEnabledOfferingSubject(offering, transaction);
      if (session.status !== "planned") {
        throw new ConflictException("Buổi học đã được xác nhận và không thể xác nhận lại.");
      }
      if (!this.sessionHasEnded(session)) {
        throw new ConflictException({
          code: "SESSION_NOT_ENDED",
          message: "Buổi học chưa kết thúc nên chưa thể xác nhận kết quả diễn ra.",
          details: { teachingSessionId: session.id },
        });
      }
      await session.update({
        status,
        confirmedAt: new Date(),
        confirmedByStaffId: staffId,
      }, { transaction });
      return this.findTeachingSessionById(session.id, transaction);
    });
  }

  async deleteTeachingSession(id: string) {
    return this.sequelize.transaction(async (transaction) => {
      const session = await this.teachingSessions.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!session) throw new NotFoundException("Không tìm thấy buổi học.");
      const offering = await this.courseOfferings.findByPk(session.courseOfferingId, { transaction });
      if (!offering) throw new BadRequestException("Lớp học phần của buổi học không còn tồn tại.");
      await this.requireEnabledOfferingSubject(offering, transaction);
      if (session.status !== "planned") {
        throw new ConflictException("Chỉ buổi học đang ở trạng thái đã xếp mới được xóa.");
      }
      if (this.sessionHasEnded(session)) {
        throw new ConflictException({
          code: "SESSION_ALREADY_ENDED",
          message: "Buổi học đã kết thúc và đang chờ xác nhận; không thể xóa khỏi lịch.",
          details: { teachingSessionId: session.id },
        });
      }
      await session.destroy({ transaction });
      return { id, deleted: true };
    });
  }

  async completeCourseOffering(id: string, staffId: string) {
    return this.sequelize.transaction(async (transaction) => {
      const offering = await this.courseOfferings.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!offering) throw new NotFoundException("Không tìm thấy lớp học phần.");
      await this.requireEnabledOfferingSubject(offering, transaction);
      if (offering.status === "completed") return this.findCourseOfferingById(id, transaction);
      const sessions = await this.teachingSessions.findAll({
        where: { courseOfferingId: id },
        attributes: ["id", "status", "sessionDate", "endTime"],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const unresolved = sessions.filter((session) => session.status === "planned");
      if (unresolved.length > 0) {
        throw new ConflictException({
          code: "UNRESOLVED_SESSIONS",
          message: `Còn ${unresolved.length} buổi đã xếp hoặc chờ xác nhận; chưa thể hoàn thành giảng dạy.`,
          details: {
            unresolvedCount: unresolved.length,
            teachingSessionId: unresolved[0].id,
            firstPlannedSessionDate: unresolved.map((session) => session.sessionDate).sort()[0],
          },
        });
      }
      const heldCount = sessions.filter((session) => session.status === "held").length;
      if (heldCount === 0) {
        throw new ConflictException({
          code: "NO_HELD_SESSIONS",
          message: "Cần ít nhất một buổi đã xác nhận diễn ra trước khi hoàn thành giảng dạy.",
          details: { heldCount: 0 },
        });
      }
      await offering.update({
        status: "completed",
        completedAt: new Date(),
        completedByStaffId: staffId,
      }, { transaction });
      return this.findCourseOfferingById(id, transaction);
    });
  }

  private async findTeachingSessionById(id: string, transaction?: Transaction) {
    const session = await this.teachingSessions.findByPk(id, {
      include: this.sessionIncludes(),
      transaction,
    });
    if (!session) throw new NotFoundException("Không tìm thấy buổi học.");
    this.requireEnabledProgram(session.courseOffering.subject.program);
    await this.attachParticipantCounts([session.courseOffering], transaction);
    return session;
  }

  private async findCourseOfferingById(id: string, transaction?: Transaction) {
    const offering = await this.courseOfferings.findByPk(id, {
      include: this.offeringIncludes(),
      transaction,
    });
    if (!offering) throw new NotFoundException("Không tìm thấy lớp học phần.");
    this.requireEnabledProgram(offering.subject.program);
    await this.attachCourseOfferingMetadata([offering], transaction);
    return offering;
  }

  async getCourseOfferingRoster(id: string) {
    const offering = await this.findCourseOfferingById(id);
    const result = await this.previewCourseOfferingRoster({
      subjectId: offering.subjectId,
      classGroupIds: offering.groupLinks.map((link) => link.classGroupId),
      admissionRecordIds: (offering.individualStudents || []).map((entry) => entry.admissionRecordId),
    });
    const notes = new Map((offering.participantNotes || []).map((entry) => [entry.participantId, entry.note]));
    return { ...result, participants: result.participants.map((row) => ({ ...row, note: notes.get(row.id) || "" })) };
  }

  async updateRosterNotes(id: string, dto: UpdateRosterNotesDto) {
    const roster = await this.getCourseOfferingRoster(id);
    const ids = new Set(roster.participants.map((row) => row.id));
    if (dto.participantNotes.some((entry) => !ids.has(entry.participantId))) throw new BadRequestException("Ghi chú chứa học viên ngoài danh sách lớp.");
    return this.sequelize.transaction(async (transaction) => {
      const offering = await this.courseOfferings.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!offering) throw new NotFoundException("Không tìm thấy lớp học phần.");
      await offering.update({ participantNotes: dto.participantNotes.map((entry) => ({ ...entry, note: entry.note.trim() })).filter((entry) => entry.note) }, { transaction });
      return { saved: true };
    });
  }

  async listRetakes(dto: RetakeQueryDto) {
    const subject = await this.subjects.findByPk(dto.subjectId);
    if (!subject || !subject.active) throw new NotFoundException("Không tìm thấy học phần.");
    this.requireEnabledProgram(subject.program);
    const requests = await readRetakes(this.sequelize, subject.id);
    return [...new Map(requests.filter((row) => isEarlierAcademicYear(row.academicYear, dto.academicYear)
      && (subject.allowCrossMajor || row.majorId === dto.majorId)).map((row) => [row.id, row])).values()];
  }

  async registerRetake(dto: RegisterRetakeDto) {
    const source = await this.findCourseOfferingById(dto.sourceCourseOfferingId);
    if (source.status !== "completed") throw new BadRequestException("Chỉ ghi nhận học lại từ lớp đã hoàn thành giảng dạy.");
    const roster = await this.getCourseOfferingRoster(source.id);
    if (!roster.participants.some((row) => row.id === dto.participantId)) throw new BadRequestException("Học viên không thuộc lớp học phần nguồn.");
    const [kind, identity] = dto.participantId.split(":");
    const records = await this.admissionRecords.findAll({ where: { ...(kind === "student" ? { studentId: identity } : { id: identity }), status: "approved", trainingLevel: "Thạc sĩ" }, attributes: ["id", "academicYear"] });
    if (records.length !== 1 || !records[0].academicYear) throw new BadRequestException("Cần một hồ sơ học viên đã duyệt có khóa/năm học rõ ràng để ghi nhận học lại.");
    await this.sequelize.query(`INSERT INTO scheduling_retakes (id, admission_record_id, subject_id, source_course_offering_id, created_at)
      VALUES (:id, :admissionId, :subjectId, :sourceId, NOW()) ON CONFLICT (admission_record_id, subject_id, source_course_offering_id) DO NOTHING`, {
      replacements: { id: randomUUID(), admissionId: records[0].id, subjectId: source.subjectId, sourceId: source.id },
    });
    return { saved: true };
  }

  async updateSchedulingGroup(id: string, dto: SchedulingGroupSettingsDto) {
    return this.sequelize.transaction(async (transaction) => {
      await this.sequelize.query("SELECT pg_advisory_xact_lock(21025)", { transaction });
      const group = await this.classGroups.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!group) throw new NotFoundException("Không tìm thấy nhóm học viên.");
      this.requireEnabledProgram(group.program);
      const future: any[] = await this.sequelize.query(`SELECT s.session_date AS "sessionDate" FROM teaching_sessions s
        JOIN course_offering_class_groups g ON g.course_offering_id = s.course_offering_id
        WHERE g.class_group_id = :id AND s.status = 'planned' AND s.session_date >= (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`, {
        replacements: { id }, type: QueryTypes.SELECT, transaction,
      });
      if (future.some((session) => !dto.allowedWeekdays.includes(new Date(`${session.sessionDate}T12:00:00Z`).getUTCDay()))) {
        throw new ConflictException("Nhóm đang có lịch ngoài các ngày vừa chọn. Hãy xử lý lịch trước khi đổi ngày học.");
      }
      await group.update({ allowedWeekdays: dto.allowedWeekdays, groupType: dto.groupType }, { transaction });
      return this.groupSummary(group);
    });
  }

  async assignSchedulingManager(staffId: string) {
    return this.sequelize.transaction(async (transaction) => {
      const assignee = await this.staff.findByPk(staffId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!assignee) throw new NotFoundException("Không tìm thấy chuyên viên được phân công.");
      await this.staff.update({ canManageScheduling: false }, { where: { canManageScheduling: true }, transaction });
      await assignee.update({ canManageScheduling: true }, { transaction });
      return {
        id: assignee.id,
        name: assignee.name,
        email: assignee.email,
        role: assignee.role,
        canManageScheduling: true,
      };
    });
  }
}
