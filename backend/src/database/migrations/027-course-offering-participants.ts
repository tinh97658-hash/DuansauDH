import { DataTypes } from "sequelize";
import type { QueryInterface } from "sequelize";

export async function up({ context: q }: { context: QueryInterface }) {
  await q.sequelize.transaction(async (transaction) => {
    await q.createTable("course_offering_participants", {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
      course_offering_id: { type: DataTypes.UUID, allowNull: false, references: { model: "course_offerings", key: "id" }, onDelete: "CASCADE" },
      identity: { type: DataTypes.STRING(50), allowNull: false },
      student_id: { type: DataTypes.UUID, allowNull: true, references: { model: "students", key: "id" }, onDelete: "RESTRICT" },
      admission_record_id: { type: DataTypes.UUID, allowNull: true, references: { model: "admission_records", key: "id" }, onDelete: "RESTRICT" },
      reg_no: { type: DataTypes.STRING(255), allowNull: false },
      full_name: { type: DataTypes.STRING(255), allowNull: false },
      note: { type: DataTypes.TEXT, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    }, { transaction });
    await q.addIndex("course_offering_participants", ["course_offering_id", "identity"], { unique: true, name: "course_offering_participants_identity_unique", transaction });
    await q.sequelize.query(
      "ALTER TABLE course_offering_participants ADD CONSTRAINT course_offering_participants_identity_check CHECK ((student_id IS NOT NULL AND identity = 'student:' || student_id::text) OR (student_id IS NULL AND admission_record_id IS NOT NULL AND identity = 'admission:' || admission_record_id::text))",
      { transaction },
    );
    // Source notes stay on the source groups. New class notes start empty.
    // Snapshot every existing offering without changing its name, sessions or source memberships.
    await q.sequelize.query(`
      INSERT INTO course_offering_participants
        (id, course_offering_id, identity, student_id, admission_record_id, reg_no, full_name, note, created_at, updated_at)
      SELECT gen_random_uuid(), roster.course_offering_id, roster.identity, roster.student_id,
             roster.admission_record_id, roster.reg_no, roster.full_name, NULL, NOW(), NOW()
      FROM (
        SELECT DISTINCT ON (link.course_offering_id, COALESCE('student:' || COALESCE(member.student_id, admission.student_id)::text, 'admission:' || member.admission_record_id::text))
          link.course_offering_id,
          COALESCE('student:' || COALESCE(member.student_id, admission.student_id)::text, 'admission:' || member.admission_record_id::text) AS identity,
          COALESCE(member.student_id, admission.student_id) AS student_id,
          member.admission_record_id,
          COALESCE(NULLIF(NULLIF(student.reg_no, ''), 'Not Set'), admission.code, '') AS reg_no,
          COALESCE(NULLIF(student.full_name, ''), admission.full_name, '') AS full_name
        FROM course_offering_class_groups link
        JOIN class_group_members member ON member.class_group_id = link.class_group_id
        LEFT JOIN admission_records admission ON admission.id = member.admission_record_id
        LEFT JOIN students student ON student.id = COALESCE(member.student_id, admission.student_id)
        WHERE COALESCE(member.student_id, admission.student_id, member.admission_record_id) IS NOT NULL
        ORDER BY link.course_offering_id, identity, member.admission_record_id NULLS LAST, member.id
      ) roster
    `, { transaction });
  });
}

export async function down() {
  throw new Error("Preserve confirmed class rosters and notes; use a reviewed backup before any rollback.");
}
