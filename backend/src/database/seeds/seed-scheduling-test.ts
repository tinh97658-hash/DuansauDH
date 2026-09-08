import "reflect-metadata";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { environmentFiles, environmentSchema } from "../../config/configuration.js";
import { requireDevelopment, seedSchedulingTest } from "./scheduling-test-fixture.js";

async function run() {
  // Validate the root .env before importing
  // AppModule or opening a database connection. Never override NODE_ENV here.
  await ConfigModule.forRoot({
    envFilePath: environmentFiles,
    expandVariables: true,
    validate: (config) => {
      requireDevelopment(config.NODE_ENV ?? "development");
      const { value, error } = environmentSchema.validate(config);
      if (error) throw new Error("Cấu hình backend không hợp lệ. Kiểm tra DATABASE_URL và SESSION_SECRET.");
      return value;
    },
  });
  const [{ NestFactory }, { getConnectionToken }, { AppModule }, { SchedulingService }] = await Promise.all([
    import("@nestjs/core"), import("@nestjs/sequelize"), import("../../app.module.js"), import("../../scheduling/scheduling.service.js"),
  ]);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const sequelize = app.get(getConnectionToken());
    sequelize.options.logging = false;
    const result = await seedSchedulingTest(sequelize, app.get(ConfigService).get("NODE_ENV"));
    // Use the same real service as GET /scheduling/course-offering-candidates.
    const candidates = await app.get(SchedulingService).listCourseOfferingCandidates(result.scope);
    console.log(`[scheduling-test] Đã thêm ${result.created} dòng. Học phần còn cần tổ chức: ${candidates.subjects.length}.`);
    console.table(candidates.subjects.map(({ subject, eligibleClassGroups }) => ({
      code: subject.code, name: subject.name, groups: eligibleClassGroups.length,
    })));
    console.log("Chọn chuyên ngành DEV-SCHED-KTHH → năm 2026 trên trang Tạo lớp học phần.");
    console.log(`/scheduling/course-offering-candidates?${new URLSearchParams(result.scope)}`);
    if (candidates.subjects.length < 3) console.log("Seed không đặt lại dữ liệu đã thao tác. Các học phần đã được tạo lớp hoặc gói mẫu đã thay đổi có thể không còn là ứng viên.");
  } finally { await app.close(); }
}

run().catch((error) => {
  console.error(`[scheduling-test] ${error instanceof Error ? error.message : "Seed thất bại"}`);
  process.exitCode = 1;
});
