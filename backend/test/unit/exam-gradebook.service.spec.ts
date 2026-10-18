import { jest } from "@jest/globals";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { emptyExamGrade, ExamGradebookService } from "../../src/masters/exam-gradebook.service.js";
import { ExamGradebookQueryDto, SaveExamGradebookDto } from "../../src/masters/dto/exam-gradebook.dto.js";
import { LEGACY_GRADING_POLICY } from "../../src/masters/grading-policy.js";
import { calculateExamEligibility, calculateExamGrade } from "../../src/masters/exam-grade-calculation.js";

it("marks ineligible learners failed before an exam while preserving pending and exempt cases", () => {
  expect(calculateExamGrade({ testScore: 6, assignmentScore: 3, examScore: null, examExempt: false }))
    .toMatchObject({ result: "failed", courseScore: 0, grade4: 0, letterGrade: "F" });
  expect(calculateExamGrade({ testScore: 3, assignmentScore: null, examScore: null, examExempt: false }).result).toBe("pending");
  expect(calculateExamGrade({ testScore: 6, assignmentScore: 6, examScore: null, examExempt: false }).result).toBe("pending");
  expect(calculateExamGrade({ testScore: 6, assignmentScore: 3, examScore: null, examExempt: true }).result).toBe("exempt");
});

const build = () => {
  const groups = { findOne: jest.fn<any>(), findAll: jest.fn<any>() };
  const members = { findAll: jest.fn<any>() };
  const offerings = { findByPk: jest.fn<any>(), findAll: jest.fn<any>() };
  const links = { findOne: jest.fn<any>(), findAll: jest.fn<any>() };
  const books = { findOne: jest.fn<any>(), findAll: jest.fn<any>(), create: jest.fn<any>() };
  const sequelize = {
    transaction: jest.fn<any>((callback: any) => callback({ LOCK: { UPDATE: "UPDATE" } })),
    query: jest.fn<any>(async (sql: string, options: any) => sql.includes("WITH book") ? [{
      revision: 0, total: 2, totalRows: 2, page: 1,
      rows: [{ participantId: "student:s1", code: "HV001", fullName: "Nguyễn Văn An", grade: {} },
        { participantId: "admission:a2", code: "HV002", fullName: "Trần Bình", grade: {} }],
    }] : (options.replacements?.ids || []).filter((id: string) => ["student:s1", "admission:a2"].includes(id)).map((participantId: string) => ({ participantId }))),
  };
  const policies = { latest: jest.fn<any>().mockResolvedValue(LEGACY_GRADING_POLICY) };
  const service = new ExamGradebookService(groups as never, members as never, offerings as never, links as never, books as never, sequelize as never, policies as never);
  groups.findOne.mockResolvedValue({ id: "g1", name: "CNTT 2026", academicYear: "2026", program: "masters" });
  links.findOne.mockResolvedValue({ id: "link" });
  offerings.findByPk.mockResolvedValue({ id: "o1", status: "completed", subject: { program: "masters" } });
  members.findAll.mockResolvedValue([
    { admissionRecord: { id: "a1", studentId: "s1", code: "HV001", fullName: "Nguyễn Văn An", lastName: "Nguyễn Văn", firstName: "An" } },
    { studentId: "s1", student: { id: "s1", regNo: "HV001", fullName: "Nguyễn Văn An" } },
    { admissionRecord: { id: "a2", code: "HV002", fullName: "Trần Bình", lastName: "Trần", firstName: "Bình" } },
  ]);
  books.findOne.mockResolvedValue(null);
  return { service, groups, members, offerings, links, books, sequelize, policies };
};
const query = { classGroupId: "g1", courseOfferingId: "o1" };

