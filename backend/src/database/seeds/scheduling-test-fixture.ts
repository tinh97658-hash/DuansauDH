import { createHash } from "node:crypto";
import type { Sequelize } from "sequelize-typescript";

export function requireDevelopment(environment: string | undefined) {
  if (environment !== "development") throw new Error("Seed scheduling-test chỉ chạy khi NODE_ENV=development.");
}

// Stable IDs make repeated runs insert missing seed rows without changing test history.
const idFor = (key: string) => {
  const hex = createHash("sha256").update(`scheduling-test-v1:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

export const schedulingTestScope = {
  program: "masters", majorId: idFor("major"), academicYear: "2026",
};

export function schedulingTestRows() {
  const majorId = schedulingTestScope.majorId;
  const classGroupId = idFor("group");
  const curriculumId = idFor("curriculum");  const blockId = idFor("block");
  const subjectNames = ["Toán cao cấp", "Phương pháp nghiên cứu khoa học", "Khai thác hàng hải"];
  const names = [["Nguyễn Văn", "An"], ["Trần Thị", "Bình"], ["Lê Minh", "Châu"]];
  const rows: Array<{ model: string; values: Record<string, unknown> }> = [];
  const add = (model: string, key: string, values: Record<string, unknown>) => rows.push({ model, values: { id: idFor(key), ...values } });
  add("Major", "major", { code: "DEV-SCHED-KTHH", name: "Khai thác hàng hải (mẫu development)", program: "masters", active: true });
  subjectNames.forEach((name, i) => add("Subject", `subject-${i}`, {
    code: `DEV-SCHED-HP${i + 1}`, codeText: `DEV-SCHED-HP${i + 1}`, codeNumber: i + 1, name,
    majorId, program: "masters", active: true, canonicalSubjectId: null, allowCrossMajor: false, credits: 3, sortOrder: i,
  }));
  // CTĐT thuộc về ngành + bậc + khóa, không thuộc lớp; lớp chỉ kế thừa.
  add("Curriculum", "curriculum", {
    code: "DEV-SCHED-CT", name: "Chương trình đào tạo mẫu xếp lịch", majorId,
    program: "masters", applicableFromYear: "2026", totalCredits: 9, active: true, note: null,
  });
  add("CurriculumBlock", "block", {
    curriculumId, code: "CN", name: "Kiến thức chuyên ngành", minCredits: 0, sortOrder: 1,
  });
  subjectNames.forEach((_name, i) => add("CurriculumSubject", `entry-${i}`, {
    curriculumId, blockId, electiveGroupId: null, subjectId: idFor(`subject-${i}`),
    // Hai học phần bắt buộc + một học phần tự chọn do Viện chỉ định cho lớp.
    isRequired: i !== 2, credits: 3, sortOrder: i,
  }));
  add("ClassGroup", "group", { code: "DEV-SCHED-2026", name: "Lớp mẫu xếp lịch 2026", majorId, curriculumId,
    program: "masters", academicYear: "2026", status: "open", maxStudents: 30 });
  names.forEach(([lastName, firstName], i) => {
    add("AdmissionRecord", `admission-${i}`, { code: `DEV-SCHED-HV${i + 1}`, lastName, firstName,
      fullName: `${lastName} ${firstName}`, email: `scheduling-test-${i + 1}@example.invalid`,
      majorId, majorName: "Khai thác hàng hải", academicYear: "2026", trainingLevel: "Thạc sĩ",
      status: "approved", studyStatus: "Đã trúng tuyển" });
    add("ClassGroupMember", `member-${i}`, { classGroupId, admissionRecordId: idFor(`admission-${i}`), studentId: null, note: "Học viên mẫu development" });
  });
  add("ClassGroupElective", "elective", { classGroupId, curriculumSubjectId: idFor("entry-2") });
  add("Lecturer", "lecturer", { code: "DEV-SCHED-GV", name: "Giảng viên mẫu xếp lịch", active: true });
  add("Room", "room", { code: "DEV-SCHED-P301", name: "Phòng mẫu xếp lịch", capacity: 30, isActive: true });
  return rows;
}

export async function seedSchedulingTest(sequelize: Sequelize, environment: string | undefined) {
  requireDevelopment(environment);
  let created = 0;
  await sequelize.transaction(async (transaction) => {
    for (const { model, values } of schedulingTestRows()) {
      const [, inserted] = await sequelize.models[model].findOrCreate({
        where: { id: values.id }, defaults: values, transaction,
      });
      if (inserted) created++;
    }
    // `findOrCreate` không cập nhật dòng đã có, nên gắn lại chuyên ngành + CTĐT cho lớp mẫu
    // để lần chạy sau lớp luôn ở trạng thái dùng được (không bị mất CTĐT).
    await sequelize.models.ClassGroup.update(
      { majorId: schedulingTestScope.majorId, curriculumId: idFor("curriculum") },
      { where: { id: idFor("group") }, transaction },
    );
  });
  return { created, scope: schedulingTestScope };
}
