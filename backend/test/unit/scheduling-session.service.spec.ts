import { getBusinessWallTime } from "../../src/scheduling/scheduling-time.js";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { jest } from "@jest/globals";
import { Op } from "sequelize";
import { SchedulingService } from "../../src/scheduling/scheduling.service.js";

const transaction = { LOCK: { UPDATE: "UPDATE" } };

const subject = { id: "subject-1", program: "masters", active: true };
const room = (id = "room-1", capacity: number | null = 50) => ({ id, code: id.toUpperCase(), name: `Phòng ${id}`, capacity, isActive: true });
const lecturer = (id = "lecturer-1") => ({ id, code: id.toUpperCase(), name: `Giảng viên ${id}`, active: true });
const group = (id = "group-1", majorId = "major-1") => ({ id, code: id, majorId, program: "masters" });
const offering = (overrides: Record<string, unknown> = {}) => ({ id: "offering-1", subjectId: subject.id, status: "active", ...overrides });
const session = (overrides: Record<string, unknown> = {}) => ({
  id: "session-1",
  courseOfferingId: "offering-1",
  sessionDate: "2999-09-12",
  startTime: "08:00:00",
  endTime: "10:00:00",
  period: "MORNING",
  lecturerId: "lecturer-1",
  roomId: "room-1",
  note: null,
  status: "planned",
  update: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn().mockResolvedValue(undefined),
  courseOffering: { ...offering(), subject, groupLinks: [{ classGroupId: "group-1" }] },
  ...overrides,
});

const idsFrom = (options: any) => options.where.id[Op.in] as string[];

const buildService = () => {
  const courseOfferings = { create: jest.fn(), findAll: jest.fn(), findByPk: jest.fn() };
  const offeringGroups = { bulkCreate: jest.fn(), findAll: jest.fn() };
  const subjects = { findByPk: jest.fn(), findAll: jest.fn() };
  const packages = { findAll: jest.fn() };
  const classGroups = { findAll: jest.fn() };
  const classGroupMembers = { findAll: jest.fn().mockResolvedValue([]) };
  const majors = { findOne: jest.fn() };
  const staff = { findByPk: jest.fn(), update: jest.fn() };
  const sequelize = { query: jest.fn().mockResolvedValue([]), transaction: jest.fn((callback: (tx: any) => Promise<unknown>) => callback(transaction)) };
  const rooms = { findAll: jest.fn() };
  const lecturers = { findAll: jest.fn() };
  const teachingSessions = { findAll: jest.fn(), findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn() };
  const individualStudents = { findAll: jest.fn().mockResolvedValue([]), bulkCreate: jest.fn().mockResolvedValue([]) };
  const admissionRecords = { findAll: jest.fn().mockResolvedValue([]) };
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
    individualStudents as never,
    admissionRecords as never,
  );
  return {
    individualStudents, admissionRecords, service, courseOfferings, offeringGroups, subjects, classGroups, classGroupMembers,
    sequelize, rooms, lecturers, teachingSessions,
  };
};

const arrangeValid = (mocks: ReturnType<typeof buildService>, options: {
  groups?: Array<ReturnType<typeof group>>;
  rooms?: Array<ReturnType<typeof room>>;
  lecturers?: Array<ReturnType<typeof lecturer>>;
} = {}) => {
  const groups = options.groups || [group()];
  const roomRows = options.rooms || [room()];
  const lecturerRows = options.lecturers || [lecturer()];
  mocks.offeringGroups.findAll.mockResolvedValue(groups.map((item) => ({ classGroupId: item.id })));
  mocks.rooms.findAll.mockImplementation(async (query: any) => roomRows.filter((item) => idsFrom(query).includes(item.id)));
  mocks.lecturers.findAll.mockImplementation(async (query: any) => lecturerRows.filter((item) => idsFrom(query).includes(item.id)));
  mocks.classGroups.findAll.mockResolvedValue(groups);
  mocks.courseOfferings.findByPk.mockResolvedValue(offering());
  mocks.subjects.findByPk.mockResolvedValue(subject);
  mocks.teachingSessions.findAll.mockResolvedValue([]);
  mocks.teachingSessions.create.mockResolvedValue({ id: "session-created" });
  mocks.teachingSessions.findByPk.mockResolvedValue(session({ id: "session-created" }));
};

