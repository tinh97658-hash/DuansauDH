import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import compression from "compression";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { AllExceptionsFilter } from "./common/all-exceptions.filter.js";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const express = app.getHttpAdapter().getInstance();
  const trustProxy = config.get<number>("TRUST_PROXY", 0);

  if (trustProxy) express.set("trust proxy", trustProxy);
  express.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(compression());
  app.enableCors({
    origin: String(config.get("FRONTEND_URL")).replace(/\/$/, ""),
    credentials: true,
    methods: ["GET", "POST", "DELETE", "PUT", "PATCH"],
  });
  app.useBodyParser("json", { limit: "1mb" });
  app.useBodyParser("urlencoded", { limit: "1mb", extended: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
  const port = config.get<number>("PORT", 3001);
  await app.listen(port);
  Logger.log(`Server listening on port ${port}`, "Bootstrap");
}

bootstrap().catch((error) => {
  Logger.error("Startup failed", error?.stack || error, "Bootstrap");
  process.exitCode = 1;
});
