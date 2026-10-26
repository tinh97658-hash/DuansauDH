const assert = require('node:assert/strict');
const { QueryTypes } = require('sequelize');
const { assertSubjectStructureEditable } = require('../../../dist/plan/training-structure-integrity');

const normalize = value => String(value).normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
const isSeparate = subject => ['TT', 'TN'].includes(subject.subject_type)
  || /^(thực tập|đề án tốt nghiệp|đồ án tốt nghiệp)(\s|$)/i.test(normalize(subject.name));

async function shareCatalogSubjects(db, transaction, majorId, program, names) {
  const query = (sql, replacements = {}) => db.query(sql, { replacements, transaction, type: QueryTypes.SELECT });
  const snapshotSql = `SELECT id,
    md5((to_jsonb(s) - 'shared_major_ids' - 'allow_cross_major' - 'updated_at')::text) AS digest
    FROM subjects s ORDER BY id`;
  const before = await query(snapshotSql);
  const rows = await query(`SELECT s.*, m.name AS major_name FROM subjects s JOIN majors m ON m.id=s.major_id
    WHERE s.program=:program AND s.active=TRUE AND m.program=:program AND m.active=TRUE AND m.is_common=FALSE`, { program });
  const importedNames = new Set(names.map(normalize));
  const sourceRows = rows.filter(row => row.major_id === majorId && importedNames.has(normalize(row.name)));
  const groups = [];
  const updates = [];
  const differentCredits = [];
  for (const source of sourceRows) {
    if (isSeparate(source)) {
      assert.equal(source.allow_cross_major, false, `Excluded course is already shared: ${source.name}`);
      assert.equal(source.shared_major_ids.length, 0, `Excluded course has shared majors: ${source.name}`);
      continue;
    }
    const sameName = rows.filter(row => normalize(row.name) === normalize(source.name) && !isSeparate(row));
    const members = sameName.filter(row => Number(row.credits) === Number(source.credits));
    const majorIds = [...new Set(members.map(row => row.major_id))];
    assert.equal(majorIds.length, members.length, `More than one matching course per major: ${source.name}`);
    differentCredits.push(...sameName.filter(row => Number(row.credits) !== Number(source.credits))
      .map(row => ({ name: source.name, major: row.major_name, credits: row.credits })));
    if (majorIds.length < 2) continue;
    groups.push({ name: source.name, credits: source.credits,
      otherMajors: members.filter(row => row.major_id !== majorId).map(row => row.major_name) });
    for (const member of members) {
      const sharedMajorIds = [...new Set([...member.shared_major_ids, ...majorIds.filter(id => id !== member.major_id)])];
      if (member.allow_cross_major && sharedMajorIds.length === member.shared_major_ids.length) continue;
      assert.equal(member.canonical_subject_id, null, `Cannot change canonical alias sharing: ${member.name}`);
      await assertSubjectStructureEditable(db, member.id, transaction);
      const [updated] = await query(`UPDATE subjects SET allow_cross_major=TRUE,
        shared_major_ids=ARRAY(SELECT jsonb_array_elements_text(CAST(:majorIds AS jsonb))::uuid), updated_at=NOW()
        WHERE id=:id RETURNING shared_major_ids`, { id: member.id, majorIds: JSON.stringify(sharedMajorIds) });
      assert.deepEqual([...updated.shared_major_ids].sort(), [...sharedMajorIds].sort());
      updates.push({ id: member.id, name: member.name, major: member.major_name,
        previousAllowCrossMajor: member.allow_cross_major, previousSharedMajorIds: member.shared_major_ids,
        sharedMajorIds });
    }
  }
  assert.deepEqual(await query(snapshotSql), before, 'Sharing changed unrelated subject fields.');
  const after = await query('SELECT id, shared_major_ids, allow_cross_major FROM subjects WHERE program=:program', { program });
  const byId = new Map(after.map(row => [row.id, row]));
  for (const source of sourceRows.filter(row => !isSeparate(row))) {
    const matches = rows.filter(row => normalize(row.name) === normalize(source.name)
      && Number(row.credits) === Number(source.credits) && !isSeparate(row));
    for (const member of matches) for (const counterpart of matches) {
      if (member.major_id !== counterpart.major_id) {
        assert(byId.get(member.id).allow_cross_major);
        assert(byId.get(member.id).shared_major_ids.includes(counterpart.major_id));
      }
    }
  }
  return { groups, updates, differentCredits, excludedCourses: sourceRows.filter(isSeparate).map(row => row.name) };
}

module.exports = { shareCatalogSubjects };
