import { BadRequestException } from "@nestjs/common";
import { jest } from "@jest/globals";
import { SystemService } from "../../src/system/system.service.js";

const buildService = () => {
  const trainingLevels = { findByPk: jest.fn(), findOne: jest.fn() };
  const disciplines = { findByPk: jest.fn(), findOne: jest.fn() };
  const majors = { findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn(), count: jest.fn() };
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
  );
  return { service, trainingLevels, disciplines, majors };
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
    }));
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

  it("stores a major without a code and keeps the English name", async () => {
    const { service, trainingLevels, disciplines, majors } = buildService();
    disciplines.findByPk.mockResolvedValue({ id: "discipline-1" });
    trainingLevels.findOne.mockResolvedValue({ id: "masters-level", code: "MASTER" });
    trainingLevels.findByPk.mockResolvedValue({ id: "masters-level", code: "MASTER" });
    majors.create.mockImplementation(async (values: unknown) => values);

    await service.createMajor({
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
    expect(majors.create.mock.calls[0][0]).not.toHaveProperty("code");
  });
});
