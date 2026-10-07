const path = require("node:path");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const backendRequire = createRequire(path.resolve(__dirname, "../backend/package.json"));
backendRequire("reflect-metadata");
const { NestFactory } = backendRequire("@nestjs/core");
const { getConnectionToken } = backendRequire("@nestjs/sequelize");
const { AppModule } = require("../backend/dist/app.module.js");
const { ExamGradebookService } = require("../backend/dist/masters/exam-gradebook.service.js");
const { CourseExamGradebook } = require("../backend/dist/database/models/training/course-exam-gradebook.model.js");

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const sequelize = app.get(getConnectionToken());
    sequelize.options.logging = false;
    const service = app.get(ExamGradebookService);
    const options = await service.options();
    let scope;
    for (const group of options.groups) {
      const offerings = await service.subjects(group.id);
      for (const offering of offerings) {
        const query = { classGroupId: group.id, courseOfferingId: offering.id };
        const data = await service.get(query);
        if (data.rows.length) { scope = { query, data }; break; }
      }
      if (scope) break;
    }
    assert(scope, "No populated class/subject available for the smoke check.");
    const transaction = await sequelize.transaction();
    const originalTransaction = sequelize.transaction.bind(sequelize);
    try {
      sequelize.transaction = async (callback) => callback(transaction);
      const source = scope.data.rows[0];
      const row = {
        participantId: source.participantId, eligible: source.eligible, examExempt: source.examExempt,
        testScore: 9.25, assignmentScore: source.assignmentScore, examScore: source.examScore,
        courseScore: source.courseScore, grade4: source.grade4, letterGrade: source.letterGrade,
        attemptScores: source.attemptScores, result: source.result,
      };
      await service.save({ ...scope.query, revision: scope.data.revision, rows: [row] });
      const stored = await CourseExamGradebook.findOne({ where: scope.query, transaction });
      assert.equal(stored.revision, scope.data.revision + 1);
      assert.equal(stored.grades.find((grade) => grade.participantId === source.participantId).testScore, 9.25);
      console.log(JSON.stringify({ groups: options.groups.length, rosterRows: scope.data.rows.length, saveVerified: true, rolledBack: true }));
    } finally {
      sequelize.transaction = originalTransaction;
      await transaction.rollback();
    }
    const after = await service.get(scope.query);
    assert.equal(after.revision, scope.data.revision);
  } finally { await app.close(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
