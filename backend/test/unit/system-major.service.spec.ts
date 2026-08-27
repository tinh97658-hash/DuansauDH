import { BadRequestException } from "@nestjs/common";
import { jest } from "@jest/globals";
import { SystemService } from "../../src/system/system.service.js";

const buildService = () => {
  const trainingLevels = { findByPk: jest.fn(), findOne: jest.fn() };
  const majors = { findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn() };
  const service = new SystemService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    trainingLevels as never,
    majors as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, trainingLevels, majors };
};

describe("SystemService major catalog synchronization", () => {
  it("moves the training-level foreign key when a major program changes", async () => {
    const { service, trainingLevels, majors } = buildService();
    const row = { code: "KHHH", program: "masters", update: jest.fn() };
    majors.findByPk.mockResolvedValue(row);
    trainingLevels.findOne.mockResolvedValue({ id: "doctoral-level", code: "DOCTOR" });
    trainingLevels.findByPk.mockResolvedValue({ id: "doctoral-level", code: "DOCTOR" });

    await service.updateMajor("major-1", { program: "doctoral" });

    expect(row.update).toHaveBeenCalledWith(expect.objectContaining({
      program: "doctoral",
      trainingLevelId: "doctoral-level",
    }));
  });

  it("rejects an explicitly selected training level that conflicts with the program", async () => {
    const { service, trainingLevels, majors } = buildService();
    majors.findOne.mockResolvedValue(null);
    trainingLevels.findByPk.mockResolvedValue({ id: "masters-level", code: "MASTER" });

    await expect(service.createMajor({
      code: "KHHH-TS",
      name: "Khoa học hàng hải",
      program: "doctoral",
      trainingLevelId: "6bcd1725-c40d-424d-8f2c-15012be8c451",
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(majors.create).not.toHaveBeenCalled();
  });
});
