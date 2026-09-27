import "reflect-metadata";
import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import { getConnectionToken } from "@nestjs/sequelize";
import { SequelizeStorage, Umzug } from "umzug";
import { Sequelize } from "sequelize-typescript";
import { AppModule } from "../app.module.js";

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const sequelize = app.get<Sequelize>(getConnectionToken());
  const migrator = new Umzug({
    migrations: { glob: join(__dirname, "migrations", "*.js").replace(/\\/g, "/") },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
  });
  const command = process.argv[2] || "up";
  try {
    if (command === "up") await migrator.up();
    else if (command === "down") await migrator.down();
    else if (command === "status") console.log({ executed: await migrator.executed(), pending: await migrator.pending() });
    else throw new Error(`Unknown migration command: ${command}`);
  } finally {
    await app.close();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
