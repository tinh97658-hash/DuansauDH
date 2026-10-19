import { buildAdmissions, summarizeAdmissions, YEAR_COUNTS, SeedCatalog } from "../../src/database/seeds/dev-postgraduate-fixture.js";
import { deletionOrder, ForeignKey, requireLocalDev, LIFECYCLE_TABLES, PRESERVED_TABLES } from "../../src/database/seeds/dev-postgraduate-policy.js";

const config = { NODE_ENV: "development", DATABASE_URL: "postgres://user:secret@127.0.0.1:55432/pgsms", CONFIRM_DEV_DATA_RESET: "YES" };
const fk = (child: string, parent: string, extra: Partial<ForeignKey> = {}): ForeignKey => ({
  child, parent, childSchema: "public", parentSchema: "public", name: `${child}_${parent}_fkey`,
  definition: "FOREIGN KEY ... ON DELETE CASCADE", ...extra,
});

describe("DEV postgraduate reset safety", () => {
  it("allows only the audited local repository DB or explicit local test/development database names", () => {
    expect(requireLocalDev(config, true)).toMatchObject({ database: "pgsms", port: "55432" });
    expect(requireLocalDev({ ...config, DATABASE_URL: "postgres://u:p@localhost:5432/postgraduate_test" }, true).database).toBe("postgraduate_test");
  });
  it.each([
    { NODE_ENV: "production" }, { NODE_ENV: "staging" }, { NODE_ENV: undefined },
    { DATABASE_URL: "postgres://u:p@shared.example:55432/pgsms" },
    { DATABASE_URL: "postgres://u:p@db:5432/pgsms" },
    { DATABASE_URL: "postgres://u:p@127.0.0.1:5432/pgsms" },
    { DATABASE_URL: "postgres://u:p@localhost:5432/postgraduate" },
    { DATABASE_URL: "postgres://u:p@localhost:5432/staging_test" },
    { DATABASE_URL: "postgres://u:p@localhost:5432/prod_dev" },
    { DATABASE_URL: "postgres://u:p@localhost:5432/shared_dev" },
    { DATABASE_URL: "postgres://u:p@localhost:5432/dev_db?host=remote" },
    { DATABASE_URL: "mysql://u:p@localhost/dev_db" },
    { DATABASE_URL: "malformed" }, { DATABASE_SSL: true }, { DATABASE_SSL: "true" },
    { CONFIRM_DEV_DATA_RESET: undefined }, { CONFIRM_DEV_DATA_RESET: "yes" },
  ])("refuses unsafe configuration %j", (change) => {
    expect(() => requireLocalDev({ ...config, ...change }, true)).toThrow(/DEV DATA/);
  });
  it("allows read-only preview without confirmation but still enforces local/environment guards", () => {
    expect(requireLocalDev({ ...config, CONFIRM_DEV_DATA_RESET: undefined }, false)).toBeDefined();
    expect(() => requireLocalDev({ ...config, NODE_ENV: "production" }, false)).toThrow();
  });
  it("orders actual children before parents, including SQL-only tables and nullable FKs", () => {
    const order = deletionOrder(["staff", "subjects", "admission_records", "students", "course_offerings", "study_leaves", "course_offering_withdrawals", "scheduling_retakes"], [
      fk("course_offering_withdrawals", "study_leaves"), fk("study_leaves", "admission_records"),
      fk("course_offering_withdrawals", "course_offerings"), fk("scheduling_retakes", "course_offerings"),
      fk("admission_records", "students"), fk("course_offerings", "subjects"),
    ]);
    expect(order.indexOf("course_offering_withdrawals")).toBeLessThan(order.indexOf("study_leaves"));
    expect(order.indexOf("study_leaves")).toBeLessThan(order.indexOf("admission_records"));
    expect(order.indexOf("scheduling_retakes")).toBeLessThan(order.indexOf("course_offerings"));
    expect(order.indexOf("admission_records")).toBeLessThan(order.indexOf("students"));
    expect(order).not.toContain("staff");
    expect(order).not.toContain("subjects");
  });
  it("refuses new tables, cyclic FKs, and preserved/external dependents even if delete cascades", () => {
    expect(() => deletionOrder(["new_attendance"], [])).toThrow(/unclassified/);
    expect(() => deletionOrder(["students", "admission_records"], [fk("students", "admission_records"), fk("admission_records", "students")])).toThrow(/cyclic/);
    expect(() => deletionOrder(["subjects", "class_groups"], [fk("subjects", "class_groups")])).toThrow(/preserved/);
    expect(() => deletionOrder(["class_groups"], [fk("external", "class_groups", { childSchema: "other" })])).toThrow(/external/);
  });
  it("keeps catalogs, policies, intake configuration, auth and metadata outside reset", () => {
    expect(PRESERVED_TABLES).toEqual(expect.arrayContaining(["staff", "sessions", "subjects", "majors", "disciplines", "curriculums", "course_grading_policies", "shared_grading_rules", "admission_rounds", "training_plans", "annual_fees"]));
    expect(LIFECYCLE_TABLES.filter((table) => (PRESERVED_TABLES as readonly string[]).includes(table))).toEqual([]);
  });
});

