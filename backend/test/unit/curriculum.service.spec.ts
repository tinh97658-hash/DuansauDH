import { jest } from "@jest/globals";
import { CurriculumService } from "../../src/plan/curriculum.service.js";

const transaction = { LOCK: { UPDATE: "UPDATE" } };

const blockRows = [
  { id: "block-cs", code: "CS", sortOrder: 1 },
  { id: "block-cn", code: "CN", sortOrder: 2 },
  { id: "block-tc", code: "TC", sortOrder: 3 },
  { id: "block-ch", code: "CH", sortOrder: 4 },
];

const buildService = () => {
  const curriculums = { findOne: jest.fn(), findByPk: jest.fn(), findAll: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn() };
  const blocks = { findAll: jest.fn().mockResolvedValue([]), create: jest.fn() };
  const electiveGroups = { findAll: jest.fn().mockResolvedValue([]), create: jest.fn() };
  const entries = { findAll: jest.fn().mockResolvedValue([]), create: jest.fn(), destroy: jest.fn(), bulkCreate: jest.fn() };
  const classGroups = { findByPk: jest.fn(), count: jest.fn().mockResolvedValue(0), findAll: jest.fn().mockResolvedValue([]) };
  const classElectives = { findAll: jest.fn().mockResolvedValue([]), destroy: jest.fn(), bulkCreate: jest.fn() };
  const subjects = { findAll: jest.fn().mockResolvedValue([]) };
  const majors = { findByPk: jest.fn() };
  const sequelize = { transaction: jest.fn((callback: (tx: any) => Promise<unknown>) => callback(transaction)) };
  const service = new CurriculumService(
    curriculums as never,
    blocks as never,
    electiveGroups as never,
    entries as never,
    classGroups as never,
    classElectives as never,
    subjects as never,
    majors as never,
    sequelize as never,
  );
  return { service, curriculums, blocks, electiveGroups, entries, classGroups, classElectives, subjects, majors, sequelize };
};

