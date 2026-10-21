import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op, QueryTypes } from "sequelize";
import { DbChangeLog } from "../database/models/db-change-log.model.js";
import { redactCredentials } from "./credential-redaction.js";

export interface ChangeLogQuery {
  table?: string;
  operation?: string;
  actorStaffId?: string;
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

const serialize = (log: DbChangeLog) => {
  const value: any = log.get({ plain: true });
  return {
    id: value.id,
    tableName: value.tableName,
    operation: value.operation,
    rowPk: value.rowPk,
    oldData: redactCredentials(value.oldData),
    newData: redactCredentials(value.newData),
    changedColumns: value.changedColumns,
    actorStaffId: value.actorStaffId,
    actorEmail: value.actorEmail,
    requestId: value.requestId,
    ip: value.ip,
    userAgent: value.userAgent,
    changedAt: value.changedAt,
  };
};

@Injectable()
export class ChangeLogService {
  constructor(@InjectModel(DbChangeLog) private readonly logs: typeof DbChangeLog) {}

  async list(query: ChangeLogQuery) {
    const where: Record<string, unknown> = {};
    if (query.table) where.tableName = query.table;
    if (query.operation) where.operation = query.operation;
    if (query.actorStaffId) where.actorStaffId = query.actorStaffId;
    if (query.from || query.to) {
      const changedAt: Record<symbol, Date> = {};
      if (query.from) changedAt[Op.gte] = new Date(query.from);
      if (query.to) changedAt[Op.lte] = endOfDay(query.to);
      where.changedAt = changedAt;
    }

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 50));

    const { rows, count } = await this.logs.findAndCountAll({
      where,
      order: [["changedAt", "DESC"], ["id", "DESC"]],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return { rows: rows.map(serialize), total: count, page, pageSize };
  }

  /** Danh sách các bảng đã có vết thay đổi (để dựng bộ lọc). */
  async tables(): Promise<string[]> {
    const rows = (await this.logs.sequelize!.query(
      "SELECT DISTINCT table_name FROM db_change_logs ORDER BY table_name",
      { type: QueryTypes.SELECT },
    )) as Array<{ table_name: string }>;
    return rows.map((row) => row.table_name);
  }
}
