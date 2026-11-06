import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes, type Transaction } from "sequelize";
import { up } from "../../src/database/migrations/100-simple-curriculum-subjects.js";

const describeDb = process.env.RUN_POSTGRES_REPORT_TESTS === "true" ? describe : describe.skip;
describeDb("Simplify curriculum totals without changing subject configuration", () => {
  let db: Sequelize;
  let transaction: Transaction;
  beforeAll(async () => {
    const vars = process.env.TEST_DATABASE_URL ? {} : Object.fromEntries(readFileSync(resolve(__dirname, "../../../.env"), "utf8")
      .split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, "")];
      }));
    db = process.env.TEST_DATABASE_URL ? new Sequelize(process.env.TEST_DATABASE_URL, { logging: false })
      : new Sequelize({ dialect: "postgres", host: "127.0.0.1", port: Number(vars.DB_PORT), username: vars.POSTGRES_USER, password: vars.POSTGRES_PASSWORD, database: vars.POSTGRES_DB, logging: false });
  });
  afterAll(async () => { await db?.close(); });
  afterEach(async () => { await transaction?.rollback(); });

  it("sums every listed course, retains labels, and removes only the provisional grouping note", async () => {
    transaction = await db.transaction();
    const temporaryNote = 'Cấu hình tạm theo yêu cầu người quản lý: 3 nhóm tự chọn, mỗi nhóm 8 TC, chọn đúng 4 TC (2/4 môn). Tổng tối thiểu đang cấu hình: 35 TC bắt buộc + 12 TC tự chọn = 47 TC. Chưa đối chiếu định mức với CTĐT ban hành; không dùng con số này làm chuẩn tốt nghiệp chính thức.';
    await db.query(`CREATE TEMP TABLE curriculums (id text,code text,note text,total_credits int,updated_at timestamp) ON COMMIT DROP;
      CREATE TEMP TABLE subjects (id text,credits int) ON COMMIT DROP;
      CREATE TEMP TABLE curriculum_subjects (id text,curriculum_id text,subject_id text,is_required boolean) ON COMMIT DROP;
      INSERT INTO curriculums VALUES ('a','CT-NGANH-2026-17',:note,47,NOW()),('b','OTHER','Keep this note',44,NOW());
      INSERT INTO subjects VALUES ('required',35),('elective',24),('other',72);
      INSERT INTO curriculum_subjects VALUES ('ea','a','required',true),('eb','a','elective',false),('ec','b','other',false)`, {
      transaction, replacements: { note: `User note\n${temporaryNote}` },
    });
    const before = await db.query("SELECT * FROM curriculum_subjects ORDER BY id", { transaction, type: QueryTypes.SELECT });
    const adapter = { query: db.query.bind(db), transaction: (callback: any) => db.transaction({ transaction }, callback) };
    await up({ context: { sequelize: adapter } });
    const rows = await db.query("SELECT code,note,total_credits FROM curriculums ORDER BY id", { transaction, type: QueryTypes.SELECT });
    expect(rows).toEqual([
      { code: "CT-NGANH-2026-17", note: "User note", total_credits: 59 },
      { code: "OTHER", note: "Keep this note", total_credits: 72 },
    ]);
    expect(await db.query("SELECT * FROM curriculum_subjects ORDER BY id", { transaction, type: QueryTypes.SELECT })).toEqual(before);
  });
});
