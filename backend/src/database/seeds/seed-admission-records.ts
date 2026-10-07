import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { getConnectionToken } from "@nestjs/sequelize";
import { Op } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { AppModule } from "../../app.module.js";
import { excludeCommonMajor } from "../../common/major-scope.js";

const seedTag = "admission-demo-2026";
const names = [
  "Nguyễn Văn An", "Trần Thị Bình", "Lê Minh Cường", "Phạm Ngọc Dung", "Hoàng Đức Hải", "Vũ Thu Hà",
  "Đặng Quang Huy", "Bùi Thị Hương", "Đỗ Thành Khoa", "Phan Ngọc Lan", "Nguyễn Hoài Nam", "Trần Khánh Linh",
  "Lê Quốc Phúc", "Phạm Thị Mai", "Hoàng Minh Quân", "Vũ Quỳnh Nga", "Đặng Văn Sơn", "Bùi Thu Phương",
  "Đỗ Anh Tuấn", "Phan Thị Thảo", "Nguyễn Đức Thắng", "Trần Ngọc Trang", "Lê Thanh Tùng", "Phạm Hải Yến",
  "Hoàng Quốc Việt", "Vũ Bảo Trâm", "Đặng Minh Vinh", "Bùi Thị Xuân", "Đỗ Gia Bảo", "Phan Thanh Vy",
];

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const sequelize = app.get<Sequelize>(getConnectionToken());
    sequelize.options.logging = false;
    const { Major, AdmissionRecord } = sequelize.models as any;
    const majors = await Major.findAll({
      where: { program: "masters", active: true, ...excludeCommonMajor() },
      order: [["name", "ASC"]],
    });
    if (!majors.length) throw new Error("Chưa có ngành thạc sĩ đang hoạt động để tạo hồ sơ mẫu.");
    let created = 0;
    const distribution: Record<string, number> = {};
    await sequelize.transaction(async (transaction) => {
      for (let index = 0; index < names.length; index++) {
        const code = `XT26-MAU-${String(index + 1).padStart(3, "0")}`;
        const existing = await AdmissionRecord.findOne({ where: { code }, transaction });
        if (existing && existing.extraData?.seed !== seedTag) throw new Error(`Mã ${code} đã được sử dụng bởi hồ sơ khác.`);
        const major = majors[index % majors.length];
        if (!existing) {
          const fullName = names[index];
          const birthYear = 1988 + index % 15;
          await AdmissionRecord.create({
            code, fullName, lastName: fullName.substring(0, fullName.lastIndexOf(" ")),
            firstName: fullName.substring(fullName.lastIndexOf(" ") + 1),
            dob: `${birthYear}-${String(index % 12 + 1).padStart(2, "0")}-${String(index % 27 + 1).padStart(2, "0")}`,
            gender: index % 2 === 0 ? "Nam" : "Nữ",
            phone: `090000${String(index + 1).padStart(4, "0")}`,
            email: `xt-mau-${String(index + 1).padStart(3, "0")}@example.com`,
            trainingLevel: "Thạc sĩ", academicYear: "2026", majorId: major.id, majorName: major.name,
            status: "pending", studyStatus: "Nộp hồ sơ đầu vào", receiptType: "Trực tuyến",
            nationality: "Việt Nam", ethnicity: "Kinh", city: "Hải Phòng", pob: "Hải Phòng",
            gradSchool: "Trường đại học mẫu", gradMajor: major.name, gradYear: String(birthYear + 22),
            gradDegreeType: "Chính quy", gpa: (7 + index % 20 / 10).toFixed(1),
            gradClassification: index % 3 === 0 ? "Giỏi" : "Khá", priorityObject: "Không",
            documents: {}, note: "Hồ sơ mẫu phục vụ thử nghiệm nhập điểm và xét tuyển.", extraData: { seed: seedTag },
          }, { transaction });
          created++;
        }
        const majorName = existing?.majorName || major.name;
        distribution[majorName] = (distribution[majorName] || 0) + 1;
      }
      const count = await AdmissionRecord.count({
        where: { code: { [Op.in]: names.map((_, index) => `XT26-MAU-${String(index + 1).padStart(3, "0")}`) } }, transaction,
      });
      if (count !== 30) throw new Error(`Số lượng hồ sơ mẫu không đúng: ${count}/30.`);
    });
    console.log(JSON.stringify({ created, skipped: 30 - created, academicYear: "2026", total: 30, distribution }, null, 2));
  } finally {
    await app.close();
  }
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; });
