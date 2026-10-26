// Preview: node src/database/seeds/seed-local-robotics-learners.cjs
// Create the ten sample learners: append --apply.
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

process.loadEnvFile(path.resolve(__dirname, "../../../../.env"));
const MARKER = "LOCAL-ROBOTICS-LEARNERS-2026-10-V1";
const YEAR = "2026";
const apply = process.argv.includes("--apply");
const names = [
  ["Nguyễn Minh", "An", "Nam"], ["Trần Ngọc", "Bích", "Nữ"],
  ["Lê Quốc", "Cường", "Nam"], ["Phạm Thu", "Hà", "Nữ"],
  ["Hoàng Đức", "Huy", "Nam"], ["Vũ Khánh", "Linh", "Nữ"],
  ["Đặng Hoài", "Nam", "Nam"], ["Bùi Thanh", "Phương", "Nữ"],
  ["Đỗ Anh", "Tuấn", "Nam"], ["Phan Hải", "Yến", "Nữ"],
];
const normalize = (value) => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase().trim();
const connection = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : { host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    database: process.env.POSTGRES_DB, user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD };
const host = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : process.env.DB_HOST;
const client = new Client({ ...connection, connectionTimeoutMillis: 5000 });

async function run() {
  if (!["127.0.0.1", "localhost", "::1", "db"].includes(host)
    || process.env.NODE_ENV === "production") throw new Error("Script này dùng database phát triển local.");
  await client.connect();
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [MARKER]);
    const majors = (await client.query("SELECT id, name, code FROM majors WHERE active=true AND program='masters' FOR UPDATE")).rows;
    const matches = majors.filter((major) => normalize(major.name) === "co khi thong minh va robot");
    if (matches.length !== 1) throw new Error(`Tìm thấy ${matches.length} chuyên ngành Cơ khí thông minh và Robot; chưa ghi dữ liệu.`);
    const major = matches[0];
    const codes = names.map((_, index) => `MAU-CKRO26-${String(index + 1).padStart(3, "0")}`);
    const existing = (await client.query("SELECT code, major_id, extra_data FROM admission_records WHERE code=ANY($1::text[])", [codes])).rows;
    if (existing.some((row) => row.major_id !== major.id || row.extra_data?.seed !== MARKER)) {
      throw new Error("Mã hồ sơ mẫu trùng với hồ sơ khác; chưa ghi dữ liệu.");
    }
    const existingCodes = new Set(existing.map((row) => row.code));
    let created = 0;
    for (const [index, [lastName, firstName, gender]] of names.entries()) {
      if (!apply || existingCodes.has(codes[index])) continue;
      await client.query(`
        INSERT INTO admission_records
          (id, code, last_name, first_name, full_name, dob, gender, email,
           training_level, major_id, major_name, academic_year, status, study_status,
           nationality, ethnicity, religion, city, pob, training_mode_name,
           grad_school, grad_major, grad_year, grad_degree_type, gpa, grad_classification,
           documents, note, extra_data, submitted_at, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Thạc sĩ',$9,$10,$11,'approved','Đã trúng tuyển',
          'Việt Nam','Kinh','Không','Thành phố Hải Phòng','Hải Phòng','Đào tạo thông thường',
          'Trường đại học mẫu','Kỹ thuật cơ khí',$12,'Chính quy',$13,'Khá',
          '{}'::json,$14,$15::json,NOW(),NOW(),NOW())`,
      [randomUUID(), codes[index], lastName, firstName, `${lastName} ${firstName}`,
        `${1993 + index % 7}-${String(index + 1).padStart(2, "0")}-15`, gender,
        `mau-ckro26-${String(index + 1).padStart(3, "0")}@example.invalid`,
        major.id, major.name, YEAR, String(2015 + index % 7), (7.2 + index / 10).toFixed(1),
        `[TEST_BATCH:${MARKER}] Hồ sơ mẫu theo yêu cầu, phục vụ thử nghiệm danh sách học viên.`,
        JSON.stringify({ seed: MARKER, sample: true })]);
      created += 1;
    }
    const learners = (await client.query(`
      SELECT code, full_name, study_status FROM admission_records
      WHERE code=ANY($1::text[]) AND major_id=$2 AND training_level='Thạc sĩ'
        AND academic_year=$3 AND status='approved' AND study_status=CASE
          WHEN COALESCE(extra_data->'tuitionPayment'->>'paid','false')='true' THEN 'Đang học' ELSE 'Đã trúng tuyển' END
      ORDER BY code`, [codes, major.id, YEAR])).rows;
    if (apply && learners.length !== 10) throw new Error(`Hậu kiểm không đủ 10 học viên: ${learners.length}.`);
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    console.log(JSON.stringify({ mode: apply ? "apply" : "preview", major: major.name,
      majorId: major.id, academicYear: YEAR, created, existing: existing.length,
      planned: names.length, verifiedLearners: learners.length, learners }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
run().catch((error) => {
  console.error(`Không tạo được hồ sơ mẫu (${error.code || error.name}).`);
  if (!error.code) console.error(error.message);
  process.exitCode = 1;
}).finally(() => client.end());
