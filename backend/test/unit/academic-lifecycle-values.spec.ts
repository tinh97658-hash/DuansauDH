import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateAdmissionRecordDto, UpdateAdmissionRecordDto } from "../../src/plan/dto/plan.dto.js";
import { serializeSnapshot, snapshotDigest } from "../../src/reports/transcript-snapshot.js";
import { resolveSavedExamGrade } from "../../src/masters/exam-grade-calculation.js";
import { LEGACY_GRADING_POLICY } from "../../src/masters/grading-policy.js";

it.each(["masters", "master", "thac si", " Thạc sĩ "])("normalizes %s at both admission API boundaries", async trainingLevel => {
  const create = plainToInstance(CreateAdmissionRecordDto, { fullName: "Learner", idCard: "0123456789012", phone: "0912345678", majorId: "00000000-0000-4000-8000-000000000001", trainingLevel });
  const update = plainToInstance(UpdateAdmissionRecordDto, { trainingLevel });
  expect(create.trainingLevel).toBe("Thạc sĩ");
  expect(update.trainingLevel).toBe("Thạc sĩ");
  expect(await validate(create)).toHaveLength(0);
  expect(await validate(update)).toHaveLength(0);
});
it("rejects unknown training levels, statuses and misspelled study states", async () => {
  const dto = plainToInstance(UpdateAdmissionRecordDto, { trainingLevel: "Other", status: "anything", studyStatus: "Đang hoc" });
  expect((await validate(dto)).map(error => error.property).sort()).toEqual(["status", "studyStatus", "trainingLevel"]);
});
it("keeps approved grades authoritative after eligibility rules change", () => {
  const frozen: any = { finalized: true, courseScore: 8, grade4: 3.5, letterGrade: "B+", result: "passed", testScore: 8, assignmentScore: 8, examScore: 8 };
  expect(resolveSavedExamGrade(frozen, { ...LEGACY_GRADING_POLICY, minimums: { testScore: 9, assignmentScore: 9, examScore: 9 } }))
    .toMatchObject({ courseScore: 8, result: "passed" });
});
it("checks snapshots independently of JSONB object-key ordering and detects changed results", () => {
  const first = { student: { name: "A", id: "1" }, subjects: [{ result: "passed", score: 8 }] };
  const roundTrip = { subjects: [{ score: 8, result: "passed" }], student: { id: "1", name: "A" } };
  expect(snapshotDigest(first)).toBe(snapshotDigest(roundTrip));
  expect(serializeSnapshot(first)).toBe(serializeSnapshot(roundTrip));
  roundTrip.subjects[0].score = 9;
  expect(snapshotDigest(first)).not.toBe(snapshotDigest(roundTrip));
});
