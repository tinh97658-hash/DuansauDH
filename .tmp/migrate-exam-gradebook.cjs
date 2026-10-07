const path = require("node:path");
const { createRequire } = require("node:module");
const backendRequire = createRequire(path.resolve(__dirname, "../backend/package.json"));
backendRequire("reflect-metadata");
const { NestFactory } = backendRequire("@nestjs/core");
const { getConnectionToken } = backendRequire("@nestjs/sequelize");
const { Umzug, SequelizeStorage } = backendRequire("umzug");
const { AppModule } = require("../backend/dist/app.module.js");

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const sequelize = app.get(getConnectionToken());
    const migrator = new Umzug({
      migrations: { glob: path.resolve(__dirname, "../backend/dist/database/migrations/*.js").replace(/\\/g, "/") },
      context: sequelize.getQueryInterface(), storage: new SequelizeStorage({ sequelize }),
    });
    const target = "050-course-exam-gradebooks.js";
    const pending = await migrator.pending();
    if (process.argv[2] === "status") console.log(JSON.stringify({ pending: pending.map((entry) => entry.name) }));
    else if (pending.some((entry) => entry.name === target)) {
      await migrator.up({ migrations: [target] });
      console.log("Applied only " + target);
    } else console.log("Exam gradebook migration already applied.");
  } finally { await app.close(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
