import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { getConnectionToken } from "@nestjs/sequelize";
import { Op, QueryTypes } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { AppModule } from "../../app.module.js";
import { COMMON_MAJOR_CODE } from "../../common/major-scope.js";
import { teachingUnitForSubject, teachingUnits } from "../../scheduling/lecturer-qualification.policy.js";

const lecturerNames = [
  "Nguyễn Thị Minh Anh", "Trần Thu Hà", "Lê Hoàng Phương",
  "Phạm Văn Thành", "Vũ Thị Hương", "Đỗ Minh Đức",
  "Bùi Quang Huy", "Nguyễn Đức Thắng", "Trần Hải Nam",
  "Lê Minh Tuấn", "Phạm Ngọc Linh", "Nguyễn Thùy Dương",
  "Hoàng Văn Khánh", "Đặng Quốc Bảo", "Vũ Anh Dũng",
  "Trần Mạnh Cường", "Nguyễn Xuân Hải", "Phạm Đức Long",
  "Lê Thanh Tùng", "Bùi Thị Mai", "Đỗ Quang Vinh",
  "Nguyễn Hữu Phúc", "Trần Văn Sơn", "Phạm Tuấn Anh",
  "Vũ Thị Thanh Nga", "Lê Đức Mạnh", "Hoàng Minh Châu",
  "Đặng Thị Hồng", "Nguyễn Thành Công", "Bùi Quốc Việt",
  "Trần Thị Lan Anh", "Phạm Minh Hoàng", "Lê Quỳnh Trang",
  "Nguyễn Văn Hưng", "Vũ Thị Thu Trang", "Đỗ Hải Đăng",
  "Bùi Văn Kiên", "Trần Ngọc Mai", "Phạm Quốc Trung",
  "Lê Anh Khoa", "Nguyễn Thị Phương Thảo", "Hoàng Gia Bảo",
  "Đặng Văn Tài", "Vũ Ngọc Anh", "Trần Minh Quân",
  "Phạm Thị Bích Ngọc", "Lê Quốc Cường", "Nguyễn Hoài Nam",
];

