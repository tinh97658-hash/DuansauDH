import { NestFactory } from "@nestjs/core";
import { getConnectionToken } from "@nestjs/sequelize";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes, Transaction } from "sequelize";
import { randomUUID } from "node:crypto";
import { AppModule } from "../../src/app.module.js";
import { up } from "../../src/database/migrations/065-audit-credential-redaction.js";
import { CREDENTIAL_KEYS, redactCredentials } from "../../src/audit/credential-redaction.js";

const describeDb = process.env.RUN_POSTGRES_ACCOUNT_TESTS === "true" ? describe : describe.skip;

describeDb("Audit credential redaction on PostgreSQL", () => {
  let app: any;
  let db: Sequelize;
  let tx: Transaction;
  const select = (sql: string, replacements: any = {}) => db.query(sql, { replacements, transaction: tx, type: QueryTypes.SELECT }) as Promise<any[]>;
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    db = app.get(getConnectionToken());
  });
  beforeEach(async () => { tx = await db.transaction(); });
  afterEach(async () => { await tx?.rollback(); });
  afterAll(async () => { await app?.close(); });

  it("redacts full Staff snapshots for INSERT, password UPDATE, login UPDATE and DELETE", async () => {
    const id = randomUUID();
    const hash = "$2b$12$synthetic-test-value-never-a-real-credential";
    await select(`INSERT INTO staff (id,name,email,role,password,created_at,updated_at)
      VALUES (:id,'Audit regression',:email,'admin',:hash,now(),now())`, { id, email: `${id}@example.invalid`, hash });
    await select("UPDATE staff SET password = :hash WHERE id = :id", { id, hash: `${hash}-changed` });
    await select("UPDATE staff SET last_login_at = now() WHERE id = :id", { id });
    await select("DELETE FROM staff WHERE id = :id", { id });
    const rows = await select("SELECT * FROM db_change_logs WHERE table_name = 'staff' AND row_pk::jsonb ->> 'id' = :id ORDER BY id", { id });
    expect(rows).toHaveLength(4);
    expect(rows[1].changed_columns).toContain("password");
    expect(rows[2].changed_columns).toEqual(["last_login_at"]);
    for (const row of rows) {
      for (const payload of [row.old_data, row.new_data].filter(Boolean)) {
        expect(payload.password).toBe("[REDACTED]");
        expect(JSON.stringify(payload).includes(hash)).toBe(false);
        expect(payload.name).toBe("Audit regression");
      }
    }
  });

  it("redacts audited Student passwords and reset tokens", async () => {
    const id = randomUUID();
    await select(`INSERT INTO students (id,name_with_initials,full_name,postal_address,email,tel_no,password,account_type,password_reset_token,created_at,updated_at)
      VALUES (:id,'Audit','Audit Student','Address',:email,'000','test-password','registered','test-reset-token',now(),now())`, { id, email: `${id}@example.invalid` });
    await select("UPDATE students SET password_reset_token = 'replacement-token' WHERE id = :id", { id });
    const rows = await select("SELECT old_data,new_data,changed_columns FROM db_change_logs WHERE table_name = 'students' AND row_pk::jsonb ->> 'id' = :id ORDER BY id", { id });
    expect(rows).toHaveLength(2);
    expect(rows[1].changed_columns).toContain("password_reset_token");
    for (const row of rows) for (const payload of [row.old_data, row.new_data].filter(Boolean)) {
      expect(payload.password).toBe("[REDACTED]");
      expect(payload.password_reset_token).toBe("[REDACTED]");
      expect(payload.full_name).toBe("Audit Student");
    }
  });

  it("cleans historical unsafe rows while preserving all other audit columns", async () => {
    const [before] = await select(`INSERT INTO db_change_logs
      (table_name,operation,row_pk,old_data,new_data,changed_columns,actor_email,request_id,changed_at)
      VALUES ('staff','UPDATE','historical-regression',:old::jsonb,:new::jsonb,ARRAY['password'],'actor@example.invalid','audit-test',now()) RETURNING *`,
      { old: JSON.stringify({ password: "legacy-hash", name: "Before" }), new: JSON.stringify({ password: "legacy-new", password_reset_token: "legacy-token", name: "After" }) });
    // Execute the actual migration, inside the surrounding rollback transaction.
    await up({ context: { sequelize: {
      transaction: async (fn: any) => fn(tx),
      query: (sql: string, options: any) => db.query(sql, options),
    } } });
    const [after] = await select("SELECT * FROM db_change_logs WHERE id = :id", { id: before.id });
    expect(after).toEqual({ ...before,
      old_data: { password: "[REDACTED]", name: "Before" },
      new_data: { password: "[REDACTED]", password_reset_token: "[REDACTED]", name: "After" },
    });
  });

  it("keeps SQL and API policies consistent for nested values and credential aliases", async () => {
    const payload = { ...Object.fromEntries(CREDENTIAL_KEYS.map(key => [key, "unsafe"])), passwordResetToken: "unsafe",
      nested: [{ access_token: "unsafe", name: "Business", must_change_password: true, password_reset_expires: null }], empty: [], absent: null };
    const [row] = await select("SELECT audit_redact_credentials(:payload::jsonb) AS value", { payload: JSON.stringify(payload) });
    expect(row.value).toEqual(redactCredentials(payload));
  });
});
