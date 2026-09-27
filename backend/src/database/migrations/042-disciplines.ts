import { DataTypes } from "sequelize";

const ts = () => ({
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
});
const uuid = { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 };

/**
 * 042 — DANH MỤC NGÀNH (cấp 1) TÁCH KHỎI CHUYÊN NGÀNH (cấp 2).
 *
 * Trước đây bảng `majors` vừa đóng vai "ngành" vừa đóng vai "chuyên ngành", nên phải dùng
 * pseudo-major `CHUNG` để chứa học phần chung cấp Viện. Nghiệp vụ đúng là hai cấp:
 *
 *   Ngành (disciplines)  ──<  Chuyên ngành (majors.discipline_id)
 *                                   └──< subjects / curriculums / class_groups …
 *
 * Bậc đào tạo (Thạc sĩ / Tiến sĩ) vẫn thuộc **chuyên ngành**: cùng một ngành có thể có
 * chuyên ngành Thạc sĩ và chuyên ngành Tiến sĩ với mã khác nhau (ví dụ `KTHH` / `KHHH-TS`).
 *
 * Migration này:
 *  1. Tạo bảng `disciplines` + gieo danh mục ngành dùng cho Viện ĐTSĐH (VMU).
 *  2. Thêm `majors.discipline_id`, gán chuyên ngành hiện có về đúng ngành.
 *  3. Tạo chuyên ngành `CHUYEN-NGANH-CHUNG` chứa học phần dùng chung cấp Viện, thay `CHUNG`.
 *  4. Xoá các chuyên ngành cũ đã gán sai, giữ lại danh mục dùng chung.
 *  5. Đổi ràng buộc mã chuyên ngành: unique toàn cục -> unique trong phạm vi một ngành.
 */

/** Ngành (cấp 1) theo danh mục BGD&ĐT, kèm các mã chuyên ngành cũ thuộc ngành đó. */
const DISCIPLINES: Array<{
  code: string;
  name: string;
  description: string;
  sortOrder: number;
  majorCodes: string[];
}> = [
  {
    code: "7480201",
    name: "Khoa học máy tính",
    description: "Ngành Khoa học máy tính — Viện Đào tạo Sau đại học, Trường Đại học Hàng hải Việt Nam.",
    sortOrder: 1,
    majorCodes: ["CNTT", "KTPM"],
  },
  {
    code: "7340101",
    name: "Quản trị kinh doanh",
    description: "Ngành Quản trị kinh doanh — Viện Đào tạo Sau đại học, Trường Đại học Hàng hải Việt Nam.",
    sortOrder: 2,
    majorCodes: ["QTKD"],
  },
  {
    code: "7840101",
    name: "Khai thác hàng hải",
    description: "Ngành Khai thác hàng hải — Viện Đào tạo Sau đại học, Trường Đại học Hàng hải Việt Nam.",
    sortOrder: 3,
    majorCodes: ["KTHH", "DKTB", "KHHH-TS"],
  },
  {
    code: "7840104",
    name: "Kinh tế vận tải",
    description: "Ngành Kinh tế vận tải — Viện Đào tạo Sau đại học, Trường Đại học Hàng hải Việt Nam.",
    sortOrder: 4,
    majorCodes: ["KTVB", "QLVT-TS"],
  },
  {
    code: "7580201",
    name: "Kỹ thuật cơ khí",
    description: "Ngành Kỹ thuật cơ khí — Viện Đào tạo Sau đại học, Trường Đại học Hàng hải Việt Nam.",
    sortOrder: 5,
    majorCodes: ["CKTB", "CKDL-TS"],
  },
  {
    code: "7580202",
    name: "Kỹ thuật tàu thủy",
    description: "Ngành Kỹ thuật tàu thủy — Viện Đào tạo Sau đại học, Trường Đại học Hàng hải Việt Nam.",
    sortOrder: 6,
    majorCodes: ["KTTC-TS"],
  },
  {
    code: "7580213",
    name: "Kỹ thuật công trình xây dựng",
    description: "Ngành Kỹ thuật công trình xây dựng — Viện Đào tạo Sau đại học, Trường Đại học Hàng hải Việt Nam.",
    sortOrder: 7,
    majorCodes: ["XDCT", "CTB-TS"],
  },
  {
    code: "7520216",
    name: "Kỹ thuật điều khiển và tự động hóa",
    description: "Ngành Kỹ thuật điều khiển và tự động hóa — Viện Đào tạo Sau đại học, Trường Đại học Hàng hải Việt Nam.",
    sortOrder: 8,
    majorCodes: ["DTDD", "TDH-TS"],
  },
  {
    code: "7480103",
    name: "Kỹ thuật phần mềm",
    description: "Ngành Kỹ thuật phần mềm — Viện Đào tạo Sau đại học, Trường Đại học Hàng hải Việt Nam.",
    sortOrder: 9,
    majorCodes: [],
  },
  {
    code: "7340201",
    name: "Kế toán",
    description: "Ngành Kế toán — Viện Đào tạo Sau đại học, Trường Đại học Hàng hải Việt Nam.",
    sortOrder: 10,
    majorCodes: [],
  },
  {
    code: "7850101",
    name: "Quản lý tài nguyên và môi trường",
    description: "Ngành Quản lý tài nguyên và môi trường (đào tạo Thạc sĩ) — Viện Đào tạo Sau đại học, Trường Đại học Hàng hải Việt Nam.",
    sortOrder: 12,
    majorCodes: [],
  },
];

