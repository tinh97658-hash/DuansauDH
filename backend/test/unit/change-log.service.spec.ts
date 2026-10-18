import { ChangeLogService } from "../../src/audit/change-log.service.js";

const logRecord = (overrides: any = {}) => {
  const record: any = {
    id: 1,
    tableName: "staff",
    operation: "UPDATE",
    rowPk: '{"id":"s1"}',
    oldData: { name: "Cũ" },
    newData: { name: "Mới" },
    changedColumns: ["name"],
    actorStaffId: null,
    actorEmail: null,
    requestId: null,
    ip: null,
    userAgent: null,
    changedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
  record.get = () => ({ ...record });
  return record;
};

const build = () => {
  const logs: any = {
    findAndCountAll: jest.fn(),
    sequelize: { query: jest.fn() },
  };
  const service = new ChangeLogService(logs as any);
  return { service, logs };
};

describe("ChangeLogService", () => {
  it("lọc theo bảng, hành động, người thực hiện và khoảng thời gian", async () => {
    const { service, logs } = build();
    logs.findAndCountAll.mockResolvedValue({ rows: [logRecord()], count: 1 });

    const result = await service.list({
      table: "staff",
      operation: "UPDATE",
      actorStaffId: "00000000-0000-0000-0000-000000000001",
      from: "2026-01-01",
      to: "2026-01-31",
      page: 2,
      pageSize: 25,
    });

    const args: any = logs.findAndCountAll.mock.calls[0][0];
    expect(args.where.tableName).toBe("staff");
    expect(args.where.operation).toBe("UPDATE");
    expect(args.where.actorStaffId).toBe("00000000-0000-0000-0000-000000000001");
    expect(args.where.changedAt).toBeDefined();
    expect(args.limit).toBe(25);
    expect(args.offset).toBe(25);
    expect(result.total).toBe(1);
    expect(result.page).toBe(2);
    expect(result.rows[0]).toMatchObject({ tableName: "staff", operation: "UPDATE", changedColumns: ["name"] });
  });

  it("giới hạn pageSize tối đa 200 và page tối thiểu 1", async () => {
    const { service, logs } = build();
    logs.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });

    const result = await service.list({ page: 0, pageSize: 1000 });

    const args: any = logs.findAndCountAll.mock.calls[0][0];
    expect(args.limit).toBe(200);
    expect(args.offset).toBe(0);
    expect(result.pageSize).toBe(200);
    expect(result.page).toBe(1);
  });

  it("trả về danh sách bảng đã có vết thay đổi", async () => {
    const { service, logs } = build();
    logs.sequelize.query.mockResolvedValue([{ table_name: "roles" }, { table_name: "staff" }]);

    const tables = await service.tables();

    expect(tables).toEqual(["roles", "staff"]);
    const sql: string = logs.sequelize.query.mock.calls[0][0];
    expect(sql).toContain("DISTINCT");
    expect(sql).toContain("db_change_logs");
  });
});
