import { UniqueConstraintError } from "sequelize";
import { PlanService } from "../../src/plan/plan.service.js";

const build = (numberConflict = false, textConflict = false) => {
  const subjects = { findOne: jest.fn().mockResolvedValueOnce(numberConflict ? { id: "number" } : null).mockResolvedValueOnce(textConflict ? { id: "text" } : null), create: jest.fn() };
  const sequelize = { transaction: jest.fn(callback => callback({})) };
  const service = new PlanService(subjects as never, {} as never, {} as never,
    { findByPk: jest.fn().mockResolvedValue({ program: "masters", active: true }) } as never,
    {} as never, sequelize as never, {} as never, {} as never, {} as never, {} as never);
  return { service, subjects, sequelize };
};
it.each([[true, false], [false, true], [true, true]])("returns 409 with distinct number=%s/text=%s conflicts before create", async (number, text) => {
  const { service, subjects } = build(number, text);
  const error = await service.createSubject({ majorId: "major", program: "masters", codeNumber: 102, codeText: " ef ", name: "Subject", credits: 3 } as any).catch(value => value);
  expect(error.getStatus()).toBe(409); expect(error.message.includes("mã số")).toBe(number); expect(error.message.includes("mã chữ")).toBe(text);
  expect(subjects.create).not.toHaveBeenCalled();
});
it("excludes the edited row from both independent checks", async () => {
  const { service, subjects } = build();
  await (service as any).assertSubjectCodePairAvailable({ majorId: "major", program: "masters", codeNumber: 102, codeText: "EF" }, {}, "self");
  for (const [options] of subjects.findOne.mock.calls as any) expect(Object.getOwnPropertySymbols(options.where.id)).toHaveLength(1);
  expect(subjects.findOne.mock.calls).toHaveLength(2);
});
it.each(["subjects_code_number_unique", "subjects_code_text_unique"])("maps the database race %s to 409", async constraint => {
  const { service, sequelize } = build();
  const error = Object.assign(new UniqueConstraintError({ errors: [] }), { original: { constraint } });
  sequelize.transaction.mockRejectedValueOnce(error as never);
  await expect((service as any).subjectIdentityTransaction(jest.fn())).rejects.toMatchObject({ status: 409 });
});
