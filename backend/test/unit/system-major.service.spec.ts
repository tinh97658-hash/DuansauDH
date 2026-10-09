import { BadRequestException } from "@nestjs/common";
import { jest } from "@jest/globals";
import { SystemService } from "../../src/system/system.service.js";

const buildService = () => {
  const trainingLevels = { findByPk: jest.fn(), findOne: jest.fn() };
  const disciplines = { findByPk: jest.fn(), findOne: jest.fn() };
  const majors = { findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn(), count: jest.fn() };
  const classGroups = { findAll: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null) };
  const service = new SystemService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    trainingLevels as never,
    disciplines as never,
    majors as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    classGroups as never,
  );
  return { service, trainingLevels, disciplines, majors, classGroups };
};

describe("SystemService major catalog synchronization", () => {
  it("moves the training-level foreign key when a major program changes", async () => {
    const { service, trainingLevels, majors } = buildService();
    const row = { code: "KHHH", disciplineId: "discipline-1", program: "masters", update: jest.fn() };
    majors.findByPk.mockResolvedValue(row);
    trainingLevels.findOne.mockResolvedValue({ id: "doctoral-level", code: "DOCTOR" });
    trainingLevels.findByPk.mockResolvedValue({ id: "doctoral-level", code: "DOCTOR" });

    await service.updateMajor("major-1", { program: "doctoral" });

    expect(row.update).toHaveBeenCalledWith(expect.objectContaining({
      program: "doctoral",
      disciplineId: "discipline-1",
      trainingLevelId: "doctoral-level",
    }), { transaction: undefined });
  });

  it("rejects an explicitly selected training level that conflicts with the program", async () => {
    const { service, trainingLevels, disciplines, majors } = buildService();
    disciplines.findByPk.mockResolvedValue({ id: "6bcd1725-c40d-424d-8f2c-15012be8c450" });
    majors.findOne.mockResolvedValue(null);
    trainingLevels.findByPk.mockResolvedValue({ id: "masters-level", code: "MASTER" });

    await expect(service.createMajor({
      code: "KHHH-TS",
      name: "Khoa học hàng hải",
      program: "doctoral",
      disciplineId: "6bcd1725-c40d-424d-8f2c-15012be8c450",
      trainingLevelId: "6bcd1725-c40d-424d-8f2c-15012be8c451",
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(majors.create).not.toHaveBeenCalled();
  });

  it("requires the parent discipline when creating a major", async () => {
    const { service, majors } = buildService();

    await expect(service.createMajor({ code: "KTHH", name: "Khai thác hàng hải" }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(majors.create).not.toHaveBeenCalled();
  });

  it("stores the major code and keeps the English name", async () => {
    const { service, trainingLevels, disciplines, majors } = buildService();
    disciplines.findByPk.mockResolvedValue({ id: "discipline-1" });
    trainingLevels.findOne.mockResolvedValue({ id: "masters-level", code: "MASTER" });
    trainingLevels.findByPk.mockResolvedValue({ id: "masters-level", code: "MASTER" });
    majors.create.mockImplementation(async (values: unknown) => values);

    await service.createMajor({
      code: "KTHH",
      name: "Khai thác hàng hải",
      englishName: "Nautical Science",
      disciplineId: "discipline-1",
      program: "masters",
    });

    expect(majors.create).toHaveBeenCalledWith(expect.objectContaining({
      name: "Khai thác hàng hải",
      englishName: "Nautical Science",
      disciplineId: "discipline-1",
    }));
    expect(majors.create.mock.calls[0][0]).toHaveProperty("code", "KTHH");
  });
  it("updates existing group codes and their mirrored names when a major code changes", async () => {
    const { service, majors, trainingLevels, classGroups } = buildService();
    const row = { id: "major-1", code: "OLD", program: "masters", disciplineId: "discipline-1", update: jest.fn() };
    const group = { id: "g1", groupNumber: 3, intakeRound: 2, academicYear: "2026", program: "masters", update: jest.fn() };
    majors.findByPk.mockResolvedValue(row);
    trainingLevels.findOne.mockResolvedValue({ id: "master", code: "MASTER" });
    trainingLevels.findByPk.mockResolvedValue({ id: "master", code: "MASTER" });
    classGroups.findAll.mockResolvedValue([group]);
    await service.updateMajor("major-1", { code: " cntt " });
    expect(group.update).toHaveBeenCalledWith({ code: "CNTT 2026.2.3", name: "CNTT 2026.2.3" }, { transaction: undefined });
    expect(row.update).toHaveBeenCalledWith(expect.objectContaining({ code: "CNTT" }), { transaction: undefined });
  });

  it("rejects an empty or duplicate major code", async () => {
    const { service, majors, disciplines } = buildService();
    disciplines.findByPk.mockResolvedValue({ id: "discipline-1" });
    await expect(service.createMajor({ name: "CNTT", disciplineId: "discipline-1", code: "" })).rejects.toBeInstanceOf(BadRequestException);
    majors.findOne.mockResolvedValue({ id: "existing" });
    await expect(service.createMajor({ name: "CNTT", disciplineId: "discipline-1", code: "CNTT" })).rejects.toThrow("đã tồn tại");
    expect(majors.create).not.toHaveBeenCalled();
  });
});