it.each(["group", "offering"] as const)("blocks grade writes before teaching completion for %s scope while keeping grades readable", async rosterScope => {
  const { service, offerings, books, sequelize } = build();
  offerings.findByPk.mockResolvedValue({ id: "o1", status: "active", subject: { program: "masters" } });
  await expect(service.save({ ...query, rosterScope, revision: 0, rows: [{ ...emptyExamGrade("student:s1"), testScore: 8 }] }))
    .rejects.toMatchObject({ response: { code: "TEACHING_NOT_COMPLETED", message: "Vui lòng xác nhận hoàn thành giảng dạy trước khi nhập điểm." } });
  expect(books.create).not.toHaveBeenCalled();
  expect(books.findOne).not.toHaveBeenCalled();
  expect(books.findAll).not.toHaveBeenCalled();
  expect(sequelize.query.mock.calls.every(([sql]) => String(sql).includes("pg_advisory_xact_lock"))).toBe(true);
  expect((await service.get(query)).rows).toHaveLength(2);
});

const sharedFixture = () => {
  const fixture = build();
  const sharedSubject = { id: "s1", code: "HPTA", name: "Tiếng anh", credits: 3, program: "masters" };
  const groups = ["g1", "g2", "g3"].map((id, index) => ({ id, academicYear: "2026", majorId: `m${index + 1}`,
    curriculum: { subjectEntries: [{ subject: { ...sharedSubject, id: `s${index + 1}`, code: `HP${index + 1}` } }] },
  }));
  fixture.offerings.findByPk.mockResolvedValue({ id: "o1", status: "completed", subjectId: "s1", subject: sharedSubject });
  fixture.links.findAll.mockResolvedValue(groups.map(classGroup => ({ classGroup })));
  fixture.books.findAll.mockResolvedValue([]);
  return { ...fixture, scopedGroups: groups };
};

it("loads all linked groups and individual learners in one deduplicated paginated roster", async () => {
  const { service, sequelize, policies } = sharedFixture();
  const result = await service.get({ ...query, rosterScope: "offering", search: "HV", mode: "exam", page: 2 });
  const [sql, options] = sequelize.query.mock.calls[0];
  expect(options.replacements).toMatchObject({ groupIds: ["g1", "g2", "g3"], individualGroupId: "g1", page: 2, pageSize: 15, mode: "exam", search: "HV" });
  expect(sql).toContain('FROM course_offering_students');
  expect(sql).toContain('DISTINCT ON ("participantId")');
  expect(sql).toContain('SUM(revision)');
  expect(sql).toContain('cm.class_group_id IN (:groupIds)');
  expect(policies.latest).toHaveBeenCalledWith("s2", "2026");
  expect(result.eligibilityPolicies).toHaveProperty("g3");
});

it("uses each learner's own policy for eligibility in a shared class", async () => {
  const { service, sequelize } = sharedFixture();
  const policy = { ...LEGACY_GRADING_POLICY, minimums: { testScore: 7, assignmentScore: 4, examScore: 4 } };
  sequelize.query.mockResolvedValue([{ revision: 0, total: 1, totalRows: 1, page: 1,
    rows: [{ participantId: "student:s1", classGroupId: "g2", policy, grade: { testScore: 6, assignmentScore: 8 } }] }]);
  const result = await service.get({ ...query, rosterScope: "offering" });
  expect(result.rows[0]).toMatchObject({ eligible: false, eligibilityPolicy: policy });
});

it("atomically saves learners from different majors into their group gradebooks", async () => {
  const { service, sequelize, books, policies } = sharedFixture();
  sequelize.query.mockImplementation(async (sql: string) => sql.includes("WITH book")
    ? [{ revision: 2, total: 2, totalRows: 2, page: 1, rows: [] }]
    : [{ participantId: "student:s1", classGroupId: "g1" }, { participantId: "admission:a2", classGroupId: "g2" }]);
  await service.save({ ...query, rosterScope: "offering", revision: 0, rows: [
    { ...emptyExamGrade("student:s1"), testScore: 8, assignmentScore: 8, examScore: 9 },
    { ...emptyExamGrade("admission:a2"), testScore: 7, assignmentScore: 7, examScore: 8 },
  ] });
  expect(books.create).toHaveBeenCalledTimes(2);
  expect(books.create.mock.calls[0][0]).toMatchObject({ classGroupId: "g1", revision: 1, grades: [{ participantId: "student:s1", courseScore: 8.5 }] });
  expect(books.create.mock.calls[1][0]).toMatchObject({ classGroupId: "g2", revision: 1, grades: [{ participantId: "admission:a2", courseScore: 7.5 }] });
  expect(policies.latest).toHaveBeenCalledWith("s2", "2026", expect.anything());
});

