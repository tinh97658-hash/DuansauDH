import { DataTypes } from "sequelize";
import type { QueryInterface } from "sequelize";

export async function up({ context: q }: { context: QueryInterface }) {
  const offeringColumns = await q.describeTable("course_offerings");
  await q.sequelize.transaction(async (transaction) => {
    await q.addColumn("class_groups", "parent_group_id", {
      type: DataTypes.UUID, allowNull: true,
      references: { model: "class_groups", key: "id" }, onDelete: "RESTRICT",
    }, { transaction });
    await q.addIndex("class_groups", ["parent_group_id"], { transaction });
    await q.sequelize.query("ALTER TABLE class_groups ADD CONSTRAINT class_groups_not_own_parent CHECK (parent_group_id IS NULL OR parent_group_id <> id)", { transaction });
    for (const [table, units, unitType] of [["subjects", "teaching_units", "teaching_unit_type"], ["course_offerings", "planned_units", "unit_type"]]) {
      await q.addColumn(table, units, { type: DataTypes.INTEGER, allowNull: true }, { transaction });
      await q.addColumn(table, unitType, { type: DataTypes.STRING(10), allowNull: true }, { transaction });
      await q.sequelize.query("ALTER TABLE " + table + " ADD CONSTRAINT " + table + "_units_check CHECK ((" + units + " IS NULL AND " + unitType + " IS NULL) OR (" + units + " IS NOT NULL AND " + unitType + " IS NOT NULL AND " + units + " > 0 AND " + unitType + " IN ('hours', 'periods')))", { transaction });
    }
    if (!offeringColumns.name) {
      await q.addColumn("course_offerings", "name", { type: DataTypes.STRING(200), allowNull: true }, { transaction });
    }
    await q.sequelize.query("UPDATE course_offerings o SET name = LEFT(s.code || ' · ' || s.name, 200) FROM subjects s WHERE s.id = o.subject_id AND (o.name IS NULL OR length(btrim(o.name)) = 0)", { transaction });
    await q.sequelize.query("ALTER TABLE course_offerings ALTER COLUMN name SET NOT NULL", { transaction });
    await q.sequelize.query("ALTER TABLE course_offerings ADD CONSTRAINT course_offerings_name_check CHECK (length(btrim(name)) > 0)", { transaction });
    await q.addColumn("course_offerings", "term", { type: DataTypes.STRING(20), allowNull: true }, { transaction });
    await q.addColumn("teaching_sessions", "is_scheduled", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, { transaction });
    await q.addColumn("teaching_sessions", "sequence_number", { type: DataTypes.INTEGER, allowNull: true }, { transaction });
    await q.addColumn("teaching_sessions", "planned_units", { type: DataTypes.INTEGER, allowNull: true }, { transaction });
    // Preserve existing enum types, foreign keys and rows.
    for (const column of ["session_date", "start_time", "end_time", "period", "room_id", "lecturer_id"]) {
      await q.sequelize.query("ALTER TABLE teaching_sessions ALTER COLUMN " + column + " DROP NOT NULL", { transaction });
    }
    await q.sequelize.query("ALTER TABLE teaching_sessions ADD CONSTRAINT teaching_sessions_allocation_check CHECK ((is_scheduled AND session_date IS NOT NULL AND start_time IS NOT NULL AND end_time IS NOT NULL AND period IS NOT NULL AND room_id IS NOT NULL AND lecturer_id IS NOT NULL) OR (NOT is_scheduled AND status = 'planned' AND session_date IS NULL AND start_time IS NULL AND end_time IS NULL AND period IS NULL AND room_id IS NULL AND lecturer_id IS NULL AND sequence_number IS NOT NULL AND planned_units IS NOT NULL))", { transaction });
    await q.sequelize.query("ALTER TABLE teaching_sessions ADD CONSTRAINT teaching_sessions_units_check CHECK ((sequence_number IS NULL OR sequence_number > 0) AND (planned_units IS NULL OR planned_units > 0))", { transaction });
    await q.addIndex("teaching_sessions", ["course_offering_id", "sequence_number"], { unique: true, name: "teaching_sessions_offering_sequence_unique", transaction });
  });
}
export async function down() {
  throw new Error("Migration 025 contains class memberships and unscheduled lessons. Use a reviewed backup to roll back without discarding business data.");
}
