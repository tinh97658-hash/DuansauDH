import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { RbacService } from "../../src/auth/rbac.service.js";
import { Staff } from "../../src/database/models/staff.model.js";
import { SchedulingController } from "../../src/scheduling/scheduling.controller.js";
import { SchedulingService } from "../../src/scheduling/scheduling.service.js";

describe("Direct teaching-session API cannot bypass the server start cutoff", () => {
  let app: INestApplication;
  const id = randomUUID();
  const write = jest.fn();
  const tx = { LOCK: { UPDATE: "UPDATE" } };
  const service = Object.assign(Object.create(SchedulingService.prototype), {
    sequelize: { transaction: (fn: any) => fn(tx), query: async () => [] },
    teachingSessions: { create: write, findByPk: async () => ({ id, status: "planned", sessionDate: "2026-10-21", startTime: "07:00:00", endTime: "12:00:00", period: "MORNING", update: write }) },
  });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [SchedulingController], providers: [
      { provide: SchedulingService, useValue: service }, { provide: RbacService, useValue: { effectiveAccess: async () => ({ permissions: new Set(["scheduling.write"]) }) } },
    ] }).compile();
    app = module.createNestApplication();app.use((req: any, _res: any, next: any) => {
      req.user = Object.defineProperties(Object.create(Staff.prototype), { canManageScheduling: { value: false }, mustChangePassword: { value: false } });req.isAuthenticated = () => true;next();
    });app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));await app.init();
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => { jest.useFakeTimers({ now: new Date("2026-10-20T09:55:00Z"), doNotFake: ["nextTick", "setImmediate"] });write.mockClear(); });
  afterEach(() => { jest.useRealTimers(); });
  it.each(["post", "put"])("rejects direct %s into today's started afternoon despite client-supplied clock fields", async method => {
    const body = { courseOfferingId: randomUUID(), lecturerId: randomUUID(), roomId: randomUUID(), sessionDate: "2026-10-20", startTime: "13:00", endTime: "17:00", period: "AFTERNOON", now: "2000-01-01", timezone: "Pacific/Honolulu" };
    const result = await (request(app.getHttpServer()) as any)[method]("/scheduling/teaching-sessions" + (method === "put" ? "/" + id : "")).send(body).expect(409);
    expect(result.body.code).toBe("SESSION_TIME_IN_PAST");expect(write).not.toHaveBeenCalled();
  });
});