it("rejects a stale shared revision and learners outside the linked class", async () => {
  const { service, sequelize, books } = sharedFixture();
  sequelize.query.mockResolvedValue([{ participantId: "student:s1", classGroupId: "g2" }]);
  books.findAll.mockResolvedValue([{ classGroupId: "g2", revision: 2, grades: [] }]);
  await expect(service.save({ ...query, rosterScope: "offering", revision: 0, rows: [emptyExamGrade("student:s1")] }))
    .rejects.toThrow("Bảng điểm đã được người khác cập nhật");
  await expect(service.save({ ...query, rosterScope: "offering", revision: 2, rows: [emptyExamGrade("student:outside")] }))
    .rejects.toThrow("ngoài lớp");
  expect(books.create).not.toHaveBeenCalled();
});

it("uses current configured eligibility thresholds even for saved grades with an older policy", async () => {
  const { service, policies, sequelize } = build();
  const policy = { ...structuredClone(LEGACY_GRADING_POLICY), minimums: { testScore: 7, assignmentScore: 6, examScore: 4 } };
  policies.latest.mockResolvedValue(policy);
  const grade = { ...emptyExamGrade("student:s1"), testScore: 6, assignmentScore: 6, examScore: 8, eligible: true, gradingPolicy: LEGACY_GRADING_POLICY };
  sequelize.query.mockResolvedValue([{ revision: 1, total: 1, totalRows: 30, unassessedRows: 4, page: 1, rows: [{ participantId: "student:s1", grade }] }]);
  const data = await service.get({ ...query, mode: "exam", search: "HV001" });
  expect(data.unassessedRows).toBe(4);
  expect(data.rows[0]).toMatchObject({ eligible: false, eligibilityPolicy: policy, gradingPolicy: LEGACY_GRADING_POLICY });
  expect(sequelize.query.mock.calls[0][1].replacements).toMatchObject({ testMinimum: 7, assignmentMinimum: 6 });
});

it.each([
  [3.9, 4, false, true, false], [4, 4, false, false, true], [8, 8, true, true, false], [null, 8, false, true, null],
])("ignores submitted eligibility for scores %s, %s and exemption %s", async (testScore, assignmentScore, examExempt, eligible, expected) => {
  const { service, books } = build();
  await service.save({ ...query, revision: 0, rows: [{ ...emptyExamGrade("student:s1"), testScore, assignmentScore, examExempt: Boolean(examExempt), eligible: Boolean(eligible) }] });
  expect(books.create.mock.calls[0][0].grades[0].eligible).toBe(expected);
});

it("requires both prerequisite scores independently of their weighting, and requires an exam score before an outcome", () => {
  const policy = { ...structuredClone(LEGACY_GRADING_POLICY), weights: { testScore: 50, assignmentScore: 50, examScore: 0 }, minimums: { testScore: 6, assignmentScore: 7, examScore: 4 } };
  expect(calculateExamEligibility({ testScore: 6, assignmentScore: 7, examExempt: false }, policy)).toBe(true);
  expect(calculateExamEligibility({ testScore: 6, assignmentScore: null, examExempt: false }, policy)).toBeNull();
  expect(calculateExamGrade({ testScore: 8, assignmentScore: 8, examScore: null, examExempt: false }, policy).result).toBe("pending");
  expect(calculateExamGrade({ testScore: 8, assignmentScore: 8, examScore: 0, examExempt: false }, policy).result).toBe("passed");
});

