import "reflect-metadata";
import { admissionBirthYear, compareAdmissions, DEFAULT_ADMISSION_RULES, rankAdmissions, scoreAdmission } from "../../src/plan/admission-scoring.js";
import { AdmissionInputsDto, DecideAdmissionDto, MajorAdmissionThresholdDto, SaveAdmissionRoundDto } from "../../src/plan/dto/admission.dto.js";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

const record = { trainingLevel: "Thạc sĩ", majorId: "major", academicYear: "2026", gradClassification: "Khá", priorityObject: "Không", gender: "Nam" };
const round = { academicYear: "2026", majorThresholds: [{ majorId: "major", cutoff: 15 }], rules: DEFAULT_ADMISSION_RULES };
const inputs = { degreeVerified: true, documentsVerified: true, healthVerified: true, majorFit: "direct" as const, fitEvidence: "Danh mục ngành 2026", englishType: "exam" as const, englishVerified: true, englishEvidence: "Kỳ thi 2026", englishScore: 7 };
it.each([["1996-08-21", 1996], ["21/08/1996", 1996], ["1996", 1996], [null, null], ["", null], ["không rõ", null]])("lấy năm sinh từ %s", (dob, expected) => {
  expect(admissionBirthYear(dob)).toBe(expected);
});
describe("Điểm xét tuyển thạc sĩ — Phụ lục 03", () => {
  it.each([[4.99, null, "ineligible"], [5, 1, "eligible"], [6.99, 1, "eligible"], [7, 1.5, "eligible"], [7.99, 1.5, "eligible"], [8, 2, "eligible"], [10, 2, "eligible"]])("tiếng Anh A=%s quy đổi %s, điều kiện %s", (score, expected, eligibility) => {
    const result = scoreAdmission(record, { ...inputs, englishScore: score }, round);
    expect(result.components.english).toBe(expected); expect(result.eligibility).toBe(eligibility);
  });
  it("tính tối đa 20 và không cộng ưu tiên nhiều lần", () => {
    const result = scoreAdmission({ ...record, gradClassification: "Xuất sắc", priorityObject: "Con liệt sĩ, thương binh" }, { ...inputs, priorityVerified: true, priorityEvidence: "Giấy xác nhận", englishType: "english_degree" }, round);
    expect(result.total).toBe(20); expect(result.components.priority).toBe(1);
  });
  it("12 điểm không tự đủ điều kiện khi thiếu BSKT", () => {
    const result = scoreAdmission({ ...record, gradClassification: "Trung bình" }, { ...inputs, majorFit: "bridge", englishScore: 5 }, { ...round, majorThresholds: [{ majorId: "major", cutoff: 12 }] });
    expect(result.total).toBe(12); expect(result.eligibility).toBe("pending"); expect(result.meetsCutoff).toBeNull();
  });
  it("không coi dữ liệu thiếu là điểm 0", () => {
    const result = scoreAdmission(record, { ...inputs, englishScore: undefined }, round);
    expect(result.total).toBeNull(); expect(result.eligibility).toBe("pending");
  });
  it("chứng chỉ hết hạn bị loại; đúng ngày hết hạn vẫn hợp lệ", () => {
    const certificate = { ...inputs, englishType: "certificate_b3" as const, applicationDate: "2026-10-06", englishValidUntil: "2026-10-05" };
    expect(scoreAdmission(record, certificate, round).eligibility).toBe("ineligible");
    expect(scoreAdmission(record, { ...certificate, englishValidUntil: "2026-10-06" }, round).components.english).toBe(2);
  });
  it("không tự quy đổi bằng ĐHHHVN khi phụ lục chưa rõ", () => {
    const result = scoreAdmission(record, { ...inputs, englishType: "vmu_degree", applicationDate: "2026-10-06", englishDegreeDate: "2025-06-01" }, round);
    expect(result.eligibility).toBe("pending"); expect(result.total).toBeNull();
  });
  it("chặn ngành, năm, trình độ không khớp", () => {
    expect(scoreAdmission({ ...record, majorId: "other", trainingLevel: "Tiến sĩ" }, inputs, round).eligibility).toBe("ineligible");
  });
  it("yêu cầu minh chứng ưu tiên trước khi tính đủ điều kiện", () => {
    expect(scoreAdmission({ ...record, priorityObject: "Con liệt sĩ" }, inputs, round).eligibility).toBe("pending");
  });
  it("ưu tiên GPA, sau đó nữ, sau đó điểm tốt nghiệp", () => {
    const row = (gpa10: number, female: boolean, graduationScore: number) => ({ total: 16, tieBreak: { gpa10, female, graduationScore } });
    expect(compareAdmissions(row(8, false, 6), row(7, true, 10))).toBeLessThan(0);
    expect(compareAdmissions(row(8, true, 6), row(8, false, 10))).toBeLessThan(0);
    expect(compareAdmissions(row(8, true, 9), row(8, true, 8))).toBeLessThan(0);
    expect(compareAdmissions(row(8, true, 9), row(8, true, 9))).toBe(0);
  });
  it("thiếu GPA khi đồng điểm phải cùng hạng chờ bổ sung", () => {
    const rows = rankAdmissions([
      { total: 16, tieBreak: { gpa10: 8, female: true, graduationScore: 9 } },
      { total: 16, tieBreak: { gpa10: null, female: false, graduationScore: 10 } },
      { total: 15, tieBreak: { gpa10: 10, female: true, graduationScore: 10 } },
    ]);
    expect(rows.map((row) => row.rank)).toEqual([1, 1, 3]);
    expect(rows[0].tieBreakPending).toBe(true); expect(rows[1].tieBreakPending).toBe(true);
  });
  it("thiếu điểm tốt nghiệp không bị xếp dưới người đã có điểm", () => {
    const rows = rankAdmissions([
      { total: 16, tieBreak: { gpa10: 8, female: true, graduationScore: null } },
      { total: 16, tieBreak: { gpa10: 8, female: true, graduationScore: 9 } },
    ]);
    expect(rows.map((row) => row.rank)).toEqual([1, 1]); expect(rows.every((row) => row.tieBreakPending)).toBe(true);
  });
});
describe("Validation đầu vào xét tuyển", () => {
  it("kiểm tra tổng điểm nhập tay theo thang 20", async () => {
    for (const manualTotal of [-1, 21, "15", Infinity]) {
      const errors = await validate(plainToInstance(AdmissionInputsDto, { manualTotal }));
      expect(errors.map((error) => error.property)).toContain("manualTotal");
    }
    expect(await validate(plainToInstance(AdmissionInputsDto, { manualTotal: 0 }))).toHaveLength(0);
  });
  it("từ chối điểm vượt thang, boolean giả và enum giả", async () => {
    const errors = await validate(plainToInstance(AdmissionInputsDto, { englishScore: 11, gpa10: -1, degreeVerified: "true", englishType: "fake" }));
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(["englishScore", "gpa10", "degreeVerified", "englishType"]));
  });
  it("không nhận điểm ngưỡng vượt 20", async () => {
    const errors = await validate(plainToInstance(MajorAdmissionThresholdDto, { cutoff: 21 }));
    expect(errors.map((error) => error.property)).toContain("cutoff");
  });
  it("duyệt cần phiên bản và ghi chú; số, ngày văn bản không bắt buộc", async () => {
    const errors = await validate(plainToInstance(DecideAdmissionDto, { decision: "admitted", decisionNo: "", decisionDate: "invalid", version: 0 }));
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(["decisionDate", "version", "note"]));
    expect(await validate(plainToInstance(DecideAdmissionDto, { decision: "admitted", note: "Duyệt theo ngưỡng", version: 1 }))).toHaveLength(0);
  });
});
describe("Xét tổng điểm đã chốt", () => {
  it.each([[14.99, "ineligible", false], [15, "eligible", true], [20, "eligible", true]])("điểm %s so với ngưỡng 15", (manualTotal, eligibility, meetsCutoff) => {
    expect(scoreAdmission(record, { manualTotal: manualTotal as number }, round)).toMatchObject({ total: manualTotal, eligibility, meetsCutoff });
  });
  it("điểm 0 hợp lệ và thiếu điểm chuẩn phải chờ", () => {
    expect(scoreAdmission(record, { manualTotal: 0 }, { ...round, majorThresholds: [{ majorId: "major", cutoff: 0 }] })).toMatchObject({ total: 0, eligibility: "eligible" });
    expect(scoreAdmission(record, { manualTotal: 16 }, { ...round, majorThresholds: [{ majorId: "major", cutoff: null }] })).toMatchObject({ total: 16, eligibility: "pending", meetsCutoff: null });
  });
  it("ngành chưa có ngưỡng phải chờ, điểm vượt thang bị chặn", () => {
    expect(scoreAdmission({ ...record, majorId: "other" }, { manualTotal: 20 }, round).eligibility).toBe("pending");
    expect(scoreAdmission(record, { manualTotal: 21 }, round)).toMatchObject({ total: null, eligibility: "ineligible" });
  });
  it("một đợt toàn viện so điểm từng hồ sơ với đúng ngưỡng ngành", () => {
    const shared = { ...round, majorThresholds: [{ majorId: "major", cutoff: 15 }, { majorId: "other", cutoff: 17 }] };
    expect(scoreAdmission(record, { manualTotal: 16 }, shared)).toMatchObject({ cutoff: 15, meetsCutoff: true });
    expect(scoreAdmission({ ...record, majorId: "other" }, { manualTotal: 16 }, shared)).toMatchObject({ cutoff: 17, meetsCutoff: false });
    expect(scoreAdmission({ ...record, majorId: "unconfigured" }, { manualTotal: 20 }, shared)).toMatchObject({ cutoff: null, eligibility: "pending", meetsCutoff: null });
  });
});
