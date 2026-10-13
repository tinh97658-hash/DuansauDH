import { jest } from "@jest/globals";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { GradingPolicyService } from "../../src/masters/grading-policy.service.js";
import { GradingPolicyEntryDto, SaveGradingPoliciesDto } from "../../src/masters/dto/grading-policy.dto.js";
import { gradingPolicyError, LEGACY_GRADING_POLICY } from "../../src/masters/grading-policy.js";
import { calculateExamGrade } from "../../src/masters/exam-grade-calculation.js";

const build = () => {
  const subjects = { findByPk: jest.fn<any>().mockResolvedValue({ id: "s1", name: "Môn 1", program: "masters" }) };
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  const sequelize = { transaction: jest.fn<any>((callback: any) => callback(transaction)), query: jest.fn<any>().mockResolvedValue([]) };
  const service = new GradingPolicyService(subjects as never, sequelize as never);
  const { version, ...policy } = structuredClone(LEGACY_GRADING_POLICY);
  const row = { subjectId: "s1", year: "2026", revision: version, ...policy };
  return { service, subjects, sequelize, transaction, row };
};

it("saves a new immutable policy version without writing to any gradebook", async () => {
  const { service, sequelize, row, transaction } = build();
  row.weights = { testScore: 20, assignmentScore: 30, examScore: 50 };
  row.minimums.examScore = 5;
  const saved = await service.save({ rows: [row] }, "staff-1");
  expect(saved[0].policy).toMatchObject({ version: 1, weights: row.weights, minimums: LEGACY_GRADING_POLICY.minimums });
  const insert = sequelize.query.mock.calls.find(([sql]: any[]) => sql.includes("INSERT"));
  expect(insert[0]).toContain("INSERT INTO course_grading_policies");
  expect(insert[1]).toMatchObject({ transaction, replacements: { actorId: "staff-1", year: "2026", version: 1 } });
  expect(sequelize.query.mock.calls.some(([sql]: any[]) => sql.includes("course_exam_gradebooks"))).toBe(false);
});

it("rejects a stale revision and does not insert a replacement", async () => {
  const { service, sequelize, row } = build();
  sequelize.query.mockResolvedValue([{ policy: { ...LEGACY_GRADING_POLICY, version: 2 } }]);
  await expect(service.save({ rows: [row] })).rejects.toThrow("đã được người khác sửa");
  expect(sequelize.query.mock.calls.some(([sql]: any[]) => sql.includes("INSERT"))).toBe(false);
});

it.each([
  [{ weights: { testScore: 20, assignmentScore: 20, examScore: 50 } }, "100%"],
  [{ minimums: { testScore: -1, assignmentScore: 0, examScore: 5 } }, "tối thiểu"],
  [{ useDefaultBands: false, bands: [{ minimum: 1, letter: "F", grade4: 0 }] }, "bắt đầu từ 0"],
  [{ useDefaultBands: false, bands: [{ minimum: 0, letter: "F", grade4: 0 }, { minimum: 0, letter: "D", grade4: 1 }] }, "trùng"],
  [{ useDefaultBands: false, bands: [{ minimum: 0, letter: "F", grade4: 3 }, { minimum: 5, letter: "A", grade4: 1 }] }, "không được giảm"],
  [{ useDefaultBands: false, bands: [{ minimum: 0, letter: "", grade4: 0 }] }, "điểm chữ"],
])("validates policy cross-field constraints", async (patch, message) => {
  const { service, row } = build();
  await expect(service.save("weights" in patch ? { rows: [{ ...row, ...patch } as GradingPolicyEntryDto] }
    : { rows: [], shared: { revision: 0, minimums: row.minimums, courseMinimum: row.courseMinimum, useDefaultBands: row.useDefaultBands, bands: row.bands, ...patch } as any })).rejects.toThrow(message as string);
});

it("shares conversion and pass rules across subjects while retaining each subject's weights", async () => {
  const { service, sequelize } = build();
  const shared = { ...structuredClone(LEGACY_GRADING_POLICY), version: 3, courseMinimum: 6, minimums: { testScore: 0, assignmentScore: 0, examScore: 5 } };
  sequelize.query.mockImplementation(async (sql: string, options: any) => sql.includes("shared_grading_rules") ? [{ policy: shared }]
    : [{ policy: { ...LEGACY_GRADING_POLICY, version: 2, weights: options.replacements.subjectId === "s1"
      ? { testScore: 10, assignmentScore: 40, examScore: 50 } : { testScore: 30, assignmentScore: 20, examScore: 50 } } }]);
  const first = await service.latest("s1", "2026");
  const second = await service.latest("s2", "2025");
  expect(first.minimums).toEqual(second.minimums);
  expect(first.courseMinimum).toBe(6);
  expect(first.rulesVersion).toBe(3);
  expect(first.weights).not.toEqual(second.weights);
});

it("saves shared rules once without rewriting course weights or historical grades", async () => {
  const { service, sequelize, row } = build();
  await service.save({ rows: [], shared: { revision: 0, minimums: row.minimums, courseMinimum: 6, useDefaultBands: true, bands: row.bands } });
  const writes = sequelize.query.mock.calls.filter(([sql]: any[]) => sql.includes("INSERT"));
  expect(writes).toHaveLength(1);
  expect(writes[0][0]).toContain("INSERT INTO shared_grading_rules");
  expect(sequelize.query.mock.calls.some(([sql]: any[]) => sql.includes("course_exam_gradebooks"))).toBe(false);
});

it("validates nested DTOs and rejects missing component objects", async () => {
  const { row } = build();
  const id = "00000000-0000-4000-8000-000000000001";
  const valid = plainToInstance(SaveGradingPoliciesDto, { rows: [{ ...row, subjectId: id }] });
  expect(await validate(valid)).toHaveLength(0);
  const invalid = plainToInstance(SaveGradingPoliciesDto, { rows: [{ ...row, subjectId: id, weights: undefined }] });
  expect(await validate(invalid)).not.toHaveLength(0);
});

it("uses custom weights, ignores zero-weight components, and checks component minima independently from conversion", () => {
  const policy = { ...structuredClone(LEGACY_GRADING_POLICY), weights: { testScore: 0, assignmentScore: 50, examScore: 50 },
    minimums: { testScore: 10, assignmentScore: 4, examScore: 6 }, courseMinimum: 5,
    useDefaultBands: false, bands: [{ minimum: 8, letter: "X", grade4: 3.8 }, { minimum: 0, letter: "Y", grade4: 1 }] };
  expect(gradingPolicyError(policy)).toBe("");
  expect(calculateExamGrade({ testScore: null, assignmentScore: 10, examScore: 5, examExempt: false }, policy))
    .toEqual({ courseScore: 7.5, grade4: 1, letterGrade: "Y", result: "failed" });
  expect(calculateExamGrade({ testScore: null, assignmentScore: 10, examScore: 6, examExempt: false }, policy))
    .toEqual({ courseScore: 8, grade4: 3.8, letterGrade: "X", result: "passed" });
});
