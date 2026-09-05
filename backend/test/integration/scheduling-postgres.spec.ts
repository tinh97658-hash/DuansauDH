import { randomUUID } from "node:crypto";
import { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { getConnectionToken } from "@nestjs/sequelize";
import { Op } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { AppModule } from "../../src/app.module.js";
import { Lecturer } from "../../src/database/models/common/lecturer.model.js";
import { Major } from "../../src/database/models/common/major.model.js";
import { Room } from "../../src/database/models/common/room.model.js";
import { Subject } from "../../src/database/models/plan/subject.model.js";
import { ClassGroup } from "../../src/database/models/training/class-group.model.js";
import { CourseOfferingClassGroup } from "../../src/database/models/training/course-offering-class-group.model.js";
import { CourseOffering } from "../../src/database/models/training/course-offering.model.js";
import { TeachingSession } from "../../src/database/models/training/teaching-session.model.js";
import { SchedulingService } from "../../src/scheduling/scheduling.service.js";

const describePostgres = process.env.RUN_POSTGRES_SCHEDULING_TESTS === "true" ? describe : describe.skip;

describePostgres("Scheduling PostgreSQL locking", () => {
  let app: INestApplicationContext;
  let sequelize: Sequelize;
  let service: SchedulingService;
  const prefix = `T${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  const ids = {
    major: randomUUID(),
    subject: randomUUID(),
    group1: randomUUID(),
    group2: randomUUID(),
    offering1: randomUUID(),
    offering2: randomUUID(),
    room1: randomUUID(),
    room2: randomUUID(),
    lecturer1: randomUUID(),
    lecturer2: randomUUID(),
  };

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    sequelize = app.get<Sequelize>(getConnectionToken());
    service = app.get(SchedulingService);

    await Major.create({ id: ids.major, code: `${prefix}M`, name: `${prefix} Major`, program: "masters", active: true });
    await Subject.create({
      id: ids.subject,
      code: `${prefix}S`,
      codeNumber: 0,
      codeText: `${prefix}S`,
      name: `${prefix} Subject`,
      majorId: ids.major,
      program: "masters",
      active: true,
    });
    await Promise.all([
      ClassGroup.create({ id: ids.group1, code: `${prefix}G1`, name: `${prefix} Group 1`, majorId: ids.major, program: "masters" }),
      ClassGroup.create({ id: ids.group2, code: `${prefix}G2`, name: `${prefix} Group 2`, majorId: ids.major, program: "masters" }),
      Room.create({ id: ids.room1, code: `3${prefix}R1`, name: `${prefix} Room 1`, capacity: 100, isActive: true }),
      Room.create({ id: ids.room2, code: `4${prefix}R2`, name: `${prefix} Room 2`, capacity: 100, isActive: true }),
      Lecturer.create({ id: ids.lecturer1, code: `${prefix}L1`, name: `${prefix} Lecturer 1`, active: true }),
      Lecturer.create({ id: ids.lecturer2, code: `${prefix}L2`, name: `${prefix} Lecturer 2`, active: true }),
    ]);
    await Promise.all([
      CourseOffering.create({ id: ids.offering1, subjectId: ids.subject, status: "active" }),
      CourseOffering.create({ id: ids.offering2, subjectId: ids.subject, status: "active" }),
    ]);
    await Promise.all([
      CourseOfferingClassGroup.create({ courseOfferingId: ids.offering1, classGroupId: ids.group1 }),
      CourseOfferingClassGroup.create({ courseOfferingId: ids.offering2, classGroupId: ids.group2 }),
    ]);
  });

  afterEach(async () => {
    await TeachingSession.destroy({ where: { courseOfferingId: { [Op.in]: [ids.offering1, ids.offering2] } } });
  });

  afterAll(async () => {
    if (!sequelize) return;
    try {
      await TeachingSession.destroy({ where: { courseOfferingId: { [Op.in]: [ids.offering1, ids.offering2] } } });
      await CourseOfferingClassGroup.destroy({ where: { courseOfferingId: { [Op.in]: [ids.offering1, ids.offering2] } } });
      await CourseOffering.destroy({ where: { id: { [Op.in]: [ids.offering1, ids.offering2] } } });
      await ClassGroup.destroy({ where: { id: { [Op.in]: [ids.group1, ids.group2] } } });
      await Subject.destroy({ where: { id: ids.subject } });
      await Room.destroy({ where: { id: { [Op.in]: [ids.room1, ids.room2] } } });
      await Lecturer.destroy({ where: { id: { [Op.in]: [ids.lecturer1, ids.lecturer2] } } });
      await Major.destroy({ where: { id: ids.major } });
    } finally {
      await app?.close();
    }
  });

  it("persists and reloads a real TeachingSession", async () => {
    const created = await service.createTeachingSession({
      courseOfferingId: ids.offering1,
      sessionDate: "2098-09-12",
      startTime: "08:00",
      endTime: "10:00",
      period: "MORNING",
      lecturerId: ids.lecturer1,
      roomId: ids.room1,
    });

    const reloaded = await service.getTeachingSession(created.id);
    const listed = await service.listTeachingSessions({ from: "2098-09-12", to: "2098-09-12" });

    expect(reloaded.id).toBe(created.id);
    expect(reloaded.startTime).toBe("08:00:00");
    expect(listed.map((item) => item.id)).toContain(created.id);
  });

  it("serializes concurrent creates competing for the same Room", async () => {
    const results = await Promise.allSettled([
      service.createTeachingSession({
        courseOfferingId: ids.offering1,
        sessionDate: "2098-09-13",
        startTime: "08:00",
        endTime: "10:00",
        period: "MORNING",
        lecturerId: ids.lecturer1,
        roomId: ids.room1,
      }),
      service.createTeachingSession({
        courseOfferingId: ids.offering2,
        sessionDate: "2098-09-13",
        startTime: "09:00",
        endTime: "11:00",
        period: "MORNING",
        lecturerId: ids.lecturer2,
        roomId: ids.room1,
      }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.getResponse()).toEqual(expect.objectContaining({ code: "ROOM_CONFLICT" }));
    expect(await TeachingSession.count({ where: { sessionDate: "2098-09-13", roomId: ids.room1 } })).toBe(1);
  });

  it("serializes concurrent creates competing for the same Lecturer", async () => {
    const results = await Promise.allSettled([
      service.createTeachingSession({
        courseOfferingId: ids.offering1,
        sessionDate: "2098-09-14",
        startTime: "08:00",
        endTime: "10:00",
        period: "MORNING",
        lecturerId: ids.lecturer1,
        roomId: ids.room1,
      }),
      service.createTeachingSession({
        courseOfferingId: ids.offering2,
        sessionDate: "2098-09-14",
        startTime: "09:00",
        endTime: "11:00",
        period: "MORNING",
        lecturerId: ids.lecturer1,
        roomId: ids.room2,
      }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.getResponse()).toEqual(expect.objectContaining({ code: "LECTURER_CONFLICT" }));
    expect(await TeachingSession.count({ where: { sessionDate: "2098-09-14", lecturerId: ids.lecturer1 } })).toBe(1);
  });
});
