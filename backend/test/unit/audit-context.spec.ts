import { QueryTypes } from "sequelize";
import { AuditContextMiddleware, AuditContextService } from "../../src/audit/audit-context.js";
import { isAuditWrite } from "../../src/audit/audit-write-query.js";
import { Staff } from "../../src/database/models/staff.model.js";
import { Student } from "../../src/database/models/student.model.js";

const context = { actorStaffId: "staff-a", actorEmail: "a@example.invalid", requestId: "QA-AUDIT-123", ip: "127.0.0.1", userAgent: "audit-test" };
const build = () => {
  const originalQuery = jest.fn().mockResolvedValue(["unchanged-result"]);
  const tx = { id: "transaction" };
  const db: any = { query: originalQuery, transaction: jest.fn(async (fn: any) => fn(tx)), options: {} };
  const service = new AuditContextService(db);
  service.onModuleInit();
  return { service, db, tx, originalQuery };
};

describe("Audit write classification", () => {
  it.each([
    "INSERT INTO staff VALUES (1)", "UPDATE staff SET name='x'", "DELETE FROM staff",
    "MERGE INTO staff USING source ON true WHEN MATCHED THEN DELETE",
    "/* leading /* nested */ comment */ UPDATE staff SET name='x'",
    "WITH changed AS (DELETE FROM staff RETURNING *) SELECT * FROM changed",
    "WITH input AS (SELECT 1) UPDATE staff SET name='x'",
    "SELECT 1; INSERT INTO staff VALUES (1)",
  ])("recognizes raw DML even with SELECT result typing: %s", sql => {
    expect(isAuditWrite(sql, { type: QueryTypes.SELECT })).toBe(true);
  });
  it.each([
    "SELECT * FROM staff", "SELECT 'UPDATE staff SET name=''x'''", 'SELECT "UPDATE" FROM example',
    "SELECT $$ DELETE FROM staff $$", "SELECT $body$ INSERT INTO staff $body$",
    "SELECT E'escaped \\' UPDATE staff'", "SELECT 1 -- UPDATE staff\n",
    "/* INSERT INTO staff /* UPDATE */ DELETE FROM staff */ SELECT 1",
    "SELECT * FROM staff FOR UPDATE", "WITH x AS (SELECT 1) SELECT * FROM staff FOR NO KEY UPDATE",
    "START TRANSACTION", "COMMIT", "ROLLBACK TO SAVEPOINT example",
    "CREATE FUNCTION example() RETURNS void AS $$ BEGIN UPDATE staff SET name='x'; END $$ LANGUAGE plpgsql",
  ])("leaves reads/transaction/schema operations alone: %s", sql => {
    expect(isAuditWrite(sql)).toBe(false);
  });
  it("supports query objects, ORM write types and excluded unaudited models", () => {
    expect(isAuditWrite({ query: "UPDATE staff SET name=$1", bind: ["QA"] })).toBe(true);
    expect(isAuditWrite("dialect generated SQL", { type: QueryTypes.UPSERT })).toBe(true);
    expect(isAuditWrite("INSERT INTO sessions VALUES (1)", { type: QueryTypes.INSERT, model: { getTableName: () => ({ tableName: "sessions" }) } })).toBe(false);
  });
});

