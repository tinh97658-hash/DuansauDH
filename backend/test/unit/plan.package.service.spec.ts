import { jest } from "@jest/globals";
import { PlanService } from "../../src/plan/plan.service.js";

/**
 * Unit tests for PlanService package operations:
 * - createPackage (validation: chuyên ngành/bậc, đúng 21 môn cho gói chính thức)
 * - setOfficialPackage (đúng 21 môn, chọn 1 gói chính thức/lớp)
 */
const buildService = () => {
  const subjects = { findAll: jest.fn() };
  const packages = { findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() };
  const packageEntries = { bulkCreate: jest.fn(), count: jest.fn(), destroy: jest.fn() };
  const classGroups = { findByPk: jest.fn(), findAll: jest.fn() };
  const majors = { findByPk: jest.fn() };
  const admissionRecords = {};
  const sequelize = {
    transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) => cb({ LOCK: { UPDATE: "UPDATE" } })),
  };
  const classGroupsService = {};
  const service = new PlanService(
    subjects as never,
    packages as never,
    packageEntries as never,
    classGroups as never,
    majors as never,
    admissionRecords as never,
    sequelize as never,
    classGroupsService as never,
  );
  return { service, subjects, packages, packageEntries, classGroups, majors };
};

const classGroup = { id: "class-1", majorId: "major-1", program: "masters" };
const twentyOne = Array.from({ length: 21 }, (_, i) => `sub-${i}`);

describe("PlanService.createPackage", () => {
  it("creates an official package with exactly 21 subjects of the same major/program", async () => {
    const { service, subjects, packages, packageEntries, classGroups } = buildService();
    classGroups.findByPk.mockResolvedValue(classGroup);
    packages.findOne.mockResolvedValue(null);
    subjects.findAll.mockResolvedValue(twentyOne.map((id) => ({ id })));
    const createdPkg = { id: "pkg-1", code: "G1", name: "Gói 1", isOfficial: true, totalSubjects: 21 };
    packages.create.mockResolvedValue(createdPkg);
    packages.findByPk.mockResolvedValue(createdPkg);

    await service.createPackage({ code: "G1", name: "Gói 1", classGroupId: "class-1", subjectIds: twentyOne, isOfficial: true });

    expect(packages.create).toHaveBeenCalledWith(
      expect.objectContaining({ isOfficial: true, totalSubjects: 21 }),
      expect.anything(),
    );
    expect(packageEntries.bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ packageId: "pkg-1", subjectId: "sub-0" })]),
      expect.anything(),
    );
    expect(subjects.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ majorId: classGroup.majorId, program: classGroup.program }),
    }));
  });

  it("rejects an official package that does not have exactly 21 subjects", async () => {
    const { service, subjects, packages, classGroups } = buildService();
    classGroups.findByPk.mockResolvedValue(classGroup);
    packages.findOne.mockResolvedValue(null);
    const subjectIds = twentyOne.slice(0, 20);
    subjects.findAll.mockResolvedValue(subjectIds.map((id) => ({ id })));

    await expect(service.createPackage({
      code: "G1", name: "Gói 1", classGroupId: "class-1", subjectIds, isOfficial: true,
    })).rejects.toThrow("Gói học phần chính thức phải có đúng 21 học phần.");
    expect(packages.create).not.toHaveBeenCalled();
  });

  it("rejects subjects that are not part of the class major/program", async () => {
    const { service, subjects, packages, classGroups } = buildService();
    classGroups.findByPk.mockResolvedValue(classGroup);
    packages.findOne.mockResolvedValue(null);
    // Only one of the two requested subjects belongs to the class major.
    subjects.findAll.mockResolvedValue([{ id: "sub-1" }]);

    await expect(service.createPackage({
      code: "G1", name: "Gói 1", classGroupId: "class-1", subjectIds: ["sub-1", "sub-2"],
    })).rejects.toThrow("không thuộc chuyên ngành/bậc của lớp");
    expect(packages.create).not.toHaveBeenCalled();
  });
});

describe("PlanService.setOfficialPackage", () => {
  it("sets a package with exactly 21 subjects as the official one", async () => {
    const { service, packages, packageEntries } = buildService();
    const pkg = { id: "pkg-1", active: true, classGroupId: "class-1", update: jest.fn().mockResolvedValue(undefined) };
    packages.findByPk.mockResolvedValue(pkg);
    packageEntries.count.mockResolvedValue(21);
    packages.update.mockResolvedValue(undefined);

    const result = await service.setOfficialPackage("pkg-1");

    expect(packageEntries.count).toHaveBeenCalledWith(expect.objectContaining({ where: { packageId: "pkg-1" } }));
    expect(packages.update).toHaveBeenCalledWith({ isOfficial: false }, expect.objectContaining({ where: { classGroupId: "class-1" } }));
    expect(pkg.update).toHaveBeenCalledWith({ isOfficial: true, totalSubjects: 21 }, expect.anything());
    expect(result).toBe(pkg);
  });

  it("rejects a package that does not have exactly 21 subjects", async () => {
    const { service, packages, packageEntries } = buildService();
    const pkg = { id: "pkg-1", active: true, classGroupId: "class-1", update: jest.fn() };
    packages.findByPk.mockResolvedValue(pkg);
    packageEntries.count.mockResolvedValue(20);

    await expect(service.setOfficialPackage("pkg-1")).rejects.toThrow("Gói học phần chính thức phải có đúng 21 học phần.");
    expect(pkg.update).not.toHaveBeenCalled();
  });

  it("rejects an inactive package", async () => {
    const { service, packages } = buildService();
    const pkg = { id: "pkg-1", active: false, classGroupId: "class-1", update: jest.fn() };
    packages.findByPk.mockResolvedValue(pkg);

    await expect(service.setOfficialPackage("pkg-1")).rejects.toThrow("Không thể chọn gói học phần đã ngừng sử dụng.");
    expect(pkg.update).not.toHaveBeenCalled();
  });
});
