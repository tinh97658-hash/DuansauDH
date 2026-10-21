import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { getConnectionToken } from "@nestjs/sequelize";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { QueryTypes } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import request from "supertest";
import { AppModule } from "../../src/app.module.js";
import { AuditContext, AuditContextService } from "../../src/audit/audit-context.js";
import { Ethnicity } from "../../src/database/models/common/ethnicity.model.js";
import { Staff } from "../../src/database/models/staff.model.js";

const describeDb = process.env.RUN_POSTGRES_AUDIT_TESTS === "true" ? describe : describe.skip;

describeDb("Audit actor propagation with real PostgreSQL, HTTP and connection pooling", () => {
  let app: INestApplication;
  let db: Sequelize;
  let context: AuditContextService;
  let agentA: any;
  let agentB: any;
  let beforeIdentity: any;
  const ids = { staff: [randomUUID(), randomUUID(), randomUUID()], role: randomUUID(), student: randomUUID(), ethnicities: [] as string[] };
  const prefix = `QA-AUDIT-${randomUUID().slice(0, 8)}`;
  const emailA = `${prefix}-a@example.invalid`.toLowerCase();
  const emailB = `${prefix}-b@example.invalid`.toLowerCase();
  const password = "Disposable-audit-password";
  const actor = (index = 0): AuditContext => ({ actorStaffId: ids.staff[index], actorEmail: index === 0 ? emailA : emailB, requestId: `${prefix}-${randomUUID()}`, ip: "127.0.0.1", userAgent: "qa-audit-integration" });
  const select = (sql: string, replacements: any = {}) => db.query(sql, { type: QueryTypes.SELECT, replacements }) as Promise<any[]>;
  const fresh = () => { const id = randomUUID(); ids.ethnicities.push(id); return { id, code: "QA" + id.replace(/-/g, "").slice(0, 12), name: prefix }; };
  const auditRows = (id: string) => select("SELECT * FROM db_change_logs WHERE table_name='ethnicities' AND row_pk::jsonb->>'id'=:id ORDER BY id", { id });
  const identitySnapshot = () => select(`SELECT 'staff' AS source,md5(coalesce(jsonb_agg(to_jsonb(s) ORDER BY id)::text,'')) AS value FROM staff s
    UNION ALL SELECT 'roles',md5(coalesce(jsonb_agg(to_jsonb(r) ORDER BY id)::text,'')) FROM roles r ORDER BY source`);
  const expectActor = (row: any, index: number, requestId: string) => {
    expect(row).toMatchObject({ actor_staff_id: ids.staff[index], actor_email: index === 0 ? emailA : emailB, request_id: requestId, user_agent: "qa-audit-integration" });
    expect(row.ip).toBeTruthy();
  };

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.DB_POOL_MAX = "1";
    process.env.DB_POOL_MIN = "0";
    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
    await app.init();
    db = app.get(getConnectionToken());
    context = app.get(AuditContextService);
    beforeIdentity = await identitySnapshot();
    await select("INSERT INTO roles(id,code,name,active,is_system,created_at,updated_at) VALUES(:id,:code,:code,true,false,now(),now())", { id: ids.role, code: prefix.toLowerCase() });
    await select("INSERT INTO role_permissions(role_id,permission_id,created_at,updated_at) SELECT :id,id,now(),now() FROM permissions WHERE code IN ('catalog.manage','account.manage','account.view','account.password.reset')", { id: ids.role });
    const hash = await bcrypt.hash(password, 4);
    for (const [index, id] of ids.staff.entries()) {
      await select("INSERT INTO staff(id,name,email,role,password,status,must_change_password,created_at,updated_at) VALUES(:id,:name,:email,:role,:hash,'active',false,now(),now())", { id, name: `${prefix} ${index}`, email: index === 0 ? emailA : index === 1 ? emailB : `${prefix}-target@example.invalid`.toLowerCase(), role: prefix.toLowerCase(), hash });
      await select("INSERT INTO staff_roles(staff_id,role_id,created_at,updated_at) VALUES(:id,:role,now(),now())", { id, role: ids.role });
    }
    agentA = request.agent(app.getHttpServer());
    agentB = request.agent(app.getHttpServer());
    await agentA.post("/user/login").set("x-request-id", prefix + "-login-a").set("user-agent", "qa-audit-integration").send({ email: emailA, password }).expect(200);
    await agentB.post("/user/login").set("x-request-id", prefix + "-login-b").set("user-agent", "qa-audit-integration").send({ email: emailB, password }).expect(200);
  }, 30000);

  afterAll(async () => {
    if (db) {
      await select("DELETE FROM ethnicities WHERE id IN (:ids)", { ids: ids.ethnicities.length ? ids.ethnicities : [randomUUID()] });
      await select("DELETE FROM sessions WHERE data::jsonb #>> '{passport,user}' LIKE ANY(ARRAY[:patterns]::text[])", { patterns: [...ids.staff.map(id => `staff:${id}:%`), `student:${ids.student}`] });
      await select("DELETE FROM students WHERE id=:id", { id: ids.student });
      await select("DELETE FROM staff_roles WHERE staff_id IN (:ids)", { ids: ids.staff });
      await select("DELETE FROM staff WHERE id IN (:ids)", { ids: ids.staff });
      await select("DELETE FROM roles WHERE id=:id", { id: ids.role });
      expect(await identitySnapshot()).toEqual(beforeIdentity);
    }
    await app?.close();
  });

  it("captures authenticated catalog CREATE, UPDATE and DELETE without service-specific transaction changes", async () => {
    const value = fresh();
    const createId = prefix + "-create", updateId = prefix + "-update", deleteId = prefix + "-delete";
    await agentA.post("/system/ethnicities").set("x-request-id", createId).set("user-agent", "qa-audit-integration").send(value).expect(201).then((r: any) => { ids.ethnicities.push(r.body.id); value.id = r.body.id; });
    await agentA.put(`/system/ethnicities/${value.id}`).set("x-request-id", updateId).set("user-agent", "qa-audit-integration").send({ name: prefix + " updated" }).expect(200);
    await agentA.delete(`/system/ethnicities/${value.id}`).set("x-request-id", deleteId).set("user-agent", "qa-audit-integration").expect(200);
    const rows = await auditRows(value.id);
    expect(rows.map(row => row.operation)).toEqual(["INSERT", "UPDATE", "DELETE"]);
    rows.forEach((row, index) => expectActor(row, 0, [createId, updateId, deleteId][index]));
  });

  it("attributes the last-login update to the Staff only after successful authentication", async () => {
    for (const index of [0, 1]) {
      const requestId = prefix + (index === 0 ? "-login-a" : "-login-b");
      const rows = await select("SELECT * FROM db_change_logs WHERE table_name='staff' AND request_id=:requestId", { requestId });
      expect(rows).toHaveLength(1);
      expect(rows[0].changed_columns).toContain("last_login_at");
      expectActor(rows[0], index, requestId);
      expect(rows[0].new_data.password).toBe("[REDACTED]");
      const semantic = await select("SELECT actor_staff_id FROM auth_audit_logs WHERE action='account.login' AND target_staff_id=:id", { id: ids.staff[index] });
      expect(semantic.some(row => row.actor_staff_id === ids.staff[index])).toBe(true);
    }
  });

  it("generates correlation IDs for requests without x-request-id", async () => {
    const value = fresh();
    const response = await agentA.post("/system/ethnicities").send(value).expect(201);
    ids.ethnicities.push(response.body.id);
    const [row] = await auditRows(response.body.id);
    expect(row.actor_staff_id).toBe(ids.staff[0]);
    expect(row.request_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("preserves the existing transactional account-update actor and request ID", async () => {
    const requestId = prefix + "-account-update";
    await agentA.put(`/accounts/${ids.staff[2]}`).set("x-request-id", requestId).set("user-agent", "qa-audit-integration").send({ name: prefix + " renamed" }).expect(200);
    const rows = await select("SELECT * FROM db_change_logs WHERE table_name='staff' AND request_id=:requestId", { requestId });
    expect(rows).toHaveLength(1); expectActor(rows[0], 0, requestId);
  });

  it("attributes password resets and session revocation that previously used autocommit", async () => {
    for (const action of ["reset-password", "revoke-sessions"]) {
      const requestId = prefix + "-" + action;
      await agentA.post(`/accounts/${ids.staff[2]}/${action}`).set("x-request-id", requestId).set("user-agent", "qa-audit-integration").send(action === "reset-password" ? { password: "New-disposable-password" } : {}).expect(201);
      const rows = await select("SELECT * FROM db_change_logs WHERE table_name='staff' AND request_id=:requestId", { requestId });
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach(row => expectActor(row, 0, requestId));
      rows.forEach(row => expect(row.new_data.password).toBe("[REDACTED]"));
    }
  });

  it("attributes own password change, retains semantic audit and redacts the full row", async () => {
    const requestId = prefix + "-own-password";
    await agentA.patch("/accounts/me/password").set("x-request-id", requestId).set("user-agent", "qa-audit-integration").send({ currentPassword: password, newPassword: "Changed-disposable-password" }).expect(200);
    const [row] = await select("SELECT * FROM db_change_logs WHERE table_name='staff' AND request_id=:requestId", { requestId });
    expectActor(row, 0, requestId);
    expect(row.changed_columns).toContain("password");
    expect(row.old_data.password).toBe("[REDACTED]"); expect(row.new_data.password).toBe("[REDACTED]");
    const semantic = await select("SELECT actor_staff_id FROM auth_audit_logs WHERE action='account.password.change' AND target_staff_id=:id", { id: ids.staff[0] });
    expect(semantic).toEqual([{ actor_staff_id: ids.staff[0] }]);
  });

  it("isolates concurrent authenticated HTTP requests waiting for a single pool connection", async () => {
    const a = fresh(), b = fresh();
    const requests = [prefix + "-concurrent-a", prefix + "-concurrent-b"];
    const responses = await Promise.all([agentA, agentB].map((agent, i) => agent.post("/system/ethnicities").set("x-request-id", requests[i]).set("user-agent", "qa-audit-integration").send(i === 0 ? a : b).expect(201)));
    for (const [index, response] of responses.entries()) {
      ids.ethnicities.push(response.body.id);
      const [row] = await auditRows(response.body.id);
      expectActor(row, index, requests[index]);
    }
  });

  it("never carries a Staff actor into a system write on the same PostgreSQL backend", async () => {
    const a = fresh(), system = fresh(); const ctx = actor();
    const sql = "INSERT INTO ethnicities(id,code,name,created_at,updated_at) VALUES(:id,:code,:name,now(),now()) RETURNING id,pg_backend_pid() AS pid";
    const [first] = await context.run(ctx, () => select(sql, a));
    const [second] = await select(sql, system);
    expect(second.pid).toBe(first.pid);
    const [staffRow] = await auditRows(a.id), [systemRow] = await auditRows(system.id);
    expectActor(staffRow, 0, ctx.requestId);
    expect(systemRow).toMatchObject({ actor_staff_id: null, actor_email: null, request_id: null, ip: null, user_agent: null });
  });

  it("retains Student self-service correlation without inventing a Staff actor", async () => {
    const email = `${prefix}-student@example.invalid`.toLowerCase();
    await select("INSERT INTO students(id,name_with_initials,full_name,postal_address,email,tel_no,password,account_type,approval_state,created_at,updated_at) VALUES(:id,'QA',:name,'QA',:email,'000',:hash,'registered','approved',now(),now())", { id: ids.student, name: prefix, email, hash: await bcrypt.hash(password, 4) });
    const student = request.agent(app.getHttpServer());
    await student.post("/user/login").send({ email, password }).expect(200);
    const requestId = prefix + "-student-password";
    await student.patch("/user/updatePassword").set("x-request-id", requestId).send({ passwordCurrent: password, password: "Changed-student-password" }).expect(200);
    const [row] = await select("SELECT * FROM db_change_logs WHERE table_name='students' AND request_id=:requestId", { requestId });
    expect(row).toMatchObject({ actor_staff_id: null, actor_email: null, request_id: requestId });
    expect(row.new_data.password).toBe("[REDACTED]");
  });

  it("rolls back an explicit multi-write transaction after a later error, including audit history", async () => {
    const a = fresh(), b = fresh();
    await expect(context.run(actor(), () => db.transaction(async transaction => {
      await Ethnicity.create(a, { transaction }); await Ethnicity.create(b, { transaction });
      throw new Error("later failure");
    }))).rejects.toThrow("later failure");
    expect(await Ethnicity.count({ where: { id: [a.id, b.id] } })).toBe(0);
    expect(await auditRows(a.id)).toEqual([]); expect(await auditRows(b.id)).toEqual([]);
  });

  it("rolls back the automatic write transaction if a later query hook throws", async () => {
    const value = fresh(); let observedBeforeError = false;
    db.addHook("afterQuery", "qa-audit-error", async (options: any) => {
      if (options.type === QueryTypes.INSERT && options.instance?.id === value.id) {
        const rows = await db.query("SELECT id FROM ethnicities WHERE id=:id", { replacements: { id: value.id }, type: QueryTypes.SELECT, transaction: options.transaction });
        observedBeforeError = rows.length === 1;
        throw new Error("after DML failure");
      }
    });
    try {
      await expect(context.run(actor(), () => Ethnicity.create(value))).rejects.toThrow("after DML failure");
    } finally { db.removeHook("afterQuery", "qa-audit-error"); }
    expect(observedBeforeError).toBe(true);
    expect(await Ethnicity.count({ where: { id: value.id } })).toBe(0);
    expect(await auditRows(value.id)).toEqual([]);
  });

  it("preserves unmanaged transactions and nested savepoint commit/rollback context", async () => {
    const manual = fresh(); const ctx = actor();
    const transaction = await db.transaction();
    try { await context.run(ctx, () => Ethnicity.create(manual, { transaction })); await transaction.commit(); }
    catch (error) { await transaction.rollback(); throw error; }
    expectActor((await auditRows(manual.id))[0], 0, ctx.requestId);
    const parent = fresh(), child = fresh(), aborted = fresh(), after = fresh();
    const childCtx = actor(1);
    await context.run(ctx, () => db.transaction(async outer => {
      await Ethnicity.create(parent, { transaction: outer });
      await expect(context.run(childCtx, () => db.transaction({ transaction: outer }, async inner => {
        await Ethnicity.create(aborted, { transaction: inner }); throw new Error("savepoint failure");
      }))).rejects.toThrow("savepoint failure");
      await context.run(childCtx, () => db.transaction({ transaction: outer }, async inner => { await Ethnicity.create(child, { transaction: inner }); }));
      await Ethnicity.create(after, { transaction: outer });
    }));
    expectActor((await auditRows(parent.id))[0], 0, ctx.requestId);
    expectActor((await auditRows(child.id))[0], 1, childCtx.requestId);
    expectActor((await auditRows(after.id))[0], 0, ctx.requestId);
    expect(await auditRows(aborted.id)).toEqual([]);
  });

  it("keeps two overlapping DB transactions on separate pool connections correctly attributed", async () => {
    const pooled = new Sequelize(app.get(ConfigService).getOrThrow<string>("DATABASE_URL"), { dialect: "postgres", logging: false, pool: { max: 2, min: 0 } });
    const audited = new AuditContextService(pooled); audited.onModuleInit();
    const values = [fresh(), fresh()], contexts = [actor(), actor(1)];
    try {
      const rows = await Promise.all(values.map((value, i) => audited.run(contexts[i], () => pooled.query("INSERT INTO ethnicities(id,code,name,created_at,updated_at) SELECT :id,:code,:name,now(),now() FROM pg_sleep(0.05) RETURNING pg_backend_pid() AS pid", { replacements: value, type: QueryTypes.SELECT }) as Promise<any[]>)));
      expect(rows[0][0].pid).not.toBe(rows[1][0].pid);
      for (const [i, value] of values.entries()) expectActor((await auditRows(value.id))[0], i, contexts[i].requestId);
    } finally { await pooled.close(); }
  });
});
