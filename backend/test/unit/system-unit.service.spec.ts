import { SystemService } from "../../src/system/system.service.js";
import { collectLecturerUnits } from "../../src/database/migrations/052-lecturer-units.js";

const setup = () => {
  const units = { findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn() };
  const lecturers = { findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn(), count: jest.fn() };
  const service = new SystemService(
    {} as never, {} as never, {} as never, {} as never, {} as never,
    {} as never, {} as never, {} as never, {} as never, {} as never,
    {} as never, {} as never, lecturers as never, {} as never, {} as never, {} as never,
    {} as never, null as never, units as never,
  );
  return { service, units, lecturers };
};

it("backfills displayed unit names and merges repeated faculty names without guessing a discipline", () => {
  expect(collectLecturerUnits([
    { id: "1", faculty: "Khoa Công trình" },
    { id: "2", faculty: "  Khoa   Công trình " },
    { id: "3", faculty: "khoa công trình" },
    { id: "4", faculty: "Viện Cơ khí" },
    { id: "5", discipline_name: "Kỹ thuật xây dựng", faculty: "Tên cũ" },
    { id: "6", faculty: "   " },
  ])).toEqual([
    { name: "Khoa Công trình", lecturerIds: ["1", "2", "3"] },
    { name: "Viện Cơ khí", lecturerIds: ["4"] },
    { name: "Kỹ thuật xây dựng", lecturerIds: ["5"] },
  ]);
});

it("creates an independent unit", async () => {
  const { service, units } = setup();
  units.findOne.mockResolvedValue(null);
  await service.createUnit({ code: "CK", name: "Viện Cơ khí", disciplineId: "ignore" });
  expect(units.create).toHaveBeenCalledWith({ code: "CK", name: "Viện Cơ khí" });
});

it("propagates renaming through the linked unit instead of rewriting lecturer legacy text", async () => {
  const { service, units } = setup();
  const row = { code: "CK", update: jest.fn() };
  units.findByPk.mockResolvedValue(row);
  await service.updateUnit("unit", { name: "Viện Cơ khí mới" });
  expect(row.update).toHaveBeenCalledWith({ name: "Viện Cơ khí mới" });
});

it("blocks deleting a unit used by lecturers", async () => {
  const { service, units, lecturers } = setup();
  const row = { name: "Viện Cơ khí", destroy: jest.fn() };
  units.findByPk.mockResolvedValue(row);
  lecturers.count.mockResolvedValue(2);
  await expect(service.removeUnit("unit")).rejects.toThrow("đang có 2 giảng viên");
  expect(row.destroy).not.toHaveBeenCalled();
});

it.each([null, { active: false }])("rejects missing or inactive unit on lecturer create", async (unit) => {
  const { service, units, lecturers } = setup();
  units.findByPk.mockResolvedValue(unit);
  await expect(service.createLecturer({ code: "GV1", name: "An", unitId: "unit" })).rejects.toThrow("Đơn vị không tồn tại");
  expect(lecturers.create).not.toHaveBeenCalled();
});

it("links a faculty unit while preserving old discipline and faculty fields", async () => {
  const { service, units, lecturers } = setup();
  const row = { unitId: null, disciplineId: "old-discipline", majorId: "old-major", faculty: "Tên cũ", update: jest.fn() };
  lecturers.findByPk.mockResolvedValue(row);
  units.findByPk.mockResolvedValue({ active: true });
  await service.updateLecturer("gv", { unitId: "unit" });
  expect(row.update).toHaveBeenCalledWith({ unitId: "unit" });
  expect(row.disciplineId).toBe("old-discipline");
  expect(row.faculty).toBe("Tên cũ");
});

it("allows editing a lecturer with an unchanged inactive unit", async () => {
  const { service, units, lecturers } = setup();
  const row = { unitId: "inactive", update: jest.fn() };
  lecturers.findByPk.mockResolvedValue(row);
  await service.updateLecturer("gv", { unitId: "inactive", name: "An mới" });
  expect(units.findByPk).not.toHaveBeenCalled();
  expect(row.update).toHaveBeenCalledWith({ unitId: "inactive", name: "An mới" });
});
