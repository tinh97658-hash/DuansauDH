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
  const curriculums = { findOne: jest.fn(), findByPk: jest.fn(), findAll: jest.fn(), create: jest.fn(), update: jest.fn() };
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
    mocks.curriculums.findOne.mockResolvedValue(null);
    mocks.majors.findByPk.mockResolvedValue({ id: "major-1", code: "KTHH", name: "Khai thác hàng hải", program: "masters", active: true });
    mocks.curriculums.create.mockResolvedValue({ id: "cur-1", code: "CT-KTHH-2026" });
    mocks.blocks.findAll.mockResolvedValueOnce([]);
    mocks.blocks.findAll.mockResolvedValue(blockRows);
    mocks.blocks.create.mockImplementation(async (payload: any) => ({ id: `created-${payload.code}`, ...payload }));
    mocks.subjects.findAll.mockResolvedValue([
      { id: "subject-1", subjectType: "CN", isRequired: true, credits: 3, sortOrder: 0, codeNumber: 1, active: true },
      { id: "subject-2", subjectType: "TC", isRequired: false, credits: 2, sortOrder: 1, codeNumber: 2, active: true },
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
    // Tổng tín chỉ = tín chỉ bắt buộc (nhóm tự chọn chưa khai báo tối thiểu).
    expect(mocks.curriculums.update).toHaveBeenCalledWith({ totalCredits: 3 }, expect.anything());
    expect(group.update).toHaveBeenCalledWith({ curriculumId: "cur-1" }, { transaction: undefined });
    expect(result).toMatchObject({ id: "cur-1" });
  });

  it("reuses the existing curriculum of the same major, program and intake", async () => {
    const mocks = buildService();
    const group = classGroup();
    mocks.curriculums.findOne.mockResolvedValue({ id: "cur-9" });

    const result = await mocks.service.assignToClassGroup(group as never);

    expect(mocks.curriculums.create).not.toHaveBeenCalled();
    expect(group.update).toHaveBeenCalledWith({ curriculumId: "cur-9" }, { transaction: undefined });
    expect(result).toMatchObject({ id: "cur-9" });
  });
});

describe("CurriculumService.classSubjects", () => {
  it("is read-only: returns no curriculum and creates nothing when the class has none", async () => {
    const mocks = buildService();
    mocks.classGroups.findByPk.mockResolvedValue(classGroup({ curriculumId: null }));
    mocks.curriculums.findOne.mockResolvedValue(null);

    const result = await mocks.service.classSubjects("class-1");

    expect(result.curriculum).toBeNull();
    expect(result.subjects).toEqual([]);
    expect(mocks.curriculums.create).not.toHaveBeenCalled();
  });

  it("re-links an unlinked class to the curriculum of its major + intake", async () => {
    const mocks = buildService();
    const group = classGroup({ curriculumId: null });
    mocks.classGroups.findByPk.mockResolvedValue(group);
    mocks.curriculums.findOne.mockResolvedValue({ id: "cur-existing", code: "CT-KTHH-2026", name: "CTĐT" });

    const result = await mocks.service.classSubjects("class-1");

    expect(mocks.curriculums.create).not.toHaveBeenCalled();
    expect(group.update).toHaveBeenCalledWith({ curriculumId: "cur-existing" }, { transaction });
    expect(result.curriculum).toMatchObject({ id: "cur-existing" });
  });
});

describe("CurriculumService.setClassElectives", () => {
  const arrangeCurriculum = (mocks: ReturnType<typeof buildService>, rows: any[]) => {
    mocks.classGroups.findByPk.mockResolvedValue(classGroup({ curriculumId: "cur-1" }));
    mocks.curriculums.findByPk.mockResolvedValue({ id: "cur-1" });
    mocks.entries.findAll.mockResolvedValueOnce(rows);
  };

  it("rejects electives outside the class curriculum", async () => {
    const mocks = buildService();
    arrangeCurriculum(mocks, [{ id: "entry-1", isRequired: false, credits: 3, electiveGroupId: null }]);

    await expect(mocks.service.setClassElectives("class-1", ["missing-entry"]))
      .rejects.toThrow("không thuộc chương trình đào tạo của lớp");
    expect(mocks.classElectives.bulkCreate).not.toHaveBeenCalled();
  });

  it("refuses to treat a required subject as an elective", async () => {
    const mocks = buildService();
    arrangeCurriculum(mocks, [{ id: "entry-1", isRequired: true, credits: 3, electiveGroupId: null }]);

    await expect(mocks.service.setClassElectives("class-1", ["entry-1"]))
      .rejects.toThrow("không cần chọn");
    expect(mocks.classElectives.bulkCreate).not.toHaveBeenCalled();
  });

  it("enforces the minimum credits of an elective group", async () => {
    const mocks = buildService();
    arrangeCurriculum(mocks, [{
      id: "entry-1", isRequired: false, credits: 2, electiveGroupId: "group-1",
      electiveGroup: { id: "group-1", name: "Nhóm tự chọn A", minCredits: 6, maxCredits: 0 },
    }]);

    await expect(mocks.service.setClassElectives("class-1", ["entry-1"]))
      .rejects.toThrow("cần tối thiểu 6 tín chỉ");
  });

  it("stores the electives chosen for the whole class", async () => {
    const mocks = buildService();
    arrangeCurriculum(mocks, [{ id: "entry-1", isRequired: false, credits: 3, electiveGroupId: null }]);
    const effective = { subjects: [], totals: { totalCredits: 3 } };
    jest.spyOn(mocks.service, "classSubjects").mockResolvedValue(effective as never);

    const result = await mocks.service.setClassElectives("class-1", ["entry-1"]);

    expect(mocks.classElectives.destroy).toHaveBeenCalledWith({ where: { classGroupId: "class-1" }, transaction });
    expect(mocks.classElectives.bulkCreate).toHaveBeenCalledWith(
      [{ classGroupId: "class-1", curriculumSubjectId: "entry-1" }],
      { transaction },
    );
    expect(result).toEqual(effective);
  });
});
