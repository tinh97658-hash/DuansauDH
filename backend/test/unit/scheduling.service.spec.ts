import { Op } from "sequelize";
import { BadRequestException } from "@nestjs/common";
import { jest } from "@jest/globals";
import { SchedulingService } from "../../src/scheduling/scheduling.service.js";

const transaction = { LOCK: { UPDATE: "UPDATE" } };

const buildService = () => {
  const courseOfferings = { create: jest.fn(), findAll: jest.fn(), findByPk: jest.fn() };
  const offeringGroups = { bulkCreate: jest.fn(), findAll: jest.fn() };
  const subjects = { findByPk: jest.fn(), findAll: jest.fn().mockResolvedValue([]) };
  // `packages` giữ tên cũ cho dễ đọc: đây là danh mục học phần của CTĐT mà lớp kế thừa.
  const curriculumSubjects = { findAll: jest.fn().mockResolvedValue([]) };
  const classGroupElectives = { findAll: jest.fn().mockResolvedValue([]) };
  const classGroups = { findAll: jest.fn() };
  const classGroupMembers = { findAll: jest.fn().mockResolvedValue([]) };
  const majors = { findOne: jest.fn() };
  const staff = { findByPk: jest.fn(), update: jest.fn() };
  const sequelize = { query: jest.fn().mockResolvedValue([]), transaction: jest.fn((callback: (tx: any) => Promise<unknown>) => callback(transaction)) };
  const rooms = { findAll: jest.fn() };
  const lecturers = { findAll: jest.fn() };
  const teachingSessions = { findAll: jest.fn().mockResolvedValue([]), findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn() };
  const individualStudents = { findAll: jest.fn().mockResolvedValue([]), bulkCreate: jest.fn().mockResolvedValue([]) };
  const admissionRecords = { findAll: jest.fn().mockResolvedValue([]) };
  const service = new SchedulingService(
    courseOfferings as never,
    offeringGroups as never,
    subjects as never,
    curriculumSubjects as never,
    classGroupElectives as never,
    classGroups as never,
    classGroupMembers as never,
    majors as never,
    staff as never,
    sequelize as never,
    rooms as never,
    lecturers as never,
    teachingSessions as never,
    individualStudents as never,
    admissionRecords as never,
  );
  return {
    individualStudents, admissionRecords, service, courseOfferings, offeringGroups, subjects,
    packages: curriculumSubjects, classGroupElectives, classGroups, classGroupMembers, majors, staff,
    sequelize, rooms, lecturers, teachingSessions,
  };
};

const subject = {
  id: "subject-1",
  code: "HP01",
  codeNumber: 1,
  name: "Học phần 1",
  credits: 3,
  majorId: "major-1",
  program: "masters",
  active: true,
  sortOrder: 1,
  canonicalSubjectId: null,
  allowCrossMajor: false,
};

const curriculumIdFor = (classGroupId: string) => `curriculum-${classGroupId}`;

const group = (id: string, code = id, majorId = "major-1") => ({
  id,
  code,
  name: `Nhóm ${code}`,
  majorId,
  major: { id: majorId, code: majorId, name: `Ngành ${majorId}` },
  program: "masters",
  academicYear: "2026",
  status: "open",
  // Lớp kế thừa CTĐT của ngành + bậc + khóa.
  curriculumId: curriculumIdFor(id),
});

/**
 * Một dòng học phần bắt buộc trong CTĐT của lớp. Tên `officialPackage` được giữ lại
 * để các test hiện có diễn đạt cùng một ý: "lớp có học phần này trong CTĐT".
 */
const officialPackage = (classGroupId: string, entries = [{ subjectId: subject.id, subject }]) => ({
  id: `entry-${classGroupId}`,
  curriculumId: curriculumIdFor(classGroupId),
  isRequired: true,
  subjectId: entries[0]?.subjectId,
  subject: entries[0]?.subject,
});

