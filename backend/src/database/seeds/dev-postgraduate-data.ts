import "reflect-metadata";
import { ConfigModule } from "@nestjs/config";
import { QueryTypes, Transaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { environmentFiles, environmentSchema } from "../../config/configuration.js";
import { databaseModels } from "../database.module.js";
import { deletionOrder, ForeignKey, LIFECYCLE_TABLES, PRESERVED_TABLES, requireLocalDev } from "./dev-postgraduate-policy.js";
import { buildAdmissions, SeedCatalog, summarizeAdmissions } from "./dev-postgraduate-fixture.js";

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;
const tableSql = (name: string) => `"public".${quote(name)}`;
const studentFilter = " WHERE role = 'student'";
type Snapshot = Record<string, { count: number; fingerprint: string }>;

export async function auditSchema(db: Sequelize, transaction: Transaction) {
  const select = <T extends object>(sql: string) => db.query<T>(sql, { type: QueryTypes.SELECT, transaction });
  const relations = await select<{ name: string; kind: string; rls: boolean; rules: boolean }>(`
    SELECT c.relname AS name, c.relkind AS kind, c.relrowsecurity AS rls, c.relhasrules AS rules
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p','f','m') ORDER BY c.relname`);
  if (relations.some((row) => row.kind !== "r" || row.rls || row.rules)) {
    throw new Error("DEV DATA: partition/foreign/materialized tables, row security or table rules require a new audit.");
  }
  const tables = relations.map((row) => row.name);
  for (const required of ["admission_records", "students", "class_groups", "class_group_members", "course_offerings", "teaching_sessions", "course_exam_gradebooks", "disciplines", "majors"]) {
    if (!tables.includes(required)) throw new Error(`DEV DATA: required current-schema table is missing: ${required}. Run migrations separately.`);
  }
  const foreignKeys = await select<ForeignKey>(`
    SELECT c.conname AS name, n.nspname AS "childSchema", t.relname AS child,
      pn.nspname AS "parentSchema", p.relname AS parent, pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    JOIN pg_class p ON p.oid=c.confrelid JOIN pg_namespace pn ON pn.oid=p.relnamespace
    WHERE c.contype='f' AND (n.nspname='public' OR pn.nspname='public') ORDER BY t.relname,c.conname`);
  const order = deletionOrder(tables, foreignKeys);
  const triggers = await select<{ name: string; table: string }>(`
    SELECT g.tgname AS name, c.relname AS table FROM pg_trigger g
    JOIN pg_class c ON c.oid=g.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND NOT g.tgisinternal`);
  if (triggers.length) throw new Error(`DEV DATA: unaudited user triggers: ${triggers.map((row) => row.name).join(", ")}`);
  return { tables, foreignKeys, order, preserved: tables.filter((table) => (PRESERVED_TABLES as readonly string[]).includes(table)) };
}

async function tableCount(db: Sequelize, table: string, transaction: Transaction, filter = "") {
  const [row] = await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM ${tableSql(table)}${filter}`, { type: QueryTypes.SELECT, transaction });
  return row.count;
}

async function preservedSnapshot(db: Sequelize, tables: string[], transaction: Transaction): Promise<Snapshot> {
  const snapshot: Snapshot = {};
  for (const table of [...tables, "students"]) {
    const filter = table === "students" ? " WHERE role <> 'student' OR role IS NULL" : "";
    // Only hashes/counts leave the DB; no credentials, session values or personal records are logged.
    const [row] = await db.query<{ count: number; fingerprint: string }>(`
      SELECT count(*)::int AS count, md5(COALESCE(string_agg(row_hash, '' ORDER BY row_hash), '')) AS fingerprint
      FROM (SELECT md5(to_jsonb(t)::text) AS row_hash FROM ${tableSql(table)} t${filter}) rows`, { type: QueryTypes.SELECT, transaction });
    snapshot[table === "students" ? "students:system-accounts" : table] = row;
  }
  return snapshot;
}

function assertPreserved(before: Snapshot, after: Snapshot) {
  for (const [table, snapshot] of Object.entries(before)) {
    if (snapshot.count !== after[table]?.count || snapshot.fingerprint !== after[table]?.fingerprint) {
      throw new Error(`DEV DATA: preserved rows changed in ${table}; rolling back the entire operation.`);
    }
  }
}

async function catalog(db: Sequelize, transaction: Transaction): Promise<SeedCatalog> {
  const majors = await db.query<SeedCatalog["majors"][number]>(`
    SELECT m.id,m.code,m.name,m.program,m.discipline_id AS "disciplineId" FROM majors m
    JOIN disciplines d ON d.id=m.discipline_id
    WHERE m.active=true AND m.is_common=false AND d.active=true AND m.program IN ('masters','doctoral')
    ORDER BY m.id`, { type: QueryTypes.SELECT, transaction });
  const names = async (table: string) => (await db.query<{ name: string }>(
    `SELECT name FROM ${tableSql(table)} WHERE active=true ORDER BY code,id`, { type: QueryTypes.SELECT, transaction })).map((row) => row.name);
  return { majors, cities: await names("cities"), ethnicities: await names("ethnicities"), nationalities: await names("nationalities") };
}

export async function resetPostgraduateTransactionalData(db: Sequelize, order: string[], transaction: Transaction) {
  const deleted: Record<string, number> = {};
  for (const table of order) {
    const [row] = await db.query<{ count: number }>(`
      WITH deleted AS (DELETE FROM ${tableSql(table)}${table === "students" ? studentFilter : ""} RETURNING 1)
      SELECT count(*)::int AS count FROM deleted`, { type: QueryTypes.SELECT, transaction });
    deleted[table] = row.count;
  }
  return deleted;
}

export async function seedPostgraduateAdmissions(db: Sequelize, records: any[], transaction: Transaction) {
  // The create endpoint accepts pending records without a plan/student/code. No service side effects are bypassed.
  await db.models.AdmissionRecord.bulkCreate(records, { transaction, validate: true });
}

async function verifyDataset(db: Sequelize, transaction: Transaction, expected: any[], order: string[]) {
  const rows = await db.models.AdmissionRecord.findAll({ raw: true, transaction }) as any[];
  if (rows.length !== expected.length) throw new Error("DEV DATA: admission total mismatch.");
  const expectedById = new Map(expected.map((row) => [row.id, row]));
  for (const row of rows) {
    const wanted = expectedById.get(row.id);
    if (!wanted || ["fullName", "email", "phone", "academicYear", "majorId", "trainingLevel", "status", "studyStatus"].some((key) => row[key] !== wanted[key])
      || row.studentId || row.extraData?.tuitionPayment || /test|demo|student|user|học viên\s*\d/i.test(row.fullName)) {
      throw new Error("DEV DATA: generated record/scoping/initial-state verification failed.");
    }
  }
  for (const field of ["id", "email", "phone", "fullName"]) {
    if (new Set(rows.map((row) => row[field])).size !== rows.length) throw new Error(`DEV DATA: duplicate ${field}.`);
  }
  for (const table of order.filter((table) => table !== "admission_records")) {
    if (await tableCount(db, table, transaction, table === "students" ? studentFilter : "")) {
      throw new Error(`DEV DATA: lifecycle data remains in ${table}.`);
    }
  }
  // Existing report views are ordinary views, so no materialized refresh or DDL is necessary.
  const [joined] = await db.query<{ count: number }>(`
    SELECT count(*)::int AS count FROM admission_records ar
    JOIN majors m ON m.id=ar.major_id JOIN disciplines d ON d.id=m.discipline_id`, { type: QueryTypes.SELECT, transaction });
  if (joined.count !== expected.length) throw new Error("DEV DATA: admission/major/discipline join lost or duplicated rows.");
  return { admissions: rows.length, uniqueIdentifiers: true, validMajorDisciplineJoin: true, downstreamLifecycleEmpty: true };
}

export async function run() {
  const args = process.argv.slice(2);
  const mode = args[0] || "preview";
  if (!["preview", "reset", "seed", "reseed"].includes(mode)
    || args.slice(1).some((arg) => !["--preview", "--rollback"].includes(arg) && !arg.startsWith("--report="))) {
    throw new Error("Usage: dev-postgraduate-data [preview|reset|seed|reseed] [--preview|--rollback] [--report=path]");
  }
  const preview = mode === "preview" || args.includes("--preview");
  if (preview && args.includes("--rollback")) throw new Error("Choose --preview (read-only) or --rollback (write rehearsal), not both.");
  let configuration: Record<string, any>;
  await ConfigModule.forRoot({ envFilePath: environmentFiles, expandVariables: true, validate: (config) => {
    const { value, error } = environmentSchema.validate(config);
    if (error) throw new Error("DEV DATA: invalid backend environment (configuration values are not logged).");
    configuration = value;
    requireLocalDev(value, !preview);
    return value;
  } });
  const identity = requireLocalDev(configuration!, !preview);
  const seed = Number(configuration!.SEED_RANDOM ?? 20261018);
  const db = new Sequelize(configuration!.DATABASE_URL, {
    dialect: "postgres", models: databaseModels, logging: false,
    pool: { max: 1, min: 0, acquire: 10000 },
    dialectOptions: { connectionTimeoutMillis: 5000, application_name: "duansaudh-dev-postgraduate-data" },
    define: { underscored: true, timestamps: true },
  });
  try {
    await db.authenticate();
    const transaction = await db.transaction();
    let ended = false;
    let report: any;
    try {
      if (preview) await db.query("SET TRANSACTION READ ONLY", { transaction });
      await db.query("SET LOCAL lock_timeout = '5s'", { transaction });
      await db.query("SET LOCAL statement_timeout = '30s'", { transaction });
      const schema = await auditSchema(db, transaction);
      if (!preview) {
        const [lock] = await db.query<{ locked: boolean }>("SELECT pg_try_advisory_xact_lock(20261018, 210) AS locked", { type: QueryTypes.SELECT, transaction });
        if (!lock.locked) throw new Error("DEV DATA: another reset/seed is running.");
        await db.query(`LOCK TABLE ${schema.tables.map(tableSql).join(", ")} IN SHARE ROW EXCLUSIVE MODE`, { transaction });
        // A concurrent migration between audit and locks must never introduce an unaudited dependency.
        const lockedSchema = await auditSchema(db, transaction);
        if (JSON.stringify(schema) !== JSON.stringify(lockedSchema)) throw new Error("DEV DATA: schema changed during preflight; retry after auditing.");
      }
      const before: Record<string, number> = {};
      for (const table of schema.tables) before[table] = await tableCount(db, table, transaction);
      const preservedBefore = await preservedSnapshot(db, schema.preserved, transaction);
      const dataCatalog = await catalog(db, transaction);
      const records = mode === "reset" ? [] : buildAdmissions(dataCatalog, seed);
      const plannedDeletions = Object.fromEntries(schema.order.map((table) => [table, before[table]]));
      plannedDeletions.students = await tableCount(db, "students", transaction, studentFilter);
      report = { identity, mode, preview, rollback: args.includes("--rollback"), seedRandom: seed,
        preservedTables: schema.preserved, protectedStudentRoles: "admin/supervisor (only role=student is deleted)",
        deleteOrder: schema.order, foreignKeys: schema.foreignKeys, before, plannedDeletions,
        preservedBefore, seed: mode === "reset" ? null : summarizeAdmissions(records, dataCatalog.majors) };
      console.log("DEV DATA PREFLIGHT");
      console.log(JSON.stringify({ identity, mode, preview, preserved: schema.preserved, deleteOrder: schema.order,
        plannedDeletions, dataset: report.seed }, null, 2));
      if (mode === "seed" && Object.values(plannedDeletions).some((count) => count > 0)) {
        throw new Error("DEV DATA: seed requires an empty lifecycle; use a confirmed reseed. Nothing appended or overwritten.");
      }
      if (!preview) {
        if (mode === "reset" || mode === "reseed") {
          report.deleted = await resetPostgraduateTransactionalData(db, schema.order, transaction);
          for (const table of schema.order) {
            if (report.deleted[table] !== plannedDeletions[table]
              || await tableCount(db, table, transaction, table === "students" ? studentFilter : "") !== 0) {
              throw new Error(`DEV DATA: reset count verification failed: ${table}.`);
            }
          }
        }
        if (mode !== "reset") await seedPostgraduateAdmissions(db, records, transaction);
        report.verification = await verifyDataset(db, transaction, records, schema.order);
        report.preservedAfter = await preservedSnapshot(db, schema.preserved, transaction);
        assertPreserved(preservedBefore, report.preservedAfter);
        report.after = {};
        for (const table of schema.tables) report.after[table] = await tableCount(db, table, transaction);
      }
      if (preview || args.includes("--rollback")) await transaction.rollback(); else await transaction.commit();
      ended = true;
      report.committed = !preview && !args.includes("--rollback");
    } catch (error) { if (!ended) await transaction.rollback(); throw error; }
    console.log("RESET SUMMARY");
    console.table(report.deleted || report.plannedDeletions);
    console.log("PRESERVED (full row fingerprints verified on writes)");
    console.table(Object.fromEntries(Object.entries(report.preservedAfter || report.preservedBefore).map(([table, value]: [string, any]) => [table, value.count])));
    console.log("SEED SUMMARY");
    console.log(JSON.stringify({ committed: report.committed, seed: report.seed, verification: report.verification }, null, 2));
    const reportPath = args.find((arg) => arg.startsWith("--report="))?.slice(9);
    if (reportPath) {
      const path = resolve(reportPath);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(report, null, 2), "utf8");
      console.log(`Report: ${path}`);
    }
    return report;
  } finally { await db.close(); }
}

if (require.main === module) run().catch((error) => {
  // Driver errors can include credentials or generated rows; log only the application message.
  console.error(error?.name?.startsWith("Sequelize") ? "DEV DATA: database operation failed and transaction rolled back; inspect schema/constraints." : error.message);
  process.exitCode = 1;
});
