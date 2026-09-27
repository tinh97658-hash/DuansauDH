import { describe, expect, it } from "@jest/globals";
import { lecturerMatchesTeachingUnit, teachingUnitForSubject } from "../../src/scheduling/lecturer-qualification.policy.js";

describe("lecturer qualification policy", () => {
  it("routes Python to Computer Engineering in the IT faculty", () => {
    const unit = teachingUnitForSubject("CNT", { id: "python", name: "Python nâng cao", subjectType: "CN" });
    expect(unit).toEqual(expect.objectContaining({
      faculty: "Khoa Công nghệ thông tin",
      department: "Bộ môn Kỹ thuật máy tính",
      common: false,
    }));
    expect(lecturerMatchesTeachingUnit({ faculty: "Khoa Ngoại ngữ", department: "Bộ môn Tiếng Anh chuyên ngành" }, unit)).toBe(false);
  });

  it("allows English teachers for the common English subject regardless of the learner major", () => {
    const unit = teachingUnitForSubject("CNT", { id: "english", name: "Tiếng Anh", subjectType: "KC" });
    expect(unit).toEqual(expect.objectContaining({
      faculty: "Khoa Ngoại ngữ",
      department: "Bộ môn Tiếng Anh chuyên ngành",
      common: true,
    }));
  });

  it("routes philosophy to the political-theory department", () => {
    const unit = teachingUnitForSubject("CHUNG", { id: "philosophy", name: "Triết học", subjectType: "KC" });
    expect(unit).toEqual(expect.objectContaining({ department: "Bộ môn Lý luận chính trị", common: true }));
  });
});