describe("SchedulingService participant preview", () => {
  it("deduplicates individual selections against group members and persists the selection", async () => {
    const mocks = buildService();
    const record = { id: "admission-a", studentId: "student-a", code: "HV01", fullName: "Nguyễn An" };
    mocks.subjects.findByPk.mockResolvedValue(subject);
    mocks.classGroups.findAll.mockResolvedValue([group("group-a")]);
    mocks.classGroupMembers.findAll.mockResolvedValue([{ id: "m1", classGroupId: "group-a", studentId: "student-a", student: { regNo: "HV01", fullName: "Nguyễn An" } }]);
    mocks.admissionRecords.findAll.mockResolvedValue([record]);
    const dto = { subjectId: subject.id, classGroupIds: ["group-a"], admissionRecordIds: [record.id] };
    const preview = await mocks.service.previewCourseOfferingRoster(dto);
    expect(preview.participantCount).toBe(1);
    expect(preview.participants[0].note).toBe("");
    mocks.packages.findAll.mockResolvedValue([officialPackage("group-a")]);
    mocks.offeringGroups.findAll.mockResolvedValue([]);
    mocks.courseOfferings.create.mockResolvedValue({ id: "created" });
    mocks.courseOfferings.findByPk.mockResolvedValue({ id: "created", subject, groupLinks: [{ classGroupId: "group-a" }], individualStudents: [{ admissionRecordId: record.id, admissionRecord: record }] });
    mocks.classGroupMembers.findAll.mockResolvedValue([]);
    mocks.sequelize.query.mockResolvedValue([{ id: record.id, academicYear: "2025" }]);
    const created: any = await mocks.service.createCourseOffering(dto);
    expect(created.participantCount).toBe(1);
    expect(mocks.individualStudents.bulkCreate).toHaveBeenCalledWith([{ courseOfferingId: "created", admissionRecordId: record.id }], { transaction });
  });

  it("rejects individual IDs outside the permitted major and admission status", async () => {
    const mocks = buildService();
    mocks.classGroups.findAll.mockResolvedValue([group("group-a")]);
    mocks.subjects.findByPk.mockResolvedValue(subject);
    await expect(mocks.service.previewCourseOfferingRoster({ subjectId: subject.id, classGroupIds: ["group-a"], admissionRecordIds: ["wrong-major"] })).rejects.toThrow("thuộc chuyên ngành");
    expect(mocks.admissionRecords.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ majorId: subject.majorId, trainingLevel: "Thạc sĩ" }) }));
  });
  it("returns a deduplicated roster with blank notes regardless of group notes", async () => {
    const mocks = buildService();
    mocks.classGroups.findAll.mockResolvedValue([group("a"), group("b")]);
    mocks.classGroupMembers.findAll.mockResolvedValue([
      { id: "m1", studentId: "s1", student: { regNo: "HV01", fullName: "Nguyễn An", password: "never return" }, note: "Nhóm A" },
      { id: "m2", studentId: "s1", student: { regNo: "HV01", fullName: "Nguyễn An" }, note: "Nhóm B" },
      { id: "m3", admissionRecordId: "a1", admissionRecord: { code: "HV02", fullName: "Trần Bình" } },
    ]);
    const result = await mocks.service.previewCourseOfferingRoster({ classGroupIds: ["a", "b"] });
    expect(result).toEqual({ participantCount: 2, participants: [
      { id: "student:s1", code: "HV01", fullName: "Nguyễn An", note: "" },
      { id: "admission:a1", code: "HV02", fullName: "Trần Bình", note: "" },
    ] });
    expect(mocks.courseOfferings.create).not.toHaveBeenCalled();
  });
  it("deduplicates A,B + B,C to 3, matches persisted create counts, and exposes no learner identities", async () => {
    const mocks = buildService();
    const groups = [group("group-a"), group("group-b")];
    mocks.classGroups.findAll.mockResolvedValue(groups);
    mocks.classGroupMembers.findAll.mockResolvedValue([
      { id: "member-a", classGroupId: "group-a", studentId: "student-a" },
      { id: "member-b1", classGroupId: "group-a", studentId: "student-b" },
      { id: "member-b2", classGroupId: "group-b", studentId: "student-b" },
      { id: "member-c", classGroupId: "group-b", studentId: "student-c" },
    ]);
    const preview = await mocks.service.previewCourseOfferingParticipants({ classGroupIds: groups.map((item) => item.id) });
    expect(preview).toEqual({ classGroupCount: 2, participantCount: 3 });
    expect(mocks.courseOfferings.create).not.toHaveBeenCalled();
    expect(mocks.offeringGroups.bulkCreate).not.toHaveBeenCalled();
    expect(mocks.sequelize.transaction).not.toHaveBeenCalled();
    expect(mocks.classGroupMembers.findAll).toHaveBeenCalledWith(expect.not.objectContaining({ lock: expect.anything() }));

    mocks.subjects.findByPk.mockResolvedValue(subject);
    mocks.packages.findAll.mockResolvedValue(groups.map((item) => officialPackage(item.id)));
    mocks.offeringGroups.findAll.mockResolvedValue([]);
    mocks.courseOfferings.create.mockResolvedValue({ id: "created" });
    mocks.offeringGroups.bulkCreate.mockResolvedValue([]);
    mocks.courseOfferings.findByPk.mockResolvedValue({
      id: "created", subject, groupLinks: groups.map((item) => ({ classGroupId: item.id, classGroup: item })),
    });
    const created: any = await mocks.service.createCourseOffering({ subjectId: subject.id, classGroupIds: groups.map((item) => item.id) });
    expect(created.participantCount).toBe(preview.participantCount);
    expect(created.groupLinks.map((link: any) => link.classGroup.memberCount)).toEqual([2, 2]);
  });

  it("reuses admission and membership fallback identity semantics without returning PII", async () => {
    const mocks = buildService();
    mocks.classGroups.findAll.mockResolvedValue([group("group-a"), group("group-b")]);
    mocks.classGroupMembers.findAll.mockResolvedValue([
      { id: "member-1", classGroupId: "group-a", admissionRecordId: "admission-a" },
      { id: "member-2", classGroupId: "group-b", admissionRecordId: "admission-a" },
      { id: "member-3", classGroupId: "group-b" },
    ]);
    await expect(mocks.service.previewCourseOfferingParticipants({ classGroupIds: ["group-a", "group-b"] }))
      .resolves.toEqual({ classGroupCount: 2, participantCount: 2 });
  });

  it("keeps the member count of each merged class separate from the offering total", async () => {
    const mocks = buildService();
    const cnt = group("cnt", "CNT2026.02", "major-cnt");
    const ktm = group("ktm", "KTM2026.03", "major-ktm");
    const members = [
      ...Array.from({ length: 5 }, (_, index) => ({
        id: `cnt-${index}`, classGroupId: cnt.id, studentId: `cnt-student-${index}`,
      })),
      ...Array.from({ length: 22 }, (_, index) => ({
        id: `ktm-${index}`, classGroupId: ktm.id, studentId: `ktm-student-${index}`,
      })),
    ];
    const mergedOffering: any = {
      id: "merged-offering",
      subject,
      individualStudents: [],
      groupLinks: [
        { classGroupId: cnt.id, classGroup: cnt },
        { classGroupId: ktm.id, classGroup: ktm },
      ],
    };
    mocks.courseOfferings.findByPk.mockResolvedValue(mergedOffering);
    mocks.classGroupMembers.findAll.mockResolvedValue(members);

    const result: any = await mocks.service.getCourseOffering(mergedOffering.id);

    expect(result.participantCount).toBe(27);
    expect(result.groupLinks.map((link: any) => link.classGroup.memberCount)).toEqual([5, 22]);
  });

  it("rejects nonexistent groups before counting or mutating data", async () => {
    const mocks = buildService();
    mocks.classGroups.findAll.mockResolvedValue([group("group-a")]);
    await expect(mocks.service.previewCourseOfferingParticipants({ classGroupIds: ["group-a", "missing"] })).rejects.toThrow("nhóm học viên không tồn tại");
    expect(mocks.classGroupMembers.findAll).not.toHaveBeenCalled();
    expect(mocks.courseOfferings.create).not.toHaveBeenCalled();
  });
});