const createDto = (overrides: Record<string, unknown> = {}) => ({
  courseOfferingId: "offering-1",
  sessionDate: "2026-09-12",
  startTime: "08:00",
  endTime: "10:00",
  period: "MORNING",
  lecturerId: "lecturer-1",
  roomId: "room-1",
  ...overrides,
});

const expectConflictCode = async (promise: Promise<unknown>, code: string) => {
  try {
    await promise;
    throw new Error("Expected conflict");
  } catch (error) {
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual(expect.objectContaining({ code }));
  }
};

describe("SchedulingService TeachingSession", () => {
  it("includes separately selected students in room capacity", async () => {
    const mocks = buildService();
    arrangeValid(mocks, { rooms: [room("room-1", 1)] });
    mocks.classGroupMembers.findAll.mockResolvedValue([{ admissionRecordId: "group-student" }]);
    mocks.individualStudents.findAll.mockResolvedValue([{ admissionRecordId: "extra-student" }]);
    await expectConflictCode(mocks.service.createTeachingSession(createDto()), "ROOM_CAPACITY_EXCEEDED");
    expect(mocks.teachingSessions.create).not.toHaveBeenCalled();
  });

  it("rejects overlapping attendance between a group member and a separately selected student", async () => {
    const mocks = buildService();
    arrangeValid(mocks);
    mocks.classGroupMembers.findAll.mockImplementation(async (options: any) => options.where.classGroupId[Op.in].includes("other-group") ? [{ studentId: "same-person" }] : []);
    mocks.individualStudents.findAll.mockImplementation(async (options: any) => options.where.courseOfferingId === "offering-1" ? [{ admissionRecordId: "extra", admissionRecord: { studentId: "same-person" } }] : []);
    mocks.teachingSessions.findAll.mockResolvedValue([session({ courseOfferingId: "other-offering", roomId: "other-room", lecturerId: "other-lecturer", courseOffering: { groupLinks: [{ classGroupId: "other-group" }] } })]);
    await expectConflictCode(mocks.service.createTeachingSession(createDto()), "STUDENT_CONFLICT");
    expect(mocks.sequelize.query).toHaveBeenCalledWith("SELECT pg_advisory_xact_lock(21025)", { transaction });
    expect(mocks.teachingSessions.create).not.toHaveBeenCalled();
  });
  beforeEach(() => { jest.useFakeTimers({ now: new Date("2026-09-04T05:00:00Z") }); });
  afterEach(() => { jest.useRealTimers(); });

  it("rejects an ended create target before locks or insert with normalized time details", async () => {
    const mocks = buildService();
    arrangeValid(mocks);
    const dto = createDto({ sessionDate: "2026-09-04", startTime: "10:00", endTime: "11:59:59" });
    try {
      await mocks.service.createTeachingSession(dto);
      throw new Error("Expected past target rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getStatus()).toBe(409);
      expect((error as ConflictException).getResponse()).toEqual({
        code: "SESSION_TIME_IN_PAST",
        message: "Không thể xếp lịch vào một buổi học đã kết thúc.",
        details: { sessionDate: "2026-09-04", startTime: "10:00:00", endTime: "11:59:59" },
      });
    }
    expect(mocks.sequelize.transaction).not.toHaveBeenCalled();
    expect(mocks.rooms.findAll).not.toHaveBeenCalled();
    expect(mocks.teachingSessions.findAll).not.toHaveBeenCalled();
    expect(mocks.teachingSessions.create).not.toHaveBeenCalled();
  });

  it("rejects moving a future session into an ended target without updating or resource locks", async () => {
    const mocks = buildService();
    arrangeValid(mocks);
    const current = session();
    mocks.teachingSessions.findByPk.mockResolvedValue(current);
    await expectConflictCode(mocks.service.updateTeachingSession(current.id, {
      period: "AFTERNOON", sessionDate: "2026-09-03", startTime: "14:00", endTime: "15:00",
    }), "SESSION_TIME_IN_PAST");
    expect(current.sessionDate).toBe("2999-09-12");
    expect(current.update).not.toHaveBeenCalled();
    expect(mocks.rooms.findAll).not.toHaveBeenCalled();
    expect(mocks.teachingSessions.findAll).not.toHaveBeenCalled();
  });

  it.each(["11:00:00", "11:00:01", "12:00:00"])("allows an already-started target whose end is not before now: %s", async (endTime) => {
    const mocks = buildService();
    arrangeValid(mocks);
    jest.setSystemTime(new Date("2026-09-04T04:00:00Z"));
    await expect(mocks.service.createTeachingSession(createDto({ sessionDate: "2026-09-04", startTime: "10:00", endTime }))).resolves.toBeDefined();
    expect(mocks.teachingSessions.create).toHaveBeenCalled();
  });

  it.each(["planned", "held", "not_held"].flatMap((status) => ["ROOM_CONFLICT", "LECTURER_CONFLICT", "CLASS_GROUP_CONFLICT"].map((code) => [status, code])))
    ("%s has correct exact-overlap resource semantics for %s", async (status, code) => {
      const mocks = buildService();
      arrangeValid(mocks);
      const existing = session({
        sessionDate: "2026-09-12", status,
        roomId: code === "ROOM_CONFLICT" ? "room-1" : "other-room",
        lecturerId: code === "LECTURER_CONFLICT" ? "lecturer-1" : "other-lecturer",
        courseOffering: { groupLinks: [{ classGroupId: code === "CLASS_GROUP_CONFLICT" ? "group-1" : "other-group" }] },
      });
      mocks.teachingSessions.findAll.mockImplementation(async (query: any) => {
        expect(query.where.status).toEqual({ [Op.ne]: "not_held" });
        expect(query.where.sessionDate).toBe("2026-09-12");
        expect(query.where.startTime[Op.lt]).toBe("10:00:00");
        expect(query.where.endTime[Op.gt]).toBe("08:00:00");
        return [existing].filter((item) => item.status !== query.where.status[Op.ne]);
      });
      if (status === "not_held") {
        await expect(mocks.service.createTeachingSession(createDto())).resolves.toBeDefined();
        expect(mocks.teachingSessions.create).toHaveBeenCalled();
      } else {
        await expectConflictCode(mocks.service.createTeachingSession(createDto()), code);
        expect(mocks.teachingSessions.create).not.toHaveBeenCalled();
      }
      expect(existing.destroy).not.toHaveBeenCalled();
    });

  it("creates a persisted session after locking Room, Lecturer and ClassGroups in a stable order", async () => {
    const mocks = buildService();
    arrangeValid(mocks);

    await mocks.service.createTeachingSession(createDto());

    expect(mocks.teachingSessions.create).toHaveBeenCalledWith({
      courseOfferingId: "offering-1",
      sessionDate: "2026-09-12",
      startTime: "08:00:00",
      endTime: "10:00:00",
      period: "MORNING",
      lecturerId: "lecturer-1",
      roomId: "room-1",
      note: null,
      status: "planned",
    }, { transaction });
    expect(mocks.rooms.findAll.mock.invocationCallOrder[0]).toBeLessThan(mocks.lecturers.findAll.mock.invocationCallOrder[0]);
    expect(mocks.lecturers.findAll.mock.invocationCallOrder[0]).toBeLessThan(mocks.classGroups.findAll.mock.invocationCallOrder[0]);
    expect(mocks.classGroups.findAll.mock.invocationCallOrder[0]).toBeLessThan(mocks.courseOfferings.findByPk.mock.invocationCallOrder[0]);
  });

  it("rejects an empty or reversed time range", async () => {
    const mocks = buildService();

    await expect(mocks.service.createTeachingSession(createDto({ startTime: "10:00", endTime: "10:00" })))
      .rejects.toThrow("bắt đầu phải nhỏ hơn");
    await expect(mocks.service.createTeachingSession(createDto({ startTime: "11:00", endTime: "10:00" })))
      .rejects.toThrow("bắt đầu phải nhỏ hơn");
    expect(mocks.sequelize.transaction).not.toHaveBeenCalled();
  });

  it("rejects a completed CourseOffering", async () => {
    const mocks = buildService();
    arrangeValid(mocks);
    mocks.courseOfferings.findByPk.mockResolvedValue(offering({ status: "completed" }));

    await expect(mocks.service.createTeachingSession(createDto())).rejects.toThrow("đã hoàn thành");
    expect(mocks.teachingSessions.create).not.toHaveBeenCalled();
  });

  it("rejects an inactive Room", async () => {
    const mocks = buildService();
    arrangeValid(mocks, { rooms: [{ ...room(), isActive: false }] });

    await expect(mocks.service.createTeachingSession(createDto())).rejects.toThrow("ngừng sử dụng");
    expect(mocks.teachingSessions.create).not.toHaveBeenCalled();
  });

  it("returns a machine-readable ROOM_CONFLICT", async () => {
    const mocks = buildService();
    arrangeValid(mocks);
    mocks.teachingSessions.findAll.mockResolvedValue([session({ id: "existing-room" })]);

    await expectConflictCode(mocks.service.createTeachingSession(createDto()), "ROOM_CONFLICT");
    expect(mocks.teachingSessions.create).not.toHaveBeenCalled();
  });

  it("adds minimal non-PII context to an authoritative conflict", async () => {
    const mocks = buildService();
    arrangeValid(mocks);
    mocks.teachingSessions.findAll.mockResolvedValue([session({
      id: "existing-room",
      courseOffering: {
        ...offering(),
        subject: { id: "subject-1", code: "HP01", name: "Học phần 1" },
        groupLinks: [{ classGroupId: "group-1", classGroup: { id: "group-1", code: "N01", name: "Nhóm 01" } }],
      },
      lecturer: { id: "lecturer-1", code: "GV01", name: "Giảng viên 1" },
      room: { id: "room-1", code: "301", name: "Phòng 301" },
    })]);

    try {
      await mocks.service.createTeachingSession(createDto());
      throw new Error("Expected conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual(expect.objectContaining({
        code: "ROOM_CONFLICT",
        details: expect.objectContaining({
          conflictingSession: {
            courseOfferingId: "offering-1",
            subject: { id: "subject-1", code: "HP01", name: "Học phần 1" },
            classGroups: [{ id: "group-1", code: "N01", name: "Nhóm 01" }],
            lecturer: { id: "lecturer-1", code: "GV01", name: "Giảng viên 1" },
            room: { id: "room-1", code: "301", name: "Phòng 301" },
          },
        }),
      }));
    }
  });

  it("returns a machine-readable LECTURER_CONFLICT", async () => {
    const mocks = buildService();
    arrangeValid(mocks);
    mocks.teachingSessions.findAll.mockResolvedValue([session({ id: "existing-lecturer", roomId: "other-room" })]);

    await expectConflictCode(mocks.service.createTeachingSession(createDto()), "LECTURER_CONFLICT");
  });

  it("returns a machine-readable CLASS_GROUP_CONFLICT", async () => {
    const mocks = buildService();
    arrangeValid(mocks);
    mocks.teachingSessions.findAll.mockResolvedValue([session({
      id: "existing-group",
      roomId: "other-room",
      lecturerId: "other-lecturer",
    })]);

    await expectConflictCode(mocks.service.createTeachingSession(createDto()), "CLASS_GROUP_CONFLICT");
  });

  it("uses strict overlap so a touching boundary is not a conflict", async () => {
    const mocks = buildService();
    arrangeValid(mocks);
    mocks.teachingSessions.findAll.mockImplementation(async (query: any) => {
      expect(query.where.startTime[Op.lt]).toBe("11:00:00");
      expect(query.where.endTime[Op.gt]).toBe("10:00:00");
      return [];
    });

    await expect(mocks.service.createTeachingSession(createDto({ startTime: "10:00", endTime: "11:00" }))).resolves.toBeDefined();
  });

  it("excludes the session itself during update conflict checking", async () => {
    const mocks = buildService();
    arrangeValid(mocks);
    const current = session();
    mocks.teachingSessions.findByPk.mockResolvedValue(current);

    await mocks.service.updateTeachingSession(current.id, { startTime: "08:30", endTime: "10:30" });

    const conflictQuery = mocks.teachingSessions.findAll.mock.calls[0][0] as any;
    expect(conflictQuery.where.id[Op.ne]).toBe(current.id);
    expect(current.update).toHaveBeenCalledWith(expect.objectContaining({
      startTime: "08:30:00",
      endTime: "10:30:00",
    }), { transaction });
  });

  it("rejects an update that introduces a conflict", async () => {
    const mocks = buildService();
    arrangeValid(mocks, { rooms: [room(), room("room-2")] });
    const current = session();
    mocks.teachingSessions.findByPk.mockResolvedValue(current);
    mocks.teachingSessions.findAll.mockResolvedValue([session({ id: "session-2", roomId: "room-2" })]);

    await expectConflictCode(
      mocks.service.updateTeachingSession(current.id, { roomId: "room-2" }),
      "ROOM_CONFLICT",
    );
    expect(current.update).not.toHaveBeenCalled();
  });

  it("rejects a Room without declared capacity", async () => {
    const mocks = buildService();
    arrangeValid(mocks, { rooms: [room("room-1", null)] });
    mocks.classGroupMembers.findAll.mockResolvedValue([{ id: "member-1", classGroupId: "group-1", studentId: "student-1" }]);

    await expectConflictCode(mocks.service.createTeachingSession(createDto()), "ROOM_CAPACITY_MISSING");
    expect(mocks.teachingSessions.create).not.toHaveBeenCalled();
  });

  it("rejects a Room smaller than the deduplicated CourseOffering participant count", async () => {
    const mocks = buildService();
    arrangeValid(mocks, { rooms: [room("room-1", 1)] });
    mocks.classGroupMembers.findAll.mockResolvedValue([
      { id: "member-1", classGroupId: "group-1", studentId: "student-1" },
      { id: "member-2", classGroupId: "group-1", studentId: "student-2" },
    ]);

    await expectConflictCode(mocks.service.createTeachingSession(createDto()), "ROOM_CAPACITY_EXCEEDED");
  });

  it("deduplicates the same Student across mixed ClassGroups for capacity", async () => {
    const mocks = buildService();
    const groups = [group("group-a"), group("group-b")];
    arrangeValid(mocks, { groups, rooms: [room("room-1", 1)] });
    mocks.classGroupMembers.findAll.mockResolvedValue([
      { id: "member-1", classGroupId: "group-a", studentId: "student-1" },
      { id: "member-2", classGroupId: "group-b", studentId: "student-1" },
    ]);

    await expect(mocks.service.createTeachingSession(createDto())).resolves.toBeDefined();
  });

  it("detects a shared ClassGroup conflict across a mixed-major offering composition", async () => {
    const mocks = buildService();
    const groups = [group("group-a", "major-a"), group("group-b", "major-b")];
    arrangeValid(mocks, { groups });
    mocks.teachingSessions.findAll.mockResolvedValue([session({
      id: "cross-major-session",
      roomId: "other-room",
      lecturerId: "other-lecturer",
      courseOffering: { groupLinks: [{ classGroupId: "group-b" }] },
    })]);

    await expectConflictCode(mocks.service.createTeachingSession(createDto()), "CLASS_GROUP_CONFLICT");
  });

  it("lists persisted sessions within the requested date range and optional filters", async () => {
    const mocks = buildService();
    mocks.teachingSessions.findAll.mockResolvedValue([session()]);

    await expect(mocks.service.listTeachingSessions({
      from: "2026-09-01",
      to: "2026-09-30",
      roomId: "room-1",
    })).resolves.toHaveLength(1);

    const query = mocks.teachingSessions.findAll.mock.calls[0][0] as any;
    expect(query.where.sessionDate[Op.between]).toEqual(["2026-09-01", "2026-09-30"]);
    expect(query.where.roomId).toBe("room-1");
  });

  it("lists all and only planned sessions whose exact end datetime has passed", async () => {
    const mocks = buildService();
    const past = session({ id: "past", sessionDate: "2000-09-12", endTime: "10:00:00" });
    const future = session({ id: "future", sessionDate: "2999-09-12", endTime: "10:00:00" });
    const held = session({ id: "held", sessionDate: "2000-09-12", status: "held" });
    mocks.teachingSessions.findAll.mockResolvedValue([past, future, held]);

    await expect(mocks.service.listPendingTeachingSessions()).resolves.toEqual([past]);

    const query = mocks.teachingSessions.findAll.mock.calls[0][0] as any;
    expect(query.where).toEqual({ status: "planned" });
    expect(query.order).toEqual([["sessionDate", "DESC"], ["endTime", "DESC"], ["id", "DESC"]]);
  });

  it("returns pending sessions newest first with deterministic end-time and id ties", async () => {
    const mocks = buildService();
    const rows = [
      session({ id: "day-1", sessionDate: "2026-09-01", endTime: "10:00:00" }),
      session({ id: "day-3-a", sessionDate: "2026-09-03", endTime: "08:00:00" }),
      session({ id: "day-2", sessionDate: "2026-09-02", endTime: "15:00:00" }),
      session({ id: "day-3-b", sessionDate: "2026-09-03", endTime: "08:00:00" }),
      session({ id: "day-3-later", sessionDate: "2026-09-03", endTime: "09:00:00" }),
    ];
    mocks.teachingSessions.findAll.mockImplementation(async (query: any) => {
      expect(query.where).toEqual({ status: "planned" });
      expect(query.order).toEqual([["sessionDate", "DESC"], ["endTime", "DESC"], ["id", "DESC"]]);
      return [...rows].sort((left: any, right: any) => {
        for (const [field, direction] of query.order) {
          const difference = String(left[field]).localeCompare(String(right[field]));
          if (difference) return direction === "DESC" ? -difference : difference;
        }
        return 0;
      });
    });
    const result = await mocks.service.listPendingTeachingSessions();
    expect(result.map((item) => item.id)).toEqual(["day-3-later", "day-3-b", "day-3-a", "day-2", "day-1"]);
  });

  it("returns every planned session for an offering across weeks with normal details and participant counts", async () => {
    const mocks = buildService();
    const persisted = session().courseOffering;
    mocks.courseOfferings.findByPk.mockResolvedValue(persisted);
    mocks.classGroupMembers.findAll.mockResolvedValue([{ id: "membership", classGroupId: "group-1", studentId: "student-1" }]);
    const rows = [
      session({ id: "held", status: "held" }), session({ id: "not-held", status: "not_held" }),
      session({ id: "pending-1", sessionDate: "2026-08-01" }), session({ id: "pending-2", sessionDate: "2026-08-09" }),
      session({ id: "future-1", sessionDate: "2026-09-12" }), session({ id: "future-2", sessionDate: "2026-10-18" }),
      session({ id: "other-offering", courseOfferingId: "offering-2" }),
    ];
    mocks.teachingSessions.findAll.mockImplementation(async (query: any) => {
      expect(query.where).toEqual({ courseOfferingId: persisted.id, status: "planned" });
      expect(query.include.map((item: any) => item.as)).toEqual(["courseOffering", "lecturer", "room", "confirmedBy"]);
      expect(query.include[0].include.map((item: any) => item.as)).toEqual(["subject", "groupLinks"]);
      return rows.filter((item) => item.courseOfferingId === query.where.courseOfferingId && item.status === query.where.status);
    });
    const result = await mocks.service.listUnresolvedTeachingSessions(persisted.id);
    expect(result.map((item) => item.id)).toEqual(["pending-1", "pending-2", "future-1", "future-2"]);
    expect(result.every((item: any) => item.courseOffering.participantCount === 1)).toBe(true);
  });

  it("rejects a missing or disabled-program offering before reading unresolved sessions", async () => {
    const mocks = buildService();
    mocks.courseOfferings.findByPk.mockResolvedValue(null);
    await expect(mocks.service.listUnresolvedTeachingSessions("missing")).rejects.toThrow("Không tìm thấy lớp học phần");
    mocks.courseOfferings.findByPk.mockResolvedValue({ ...offering(), subject: { ...subject, program: "doctoral" } });
    await expect(mocks.service.listUnresolvedTeachingSessions("doctoral")).rejects.toThrow("chưa được kích hoạt");
    expect(mocks.teachingSessions.findAll).not.toHaveBeenCalled();
  });

  it.each(["held", "not_held"] as const)("confirms a planned session as %s and records the acting Staff", async (status) => {
    const mocks = buildService();
    arrangeValid(mocks);
    const current = session({ sessionDate: "2000-09-12" });
    mocks.teachingSessions.findByPk.mockResolvedValue(current);

    await mocks.service.confirmTeachingSession(current.id, status, "staff-1");

    expect(current.update).toHaveBeenCalledWith(expect.objectContaining({
      status,
      confirmedAt: expect.any(Date),
      confirmedByStaffId: "staff-1",
    }), { transaction });
  });

  it("does not confirm a future planned session", async () => {
    const mocks = buildService();
    arrangeValid(mocks);
    const future = session();
    mocks.teachingSessions.findByPk.mockResolvedValue(future);

    await expectConflictCode(mocks.service.confirmTeachingSession(future.id, "held", "staff-1"), "SESSION_NOT_ENDED");
    expect(future.update).not.toHaveBeenCalled();
  });

  it("deletes only a planned session", async () => {
    const mocks = buildService();
    arrangeValid(mocks);
    const planned = session();
    mocks.teachingSessions.findByPk.mockResolvedValue(planned);
    await expect(mocks.service.deleteTeachingSession(planned.id)).resolves.toEqual({ id: planned.id, deleted: true });
    expect(planned.destroy).toHaveBeenCalledWith({ transaction });

    const held = session({ status: "held" });
    mocks.teachingSessions.findByPk.mockResolvedValue(held);
    await expect(mocks.service.deleteTeachingSession(held.id)).rejects.toThrow("trạng thái đã xếp");
    expect(held.destroy).not.toHaveBeenCalled();
  });

  it("keeps a disabled program outside session mutations", async () => {
    const mocks = buildService();
    arrangeValid(mocks);
    const planned = session();
    mocks.teachingSessions.findByPk.mockResolvedValue(planned);
    mocks.subjects.findByPk.mockResolvedValue({ ...subject, program: "doctoral" });

    await expect(mocks.service.deleteTeachingSession(planned.id)).rejects.toThrow("chưa được kích hoạt");
    expect(planned.destroy).not.toHaveBeenCalled();
  });

  it("keeps confirmed sessions read-only for normal updates", async () => {
    const mocks = buildService();
    mocks.teachingSessions.findByPk.mockResolvedValue(session({ status: "not_held" }));
    await expect(mocks.service.updateTeachingSession("session-1", { note: "Không được sửa" })).rejects.toThrow("trạng thái đã xếp");
  });

  it("keeps a past planned session pending and rejects normal update or deletion", async () => {
    const updateMocks = buildService();
    const pendingUpdate = session({ sessionDate: "2000-09-12" });
    updateMocks.teachingSessions.findByPk.mockResolvedValue(pendingUpdate);
    await expectConflictCode(updateMocks.service.updateTeachingSession(pendingUpdate.id, { note: "Không được sửa" }), "SESSION_ALREADY_ENDED");
    expect(pendingUpdate.update).not.toHaveBeenCalled();

    const deleteMocks = buildService();
    arrangeValid(deleteMocks);
    const pendingDelete = session({ sessionDate: "2000-09-12" });
    deleteMocks.teachingSessions.findByPk.mockResolvedValue(pendingDelete);
    await expectConflictCode(deleteMocks.service.deleteTeachingSession(pendingDelete.id), "SESSION_ALREADY_ENDED");
    expect(pendingDelete.destroy).not.toHaveBeenCalled();
  });

  it("completes manually after at least one held session and no planned session", async () => {
    const mocks = buildService();
    const persistedOffering = {
      ...offering(),
      subject,
      groupLinks: [],
      update: jest.fn().mockResolvedValue(undefined),
    };
    mocks.courseOfferings.findByPk.mockResolvedValue(persistedOffering);
    mocks.subjects.findByPk.mockResolvedValue(subject);
    mocks.teachingSessions.findAll.mockResolvedValue([session({ status: "held" })]);

    await mocks.service.completeCourseOffering(persistedOffering.id, "staff-1");

    expect(persistedOffering.update).toHaveBeenCalledWith(expect.objectContaining({
      status: "completed",
      completedAt: expect.any(Date),
      completedByStaffId: "staff-1",
    }), { transaction });
  });

  it("blocks completion when no session was confirmed as held", async () => {
    const mocks = buildService();
    mocks.courseOfferings.findByPk.mockResolvedValue({ ...offering(), update: jest.fn() });
    mocks.subjects.findByPk.mockResolvedValue(subject);
    mocks.teachingSessions.findAll.mockResolvedValue([]);
    await expectConflictCode(mocks.service.completeCourseOffering("offering-1", "staff-1"), "NO_HELD_SESSIONS");
  });

  it.each([
    ["future", "2999-09-12"],
    ["pending", "2000-09-12"],
  ])("blocks completion while a %s planned session remains unresolved", async (_kind, sessionDate) => {
    const mocks = buildService();
    mocks.courseOfferings.findByPk.mockResolvedValue({ ...offering(), update: jest.fn() });
    mocks.subjects.findByPk.mockResolvedValue(subject);
    mocks.teachingSessions.findAll.mockResolvedValue([
      session({ id: "held-session", status: "held" }),
      session({ id: "planned-session", status: "planned", sessionDate }),
    ]);
    await expectConflictCode(mocks.service.completeCourseOffering("offering-1", "staff-1"), "UNRESOLVED_SESSIONS");
  });
});
describe("Vietnam clock and period consistency", () => {
  it("formats an absolute instant without reading any server-local wall-clock getters", () => {
    const now = new Date("2026-09-05T03:30:00Z");
    for (const key of ["getFullYear", "getMonth", "getDate", "getHours", "getMinutes"]) {
      Object.defineProperty(now, key, { value: () => { throw new Error("Unexpected server-local date access"); } });
    }
    expect(new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" }).format(now)).toBe("03:30");
    expect(getBusinessWallTime(now)).toBe("2026-09-05 10:30:00");
    expect(getBusinessWallTime(new Date("2026-09-05T18:00:00Z"))).toBe("2026-09-06 01:00:00");
  });
  beforeEach(() => jest.useFakeTimers({ now: new Date("2026-09-05T03:30:00Z") }));
  afterEach(() => jest.useRealTimers());

  it.each([["10:20", true], ["10:45", false]])("compares end %s to Vietnam 10:30 from an absolute UTC instant", async (endTime, ended) => {
    const mocks = buildService();
    arrangeValid(mocks);
    const request = mocks.service.createTeachingSession(createDto({ sessionDate: "2026-09-05", startTime: "10:00", endTime }));
    if (ended) await expectConflictCode(request, "SESSION_TIME_IN_PAST");
    else await expect(request).resolves.toBeDefined();
  });

  it.each([
    ["MORNING", "08:00", "10:00"], ["MORNING", "10:00", "12:00"],
    ["MORNING", "00:00", "00:01"], ["AFTERNOON", "12:00", "14:00"],
    ["AFTERNOON", "19:00", "22:00"], ["AFTERNOON", "23:00", "23:59:59"],
  ])("allows %s %s–%s", async (period, startTime, endTime) => {
    const mocks = buildService();
    arrangeValid(mocks);
    await expect(mocks.service.createTeachingSession(createDto({ period, startTime, endTime }))).resolves.toBeDefined();
  });

  it.each([
    ["MORNING", "13:00", "15:00"], ["MORNING", "11:30", "13:00"],
    ["AFTERNOON", "09:57", "11:59"], ["AFTERNOON", "11:30", "13:00"],
    ["MORNING", "12:00", "12:01"], ["MORNING", "10:00", "12:00:01"],
  ])("rejects %s %s–%s on both create and update without a write", async (period, startTime, endTime) => {
    const mocks = buildService();
    arrangeValid(mocks);
    const persisted = session();
    mocks.teachingSessions.findByPk.mockResolvedValue(persisted);
    for (const request of [
      () => mocks.service.createTeachingSession(createDto({ period, startTime, endTime })),
      () => mocks.service.updateTeachingSession(persisted.id, { period, startTime, endTime }),
    ]) {
      try { await request(); throw new Error("Expected mismatch"); }
      catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getStatus()).toBe(400);
        expect((error as BadRequestException).getResponse()).toEqual({
          code: "PERIOD_TIME_MISMATCH",
          message: period === "MORNING" ? "Giờ học phải nằm trong khoảng Sáng 00:00–12:00." : "Giờ học phải nằm trong khoảng Chiều 12:00–23:59.",
          details: { period, startTime: startTime + ":00", endTime: endTime.length === 5 ? endTime + ":00" : endTime },
        });
      }
    }
    expect(mocks.teachingSessions.create).not.toHaveBeenCalled();
    expect(persisted.update).not.toHaveBeenCalled();
  });

  it("requires correcting historical period mismatch even on a note-only update", async () => {
    const mocks = buildService();
    arrangeValid(mocks);
    const persisted = session({ period: "AFTERNOON" });
    mocks.teachingSessions.findByPk.mockResolvedValue(persisted);
    await expect(mocks.service.updateTeachingSession(persisted.id, { note: "unchanged time" })).rejects.toBeInstanceOf(BadRequestException);
    expect(persisted.update).not.toHaveBeenCalled();
    await expect(mocks.service.updateTeachingSession(persisted.id, { period: "MORNING" })).resolves.toBeDefined();
  });
});
