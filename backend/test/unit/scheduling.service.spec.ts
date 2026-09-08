import { Op } from "sequelize";
import { jest } from "@jest/globals";
import { SchedulingService } from "../../src/scheduling/scheduling.service.js";

const transaction = { LOCK: { UPDATE: "UPDATE" } };

const buildService = () => {
  const courseOfferings = { create: jest.fn(), findAll: jest.fn(), findByPk: jest.fn() };
  const offeringGroups = { bulkCreate: jest.fn(), findAll: jest.fn() };
  const subjects = { findByPk: jest.fn(), findAll: jest.fn() };
  const packages = { findAll: jest.fn() };
  const classGroups = { findAll: jest.fn() };
  const classGroupMembers = { findAll: jest.fn().mockResolvedValue([]) };
  const majors = { findOne: jest.fn() };
  const staff = { findByPk: jest.fn(), update: jest.fn() };
  const sequelize = { transaction: jest.fn((callback: (tx: any) => Promise<unknown>) => callback(transaction)) };
  const rooms = { findAll: jest.fn() };
  const lecturers = { findAll: jest.fn() };
  const teachingSessions = { findAll: jest.fn().mockResolvedValue([]), findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn() };
  const savedParticipants: any[] = [];
  const offeringParticipants = {
    findAll: jest.fn(async () => savedParticipants),
    bulkCreate: jest.fn(async (rows: any[]) => { savedParticipants.push(...rows); return rows; }),
    count: jest.fn(async () => savedParticipants.length), findOne: jest.fn(),
  };
  const service = new SchedulingService(
    courseOfferings as never,
    offeringGroups as never,
    subjects as never,
    packages as never,
    classGroups as never,
    classGroupMembers as never,
    majors as never,
    staff as never,
    sequelize as never,
    rooms as never,
    lecturers as never,
    teachingSessions as never,
    offeringParticipants as never,
  );
  return { service, offeringParticipants, courseOfferings, offeringGroups, subjects, packages, classGroups, classGroupMembers, majors, staff, sequelize, rooms, lecturers, teachingSessions };
};

const subject = {
  id: "subject-1",
  code: "HP01",
  codeNumber: 1,
  name: "Học phần 1",
  majorId: "major-1",
  program: "masters",
  active: true,
  sortOrder: 1,
  canonicalSubjectId: null,
  allowCrossMajor: false,
};

const group = (id: string, code = id, majorId = "major-1") => ({
  id,
  code,
  name: `Nhóm ${code}`,
  majorId,
  major: { id: majorId, code: majorId, name: `Ngành ${majorId}` },
  program: "masters",
  academicYear: "2026",
  term: "HK1",
  status: "open",
});

const officialPackage = (classGroupId: string, entries = [{ subjectId: subject.id, subject }]) => ({
  id: `package-${classGroupId}`,
  classGroupId,
  isOfficial: true,
  canMerge: true,
  active: true,
  entries,
});

