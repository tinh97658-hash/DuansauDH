import "reflect-metadata";
import { ConfigModule } from "@nestjs/config";
import { getModelToken } from "@nestjs/sequelize";
import { Op } from "sequelize";
import { environmentFiles, environmentSchema } from "../../config/configuration.js";
import { AdmissionRecord } from "../models/plan/admission-record.model.js";
import { Major } from "../models/common/major.model.js";
import { StudyStatus } from "../models/common/study-status.model.js";
import { ClassGroupMember } from "../models/training/class-group-member.model.js";

const BATCH_MARKER = "LOCAL-CNTT-2026-AZ-50-V1";
const ACADEMIC_YEAR = "2026";
const RECORD_COUNT = 50;
const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "db"]);

const firstNames = [
  "An", "Anh", "Bảo", "Bình", "Chi", "Cường", "Dũng", "Duy", "Đạt", "Đức",
  "Giang", "Hà", "Hải", "Hạnh", "Hiếu", "Hoa", "Hoàng", "Hùng", "Huy", "Khánh",
  "Khoa", "Lan", "Linh", "Long", "Mai", "Minh", "My", "Nam", "Nga", "Ngân",
  "Ngọc", "Nhung", "Phong", "Phúc", "Phương", "Quân", "Quang", "Quyên", "Sơn", "Thảo",
  "Thắng", "Thanh", "Thiện", "Thu", "Trang", "Trinh", "Tú", "Tuấn", "Uyên", "Vân",
];

const lastNames = [
  "Nguyễn Văn", "Trần Minh", "Lê Hoàng", "Phạm Gia", "Vũ Đức",
  "Đỗ Anh", "Bùi Quốc", "Hoàng Hải", "Ngô Thanh", "Đặng Khánh",
];

function requireLocalDatabase(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(`Từ chối seed: DATABASE_URL không phải PostgreSQL (${parsed.protocol}).`);
  }
  if (!LOCAL_DATABASE_HOSTS.has(parsed.hostname)) {
    throw new Error(`Từ chối seed: database host không phải local (${parsed.hostname}).`);
  }
  return { host: parsed.hostname, port: parsed.port || "5432", database: parsed.pathname.slice(1) };
}

