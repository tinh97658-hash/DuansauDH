// Local preview: node src/database/seeds/seed-local-cntt-session-warning.cjs
// Apply: append --apply --as-of=2026-10-09. Existing classes are never modified.
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

process.loadEnvFile(path.resolve(__dirname, "../../../../.env"));
const MARKER = "[TEST_BATCH:LOCAL-CNTT-SESSION-WARNING-V1]";
const SUBJECT_CODES = ["ITKH", "ITMA", "CNTT14"];
const apply = process.argv.includes("--apply");
const asOf = process.argv.find((arg) => arg.startsWith("--as-of="))?.slice(8)
  || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
const client = new Client({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
  database: process.env.POSTGRES_DB, user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD, connectionTimeoutMillis: 5000,
});

async function run() {
  if (!["127.0.0.1", "localhost", "::1"].includes(process.env.DB_HOST)
    || process.env.NODE_ENV === "production") throw new Error("Chỉ tạo dữ liệu mẫu trên database local, ngoài production.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(Date.parse(asOf))) throw new Error("Ngày --as-of không hợp lệ.");
  await client.connect();
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [MARKER]);
    const group = (await client.query(`
      SELECT g.*, m.discipline_id,
        (SELECT count(*)::int FROM class_group_members WHERE class_group_id=g.id) AS members
      FROM class_groups g JOIN majors m ON m.id=g.major_id
      WHERE m.name='Công nghệ thông tin' AND g.program='masters'
        AND g.academic_year='2026' AND g.status='open'
      ORDER BY g.code LIMIT 1`)).rows[0];
    if (!group) throw new Error("Không có lớp CNTT mở khóa 2026.");
    const subjects = (await client.query(`
      SELECT DISTINCT s.id, s.code, s.name, s.credits
      FROM curriculum_subjects cs JOIN subjects s ON s.id=cs.subject_id
      WHERE cs.curriculum_id=$1 AND s.code=ANY($2::text[]) AND s.active=true
        AND s.program='masters' AND s.credits IN (2,3)`, [group.curriculum_id, SUBJECT_CODES])).rows;
    if (subjects.length !== SUBJECT_CODES.length) throw new Error("Không đủ 3 học phần mẫu trong CTĐT của lớp.");
    const room = (await client.query("SELECT id FROM rooms WHERE is_active=true AND capacity >= $1 ORDER BY code LIMIT 1", [group.members])).rows[0];
    const staff = (await client.query("SELECT id FROM staff WHERE role='admin' ORDER BY created_at LIMIT 1")).rows[0];
    if (!room || !staff) throw new Error("Thiếu phòng học hoặc quản trị viên để xác nhận buổi mẫu.");
    let lecturer = (await client.query("SELECT id FROM lecturers WHERE code='DEV-CNTT-WARNING'")).rows[0];
    if (apply && !lecturer) {
      lecturer = (await client.query(`
        INSERT INTO lecturers (id,code,name,academic_degree,title,major_id,discipline_id,active,created_at,updated_at)
        VALUES ($1,'DEV-CNTT-WARNING','Giảng viên mẫu CNTT','Tiến sĩ','TS.',$2,$3,true,NOW(),NOW()) RETURNING id`,
      [randomUUID(), group.major_id, group.discipline_id])).rows[0];
    }
    const result = [];
    for (const code of SUBJECT_CODES) {
      const subject = subjects.find((s) => s.code === code);
      const existing = (await client.query(`
        SELECT o.id,o.status,(SELECT count(*)::int FROM teaching_sessions t WHERE t.course_offering_id=o.id AND t.status='held') AS held
        FROM course_offerings o JOIN course_offering_class_groups l ON l.course_offering_id=o.id
        WHERE o.note=$1 AND o.subject_id=$2 AND l.class_group_id=$3`, [MARKER, subject.id, group.id])).rows[0];
      if (existing) {
        result.push({ code, name: subject.name, credits: subject.credits, held: existing.held, status: existing.status, action: "đã có, giữ nguyên" });
        continue;
      }
      // Avoid creating duplicate subject/group teaching assignments.
      const assigned = (await client.query(`
        SELECT 1 FROM course_offerings o JOIN course_offering_class_groups l ON l.course_offering_id=o.id
        WHERE o.subject_id=$1 AND l.class_group_id=$2 LIMIT 1`, [subject.id, group.id])).rowCount;
      if (assigned) throw new Error(`${code} đã được tổ chức cho lớp; dừng để tránh tạo trùng.`);
      const offeringId = randomUUID();
      const count = subject.credits * 2;
      if (apply) {
        await client.query(`INSERT INTO course_offerings (id,subject_id,name,status,note,participant_notes,retake_weekdays,created_at,updated_at)
          VALUES ($1,$2,$3,'active',$4,'[]'::jsonb,$5,NOW(),NOW())`,
        [offeringId, subject.id, `[Mẫu] ${subject.name} - ${group.code}`, MARKER, group.allowed_weekdays]);
        await client.query(`INSERT INTO course_offering_class_groups (id,course_offering_id,class_group_id,created_at,updated_at)
          VALUES ($1,$2,$3,NOW(),NOW())`, [randomUUID(), offeringId, group.id]);
        let created = 0;
        for (let daysBack = 1; daysBack <= 180 && created < count; daysBack += 1) {
          const date = new Date(`${asOf}T00:00:00Z`);
          date.setUTCDate(date.getUTCDate() - daysBack);
          if (!group.allowed_weekdays.includes(date.getUTCDay())) continue;
          const dateKey = date.toISOString().slice(0, 10);
          for (const period of ["MORNING", "AFTERNOON"]) {
            if (created === count) break;
            const occupied = (await client.query(`
              SELECT 1 FROM teaching_sessions t WHERE t.session_date=$1 AND t.period=$2 AND t.status <> 'not_held'
                AND (t.room_id=$3 OR t.lecturer_id=$4 OR EXISTS (
                  SELECT 1 FROM course_offering_class_groups l WHERE l.course_offering_id=t.course_offering_id AND l.class_group_id=$5)) LIMIT 1`,
            [dateKey, period, room.id, lecturer.id, group.id])).rowCount;
            if (occupied) continue;
            const morning = period === "MORNING";
            await client.query(`
              INSERT INTO teaching_sessions (id,course_offering_id,session_date,start_time,end_time,period,lecturer_id,room_id,note,status,confirmed_at,confirmed_by_staff_id,created_at,updated_at)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'held',$10,$11,NOW(),NOW())`,
            [randomUUID(), offeringId, dateKey, morning ? "08:00" : "13:30", morning ? "11:30" : "17:00", period,
              lecturer.id, room.id, MARKER, `${dateKey}T${morning ? "12:00" : "17:30"}:00+07:00`, staff.id]);
            created += 1;
          }
        }
        if (created !== count) throw new Error(`Không đủ ca trống cho ${code}.`);
        const verified = (await client.query("SELECT count(*)::int AS held FROM teaching_sessions WHERE course_offering_id=$1 AND status='held' AND confirmed_at IS NOT NULL AND confirmed_by_staff_id IS NOT NULL", [offeringId])).rows[0].held;
        if (verified !== count) throw new Error(`Số buổi xác nhận của ${code} không khớp.`);
      }
      result.push({ code, name: subject.name, credits: subject.credits, held: count, status: "active", action: apply ? "đã thêm" : "sẽ thêm" });
    }
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    console.log(`${apply ? "Đã tạo dữ liệu" : "Xem trước"}: ${group.code}, khóa ${group.academic_year}.`);
    console.table(result);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => client.end());