describe("SchedulingService course-offering candidates", () => {
  it("derives eligible subjects from each class group's official package", async () => {
    const { service, majors, classGroups, classGroupMembers, packages, offeringGroups } = buildService();
    const g1 = group("group-1", "N01");
    majors.findOne.mockResolvedValue({ id: "major-1" });
    classGroups.findAll.mockResolvedValue([g1]);
    packages.findAll.mockResolvedValue([officialPackage(g1.id)]);
    offeringGroups.findAll.mockResolvedValue([]);
    classGroupMembers.findAll.mockResolvedValue([
      { id: "member-1", classGroupId: g1.id },
      { id: "member-2", classGroupId: g1.id },
    ]);

    const result = await service.listCourseOfferingCandidates({
      program: "masters",
      majorId: "major-1",
      academicYear: "2026",
    });

    expect(result.subjects).toHaveLength(1);
    expect(result.subjects[0].subject.id).toBe(subject.id);
    expect(result.subjects[0].eligibleClassGroups).toEqual([expect.objectContaining({ id: g1.id, memberCount: 2 })]);
  });

  it("does not expose a subject that is outside the official package", async () => {
    const { service, majors, classGroups, packages, offeringGroups } = buildService();
    const g1 = group("group-1");
    majors.findOne.mockResolvedValue({ id: "major-1" });
    classGroups.findAll.mockResolvedValue([g1]);
    packages.findAll.mockResolvedValue([officialPackage(g1.id)]);
    offeringGroups.findAll.mockResolvedValue([]);

    const result = await service.listCourseOfferingCandidates({
      program: "masters", majorId: "major-1", academicYear: "2026",
    });

    expect(result.subjects.map((row) => row.subject.id)).toEqual(["subject-1"]);
    expect(result.subjects.find((row) => row.subject.id === "subject-outside-package")).toBeUndefined();
  });

  it("moves an active group out of the eligible group list", async () => {
    const { service, majors, classGroups, packages, offeringGroups } = buildService();
    const g1 = group("group-1");
    const g2 = group("group-2");
    majors.findOne.mockResolvedValue({ id: "major-1" });
    classGroups.findAll.mockResolvedValue([g1, g2]);
    packages.findAll.mockResolvedValue([officialPackage(g1.id), officialPackage(g2.id)]);
    offeringGroups.findAll.mockResolvedValue([{
      classGroupId: g2.id,
      courseOffering: { subjectId: subject.id, status: "active" },
    }]);

    const result = await service.listCourseOfferingCandidates({
      program: "masters", majorId: "major-1", academicYear: "2026",
    });

    expect(result.subjects[0].eligibleClassGroups.map((item) => item.id)).toEqual([g1.id]);
    expect(result.subjects[0].activeClassGroups.map((item) => item.id)).toEqual([g2.id]);
  });

  it("does not reopen a subject when every eligible class group completed it", async () => {
    const { service, majors, classGroups, packages, offeringGroups } = buildService();
    const g1 = group("group-1");
    majors.findOne.mockResolvedValue({ id: "major-1" });
    classGroups.findAll.mockResolvedValue([g1]);
    packages.findAll.mockResolvedValue([officialPackage(g1.id)]);
    offeringGroups.findAll.mockResolvedValue([{
      classGroupId: g1.id,
      courseOffering: { subjectId: subject.id, status: "completed" },
    }]);

    const result = await service.listCourseOfferingCandidates({
      program: "masters", majorId: "major-1", academicYear: "2026",
    });

    expect(result.subjects).toEqual([]);
  });

  it("aggregates local Subjects from different majors under their explicit logical root", async () => {
    const { service, majors, classGroups, packages, offeringGroups, subjects } = buildService();
    const root = { ...subject, allowCrossMajor: true };
    const alias = {
      ...subject,
      id: "subject-alias",
      code: "HP-B",
      name: "Tên học phần riêng của ngành B",
      majorId: "major-2",
      canonicalSubjectId: root.id,
      allowCrossMajor: false,
    };
    const g1 = group("group-1", "N01", "major-1");
    const g2 = group("group-2", "N02", "major-2");
    majors.findOne.mockResolvedValue({ id: "major-1" });
    classGroups.findAll.mockResolvedValue([g1, g2]);
    packages.findAll.mockResolvedValue([
      officialPackage(g1.id, [{ subjectId: root.id, subject: root }]),
      officialPackage(g2.id, [{ subjectId: alias.id, subject: alias }]),
    ]);
    subjects.findAll.mockResolvedValue([root]);
    offeringGroups.findAll.mockResolvedValue([]);

    const result = await service.listCourseOfferingCandidates({
      program: "masters", majorId: "major-1", academicYear: "2026",
    });

    expect(result.subjects).toHaveLength(1);
    expect(result.subjects[0].subject.id).toBe(root.id);
    expect(result.subjects[0].eligibleClassGroups.map((item) => item.id)).toEqual([g1.id, g2.id]);
    expect(result.subjects[0].eligibleClassGroups[1].localSubject.id).toBe(alias.id);
  });

  it("automatically includes the identical subject from another major when sharing is enabled", async () => {
    const { service, majors, classGroups, packages, offeringGroups } = buildService();
    const root = { ...subject, allowCrossMajor: true };
    const unrelated = { ...subject, id: "subject-unrelated", majorId: "major-2" };
    const g1 = group("group-1", "N01", "major-1");
    const g2 = group("group-2", "N02", "major-2");
    majors.findOne.mockResolvedValue({ id: "major-1" });
    classGroups.findAll.mockResolvedValue([g1, g2]);
    packages.findAll.mockResolvedValue([
      officialPackage(g1.id, [{ subjectId: root.id, subject: root }]),
      officialPackage(g2.id, [{ subjectId: unrelated.id, subject: unrelated }]),
    ]);
    offeringGroups.findAll.mockResolvedValue([]);

    const result = await service.listCourseOfferingCandidates({
      program: "masters", majorId: "major-1", academicYear: "2026",
    });

    expect(result.subjects[0].eligibleClassGroups.map((item) => item.id)).toEqual([g1.id, g2.id]);
    expect(result.subjects[0].eligibleClassGroups[1].localSubject.id).toBe(unrelated.id);
  });

  it("does not combine a same-name subject with a different credit count", async () => {
    const { service, majors, classGroups, packages, offeringGroups } = buildService();
    const shared = { ...subject, allowCrossMajor: true };
    const differentCredits = { ...subject, id: "subject-other", majorId: "major-2", credits: 2 };
    const g1 = group("group-1", "N01", "major-1");
    const g2 = group("group-2", "N02", "major-2");
    majors.findOne.mockResolvedValue({ id: "major-1" });
    classGroups.findAll.mockResolvedValue([g1, g2]);
    packages.findAll.mockResolvedValue([
      officialPackage(g1.id, [{ subjectId: shared.id, subject: shared }]),
      officialPackage(g2.id, [{ subjectId: differentCredits.id, subject: differentCredits }]),
    ]);
    offeringGroups.findAll.mockResolvedValue([]);

    const result = await service.listCourseOfferingCandidates({
      program: "masters", majorId: "major-1", academicYear: "2026",
    });

    expect(result.subjects[0].eligibleClassGroups.map((item) => item.id)).toEqual([g1.id]);
  });

  it("applies active history to the logical root instead of the local alias", async () => {
    const { service, majors, classGroups, packages, offeringGroups, subjects } = buildService();
    const root = { ...subject, allowCrossMajor: true };
    const alias = { ...subject, id: "subject-alias", majorId: "major-2", canonicalSubjectId: root.id };
    const g1 = group("group-1", "N01", "major-1");
    const g2 = group("group-2", "N02", "major-2");
    majors.findOne.mockResolvedValue({ id: "major-1" });
    classGroups.findAll.mockResolvedValue([g1, g2]);
    packages.findAll.mockResolvedValue([
      officialPackage(g1.id, [{ subjectId: root.id, subject: root }]),
      officialPackage(g2.id, [{ subjectId: alias.id, subject: alias }]),
    ]);
    subjects.findAll.mockResolvedValue([root]);
    offeringGroups.findAll.mockResolvedValue([{
      classGroupId: g2.id,
      courseOffering: { subjectId: root.id, status: "active" },
    }]);

    const result = await service.listCourseOfferingCandidates({
      program: "masters", majorId: "major-1", academicYear: "2026",
    });

    expect(result.subjects[0].eligibleClassGroups.map((item) => item.id)).toEqual([g1.id]);
    expect(result.subjects[0].activeClassGroups.map((item) => item.id)).toEqual([g2.id]);
  });

  it("includes eligible groups from other academic years when they have the subject in curriculum", async () => {
    const { service, majors, classGroups, packages, offeringGroups } = buildService();
    const g1 = group("group-1", "N01", "major-1");
    const g2 = { ...group("group-2", "N02", "major-1"), academicYear: "2024" };
    majors.findOne.mockResolvedValue({ id: "major-1" });
    classGroups.findAll.mockResolvedValue([g1, g2]);
    packages.findAll.mockResolvedValue([
      officialPackage(g1.id, [{ subjectId: subject.id, subject }]),
      officialPackage(g2.id, [{ subjectId: subject.id, subject }]),
    ]);
    offeringGroups.findAll.mockResolvedValue([]);

    const result = await service.listCourseOfferingCandidates({
      program: "masters", majorId: "major-1", academicYear: "2026",
    });

    expect(result.subjects[0].eligibleClassGroups.map((item) => item.id)).toEqual([g1.id, g2.id]);
  });

  it("exposes cross-major groups for institute common subjects (subjectType: KC)", async () => {
    const { service, majors, classGroups, packages, offeringGroups } = buildService();
    const commonSubject = {
      id: "subject-kc",
      code: "TRIET",
      name: "Triết học",
      credits: 3,
      majorId: "CHUNG",
      subjectType: "KC",
      allowCrossMajor: true,
      program: "masters",
      active: true,
      sortOrder: 1,
    };
    const g1 = group("group-1", "KTHH-26", "major-kthh");
    const g2 = group("group-2", "KTVB-26", "major-ktvb");
    majors.findOne.mockResolvedValue({ id: "major-kthh" });
    classGroups.findAll.mockResolvedValue([g1, g2]);
    packages.findAll.mockResolvedValue([
      officialPackage(g1.id, [{ subjectId: commonSubject.id, subject: commonSubject }]),
      officialPackage(g2.id, [{ subjectId: commonSubject.id, subject: commonSubject }]),
    ]);
    offeringGroups.findAll.mockResolvedValue([]);

    const result = await service.listCourseOfferingCandidates({
      program: "masters", majorId: "major-kthh", academicYear: "2026",
    });

    expect(result.subjects).toHaveLength(1);
    expect(result.subjects[0].subject.id).toBe("subject-kc");
    expect(result.subjects[0].eligibleClassGroups.map((g) => g.id)).toEqual(["group-1", "group-2"]);
  });
});