const legacyCode = (code: string) => code.startsWith("BTDEMO26GV") || code === "DEV-SCHED-GV";
const extraName = (index: number) => {
  const surnames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Đỗ", "Phan"];
  const middles = ["Văn", "Thị", "Minh", "Quang", "Ngọc", "Đức", "Thanh", "Hữu", "Hoài", "Xuân", "Gia"];
  const given = ["An", "Bình", "Cường", "Dũng", "Giang", "Hải", "Hiếu", "Huy", "Khánh", "Long", "Mai", "Nam", "Phúc", "Sơn", "Thắng", "Trang", "Tùng", "Việt", "Vinh", "Yến", "Khoa", "Linh", "Thảo"];
  return `${surnames[index % surnames.length]} ${middles[Math.floor(index / surnames.length) % middles.length]} ${given[index % given.length]}`;
};

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const sequelize = app.get<Sequelize>(getConnectionToken());
    sequelize.options.logging = false;
    const { Major, Lecturer } = sequelize.models as any;
    const majors = await Major.findAll({
      where: { active: true, code: { [Op.ne]: COMMON_MAJOR_CODE } },
      order: [["program", "ASC"], ["code", "ASC"]],
    });
    const unsupported = majors.filter((major: any) => !teachingUnits[major.code]);
    if (unsupported.length) throw new Error(`Chưa cấu hình đơn vị cho chuyên ngành: ${unsupported.map((major: any) => major.code).join(", ")}`);
    const desired = majors.flatMap((major: any, majorIndex: number) => [0, 1, 2, 3, 4, 5].map((index) => ({
      code: `GV-${major.code}-${String(index + 1).padStart(2, "0")}`,
      name: index < 3 ? lecturerNames[majorIndex * 3 + index] : extraName(majorIndex * 6 + index + 100),
      email: `gv.${major.code.toLowerCase().replace(/[^a-z0-9]/g, "")}.${index + 1}@vimaru.edu.vn`,
      phone: `09${String(20000000 + majorIndex * 6 + index).padStart(8, "0")}`,
      academicRank: index % 2 === 0 ? "Phó Giáo sư" : null,
      academicDegree: "Tiến sĩ",
      teachingType: index % 2 === 1 ? "Thỉnh giảng" : "Cơ hữu",
      title: index % 2 === 0 ? "Trưởng bộ môn" : "Giảng viên",
      faculty: teachingUnits[major.code].faculty,
      department: teachingUnits[major.code].departments[Math.floor(index / 2)],
      active: true,
    })));

    await sequelize.transaction(async (transaction) => {
      const existingDesired = new Set((await Lecturer.findAll({
        where: { code: { [Op.in]: desired.map((row: any) => row.code) } }, attributes: ["code"], transaction,
      })).map((row: any) => row.code));
      const legacy = await Lecturer.findAll({ order: [["code", "ASC"]], transaction, lock: transaction.LOCK.UPDATE });
      const reusable = legacy.filter((row: any) => legacyCode(row.code));

      let migrated = 0;
      let created = 0;
      let updated = 0;
      for (const data of desired) {
        const current = await Lecturer.findOne({ where: { code: data.code }, transaction, lock: transaction.LOCK.UPDATE });
        if (current) {
          await current.update({ faculty: data.faculty, department: data.department, active: true }, { transaction });
          updated++;
          continue;
        }
        const replacement = reusable.shift();
        if (replacement && !existingDesired.has(data.code)) {
          await replacement.update(data, { transaction });
          migrated++;
        } else {
          await Lecturer.create(data, { transaction });
          created++;
        }
      }
      for (const obsolete of reusable) await obsolete.destroy({ transaction });
      const offerings: any[] = await sequelize.query(
        `SELECT co.id, s.id subject_id, s.name subject_name, s.subject_type, m.code major_code,
                array_agg(DISTINCT ts.session_date::text || '|' || ts.period) FILTER (WHERE ts.id IS NOT NULL) slots
         FROM course_offerings co
         JOIN subjects s ON s.id = co.subject_id
         JOIN majors m ON m.id = s.major_id
         LEFT JOIN teaching_sessions ts ON ts.course_offering_id = co.id
         GROUP BY co.id, s.id, s.name, s.subject_type, m.code
         HAVING count(ts.id) > 0
         ORDER BY min(ts.session_date), co.id`,
        { type: QueryTypes.SELECT, transaction },
      );
      const allLecturers = await Lecturer.findAll({ where: { active: true }, transaction });
      const occupied = new Map<string, Set<string>>();
      let repairedOfferings = 0;
      for (const offering of offerings) {
        const unit = teachingUnitForSubject(offering.major_code, { id: offering.subject_id, name: offering.subject_name, subjectType: offering.subject_type });
        if (!unit) continue;
        const exact = allLecturers.filter((row: any) => row.faculty === unit.faculty && row.department === unit.department);
        const faculty = allLecturers.filter((row: any) => row.faculty === unit.faculty);
        const pool = exact.length ? exact : faculty;
        if (!pool.length) continue;
        const preferredCode = offering.major_code === "CNT" && String(offering.subject_name).toLocaleLowerCase("vi").includes("python") ? "GV-CNT-02" : "";
        const ranked = [...pool].sort((a: any, b: any) => Number(b.code === preferredCode) - Number(a.code === preferredCode)
          || (occupied.get(a.id)?.size || 0) - (occupied.get(b.id)?.size || 0) || a.code.localeCompare(b.code));
        const slots: string[] = offering.slots || [];
        const selected = ranked.find((row: any) => slots.every((slot) => !occupied.get(row.id)?.has(slot))) || ranked[0];
        const used = occupied.get(selected.id) || new Set<string>();
        slots.forEach((slot) => used.add(slot));
        occupied.set(selected.id, used);
        await sequelize.query(`UPDATE teaching_sessions SET lecturer_id = :lecturerId, updated_at = NOW() WHERE course_offering_id = :offeringId`, {
          replacements: { lecturerId: selected.id, offeringId: offering.id }, transaction,
        });
        repairedOfferings++;
      }
      console.log(`[seed-lecturers] majors=${majors.length}, lecturers=${desired.length}, migrated=${migrated}, created=${created}, updated=${updated}, removed=${reusable.length}, repairedOfferings=${repairedOfferings}`);
    });
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error(`[seed-lecturers] ${error instanceof Error ? error.message : "Failed"}`);
  process.exitCode = 1;
});
