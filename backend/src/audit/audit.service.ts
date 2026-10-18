import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op } from "sequelize";
import { AuthAuditLog } from "../database/models/auth-audit-log.model.js";
import { Staff } from "../database/models/staff.model.js";

export interface AuditEntry {
  actorStaffId?: string | null;
  targetStaffId?: string | null;
  action: string;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditQuery {
  action?: string;
  actorStaffId?: string;
  targetStaffId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

const endOfDay = (value: string) => {
  const date = new Date(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) date.setHours(23, 59, 59, 999);
  return date;
};

const serialize = (log: AuthAuditLog) => {
  const value: any = log.get({ plain: true });
  return {
    id: value.id,
    action: value.action,
    metadata: value.metadata,
    ip: value.ip,
    userAgent: value.userAgent,
    createdAt: value.createdAt,
    actor: value.actor ? { id: value.actor.id, name: value.actor.name, email: value.actor.email } : null,
    target: value.target ? { id: value.target.id, name: value.target.name, email: value.target.email } : null,
  };
};

@Injectable()
export class AuditService {
  constructor(@InjectModel(AuthAuditLog) private readonly logs: typeof AuthAuditLog) {}

  record(entry: AuditEntry) {
    return this.logs.create({
      actorStaffId: entry.actorStaffId ?? null,
      targetStaffId: entry.targetStaffId ?? null,
      action: entry.action,
      metadata: entry.metadata ?? null,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
    } as any);
  }

  async list(query: AuditQuery) {
    const where: Record<string, unknown> = {};
    if (query.action) where.action = query.action;
    if (query.actorStaffId) where.actorStaffId = query.actorStaffId;
    if (query.targetStaffId) where.targetStaffId = query.targetStaffId;
    if (query.from || query.to) {
      const createdAt: Record<symbol, Date> = {};
      if (query.from) createdAt[Op.gte] = new Date(query.from);
      if (query.to) createdAt[Op.lte] = endOfDay(query.to);
      where.createdAt = createdAt;
    }

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 50));

    const { rows, count } = await this.logs.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      include: [
        { model: Staff, as: "actor", attributes: ["id", "name", "email"] },
        { model: Staff, as: "target", attributes: ["id", "name", "email"] },
      ],
    });

    return { rows: rows.map(serialize), total: count, page, pageSize };
  }
}