const catalog: SeedCatalog = {
  majors: Array.from({ length: 15 }, (_, index) => ({ id: `m${String(index).padStart(2, "0")}`, code: `M${index}`, name: `Chuyên ngành ${index}`, program: index < 12 ? "masters" : "doctoral", disciplineId: `d${index}` })),
  cities: ["Hải Phòng", "Hà Nội"], ethnicities: ["Kinh", "Tày"], nationalities: ["Việt Nam"],
};
describe("DEV postgraduate admission fixture", () => {
  it("reproduces the complete dataset for the same seed and input regardless of major query ordering", () => {
    const rows = buildAdmissions(catalog);
    expect(rows).toEqual(buildAdmissions({ ...catalog, majors: [...catalog.majors].reverse() }));
    expect(rows).not.toEqual(buildAdmissions(catalog, 42));
  });
  it("creates 210 unique natural names and synthetic contact values over three years and every valid major", () => {
    const rows = buildAdmissions(catalog);
    expect(rows).toHaveLength(210);
    for (const [year, count] of Object.entries(YEAR_COUNTS)) {
      const yearRows = rows.filter((row) => row.academicYear === year);
      expect(yearRows).toHaveLength(count);
      expect(new Set(yearRows.map((row) => row.majorId)).size).toBe(15);
    }
    for (const field of ["id", "email", "phone", "fullName"]) expect(new Set(rows.map((row) => row[field])).size).toBe(210);
    for (const row of rows) {
      expect(row.fullName).not.toMatch(/test|demo|student|user|học viên\s*\d/i);
      expect(row.email).toMatch(/@example\.invalid$/);
      expect(row.phone).toMatch(/^000\d{7}$/);
      expect(row.fullName).toBe(`${row.lastName} ${row.firstName}`);
      expect(row.majorId).toBeTruthy();
      expect(row.code).toBeNull();
      expect(row.idCard).toBeNull();
    }
    const summary = summarizeAdmissions(rows, catalog.majors);
    expect(summary.byMajor.reduce((total, major) => total + major.total, 0)).toBe(210);
    expect(summary.names).toHaveLength(10);
    expect(Math.max(...summary.byMajor.map((major) => major.total))).toBeGreaterThan(20);
  });
  it("stops before admission decisions, tuition, student-account creation or class assignment", () => {
    for (const row of buildAdmissions(catalog)) {
      expect(row.status).toBe("pending");
      expect(row.studyStatus).toBe("Nộp hồ sơ đầu vào");
      expect(row.studentId).toBeNull();
      expect(row.extraData.tuitionPayment).toBeUndefined();
      expect(row.assignedGroup).toBeUndefined();
    }
  });
  it("refuses invalid seeds or missing master data instead of fabricating references", () => {
    for (const seed of [NaN, -1, 1.5, 4294967296]) expect(() => buildAdmissions(catalog, seed)).toThrow();
    expect(() => buildAdmissions({ ...catalog, majors: [] })).toThrow(/majors/);
    expect(() => buildAdmissions({ ...catalog, cities: [] })).toThrow(/cities/);
    expect(() => buildAdmissions({ ...catalog, majors: [{ ...catalog.majors[0], disciplineId: "" }] })).toThrow();
  });
});
