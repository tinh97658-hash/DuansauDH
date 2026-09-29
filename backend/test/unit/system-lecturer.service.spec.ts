import { jest } from "@jest/globals";
import { SystemService } from "../../src/system/system.service.js";

const buildService = () => {
  const disciplines = { findByPk: jest.fn() };
  const majors = { findByPk: jest.fn() };
  const lecturers = { findOne: jest.fn(), create: jest.fn() };
  const service = new SystemService(
    {} as never, {} as never, {} as never, {} as never, {} as never,
    {} as never, {} as never, {} as never,
    disciplines as never,
    majors as never,
    {} as never, {} as never,
    lecturers as never,
    {} as never, {} as never, {} as never,
  );
  return { service, disciplines, majors, lecturers };
};

describe("SystemService lecturer discipline and major scope", () => {
  it("creates a lecturer when the major belongs to the selected discipline", async () => {
    const { service, disciplines, majors, lecturers } = buildService();
    lecturers.findOne.mockResolvedValue(null);
    lecturers.create.mockImplementation(async (value) => value);
    disciplines.findByPk.mockResolvedValue({ id: "discipline-1", active: true });
    majors.findByPk.mockResolvedValue({ id: "major-1", disciplineId: "discipline-1", active: true });

    await service.createLecturer({
      code: "GV-01", name: "Nguyễn Văn A", disciplineId: "discipline-1", majorId: "major-1",
    });

    expect(lecturers.create).toHaveBeenCalledWith(expect.objectContaining({
      disciplineId: "discipline-1", majorId: "major-1",
    }));
  });

  it("rejects a major from another discipline", async () => {
    const { service, disciplines, majors, lecturers } = buildService();
    lecturers.findOne.mockResolvedValue(null);
    disciplines.findByPk.mockResolvedValue({ id: "discipline-1", active: true });
    majors.findByPk.mockResolvedValue({ id: "major-2", disciplineId: "discipline-2", active: true });

    await expect(service.createLecturer({
      code: "GV-01", name: "Nguyễn Văn A", disciplineId: "discipline-1", majorId: "major-2",
    })).rejects.toThrow("Chuyên ngành không thuộc ngành đã chọn");
    expect(lecturers.create).not.toHaveBeenCalled();
  });
});
