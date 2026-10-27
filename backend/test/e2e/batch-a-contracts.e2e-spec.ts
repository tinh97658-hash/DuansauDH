import { GroupResponsibilityService } from "../../src/auth/group-responsibility.service.js";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AccountsController } from "../../src/accounts/accounts.controller.js";
import { AccountsService } from "../../src/accounts/accounts.service.js";
import { RbacService } from "../../src/auth/rbac.service.js";
import { Staff } from "../../src/database/models/staff.model.js";
import { Student } from "../../src/database/models/student.model.js";
import { MastersController } from "../../src/masters/masters.controller.js";
import { MastersService } from "../../src/masters/masters.service.js";
import { ExamGradebookService } from "../../src/masters/exam-gradebook.service.js";
import { GradingPolicyService } from "../../src/masters/grading-policy.service.js";
import { ExamScheduleService } from '../../src/masters/exam-schedule.service.js';
import { AdmissionEvaluationService } from "../../src/plan/admission-evaluation.service.js";
import { RolesController } from "../../src/roles/roles.controller.js";
import { RolesService } from "../../src/roles/roles.service.js";

describe("Batch A API contracts with real guards and ValidationPipe", () => {
  let app: INestApplication;
  let user: any;
  let permissions: Set<string>;
  const offering = { findByPk: jest.fn().mockResolvedValue(null) };
  const sequelize: any = { query: jest.fn().mockResolvedValue([]), transaction: jest.fn((fn: any) => fn({ LOCK: { UPDATE: "UPDATE" } })) };
  const rbac: any = { effectiveAccess: jest.fn(async () => ({ permissions })) };
  const workflow = new ExamGradebookService({} as any, {} as any, offering as any, {} as any, {} as any, sequelize, undefined, rbac);
  const accounts = { create: jest.fn(async (_id, dto) => dto), update: jest.fn(async (_actor, _id, dto) => dto) };
  const roles = { create: jest.fn(async (_id, dto) => dto), update: jest.fn(async (_actor, _id, dto) => dto) };
  const policy = { save: jest.fn().mockResolvedValue([]), shared: jest.fn().mockResolvedValue({ version: 0 }) };
  const examSchedule={list:jest.fn().mockResolvedValue({queue:[],sessions:[],rooms:[]}),schedule:jest.fn().mockResolvedValue({id:'scheduled'}),reschedule:jest.fn().mockResolvedValue({}),cancel:jest.fn().mockResolvedValue({}),confirm:jest.fn().mockResolvedValue({})};
  const id = randomUUID();
  const workflowBody = { classGroupId: randomUUID(), courseOfferingId: randomUUID(), revision: 0, version: 0, note: "Safe absent-target authorization check" };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MastersController, AccountsController, RolesController],
      providers: [
        { provide: GroupResponsibilityService, useValue: { forCreation: jest.fn(async (actor: any, requestedId?: string) => requestedId || actor.id) } },
        { provide: RbacService, useValue: rbac },
        { provide: MastersService, useValue: {} },
        { provide: ExamGradebookService, useValue: workflow },
        { provide: GradingPolicyService, useValue: policy },
        { provide: ExamScheduleService, useValue: examSchedule },
        { provide: AdmissionEvaluationService, useValue: {} },
        { provide: AccountsService, useValue: accounts },
        { provide: RolesService, useValue: roles },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((req: any, _res: any, next: () => void) => { req.user = user; req.isAuthenticated = () => !!user; next(); });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
    await app.init();
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => {
    user = Object.defineProperties(Object.create(Staff.prototype), { id: { value: id }, mustChangePassword: { value: false, writable: true } });
    permissions = new Set();
    jest.clearAllMocks();
  });

  describe("Workflow permission matrix", () => {
    const capabilities = [
      { name: "submit only", values: ["gradebook.submit"] },
      { name: "approve only", values: ["gradebook.approve"] },
      { name: "both", values: ["gradebook.submit", "gradebook.approve"] },
      { name: "neither", values: [] },
    ];
    for (const phase of ['eligibility','final']) for (const capability of capabilities) {
      it.each(["submit", "approve", "reopen"])(`${capability.name}: %s uses its own permission`, async action => {
        permissions = new Set(capability.values);
        const allowed = permissions.has(action === "submit" ? "gradebook.submit" : "gradebook.approve");
        await request(app.getHttpServer()).post(`/masters/exam-lists/${phase}/workflow`).send({ ...workflowBody, action }).expect(allowed ? 404 : 403);
        expect(offering.findByPk).toHaveBeenCalledTimes(allowed ? 1 : 0);
      });
    }
    it("rejects anonymous, Student and forced-password access before domain work", async () => {
      permissions = new Set(["gradebook.approve"]);
      user = null;
      await request(app.getHttpServer()).post("/masters/exam-lists/workflow").send({ ...workflowBody, action: "approve" }).expect(401);
      user = Object.create(Student.prototype);
      await request(app.getHttpServer()).post("/masters/exam-lists/workflow").send({ ...workflowBody, action: "approve" }).expect(403);
      user = Object.defineProperty(Object.create(Staff.prototype), "mustChangePassword", { value: true });
      await request(app.getHttpServer()).post("/masters/exam-lists/workflow").send({ ...workflowBody, action: "approve" }).expect(403);
      expect(offering.findByPk).not.toHaveBeenCalled();
    });
    it.each([undefined, "unknown", "toString", {}, ["approve"]])("rejects malformed action %p without domain work", async action => {
      permissions = new Set(["gradebook.submit", "gradebook.approve"]);
      await request(app.getHttpServer()).post("/masters/exam-lists/workflow").send({ ...workflowBody, action }).expect(400);
      expect(offering.findByPk).not.toHaveBeenCalled();
    });
  });

  describe('Exam schedule API permissions and validation',()=>{
    const valid={courseOfferingId:randomUUID(),snapshotId:randomUUID(),eligibilityVersion:2,examDate:'2099-05-04',startTime:'08:00',endTime:'10:00',roomId:randomUUID(),lecturerId:randomUUID()};
    it.each(['gradebook.view','scheduling.write','gradebook.submit','gradebook.approve'])('read with %s is independent of mutation ownership',async permission=>{
      permissions=new Set([permission]);await request(app.getHttpServer()).get('/masters/exam-schedule?from=2099-05-01&to=2099-05-07').expect(permission==='gradebook.view'?200:403);
    });
    it.each(['scheduling.write','gradebook.view','gradebook.submit','gradebook.approve'])('mutations require scheduling.write, given %s',async permission=>{
      permissions=new Set([permission]);const allowed=permission==='scheduling.write';
      await request(app.getHttpServer()).post('/masters/exam-sessions').send(valid).expect(allowed?201:403);
      await request(app.getHttpServer()).put(`/masters/exam-sessions/${id}`).send({...valid,version:0}).expect(allowed?200:403);
      await request(app.getHttpServer()).post(`/masters/exam-sessions/${id}/cancel`).send({version:0,note:'QA'}).expect(allowed?201:403);
      await request(app.getHttpServer()).post(`/masters/exam-sessions/${id}/confirm`).send({version:0,note:'QA',status:'held'}).expect(allowed?201:403);
    });
    it.each([{examDate:'2026-02-30'},{examDate:'0000-01-01'},{startTime:'24:00'},{endTime:'10:70'},{snapshotId:'wrong'},{eligibilityVersion:-1},{lecturerId:undefined},{lecturerId:'wrong'}])('rejects invalid scheduling fields %p before service',async patch=>{
      permissions=new Set(['scheduling.write']);await request(app.getHttpServer()).post('/masters/exam-sessions').send({...valid,...patch}).expect(400);expect(examSchedule.schedule).not.toHaveBeenCalled();
    });
    it('rejects invalid confirmation decisions and IDs',async()=>{
      permissions=new Set(['scheduling.write']);await request(app.getHttpServer()).post(`/masters/exam-sessions/${id}/confirm`).send({version:0,note:'QA',status:'completed'}).expect(400);
      await request(app.getHttpServer()).post('/masters/exam-sessions/not-a-uuid/cancel').send({version:0,note:'QA'}).expect(400);
    });
    it('rejects client-supplied candidate identities on create and edit before service',async()=>{
      permissions=new Set(['scheduling.write']);
      await request(app.getHttpServer()).post('/masters/exam-sessions').send({...valid,candidateIds:['student:'+randomUUID()]}).expect(400);
      await request(app.getHttpServer()).put(`/masters/exam-sessions/${id}`).send({...valid,version:0,candidateIds:[]}).expect(400);
      expect(examSchedule.schedule).not.toHaveBeenCalled();expect(examSchedule.reschedule).not.toHaveBeenCalled();
    });
  });

  it.each([
    ["gradebook.policy", 200], ["gradebook.submit", 403], ["gradebook.approve", 403], ["gradebook.view", 403],
  ] as const)("policy PUT with %s returns %s", async (permission, status) => {
    permissions = new Set([permission]);
    await request(app.getHttpServer()).put("/masters/grading-policies").send({ rows: [] }).expect(status);
    expect(policy.save).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
  });
  it("keeps policy read permission unchanged", async () => {
    permissions = new Set(["gradebook.policy"]);
    await request(app.getHttpServer()).get("/masters/grading-rules").expect(403);
    permissions.add("masters.view");
    await request(app.getHttpServer()).get("/masters/grading-rules").expect(200);
  });

  describe("Normalized required fields", () => {
    beforeEach(() => { permissions = new Set(["account.manage", "role.manage"]); });
    const validAccount = { name: "Nguyễn Văn A", email: "qa@example.invalid", roleIds: [id] };
    const validRole = { name: "QA role", code: "qa-role" };
    const cases = [
      { method: "post", route: "/accounts", valid: validAccount, field: "name", handler: accounts.create },
      { method: "put", route: `/accounts/${id}`, valid: { name: "QA" }, field: "name", handler: accounts.update },
      { method: "post", route: "/roles", valid: validRole, field: "code", handler: roles.create },
      { method: "post", route: "/roles", valid: validRole, field: "name", handler: roles.create },
      { method: "put", route: `/roles/${id}`, valid: { name: "QA" }, field: "name", handler: roles.update },
    ];
    for (const test of cases) {
      it.each(["", "   ", null, 123])(`${test.method} ${test.route} rejects ${test.field}=%p before persistence`, async value => {
        await (request(app.getHttpServer()) as any)[test.method](test.route).send({ ...test.valid, [test.field]: value }).expect(400);
        expect(test.handler).not.toHaveBeenCalled();
      });
    }
    it("passes the normalized account name and email to persistence", async () => {
      const r = await request(app.getHttpServer()).post("/accounts").send({ ...validAccount, name: "  Nguyễn Văn A  ", email: " QA@EXAMPLE.INVALID " }).expect(201);
      expect(r.body).toMatchObject({ name: "Nguyễn Văn A", email: "qa@example.invalid" });
      await request(app.getHttpServer()).put(`/accounts/${id}`).send({ name: "  Nguyễn Văn A  " }).expect(200);
      expect(accounts.update).toHaveBeenCalledWith(id, id, expect.objectContaining({ name: "Nguyễn Văn A" }), expect.anything());
    });
    it.each([undefined, "", "   "])("preserves optional description %p and trims required role fields", async description => {
      const r = await request(app.getHttpServer()).post("/roles").send({ code: "  QA-ROLE  ", name: "  QA role  ", description }).expect(201);
      expect(r.body).toMatchObject({ code: "qa-role", name: "QA role" });
      await request(app.getHttpServer()).put(`/roles/${id}`).send({ description }).expect(200);
    });
    it("allows omitted update names without adding a role-code update path", async () => {
      await request(app.getHttpServer()).put(`/accounts/${id}`).send({}).expect(200);
      const r = await request(app.getHttpServer()).put(`/roles/${id}`).send({ description: "optional", code: "ignored" }).expect(200);
      expect(r.body).not.toHaveProperty("code");
    });
    it.each(["invalid-email", "   "])("continues rejecting malformed email %p", async email => {
      await request(app.getHttpServer()).post("/accounts").send({ ...validAccount, email }).expect(400);
      expect(accounts.create).not.toHaveBeenCalled();
    });
  });
});
