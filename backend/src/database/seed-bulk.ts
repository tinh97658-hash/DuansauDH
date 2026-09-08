import "reflect-metadata";
import { buildBulkFixtures, parseBulkOptions } from "./bulk-fixtures.js";

async function run() {
  const { options, preview, rollback, help } = parseBulkOptions(process.argv.slice(2));
  if (help) {
    console.log("db:seed:bulk [--preview|--rollback] [--prefix BTTEST01] [--classes 20] [--students 30] [--subjects 4] [--weeks 4] [--start YYYY-MM-DD] [--grant-scheduling-to EMAIL]");
    return;
  }
  const batches = buildBulkFixtures(options);
  console.log("[seed-bulk]", options);
  console.table(batches.map(({ model, rows }) => ({ model, count: rows.length })));
  if (preview) { console.log("Preview only: no database connection or writes."); return; }

  const [{ NestFactory }, { getConnectionToken }, { AppModule }] = await Promise.all([
    import("@nestjs/core"), import("@nestjs/sequelize"), import("../app.module.js"),
  ]);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const sequelize = app.get(getConnectionToken());
    sequelize.options.logging = false;
    const transaction = await sequelize.transaction();
    let finalizing = false;
    try {
      // Reject reruns of the same prefix; never replace an existing data set.
      const majorBatch = batches.find(({ model }) => model === "Major");
      if (!majorBatch) throw new Error("Bulk fixture is missing its Major batch.");
      for (const major of majorBatch.rows) {
        if (await sequelize.models.Major.findOne({ where: { code: major.code }, transaction }))
          throw new Error(`Prefix ${options.prefix} already exists. Choose another --prefix.`);
      }
      for (const { model, rows } of batches) {
        for (let offset = 0; offset < rows.length; offset += 500) {
          await sequelize.models[model].bulkCreate(rows.slice(offset, offset + 500), { transaction, validate: true });
        }
        const { Op } = await import("sequelize");
        let actual = 0;
        for (let offset = 0; offset < rows.length; offset += 500) {
          actual += await sequelize.models[model].count({ where: { id: { [Op.in]: rows.slice(offset, offset + 500).map((row) => row.id) } }, transaction });
        }
        if (actual !== rows.length) throw new Error(`Count mismatch for ${model}: ${actual}/${rows.length}`);
        console.log(`[seed-bulk] Verified ${model}: ${actual}`);
      }
      if (options.grantSchedulingTo) {
        const assignee = await sequelize.models.Staff.findOne({
          where: { email: options.grantSchedulingTo }, transaction, lock: transaction.LOCK.UPDATE,
        });
        if (!assignee) throw new Error(`Staff account ${options.grantSchedulingTo} does not exist.`);
        await sequelize.models.Staff.update({ canManageScheduling: false }, {
          where: { canManageScheduling: true }, transaction,
        });
        await assignee.update({ canManageScheduling: true }, { transaction });
        console.log(`[seed-bulk] Granted scheduling permission to ${options.grantSchedulingTo}.`);
      }
      if (rollback) {
        finalizing = true;
        await transaction.rollback();
        console.log("Database insert and count checks passed; all fixture writes rolled back.");
      } else {
        finalizing = true;
        await transaction.commit();
        console.log(`Saved test data. Search for ${options.prefix} in the application.`);
      }
    } catch (error) {
      if (!finalizing) await transaction.rollback();
      throw error;
    }
  } finally { await app.close(); }
}

run().catch((error) => {
  // Avoid dumping connection settings or SQL payloads on failure.
  console.error(`[seed-bulk] ${error instanceof Error ? error.message : "Failed"}`);
  process.exitCode = 1;
});
