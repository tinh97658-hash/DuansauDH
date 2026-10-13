import { jest } from "@jest/globals";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { emptyExamGrade, ExamGradebookService } from "../../src/masters/exam-gradebook.service.js";
import { ExamGradebookQueryDto, SaveExamGradebookDto } from "../../src/masters/dto/exam-gradebook.dto.js";
import { LEGACY_GRADING_POLICY } from "../../src/masters/grading-policy.js";

const build = () => {
  const groups = { findOne: jest.fn<any>(), findAll: jest.fn<any>() };
  const members = { findAll: jest.fn<any>() };
  const offerings = { findByPk: jest.fn<any>(), findAll: jest.fn<any>() };
  const links = { findOne: jest.fn<any>() };
  const books = { findOne: jest.fn<any>(), create: jest.fn<any>() };
  const sequelize = {
    transaction: jest.fn<any>((callback: any) => callback({ LOCK: { UPDATE: "UPDATE" } })),
    query: jest.fn<any>(async (sql: string, options: any) => sql.includes("WITH book") ? [{
      revision: 0, total: 2, totalRows: 2, page: 1,
      rows: [{ participantId: "student:s1", code: "HV001", fullName: "Nguyễn Văn An", grade: {} },
        { participantId: "admission:a2", code: "HV002", fullName: "Trần Bình", grade: {} }],
    }] : options.replacements.ids.filter((id: string) => ["student:s1", "admission:a2"].includes(id)).map((participantId: string) => ({ participantId }))),
  };
  const policies = { latest: jest.fn<any>().mockResolvedValue(LEGACY_GRADING_POLICY) };
  const service = new ExamGradebookService(groups as never, members as never, offerings as never, links as never, books as never, sequelize as never, policies as never);
  groups.findOne.mockResolvedValue({ id: "g1", name: "CNTT 2026", academicYear: "2026", program: "masters" });
  links.findOne.mockResolvedValue({ id: "link" });
  offerings.findByPk.mockResolvedValue({ id: "o1", subject: { program: "masters" } });
  members.findAll.mockResolvedValue([
    { admissionRecord: { id: "a1", studentId: "s1", code: "HV001", fullName: "Nguyễn Văn An", lastName: "Nguyễn Văn", firstName: "An" } },
    { studentId: "s1", student: { id: "s1", regNo: "HV001", fullName: "Nguyễn Văn An" } },
    { admissionRecord: { id: "a2", code: "HV002", fullName: "Trần Bình", lastName: "Trần", firstName: "Bình" } },
  ]);
  books.findOne.mockResolvedValue(null);
  return { service, groups, members, offerings, links, books, sequelize, policies };
};
const query = { classGroupId: "g1", courseOfferingId: "o1" };

it("returns frozen policies with saved grades and the current policy with unentered grades", async () => {
  const { service, policies, sequelize, offerings } = build();
  offerings.findByPk.mockResolvedValue({ id: "o1", subjectId: "subject-1", subject: { program: "masters" } });
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

it("does not recalculate old saved outcomes when only notes or eligibility change", async () => {
  const { service, books, policies } = build();
  policies.latest.mockResolvedValue({ ...LEGACY_GRADING_POLICY, version: 3 });
  const old = { ...emptyExamGrade("student:s1"), testScore: 8, assignmentScore: 8, examScore: 8, courseScore: 7.2, grade4: 3, letterGrade: "B", result: "passed" as const };
  const book = { revision: 1, grades: [old], update: jest.fn<any>() };
  books.findOne.mockResolvedValue(book);
  await service.save({ ...query, revision: 1, rows: [{ ...old, notes: "Ghi chú mới", eligible: true }] });
  expect(book.update.mock.calls[0][0].grades[0]).toMatchObject({ courseScore: 7.2, grade4: 3, letterGrade: "B", result: "passed", gradingPolicy: { version: 0 } });
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

  expect(await service.options()).toEqual({ groups: [group], courseOfferings: [offering] });
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
  expect(sequelize.query.mock.calls[0][0]).toContain("OR grade->>'result' = 'passed'");
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
