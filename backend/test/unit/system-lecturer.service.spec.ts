import { jest } from "@jest/globals";
import { SystemService } from "../../src/system/system.service.js";

const buildService = () => {
  const disciplines = { findByPk: jest.fn() };
  const majors = { findByPk: jest.fn() };
  const lecturers = { findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn() };
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
  it("creates a lecturer with a teaching unit without requiring discipline or major", async () => {
    const { service, disciplines, majors, lecturers } = buildService();
    lecturers.findOne.mockResolvedValue(null);
    lecturers.create.mockImplementation(async (value) => value);

    await service.createLecturer({
      code: "53", name: "Nguyễn Đại An", faculty: "Khoa Máy tàu biển",
    });

    expect(lecturers.create).toHaveBeenCalledWith(expect.objectContaining({ faculty: "Khoa Máy tàu biển" }));
    expect(disciplines.findByPk).not.toHaveBeenCalled();
    expect(majors.findByPk).not.toHaveBeenCalled();
  });

  it("creates a lecturer with a unit ID without requiring a major", async () => {
    const { service, lecturers, disciplines, majors } = buildService();
    lecturers.findOne.mockResolvedValue(null);
    disciplines.findByPk.mockResolvedValue({ id: "discipline-1", active: true });

    await service.createLecturer({
      code: "53", name: "Nguyễn Đại An", disciplineId: "discipline-1",
    });
    expect(lecturers.create).toHaveBeenCalledWith(expect.objectContaining({ disciplineId: "discipline-1" }));
    expect(majors.findByPk).not.toHaveBeenCalled();
  });

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
    })).rejects.toThrow("Chuyên ngành đã khai báo không thuộc đơn vị đã chọn");
    expect(lecturers.create).not.toHaveBeenCalled();
  });

  it.each([null, { active: false }])("rejects invalid or inactive unit %s", async (unit) => {
    const { service, lecturers, disciplines } = buildService();
    lecturers.findOne.mockResolvedValue(null);
    disciplines.findByPk.mockResolvedValue(unit);
    await expect(service.createLecturer({ code: "GV-1", name: "An", disciplineId: "bad" }))
      .rejects.toThrow("Đơn vị của giảng viên không tồn tại hoặc đã ngừng sử dụng");
    expect(lecturers.create).not.toHaveBeenCalled();
  });

  it("preserves legacy text and other fields when linking a unit", async () => {
    const { service, lecturers, disciplines } = buildService();
    const row = { disciplineId: null, majorId: null, faculty: "Tên cũ", phone: "123", update: jest.fn() };
    lecturers.findByPk.mockResolvedValue(row);
    disciplines.findByPk.mockResolvedValue({ id: "unit", active: true });
    await service.updateLecturer("gv", { disciplineId: "unit" });
    expect(row.update).toHaveBeenCalledWith({ disciplineId: "unit" });
    expect(row.faculty).toBe("Tên cũ");
    expect(row.phone).toBe("123");
  });

  it("allows unrelated edits of an unchanged legacy classification", async () => {
    const { service, lecturers, disciplines } = buildService();
    const row = { disciplineId: null, majorId: "legacy", faculty: "Tên cũ", update: jest.fn() };
    lecturers.findByPk.mockResolvedValue(row);
    await service.updateLecturer("gv", { name: "Tên mới", disciplineId: null } as never);
    expect(row.update).toHaveBeenCalledWith({ name: "Tên mới", disciplineId: null });
    expect(disciplines.findByPk).not.toHaveBeenCalled();
  });

  it("rejects clearing a unit with an existing major instead of ignoring explicit null", async () => {
    const { service, lecturers } = buildService();
    const row = { disciplineId: "unit", majorId: "legacy", update: jest.fn() };
    lecturers.findByPk.mockResolvedValue(row);
    await expect(service.updateLecturer("gv", { disciplineId: null } as never)).rejects.toThrow("Vui lòng chọn đơn vị");
    expect(row.update).not.toHaveBeenCalled();
  });
});
