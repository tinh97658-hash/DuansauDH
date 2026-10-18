import { Global, Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { AuthAuditLog } from "../database/models/auth-audit-log.model.js";
import { DbChangeLog } from "../database/models/db-change-log.model.js";
import { AuditContextMiddleware, AuditContextService } from "./audit-context.js";
import { AuditService } from "./audit.service.js";
import { ChangeLogService } from "./change-log.service.js";

@Global()
@Module({
  imports: [SequelizeModule.forFeature([AuthAuditLog, DbChangeLog])],
  providers: [AuditService, ChangeLogService, AuditContextService, AuditContextMiddleware],
  exports: [AuditService, ChangeLogService, AuditContextService],
})
export class AuditModule {}
