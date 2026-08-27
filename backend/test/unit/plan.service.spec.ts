import { BadRequestException } from "@nestjs/common";
import { jest } from "@jest/globals";
import { PlanService } from "../../src/plan/plan.service.js";

const buildService = () => {
  const majors = { findByPk: jest.fn() };
  const admissionRecords = { create: jest.fn(), findByPk: jest.fn() };
  const service = new PlanService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    majors as never,
    admissionRecords as never,
  );
  return { service, majors, admissionRecords };
};

describe("PlanService admission major synchronization", () => {
  it("stores the canonical catalog name instead of trusting the client", async () => {
    const { service, majors, admissionRecords } = buildService();
    majors.findByPk.mockResolvedValue({
      id: "4f38b512-d324-47f9-8815-9f23bb9bd332",
      name: "Khoa học hàng hải",
      program: "masters",
      active: true,
    });
    admissionRecords.create.mockResolvedValue({ id: "record-1" });
    admissionRecords.findByPk.mockResolvedValue({ id: "record-1" });

    await service.createAdmissionRecord({
      fullName: "Nguyễn Văn A",
      trainingLevel: "Thạc sĩ",
      majorId: "4f38b512-d324-47f9-8815-9f23bb9bd332",
      majorName: "Tên cũ từ trình duyệt",
    });

    expect(admissionRecords.create).toHaveBeenCalledWith(expect.objectContaining({
      majorId: "4f38b512-d324-47f9-8815-9f23bb9bd332",
      majorName: "Khoa học hàng hải",
    }));
  });

  it("rejects a doctoral major for a masters admission record", async () => {
    const { service, majors, admissionRecords } = buildService();
    majors.findByPk.mockResolvedValue({
      id: "950e8e64-39d9-4641-a411-080753be31f9",
      name: "Khoa học hàng hải (Tiến sĩ)",
      program: "doctoral",
      active: true,
    });

    await expect(service.createAdmissionRecord({
      fullName: "Nguyễn Văn A",
      trainingLevel: "Thạc sĩ",
      majorId: "950e8e64-39d9-4641-a411-080753be31f9",
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(admissionRecords.create).not.toHaveBeenCalled();
  });

  it("rejects an inactive major", async () => {
    const { service, majors } = buildService();
    majors.findByPk.mockResolvedValue({
      id: "4f38b512-d324-47f9-8815-9f23bb9bd332",
      name: "Ngành ngừng sử dụng",
      program: "masters",
      active: false,
    });

    await expect(service.createAdmissionRecord({
      fullName: "Nguyễn Văn A",
      trainingLevel: "Thạc sĩ",
      majorId: "4f38b512-d324-47f9-8815-9f23bb9bd332",
    })).rejects.toThrow("Chuyên ngành đã chọn không tồn tại hoặc đã ngừng sử dụng");
  });
});
