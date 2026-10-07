import { jest } from "@jest/globals";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { emptyExamGrade, ExamGradebookService } from "../../src/masters/exam-gradebook.service.js";
import { SaveExamGradebookDto } from "../../src/masters/dto/exam-gradebook.dto.js";

const build = () => {
  const groups = { findOne: jest.fn<any>(), findAll: jest.fn<any>() };
  const members = { findAll: jest.fn<any>() };
  const offerings = { findByPk: jest.fn<any>(), findAll: jest.fn<any>() };
  const links = { findOne: jest.fn<any>() };
  const books = { findOne: jest.fn<any>(), create: jest.fn<any>() };
  const sequelize = { transaction: jest.fn<any>((callback: any) => callback({ LOCK: { UPDATE: "UPDATE" } })) };
  const service = new ExamGradebookService(groups as never, members as never, offerings as never, links as never, books as never, sequelize as never);
  groups.findOne.mockResolvedValue({ id: "g1", name: "CNTT 2026", academicYear: "2026", program: "masters" });
  links.findOne.mockResolvedValue({ id: "link" });
  offerings.findByPk.mockResolvedValue({ id: "o1", subject: { program: "masters" } });
  members.findAll.mockResolvedValue([
    { admissionRecord: { id: "a1", studentId: "s1", code: "HV001", fullName: "Nguyễn Văn An", lastName: "Nguyễn Văn", firstName: "An" } },
    { studentId: "s1", student: { id: "s1", regNo: "HV001", fullName: "Nguyễn Văn An" } },
    { admissionRecord: { id: "a2", code: "HV002", fullName: "Trần Bình", lastName: "Trần", firstName: "Bình" } },
  ]);
  books.findOne.mockResolvedValue(null);
  return { service, groups, members, offerings, links, books };
};
const query = { classGroupId: "g1", courseOfferingId: "o1" };

it("deduplicates linked identities and keeps unentered scores and eligibility unset", async () => {
  const { service } = build();
  const data = await service.get(query);
  expect(data.rows).toHaveLength(2);
  expect(data.rows[0]).toMatchObject({ participantId: "student:s1", courseScore: null, eligible: null, result: "pending" });
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
  await service.save({ ...query, revision: 1, rows: [{ ...emptyExamGrade("student:s1"), courseScore: 9, result: "passed" }] });
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ revision: 2, grades: expect.arrayContaining([
    expect.objectContaining({ participantId: "admission:a2", courseScore: 8 }),
    expect.objectContaining({ participantId: "student:s1", courseScore: 9, result: "passed" }),
  ]) }), expect.anything());
});

it("rejects foreign, duplicate, or incomplete grade rows", async () => {
  const { service, books } = build();
  await expect(service.save({ ...query, revision: 0, rows: [emptyExamGrade("student:outside")] })).rejects.toThrow("ngoài lớp");
  await expect(service.save({ ...query, revision: 0, rows: [emptyExamGrade("student:s1"), emptyExamGrade("student:s1")] })).rejects.toThrow("bị lặp");
  await expect(service.save({ ...query, revision: 0, rows: [{ ...emptyExamGrade("student:s1"), result: "passed" }] })).rejects.toThrow("Phải nhập điểm học phần");
  expect(books.create).not.toHaveBeenCalled();
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
