// Preview: node src/database/seeds/seed-local-multi-major-unassigned.cjs
// Create 50 admitted, unassigned sample records: append --apply.
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

process.loadEnvFile(path.resolve(__dirname, "../../../../.env"));
const MARKER = "LOCAL-MULTI-MAJOR-UNASSIGNED-20261017-V1";
const YEAR = "2026";
const COUNT = 50;
const apply = process.argv.includes("--apply");
const firstNames = [
  "An", "Anh", "Bảo", "Bình", "Chi", "Cường", "Dũng", "Duy", "Đạt", "Đức",
  "Giang", "Hà", "Hải", "Hạnh", "Hiếu", "Hoa", "Hoàng", "Hùng", "Huy", "Khánh",
  "Khoa", "Lan", "Linh", "Long", "Mai", "Minh", "My", "Nam", "Nga", "Ngân",
  "Ngọc", "Nhung", "Phong", "Phúc", "Phương", "Quân", "Quang", "Quyên", "Sơn", "Thảo",
  "Thắng", "Thanh", "Thiện", "Thu", "Trang", "Trinh", "Tú", "Tuấn", "Uyên", "Vân",
];
const lastNames = ["Nguyễn Minh", "Trần Ngọc", "Lê Hoàng", "Phạm Gia", "Vũ Thanh",
  "Đỗ Khánh", "Bùi Quốc", "Hoàng Hải", "Ngô Anh", "Đặng Hoài"];
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
  if (firstNames.length !== COUNT) throw new Error("Danh sách phải có đúng 50 tên.");
  await client.connect();
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [MARKER]);
    const majors = (await client.query(`SELECT id, name, code FROM majors
      WHERE active=true AND program='masters' AND is_common=false ORDER BY code, id FOR SHARE`)).rows;
    if (majors.length < 2) throw new Error("Cần ít nhất hai chuyên ngành thạc sĩ đang hoạt động.");
    const codes = firstNames.map((_, index) => `MAU-DN26-1017-${String(index + 1).padStart(3, "0")}`);
    const existing = (await client.query(`SELECT id, code, extra_data FROM admission_records
      WHERE code=ANY($1::text[]) OR extra_data->>'seed'=$2 FOR UPDATE`, [codes, MARKER])).rows;
    if (existing.some(row => row.extra_data?.seed !== MARKER || !codes.includes(row.code))) {
      throw new Error("Mã hoặc batch hồ sơ trùng dữ liệu khác; chưa ghi dữ liệu.");
    }
    const existingCodes = new Set(existing.map(row => row.code));
    if (existingCodes.size !== existing.length) throw new Error("Batch có mã hồ sơ trùng nhau.");
    let created = 0;
    const plannedDistribution = {};
    for (const [index, firstName] of firstNames.entries()) {
      const major = majors[index % majors.length];
      plannedDistribution[major.name] = (plannedDistribution[major.name] || 0) + 1;
      if (!apply || existingCodes.has(codes[index])) continue;
      const sequence = String(index + 1).padStart(3, "0");
      const lastName = lastNames[index % lastNames.length];
      await client.query(`INSERT INTO admission_records
        (id, code, last_name, first_name, full_name, dob, gender, email,
         training_level, major_id, major_name, academic_year, status, study_status,
         nationality, ethnicity, religion, city, pob, training_mode_name,
         grad_school, grad_major, grad_year, grad_degree_type, gpa, grad_classification,
         documents, note, extra_data, submitted_at, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Thạc sĩ',$9,$10,$11,'approved','Đã trúng tuyển',
          'Việt Nam','Kinh','Không','Thành phố Hải Phòng','Hải Phòng','Đào tạo thông thường',
          'Trường đại học mẫu',$10,$12,'Chính quy',$13,$14,
          '{}'::json,$15,$16::json,NOW(),NOW(),NOW())`,
      [randomUUID(), codes[index], lastName, firstName, `${lastName} ${firstName}`,
        `${1990 + index % 12}-${String(index % 12 + 1).padStart(2, "0")}-${String(index % 27 + 1).padStart(2, "0")}`,
        index % 2 === 0 ? "Nam" : "Nữ", `mau-dn26-1017-${sequence}@example.invalid`,
        major.id, major.name, YEAR, String(2012 + index % 12), (7 + index % 20 / 10).toFixed(1),
        index % 3 === 0 ? "Giỏi" : "Khá",
        `[TEST_BATCH:${MARKER}] Hồ sơ mẫu đã trúng tuyển, chưa phân lớp theo yêu cầu.`,
        JSON.stringify({ seed: MARKER, sample: true, purpose: "multi-major-unassigned-admissions" })]);
      created++;
    }
    const verified = (await client.query(`SELECT a.id, a.code, a.major_name, a.status, a.study_status,
        a.academic_year, a.training_level, a.student_id, a.major_id,
        EXISTS (SELECT 1 FROM class_group_members m WHERE m.admission_record_id=a.id
          OR (a.student_id IS NOT NULL AND m.student_id=a.student_id)) AS assigned
      FROM admission_records a WHERE a.extra_data->>'seed'=$1 ORDER BY a.code`, [MARKER])).rows;
    if (apply && (verified.length !== COUNT || verified.some(row => row.assigned
      || row.status !== "approved" || row.study_status !== "Đã trúng tuyển"
      || row.academic_year !== YEAR || row.training_level !== "Thạc sĩ" || row.student_id !== null
      || !majors.some(major => major.id === row.major_id)))) {
      throw new Error("Hậu kiểm không đủ 50 hồ sơ trúng tuyển chưa phân lớp; hoàn tác batch.");
    }
    const distribution = {};
    for (const row of verified) distribution[row.major_name] = (distribution[row.major_name] || 0) + 1;
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    console.log(JSON.stringify({ mode: apply ? "apply" : "preview", academicYear: YEAR,
      planned: COUNT, created, existing: existing.length, verified: verified.length,
      assigned: verified.filter(row => row.assigned).length,
      codeRange: [codes[0], codes.at(-1)], distribution: apply ? distribution : plannedDistribution }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
run().catch(error => {
  console.error(`Không tạo được hồ sơ mẫu (${error.code || error.name}).`);
  if (!error.code) console.error(error.message);
  process.exitCode = 1;
}).finally(() => client.end());
