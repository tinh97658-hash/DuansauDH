import { jest } from "@jest/globals";
import { PlanService } from "../../src/plan/plan.service.js";

const transaction = { LOCK: { UPDATE: "UPDATE" } };

const subject = (overrides: Record<string, unknown> = {}) => ({
  id: "subject-alias",
  majorId: "major-2",
  program: "masters",
  codeNumber: 1,
  codeText: "HP01",
  active: true,
  canonicalSubjectId: null,
  allowCrossMajor: false,
  update: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const buildService = () => {
  const subjects = {
    findByPk: jest.fn(),
    findOne: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn(),
  };
  const packageEntries = { count: jest.fn().mockResolvedValue(0) };
  const majors = { findByPk: jest.fn().mockResolvedValue({ id: "major-2", program: "masters", active: true }) };
  const sequelize = { transaction: jest.fn((callback: (tx: any) => Promise<unknown>) => callback(transaction)) };
  const courseOfferings = { count: jest.fn().mockResolvedValue(0) };
  const service = new PlanService(
    subjects as never,
    {} as never,
    packageEntries as never,
    {} as never,
    majors as never,
    {} as never,
    sequelize as never,
    {} as never,
    courseOfferings as never,
  );
  return { service, subjects, majors, courseOfferings };
};

const createDto = (overrides: Record<string, unknown> = {}) => ({
  codeNumber: 101,
  codeText: "HP101",
  name: "Học phần mới",
  majorId: "major-2",
  program: "masters",
  ...overrides,
});

describe("PlanService Subject logical identity", () => {
  it("creates a normal Subject without requiring identity fields", async () => {
    const { service, subjects } = buildService();
    const created = subject({ id: "normal-subject" });
    subjects.create.mockResolvedValue(created);

    await expect(service.createSubject(createDto())).resolves.toBe(created);

    expect(subjects.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ canonicalSubjectId: expect.anything(), allowCrossMajor: expect.anything() }),
      { transaction },
    );
  });

  it("creates an explicitly enabled common root atomically", async () => {
    const { service, subjects } = buildService();
    const created = subject({ id: "common-root", allowCrossMajor: true });
    subjects.create.mockResolvedValue(created);

    await expect(service.createSubject(createDto({
      canonicalSubjectId: null,
      allowCrossMajor: true,
    }))).resolves.toBe(created);

    expect(subjects.create).toHaveBeenCalledWith(
      expect.objectContaining({ canonicalSubjectId: null, allowCrossMajor: true }),
      { transaction },
    );
  });

  it("creates a valid alias to an enabled common root atomically", async () => {
    const { service, subjects } = buildService();
    const root = subject({ id: "root", majorId: "major-1", allowCrossMajor: true });
    const created = subject({ id: "created-alias", canonicalSubjectId: root.id });
    subjects.findByPk.mockResolvedValue(root);
    subjects.create.mockResolvedValue(created);

    await expect(service.createSubject(createDto({
      canonicalSubjectId: root.id,
      allowCrossMajor: false,
    }))).resolves.toBe(created);

    expect(subjects.create).toHaveBeenCalledWith(
      expect.objectContaining({ canonicalSubjectId: root.id, allowCrossMajor: false }),
      { transaction },
    );
  });

  it("rejects invalid create identity before inserting the Subject", async () => {
    const { service, subjects } = buildService();

    await expect(service.createSubject(createDto({
      canonicalSubjectId: "missing-root",
      allowCrossMajor: true,
    }))).rejects.toThrow("không thể đồng thời");

    subjects.findByPk.mockResolvedValue(null);
    await expect(service.createSubject(createDto({
      canonicalSubjectId: "missing-root",
      allowCrossMajor: false,
    }))).rejects.toThrow("Không tìm thấy học phần gốc");
    expect(subjects.create).not.toHaveBeenCalled();
  });

  it("enables a specialized root explicitly without changing its logical id", async () => {
    const { service, subjects } = buildService();
    const root = subject({ id: "root", majorId: "major-1" });
    subjects.findByPk.mockResolvedValue(root);

    await service.updateSubject(root.id, { allowCrossMajor: true });

    expect(root.update).toHaveBeenCalledWith(
      expect.objectContaining({ allowCrossMajor: true }),
      { transaction },
    );
  });

  it("rejects a canonical self-reference", async () => {
    const { service, subjects } = buildService();
    const alias = subject();
    subjects.findByPk.mockResolvedValue(alias);

    await expect(service.updateSubject(alias.id, { canonicalSubjectId: alias.id }))
      .rejects.toThrow("không được tham chiếu chính nó");
    expect(alias.update).not.toHaveBeenCalled();
  });

  it("rejects alias-to-alias chains", async () => {
    const { service, subjects } = buildService();
    const alias = subject();
    const nonRoot = subject({ id: "non-root", canonicalSubjectId: "another-root", allowCrossMajor: false });
    subjects.findByPk.mockImplementation(async (id: string) => id === alias.id ? alias : nonRoot);

    await expect(service.updateSubject(alias.id, { canonicalSubjectId: nonRoot.id }))
      .rejects.toThrow("không được tạo chuỗi mapping");
  });

  it("rejects a cross-program mapping", async () => {
    const { service, subjects } = buildService();
    const alias = subject();
    const root = subject({ id: "doctoral-root", program: "doctoral", canonicalSubjectId: null, allowCrossMajor: true });
    subjects.findByPk.mockImplementation(async (id: string) => id === alias.id ? alias : root);

    await expect(service.updateSubject(alias.id, { canonicalSubjectId: root.id }))
      .rejects.toThrow("phải cùng bậc đào tạo");
  });

  it("rejects a root that is not enabled for cross-major use", async () => {
    const { service, subjects } = buildService();
    const alias = subject();
    const root = subject({ id: "root", majorId: "major-1", canonicalSubjectId: null, allowCrossMajor: false });
    subjects.findByPk.mockImplementation(async (id: string) => id === alias.id ? alias : root);

    await expect(service.updateSubject(alias.id, { canonicalSubjectId: root.id }))
      .rejects.toThrow("chưa được cho phép dùng chung liên ngành");
  });

  it("accepts an explicit alias-to-common-root mapping", async () => {
    const { service, subjects } = buildService();
    const alias = subject();
    const root = subject({ id: "root", majorId: "major-1", canonicalSubjectId: null, allowCrossMajor: true });
    subjects.findByPk.mockImplementation(async (id: string) => id === root.id ? root : alias);

    await service.updateSubject(alias.id, { canonicalSubjectId: root.id });

    expect(alias.update).toHaveBeenCalledWith(
      expect.objectContaining({ canonicalSubjectId: root.id }),
      { transaction },
    );
  });

  it("allows removing a legacy reference even when the Subject has an offering", async () => {
    const { service, subjects, courseOfferings } = buildService();
    const alias = subject();
    const root = subject({ id: "root", majorId: "major-1", canonicalSubjectId: null, allowCrossMajor: true });
    subjects.findByPk.mockImplementation(async (id: string) => id === root.id ? root : alias);
    courseOfferings.count.mockResolvedValue(1);

    await expect(service.updateSubject(alias.id, { canonicalSubjectId: null, allowCrossMajor: true }))
      .resolves.toBeDefined();
    expect(alias.update).toHaveBeenCalledWith(
      expect.objectContaining({ canonicalSubjectId: null, allowCrossMajor: true }),
      { transaction },
    );
  });
});
