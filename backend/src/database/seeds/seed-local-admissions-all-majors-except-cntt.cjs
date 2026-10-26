// Preview: node src/database/seeds/seed-local-admissions-all-majors-except-cntt.cjs
// Apply:   node src/database/seeds/seed-local-admissions-all-majors-except-cntt.cjs --apply
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
process.loadEnvFile(path.resolve(__dirname, '../../../../.env'));
const MARKER = 'LOCAL-ADMISSIONS-ALL-MAJORS-EXCEPT-CNTT-20261024-V1';
const YEAR = '2026';
const BATCH_DATE = '2026-10-24';
const normalize = value => String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
const isCntt = major => String(major.code).trim().toUpperCase() === 'CNTT'
  || normalize(major.name) === 'công nghệ thông tin';
const surnames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Vũ', 'Võ', 'Đặng', 'Bùi',
  'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Đinh', 'Phan', 'Trịnh', 'Đoàn', 'Lý', 'Mai'];
const givenNames = {
  Nam: ['Minh Khang', 'Đức Anh', 'Gia Huy', 'Quang Minh', 'Hoàng Nam', 'Anh Tuấn', 'Tuấn Kiệt',
    'Quốc Bảo', 'Đăng Khoa', 'Bảo Long', 'Minh Quân', 'Thiên Phúc', 'Đức Duy', 'Hải Đăng',
    'Trung Kiên', 'Khánh Duy', 'Nhật Minh', 'Quang Huy', 'Hoài Nam', 'Mạnh Hùng'],
  Nữ: ['Ngọc Anh', 'Khánh Linh', 'Minh Châu', 'Thảo Nguyên', 'Hà My', 'Bảo Ngọc', 'Phương Anh',
    'Thanh Hà', 'Quỳnh Chi', 'Hải Yến', 'Ngọc Mai', 'Lan Anh', 'Hoài An', 'Thu Trang',
    'Diệu Linh', 'Ánh Dương', 'Tường Vy', 'Mai Phương', 'Nhật Linh', 'Thanh Trúc'],
};

