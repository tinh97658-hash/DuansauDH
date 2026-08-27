import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import Joi from "joi";
import { AppModule } from "../app.module.js";
import { StaffService } from "../staff/staff.service.js";

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const config = app.get(ConfigService);
  const input = Joi.attempt({
    email: config.get("ADMIN_EMAIL"),
    name: config.get("ADMIN_NAME", "Administrator"),
    password: config.get("ADMIN_PASSWORD"),
  }, Joi.object({ email: Joi.string().email().required(), name: Joi.string().trim().required(), password: Joi.string().min(12).max(72).required() }));
  try {
    const result = await app.get(StaffService).seedAdmin(input.name, input.email, input.password);
    console.log(`Admin ${result.action}: ${result.email}`);
  } finally {
    await app.close();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