async function run() {
  if (!process.argv.includes("--apply")) {
    throw new Error("Script chỉ ghi dữ liệu khi có cờ --apply.");
  }
  if (firstNames.length !== RECORD_COUNT) throw new Error("Danh sách tên test phải có đúng 50 phần tử.");

  await ConfigModule.forRoot({
    envFilePath: environmentFiles,
    expandVariables: true,
    validate: (config) => {
      const { value, error } = environmentSchema.validate(config);
      if (error) throw new Error("Cấu hình backend không hợp lệ.");
      return value;
    },
  });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Thiếu DATABASE_URL.");
  const localDatabase = requireLocalDatabase(databaseUrl);
  console.log(`[${BATCH_MARKER}] Local PostgreSQL: ${localDatabase.host}:${localDatabase.port}/${localDatabase.database}`);

  const [{ NestFactory }, { AppModule }] = await Promise.all([
    import("@nestjs/core"),
    import("../../app.module.js"),
  ]);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const admissions = app.get<typeof AdmissionRecord>(getModelToken(AdmissionRecord));
    const majors = app.get<typeof Major>(getModelToken(Major));
    const studyStatuses = app.get<typeof StudyStatus>(getModelToken(StudyStatus));
    const classGroupMembers = app.get<typeof ClassGroupMember>(getModelToken(ClassGroupMember));
    const sequelize = admissions.sequelize;
    if (!sequelize) throw new Error("Không lấy được Sequelize connection.");
    (sequelize as unknown as { options: { logging: boolean } }).options.logging = false;

    const major = await majors.findOne({
      where: { name: "Công nghệ thông tin", program: "masters", active: true },
    });
    if (!major) throw new Error("Không tìm thấy chuyên ngành Công nghệ thông tin active bậc Thạc sĩ; không tạo dữ liệu.");

    const studyStatus = await studyStatuses.findOne({ where: { name: "Đang học", active: true } });
    if (!studyStatus) throw new Error('Danh mục không có trạng thái active "Đang học"; không tạo dữ liệu.');

    const existingBatchCount = await admissions.count({
      where: { note: { [Op.like]: `%[TEST_BATCH:${BATCH_MARKER}]%` } },
    });
    if (existingBatchCount > 0) {
      throw new Error(`Batch ${BATCH_MARKER} đã có ${existingBatchCount} hồ sơ; dừng để tránh tạo trùng.`);
    }

    const records = firstNames.map((firstName, index) => {
      const sequence = String(index + 1).padStart(3, "0");
      const lastName = lastNames[index % lastNames.length];
      return {
        planId: null,
        studentId: null,
        code: `LOCAL-CNTT26-${sequence}`,
        lastName,
        firstName,
        fullName: `${lastName} ${firstName}`,
        idCard: `TST26000${sequence}`,
        gender: index % 2 === 0 ? "Nam" : "Nữ",
        email: `local-cntt26-${sequence}@example.invalid`,
        trainingLevel: "Thạc sĩ",
        majorId: major.id,
        majorName: major.name,
        studyStatus: studyStatus.name,
        academicYear: ACADEMIC_YEAR,
        status: "approved",
        registryBookNumber: `LOCAL-CNTT26-HS-${sequence}`,
        note: `[TEST_BATCH:${BATCH_MARKER}] Học viên test local phục vụ kiểm tra sắp xếp A-Z`,
        extraData: {
          testBatch: BATCH_MARKER,
          purpose: "class-group-auto-assignment-and-a-z-sort",
          localOnly: true,
        },
      };
    });

    const identifiers = records.flatMap((record) => [record.code, record.idCard, record.email, record.registryBookNumber]);
    if (new Set(identifiers).size !== identifiers.length) throw new Error("Identifier trong batch không unique.");

    const conflicts = await admissions.count({
      where: {
        [Op.or]: [
          { code: { [Op.in]: records.map((record) => record.code) } },
          { idCard: { [Op.in]: records.map((record) => record.idCard) } },
          { email: { [Op.in]: records.map((record) => record.email) } },
          { registryBookNumber: { [Op.in]: records.map((record) => record.registryBookNumber) } },
        ],
      },
    });
    if (conflicts > 0) throw new Error(`Phát hiện ${conflicts} hồ sơ trùng identifier; không tạo dữ liệu.`);

    await sequelize.transaction(async (transaction) => {
      await admissions.bulkCreate(records, { transaction, validate: true });
    });

    const createdRecords = await admissions.findAll({
      where: {
        note: { [Op.like]: `%[TEST_BATCH:${BATCH_MARKER}]%` },
        majorId: major.id,
        academicYear: ACADEMIC_YEAR,
        studyStatus: studyStatus.name,
      },
      attributes: ["id"],
    });
    const membershipCount = await classGroupMembers.count({
      where: { admissionRecordId: { [Op.in]: createdRecords.map((record) => record.id) } },
    });

    console.log(`[${BATCH_MARKER}] Chuyên ngành: ${major.name} (${major.id})`);
    console.log(`[${BATCH_MARKER}] Trạng thái: ${studyStatus.name} (${studyStatus.code})`);
    console.log(`[${BATCH_MARKER}] Đã tạo thực tế: ${createdRecords.length} hồ sơ`);
    console.log(`[${BATCH_MARKER}] ClassGroupMember: ${membershipCount}`);
    if (createdRecords.length !== RECORD_COUNT || membershipCount !== 0) {
      throw new Error("Kết quả hậu kiểm không đúng yêu cầu.");
    }
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error(`[${BATCH_MARKER}] ${error instanceof Error ? error.message : "Seed thất bại"}`);
  process.exitCode = 1;
});
