import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { getConnectionToken } from "@nestjs/sequelize";
import { Sequelize } from "sequelize-typescript";
import { AppModule } from "../app.module.js";

type Row = Record<string, unknown>;

const upsertByCode = async (model: any, rows: Row[]) => {
  let created = 0, updated = 0;
  for (const row of rows) {
    const [record, wasCreated] = await model.findOrCreate({ where: { code: row.code }, defaults: row });
    if (!wasCreated) { await record.update(row); updated++; } else { created++; }
  }
  return { created, updated };
};

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const sequelize = app.get<Sequelize>(getConnectionToken());
  const results: Record<string, { created: number; updated: number }> = {};

  results.ethnicities = await upsertByCode(sequelize.models.Ethnicity, [
    { code: "KINH", name: "Kinh" }, { code: "TAY", name: "Tày" }, { code: "THAI", name: "Thái" },
    { code: "MUONG", name: "Mường" }, { code: "KHMER", name: "Khmer" }, { code: "HOA", name: "Hoa" },
    { code: "NUNG", name: "Nùng" }, { code: "HMONG", name: "H'Mông" }, { code: "DAO", name: "Dao" },
    { code: "GIA_RAI", name: "Gia Rai" }, { code: "E_DE", name: "Ê Đê" }, { code: "BA_NA", name: "Ba Na" },
    { code: "SAN_CHAY", name: "Sán Chay" }, { code: "CHAM", name: "Chăm" }, { code: "XO_DANG", name: "Xơ Đăng" },
  ]);

  results.nationalities = await upsertByCode(sequelize.models.Nationality, [
    { code: "VN", name: "Việt Nam" }, { code: "CN", name: "Trung Quốc" }, { code: "US", name: "Hoa Kỳ" },
    { code: "GB", name: "Vương quốc Anh" }, { code: "FR", name: "Pháp" }, { code: "JP", name: "Nhật Bản" },
    { code: "KR", name: "Hàn Quốc" }, { code: "LA", name: "Lào" }, { code: "KH", name: "Campuchia" },
    { code: "TH", name: "Thái Lan" }, { code: "AU", name: "Úc" }, { code: "DE", name: "Đức" },
  ]);

  results.cities = await upsertByCode(sequelize.models.City, [
    { code: "HN", name: "Hà Nội" }, { code: "HCM", name: "TP. Hồ Chí Minh" }, { code: "HP", name: "Hải Phòng" },
    { code: "DN", name: "Đà Nẵng" }, { code: "CT", name: "Cần Thơ" }, { code: "QN", name: "Quảng Ninh" },
    { code: "HD", name: "Hải Dương" }, { code: "HY", name: "Hưng Yên" }, { code: "NB", name: "Ninh Bình" },
    { code: "TH", name: "Thanh Hóa" }, { code: "NA", name: "Nghệ An" }, { code: "HUE", name: "Thừa Thiên Huế" },
    { code: "QNA", name: "Quảng Nam" }, { code: "KH", name: "Khánh Hòa" }, { code: "DL", name: "Đắk Lắk" },
    { code: "LD", name: "Lâm Đồng" }, { code: "BD", name: "Bình Dương" }, { code: "DNG", name: "Đồng Nai" },
  ]);

  results.trainingModeGroups = await upsertByCode(sequelize.models.TrainingModeGroup, [
    { code: "CQ", name: "Chính quy" }, { code: "TC", name: "Tại chức" }, { code: "TX", name: "Từ xa" },
    { code: "LT", name: "Liên thông" },
  ]);

  results.trainingModes = await upsertByCode(sequelize.models.TrainingMode, [
    { code: "CQ_TT", name: "Chính quy - Tập trung", groupId: null },
    { code: "CQ_VB2", name: "Chính quy - Văn bằng 2", groupId: null },
    { code: "TC", name: "Tại chức", groupId: null },
    { code: "TX", name: "Đào tạo từ xa", groupId: null },
  ]);

  results.trainingLevels = await upsertByCode(sequelize.models.TrainingLevel, [
    { code: "MASTER", name: "Thạc sĩ", durationYears: 2 },
    { code: "DOCTOR", name: "Tiến sĩ", durationYears: 3 },
  ]);

  const masterLevel = await sequelize.models.TrainingLevel.findOne({ where: { code: "MASTER" } });
  const masterLevelId = masterLevel?.get("id") as string | undefined;

  results.majors = await upsertByCode(sequelize.models.Major, [
    { code: "KTHH", name: "Khai thác hàng hải", program: "masters", trainingLevelId: masterLevelId || null },
    { code: "DKTB", name: "Điều khiển tàu biển", program: "masters", trainingLevelId: masterLevelId || null },
    { code: "CKTB", name: "Kỹ thuật cơ khí", program: "masters", trainingLevelId: masterLevelId || null },
    { code: "DTDD", name: "Kỹ thuật điện - Điện tử", program: "masters", trainingLevelId: masterLevelId || null },
    { code: "KTVB", name: "Kinh tế vận tải biển", program: "masters", trainingLevelId: masterLevelId || null },
    { code: "XDCT", name: "Xây dựng công trình thủy", program: "masters", trainingLevelId: masterLevelId || null },
  ]);

  results.studyStatuses = await upsertByCode(sequelize.models.StudyStatus, [
    { code: "STUDYING", name: "Đang học" }, { code: "RESERVE", name: "Bảo lưu" },
    { code: "SUSPENDED", name: "Tạm dừng" }, { code: "COMPLETED", name: "Hoàn thành" },
    { code: "DROPPED", name: "Thôi học" }, { code: "GRADUATED", name: "Tốt nghiệp" },
  ]);

  results.bridgeSubjects = await upsertByCode(sequelize.models.BridgeKnowledgeSubject, [
    { code: "TOAN", name: "Toán cao cấp", credits: 3 },
    { code: "TA", name: "Tiếng Anh học thuật", credits: 3 },
    { code: "PPNC", name: "Phương pháp nghiên cứu khoa học", credits: 2 },
    { code: "TH", name: "Tin học cơ sở", credits: 2 },
  ]);

  for (const [key, value] of Object.entries(results)) {
    console.log(`Seeded ${key}: created=${value.created}, updated=${value.updated}`);
  }
  await app.close();
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
