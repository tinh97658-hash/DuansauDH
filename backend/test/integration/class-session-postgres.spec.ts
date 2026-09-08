import { jest } from "@jest/globals";
import { CourseOffering } from "../../src/database/models/training/course-offering.model.js";
import { CourseOfferingParticipant } from "../../src/database/models/training/course-offering-participant.model.js";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../src/app.module.js";
import { MastersService } from "../../src/masters/masters.service.js";
import { SchedulingService } from "../../src/scheduling/scheduling.service.js";
import { ClassGroupService } from "../../src/plan/class-group.service.js";
import { Major } from "../../src/database/models/common/major.model.js";
import { Subject } from "../../src/database/models/plan/subject.model.js";
import { SubjectPackage } from "../../src/database/models/plan/subject-package.model.js";
import { SubjectPackageSubject } from "../../src/database/models/plan/subject-package-subject.model.js";
import { AdmissionRecord } from "../../src/database/models/plan/admission-record.model.js";
import { ClassGroup } from "../../src/database/models/training/class-group.model.js";
import { ClassGroupMember } from "../../src/database/models/training/class-group-member.model.js";
import { Student } from "../../src/database/models/student.model.js";
import { TeachingSession } from "../../src/database/models/training/teaching-session.model.js";
import { Room } from "../../src/database/models/common/room.model.js";
import { Lecturer } from "../../src/database/models/common/lecturer.model.js";
const run = process.env.RUN_POSTGRES_SCHEDULING_TESTS === "true" ? describe : describe.skip;
run("Class/session PostgreSQL workflow", () => {
  let app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;
  beforeAll(async () => {
    if (!new URL(process.env.DATABASE_URL || "").pathname.startsWith("/pgsms_test_")) throw new Error("Requires disposable pgsms_test_ database");
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  });
  afterAll(async () => { await app?.close(); });

  it("persists a named class snapshot with unique learners, independent notes and open sessions across weeks", async () => {
    const masters = app.get(MastersService);
    const scheduling = app.get(SchedulingService);
    const groupService = app.get(ClassGroupService);
    const major = await Major.create({ code: "OPENING", name: "Ngành kiểm thử", program: "masters", active: true });
    const parent = await groupService.create({ code: "ROOT", name: "Nhóm HP", majorId: major.id, academicYear: "2026" });
    expect(parent.term).toBeNull();
    const student = await Student.create({
      nameWithInitials: "Test", fullName: "Học viên gốc", postalAddress: "Test", email: "opening-student@example.test",
      telNo: "0000", password: "not-a-login", accountType: "registered", approvalState: "approved", regNo: "HV-EXISTING",
    });
    const a = await AdmissionRecord.create({ fullName: "Hồ sơ A", email: "a@example.test", code: "A", majorId: major.id, academicYear: "2026", status: "approved", trainingLevel: "Thạc sĩ", studentId: student.id });
    const b = await AdmissionRecord.create({ fullName: "Hồ sơ B", email: "b@example.test", code: "B", majorId: major.id, academicYear: "2026", status: "approved", trainingLevel: "Thạc sĩ" });
    await ClassGroupMember.create({ classGroupId: parent.id, admissionRecordId: a.id, studentId: student.id, note: "Ghi chú gốc" });
    const first = await masters.createClassFromStudents({ parentGroupId: parent.id, code: "CHILD-A", name: "Lớp người dùng đặt A", admissionRecordIds: [a.id] });
    const second = await masters.createClassFromStudents({ parentGroupId: parent.id, code: "CHILD-B", name: "Lớp B", admissionRecordIds: [a.id, b.id] });
    expect(first.term).toBeNull();
    const empty = await masters.createClassFromStudents({ parentGroupId: parent.id, code: "EMPTY", name: "Lớp rỗng", admissionRecordIds: [] });
    expect(empty.members).toHaveLength(0);
    await masters.assignMembers(empty.id, { admissionRecordIds: [a.id, b.id] });
    expect((await masters.getClassGroup(empty.id)).members).toHaveLength(2);

    expect((await masters.listClassGroups(major.id, "2026", "HK2")).map((g) => g.id)).toContain(first.id);
    expect((await masters.listEligibleStudents(major.id, "2026", "HK2")).find((r) => r.id === a.id)?.classes.map((g) => g.id)).toContain(first.id);
    expect(first.members[0].student.regNo).toBe("HV-EXISTING");
    expect(first.members[0].student.fullName).toBe("Học viên gốc");
    await masters.updateClassGroup(first.id, { name: "Lớp A đổi tên" });
    await masters.updateMemberNote(first.id, first.members[0].id, "Ghi chú tại lớp");
    expect((await masters.getClassGroup(first.id)).members[0].note).toBe("Ghi chú tại lớp");
    expect((await ClassGroupMember.findOne({ where: { classGroupId: parent.id } }))?.note).toBe("Ghi chú gốc");

    const subjects = await Subject.bulkCreate(Array.from({ length: 21 }, (_, i) => ({
      code: "OPEN" + i, codeNumber: i + 1, codeText: "OPEN" + i, name: "Học phần " + i,
      majorId: major.id, program: "masters", active: true, teachingUnits: 10, teachingUnitType: "periods",
    })));
    const pkg = await SubjectPackage.create({ code: "OFFICIAL", name: "Gói chính thức", classGroupId: parent.id, majorId: major.id, totalSubjects: 21, isOfficial: true });
    await SubjectPackageSubject.bulkCreate(subjects.map((s) => ({ packageId: pkg.id, subjectId: s.id })));
    const candidates = await scheduling.listCourseOfferingCandidates({ majorId: major.id, academicYear: "2026", program: "masters" });
    const candidate = candidates.subjects.find((c) => c.subject.id === subjects[0].id)!;
    expect(candidate.eligibleClassGroups.map((g) => g.id).sort()).toEqual([first.id, second.id, empty.id].sort());
    await expect(scheduling.createCourseOffering({ name: "Lớp cần ghép", subjectId: subjects[0].id, classGroupIds: [first.id, second.id] })).rejects.toThrow("Có thể ghép lớp");
    await pkg.update({ canMerge: true });
    const preview = await scheduling.previewCourseOfferingParticipants({ classGroupIds: [first.id, second.id] });
    expect(preview.participantCount).toBe(2);
    expect(preview.participants.find((p) => p.studentId === student.id)).toMatchObject({
      identity: "student:" + student.id, regNo: "HV-EXISTING", fullName: "Học viên gốc", note: null,
    });
    const before = await CourseOffering.count();
    await expect(scheduling.createCourseOffering({
      subjectId: subjects[0].id, classGroupIds: [first.id, second.id], name: "Không lưu lớp lỗi",
      participantNotes: [{ studentId: "00000000-0000-4000-8000-000000000000", note: "Sai roster" }],
    })).rejects.toThrow("không thuộc");
    expect(await CourseOffering.count()).toBe(before);

    const failedRosterWrite = jest.spyOn(CourseOfferingParticipant, "bulkCreate").mockRejectedValueOnce(new Error("Roster write failed"));
    try {
      await expect(scheduling.createCourseOffering({
        name: "Rollback sau khi đã tạo lớp", subjectId: subjects[0].id, classGroupIds: [first.id, second.id],
      })).rejects.toThrow("Roster write failed");
    } finally { failedRosterWrite.mockRestore(); }
    expect(await CourseOffering.count()).toBe(before);

    const offering = await scheduling.createCourseOffering({
      subjectId: subjects[0].id, classGroupIds: [first.id, second.id], name: "Lớp ghép A+B",
      participantNotes: [{ studentId: student.id, note: "Ghi chú riêng Lớp HP" }],
    });
    expect(offering.participantCount).toBe(2);
    expect(offering.name).toBe("Lớp ghép A+B");
    expect(offering.plannedUnits).toBeNull();
    expect(await CourseOfferingParticipant.count({ where: { courseOfferingId: offering.id } })).toBe(2);
    expect(await ClassGroup.count({ where: { parentGroupId: parent.id } })).toBe(3);
    expect(await ClassGroupMember.count({ where: { classGroupId: parent.id } })).toBe(1);
    expect((await scheduling.listCourseOfferings({ program: "masters" })).map((p) => p.id)).toContain(offering.id);
    const participant = offering.participants.find((p) => p.studentId === student.id)!;
    expect(participant.note).toBe("Ghi chú riêng Lớp HP");
    await scheduling.renameCourseOffering(offering.id, "Lớp HP đã đổi tên");
    await scheduling.updateCourseOfferingParticipantNote(offering.id, participant.id, "Ghi chú đã đổi");
    expect((await scheduling.getCourseOffering(offering.id)).name).toBe("Lớp HP đã đổi tên");
    expect((await scheduling.getCourseOffering(offering.id)).participants.find((p) => p.id === participant.id)?.note).toBe("Ghi chú đã đổi");
    expect((await ClassGroupMember.findOne({ where: { classGroupId: first.id, studentId: student.id } }))?.note).toBe("Ghi chú tại lớp");

    // Later group membership changes cannot silently alter a confirmed class roster.
    const added = await AdmissionRecord.create({
      fullName: "Hồ sơ thêm sau", email: "later@example.test", code: "LATER", majorId: major.id,
      academicYear: "2026", status: "approved", trainingLevel: "Thạc sĩ",
    });
    await ClassGroupMember.create({ classGroupId: second.id, admissionRecordId: added.id });
    expect((await scheduling.getCourseOffering(offering.id)).participantCount).toBe(2);

    // This metadata and a later merge-permission change must never restrict session creation.
    await offering.update({ plannedUnits: 1, unitType: "periods" });
    await pkg.update({ canMerge: false });
    const room = await Room.create({ code: "TEST-ROOM", name: "Phòng kiểm thử", capacity: 2 });
    const lecturer = await Lecturer.create({ code: "TEST-LECTURER", name: "Giảng viên kiểm thử", active: true });
    const lessons: TeachingSession[] = [];
    for (const [sessionDate, period] of [
      ["2099-09-07", "MORNING"], ["2099-09-09", "AFTERNOON"],
      ["2099-09-14", "MORNING"], ["2099-09-16", "AFTERNOON"],
    ] as const) {
      lessons.push(await scheduling.createTeachingSession({
        courseOfferingId: offering.id, sessionDate, period, roomId: room.id, lecturerId: lecturer.id,
      }));
    }
    expect(lessons).toHaveLength(4);
    expect(lessons.every((l) => l.isScheduled === true && l.plannedUnits === null && l.sequenceNumber === null)).toBe(true);
    expect(lessons[0].startTime).toBe("00:00:00");
    expect(lessons[0].endTime).toBe("12:00:00");
    expect((await scheduling.getCourseOffering(offering.id)).sessionSummary.totalCount).toBe(4);
    expect(await scheduling.listCourseOfferingSessions(offering.id)).toHaveLength(4);
    expect(await scheduling.listTeachingSessions({ courseOfferingId: offering.id, from: "2099-09-07", to: "2099-09-13" })).toHaveLength(2);
    expect(await scheduling.listTeachingSessions({ courseOfferingId: offering.id, from: "2099-09-14", to: "2099-09-20" })).toHaveLength(2);
    await scheduling.updateTeachingSession(lessons[3].id, { sessionDate: "2099-09-17", period: "MORNING" });
    expect((await scheduling.getTeachingSession(lessons[3].id)).sessionDate).toBe("2099-09-17");
    await scheduling.deleteTeachingSession(lessons[3].id);
    expect(await TeachingSession.findByPk(lessons[3].id)).toBeNull();
    expect((await scheduling.getCourseOffering(offering.id)).sessionSummary.totalCount).toBe(3);

    // canMerge=false permits a separate class, and stopping after two sessions is ordinary state.
    const separate = await scheduling.createCourseOffering({ name: "Lớp riêng", subjectId: subjects[1].id, classGroupIds: [first.id] });
    for (const sessionDate of ["2099-09-10", "2099-09-11"]) await scheduling.createTeachingSession({
      courseOfferingId: separate.id, sessionDate, period: "MORNING", roomId: room.id, lecturerId: lecturer.id,
    });
    expect((await scheduling.getCourseOffering(separate.id)).sessionSummary.totalCount).toBe(2);
    expect((await scheduling.getCourseOffering(separate.id)).status).toBe("active");

  }, 30000);

  it("rolls back class creation when a selected student is ineligible", async () => {
    const parent = await ClassGroup.findOne({ where: { code: "ROOT" } });
    const before = await ClassGroup.count();
    await expect(app.get(MastersService).createClassFromStudents({
      parentGroupId: parent!.id, code: "INVALID", name: "Không được lưu", admissionRecordIds: ["00000000-0000-4000-8000-000000000000"],
    })).rejects.toThrow("không đủ điều kiện");
    expect(await ClassGroup.count()).toBe(before);
  });
});
