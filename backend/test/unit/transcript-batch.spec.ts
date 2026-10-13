import { ClassScoreSummaryService } from "../../src/reports/class-score-summary.service.js";
import { ReportsController } from "../../src/reports/reports.controller.js";
import { ROLES_KEY } from "../../src/common/auth-user.js";

const setup = (rows = [
  { admissionRecordId: "ar1", participantId: "student:one", scores: { hp1: { score: 0, result: "failed" } } },
  { admissionRecordId: "ar2", participantId: "admission:ar2", scores: {} },
]) => {
  const sequelize = { query: jest.fn().mockResolvedValue(rows.map(row => ({ admissionRecordId: row.admissionRecordId, participantId: row.participantId, fullName: "Nguyễn An" }))) };
  const service = new ClassScoreSummaryService({} as any, sequelize as any);
  const get = jest.spyOn(service, "get").mockResolvedValue({ group: { id: "g1" }, curriculum: {}, subjects: [{ id: "hp1" }, { id: "hp2" }], rows } as any);
  return { service, get, sequelize };
};
it("reads the entire class once, bulk loads profiles, and preserves scorecard order/zero/missing scores", async () => {
  const { service, get, sequelize } = setup();
  const result = await service.transcripts("g1");
  expect(get).toHaveBeenCalledWith({ classGroupId: "g1" }, true, { includeDetails: true });
  expect(sequelize.query).toHaveBeenCalledTimes(1);
  expect(result.scorecards).toHaveLength(2);
  expect(result.scorecards[0].subjects).toEqual([{ id: "hp1", grade: { score: 0, result: "failed" } }, { id: "hp2", grade: null }]);
  expect(result.scorecards[1].subjects.every(subject => subject.grade === null)).toBe(true);
});
it("keeps unavailable identities for selection validation without blocking unselected learners", async () => {
  const { service, sequelize } = setup();
  sequelize.query.mockResolvedValue([]);
  const unavailable = await service.transcripts("g1");
  expect(unavailable.scorecards).toHaveLength(2);
  expect(unavailable.scorecards[0]).toMatchObject({ student: { participantId: "student:one" }, unavailableReason: expect.stringContaining("không còn khớp") });
  const missing = setup([{ participantId: "student:one", scores: {} } as any]);
  expect((await missing.service.transcripts("g1")).scorecards[0]).toMatchObject({ unavailableReason: expect.stringContaining("chưa có hồ sơ") });
  expect(missing.sequelize.query).not.toHaveBeenCalled();
});
it("returns an empty class without running a profile query", async () => {
  const { service, sequelize } = setup([]);
  expect(await service.transcripts("g1")).toEqual({ classGroup: { id: "g1" }, scorecards: [] });
  expect(sequelize.query).not.toHaveBeenCalled();
});
it("retains the existing report role guard on the new route", () => {
  expect(Reflect.getMetadata(ROLES_KEY, ReportsController.prototype.classTranscripts)).toEqual(["admin", "supervisor", "examiner"]);
  expect(Reflect.getMetadata("__guards__", ReportsController.prototype.classTranscripts)).toHaveLength(2);
});