/** Ngành kỹ thuật chứa chuyên ngành dùng chung — không dùng để tuyển sinh. */
const COMMON_DISCIPLINE = {
  code: "DUNG-CHUNG",
  name: "Danh mục dùng chung",
  description: "Ngành kỹ thuật chứa các chuyên ngành chỉ phục vụ khai báo danh mục dùng chung (học phần kiến thức chung cấp Viện). Không dùng để tuyển sinh, mở lớp hay gán hồ sơ học viên.",
  sortOrder: 999,
};

/** Chuyên ngành kỹ thuật chứa học phần dùng chung cấp Viện (thay pseudo-major `CHUNG`). */
const COMMON_MAJOR = {
  code: "CHUYEN-NGANH-CHUNG",
  name: "Chuyên ngành dùng chung",
  description: "Nơi lưu danh mục học phần kiến thức chung cấp Viện (triết học, ngoại ngữ, phương pháp nghiên cứu…). Không dùng để tuyển sinh, mở lớp hay gán hồ sơ học viên.",
};

export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    // ===== 1. Bảng ngành (cấp 1) =====
    await qi.createTable("disciplines", {
      id: uuid,
      code: { type: DataTypes.STRING(20), allowNull: false },
      name: { type: DataTypes.STRING(200), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      ...ts(),
    }, { transaction });
    await qi.addIndex("disciplines", ["code"], { name: "disciplines_code_unique", unique: true, transaction });

    // ===== 2. Cột liên kết trên chuyên ngành (thêm nullable trước để bơm dữ liệu) =====
    await qi.addColumn("majors", "discipline_id", {
      type: DataTypes.UUID, allowNull: true,
    }, { transaction });

    // ===== 3. Gieo danh mục ngành + ngành dùng chung (idempotent theo mã) =====
    for (const discipline of [...DISCIPLINES, COMMON_DISCIPLINE]) {
      await qi.sequelize.query(
        `INSERT INTO disciplines (id, code, name, description, sort_order, active, created_at, updated_at)
         VALUES (gen_random_uuid(), :code, :name, :description, :sortOrder, TRUE, NOW(), NOW())
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = NOW()`,
        { replacements: discipline, transaction },
      );
    }

    // ===== 4. Gán chuyên ngành hiện có về đúng ngành =====
    for (const discipline of DISCIPLINES) {
      if (!discipline.majorCodes.length) continue;
      await qi.sequelize.query(
        `UPDATE majors SET discipline_id = (SELECT id FROM disciplines WHERE code = :code), updated_at = NOW()
         WHERE discipline_id IS NULL AND code IN (:majorCodes)`,
        { replacements: { code: discipline.code, majorCodes: discipline.majorCodes }, transaction },
      );
    }

    // ===== 5. Pseudo-major `CHUNG` -> chuyên ngành dùng chung thật =====
    await qi.sequelize.query(
      `INSERT INTO majors (id, code, name, discipline_id, program, is_admission_screening, duration_years,
                           max_overtime_years, description, active, created_at, updated_at)
       VALUES (
         gen_random_uuid(), :code, :name, (SELECT id FROM disciplines WHERE code = :disciplineCode),
         'masters', FALSE, 2, 2, :description, TRUE, NOW(), NOW()
       )
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         discipline_id = EXCLUDED.discipline_id,
         description = EXCLUDED.description,
         updated_at = NOW()`,
      {
        replacements: { ...COMMON_MAJOR, disciplineCode: COMMON_DISCIPLINE.code },
        transaction,
      },
    );
    await qi.sequelize.query(
      `UPDATE subjects SET major_id = (SELECT id FROM majors WHERE code = :newCode)
       WHERE major_id = (SELECT id FROM majors WHERE code = 'CHUNG')`,
      { replacements: { newCode: COMMON_MAJOR.code }, transaction },
    );

    // ===== 6. Xoá chuyên ngành cũ theo yêu cầu nghiệp vụ =====
    // Dữ liệu phái sinh của chuyên ngành cũ được xoá trước để không vướng khoá ngoại.
    // Các bảng danh mục dùng chung (hình thức đào tạo, giảng viên, phòng học, đợt tuyển
    // sinh ở cấp chương trình đào tạo) giữ nguyên.
    await qi.sequelize.query(`DELETE FROM annual_fees WHERE plan_id IN (SELECT id FROM training_plans)`, { transaction });
    await qi.sequelize.query(`DELETE FROM admission_targets`, { transaction });
    await qi.sequelize.query(`DELETE FROM training_plans`, { transaction });
    await qi.sequelize.query(`DELETE FROM major_transfers`, { transaction });
    await qi.sequelize.query(`DELETE FROM class_groups`, { transaction });
    await qi.sequelize.query(`DELETE FROM curriculums`, { transaction });
    await qi.sequelize.query(`DELETE FROM subjects`, { transaction });
    await qi.sequelize.query(`UPDATE training_programs SET major_id = NULL`, { transaction });
    await qi.sequelize.query(`DELETE FROM majors WHERE code <> :keep`, {
      replacements: { keep: COMMON_MAJOR.code }, transaction,
    });

    // ===== 7. Bắt buộc có ngành + ràng buộc mã chuyên ngành trong phạm vi ngành =====
    // Chốt an toàn: mọi chuyên ngành còn lại nhưng chưa gán ngành đều thuộc ngành dùng chung.
    await qi.sequelize.query(
      `UPDATE majors SET discipline_id = (SELECT id FROM disciplines WHERE code = :code)
       WHERE discipline_id IS NULL`,
      { replacements: { code: COMMON_DISCIPLINE.code }, transaction },
    );
    await qi.sequelize.query(`ALTER TABLE majors ALTER COLUMN discipline_id SET NOT NULL`, { transaction });
    await qi.sequelize.query(`DROP INDEX IF EXISTS majors_code_unique`, { transaction });
    await qi.addIndex("majors", ["discipline_id", "code"], {
      name: "majors_discipline_code_unique", unique: true, transaction,
    });
    await qi.addIndex("majors", ["discipline_id"], { name: "majors_discipline_idx", transaction });
    await qi.addConstraint("majors", {
      fields: ["discipline_id"],
      type: "foreign key",
      name: "majors_discipline_id_fkey",
      references: { table: "disciplines", field: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
      transaction,
    });
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(`ALTER TABLE majors DROP CONSTRAINT IF EXISTS majors_discipline_id_fkey`, { transaction });
    await qi.sequelize.query(`DROP INDEX IF EXISTS majors_discipline_idx`, { transaction });
    await qi.sequelize.query(`DROP INDEX IF EXISTS majors_discipline_code_unique`, { transaction });
    await qi.addIndex("majors", ["code"], { name: "majors_code_unique", unique: true, transaction });
    await qi.removeColumn("majors", "discipline_id", { transaction });
    await qi.dropTable("disciplines", { transaction });
  });
}
