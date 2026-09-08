import { randomUUID } from "node:crypto";

export type BulkOptions = {
  prefix: string; classes: number; students: number; subjects: number; weeks: number; start: string;
  grantSchedulingTo?: string;
};
export type FixtureRow = Record<string, any>;
export type FixtureBatch = { model: string; rows: FixtureRow[] };

export function parseBulkOptions(args: string[], now = new Date()) {
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (["--preview", "--rollback", "--help"].includes(key)) { flags.add(key); continue; }
    if (!["--prefix", "--classes", "--students", "--subjects", "--weeks", "--start", "--grant-scheduling-to"].includes(key)
      || !args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`Invalid argument: ${key}`);
    values[key] = args[++i];
  }
  const count = (key: string, fallback: number, max: number) => {
    const raw = values[key] ?? String(fallback);
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < 1 || value > max)
      throw new Error(`${key} must be an integer between 1 and ${max}`);
    return value;
  };
  const prefix = values["--prefix"] ?? `BT${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
  if (!/^BT[A-Z0-9]{1,8}$/.test(prefix)) throw new Error("--prefix must start with BT and contain 3-10 uppercase letters/digits");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const start = values["--start"] ?? today;
  const date = new Date(`${start}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== start)
    throw new Error("--start must be a valid YYYY-MM-DD date");
  const options: BulkOptions = {
    prefix, start, classes: count("--classes", 20, 1000), students: count("--students", 30, 200),
    subjects: count("--subjects", 4, 10), weeks: count("--weeks", 4, 52),
    grantSchedulingTo: values["--grant-scheduling-to"]?.trim().toLowerCase() || undefined,
  };
  if (options.grantSchedulingTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(options.grantSchedulingTo))
    throw new Error("--grant-scheduling-to must be a valid email address");
  if (options.classes * (2 * options.students + options.subjects * (3 + options.weeks)) > 500000)
    throw new Error("Batch is too large; reduce classes, students, subjects or weeks (maximum about 500,000 rows)");
  return { options, preview: flags.has("--preview"), rollback: flags.has("--rollback"), help: flags.has("--help") };
}

