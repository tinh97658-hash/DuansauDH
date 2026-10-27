// Preview: node src/database/seeds/clear-qlsx-to-core-subjects.cjs
// Apply:   node src/database/seeds/clear-qlsx-to-core-subjects.cjs --apply
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Sequelize, QueryTypes } = require('sequelize');
const { assertSubjectStructureEditable, assertCurriculumEditable } = require('../../../dist/plan/training-structure-integrity');
process.loadEnvFile(path.resolve(__dirname, '../../../../.env'));
const normalize = value => String(value).toLocaleLowerCase('vi').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
const keptNames = ['triet hoc', 'tieng anh', 'phuong phap nghien cuu khoa hoc', 'thuc tap chuyen nganh', 'de an tot nghiep'];

async function run() {
  assert(process.argv.slice(2).every(arg => arg === '--apply'));
  const apply = process.argv.includes('--apply');
  const db = new Sequelize(process.env.POSTGRES_DB, process.env.POSTGRES_USER, process.env.POSTGRES_PASSWORD, {
    dialect: 'postgres', host: process.env.DB_HOST, port: Number(process.env.DB_PORT), logging: false,
    dialectOptions: /^(true|1)$/i.test(process.env.DATABASE_SSL || '')
      ? { ssl: { require: true, rejectUnauthorized: true, ...(process.env.DATABASE_SSL_CA ? { ca: process.env.DATABASE_SSL_CA } : {}) } } : {},
  });
  const transaction = await db.transaction();
  try {
    const query = (sql, replacements = {}) => db.query(sql, { transaction, replacements, type: QueryTypes.SELECT });
    await query('SELECT pg_advisory_xact_lock(714062)');
    await query('LOCK TABLE subjects, curriculums, curriculum_subjects IN SHARE ROW EXCLUSIVE MODE');
    const majors = await query("SELECT id, code, name FROM majors WHERE code='QLSX' AND program='masters'");
    assert.equal(majors.length, 1);
    const major = majors[0];
    const before = await query('SELECT * FROM subjects ORDER BY id');
    const own = before.filter(row => row.major_id === major.id && row.program === 'masters');
    const keep = keptNames.map(name => {
      const matches = own.filter(row => normalize(row.name) === name);
      assert.equal(matches.length, 1, `Expected one retained course: ${name}`);
      return matches[0];
    });
    const keepIds = new Set(keep.map(row => row.id));
    const remove = own.filter(row => !keepIds.has(row.id));
    if (!remove.length) {
      await transaction.rollback();
      console.log(JSON.stringify({ applied: false, alreadyClean: true, remaining: keep.map(row => row.name) }));
      return;
    }
    const ids = remove.map(row => row.id);
    for (const id of ids) await assertSubjectStructureEditable(db, id, transaction);
    const entries = await query('SELECT * FROM curriculum_subjects WHERE subject_id IN (:ids)', { ids });
    const curriculumIds = [...new Set(entries.map(row => row.curriculum_id))];
    const curriculums = curriculumIds.length
      ? await query('SELECT * FROM curriculums WHERE id IN (:ids)', { ids: curriculumIds }) : [];
    for (const curriculum of curriculums) {
      assert.equal(curriculum.major_id, major.id, 'A removed course belongs to another specialization curriculum.');
      await assertCurriculumEditable(db, curriculum.id, transaction);
    }
    const policies = await query('SELECT * FROM course_grading_policies WHERE subject_id IN (:ids)', { ids });
    const references = await query(`SELECT tc.table_name, kcu.column_name FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.constraint_schema=kcu.constraint_schema
      JOIN information_schema.referential_constraints rc ON tc.constraint_name=rc.constraint_name AND tc.constraint_schema=rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=rc.unique_constraint_name AND ccu.constraint_schema=rc.unique_constraint_schema
      WHERE tc.constraint_type='FOREIGN KEY' AND ccu.table_name='subjects' AND tc.table_schema='public'`);
    for (const ref of references) {
      if (['curriculum_subjects', 'course_grading_policies'].includes(ref.table_name)) continue;
      assert(/^[a-z_]+$/.test(ref.table_name) && /^[a-z_]+$/.test(ref.column_name));
      const [{ count }] = await query(`SELECT COUNT(*)::int AS count FROM "${ref.table_name}" WHERE "${ref.column_name}" IN (:ids)`, { ids });
      assert.equal(count, 0, `Course still referenced by ${ref.table_name}.${ref.column_name}`);
    }
    const linked = before.filter(row => row.major_id !== major.id && row.shared_major_ids.includes(major.id)
      && remove.some(removed => normalize(removed.name) === normalize(row.name)
        && Number(removed.credits) === Number(row.credits))
      && !keep.some(retained => normalize(retained.name) === normalize(row.name)
        && Number(retained.credits) === Number(row.credits)));
    for (const row of linked) await assertSubjectStructureEditable(db, row.id, transaction);
    const backup = { major, subjects: own, curriculumSubjects: entries, curriculums, gradingPolicies: policies,
      sharingSubjects: linked, keptSubjectIds: [...keepIds] };
    let backupPath;
    if (apply) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      backupPath = path.resolve(__dirname, '../../../../docs/data-changes', `qlsx-clear-${stamp}.before.json`);
      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2) + '\n', { flag: 'wx' });
    }
    for (const row of linked) {
      await query(`UPDATE subjects SET shared_major_ids=array_remove(shared_major_ids, CAST(:majorId AS uuid)),
        allow_cross_major=cardinality(array_remove(shared_major_ids, CAST(:majorId AS uuid)))>0, updated_at=NOW()
        WHERE id=:id RETURNING id`, { majorId: major.id, id: row.id });
    }
    await query('DELETE FROM curriculum_subjects WHERE subject_id IN (:ids) RETURNING id', { ids });
    const deleted = await query('DELETE FROM subjects WHERE major_id=:majorId AND program=\'masters\' AND id IN (:ids) RETURNING id', { majorId: major.id, ids });
    assert.equal(deleted.length, ids.length);
    for (const curriculum of curriculums) await query(`UPDATE curriculums SET total_credits=(
      SELECT COALESCE(SUM(s.credits),0) FROM curriculum_subjects cs JOIN subjects s ON s.id=cs.subject_id
      WHERE cs.curriculum_id=:id), updated_at=NOW() WHERE id=:id RETURNING id`, { id: curriculum.id });
    const after = await query('SELECT * FROM subjects ORDER BY id');
    const removedIds = new Set(ids);
    const linkedIds = new Set(linked.map(row => row.id));
    const byId = new Map(before.map(row => [row.id, row]));
    assert.equal(after.length, before.length - ids.length);
    for (const row of after) {
      const original = byId.get(row.id);
      assert(!removedIds.has(row.id));
      if (linkedIds.has(row.id)) {
        const peers = original.shared_major_ids.filter(id => id !== major.id);
        assert.deepEqual(row, { ...original, shared_major_ids: peers, allow_cross_major: peers.length > 0, updated_at: row.updated_at });
      } else assert.deepEqual(row, original, 'An unrelated or retained course changed.');
    }
    const remaining = after.filter(row => row.major_id === major.id && row.program === 'masters');
    assert.equal(remaining.length, 5);
    assert.deepEqual(remaining.map(row => row.id).sort(), [...keepIds].sort());
    const updatedCurriculums = curriculumIds.length ? await query(`SELECT c.id, c.total_credits,
      COUNT(cs.id)::int AS subjects, COALESCE(SUM(s.credits),0)::int AS actual_credits FROM curriculums c
      LEFT JOIN curriculum_subjects cs ON cs.curriculum_id=c.id LEFT JOIN subjects s ON s.id=cs.subject_id
      WHERE c.id IN (:ids) GROUP BY c.id`, { ids: curriculumIds }) : [];
    for (const row of updatedCurriculums) assert.equal(row.total_credits, row.actual_credits);
    const report = { applied: apply, major, removedCount: deleted.length, removedNames: remove.map(row => row.name),
      retained: keep.map(row => ({ id: row.id, name: row.name, code: row.code_text, credits: row.credits })),
      removedCurriculumEntries: entries.length, updatedCurriculums, removedSharingLinks: linked.length, backupPath };
    if (apply) await transaction.commit();
    else await transaction.rollback();
    if (apply) fs.writeFileSync(backupPath.replace('.before.json', '.result.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  } finally {
    await db.close();
  }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