describe("AuditContextService write boundary", () => {
  it("sets LOCAL context and DML on the exact same managed transaction", async () => {
    const { service, db, tx, originalQuery } = build();
    const options = { type: QueryTypes.UPDATE, bind: ["new"] };
    await expect(service.run(context, () => db.query("UPDATE staff SET name=$1", options))).resolves.toEqual(["unchanged-result"]);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    const [sql, setup] = originalQuery.mock.calls[0];
    expect(sql).toContain("set_config('app.actor_staff_id', :actorStaffId, true)");
    expect(setup.transaction).toBe(tx);
    expect(setup.replacements).toEqual(context);
    expect(originalQuery.mock.calls[1]).toEqual(["UPDATE staff SET name=$1", { ...options, transaction: tx }]);
    expect(options).not.toHaveProperty("transaction");
  });
  it("uses the existing transaction without opening or committing another one", async () => {
    const { service, db, originalQuery } = build();
    const explicit = { id: "caller-owned" };
    await service.run(context, () => db.query("DELETE FROM staff", { transaction: explicit }));
    expect(db.transaction).not.toHaveBeenCalled();
    expect(originalQuery.mock.calls.every(([, opts]) => opts.transaction === explicit)).toBe(true);
  });
  it("does not open transactions for reads, excluded model writes or no-request autocommit writes", async () => {
    const { service, db, originalQuery } = build();
    await service.run(context, () => db.query("SELECT * FROM staff", { type: QueryTypes.SELECT }));
    await service.run(context, () => db.query("INSERT INTO auth_audit_logs VALUES (1)", { model: { getTableName: () => "auth_audit_logs" } }));
    await db.query("UPDATE staff SET name='system'");
    expect(db.transaction).not.toHaveBeenCalled();
    expect(originalQuery).toHaveBeenCalledTimes(3);
  });
  it("clears missing actor/correlation fields for explicit system writes", async () => {
    const { db, originalQuery } = build();
    await db.query("UPDATE staff SET name='system'", { transaction: { id: "system" } });
    expect(originalQuery.mock.calls[0][1].replacements).toEqual({ actorStaffId: "", actorEmail: "", requestId: "", ip: "", userAgent: "" });
  });
  it("rethrows setup failures before executing DML and does not install twice", async () => {
    const { service, db, originalQuery } = build();
    const patched = db.query;
    service.onModuleInit();
    expect(db.query).toBe(patched);
    originalQuery.mockRejectedValueOnce(new Error("context setup failed"));
    await expect(service.run(context, () => db.query("UPDATE staff SET name='x'"))).rejects.toThrow("context setup failed");
    expect(originalQuery).toHaveBeenCalledTimes(1);
  });
  it("clones verified login identity while preserving and restoring correlation metadata", async () => {
    const { service } = build();
    const staff = Object.defineProperties(Object.create(Staff.prototype), { id: { value: "authenticated" }, email: { value: "verified@example.invalid" } });
    const original = { ...context, actorStaffId: null, actorEmail: null };
    await service.run(original, async () => {
      await service.runAsStaff(staff, async () => {
        await Promise.resolve();
        expect(service.current()).toEqual({ ...original, actorStaffId: staff.id, actorEmail: staff.email });
      });
      expect(service.current()).toBe(original);
    });
    expect(service.current()).toBeUndefined();
    expect(original.actorStaffId).toBeNull();
  });
});

describe("AuditContextMiddleware", () => {
  it.each(["staff", "student", "anonymous"])("keeps %s identity and the exact request metadata isolated", async type => {
    const { service } = build();
    const middleware = new AuditContextMiddleware(service);
    const user = type === "staff" ? Object.defineProperties(Object.create(Staff.prototype), { id: { value: "a" }, email: { value: "a@example.invalid" } }) : type === "student" ? Object.create(Student.prototype) : undefined;
    const req: any = { user, ip: "127.0.0.1", get: (name: string) => name === "x-request-id" ? "QA-AUDIT-123" : "test-agent" };
    await new Promise<void>((resolve, reject) => middleware.use(req, {} as any, () => {
      Promise.resolve().then(() => {
        expect(service.current()).toEqual({ actorStaffId: type === "staff" ? "a" : null, actorEmail: type === "staff" ? "a@example.invalid" : null, requestId: "QA-AUDIT-123", ip: "127.0.0.1", userAgent: "test-agent" });
      }).then(resolve, reject);
    }));
    expect(service.current()).toBeUndefined();
  });
  it("generates a request UUID when none was supplied", () => {
    const { service } = build();
    new AuditContextMiddleware(service).use({ get: () => undefined } as any, {} as any, () => {
      expect(service.current()?.requestId).toMatch(/^[0-9a-f-]{36}$/);
    });
  });
});
