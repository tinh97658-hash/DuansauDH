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
    majors as never,
    admissionRecords as never,
    {} as never,
    {} as never,
    {} as never,
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

describe("PlanService common subjects and major handling", () => {
  it("ensureCommonMajor creates CHUNG major if not found", async () => {
    const majors = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "chung-id", code: "CHUNG", name: "Học phần chung (Cấp Viện)", program: "masters" }),
    };
    const service = new PlanService(
      {} as never,
      {} as never,
      {} as never,
      majors as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.ensureCommonMajor("masters");
    expect(majors.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { code: "CHUNG", program: "masters" } }));
    expect(majors.create).toHaveBeenCalledWith(expect.objectContaining({ code: "CHUNG", name: "Học phần chung (Cấp Viện)" }), expect.anything());
    expect(result.code).toBe("CHUNG");
  });

  it("trainingPlan sorts common major (CHUNG) to the top with isCommon: true", async () => {
    const majors = {
      findOne: jest.fn().mockResolvedValue({ id: "chung-id", code: "CHUNG", name: "Học phần chung (Cấp Viện)", program: "masters" }),
      create: jest.fn(),
      findAll: jest.fn().mockResolvedValue([
        { id: "major-it", code: "CNTT", name: "Công nghệ thông tin", program: "masters" },
        { id: "chung-id", code: "CHUNG", name: "Học phần chung (Cấp Viện)", program: "masters" },
        { id: "major-qtkd", code: "QTKD", name: "Quản trị kinh doanh", program: "masters" },
      ]),
    };
    const subjects = {
      findAll: jest.fn().mockResolvedValue([
        { majorId: "chung-id", count: "3" },
        { majorId: "major-it", count: "15" },
      ]),
    };
    const service = new PlanService(
      subjects as never,
      {} as never,
      {} as never,
      majors as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const list = await service.trainingPlan("masters");
    expect(list[0].code).toBe("CHUNG");
    expect(list[0].isCommon).toBe(true);
    expect(list[0].subjectCount).toBe(3);
    expect(list[1].isCommon).toBe(false);
  });
});