it("returns frozen policies with saved grades and the current policy with unentered grades", async () => {
  const { service, policies, sequelize, offerings } = build();
  offerings.findByPk.mockResolvedValue({ id: "o1", status: "completed", subjectId: "subject-1", subject: { program: "masters" } });
  const latest = { ...structuredClone(LEGACY_GRADING_POLICY), version: 2, courseMinimum: 8 };
  policies.latest.mockResolvedValue(latest);
  const grade = { ...emptyExamGrade("student:s1"), testScore: 7, assignmentScore: 7, examScore: 7, courseScore: 7, grade4: 3, letterGrade: "B", result: "passed" };
  sequelize.query.mockResolvedValue([{ revision: 3, total: 2, totalRows: 2, page: 1,
    rows: [{ participantId: "student:s1", grade }, { participantId: "admission:a2", grade: {} }] }]);
  const result = await service.get(query);
  expect(result.rows[0]).toMatchObject({ courseScore: 7, result: "passed", gradingPolicy: { version: 0, courseMinimum: 5.5 } });
  expect(result.rows[1]).toMatchObject({ courseScore: null, result: "pending", gradingPolicy: latest });
  expect(policies.latest).toHaveBeenCalledWith("subject-1", "2026");
});

it("preserves existing policy snapshots when editing old grades and applies the latest policy only to new rows", async () => {
  const { service, books, policies } = build();
  const oldPolicy = { ...structuredClone(LEGACY_GRADING_POLICY), version: 1, weights: { testScore: 100, assignmentScore: 0, examScore: 0 },
    minimums: { testScore: 0, assignmentScore: 0, examScore: 0 }, courseMinimum: 5, useDefaultBands: false,
    bands: [{ minimum: 0, letter: "OLD", grade4: 2 }] };
  const newPolicy = { ...structuredClone(LEGACY_GRADING_POLICY), version: 2, weights: { testScore: 0, assignmentScore: 0, examScore: 100 } };
  policies.latest.mockResolvedValue(newPolicy);
  const old = { ...emptyExamGrade("student:s1"), testScore: 8, assignmentScore: 6, examScore: 7, courseScore: 8, gradingPolicy: oldPolicy };
  const book = { revision: 1, grades: [old], update: jest.fn<any>().mockResolvedValue(undefined) };
  books.findOne.mockResolvedValue(book);
  await service.save({ ...query, revision: 1, rows: [
    { ...old, testScore: 5, policyVersion: 2 },
    { ...emptyExamGrade("admission:a2"), testScore: 5, assignmentScore: 10, examScore: 10, policyVersion: 2 },
  ] });
  const saved = book.update.mock.calls[0][0].grades;
  expect(saved[0]).toMatchObject({ courseScore: 5, letterGrade: "OLD", grade4: 2, gradingPolicy: { version: 1 } });
  expect(saved[1]).toMatchObject({ courseScore: 10, letterGrade: "A+", grade4: 4, gradingPolicy: { version: 2 } });
  expect(book.grades[0].courseScore).toBe(8);
});

it("derives saved outcomes and qualification instead of retaining manually supplied calculations", async () => {
  const { service, books, policies } = build();
  policies.latest.mockResolvedValue({ ...LEGACY_GRADING_POLICY, version: 3 });
  const old = { ...emptyExamGrade("student:s1"), testScore: 8, assignmentScore: 8, examScore: 8, courseScore: 7.2, grade4: 3, letterGrade: "B", result: "passed" as const };
  const book = { revision: 1, grades: [old], update: jest.fn<any>() };
  books.findOne.mockResolvedValue(book);
  await service.save({ ...query, revision: 1, rows: [{ ...old, notes: "Ghi chú mới", eligible: true }] });
  expect(book.update.mock.calls[0][0].grades[0]).toMatchObject({ courseScore: 8, grade4: 3.5, letterGrade: "B+", eligible: true, result: "passed", gradingPolicy: { version: 0 } });
});

it("rejects a changed policy during first-time grade entry without saving the draft", async () => {
  const { service, books, policies } = build();
  policies.latest.mockResolvedValue({ ...LEGACY_GRADING_POLICY, version: 2 });
  await expect(service.save({ ...query, revision: 0, rows: [{ ...emptyExamGrade("student:s1"), policyVersion: 1 }] })).rejects.toThrow("Cách tính điểm của môn đã thay đổi");
  expect(books.create).not.toHaveBeenCalled();
});

it("rejects changed shared rules during first-time entry while leaving saved snapshots unchanged", async () => {
  const { service, books, policies } = build();
  policies.latest.mockResolvedValue({ ...LEGACY_GRADING_POLICY, rulesVersion: 2 });
  await expect(service.save({ ...query, revision: 0, rows: [{ ...emptyExamGrade("student:s1"), policyVersion: 0, policyRulesVersion: 1 }] }))
    .rejects.toThrow("Cách tính điểm của môn đã thay đổi");
  expect(books.create).not.toHaveBeenCalled();
});

