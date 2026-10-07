const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const backendReq = createRequire(path.resolve(__dirname, '../backend/package.json'));
const frontendReq = createRequire(path.resolve(__dirname, '../frontend/node_modules/react-scripts/package.json'));
frontendReq('dotenv-expand')(frontendReq('dotenv').config({ path: path.resolve(__dirname, '../.env') }));
const { Client } = backendReq('pg');
const rankNames = { '': null, GS: 'Giáo sư', PGS: 'Phó Giáo sư' };
const degreeNames = { TS: 'Tiến sĩ', TSKH: 'Tiến sĩ Khoa học', ThS: 'Thạc sĩ' };
const rows = fs.readFileSync(path.join(__dirname, 'lecturers-from-images.psv'), 'utf8').trim().split(/\r?\n/).slice(1).map((line, index) => {
  const fields = line.split('|');
  if (fields.length !== 6) throw new Error(`Sai số cột tại dòng ${index + 1}`);
  const [code, name, rank, degree, faculty, teachingType] = fields;
  if (!/^\d+$/.test(code) || !name || !faculty || !(rank in rankNames) || !(degree in degreeNames) || !['Cơ hữu', 'Thỉnh giảng'].includes(teachingType)) throw new Error(`Dữ liệu không hợp lệ tại dòng ${index + 1}`);
  return { code, name, academic_rank: rankNames[rank], academic_degree: degreeNames[degree], faculty, teaching_type: teachingType };
});
if (rows.length !== 159 || new Set(rows.map(row => row.code)).size !== 159) throw new Error('Danh sách phải có đúng 159 mã riêng biệt');
const apply = process.argv.includes('--apply');
if (apply && rows.some(row => row.name.includes('…'))) throw new Error('Chưa xác nhận họ tên bị cắt trong ảnh; chưa thay đổi database.');
const connection = new URL('postgres://localhost');
connection.hostname = process.env.DB_HOST;
connection.port = process.env.DB_PORT;
connection.username = process.env.POSTGRES_USER;
connection.password = process.env.POSTGRES_PASSWORD;
connection.pathname = `/${process.env.POSTGRES_DB}`;

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL || connection.toString() });
  await client.connect();
  let transaction = false;
  try {
    const identity = (await client.query('SELECT current_database() AS database, inet_server_addr() AS server')).rows[0];
    const incoming = rows.reduce((counts, row) => { counts[row.teaching_type] = (counts[row.teaching_type] || 0) + 1; return counts; }, {});
    console.log(JSON.stringify({ target: identity, incoming: rows.length, teachingTypes: incoming, unresolved: rows.filter(row => row.name.includes('…')) }, null, 2));
    if (!apply) {
      const saved = (await client.query('SELECT code,faculty FROM lecturers')).rows;
      const byCode = new Map(saved.map(row => [row.code, row.faculty]));
      console.log(JSON.stringify({ existing: saved.length, unitsMatchingSource: rows.filter(row => byCode.get(row.code) === row.faculty).length }));
      return;
    }
    await client.query('BEGIN');
    transaction = true;
    await client.query('LOCK TABLE lecturers IN ACCESS EXCLUSIVE MODE');
    await client.query('LOCK TABLE teaching_sessions IN SHARE ROW EXCLUSIVE MODE');
    const references = (await client.query('SELECT count(*) FROM teaching_sessions WHERE lecturer_id IN (SELECT id FROM lecturers)')).rows[0].count;
    if (Number(references) !== 0) throw new Error('Đã xuất hiện lịch dạy liên quan; dừng để giữ nguyên dữ liệu.');
    const previous = (await client.query('SELECT * FROM lecturers ORDER BY code')).rows;
    const backupPath = path.join(__dirname, `lecturers-before-replacement-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(backupPath, JSON.stringify({ exportedAt: new Date().toISOString(), database: identity.database, rows: previous }, null, 2), { encoding: 'utf8', flag: 'wx' });
    console.log(`Backup: ${backupPath}`);
    const removed = await client.query('DELETE FROM lecturers');
    for (const row of rows) {
      await client.query('INSERT INTO lecturers (id,code,name,academic_rank,academic_degree,faculty,teaching_type,active,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,true,NOW(),NOW())', [randomUUID(), row.code, row.name, row.academic_rank, row.academic_degree, row.faculty, row.teaching_type]);
    }
    const actual = (await client.query('SELECT code,name,academic_rank,academic_degree,faculty,teaching_type,staff_id,email,phone,title,department,discipline_id,major_id,active FROM lecturers')).rows;
    if (actual.length !== rows.length) throw new Error('Số lượng sau nhập không khớp');
    const actualByCode = new Map(actual.map(row => [row.code, row]));
    for (const row of rows) {
      const saved = actualByCode.get(row.code);
      if (!saved || Object.keys(row).some(key => saved[key] !== row[key]) || !saved.active || ['staff_id','email','phone','title','department','discipline_id','major_id'].some(key => saved[key] !== null)) throw new Error(`Dữ liệu sau nhập không khớp: ${row.code}`);
    }
    await client.query('COMMIT');
    transaction = false;
    console.log(JSON.stringify({ removed: removed.rowCount, inserted: actual.length, verified: true, backupPath }, null, 2));
  } catch (error) {
    if (transaction) await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
