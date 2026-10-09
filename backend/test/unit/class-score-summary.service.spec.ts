import { jest } from "@jest/globals";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { ClassScoreSummaryService } from "../../src/reports/class-score-summary.service.js";
import { ClassScoreSummaryQueryDto, LearnerScorecardQueryDto } from "../../src/reports/dto/class-score-summary.dto.js";

const build = () => {
  const groups = { findByPk: jest.fn<any>(), findAll: jest.fn<any>() };
  const sequelize = { query: jest.fn<any>() };
  const service = new ClassScoreSummaryService(groups as never, sequelize as never);
  groups.findByPk.mockResolvedValue({ id: "g1", curriculumId: "c1", curriculum: { id: "c1", name: "CTĐT" } });
  sequelize.query.mockResolvedValueOnce([
    { id: "hp1", name: "Triết học", credits: 3 }, { id: "hp2", name: "Tiếng Anh", credits: 3 }, { id: "hp3", name: "Luận văn", credits: 10 },
  ]).mockResolvedValueOnce([{ total: 2, page: 1, rows: [
    { participantId: "student:one", code: "HV01" }, { participantId: "admission:two", code: "HV02" },
  ] }]).mockResolvedValueOnce([
    { participantId: "student:one", subjectId: "hp1", score: "0.00", result: "failed" },
    { participantId: "admission:two", subjectId: "hp2", score: null, result: "exempt" },
  ]);
  return { service, groups, sequelize };
};

it("preserves all curriculum columns, zero scores, exemptions and students without marks", async () => {
  const { service } = build();
  const data = await service.get({ classGroupId: "g1" });
  expect(data.subjects).toHaveLength(3);
  expect(data.rows[0].scores).toEqual({ hp1: { score: 0, result: "failed" } });
  expect(data.rows[1].scores).toEqual({ hp2: { score: null, result: "exempt" } });
  expect(data).toMatchObject({ total: 2, page: 1, pageSize: 50 });
});

it("returns the roster with a missing curriculum and avoids querying unrelated scores", async () => {
  const { service, groups, sequelize } = build();
  groups.findByPk.mockResolvedValue({ id: "g1", curriculumId: null, curriculum: null });
  sequelize.query.mockReset().mockResolvedValue([{ total: 1, page: 1, rows: [{ participantId: "student:one" }] }]);
  const data = await service.get({ classGroupId: "g1" });
  expect(data).toMatchObject({ curriculum: null, subjects: [], rows: [{ scores: {} }] });
  expect(sequelize.query).toHaveBeenCalledTimes(1);
});

it("rejects nonexistent classes before reading any student data", async () => {
  const { service, groups, sequelize } = build();
  groups.findByPk.mockResolvedValue(null);
  await expect(service.get({ classGroupId: "missing" })).rejects.toThrow("Không tìm thấy lớp học viên");
  expect(sequelize.query).not.toHaveBeenCalled();
});

it("validates class IDs and bounds pagination at the API boundary", async () => {
  const dto = plainToInstance(ClassScoreSummaryQueryDto, { classGroupId: "00000000-0000-4000-8000-000000000001", page: "2", pageSize: "50" });
  expect(await validate(dto)).toHaveLength(0);
  expect(dto.page).toBe(2);
  dto.pageSize = 101;
  expect(await validate(dto)).not.toHaveLength(0);
  dto.classGroupId = "bad-id";
  dto.page = 0;
  expect((await validate(dto)).map(error => error.property)).toEqual(expect.arrayContaining(["classGroupId", "page"]));
  dto.search = "x".repeat(201);
  expect((await validate(dto)).map(error => error.property)).toContain("search");
});

const buildScorecard = () => {
  const { service, sequelize } = build();
  const student = { admissionRecordId: "ar1", studentId: "one", participantId: "student:one", academicYear: "2026" };
  const groups = [{ id: "older", academicYear: "2025" }, { id: "g1", academicYear: "2026" }];
  sequelize.query.mockReset().mockResolvedValueOnce([student]).mockResolvedValueOnce(groups);
  return { service, sequelize, student, groups };
};

it("opens the requested member class and scopes the scorecard to one learner", async () => {
  const { service, student, groups } = buildScorecard();
  const get = jest.spyOn(service, "get").mockResolvedValue({
    group: { id: "older" }, curriculum: { id: "c1" },
    subjects: [{ id: "hp1" }, { id: "hp2" }],
    rows: [{ participantId: student.participantId, scores: { hp1: { score: 0, result: "failed", details: { testScore: 0 } } } }],
  } as any);
  const data = await service.learnerScorecard("ar1", "older");
  expect(get).toHaveBeenCalledWith({ classGroupId: "older" }, true, { participantId: "student:one", includeDetails: true });
  expect(data).toMatchObject({ student, groups, subjects: [
    { id: "hp1", grade: { score: 0, result: "failed", details: { testScore: 0 } } }, { id: "hp2", grade: null },
  ] });
});

it("defaults to the learner's intake year instead of an unrelated class", async () => {
  const { service, student } = buildScorecard();
  const get = jest.spyOn(service, "get").mockResolvedValue({ group: { id: "g1" }, subjects: [], rows: [{ participantId: student.participantId, scores: {} }] } as any);
  await service.learnerScorecard("ar1");
  expect(get).toHaveBeenCalledWith({ classGroupId: "g1" }, true, expect.objectContaining({ participantId: student.participantId }));
});

it("rejects a class that does not contain the requested learner", async () => {
  const { service } = buildScorecard();
  const get = jest.spyOn(service, "get");
  await expect(service.learnerScorecard("ar1", "unrelated")).rejects.toThrow("Học viên không thuộc lớp");
  expect(get).not.toHaveBeenCalled();
});

it("returns a clear unassigned state and rejects nonexistent learners", async () => {
  const { service, sequelize } = buildScorecard();
  sequelize.query.mockReset().mockResolvedValueOnce([{ admissionRecordId: "ar1", studentId: null }]).mockResolvedValueOnce([]);
  expect(await service.learnerScorecard("ar1")).toMatchObject({ groups: [], group: null, curriculum: null, subjects: [] });
  sequelize.query.mockResolvedValueOnce([]);
  await expect(service.learnerScorecard("missing")).rejects.toThrow("Không tìm thấy học viên");
});

it("validates the optional scorecard class ID", async () => {
  expect(await validate(plainToInstance(LearnerScorecardQueryDto, {}))).toHaveLength(0);
  expect(await validate(plainToInstance(LearnerScorecardQueryDto, { classGroupId: "bad" }))).not.toHaveLength(0);
});
