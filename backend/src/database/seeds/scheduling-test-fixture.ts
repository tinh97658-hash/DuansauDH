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
  const packageId = idFor("package");
  const subjectNames = ["Toán cao cấp", "Phương pháp nghiên cứu khoa học", "Khai thác hàng hải"];
  const names = [["Nguyễn Văn", "An"], ["Trần Thị", "Bình"], ["Lê Minh", "Châu"]];
  const rows: Array<{ model: string; values: Record<string, unknown> }> = [];
  const add = (model: string, key: string, values: Record<string, unknown>) => rows.push({ model, values: { id: idFor(key), ...values } });
  add("Major", "major", { code: "DEV-SCHED-KTHH", name: "Khai thác hàng hải (mẫu development)", program: "masters", active: true });
  subjectNames.forEach((name, i) => add("Subject", `subject-${i}`, {
    code: `DEV-SCHED-HP${i + 1}`, codeText: `DEV-SCHED-HP${i + 1}`, codeNumber: i + 1, name,
    majorId, program: "masters", active: true, canonicalSubjectId: null, allowCrossMajor: false, credits: 3, sortOrder: i,
  }));
  add("ClassGroup", "group", { code: "DEV-SCHED-2026", name: "Lớp mẫu xếp lịch 2026", majorId,
    program: "masters", academicYear: "2026", status: "open", maxStudents: 30 });
  names.forEach(([lastName, firstName], i) => {
    add("AdmissionRecord", `admission-${i}`, { code: `DEV-SCHED-HV${i + 1}`, lastName, firstName,
      fullName: `${lastName} ${firstName}`, email: `scheduling-test-${i + 1}@example.invalid`,
      majorId, majorName: "Khai thác hàng hải", academicYear: "2026", trainingLevel: "Thạc sĩ",
      status: "approved", studyStatus: "Đã trúng tuyển" });
    add("ClassGroupMember", `member-${i}`, { classGroupId, admissionRecordId: idFor(`admission-${i}`), studentId: null, note: "Học viên mẫu development" });
  });
  add("SubjectPackage", "package", { code: "DEV-SCHED-GHP", name: "Gói học phần mẫu xếp lịch", classGroupId, majorId,
    active: true, isOfficial: true, totalSubjects: subjectNames.length });
  subjectNames.forEach((_name, i) => add("SubjectPackageSubject", `entry-${i}`, { packageId, subjectId: idFor(`subject-${i}`), sortOrder: i }));
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
  });
  return { created, scope: schedulingTestScope };
}