const classGroup = (overrides: Record<string, unknown> = {}) => ({
  id: "class-1",
  code: "THS-K32-N01",
  name: "Nhóm 1 - Khóa 32",
  majorId: "major-1",
  program: "masters",
  academicYear: "2026",
  curriculumId: null,
  update: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("CurriculumService.assignToClassGroup", () => {
  it("requires the class to have a major", async () => {
    const mocks = buildService();
    await expect(mocks.service.assignToClassGroup(classGroup({ majorId: null }) as never))
      .rejects.toThrow("phải được gắn chuyên ngành");
    expect(mocks.curriculums.create).not.toHaveBeenCalled();
  });

  it("creates one curriculum for the major + program + intake and links the class", async () => {
    const mocks = buildService();
    const group = classGroup();
    mocks.curriculums.findAll.mockResolvedValue([]);
    mocks.curriculums.findOne.mockResolvedValue(null);
    mocks.majors.findByPk.mockResolvedValue({ id: "major-1", code: "KTHH", name: "Khai thác hàng hải", program: "masters", active: true });
    const createdCurriculum = { id: "cur-1", code: "CT-KTHH-2026", majorId: "major-1", program: "masters" };
    mocks.curriculums.create.mockResolvedValue(createdCurriculum);
    mocks.curriculums.findByPk.mockResolvedValue(createdCurriculum);
    mocks.blocks.findAll.mockResolvedValueOnce([]);
    mocks.blocks.findAll.mockResolvedValue(blockRows);
    mocks.blocks.create.mockImplementation(async (payload: any) => ({ id: `created-${payload.code}`, ...payload }));
    mocks.subjects.findAll.mockResolvedValue([
      { id: "subject-1", majorId: "major-1", program: "masters", subjectType: "CN", isRequired: true, credits: 3, sortOrder: 0, codeNumber: 1, active: true },
      { id: "subject-2", majorId: "major-1", program: "masters", subjectType: "TC", isRequired: false, credits: 2, sortOrder: 1, codeNumber: 2, active: true },
    ]);
    mocks.entries.findAll.mockResolvedValue([
      { id: "entry-1", subjectId: "subject-1", isRequired: true, credits: 3, update: jest.fn().mockResolvedValue(undefined) },
      { id: "entry-2", subjectId: "subject-2", isRequired: false, credits: 2, update: jest.fn().mockResolvedValue(undefined) },
    ]);
    const existingEntries = await mocks.entries.findAll();

    const result = await mocks.service.assignToClassGroup(group as never);

    expect(mocks.curriculums.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: "CT-KTHH-2026", majorId: "major-1", program: "masters", applicableFromYear: "2026" }),
      expect.anything(),
    );
    // Toàn bộ học phần của ngành vào CTĐT, giữ đúng bắt buộc/tự chọn và khối kiến thức.
    expect((existingEntries[0] as any).update).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: "subject-1", isRequired: true, blockId: "block-cn" }),
      expect.anything(),
    );
    expect((existingEntries[1] as any).update).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: "subject-2", isRequired: false, blockId: "block-tc" }),
      expect.anything(),
    );
    // Đồng bộ theo hiệu số: dòng đã có không bị xoá/tạo lại (tránh mất lựa chọn tự chọn của lớp).
    expect(mocks.entries.destroy).not.toHaveBeenCalled();
    // A curriculum is a complete plan, so all listed subjects count toward its total.
    expect(mocks.curriculums.update).toHaveBeenCalledWith({ totalCredits: 5 }, expect.anything());
    expect(group.update).toHaveBeenCalledWith({ curriculumId: "cur-1" }, { transaction: undefined });
    expect(result).toMatchObject({ id: "cur-1" });
  });

  it("reuses the existing curriculum of the same major, program and intake", async () => {
    const mocks = buildService();
    const group = classGroup();
    mocks.curriculums.findAll.mockResolvedValue([{ id: "cur-9" }]);

    const result = await mocks.service.assignToClassGroup(group as never);

    expect(mocks.curriculums.create).not.toHaveBeenCalled();
    expect(group.update).toHaveBeenCalledWith({ curriculumId: "cur-9" }, { transaction: undefined });
    expect(result).toMatchObject({ id: "cur-9" });
  });

  it("requires an explicit choice when an intake has multiple curriculums", async () => {
    const mocks = buildService();
    mocks.curriculums.findAll.mockResolvedValue([{ id: "cur-a" }, { id: "cur-b" }]);

    await expect(mocks.service.assignToClassGroup(classGroup() as never))
      .rejects.toThrow("Vui lòng chọn CTĐT cho lớp");
  });

  it("assigns the explicitly selected complete curriculum", async () => {
    const mocks = buildService();
    const group = classGroup();
    mocks.curriculums.findByPk.mockResolvedValue({
      id: "cur-b", majorId: "major-1", program: "masters", applicableFromYear: "2026", active: true,
    });

    const result = await mocks.service.assignToClassGroup(group as never, undefined, "cur-b");

    expect(group.update).toHaveBeenCalledWith({ curriculumId: "cur-b" }, { transaction: undefined });
    expect(result).toMatchObject({ id: "cur-b" });
  });
});

describe("CurriculumService.classSubjects", () => {
  it("is read-only: returns no curriculum and creates nothing when the class has none", async () => {
    const mocks = buildService();
    mocks.classGroups.findByPk.mockResolvedValue(classGroup({ curriculumId: null }));
    mocks.curriculums.findAll.mockResolvedValue([]);

    const result = await mocks.service.classSubjects("class-1");

    expect(result.curriculum).toBeNull();
    expect(result.subjects).toEqual([]);
    expect(mocks.curriculums.create).not.toHaveBeenCalled();
  });

  it("re-links an unlinked class to the curriculum of its major + intake", async () => {
    const mocks = buildService();
    const group = classGroup({ curriculumId: null });
    mocks.classGroups.findByPk.mockResolvedValue(group);
    mocks.curriculums.findAll.mockResolvedValue([{ id: "cur-existing", code: "CT-KTHH-2026", name: "CTĐT" }]);

    const result = await mocks.service.classSubjects("class-1");

    expect(mocks.curriculums.create).not.toHaveBeenCalled();
    expect(group.update).toHaveBeenCalledWith({ curriculumId: "cur-existing" }, { transaction });
    expect(result.curriculum).toMatchObject({ id: "cur-existing" });
  });
});