describe("SchedulingService.createCourseOffering", () => {
  const arrangeValidCreate = (mocks: ReturnType<typeof buildService>) => {
    const g1 = group("group-1");
    mocks.subjects.findByPk.mockResolvedValue(subject);
    mocks.classGroups.findAll.mockResolvedValue([g1]);
    mocks.packages.findAll.mockResolvedValue([officialPackage(g1.id)]);
    mocks.offeringGroups.findAll.mockResolvedValue([]);
    mocks.courseOfferings.create.mockResolvedValue({ id: "offering-1" });
    mocks.offeringGroups.bulkCreate.mockResolvedValue([{}]);
    mocks.courseOfferings.findByPk.mockResolvedValue({
      id: "offering-1",
      status: "active",
      subject,
      groupLinks: [{ classGroupId: g1.id, classGroup: g1 }],
    });
    return g1;
  };

  it("creates the offering and group relation atomically after locking groups", async () => {
    const mocks = buildService();
    const g1 = arrangeValidCreate(mocks);

    const result = await mocks.service.createCourseOffering({ subjectId: subject.id, classGroupIds: [g1.id], name: "Lớp thí điểm", note: "Ghi chú" });

    expect(mocks.sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.classGroups.findAll).toHaveBeenCalledWith(expect.objectContaining({
      order: [["id", "ASC"]],
      lock: "UPDATE",
      transaction,
    }));
    expect(mocks.courseOfferings.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Lớp thí điểm", subjectId: subject.id, status: "active", note: "Ghi chú" }),
      { transaction },
    );
    expect(mocks.offeringGroups.bulkCreate).toHaveBeenCalledWith(
      [{ courseOfferingId: "offering-1", classGroupId: g1.id }],
      { transaction },
    );
    expect(result).toEqual(expect.objectContaining({ id: "offering-1" }));
  });

  it("persists only entered participant notes on the offering", async () => {
    const mocks = buildService();
    const g1 = arrangeValidCreate(mocks);
    mocks.classGroupMembers.findAll.mockResolvedValue([{ id: "m1", classGroupId: g1.id, studentId: "s1" }]);
    await mocks.service.createCourseOffering({ subjectId: subject.id, classGroupIds: [g1.id], participantNotes: [
      { participantId: "student:s1", note: " Miễn TA " },
      { participantId: "student:s2", note: "   " },
    ] });
    expect(mocks.courseOfferings.create).toHaveBeenCalledWith(expect.objectContaining({
      participantNotes: [{ participantId: "student:s1", note: "Miễn TA" }],
    }), { transaction });
  });

  it("rejects notes for learners outside the selected roster", async () => {
    const mocks = buildService();
    const g1 = arrangeValidCreate(mocks);
    await expect(mocks.service.createCourseOffering({ subjectId: subject.id, classGroupIds: [g1.id],
      participantNotes: [{ participantId: "student:outsider", note: "Miễn TA" }],
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(mocks.courseOfferings.create).not.toHaveBeenCalled();
  });

  it("rejects duplicate class group ids before opening a transaction", async () => {
    const mocks = buildService();
    await expect(mocks.service.createCourseOffering({
      subjectId: subject.id,
      classGroupIds: ["group-1", "group-1"],
    })).rejects.toThrow("trùng lặp");
    expect(mocks.sequelize.transaction).not.toHaveBeenCalled();
  });

  it("rejects a group that has no curriculum attached", async () => {
    const mocks = buildService();
    const g1 = arrangeValidCreate(mocks);
    mocks.classGroups.findAll.mockResolvedValue([{ ...g1, curriculumId: null }]);

    await expect(mocks.service.createCourseOffering({
      subjectId: subject.id, classGroupIds: ["group-1"],
    })).rejects.toThrow("chưa được gắn chương trình đào tạo");
    expect(mocks.courseOfferings.create).not.toHaveBeenCalled();
  });

  it("rejects a group whose curriculum has no subject at all", async () => {
    const mocks = buildService();
    arrangeValidCreate(mocks);
    mocks.packages.findAll.mockResolvedValue([]);

    await expect(mocks.service.createCourseOffering({
      subjectId: subject.id, classGroupIds: ["group-1"],
    })).rejects.toThrow("chưa có học phần nào");
    expect(mocks.courseOfferings.create).not.toHaveBeenCalled();
  });

  it("rejects a local Subject combined with a group from another major as a capability not yet configured", async () => {
    const mocks = buildService();
    arrangeValidCreate(mocks);
    mocks.classGroups.findAll.mockResolvedValue([{ ...group("group-1"), majorId: "major-2" }]);

    await expect(mocks.service.createCourseOffering({
      subjectId: subject.id, classGroupIds: ["group-1"],
    })).rejects.toThrow("chưa được tích cho phép học chung khác ngành");
    expect(mocks.courseOfferings.create).not.toHaveBeenCalled();
  });

  it("rejects an active offering for the same Subject and class group", async () => {
    const mocks = buildService();
    arrangeValidCreate(mocks);
    mocks.offeringGroups.findAll.mockResolvedValue([{
      classGroupId: "group-1",
      courseOffering: { subjectId: subject.id, status: "active" },
    }]);

    await expect(mocks.service.createCourseOffering({
      subjectId: subject.id, classGroupIds: ["group-1"],
    })).rejects.toThrow("đang thuộc một lớp học phần đang hoạt động");
  });

  it("rejects reopening an entire group after the Subject was completed", async () => {
    const mocks = buildService();
    arrangeValidCreate(mocks);
    mocks.offeringGroups.findAll.mockResolvedValue([{
      classGroupId: "group-1",
      courseOffering: { subjectId: subject.id, status: "completed" },
    }]);

    await expect(mocks.service.createCourseOffering({
      subjectId: subject.id, classGroupIds: ["group-1"],
    })).rejects.toThrow("đã hoàn thành học phần");
  });

  it("serializes two competing creates so only one active offering succeeds", async () => {
    const mocks = buildService();
    arrangeValidCreate(mocks);
    let tail = Promise.resolve();
    let offeringExists = false;
    mocks.sequelize.transaction.mockImplementation(async (callback: any) => {
      const previous = tail;
      let release!: () => void;
      tail = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      try {
        return await callback(transaction);
      } finally {
        release();
      }
    });
    mocks.offeringGroups.findAll.mockImplementation(async () => offeringExists ? [{
      classGroupId: "group-1",
      courseOffering: { subjectId: subject.id, status: "active" },
    }] : []);
    mocks.courseOfferings.create.mockImplementation(async () => {
      offeringExists = true;
      return { id: "offering-1" };
    });

    const results = await Promise.allSettled([
      mocks.service.createCourseOffering({ subjectId: subject.id, classGroupIds: ["group-1"] }),
      mocks.service.createCourseOffering({ subjectId: subject.id, classGroupIds: ["group-1"] }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(mocks.courseOfferings.create).toHaveBeenCalledTimes(1);
  });

  it.each(["major-1", "major-3"])("creates mixed-major groups when the working scope is %s", async (scopeMajorId) => {
    const mocks = buildService();
    const root = { ...subject, allowCrossMajor: true };
    const sameSubject = { ...subject, id: "subject-other-major", code: "HP-B", majorId: "major-2" };
    const g1 = group("group-1", "N01", "major-1");
    const g2 = group("group-2", "N02", "major-2");
    mocks.subjects.findByPk.mockResolvedValue(root);
    mocks.classGroups.findAll.mockResolvedValue([g1, g2]);
    mocks.packages.findAll.mockResolvedValue([
      officialPackage(g1.id, [{ subjectId: root.id, subject: root }]),
      officialPackage(g2.id, [{ subjectId: sameSubject.id, subject: sameSubject }]),
    ]);
    mocks.offeringGroups.findAll.mockResolvedValue([]);
    mocks.courseOfferings.create.mockResolvedValue({ id: "offering-mixed" });
    mocks.offeringGroups.bulkCreate.mockResolvedValue([]);
    mocks.courseOfferings.findByPk.mockResolvedValue({ id: "offering-mixed", subject: root, groupLinks: [] });

    await mocks.service.createCourseOffering({
      subjectId: root.id, classGroupIds: [g1.id, g2.id], majorId: scopeMajorId, academicYear: "2026",
    });

    expect(mocks.offeringGroups.bulkCreate).toHaveBeenCalledWith([
      { courseOfferingId: "offering-mixed", classGroupId: g1.id },
      { courseOfferingId: "offering-mixed", classGroupId: g2.id },
    ], { transaction });

    expect(mocks.courseOfferings.create).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: root.id }),
      { transaction },
    );
  });

  it("resolves an explicitly mapped local subject and persists the canonical root", async () => {
    const mocks = buildService();
    const root = { ...subject, allowCrossMajor: true };
    const alias = {
      ...subject,
      id: "subject-alias",
      code: "HP-B",
      name: "Tên học phần riêng của ngành B",
      majorId: "major-2",
      canonicalSubjectId: root.id,
      allowCrossMajor: false,
    };
    const g2 = group("group-2", "N02", "major-2");
    mocks.subjects.findByPk.mockResolvedValue(alias);
    mocks.subjects.findAll.mockResolvedValue([root]);
    mocks.classGroups.findAll.mockResolvedValue([g2]);
    mocks.packages.findAll.mockResolvedValue([
      officialPackage(g2.id, [{ subjectId: alias.id, subject: alias }]),
    ]);
    mocks.offeringGroups.findAll.mockResolvedValue([]);
    mocks.courseOfferings.create.mockResolvedValue({ id: "offering-alias" });
    mocks.offeringGroups.bulkCreate.mockResolvedValue([]);
    mocks.courseOfferings.findByPk.mockResolvedValue({ id: "offering-alias", subject: root, groupLinks: [] });

    await mocks.service.createCourseOffering({ subjectId: alias.id, classGroupIds: [g2.id] });

    expect(mocks.courseOfferings.create).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: root.id }),
      { transaction },
    );
  });

  it("still rejects when no selected group belongs to the working academic year", async () => {
    const mocks = buildService();
    arrangeValidCreate(mocks);

    await expect(mocks.service.createCourseOffering({
      subjectId: subject.id, classGroupIds: ["group-1"], majorId: "major-3", academicYear: "2027",
    })).rejects.toThrow("Lớp học phần phải có ít nhất một nhóm thuộc khóa / năm học đang tổ chức.");
    expect(mocks.courseOfferings.create).not.toHaveBeenCalled();
  });

  it("allows merging groups from different academic years when at least one belongs to working academic year", async () => {
    const mocks = buildService();
    arrangeValidCreate(mocks);
    const g1 = { ...group("group-1"), academicYear: "2026" };
    const g2 = { ...group("group-2"), academicYear: "2024" };
    mocks.classGroups.findAll.mockResolvedValue([g1, g2]);
    mocks.packages.findAll.mockResolvedValue([officialPackage(g1.id), officialPackage(g2.id)]);
    mocks.courseOfferings.findByPk.mockResolvedValue({
      id: "offering-1",
      status: "active",
      subject,
      groupLinks: [{ classGroupId: g1.id, classGroup: g1 }, { classGroupId: g2.id, classGroup: g2 }],
    });

    const result = await mocks.service.createCourseOffering({
      subjectId: subject.id, classGroupIds: [g1.id, g2.id], majorId: "major-1", academicYear: "2026",
    });
    expect(result).toBeDefined();
    expect(mocks.courseOfferings.create).toHaveBeenCalled();
  });

  it("rejects an alias whose canonical root is missing", async () => {
    const mocks = buildService();
    const alias = { ...subject, canonicalSubjectId: "missing-root", allowCrossMajor: false };
    mocks.subjects.findByPk.mockResolvedValue(alias);
    mocks.subjects.findAll.mockResolvedValue([]);

    await expect(mocks.service.createCourseOffering({
      subjectId: alias.id, classGroupIds: ["group-1"],
    })).rejects.toThrow("Mapping học phần logic");
    expect(mocks.courseOfferings.create).not.toHaveBeenCalled();
  });

  it("rejects mixed-major groups when a local subject in the curriculum resolves to another logical root", async () => {
    const mocks = buildService();
    const root = { ...subject, allowCrossMajor: true };
    const otherRoot = { ...subject, id: "other-root", name: "Học phần khác", majorId: "major-2", allowCrossMajor: true };
    const g1 = group("group-1", "N01", "major-1");
    const g2 = group("group-2", "N02", "major-2");
    mocks.subjects.findByPk.mockResolvedValue(root);
    mocks.classGroups.findAll.mockResolvedValue([g1, g2]);
    mocks.packages.findAll.mockResolvedValue([
      officialPackage(g1.id, [{ subjectId: root.id, subject: root }]),
      officialPackage(g2.id, [{ subjectId: otherRoot.id, subject: otherRoot }]),
    ]);

    await expect(mocks.service.createCourseOffering({
      subjectId: root.id, classGroupIds: [g1.id, g2.id],
    })).rejects.toThrow("không có môn trùng tên và số tín chỉ");
    expect(mocks.courseOfferings.create).not.toHaveBeenCalled();
  });
});