async function run() {
  const args = process.argv.slice(2);
  assert(args.every(arg => arg === '--apply'), 'Only --apply is supported.');
  const apply = args.includes('--apply');
  const host = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : process.env.DB_HOST;
  assert(['localhost', '127.0.0.1', '::1', 'db'].includes(host)
    && process.env.NODE_ENV !== 'production', 'This sample-data script requires a local development database.');
  const db = new Client({ ...(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD,
  }), connectionTimeoutMillis: 5000 });
  await db.connect();
  try {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [MARKER]);
    await db.query('LOCK TABLE admission_records IN SHARE ROW EXCLUSIVE MODE');
    const majors = (await db.query(`SELECT id, code, name, program FROM majors
      WHERE active=TRUE AND is_common=FALSE ORDER BY program, code, id FOR SHARE`)).rows.filter(major => !isCntt(major));
    assert(majors.length > 0, 'No eligible specializations.');
    assert(majors.every(major => ['masters', 'doctoral'].includes(major.program)));
    const existing = (await db.query('SELECT * FROM admission_records ORDER BY id')).rows;
    const batchRows = existing.filter(row => row.extra_data?.seed === MARKER);
    const batchByCode = new Map(batchRows.map(row => [row.code, row]));
    const usedNames = new Set(existing.filter(row => row.extra_data?.seed !== MARKER).map(row => normalize(row.full_name)));
    const usedPhones = new Set(existing.filter(row => row.extra_data?.seed !== MARKER).map(row => row.phone).filter(Boolean));
    const plan = [];
    for (const [majorIndex, major] of majors.entries()) {
      for (let index = 0; index < 10; index++) {
        const serial = majorIndex * 10 + index;
        const gender = index % 2 === 0 ? 'Nam' : 'Nữ';
        const code = `HS26-2410-${major.code}-${String(index + 1).padStart(2, '0')}`;
        assert(code.length <= 50);
        const saved = batchByCode.get(code);
        let fullName = saved?.full_name;
        if (!fullName) {
          const given = givenNames[gender][(majorIndex * 5 + Math.floor(index / 2)) % givenNames[gender].length];
          for (let attempt = 0; attempt < surnames.length; attempt++) {
            const candidate = `${surnames[(serial * 7 + majorIndex + attempt) % surnames.length]} ${given}`;
            if (!usedNames.has(normalize(candidate))) { fullName = candidate; break; }
          }
        }
        assert(fullName && !usedNames.has(normalize(fullName)), 'Cannot allocate a unique natural name.');
        usedNames.add(normalize(fullName));
        const split = fullName.lastIndexOf(' ');
        let phone = saved?.phone;
        if (!phone) {
          for (let offset = 0; offset < 100; offset++) {
            const candidate = `090024${String(serial + 1 + offset * 200).padStart(4, '0')}`;
            if (candidate.length === 10 && !usedPhones.has(candidate)) { phone = candidate; break; }
          }
        }
        assert(/^[0-9]{10}$/.test(phone) && !usedPhones.has(phone));
        usedPhones.add(phone);
        const birthYear = 1991 + serial % 12;
        plan.push({ code, majorId: major.id, majorName: major.name, gender, phone, fullName,
          lastName: fullName.slice(0, split), firstName: fullName.slice(split + 1),
          email: `mau-hs26-2410-${String(serial + 1).padStart(3, '0')}@example.invalid`,
          dob: `${birthYear}-${String(serial % 12 + 1).padStart(2, '0')}-${String(serial % 27 + 1).padStart(2, '0')}`,
          trainingLevel: major.program === 'doctoral' ? 'Tiến sĩ' : 'Thạc sĩ',
          gradYear: String(birthYear + 22), gpa: (7 + serial % 21 / 10).toFixed(1),
          gradClassification: serial % 3 === 0 ? 'Giỏi' : 'Khá',
        });
      }
    }
    const byCode = new Map(plan.map(row => [row.code, row]));
    assert.equal(byCode.size, plan.length);
    assert(batchRows.every(row => byCode.has(row.code)), 'The existing batch has an unexpected record.');
    for (const row of existing) {
      if (!byCode.has(row.code)) continue;
      const expected = byCode.get(row.code);
      assert.equal(row.extra_data?.seed, MARKER, `Record code is already in use: ${row.code}`);
      assert.equal(row.major_id, expected.majorId);
      assert.equal(row.gender, expected.gender);
      assert.equal(row.academic_year, YEAR);
      assert.equal(row.status, 'pending');
      assert.equal(row.study_status, 'Nộp hồ sơ đầu vào');
    }
    const membershipsBefore = (await db.query('SELECT id,md5(to_jsonb(m)::text) AS digest FROM class_group_members m ORDER BY id')).rows;
    const protectedBefore = existing.map(row => ({ id: row.id, json: JSON.stringify(row) }));
    const created = [];
    for (const row of plan) {
      if (batchByCode.has(row.code)) continue;
      const { rows } = await db.query(`INSERT INTO admission_records
        (id,code,last_name,first_name,full_name,dob,gender,phone,email,receipt_type,profile_category,
         admission_date,is_exempt_foreign_language,training_mode_group,training_level,training_mode_name,
         major_id,major_name,language,study_status,academic_year,nationality,ethnicity,religion,city,pob,
         grad_school,grad_major,grad_year,grad_degree_type,gpa,grad_classification,priority_object,
         documents,status,note,extra_data,submitted_at,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Trực tiếp','Bình thường',$10,FALSE,'Chính quy',$11,
         'Đào tạo thông thường',$12,$13,'Tiếng Việt','Nộp hồ sơ đầu vào',$14,'Việt Nam','Kinh','Không',
         'Thành phố Hải Phòng','Hải Phòng','Trường Đại học Hàng hải Việt Nam',$13,$15,'Chính quy',
         $16,$17,'Không','{}'::json,'pending','Hồ sơ mẫu phục vụ nhập hồ sơ đầu vào.',$18::json,NOW(),NOW(),NOW())
         RETURNING id,code,full_name,gender,major_id`, [randomUUID(),row.code,row.lastName,row.firstName,
        row.fullName,row.dob,row.gender,row.phone,row.email,BATCH_DATE,row.trainingLevel,row.majorId,
        row.majorName,YEAR,row.gradYear,row.gpa,row.gradClassification,
        JSON.stringify({ seed: MARKER, sample: true, synthetic: true, batchDate: BATCH_DATE })]);
      created.push(rows[0]);
    }
    const after = (await db.query('SELECT * FROM admission_records ORDER BY id')).rows;
    const createdIds = new Set(created.map(row => row.id));
    assert.deepEqual(after.filter(row => !createdIds.has(row.id)).map(row => ({ id: row.id, json: JSON.stringify(row) })), protectedBefore,
      'An existing admission record changed.');
    assert.deepEqual((await db.query('SELECT id,md5(to_jsonb(m)::text) AS digest FROM class_group_members m ORDER BY id')).rows, membershipsBefore);
    const verified = after.filter(row => row.extra_data?.seed === MARKER);
    assert.equal(verified.length, majors.length * 10);
    const distribution = majors.map(major => {
      const rows = verified.filter(row => row.major_id === major.id);
      assert.equal(rows.length, 10);
      assert.equal(rows.filter(row => row.gender === 'Nam').length, 5);
      assert.equal(rows.filter(row => row.gender === 'Nữ').length, 5);
      assert(rows.every(row => row.status === 'pending' && row.study_status === 'Nộp hồ sơ đầu vào'
        && row.student_id === null && row.academic_year === YEAR
        && row.training_level === (major.program === 'doctoral' ? 'Tiến sĩ' : 'Thạc sĩ')));
      return { code: major.code, major: major.name, total: 10, male: 5, female: 5 };
    });
    assert.equal(new Set(verified.map(row => normalize(row.full_name))).size, plan.length);
    const report = { applied: apply, year: YEAR, specializationCount: majors.length, totalRecords: verified.length,
      created: created.length, alreadyPresent: batchRows.length, male: verified.filter(row => row.gender === 'Nam').length,
      female: verified.filter(row => row.gender === 'Nữ').length, studyStatus: 'Nộp hồ sơ đầu vào',
      excluded: 'CNTT', distribution, records: verified.map(row => ({ id: row.id, code: row.code,
        fullName: row.full_name, gender: row.gender, majorId: row.major_id })) };
    await db.query(apply ? 'COMMIT' : 'ROLLBACK');
    if (apply) {
      const reportPath = path.resolve(__dirname, '../../../../docs/data-changes/admissions-non-cntt-20261024.json');
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      if (!fs.existsSync(reportPath)) fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    }
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
