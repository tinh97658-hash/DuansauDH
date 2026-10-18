import { Injectable, NestMiddleware, OnModuleInit } from "@nestjs/common";
import { InjectConnection } from "@nestjs/sequelize";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { QueryTypes } from "sequelize";
import { Staff } from "../database/models/staff.model.js";

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
 * Truyền ngữ cảnh request xuống tầng truy vấn và gắn vào mỗi transaction.
 * Vì dùng connection pool, biến phiên chỉ đáng tin khi set LOCAL trong transaction —
 * do đó mọi transaction khởi tạo qua `sequelize.transaction` đều được gắn ngữ cảnh.
 */
@Injectable()
export class AuditContextService implements OnModuleInit {
  private readonly storage = new AsyncLocalStorage<AuditContext>();
  private patched = false;

  constructor(@InjectConnection() private readonly sequelize: any) {}

  onModuleInit() {
    if (this.patched || !this.sequelize?.transaction) return;

    const original = this.sequelize.transaction.bind(this.sequelize);
    this.sequelize.transaction = (...args: any[]) => {
      let options: any;
      let callback: any;
      if (typeof args[0] === "function") {
        options = {};
        callback = args[0];
      } else {
        options = args[0] ?? {};
        callback = args[1];
      }

      if (typeof callback !== "function") {
        return original(...args).then(async (transaction: any) => {
          await this.applyContext(transaction);
          return transaction;
        });
      }

      return original(options, async (transaction: any) => {
        await this.applyContext(transaction);
        return callback(transaction);
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

  private async applyContext(transaction: any) {
    const context = this.storage.getStore();
    await this.sequelize.query(
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
