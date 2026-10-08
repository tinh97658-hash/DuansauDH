import { QueryTypes, type Transaction } from "sequelize";
import type { Sequelize } from "sequelize-typescript";

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;
export async function databaseSnapshot(db: Sequelize, transaction?: Transaction) {
  const tables = await db.query<{ tableName: string }>('SELECT table_name AS "tableName" FROM information_schema.tables WHERE table_schema=\'public\' AND table_type=\'BASE TABLE\' ORDER BY table_name', { type: QueryTypes.SELECT, transaction });
  const counts: Record<string, number> = {};
  const fingerprints: Record<string, Map<string, string>> = {};
  for (const { tableName: table } of tables) {
    const rows = await db.query<{ key: string; hash: string }>(`SELECT COALESCE(to_jsonb(t)->>'id', to_jsonb(t)->>'name', to_jsonb(t)->>'sid', md5(to_jsonb(t)::text)) AS key, md5(to_jsonb(t)::text) AS hash FROM public.${quote(table)} t`, { type: QueryTypes.SELECT, transaction });
    counts[table] = rows.length;
    fingerprints[table] = new Map(rows.map(row => [row.key, row.hash]));
  }
  return { counts, fingerprints };
}
export function assertPreserved(before: Awaited<ReturnType<typeof databaseSnapshot>>, after: Awaited<ReturnType<typeof databaseSnapshot>>) {
  let checked = 0;
  for (const [table, rows] of Object.entries(before.fingerprints)) for (const [key, hash] of rows) {
    if (after.fingerprints[table]?.get(key) !== hash) throw new Error(`Existing row changed or missing: ${table}/${key}`);
    checked++;
  }
  return checked;
}
export async function auditForeignKeys(db: Sequelize, transaction?: Transaction) {
  const constraints = await db.query<{ name: string; child: string; parent: string; columns: string[]; parents: string[] }>(`
    SELECT c.conname name, child.relname child, parent.relname parent,
      ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(attnum,n) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum ORDER BY k.n) columns,
      ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(attnum,n) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.attnum ORDER BY k.n) parents
    FROM pg_constraint c JOIN pg_class child ON child.oid=c.conrelid JOIN pg_namespace ns ON ns.oid=child.relnamespace JOIN pg_class parent ON parent.oid=c.confrelid
    WHERE c.contype='f' AND ns.nspname='public' ORDER BY c.conname`, { type: QueryTypes.SELECT, transaction });
  for (const fk of constraints) {
    const valid = fk.columns.map(c => `child.${quote(c)} IS NOT NULL`).join(" AND ");
    const match = fk.columns.map((c, i) => `parent.${quote(fk.parents[i])}=child.${quote(c)}`).join(" AND ");
    const [row] = await db.query<{ count: number }>(`SELECT count(*)::int count FROM public.${quote(fk.child)} child WHERE ${valid} AND NOT EXISTS (SELECT 1 FROM public.${quote(fk.parent)} parent WHERE ${match})`, { type: QueryTypes.SELECT, transaction });
    if (row.count) throw new Error(`Orphan FK ${fk.name}: ${row.count}`);
  }
  return { constraintsChecked: constraints.length, orphanCount: 0 };
}

export async function auditSchedule(db: Sequelize, transaction?: Transaction) {
  // Check all sessions, including previously existing rows; conflicts use current service's period semantics.
  const checks = {
    sessionConflicts: `SELECT count(*)::int count FROM teaching_sessions a JOIN teaching_sessions b ON a.id<b.id AND a.session_date=b.session_date AND a.period=b.period WHERE a.status<>'not_held' AND b.status<>'not_held' AND (a.room_id=b.room_id OR a.lecturer_id=b.lecturer_id OR EXISTS (SELECT 1 FROM course_offering_class_groups ga JOIN course_offering_class_groups gb ON ga.class_group_id=gb.class_group_id WHERE ga.course_offering_id=a.course_offering_id AND gb.course_offering_id=b.course_offering_id))`,
    insufficientCapacity: `WITH people AS (
      SELECT og.course_offering_id, CASE WHEN COALESCE(m.student_id,a.student_id) IS NOT NULL THEN 'student:'||COALESCE(m.student_id,a.student_id)::text ELSE 'admission:'||a.id::text END identity
      FROM course_offering_class_groups og JOIN class_group_members m ON m.class_group_id=og.class_group_id LEFT JOIN admission_records a ON a.id=m.admission_record_id
      UNION SELECT os.course_offering_id, CASE WHEN a.student_id IS NOT NULL THEN 'student:'||a.student_id::text ELSE 'admission:'||a.id::text END FROM course_offering_students os JOIN admission_records a ON a.id=os.admission_record_id
    ), sizes AS (SELECT course_offering_id,count(DISTINCT identity) size FROM people GROUP BY course_offering_id)
    SELECT count(*)::int count FROM teaching_sessions s JOIN rooms r ON r.id=s.room_id LEFT JOIN sizes ON sizes.course_offering_id=s.course_offering_id WHERE r.capacity IS NULL OR COALESCE(sizes.size,0)-r.capacity>=10`,
    fixedLecturerViolations: `SELECT count(*)::int count FROM (SELECT course_offering_id FROM teaching_sessions GROUP BY course_offering_id HAVING count(DISTINCT lecturer_id)>1) t`,
    invalidCompletion: `SELECT count(*)::int count FROM course_offerings o WHERE o.status='completed' AND (NOT EXISTS (SELECT 1 FROM teaching_sessions s WHERE s.course_offering_id=o.id AND s.status='held') OR EXISTS (SELECT 1 FROM teaching_sessions s WHERE s.course_offering_id=o.id AND s.status='planned'))`,
    curriculumScopeMismatch: `SELECT count(*)::int count FROM class_groups g JOIN curriculums c ON c.id=g.curriculum_id WHERE g.major_id<>c.major_id OR g.program::text<>c.program::text OR g.academic_year<>c.applicable_from_year`,
    invalidElective: `SELECT count(*)::int count FROM class_group_electives e JOIN class_groups g ON g.id=e.class_group_id JOIN curriculum_subjects s ON s.id=e.curriculum_subject_id WHERE s.curriculum_id<>g.curriculum_id OR s.is_required`,
    overfullClasses: `SELECT count(*)::int count FROM class_groups g WHERE (SELECT count(DISTINCT admission_record_id) FROM class_group_members m WHERE m.class_group_id=g.id)>g.max_students`,
  };
  const result: Record<string, number> = {};
  for (const [key, sql] of Object.entries(checks)) {
    const [row] = await db.query<{ count: number }>(sql, { type: QueryTypes.SELECT, transaction });
    result[key] = row.count;
    if (row.count) throw new Error(`${key}: ${row.count}`);
  }
  return result;
}