describe("SchedulingService participant preview", () => {
  it("deduplicates A,B + B,C to 3 and persists the confirmed roster in the same transaction", async () => {
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
    expect(preview).toEqual(expect.objectContaining({ classGroupCount: 2, participantCount: 3, participants: expect.any(Array) }));
    expect(preview.participants.map((p) => p.identity)).toEqual(["student:student-a", "student:student-b", "student:student-c"]);
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
    const created: any = await mocks.service.createCourseOffering({ name: "Lớp tự đặt", subjectId: subject.id, classGroupIds: groups.map((item) => item.id) });
    expect(created.participantCount).toBe(preview.participantCount);
  });

  it("resolves Student identity through admission and preserves admission-only learners", async () => {
    const mocks = buildService();
    mocks.classGroups.findAll.mockResolvedValue([group("group-a"), group("group-b")]);
    mocks.classGroupMembers.findAll.mockResolvedValue([
      { id: "member-1", classGroupId: "group-a", admissionRecordId: "admission-a" },
      { id: "member-2", classGroupId: "group-b", admissionRecordId: "admission-a" },
      { id: "member-3", classGroupId: "group-b", admissionRecordId: "admission-b", admissionRecord: { studentId: "student-b", code: "HV-B", fullName: "Học viên B" } },
    ]);
    await expect(mocks.service.previewCourseOfferingParticipants({ classGroupIds: ["group-a", "group-b"] }))
      .resolves.toEqual(expect.objectContaining({ classGroupCount: 2, participantCount: 2, participants: expect.arrayContaining([expect.objectContaining({ identity: "student:student-b", regNo: "HV-B", fullName: "Học viên B" })]) }));
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

  it("does not infer logical identity from matching names or codes", async () => {
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
});

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

describe("SchedulingService.createCourseOffering", () => {


  it("creates the offering and group relation atomically after locking groups", async () => {
    const mocks = buildService();
    const g1 = arrangeValidCreate(mocks);

    const result = await mocks.service.createCourseOffering({ name: "Lớp tự đặt", subjectId: subject.id, classGroupIds: [g1.id], note: "Ghi chú" });

    expect(mocks.sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.classGroups.findAll).toHaveBeenCalledWith(expect.objectContaining({
      order: [["id", "ASC"]],
      lock: "UPDATE",
      transaction,
    }));
    expect(mocks.courseOfferings.create).toHaveBeenCalledWith(
      { subjectId: subject.id, status: "active", note: "Ghi chú", name: "Lớp tự đặt" },
      { transaction },
    );
    expect(mocks.offeringGroups.bulkCreate).toHaveBeenCalledWith(
      [{ courseOfferingId: "offering-1", classGroupId: g1.id }],
      { transaction },
    );
    expect(result).toEqual(expect.objectContaining({ id: "offering-1" }));
  });

  it.each(["", "   ", null, undefined])("requires a nonblank class name: %s", async (name) => {
    const mocks = buildService();
    await expect(mocks.service.createCourseOffering({ name: name as any, subjectId: subject.id, classGroupIds: ["group-1"] })).rejects.toThrow("Nhập tên lớp");
    expect(mocks.sequelize.transaction).not.toHaveBeenCalled();
  });

  it("stores notes on the class snapshot and rejects notes for unselected learners", async () => {
    const mocks = buildService();
    arrangeValidCreate(mocks);
    mocks.classGroupMembers.findAll.mockResolvedValue([{ id: "m", studentId: "student-a", student: { regNo: "HV-A", fullName: "Học viên A" }, note: "Ghi chú nhóm gốc" }]);
    await expect(mocks.service.createCourseOffering({
      name: "Lớp A", subjectId: subject.id, classGroupIds: ["group-1"],
      participantNotes: [{ studentId: "outside", note: "Không hợp lệ" }],
    })).rejects.toThrow("không thuộc");
    expect(mocks.courseOfferings.create).not.toHaveBeenCalled();
    const created = await mocks.service.createCourseOffering({
      name: "Lớp A", subjectId: subject.id, classGroupIds: ["group-1"],
      participantNotes: [{ studentId: "student-a", note: " Ghi chú riêng " }],
    });
    expect(created.participants[0]).toMatchObject({ regNo: "HV-A", fullName: "Học viên A", note: "Ghi chú riêng" });
    expect(mocks.offeringParticipants.bulkCreate).toHaveBeenCalledWith([
      expect.objectContaining({ courseOfferingId: "offering-1", identity: "student:student-a", note: "Ghi chú riêng" }),
    ], { transaction });
  });

  it("rejects duplicate class group ids before opening a transaction", async () => {
    const mocks = buildService();
    await expect(mocks.service.createCourseOffering({ name: "Lớp tự đặt",
      subjectId: subject.id,
      classGroupIds: ["group-1", "group-1"],
    })).rejects.toThrow("trùng lặp");
    expect(mocks.sequelize.transaction).not.toHaveBeenCalled();
  });

  it("rejects a group without an active official package", async () => {
    const mocks = buildService();
    arrangeValidCreate(mocks);
    mocks.packages.findAll.mockResolvedValue([]);

    await expect(mocks.service.createCourseOffering({ name: "Lớp tự đặt",
      subjectId: subject.id, classGroupIds: ["group-1"],
    })).rejects.toThrow("chưa có gói học phần chính thức");
    expect(mocks.courseOfferings.create).not.toHaveBeenCalled();
  });

  it("rejects a group whose local package does not map to the requested subject", async () => {
    const mocks = buildService();
    arrangeValidCreate(mocks);
    mocks.classGroups.findAll.mockResolvedValue([{ ...group("group-1"), majorId: "major-2" }]);

    await expect(mocks.service.createCourseOffering({ name: "Lớp tự đặt",
      subjectId: subject.id, classGroupIds: ["group-1"],
    })).rejects.toThrow("không chứa học phần local cùng logical root");
    expect(mocks.courseOfferings.create).not.toHaveBeenCalled();
  });

  it("rejects an active offering for the same Subject and class group", async () => {
    const mocks = buildService();
    arrangeValidCreate(mocks);
    mocks.offeringGroups.findAll.mockResolvedValue([{
      classGroupId: "group-1",
      courseOffering: { subjectId: subject.id, status: "active" },
    }]);

    await expect(mocks.service.createCourseOffering({ name: "Lớp tự đặt",
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

    await expect(mocks.service.createCourseOffering({ name: "Lớp tự đặt",
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
      mocks.service.createCourseOffering({ name: "Lớp tự đặt", subjectId: subject.id, classGroupIds: ["group-1"] }),
      mocks.service.createCourseOffering({ name: "Lớp tự đặt", subjectId: subject.id, classGroupIds: ["group-1"] }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(mocks.courseOfferings.create).toHaveBeenCalledTimes(1);
  });

  it("creates one logical offering from mixed-major groups whose local packages resolve to the same root", async () => {
    const mocks = buildService();
    const root = { ...subject, allowCrossMajor: true };
    const alias = { ...subject, id: "subject-alias", majorId: "major-2", canonicalSubjectId: root.id };
    const g1 = group("group-1", "N01", "major-1");
    const g2 = group("group-2", "N02", "major-2");
    mocks.subjects.findByPk.mockImplementation(async (id: string) => id === alias.id ? alias : root);
    mocks.classGroups.findAll.mockResolvedValue([g1, g2]);
    mocks.packages.findAll.mockResolvedValue([
      officialPackage(g1.id, [{ subjectId: root.id, subject: root }]),
      officialPackage(g2.id, [{ subjectId: alias.id, subject: alias }]),
    ]);
    mocks.offeringGroups.findAll.mockResolvedValue([]);
    mocks.courseOfferings.create.mockResolvedValue({ id: "offering-mixed" });
    mocks.offeringGroups.bulkCreate.mockResolvedValue([]);
    mocks.courseOfferings.findByPk.mockResolvedValue({ id: "offering-mixed", subject: root, groupLinks: [] });

    await mocks.service.createCourseOffering({ name: "Lớp tự đặt", subjectId: alias.id, classGroupIds: [g1.id, g2.id] });

    expect(mocks.courseOfferings.create).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: root.id }),
      { transaction },
    );
  });

  it("rejects mixed-major groups when a local package resolves to another logical root", async () => {
    const mocks = buildService();
    const root = { ...subject, allowCrossMajor: true };
    const otherRoot = { ...subject, id: "other-root", majorId: "major-2", allowCrossMajor: true };
    const g1 = group("group-1", "N01", "major-1");
    const g2 = group("group-2", "N02", "major-2");
    mocks.subjects.findByPk.mockResolvedValue(root);
    mocks.classGroups.findAll.mockResolvedValue([g1, g2]);
    mocks.packages.findAll.mockResolvedValue([
      officialPackage(g1.id, [{ subjectId: root.id, subject: root }]),
      officialPackage(g2.id, [{ subjectId: otherRoot.id, subject: otherRoot }]),
    ]);

    await expect(mocks.service.createCourseOffering({ name: "Lớp tự đặt",
      subjectId: root.id, classGroupIds: [g1.id, g2.id],
    })).rejects.toThrow("không chứa học phần local cùng logical root");
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
    expect(options.include.find((include: any) => include.as === "subject").where).toEqual({ program: "masters", active: true });
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
      unscheduledCount: 0,
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

describe("Shared-subject merge permission", () => {
  it("rejects mixed majors when the logical subject permission is off", async () => {
    const mocks = buildService();
    arrangeValidCreate(mocks);
    mocks.classGroups.findAll.mockResolvedValue([group("group-1", "A", "major-1"), group("group-2", "B", "major-2")]);
    await expect(mocks.service.createCourseOffering({ name: "Lớp ghép", subjectId: subject.id, classGroupIds: ["group-1", "group-2"] }))
      .rejects.toThrow("chưa bật Có thể ghép lớp");
    expect(mocks.courseOfferings.create).not.toHaveBeenCalled();
  });

  it("creates an alias-major class separately with both subject and package merge permissions off", async () => {
    const mocks = buildService();
    arrangeValidCreate(mocks);
    const root = { ...subject, allowCrossMajor: false };
    const alias = { ...subject, id: "alias", majorId: "major-2", canonicalSubjectId: root.id };
    mocks.subjects.findByPk.mockImplementation(async (id: string) => id === alias.id ? alias : root);
    mocks.classGroups.findAll.mockResolvedValue([group("group-1", "B", "major-2")]);
    mocks.packages.findAll.mockResolvedValue([{ ...officialPackage("group-1", [{ subjectId: alias.id, subject: alias }]), canMerge: false }]);
    await mocks.service.createCourseOffering({ name: "Lớp riêng", subjectId: alias.id, classGroupIds: ["group-1"] });
    expect(mocks.courseOfferings.create).toHaveBeenCalledWith(expect.objectContaining({ subjectId: root.id }), expect.anything());
  });
});