export function buildBulkFixtures(options: BulkOptions): FixtureBatch[] {
  const { prefix, classes, students, subjects, weeks, start } = options;
  const batches: FixtureBatch[] = ["TrainingModeGroup", "TrainingMode", "TrainingLevel", "Major", "TrainingProgram",
    "TrainingPlan", "AdmissionTarget", "AnnualFee", "Lecturer", "Room", "Subject", "ClassGroup", "AdmissionRecord",
    "ClassGroupMember", "SubjectPackage", "SubjectPackageSubject", "CourseOffering", "CourseOfferingClassGroup", "TeachingSession"]
    .map((model) => ({ model, rows: [] }));
  const add = (model: string, row: FixtureRow) => {
    const record: FixtureRow = { id: randomUUID(), ...row };
    batches.find((batch) => batch.model === model)!.rows.push(record);
    return record;
  };
  const academicYear = start.slice(0, 4);
  const modeGroup = add("TrainingModeGroup", { code: `${prefix}MG`, name: `Nhóm chính quy ${prefix}`, active: true });
  const mode = add("TrainingMode", { code: `${prefix}CQ`, name: `Chính quy kiểm thử ${prefix}`, groupId: modeGroup.id, active: true });
  const level = add("TrainingLevel", { code: `${prefix}LV`, name: `Thạc sĩ kiểm thử ${prefix}`, durationYears: 2, active: true });
  const majors = Array.from({ length: Math.min(classes, 3) }, (_, i) => add("Major", {
    code: `${prefix}M${i + 1}`, name: `Ngành kiểm thử ${prefix} ${i + 1}`, trainingLevelId: level.id,
    program: "masters", durationYears: 2, maxOvertimeYears: 2, active: true,
  }));
  const programs = majors.map((major, i) => add("TrainingProgram", {
    code: `${prefix}CT${i + 1}`, name: `Chương trình thạc sĩ ${major.name}`, trainingLevelId: level.id,
    trainingModeId: mode.id, majorId: major.id, durationYears: 2, active: true,
  }));
  const plans = programs.map((program, i) => {
    const targetStudents = (Math.floor((classes - 1 - i) / majors.length) + 1) * students;
    const plan = add("TrainingPlan", { code: `${prefix}KH${i + 1}`, name: `Kế hoạch tuyển sinh ${academicYear} - ${majors[i].name}`,
      programId: program.id, academicYear, startDate: start, endDate: `${academicYear}-12-31`,
      targetStudents, status: "active", note: prefix });
    add("AdmissionTarget", { planId: plan.id, majorId: majors[i].id, trainingModeId: mode.id,
      quota: targetStudents, note: prefix });
    add("AnnualFee", { planId: plan.id, name: `Học phí kiểm thử ${academicYear}`, amount: 8000000,
      dueDate: start, note: prefix });
    add("AnnualFee", { planId: plan.id, name: `Lệ phí nhập học kiểm thử ${academicYear}`, amount: 500000,
      dueDate: start, note: prefix });
    return plan;
  });
  const catalog = majors.map((major) => Array.from({ length: subjects }, (_, i) => add("Subject", {
    code: `${prefix}S${majors.indexOf(major) + 1}-${i + 1}`, codeText: `${prefix}S${majors.indexOf(major) + 1}-${i + 1}`, codeNumber: i + 1,
    name: `Học phần kiểm thử ${i + 1} (${major.code})`, majorId: major.id, program: "masters", credits: 3,
  })));
  for (let c = 0; c < classes; c++) {
    const n = c + 1;
    const major = majors[c % majors.length];
    const lecturer = add("Lecturer", { code: `${prefix}GV${n}`, name: `Giảng viên kiểm thử ${n}`, email: `${prefix.toLowerCase()}.gv${n}@example.invalid`, active: true });
    const room = add("Room", { code: `${prefix}P${n}`, name: `Phòng kiểm thử ${n}`, capacity: students + 10, isActive: true });
    const group = add("ClassGroup", { code: `${prefix}L${n}`, name: `Lớp thạc sĩ kiểm thử ${n}`, majorId: major.id,
      program: "masters", academicYear, maxStudents: students, status: "open", note: prefix });
    for (let s = 0; s < students; s++) {
      const record = add("AdmissionRecord", { code: `${prefix}HV${n}-${s + 1}`, lastName: "Nguyễn Kiểm", firstName: `Thử ${s + 1}`,
        fullName: `Nguyễn Kiểm Thử ${n}-${s + 1}`, email: `${prefix.toLowerCase()}.${n}.${s + 1}@example.invalid`,
        dob: "1998-01-15", planId: plans[c % majors.length].id, trainingModeId: mode.id,
        trainingModeGroup: modeGroup.name, trainingModeName: mode.name, majorId: major.id, majorName: major.name,
        academicYear, trainingLevel: "Thạc sĩ",
        status: "approved", studyStatus: "Đã trúng tuyển" });
      add("ClassGroupMember", { classGroupId: group.id, admissionRecordId: record.id, studentId: null, note: prefix });
    }
    const pack = add("SubjectPackage", { code: `${prefix}G${n}`, name: `Gói học phần kiểm thử ${n}`, classGroupId: group.id,
      majorId: major.id, totalSubjects: subjects, isOfficial: true, active: true });
    const scheduledSubjectCount = Math.floor(subjects / 2);
    catalog[c % majors.length].forEach((subject, i) => {
      add("SubjectPackageSubject", { packageId: pack.id, subjectId: subject.id, sortOrder: i });
      // Keep half of the official package as candidates so the same fixture can
      // exercise both "Tạo lớp học phần" and the calendar scheduling workflow.
      if (i >= scheduledSubjectCount) return;
      const offering = add("CourseOffering", { subjectId: subject.id, status: "active", note: prefix });
      add("CourseOfferingClassGroup", { courseOfferingId: offering.id, classGroupId: group.id });
      // Each class owns its room and lecturer. Distinct half-day slots avoid all three conflict types.
      for (let w = 0; w < weeks; w++) {
        const date = new Date(`${start}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + w * 7 + Math.floor(i / 2));
        const morning = i % 2 === 0;
        add("TeachingSession", { courseOfferingId: offering.id, sessionDate: date.toISOString().slice(0, 10),
          period: morning ? "MORNING" : "AFTERNOON", startTime: morning ? "08:00:00" : "13:00:00",
          endTime: morning ? "11:00:00" : "16:00:00", lecturerId: lecturer.id, roomId: room.id, status: "planned", note: prefix });
      }
    });
  }
  return batches;
}
