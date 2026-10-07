/** Làm sạch mã nhóm/CTĐT từng được sinh từ mã chuyên ngành kỹ thuật cũ. */
export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(`
      WITH affected AS (
        SELECT id, academic_year,
               ROW_NUMBER() OVER (ORDER BY academic_year, created_at, id) AS ordinal
        FROM class_groups
        WHERE code ~ 'CN-[0-9A-F]{8,}'
      )
      UPDATE class_groups AS target
      SET code = 'NH-' || COALESCE(NULLIF(affected.academic_year, ''), 'NA') || '-'
                 || LPAD(affected.ordinal::text, 3, '0'),
          updated_at = NOW()
      FROM affected
      WHERE target.id = affected.id
    `, { transaction });

    await qi.sequelize.query(`
      WITH affected AS (
        SELECT id, applicable_from_year,
               ROW_NUMBER() OVER (ORDER BY applicable_from_year, created_at, id) AS ordinal
        FROM curriculums
        WHERE code ~ 'CN-[0-9A-F]{8,}'
      )
      UPDATE curriculums AS target
      SET code = 'CT-' || COALESCE(NULLIF(affected.applicable_from_year, ''), 'NA') || '-'
                 || LPAD(affected.ordinal::text, 3, '0'),
          updated_at = NOW()
      FROM affected
      WHERE target.id = affected.id
    `, { transaction });
  });
}

export async function down() {
  // Không thể khôi phục mã kỹ thuật đã bị loại bỏ khỏi majors.
}