it("provides majors and linked course classes for gradebook filters", async () => {
  const { service, groups, offerings } = build();
  const group = { id: "g1", majorId: "m1", major: { name: "Công nghệ thông tin" }, academicYear: "2026" };
  const offering = { id: "o1", subject: { id: "s1", name: "An toàn thông tin" }, groupLinks: [{ classGroupId: "g1" }] };
  groups.findAll.mockResolvedValue([group]);
  offerings.findAll.mockResolvedValue([offering]);

  expect(await service.options()).toEqual({ groups: [group], courseOfferings: [{ ...offering,
    groupLinks: [{ classGroupId: "g1", subject: offering.subject }],
  }] });
  expect(groups.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { program: "masters" }, attributes: expect.arrayContaining(["majorId"]), include: expect.arrayContaining([expect.objectContaining({ as: "major", attributes: ["id", "name"] })]) }));
  expect(offerings.findAll).toHaveBeenCalledWith(expect.objectContaining({ include: expect.arrayContaining([
    expect.objectContaining({ as: "subject", where: { program: "masters" }, required: true }),
    expect.objectContaining({ as: "groupLinks", attributes: ["classGroupId"], required: true }),
  ]) }));
});

it("queries a bounded deduplicated page and keeps unentered scores and eligibility unset", async () => {
  const { service, sequelize, members, books } = build();
  const data = await service.get(query);
  expect(data.rows).toHaveLength(2);
  expect(data.rows[0]).toMatchObject({ participantId: "student:s1", courseScore: null, eligible: null, result: "pending" });
  expect(data).toMatchObject({ total: 2, totalRows: 2, page: 1, pageSize: 15 });
  expect(sequelize.query.mock.calls[0][0]).toContain('DISTINCT ON ("participantId")');
  expect(sequelize.query.mock.calls[0][0]).toContain("LIMIT :pageSize OFFSET");
  expect(sequelize.query.mock.calls[0][0]).toContain("OR eligibility = true");
  expect(sequelize.query.mock.calls[0][0]).toContain('FROM assessed WHERE eligibility IS NULL');
  expect(sequelize.query.mock.calls[0][1].replacements).toMatchObject({ page: 1, pageSize: 15 });
  expect(members.findAll).not.toHaveBeenCalled();
  expect(books.findOne).not.toHaveBeenCalled();
});

it("applies page, search and exam eligibility filters in the database and caps the page size", async () => {
  const { service, sequelize } = build();
  await service.get({ ...query, page: 2, pageSize: 100, mode: "exam", search: "  HV001  ", includeIds: "student:s1", excludeIds: "admission:a2" });
  expect(sequelize.query.mock.calls[0][1].replacements).toMatchObject({ page: 2, pageSize: 15, mode: "exam", search: "HV001", includeIds: "student:s1", excludeIds: "admission:a2" });
});

it("rejects invalid pagination parameters at the API boundary", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const valid = plainToInstance(ExamGradebookQueryDto, { classGroupId: id, courseOfferingId: id, page: "2", pageSize: "15", mode: "exam" });
  expect(await validate(valid)).toHaveLength(0);
  expect(valid.page).toBe(2);
  valid.pageSize = 16;
  expect(await validate(valid)).not.toHaveLength(0);
});

it("rejects an offering outside the selected class", async () => {
  const { service, links, books } = build();
  links.findOne.mockResolvedValue(null);
  await expect(service.get(query)).rejects.toThrow("Học phần không thuộc lớp");
  expect(books.create).not.toHaveBeenCalled();
});

it("rejects stale revisions without overwriting another editor", async () => {
  const { service, books } = build();
  const update = jest.fn<any>();
  books.findOne.mockResolvedValue({ revision: 2, grades: [], update });
  await expect(service.save({ ...query, revision: 1, rows: [emptyExamGrade("student:s1")] })).rejects.toThrow("Bảng điểm đã được người khác cập nhật");
  expect(update).not.toHaveBeenCalled();
});

