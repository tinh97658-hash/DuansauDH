import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { RbacService } from "../../src/auth/rbac.service.js";
import { Staff } from "../../src/database/models/staff.model.js";
import { Student } from "../../src/database/models/student.model.js";
import { PlanController } from "../../src/plan/plan.controller.js";
import { PlanService } from "../../src/plan/plan.service.js";
import { CurriculumService } from "../../src/plan/curriculum.service.js";
import { MajorTransferService } from "../../src/plan/major-transfer.service.js";
import { SubjectRecognitionService } from "../../src/plan/subject-recognition.service.js";
import { AdmissionEvaluationController } from "../../src/plan/admission-evaluation.controller.js";
import { AdmissionEvaluationService } from "../../src/plan/admission-evaluation.service.js";
import { StudyLeaveController } from "../../src/plan/study-leave.controller.js";
import { StudyLeaveService } from "../../src/plan/study-leave.service.js";
import { SystemController } from "../../src/system/system.controller.js";
import { SystemService } from "../../src/system/system.service.js";

describe("Batch C domain authorization with real HTTP guards", () => {
  let app: INestApplication, user: any;
  let permissions: Set<string>;
  const id = randomUUID();
  const calls = jest.fn().mockResolvedValue([]);
  const service = new Proxy({}, { get: (_target, key) => typeof key === "string" && !["then", "onModuleInit", "onApplicationBootstrap", "onModuleDestroy", "beforeApplicationShutdown", "onApplicationShutdown"].includes(key) ? calls : undefined });
  const rooms = jest.fn().mockResolvedValue([]);
  const catalogs = ["ethnicities", "nationalities", "cities", "districts", "wards", "units", "lecturers", "majors", "training-levels", "training-mode-groups", "training-modes", "disciplines", "study-statuses", "bridge-knowledge", "rooms"];
  const admission = ["admission-records", `admission-records/${id}`, ...["learning-results", "major-transfers", "subject-recognitions", "studied-subjects", "recognized-credits", "evaluation"].map(s => `admission-records/${id}/${s}`), "admission-rounds", `admission-rounds/${id}/ranking`, "admission-targets"];
  const planning = ["training-plan", "subjects", "classes", "curriculums", `curriculums/${id}`, `classes/${id}/subjects`, "annual-fees"];
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PlanController, AdmissionEvaluationController, StudyLeaveController, SystemController],
      providers: [
        { provide: RbacService, useValue: { effectiveAccess: async () => ({ permissions }) } },
        ...[PlanService, CurriculumService, MajorTransferService, SubjectRecognitionService, AdmissionEvaluationService, StudyLeaveService].map(provide => ({ provide, useValue: service })),
        { provide: SystemService, useValue: new Proxy(service, { get: (t, key) => key === "listRooms" ? rooms : Reflect.get(t, key) }) },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((req: any, _res: any, next: any) => { req.user = user; req.isAuthenticated = () => !!user; next(); });
    await app.init();
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => {
    user = Object.defineProperties(Object.create(Staff.prototype), { id: { value: id }, mustChangePassword: { value: false } });
    permissions = new Set();jest.clearAllMocks();
  });
  for (const values of [["admission.view"], ["plan.view"], ["admission.view", "plan.view"], []]) {
    describe(`domain matrix: ${values.join("+") || "neither"}`, () => {
      beforeEach(() => { permissions = new Set(values); });
      it.each(admission)("admission-owned GET /plan/%s", async route => {
        const allowed = permissions.has("admission.view");
        await request(app.getHttpServer()).get("/plan/" + route).expect(allowed ? 200 : 403);
        expect(calls).toHaveBeenCalledTimes(allowed ? 1 : 0);
      });
      it.each(planning)("planning GET /plan/%s", async route => {
        const allowed = permissions.has("plan.view");
        await request(app.getHttpServer()).get("/plan/" + route).expect(allowed ? 200 : 403);
        expect(calls).toHaveBeenCalledTimes(allowed ? 1 : 0);
      });
      it.each(["study-leaves", `admission-records/${id}/study-leaves`])("keeps lifecycle GET %s on plan.view", async route => {
        await request(app.getHttpServer()).get("/plan/" + route).expect(permissions.has("plan.view") ? 200 : 403);
      });
    });
  }
  it.each(catalogs)("authenticated catalog read /system/%s needs no catalog permission", async route => {
    await request(app.getHttpServer()).get("/system/" + route).expect(200);
  });
  it.each(catalogs)("anonymous catalog read /system/%s denied", async route => {
    user = null;await request(app.getHttpServer()).get("/system/" + route).expect(401);
    expect(calls).not.toHaveBeenCalled();expect(rooms).not.toHaveBeenCalled();
  });
  it("preserves authenticated Student catalog access, denying protected domains and expanded rooms", async () => {
    user = Object.create(Student.prototype);
    for (const route of catalogs) await request(app.getHttpServer()).get("/system/" + route).expect(200);
    await request(app.getHttpServer()).get("/system/rooms?includeInactive=true").expect(403);
    await request(app.getHttpServer()).get("/plan/admission-records").expect(403);
  });
  it("requires catalog.manage for expanded rooms, independently of catalog.view", async () => {
    for (const values of [[], ["catalog.view"], ["catalog.manage"]]) {
      permissions = new Set(values);rooms.mockClear();
      await request(app.getHttpServer()).get("/system/rooms?includeInactive=true").expect(permissions.has("catalog.manage") ? 200 : 403);
      if(permissions.has("catalog.manage")) expect(rooms).toHaveBeenCalledWith(true);else expect(rooms).not.toHaveBeenCalled();
    }
    rooms.mockClear();permissions.clear();
    await request(app.getHttpServer()).get("/system/rooms").expect(200);expect(rooms).toHaveBeenCalledWith(false);
  });
  it.each([["post", "/system/ethnicities"], ["put", `/system/ethnicities/${id}`], ["delete", `/system/ethnicities/${id}`], ["post", "/system/rooms"], ["put", `/system/rooms/${id}`]])("catalog %s %s still requires catalog.manage", async (method, route) => {
    for (const allowed of [false, true]) {
      permissions = new Set(allowed ? ["catalog.manage"] : ["catalog.view"]);
      await (request(app.getHttpServer()) as any)[method](route).send({ code: "QA", name: "QA" }).expect(allowed ? method === "post" ? 201 : 200 : 403);
    }
  });
  it("does not let read permissions authorize admission mutations", async () => {
    permissions = new Set(["admission.view", "plan.view"]);
    await request(app.getHttpServer()).post("/plan/admission-records").send({}).expect(403);
    permissions = new Set(["admission.manage"]);
    await request(app.getHttpServer()).post("/plan/admission-records").send({}).expect(201);
  });
});
