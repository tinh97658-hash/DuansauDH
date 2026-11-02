import { randomUUID } from "node:crypto";
import { QueryTypes } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { up as up088 } from "../../src/database/migrations/088-unique-subject-code-pairs.js";
import { up as up089, down as down089 } from "../../src/database/migrations/089-independent-subject-codes.js";

const run = process.env.RUN_NEXT_CRITICAL_DB_TESTS === "true" ? describe : describe.skip;
run("Independent subject constraints on disposable PostgreSQL", () => {
  const schema = `next_critical_${randomUUID().replace(/-/g, "")}`;
  let admin: Sequelize, db: Sequelize;
  const managedRole = randomUUID(), powerfulRole = randomUUID();
  const query = (sql: string, replacements: Record<string, unknown> = {}) => db.query(sql, { replacements, type: QueryTypes.SELECT });
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url || !/^postgres:\/\/[^/]+@127\.0\.0\.1:56487\/pgsms_ui_verification$/.test(url)) throw Error("Use the independently owned local test database only");
    admin = new Sequelize(url, { logging: false }); await admin.query(`CREATE SCHEMA ${schema}`);
    db = new Sequelize(url, { logging: false, dialectOptions: { options: `-c search_path=${schema}` } });
  });
  afterAll(async () => {
    await db?.close(); if (admin) { await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.close(); }
  });
  it("refuses legacy single-code collisions under 088 without rewriting referenced records", async () => {
    await query("CREATE TABLE subjects(id uuid PRIMARY KEY,program text NOT NULL,major_id uuid NOT NULL,code_number int,code_text text)");
    await query("INSERT INTO subjects VALUES(gen_random_uuid(),'masters',:major,102,'EF'),(gen_random_uuid(),'masters',:major,102,'EG'),(gen_random_uuid(),'masters',:major,103,' ef ')", { major: managedRole });
    await up088({ context: db.getQueryInterface() });
    await query("CREATE TABLE curriculum_refs(subject_id uuid REFERENCES subjects(id)); INSERT INTO curriculum_refs SELECT id FROM subjects");
    const before = await query("SELECT * FROM subjects ORDER BY id");
    await expect(up089({ context: db.getQueryInterface() })).rejects.toThrow("SUBJECT_CODE_CONFLICTS");
    expect(await query("SELECT * FROM subjects ORDER BY id")).toEqual(before);
    expect(await query("SELECT * FROM curriculum_refs")).toHaveLength(3);
    // A separate empty table models clean deployment; keep conflicting records and references intact.
    await query("ALTER TABLE subjects RENAME TO legacy_subjects; ALTER INDEX subjects_identity_unique RENAME TO legacy_pair_unique; CREATE TABLE subjects (LIKE legacy_subjects INCLUDING DEFAULTS INCLUDING CONSTRAINTS)");
    await up089({ context: db.getQueryInterface() });
  });
  it("independently rejects number/text collisions, normalizes text, allows cross-scope/self edits", async () => {
    await query("INSERT INTO subjects VALUES(gen_random_uuid(),'masters',:major,102,'EF')", { major: managedRole });
    for (const [number, text] of [[102, "EF"], [103, " ef "], [102, "EG"]]) {
      await expect(query("INSERT INTO subjects VALUES(gen_random_uuid(),'masters',:major,:number,:text)", { major: managedRole, number, text })).rejects.toMatchObject({ name: "SequelizeUniqueConstraintError" });
    }
    await query("INSERT INTO subjects VALUES(gen_random_uuid(),'masters',:major,103,'EG'),(gen_random_uuid(),'doctoral',:major,102,'EF'),(gen_random_uuid(),'masters',:other,102,'EF')", { major: managedRole, other: powerfulRole });
    await query("UPDATE subjects SET code_text=' ef ' WHERE program='masters' AND major_id=:major AND code_number=102", { major: managedRole });
  });
  it("admits one concurrent insert for each independent constraint and rolls back a partial shared creation", async () => {
    for (const pair of [[[200, "A"], [200, "B"]], [[201, "C"], [202, " c "]]]) {
      const outcomes = await Promise.allSettled(pair.map(([number, text]) => query("INSERT INTO subjects VALUES(gen_random_uuid(),'masters',:major,:number,:text)", { major: managedRole, number, text })));
      expect(outcomes.filter(value => value.status === "fulfilled")).toHaveLength(1);
    }
    await expect(db.transaction(async transaction => {
      await db.query("INSERT INTO subjects VALUES(gen_random_uuid(),'masters',:major,300,'NEW'),(gen_random_uuid(),'masters',:major,102,'COLLIDE')", { replacements: { major: managedRole }, transaction });
    })).rejects.toThrow();
    expect(await query("SELECT id FROM subjects WHERE code_number=300")).toHaveLength(0);
    const before = await query("SELECT count(*) FROM subjects"); await down089({ context: db.getQueryInterface() });
    expect(await query("SELECT count(*) FROM subjects")).toEqual(before);
  });
});
