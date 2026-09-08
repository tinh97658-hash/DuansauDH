const { readFileSync } = require("node:fs");
const { parseEnv } = require("node:util");
const { spawnSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");
async function run() {
  const local = parseEnv(readFileSync("../.env", "utf8"));
  const source = new URL(process.env.DATABASE_URL || local.DATABASE_URL);
  const dbName = "pgsms_test_" + randomUUID().replaceAll("-", "");
  const admin = new Client({ connectionString: source.toString() });
  await admin.connect();
  let created = false;
  try {
    await admin.query('CREATE DATABASE "' + dbName + '"'); created = true;
    source.pathname = "/" + dbName;
    const env = { ...local, ...process.env, DATABASE_URL: source.toString(), NODE_ENV: "test", RUN_POSTGRES_SCHEDULING_TESTS: "true" };
    const migrate = spawnSync(process.execPath, ["dist/database/migrate.js", "up"], { env, encoding: "utf8" });
    if (migrate.status !== 0) throw new Error(migrate.stderr || migrate.stdout);
    console.log("Applied all migrations to a disposable database.");
    const tests = spawnSync(process.execPath, ["--experimental-vm-modules", "node_modules/jest/bin/jest.js", "--config", "test/jest.config.cjs", "--runInBand", "test/integration"], { env, stdio: "inherit" });
    if (tests.error) throw tests.error;
    process.exitCode = tests.status ?? 1;
  } finally {
    if (created) await admin.query('DROP DATABASE "' + dbName + '" WITH (FORCE)');
    await admin.end();
  }
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; });
