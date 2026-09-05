import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { InjectConnection } from "@nestjs/sequelize";
import connectSessionSequelize from "connect-session-sequelize";
import cookieParser from "cookie-parser";
import flash from "express-flash";
import { rateLimit } from "express-rate-limit";
import session from "express-session";
import passport from "passport";
import { Sequelize } from "sequelize-typescript";
import { AuthModule } from "./auth/auth.module.js";
import { environmentFiles, environmentSchema } from "./config/configuration.js";
import { DatabaseModule } from "./database/database.module.js";
import { DoctoralModule } from "./doctoral/doctoral.module.js";
import { HealthModule } from "./health/health.module.js";
import { ManagementModule } from "./management/management.module.js";
import { MastersModule } from "./masters/masters.module.js";
import { PlanModule } from "./plan/plan.module.js";
import { ReportsModule } from "./reports/reports.module.js";
import { SchedulingModule } from "./scheduling/scheduling.module.js";
import { SystemModule } from "./system/system.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: environmentFiles, validationSchema: environmentSchema }),
    DatabaseModule,
    AuthModule,
    ManagementModule,
    HealthModule,
    SystemModule,
    PlanModule,
    MastersModule,
    DoctoralModule,
    ReportsModule,
    SchedulingModule,
  ],
})
export class AppModule implements NestModule {
  constructor(@InjectConnection() private readonly sequelize: Sequelize, private readonly config: ConfigService) {}

  configure(consumer: MiddlewareConsumer) {
    const SequelizeStore = connectSessionSequelize(session.Store);
    const secure = this.config.get<boolean>("SESSION_COOKIE_SECURE") ?? this.config.get("NODE_ENV") === "production";
    consumer.apply(
      cookieParser(),
      flash(),
      session({
        name: "pgsms.sid",
        secret: this.config.getOrThrow<string>("SESSION_SECRET"),
        store: new SequelizeStore({ db: this.sequelize, tableName: "sessions", checkExpirationInterval: 15 * 60 * 1000 }),
        resave: false,
        saveUninitialized: false,
        proxy: Boolean(this.config.get<number>("TRUST_PROXY", 0)),
        cookie: { httpOnly: true, secure, sameSite: "lax", maxAge: 8 * 60 * 60 * 1000 },
      }),
      passport.initialize(),
      passport.session(),
    ).forRoutes({ path: "*", method: RequestMethod.ALL });

    consumer.apply(rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 100,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    })).forRoutes(
      { path: "user/login", method: RequestMethod.POST },
      { path: "user/forgotPassword", method: RequestMethod.POST },
    );
  }
}
