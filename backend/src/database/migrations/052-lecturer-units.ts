import { randomUUID } from "node:crypto";
import { DataTypes, QueryTypes } from "sequelize";

export const collectLecturerUnits = (lecturers: Array<{ id: string; discipline_name?: string | null; faculty?: string | null }>) => {
  const units = new Map<string, { name: string; lecturerIds: string[] }>();
  for (const lecturer of lecturers) {
    // Preserve the name that was displayed in the lecturer's Unit column.
    const name = (lecturer.discipline_name || lecturer.faculty || "").normalize("NFC").trim().replace(/\s+/g, " ");
    if (!name) continue;
    const key = name.toLocaleLowerCase("vi");
    if (!units.has(key)) units.set(key, { name, lecturerIds: [] });
    units.get(key)!.lecturerIds.push(lecturer.id);
  }
  return [...units.values()];
};

export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.createTable("units", {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      code: { type: DataTypes.STRING(30), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(200), allowNull: false },
      english_name: { type: DataTypes.STRING(200), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    }, { transaction });
    await qi.addColumn("lecturers", "unit_id", {
      type: DataTypes.UUID, allowNull: true,
      references: { model: "units", key: "id" }, onUpdate: "CASCADE", onDelete: "RESTRICT",
    }, { transaction });
    await qi.addIndex("lecturers", ["unit_id"], { name: "lecturers_unit_id_idx", transaction });
    const lecturers: any[] = await qi.sequelize.query(`
      SELECT l.id, l.faculty, d.name AS discipline_name
      FROM lecturers l LEFT JOIN disciplines d ON d.id = l.discipline_id
      ORDER BY l.created_at, l.id
    `, { type: QueryTypes.SELECT, transaction });
    const units = collectLecturerUnits(lecturers);
    for (const [index, unit] of units.entries()) {
      const id = randomUUID();
      await qi.bulkInsert("units", [{ id, code: `DV${String(index + 1).padStart(3, "0")}`, name: unit.name,
        active: true, sort_order: index, created_at: new Date(), updated_at: new Date() }], { transaction });
      await qi.sequelize.query("UPDATE lecturers SET unit_id = :unitId WHERE id IN (:lecturerIds)", {
        replacements: { unitId: id, lecturerIds: unit.lecturerIds }, transaction,
      });
    }
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.removeColumn("lecturers", "unit_id", { transaction });
    await qi.dropTable("units", { transaction });
  });
}
