import { Global, Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { AuthAuditLog } from "../database/models/auth-audit-log.model.js";
import { AuditService } from "./audit.service.js";

@Global()
@Module({
  imports: [SequelizeModule.forFeature([AuthAuditLog])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
