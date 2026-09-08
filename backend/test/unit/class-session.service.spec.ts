import { jest } from "@jest/globals";
import { MastersService } from "../../src/masters/masters.service.js";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateClassFromStudentsDto, RenameClassDto } from "../../src/masters/dto/masters-class-group.dto.js";
import { CreateCourseOfferingDto, CreateTeachingSessionDto } from "../../src/scheduling/dto/scheduling.dto.js";
const tx = { LOCK: { UPDATE: "UPDATE" } };
describe("Create named class from selected students", () => {
  it("creates independent membership in one transaction without deleting the parent's roster", async () => {
    const groups = { findOne: jest.fn().mockResolvedValue({ id: "parent", majorId: "major", academicYear: "2026" }) };
    const members = { bulkCreate: jest.fn(), destroy: jest.fn() };
    const records = { findAll: jest.fn().mockResolvedValue([{ id: "r1", studentId: "student" }, { id: "r2", studentId: "student" }]) };
    const create = jest.fn().mockResolvedValue({ id: "child" });
    const service = new MastersService(groups as never, members as never, records as never, {} as never, {} as never, { transaction: (cb: (t: unknown) => unknown) => cb(tx) } as never, { create } as never);
    jest.spyOn(service, "getClassGroup").mockResolvedValue({ id: "child", name: "Lớp A" } as never);
    await service.createClassFromStudents({ parentGroupId: "parent", code: "A", name: "Lớp A", admissionRecordIds: ["r1", "r2"] });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ parentGroupId: "parent", name: "Lớp A" }), tx);
    expect(create.mock.calls[0][0]).not.toHaveProperty("term");
    expect(members.bulkCreate).toHaveBeenCalledWith([{ classGroupId: "child", admissionRecordId: "r1", studentId: "student" }], { transaction: tx });
    expect(members.destroy).not.toHaveBeenCalled();
  });
  it("validates empty names and malformed selections", async () => {
    expect(await validate(plainToInstance(RenameClassDto, { name: "   " }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(CreateClassFromStudentsDto, { name: "A", code: "A", admissionRecordIds: [] }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(CreateCourseOfferingDto, { name: " " }))).not.toHaveLength(0);
  });
});

import { CreateSubjectPackageDto, UpdateSubjectPackageDto } from "../../src/plan/dto/plan.dto.js";
describe("Package merge permission validation", () => {
  it.each([true, false])("accepts a boolean update %s", async (canMerge) => { expect(await validate(plainToInstance(UpdateSubjectPackageDto, { canMerge }))).toHaveLength(0); });
  it.each([CreateSubjectPackageDto, UpdateSubjectPackageDto])("rejects null merge permission in %p", async (Dto) => { const errors = await validate(plainToInstance(Dto, { canMerge: null })); expect(errors.some((error) => error.property === "canMerge")).toBe(true); });
});

describe("Open scheduling DTO contract", () => {
  it("accepts one session with date and period and no clock or total", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(await validate(plainToInstance(CreateTeachingSessionDto, {
      courseOfferingId: id, sessionDate: "2099-09-07", period: "MORNING", roomId: id, lecturerId: id,
    }))).toHaveLength(0);
  });
  it("validates learner note identities and text recursively", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const errors = await validate(plainToInstance(CreateCourseOfferingDto, {
      name: "Lớp HP", subjectId: id, classGroupIds: [id],
      participantNotes: [{ studentId: "bad-id", note: 123 }],
    }));
    expect(errors.some((error) => error.property === "participantNotes")).toBe(true);
  });
});
