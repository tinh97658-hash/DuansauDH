import { sortCurriculumSubjectsByVietnameseName } from "../../src/plan/curriculum-subject-order.js";

it("orders a copied list by Vietnamese subject name without moving values between rows", () => {
  const names = ["Triết học", "An toàn bảo mật", "Xử lý ngôn ngữ tự nhiên", "Công nghệ Chuỗi khối", "Học máy nâng cao", "Điện toán đám mây", "Phương pháp nghiên cứu khoa học"];
  const rows = Object.freeze(names.map((name, index) => Object.freeze({ name, id: String(index), code: `HP${index}`, credits: index, blockId: `block${index}`, sortOrder: index })));
  const result = sortCurriculumSubjectsByVietnameseName(rows);
  expect(result.map(row => row.name)).toEqual([names[1], names[3], names[5], names[4], names[6], names[0], names[2]]);
  expect(rows.map(row => row.name)).toEqual(names);
  result.forEach(row => expect(row).toBe(rows[Number(row.id)]));
});

it("uses Vietnamese letters and case/accent equivalence, then code and subject identity for ties", () => {
  const rows = [
    { name: "an toàn", code: "B", id: "z" },
    { name: "Điện toán", code: "D", id: "d" },
    { name: "AN TOÀN", code: "A", id: "entry-z", subjectId: "b" },
    { name: "An toan", code: "A", id: "entry-a", subjectId: "a" },
    { name: "Dữ liệu", code: "C", id: "c" },
    { name: "Ăn học", code: "E", id: "e" },
    { name: "Âm học", code: "F", id: "f" },
  ];
  const expected = ["entry-a", "entry-z", "z", "e", "f", "c", "d"];
  expect(sortCurriculumSubjectsByVietnameseName(rows).map(row => row.id)).toEqual(expected);
  expect(sortCurriculumSubjectsByVietnameseName([...rows].reverse()).map(row => row.id)).toEqual(expected);
});

it("uses canonical Subject keys for entry projections, preserving their display codes and block metadata", () => {
  const rows = [
    { id: "entry-a", blockId: "early-block", subject: { id: "subject-b", name: "Học máy", code: "B", codeText: "A" } },
    { id: "entry-b", blockId: "late-block", subject: { id: "subject-a", name: "HỌC MÁY", code: "A", codeText: "B" } },
  ];
  const result = sortCurriculumSubjectsByVietnameseName(rows, row => row.subject);
  expect(result).toEqual([rows[1], rows[0]]);
  expect(result.map(row => row.subject.codeText)).toEqual(["B", "A"]);
  expect(result.map(row => row.blockId)).toEqual(["late-block", "early-block"]);
});