describe("SchedulingService persisted reads", () => {
  it("scopes the list through Subject.program so another program cannot leak into Masters", async () => {
    const { service, courseOfferings } = buildService();
    const mastersOffering = { id: "offering-masters", subject };
    const doctoralOffering = {
      id: "offering-doctoral",
      subject: { ...subject, id: "subject-doctoral", program: "doctoral" },
    };
    courseOfferings.findAll.mockImplementation(async (options: any) => {
      const subjectInclude = options.include.find((include: any) => include.as === "subject");
      return [mastersOffering, doctoralOffering]
        .filter((offering) => offering.subject.program === subjectInclude.where.program);
    });

    const list = await service.listCourseOfferings({ program: "masters" });

    expect(list).toEqual([mastersOffering]);
    const options = courseOfferings.findAll.mock.calls[0][0] as any;
    expect(options.include.find((include: any) => include.as === "subject")).toMatchObject({
      required: true,
      where: { program: "masters" },
    });
  });

  it("keeps class-group and offering filters while applying the Subject program scope", async () => {
    const { service, courseOfferings, classGroups, offeringGroups } = buildService();
    classGroups.findAll.mockResolvedValue([{ id: "group-1" }]);
    offeringGroups.findAll.mockResolvedValue([{ courseOfferingId: "offering-1" }]);
    courseOfferings.findAll.mockResolvedValue([]);

    await service.listCourseOfferings({
      program: "masters",
      majorId: "major-1",
      academicYear: "2026",
      subjectId: "subject-1",
      status: "active",
    });

    expect(classGroups.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        program: "masters",
        majorId: "major-1",
        academicYear: "2026",
      },
    }));
    const options = courseOfferings.findAll.mock.calls[0][0] as any;
    expect(options.where).toEqual(expect.objectContaining({
      subjectId: "subject-1",
      status: "active",
    }));
    expect(options.include.find((include: any) => include.as === "subject").where).toEqual({ program: "masters" });
  });

  it("keeps Doctoral disabled through the scheduling program capability policy", async () => {
    const { service, courseOfferings } = buildService();

    await expect(service.listCourseOfferings({ program: "doctoral" })).rejects.toThrow("chưa được kích hoạt");
    expect(courseOfferings.findAll).not.toHaveBeenCalled();
  });

  it("lists and reloads an offering detail through the persistence models", async () => {
    const { service, courseOfferings, teachingSessions } = buildService();
    const persisted = { id: "offering-1", status: "active", subject, groupLinks: [] };
    courseOfferings.findAll.mockResolvedValue([persisted]);
    courseOfferings.findByPk.mockResolvedValue(persisted);
    teachingSessions.findAll
      .mockResolvedValueOnce([
        { id: "held", courseOfferingId: persisted.id, sessionDate: "2000-01-01", endTime: "10:00:00", status: "held" },
        { id: "pending", courseOfferingId: persisted.id, sessionDate: "2000-01-02", endTime: "10:00:00", status: "planned" },
        { id: "future", courseOfferingId: persisted.id, sessionDate: "2999-01-03", endTime: "10:00:00", status: "planned" },
      ])
      .mockResolvedValueOnce([]);

    const list = await service.listCourseOfferings({ program: "masters" });
    expect(list).toEqual([persisted]);
    expect((list[0] as any).sessionSummary).toEqual({
      totalCount: 3,
      heldCount: 1,
      notHeldCount: 0,
      plannedCount: 2,
      pendingCount: 1,
      futurePlannedCount: 1,
      firstPlannedSessionDate: "2000-01-02",
      latestTimesByPeriod: {},
    });

    const detail = await service.getCourseOffering("offering-1");
    expect(detail).toEqual(persisted);
    expect(courseOfferings.findAll).toHaveBeenCalled();
    expect(courseOfferings.findByPk).toHaveBeenCalledWith("offering-1", expect.objectContaining({ include: expect.any(Array) }));
  });

  it("lists all teaching sessions for a course offering", async () => {
    const { service, courseOfferings, teachingSessions } = buildService();
    const persisted = { id: "offering-1", status: "active", subject, groupLinks: [] };
    courseOfferings.findByPk.mockResolvedValue(persisted);
    const mockSessions = [
      { id: "session-1", courseOfferingId: persisted.id, sessionDate: "2099-01-01", startTime: "08:00:00", endTime: "11:30:00", status: "planned", courseOffering: persisted },
    ];
    teachingSessions.findAll.mockResolvedValue(mockSessions);
    const result = await service.listTeachingSessionsForOffering(persisted.id);
    expect(result).toEqual(mockSessions);
    expect(teachingSessions.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { courseOfferingId: persisted.id },
      order: [["sessionDate", "ASC"], ["startTime", "ASC"], ["id", "ASC"]],
    }));
  });
});
describe("Persisted latest same-period time suggestions", () => {
  it("reads across weeks, groups by offering/period and leaves a missing period empty", async () => {
    const { service, courseOfferings, teachingSessions } = buildService();
    const first = { id: "offering-1", subject, groupLinks: [] };
    const second = { id: "offering-2", subject, groupLinks: [] };
    courseOfferings.findAll.mockResolvedValue([first, second]);
    teachingSessions.findAll.mockImplementation(async (query: any) => {
      expect(query.where).toEqual({ courseOfferingId: { [Op.in]: [first.id, second.id] } });
      expect(query.order).toEqual([["sessionDate", "DESC"], ["startTime", "DESC"], ["id", "DESC"]]);
      return [
        { id: "newest", courseOfferingId: first.id, period: "MORNING", sessionDate: "2026-10-12", startTime: "08:15:00", endTime: "10:30:00", status: "planned" },
        { id: "other", courseOfferingId: second.id, period: "AFTERNOON", sessionDate: "2026-10-11", startTime: "19:00:00", endTime: "21:00:00", status: "planned" },
        { id: "older", courseOfferingId: first.id, period: "MORNING", sessionDate: "2026-08-01", startTime: "09:00:00", endTime: "11:00:00", status: "held" },
      ];
    });
    const rows = await service.listCourseOfferings({ program: "masters" });
    expect((rows[0] as any).sessionSummary.latestTimesByPeriod).toEqual({
      MORNING: { sessionId: "newest", sessionDate: "2026-10-12", startTime: "08:15:00", endTime: "10:30:00" },
    });
    expect((rows[1] as any).sessionSummary.latestTimesByPeriod).toEqual({
      AFTERNOON: { sessionId: "other", sessionDate: "2026-10-11", startTime: "19:00:00", endTime: "21:00:00" },
    });
  });
});
