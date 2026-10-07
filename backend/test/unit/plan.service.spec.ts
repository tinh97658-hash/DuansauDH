import { BadRequestException } from "@nestjs/common";
import { jest } from "@jest/globals";
import { Op } from "sequelize";
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

describe("PlanService admission record pagination", () => {
  it("loads only the requested 20-record page and returns filtered totals", async () => {
    const admissionRecords = {
      findAndCountAll: jest.fn().mockResolvedValue({
        rows: Array.from({ length: 20 }, (_, index) => ({ id: `record-${index + 21}` })),
        count: 45,
      }),
      count: jest.fn()
        .mockResolvedValueOnce(40)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(30),
    };
    const classGroupMembers = {
      findAll: jest.fn().mockResolvedValue([{
        admissionRecordId: "record-21",
        studentId: null,
        classGroup: { id: "group-1", name: "CNT2026.01", code: "26CNT01", academicYear: "2026" },
      }]),
    };
    const service = new PlanService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      admissionRecords as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      classGroupMembers as never,
    );

    const result = await service.listAdmissionRecords(
      undefined, undefined, "2026", undefined, undefined, undefined, "2", "20", "Đã trúng tuyển", true,
    );

    expect(admissionRecords.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      limit: 20,
      offset: 20,
    }));
    const query = admissionRecords.findAndCountAll.mock.calls[0][0] as any;
    expect(query.where.studyStatus[Op.ne]).toBe("Đã trúng tuyển");
    expect(result.data).toHaveLength(20);
    expect(result.data[0].assignedGroup).toEqual({
      id: "group-1", name: "CNT2026.01", code: "26CNT01", academicYear: "2026",
    });
    expect(result.pagination).toEqual({ page: 2, pageSize: 20, total: 45, totalPages: 3 });
    expect(result.stats).toEqual({ total: 45, mastersCount: 40, doctoralCount: 5, eligibleCount: 30 });
  });
});

describe("PlanService major-scoped subject catalogs", () => {
  it("trainingPlan excludes the legacy CHUNG pseudo-major", async () => {
    const majors = {
      findAll: jest.fn().mockResolvedValue([
        { id: "major-it", code: "CNTT", name: "Công nghệ thông tin", program: "masters" },
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
      {} as never,
      {} as never,
    );

    const list = await service.trainingPlan("masters");
    expect(majors.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ program: "masters" }),
    }));
    expect(list.map((major) => major.name)).toEqual(["Công nghệ thông tin", "Quản trị kinh doanh"]);
    expect(list[0].subjectCount).toBe(15);
  });
});

describe("PlanService subject requirement synchronization", () => {
  it("updates existing curriculum entries when a catalog subject becomes elective", async () => {
    const subject = {
      id: "subject-1", majorId: "major-1", program: "masters",
      codeNumber: 1, codeText: "ATBM", sharedMajorIds: [], allowCrossMajor: false,
      update: jest.fn().mockResolvedValue(undefined),
    };
    const subjects = {
      findByPk: jest.fn().mockResolvedValue(subject),
      findOne: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
    };
    const curriculumEntries = { update: jest.fn().mockResolvedValue([1]) };
    const majors = { findByPk: jest.fn().mockResolvedValue({ id: "major-1", program: "masters", active: true }) };
    const transaction = { LOCK: { UPDATE: "UPDATE" } };
    const sequelize = {
      transaction: jest.fn((callback: (tx: any) => Promise<unknown>) => callback(transaction)),
      query: jest.fn().mockResolvedValue([[], 1]),
    };
    const service = new PlanService(
      subjects as never, curriculumEntries as never, {} as never, majors as never,
      {} as never, sequelize as never, {} as never, {} as never, {} as never, {} as never,
    );

    await service.updateSubject(subject.id, { isRequired: false, subjectType: "TC" });

    expect(curriculumEntries.update).toHaveBeenCalledWith(
      { isRequired: false },
      { where: { subjectId: subject.id }, transaction },
    );
    expect(sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE curriculum_subjects"),
      expect.objectContaining({
        replacements: { subjectId: subject.id, blockCode: "TC" },
        transaction,
      }),
    );
  });
});