it("merges changed rows while preserving unchanged grades", async () => {
  const { service, books } = build();
  const update = jest.fn<any>();
  const book = { revision: 1, grades: [{ ...emptyExamGrade("admission:a2"), courseScore: 8 }], update };
  books.findOne.mockResolvedValue(book);
  await service.save({ ...query, revision: 1, rows: [{ ...emptyExamGrade("student:s1"), testScore: 8, assignmentScore: 8, examScore: 10, courseScore: 0, grade4: 0, letterGrade: "F", result: "failed" }] });
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ revision: 2, grades: expect.arrayContaining([
    expect.objectContaining({ participantId: "admission:a2", courseScore: 8 }),
    expect.objectContaining({ participantId: "student:s1", courseScore: 9, grade4: 4, letterGrade: "A+", result: "passed", attemptScores: [10] }),
  ]) }), expect.anything());
});

it("rejects foreign or duplicate grade rows", async () => {
  const { service, books } = build();
  await expect(service.save({ ...query, revision: 0, rows: [emptyExamGrade("student:outside")] })).rejects.toThrow("ngoài lớp");
  await expect(service.save({ ...query, revision: 0, rows: [emptyExamGrade("student:s1"), emptyExamGrade("student:s1")] })).rejects.toThrow("bị lặp");
  expect(books.create).not.toHaveBeenCalled();
});

it("clears derived scores for incomplete components instead of trusting the payload", async () => {
  const { service, books } = build();
  await service.save({ ...query, revision: 0, rows: [{ ...emptyExamGrade("student:s1"), testScore: 8, courseScore: 9, grade4: 4, letterGrade: "A+", result: "passed" }] });
  expect(books.create).toHaveBeenCalledWith(expect.objectContaining({ grades: [expect.objectContaining({ courseScore: null, grade4: null, letterGrade: "", result: "pending" })] }), expect.anything());
});

it("saves zero course and converted scores for an ineligible learner without recording an actual exam attempt", async () => {
  const { service, books } = build();
  await service.save({ ...query, revision: 0, rows: [{ ...emptyExamGrade("student:s1"), testScore: 6, assignmentScore: 3, result: "pending" }] });
  expect(books.create).toHaveBeenCalledWith(expect.objectContaining({ grades: [expect.objectContaining({
    eligible: false, examScore: null, courseScore: 0, grade4: 0, letterGrade: "F", attemptScores: [], result: "failed",
  })] }), expect.anything());
});

it("rounds component scores before storing and calculating the grade", async () => {
  const { service, books } = build();
  await service.save({ ...query, revision: 0, rows: [{ ...emptyExamGrade("student:s1"), testScore: 5.54, assignmentScore: 6, examScore: 5.76 }] });
  expect(books.create).toHaveBeenCalledWith(expect.objectContaining({ grades: [expect.objectContaining({ testScore: 5.5, assignmentScore: 6, examScore: 5.8, courseScore: 5.8, attemptScores: [5.8], result: "passed" })] }), expect.anything());
});

it("stores notes with an exempt student's grade", async () => {
  const { service, books } = build();
  await service.save({ ...query, revision: 0, rows: [{ ...emptyExamGrade("student:s1"), examExempt: true, notes: "Miễn thi theo quyết định" }] });
  expect(books.create).toHaveBeenCalledWith(expect.objectContaining({ grades: [expect.objectContaining({ examExempt: true, notes: "Miễn thi theo quyết định", result: "exempt" })] }), expect.anything());
});

it("validates component ranges and nested payloads on the API boundary", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const dto = plainToInstance(SaveExamGradebookDto, {
    classGroupId: id, courseOfferingId: id, revision: 0,
    rows: [{ ...emptyExamGrade(`student:${id}`), testScore: 11, grade4: -1, attemptScores: [NaN] }],
  });
  expect(await validate(dto)).not.toHaveLength(0);
  dto.rows[0] = plainToInstance(Object.getPrototypeOf(dto.rows[0]).constructor, emptyExamGrade(`student:${id}`));
  expect(await validate(dto)).toHaveLength(0);
});
