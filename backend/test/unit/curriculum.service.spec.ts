import { jest } from "@jest/globals";
import { CurriculumService } from "../../src/plan/curriculum.service.js";

const transaction = { LOCK: { UPDATE: "UPDATE" } };

const blockRows = [
  { id: "block-cs", code: "CS", sortOrder: 1 },
  { id: "block-cn", code: "CN", sortOrder: 2 },
  { id: "block-tt", code: "TT", sortOrder: 3 },
  { id: "block-tn", code: "TN", sortOrder: 4 },
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
  const sequelize = { query: jest.fn().mockResolvedValue([{ used: false }]), transaction: jest.fn((callback: (tx: any) => Promise<unknown>) => callback(transaction)) };
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

describe("CurriculumService protects curricula already in use", () => {
  const buildUsed = () => {
    const mocks = buildService();
    const curriculum = { id: "cur-1", majorId: "major-1", program: "masters", applicableFromYear: "2026", totalCredits: 30,
      update: jest.fn(), destroy: jest.fn() };
    mocks.curriculums.findByPk.mockResolvedValue(curriculum);
    mocks.majors.findByPk.mockResolvedValue({ id: "major-1", program: "masters", active: true });
    mocks.sequelize.query.mockResolvedValue([{ used: true }]);
    return { ...mocks, curriculum };
  };

  it("rejects clearing the subjects of an assigned curriculum without any writes", async () => {
    const mocks = buildUsed();
    await expect(mocks.service.setSubjects("cur-1", { subjects: [] })).rejects.toMatchObject({ response: { code: "CURRICULUM_IN_USE" } });
    expect(mocks.entries.destroy).not.toHaveBeenCalled();
    expect(mocks.entries.create).not.toHaveBeenCalled();
  });

  it.each([{ majorId: "major-2" }, { program: "doctoral" }, { applicableFromYear: "2027" }, { totalCredits: 40 }])(
    "blocks structural curriculum edits: %j", async patch => {
      const mocks = buildUsed();
      await expect(mocks.service.update("cur-1", patch)).rejects.toMatchObject({ response: { code: "CURRICULUM_IN_USE" } });
      expect(mocks.curriculum.update).not.toHaveBeenCalled();
    },
  );

  it("preserves metadata edits and unchanged scope values", async () => {
    const mocks = buildUsed();
    jest.spyOn(mocks.service, "detail").mockResolvedValue({ id: "cur-1" } as never);
    await mocks.service.update("cur-1", { majorId: "major-1", applicableFromYear: "2026", totalCredits: 30, note: "Metadata" });
    expect(mocks.curriculum.update).toHaveBeenCalledWith(expect.objectContaining({ note: "Metadata" }), { transaction });
  });

  it("blocks replacing a used class curriculum through the assignment helper", async () => {
    const mocks = buildUsed();
    mocks.curriculums.findByPk.mockResolvedValue({ id: "cur-2", majorId: "major-1", program: "masters", applicableFromYear: "2026", active: true });
    const group = classGroup({ curriculumId: "cur-1" });
    await expect(mocks.service.assignToClassGroup(group as never, transaction as never, "cur-2"))
      .rejects.toMatchObject({ response: { code: "CLASS_SCOPE_IN_USE" } });
    expect(group.update).not.toHaveBeenCalled();
  });

  it("does not silently bind a legacy used class while reading subjects", async () => {
    const mocks = buildUsed();
    const group = classGroup();
    mocks.classGroups.findByPk.mockResolvedValue(group);
    mocks.curriculums.findAll.mockResolvedValue([{ id: "cur-1" }]);
    await expect(mocks.service.classSubjects(group.id)).rejects.toMatchObject({ response: { code: "CLASS_SCOPE_IN_USE" } });
    expect(group.update).not.toHaveBeenCalled();
  });

  it("preserves a curriculum referenced only by transfer history", async () => {
    const mocks = buildUsed();
    await expect(mocks.service.remove("cur-1")).rejects.toMatchObject({ response: { code: "CURRICULUM_IN_USE" } });
    expect(mocks.curriculum.destroy).not.toHaveBeenCalled();
  });
});

it("returns the same canonical order from detail and classSubjects across knowledge blocks without writes", async () => {
  const mocks = buildService();
  const entries = [
    { id: "entry-t", subjectId: "t", sortOrder: 1, blockId: "block-cs", credits: 3, isRequired: true, subject: { id: "t", name: "Triết học", code: "T", subjectType: "CS" } },
    { id: "entry-a", subjectId: "a", sortOrder: 2, blockId: "block-cn", credits: 4, isRequired: true, subject: { id: "a", name: "An toàn bảo mật", code: "A", subjectType: "CN" } },
  ];
  const curriculum = { id: "cur-1", majorId: "major-1", program: "masters", applicableFromYear: "2026", blocks: blockRows, subjectEntries: entries };
  const group = classGroup({ curriculumId: "cur-1" });
  mocks.curriculums.findByPk.mockResolvedValue(curriculum);
  mocks.classGroups.findByPk.mockResolvedValue(group);
  mocks.blocks.findAll.mockResolvedValue(blockRows);
  mocks.entries.findAll.mockResolvedValue(entries);
  const detail = await mocks.service.detail("cur-1");
  const forClass = await mocks.service.classSubjects("class-1");
  expect(detail.subjects.map(row => row.subjectId)).toEqual(["a", "t"]);
  expect(forClass.subjects.map(row => row.subjectId)).toEqual(["a", "t"]);
  expect(detail.subjects.map(row => [row.blockId, row.sortOrder])).toEqual([["block-cn", 2], ["block-cs", 1]]);
  expect(forClass.subjects.map(row => row.blockCode)).toEqual(["CN", "CS"]);
  expect(entries.map(row => row.subjectId)).toEqual(["t", "a"]);
  expect(mocks.entries.bulkCreate).not.toHaveBeenCalled();
  expect(mocks.curriculums.update).not.toHaveBeenCalled();
  expect(group.update).not.toHaveBeenCalled();
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
      { id: "subject-2", majorId: "major-1", program: "masters", subjectType: "TT", isRequired: false, credits: 2, sortOrder: 1, codeNumber: 2, active: true },
    ]);
    mocks.entries.findAll.mockResolvedValue([
      { id: "entry-1", subjectId: "subject-1", isRequired: true, credits: 3, update: jest.fn().mockResolvedValue(undefined) },
      { id: "entry-2", subjectId: "subject-2", isRequired: false, credits: 2, update: jest.fn().mockResolvedValue(undefined) },
    ]);
    const existingEntries = await mocks.entries.findAll();

    const result = await mocks.service.assignToClassGroup(group as never);

    expect(mocks.curriculums.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: "CT-2026", majorId: "major-1", program: "masters", applicableFromYear: "2026" }),
      expect.anything(),
    );
    // Toàn bộ học phần của ngành vào CTĐT, giữ đúng bắt buộc/tự chọn và khối kiến thức.
    expect((existingEntries[0] as any).update).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: "subject-1", isRequired: true, blockId: "block-cn" }),
      expect.anything(),
    );
    expect((existingEntries[1] as any).update).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: "subject-2", isRequired: false, blockId: "block-tt" }),
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
  it("cannot restore stale catalog credits through a curriculum save and preserves the existing entry ID", async () => {
    const mocks = buildService();
    const entry = { id: "entry-1", subjectId: "subject-1", credits: 3, isRequired: true, update: jest.fn().mockResolvedValue(undefined) };
    mocks.curriculums.findByPk.mockResolvedValue({ id: "cur-1", majorId: "major-1", program: "masters", subjectEntries: [] });
    mocks.blocks.findAll.mockResolvedValue(blockRows);
    mocks.entries.findAll.mockResolvedValue([entry]);
    mocks.subjects.findAll.mockResolvedValue([{ id: "subject-1", majorId: "major-1", program: "masters", credits: 5, isRequired: true, subjectType: "CN", active: true }]);
    await mocks.service.setSubjects("cur-1", { subjects: [{ subjectId: "subject-1", credits: 3, blockCode: "CS" }] });
    expect(entry.update).toHaveBeenCalledWith(expect.objectContaining({ credits: 5, blockId: "block-cn" }), expect.anything());
    expect(mocks.entries.create).not.toHaveBeenCalled();
    expect(mocks.entries.destroy).not.toHaveBeenCalled();
  });

  it("reads current catalog metadata and totals despite legacy curriculum snapshots", async () => {
    const mocks = buildService();
    mocks.classGroups.findByPk.mockResolvedValue(classGroup({ curriculumId: "cur-1" }));
    const curriculum = {
      id: "cur-1", majorId: "major-1", program: "masters", applicableFromYear: "2026",
      totalCredits: 99, blocks: [], electiveGroups: [],
      subjectEntries: [{ id: "entry-1", subjectId: "subject-1", credits: 3, isRequired: true,
        subject: { name: "Tên học phần đã sửa", codeText: "NEW01", credits: 5, isRequired: false, subjectType: "CS" } }],
    };
    mocks.curriculums.findByPk.mockResolvedValue(curriculum);
    mocks.entries.findAll.mockResolvedValue(curriculum.subjectEntries);
    const detail = await mocks.service.detail("cur-1");
    const classSubjects = await mocks.service.classSubjects("class-1");
    for (const result of [detail, classSubjects]) {
      expect(result.subjects[0]).toMatchObject({ name: "Tên học phần đã sửa", code: "NEW01", credits: 5, isRequired: false, blockCode: "CS" });
      expect(result.totals.totalCredits).toBe(5);
    }
    expect(detail.totalCredits).toBe(5);
    expect(classSubjects.curriculum?.totalCredits).toBe(5);
  });

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

