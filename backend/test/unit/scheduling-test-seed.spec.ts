import { requireDevelopment, schedulingTestRows, schedulingTestScope, seedSchedulingTest } from "../../src/database/seeds/scheduling-test-fixture.js";

describe("development scheduling seed", () => {
  it("rejects non-development environments before database access", async () => {
    for (const environment of [undefined, "test", "production"]) {
      expect(() => requireDevelopment(environment)).toThrow("NODE_ENV=development");
      await expect(seedSchedulingTest({} as never, environment)).rejects.toThrow("NODE_ENV=development");
    }
  });

  it("creates the complete official package chain without pre-creating offerings", () => {
    const rows = schedulingTestRows();
    const select = (model: string) => rows.filter((row) => row.model === model).map((row) => row.values);
    expect(select("Subject")).toHaveLength(3);
    expect(select("ClassGroupMember")).toHaveLength(3);
    expect(select("SubjectPackageSubject")).toHaveLength(3);
    expect(select("SubjectPackage")[0]).toMatchObject({ active: true, isOfficial: true, totalSubjects: 3 });
    expect(select("ClassGroup")[0]).toMatchObject(schedulingTestScope);
    expect(select("CourseOffering")).toHaveLength(0);
    expect(select("CourseOfferingClassGroup")).toHaveLength(0);
    const ids = new Set(rows.map((row) => row.values.id));
    expect(ids.size).toBe(rows.length);
    for (const { values } of rows) for (const [key, value] of Object.entries(values)) {
      if (key.endsWith("Id") && value !== null) expect(ids.has(value)).toBe(true);
    }
    for (const subject of select("Subject")) expect(subject).toMatchObject({ majorId: schedulingTestScope.majorId, active: true, program: "masters" });
  });

  it("does not duplicate or overwrite rows on rerun and uses a transaction", async () => {
    const saved = new Map();
    const transaction = {};
    const sequelize = {
      transaction: async (callback: (value: object) => Promise<void>) => callback(transaction),
      models: new Proxy({}, { get: () => ({ findOrCreate: async (options: any) => {
        expect(options.transaction).toBe(transaction);
        const exists = saved.has(options.where.id);
        if (!exists) saved.set(options.where.id, options.defaults);
        return [saved.get(options.where.id), !exists];
      } }) }),
    };
    expect((await seedSchedulingTest(sequelize as never, "development")).created).toBe(schedulingTestRows().length);
    saved.get(schedulingTestScope.majorId).name = "Edited by user";
    expect((await seedSchedulingTest(sequelize as never, "development")).created).toBe(0);
    expect(saved.get(schedulingTestScope.majorId).name).toBe("Edited by user");
  });
});
