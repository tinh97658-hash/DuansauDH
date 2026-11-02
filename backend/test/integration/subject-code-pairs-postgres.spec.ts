import { randomUUID } from "node:crypto";
import { QueryTypes } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { up, down } from "../../src/database/migrations/088-unique-subject-code-pairs.js";

const describeDb = process.env.RUN_POSTGRES_SUBJECT_IDENTITY_TESTS === "true" ? describe : describe.skip;
describeDb("Subject code-pair identity on disposable PostgreSQL", () => {
  const schema = `subject_identity_${randomUUID().replace(/-/g, "")}`;
  let admin: Sequelize;
  let db: Sequelize;
  const majorId = randomUUID();
  const query = (sql: string, replacements: object = {}) => db.query(sql, { replacements, type: QueryTypes.SELECT });
  const insert = (codeNumber: number, codeText: string, major = majorId, program = "masters") => query(
    "INSERT INTO subjects(id,major_id,program,code_number,code_text) VALUES(gen_random_uuid(),:major,:program,:codeNumber,:codeText) RETURNING id",
    { major, program, codeNumber, codeText },
  );
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error("Set TEST_DATABASE_URL to an independent disposable database.");
    admin = new Sequelize(process.env.TEST_DATABASE_URL, { logging: false });
    await admin.query(`CREATE SCHEMA ${schema}`);
    db = new Sequelize(process.env.TEST_DATABASE_URL, { logging: false, dialectOptions: { options: `-c search_path=${schema}` } });
    await query("CREATE TABLE subjects(id uuid PRIMARY KEY, major_id uuid NOT NULL, program text NOT NULL, code_number int, code_text text)");
  });
  afterAll(async () => {
    await db?.close();
    if (admin) { await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.close(); }
  });

  it("refuses legacy duplicates without rewriting rows or their curriculum references", async () => {
    await insert(102, "EF"); await insert(102, " ef ");
    await query("CREATE TABLE curriculum_subjects(subject_id uuid REFERENCES subjects(id)); INSERT INTO curriculum_subjects SELECT id FROM subjects");
    await expect(up({ context: db.getQueryInterface() })).rejects.toThrow("SUBJECT_IDENTITY_DUPLICATES");
    expect(await query("SELECT count(*)::int AS count FROM subjects")).toEqual([{ count: 2 }]);
    expect(await query("SELECT count(*)::int AS count FROM curriculum_subjects")).toEqual([{ count: 2 }]);
    expect(await query("SELECT to_regclass('subjects_identity_unique') AS index")).toEqual([{ index: null }]);
    // Only test-owned temporary tables are replaced; no application data is involved.
    await query("DROP TABLE curriculum_subjects; DROP TABLE subjects; CREATE TABLE subjects(id uuid PRIMARY KEY, major_id uuid NOT NULL, program text NOT NULL, code_number int, code_text text)");
    await up({ context: db.getQueryInterface() });
    await insert(102, "EF");
  });
  it.each(["EF", "ef", " EF "])("blocks the entire pair after normalization: %s", async code => {
    await expect(insert(102, code)).rejects.toMatchObject({ original: { code: "23505", constraint: "subjects_identity_unique" } });
  });
  it("allows either code alone to repeat, another major and another program", async () => {
    await expect(insert(102, "GH")).resolves.toHaveLength(1);
    await expect(insert(103, "EF")).resolves.toHaveLength(1);
    await expect(insert(102, "EF", randomUUID())).resolves.toHaveLength(1);
    await expect(insert(102, "EF", majorId, "doctoral")).resolves.toHaveLength(1);
  });
  it("allows a record to keep its own pair but blocks edits into another pair", async () => {
    await expect(query("UPDATE subjects SET code_text=' ef ' WHERE major_id=:major AND program='masters' AND code_number=102 AND code_text='EF' RETURNING id", { major: majorId })).resolves.toHaveLength(1);
    await expect(query("UPDATE subjects SET code_number=102 WHERE code_number=103")).rejects.toMatchObject({ original: { code: "23505" } });
  });
  it("admits exactly one of two concurrent requests with the same normalized pair", async () => {
    const results = await Promise.allSettled([insert(999, "RACE"), insert(999, " race ")]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
  });
  it("rolls back a failed shared creation without leaving its earlier inserts", async () => {
    await expect(db.transaction(async transaction => {
      await db.query("INSERT INTO subjects VALUES(gen_random_uuid(),:major,'masters',200,'NEW'); INSERT INTO subjects VALUES(gen_random_uuid(),:major,'masters',102,'EF')", { replacements: { major: majorId }, transaction });
    })).rejects.toThrow();
    expect(await query("SELECT id FROM subjects WHERE code_number=200")).toHaveLength(0);
  });
  it("can remove only the new index without modifying catalog records", async () => {
    const before = await query("SELECT count(*)::int AS count FROM subjects");
    await down({ context: db.getQueryInterface() });
    expect(await query("SELECT count(*)::int AS count FROM subjects")).toEqual(before);
  });
});
