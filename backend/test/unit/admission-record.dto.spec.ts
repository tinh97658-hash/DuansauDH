import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateAdmissionRecordDto, UpdateAdmissionRecordDto } from "../../src/plan/dto/plan.dto.js";

const validRecord = {
  fullName: "Test student",
  majorId: "123e4567-e89b-42d3-a456-426614174000",
  phone: "0912345678",
  idCard: "0310900012345",
};

describe.each([CreateAdmissionRecordDto, UpdateAdmissionRecordDto])("%p contact validation", (Dto) => {
  it("accepts exact digit counts and preserves leading zeros", async () => {
    const dto = plainToInstance(Dto, validRecord);
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.phone).toBe(validRecord.phone);
    expect(dto.idCard).toBe(validRecord.idCard);
  });

  it.each([
    ["phone", "091234567"], ["phone", "09123456789"],
    ["phone", "091234567a"], ["phone", ""], ["phone", null], ["phone", 9123456789],
    ["idCard", "031090001234"], ["idCard", "03109000123456"],
    ["idCard", "031090001234a"], ["idCard", ""], ["idCard", null], ["idCard", 3109000123456],
  ])("rejects %s = %p", async (field, value) => {
    const errors = await validate(plainToInstance(Dto, { ...validRecord, [field]: value }));
    expect(errors.some((error) => error.property === field)).toBe(true);
  });
});

it("requires both contact fields when creating a record", async () => {
  const errors = await validate(plainToInstance(CreateAdmissionRecordDto, {
    fullName: validRecord.fullName, majorId: validRecord.majorId,
  }));
  expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(["phone", "idCard"]));
});

it("allows updates that do not change contact fields", async () => {
  expect(await validate(plainToInstance(UpdateAdmissionRecordDto, { note: "Updated" }))).toHaveLength(0);
});
