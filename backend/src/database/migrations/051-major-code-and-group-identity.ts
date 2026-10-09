import { DataTypes, QueryTypes } from "sequelize";

export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.addColumn("majors", "code", { type: DataTypes.STRING(30), allowNull: true }, { transaction });
    await qi.addColumn("class_groups", "intake_round", { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }, { transaction });
    await qi.addColumn("class_groups", "group_number", { type: DataTypes.INTEGER, allowNull: true }, { transaction });
    const reportViews: any[] = await qi.sequelize.query("SELECT definition FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_class_lists'", { type: QueryTypes.SELECT, transaction });
    if (reportViews.length) await qi.sequelize.query('DROP VIEW public.v_class_lists', { transaction });
    await qi.changeColumn("class_groups", "code", { type: DataTypes.STRING(100), allowNull: false }, { transaction });
    if (reportViews.length) await qi.sequelize.query(`CREATE VIEW public.v_class_lists AS ${reportViews[0].definition}`, { transaction });
    const majors: any[] = await qi.sequelize.query("SELECT id, name, program FROM majors ORDER BY created_at, id", { type: QueryTypes.SELECT, transaction });
    const used = new Set<string>();
    const codes = new Map<string, string>();
    for (const major of majors) {
      const base = String(major.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d")
        .split(/[^a-zA-Z0-9]+/).filter(Boolean).map((word) => word[0]).join("").toUpperCase().slice(0, 24) || "CN";
      let code = base;
      for (let suffix = 2; used.has(`${major.program}:${code}`); suffix += 1) code = `${base}${suffix}`;
      used.add(`${major.program}:${code}`);
      codes.set(major.id, code);
      await qi.sequelize.query("UPDATE majors SET code = :code WHERE id = :id", { replacements: { code, id: major.id }, transaction });
    }
    await qi.changeColumn("majors", "code", { type: DataTypes.STRING(30), allowNull: false }, { transaction });
    await qi.addIndex("majors", ["program", "code"], { unique: true, name: "majors_program_code_unique", transaction });
    const groups: any[] = await qi.sequelize.query("SELECT id, code, name, major_id, academic_year, program FROM class_groups ORDER BY created_at, id", { type: QueryTypes.SELECT, transaction });
    // Temporarily move old codes aside so changing them cannot collide with another old code.
    for (const group of groups.filter((row) => codes.has(row.major_id) && /^\d{4}$/.test(row.academic_year))) {
      await qi.sequelize.query("UPDATE class_groups SET code = :code WHERE id = :id", { replacements: { code: `MIG-${group.id}`, id: group.id }, transaction });
    }
    const numbers = new Map<string, Set<number>>();
    for (const group of groups) {
      const majorCode = codes.get(group.major_id);
      if (!majorCode || !/^\d{4}$/.test(group.academic_year)) continue;
      const key = `${group.major_id}:${group.academic_year}`;
      const occupied = numbers.get(key) || new Set<number>();
      const oldNumber = Number(/[.\-](\d+)$/.exec(group.name)?.[1]);
      let number = oldNumber > 0 ? oldNumber : 1;
      while (occupied.has(number)) number += 1;
      occupied.add(number); numbers.set(key, occupied);
      const code = `${majorCode} ${group.academic_year}.1.${number}`;
      await qi.sequelize.query("UPDATE class_groups SET code = :code, name = :code, group_number = :number WHERE id = :id", { replacements: { code, number, id: group.id }, transaction });
    }
    await qi.addIndex("class_groups", ["major_id", "academic_year", "intake_round", "group_number"], { unique: true, name: "class_groups_major_year_round_number_unique", transaction });
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.removeIndex("class_groups", "class_groups_major_year_round_number_unique", { transaction });
    await qi.removeIndex("majors", "majors_program_code_unique", { transaction });
    await qi.removeColumn("class_groups", "group_number", { transaction });
    await qi.removeColumn("class_groups", "intake_round", { transaction });
    await qi.removeColumn("majors", "code", { transaction });
  });
}
