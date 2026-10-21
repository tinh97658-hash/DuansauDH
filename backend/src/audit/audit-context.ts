import { Injectable, NestMiddleware, OnModuleInit } from "@nestjs/common";
import { InjectConnection } from "@nestjs/sequelize";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { QueryTypes } from "sequelize";
import { Staff } from "../database/models/staff.model.js";
import { isAuditWrite } from "./audit-write-query.js";

/**
 * Ngữ cảnh người thực hiện cho nhật ký thay đổi dữ liệu.
 * Được set vào biến phiên PostgreSQL (LOCAL, theo transaction) để trigger `audit_capture` đọc được.
 */
export interface AuditContext {
  actorStaffId: string | null;
  actorEmail: string | null;
  requestId: string;
  ip: string | null;
  userAgent: string | null;
}

/**
 * Set audit context immediately before DML, on the write's own transaction.
 * Former autocommit writes receive a short single-statement transaction; explicit
 * transactions keep their original scope. LOCAL settings never survive pool reuse.
 */
@Injectable()
export class AuditContextService implements OnModuleInit {
  private readonly storage = new AsyncLocalStorage<AuditContext>();
  private patched = false;

  constructor(@InjectConnection() private readonly sequelize: any) {}

  onModuleInit() {
    if (this.patched || !this.sequelize?.transaction || !this.sequelize?.query) return;

    const query = this.sequelize.query.bind(this.sequelize);
    const transaction = this.sequelize.transaction.bind(this.sequelize);
    this.sequelize.query = async (sql: any, options: any = {}) => {
      const effective = { ...this.sequelize.options?.query, ...options };
      if (!isAuditWrite(sql, effective)) return query(sql, options);
      // Match Sequelize 6's existing CLS transaction resolution, when enabled.
      const existing = effective.transaction === undefined
        ? this.sequelize.constructor._cls?.get("transaction") : effective.transaction;
      const context = this.current();
      if (existing) {
        await this.applyContext(existing, context, query);
        return query(sql, { ...options, transaction: existing });
      }
      if (!context) return query(sql, options);
      return transaction(async (writeTransaction: any) => {
        await this.applyContext(writeTransaction, context, query);
        return query(sql, { ...options, transaction: writeTransaction });
      });
    };
    this.patched = true;
  }

  run<T>(context: AuditContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  current(): AuditContext | undefined {
    return this.storage.getStore();
  }

  /** Call only after authentication succeeds; preserve the original request's
   * correlation metadata without modifying its shared async context object. */
  runAsStaff<T>(staff: Staff, fn: () => T): T {
    const context = this.current();
    return this.run({
      requestId: context?.requestId ?? randomUUID(),
      ip: context?.ip ?? null,
      userAgent: context?.userAgent ?? null,
      actorStaffId: staff.id,
      actorEmail: staff.email,
    }, fn);
  }

  private async applyContext(transaction: any, context: AuditContext | undefined, query: (...args: any[]) => Promise<any>) {
    await query(
      `SELECT
         set_config('app.actor_staff_id', :actorStaffId, true),
         set_config('app.actor_email', :actorEmail, true),
         set_config('app.request_id', :requestId, true),
         set_config('app.ip', :ip, true),
         set_config('app.user_agent', :userAgent, true)`,
      {
        replacements: {
          actorStaffId: context?.actorStaffId ?? "",
          actorEmail: context?.actorEmail ?? "",
          requestId: context?.requestId ?? "",
          ip: context?.ip ?? "",
          userAgent: context?.userAgent ?? "",
        },
        transaction,
        type: QueryTypes.SELECT,
      },
    );
  }
}

/** Gắn ngữ cảnh người dùng đăng nhập vào mọi request (chạy sau passport.session). */
@Injectable()
export class AuditContextMiddleware implements NestMiddleware {
  constructor(private readonly context: AuditContextService) {}

  use(request: Request, _response: Response, next: NextFunction) {
    const user: any = (request as any).user;
    const isStaff = user instanceof Staff;
    const headerRequestId = request.get("x-request-id");
    this.context.run(
      {
        actorStaffId: isStaff ? user.id : null,
        actorEmail: isStaff ? user.email : null,
        requestId: headerRequestId ? String(headerRequestId) : randomUUID(),
        ip: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
      () => next(),
    );
  }
}
