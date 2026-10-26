// Preview: node src/database/seeds/import-dtvt-2025-subjects.cjs
// Apply:   node src/database/seeds/import-dtvt-2025-subjects.cjs --apply
// Imports the catalog from Table 7.2 only; does not create a cohort curriculum.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Sequelize, QueryTypes } = require('sequelize');
process.loadEnvFile(path.resolve(__dirname, '../../../../.env'));

const normalize = (value) => String(value).normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
const identity = (row) => JSON.stringify([Number(row.codeNumber), row.codeText, normalize(row.name), Number(row.credits)]);

async function importSubjectCatalog(manifest, reportName) {
  const args = process.argv.slice(2);
  assert(args.every(arg => arg === '--apply'), 'Only --apply is supported.');
  const apply = args.includes('--apply');
  assert.equal(manifest.subjects.length, manifest.sourceRows - manifest.duplicatesRemoved.length);
  assert.equal(new Set(manifest.subjects.map(identity)).size, manifest.subjects.length);
  const db = new Sequelize(process.env.POSTGRES_DB, process.env.POSTGRES_USER, process.env.POSTGRES_PASSWORD, {
    dialect: 'postgres', host: process.env.DB_HOST, port: Number(process.env.DB_PORT), logging: false,
    dialectOptions: /^(true|1)$/i.test(process.env.DATABASE_SSL || '')
      ? { ssl: { require: true, rejectUnauthorized: false } } : {},
  });
  const transaction = await db.transaction();
  try {
    if (manifest.enableSharedLearning) await db.query('SELECT pg_advisory_xact_lock(714062)', { transaction });
    await db.query('LOCK TABLE subjects IN SHARE ROW EXCLUSIVE MODE', { transaction });
    const query = (sql, replacements = {}) => db.query(sql, { replacements, transaction, type: QueryTypes.SELECT });
    const majors = await query('SELECT id, name FROM majors WHERE code=:code AND program=:program', {
      code: manifest.majorCode, program: manifest.program,
    });
    assert.equal(majors.length, 1, `Expected exactly one ${manifest.majorCode} ${manifest.program} specialization.`);
    const major = majors[0];
    const before = await query('SELECT id, md5(to_jsonb(s)::text) AS digest FROM subjects s ORDER BY id');
    const existing = await query('SELECT * FROM subjects WHERE major_id=:majorId AND program=:program', {
      majorId: major.id, program: manifest.program,
    });
    const inserted = [];
    const skipped = [];
    for (const [index, subject] of manifest.subjects.entries()) {
      const matches = existing.filter(row => identity({
        codeNumber: row.code_number, codeText: row.code_text, name: row.name, credits: row.credits,
      }) === identity(subject));
      assert(matches.length <= 1, `Existing duplicate: ${subject.name}`);
      if (matches.length) {
        const row = matches[0];
        assert.equal(row.subject_type, subject.subjectType, `Group mismatch: ${subject.name}`);
        assert.equal(row.is_required, subject.isRequired, `Required flag mismatch: ${subject.name}`);
        skipped.push({ id: row.id, name: row.name });
        continue;
      }
      assert(!existing.some(row => normalize(row.name) === normalize(subject.name)
        || (Number(row.code_number) === subject.codeNumber && row.code_text === subject.codeText)),
      `Conflicting existing course: ${subject.name}`);
      const rows = await query(`INSERT INTO subjects
        (id, code, code_number, code_text, name, major_id, program, credits, major_assignment,
         subject_type, is_required, sort_order, active, canonical_subject_id, allow_cross_major,
         shared_major_ids, created_at, updated_at)
        VALUES (gen_random_uuid(), :codeText, :codeNumber, :codeText, :name, :majorId, :program,
          :credits, :majorAssignment, :subjectType, :isRequired, :sortOrder, TRUE, NULL, FALSE,
          ARRAY[]::uuid[], NOW(), NOW()) RETURNING id, name`, {
        ...subject, majorId: major.id, program: manifest.program, sortOrder: index + 1,
      });
      inserted.push(rows[0]);
    }
    const after = await query('SELECT id, md5(to_jsonb(s)::text) AS digest FROM subjects s ORDER BY id');
    const insertedIds = new Set(inserted.map(row => row.id));
    assert.deepEqual(after.filter(row => !insertedIds.has(row.id)), before, 'Existing courses changed.');
    const final = await query('SELECT id, code_number, code_text, name, credits, subject_type, is_required, major_assignment FROM subjects WHERE major_id=:majorId AND program=:program', {
      majorId: major.id, program: manifest.program,
    });
    for (const subject of manifest.subjects) {
      const matches = final.filter(row => identity({ codeNumber: row.code_number, codeText: row.code_text, name: row.name, credits: row.credits }) === identity(subject));
      assert.equal(matches.length, 1, `Missing or duplicate: ${subject.name}`);
      assert.equal(matches[0].subject_type, subject.subjectType);
      assert.equal(matches[0].is_required, subject.isRequired);
      if (insertedIds.has(matches[0].id)) assert.equal(matches[0].major_assignment, true);
    }
    const sharing = manifest.enableSharedLearning
      ? await require('./subject-catalog-sharing.cjs').shareCatalogSubjects(
        db, transaction, major.id, manifest.program, manifest.subjects.map(subject => subject.name),
      ) : undefined;
    const report = { applied: apply, major, sourceRows: manifest.sourceRows,
      uniqueSourceSubjects: manifest.subjects.length, duplicatesRemoved: manifest.duplicatesRemoved,
      sourceCodeConflicts: manifest.sourceCodeConflicts || [],
      existingPreserved: skipped, inserted, finalCatalogCount: final.length, sharing };
    if (apply) await transaction.commit();
    else await transaction.rollback();
    if (apply) {
      const reportPath = path.resolve(__dirname, '../../../../docs/imports', reportName);
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    }
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  } finally {
    await db.close();
  }
}
module.exports = { importSubjectCatalog };
if (require.main === module) {
  importSubjectCatalog(require('./dtvt-2025-subjects.json'), 'dtvt-2025-subjects.json')
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
