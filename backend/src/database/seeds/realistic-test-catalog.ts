import { createHash } from "node:crypto";

export const TEST_MARKER = "SEED_TEST_2026";
// Same stable-ID approach as scheduling-test-fixture; a separate namespace owns this batch.
export function seedId(key: string) {
  const h = createHash("sha256").update(`realistic-test-v1:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export type SeedRow = { model: string; values: Record<string, any>; reference?: Record<string, any> };
export type SubjectDefinition = [code: string, name: string, credits: number, block: string, group?: string];

// Source: user's supplied reference transcription, sections 4, 6 and 7.
// This is an amendment, NOT an exhaustive university catalog.
export const disciplineDefinitions: Array<[string, string, string | null, Array<[string, string | null]>]> = [
  ["8520116", "Kỹ thuật cơ khí động lực", "Dynamic Mechanical Engineering", [
    ["Kỹ thuật tàu thủy", "Naval Architecture and Ocean Engineering"], ["Quản lý kỹ thuật", "Engineering Management"],
    ["Quản lý năng lượng", "Energy Management"], ["Quản lý sản xuất công nghiệp", "Industrial Manufacturing and Management"],
  ]],
  ["8840106", "Khoa học hàng hải", "Maritime Science", [["Quản lý cảng và an toàn hàng hải", "Port Management and Maritime Safety"]]],
  ["8580201", "Kỹ thuật xây dựng", "Civil Engineering", [["Kỹ thuật xây dựng dân dụng và công nghiệp", "Civil and Industrial Engineering"], ["Quản lý dự án đầu tư và xây dựng", "Construction and Investment Project Management"]]],
  ["8520203", "Kỹ thuật điện tử", "Electronics Engineering", [["Kỹ thuật điện tử - viễn thông", "Electronics - Telecommunications Engineering"]]],
  ["8520320", "Kỹ thuật môi trường", "Environmental Engineering", [["Kỹ thuật môi trường", "Environmental Engineering"], ["Quản lý môi trường", "Environmental Management"]]],
  ["8310110", "Quản lý kinh tế", "Economics Management", [["Quản lý tài chính", "Financial Management"]]],
  ["9520116", "Kỹ thuật cơ khí động lực", null, []], ["9310110", "Quản lý kinh tế", null, []],
  ["8340101", "Quản trị kinh doanh", null, [["Quản trị kinh doanh", null]]],
  ["8520103", "Kỹ thuật Cơ khí", null, [["Cơ khí thông minh và Robot", null]]],
];

export const mbaSubjects: SubjectDefinition[] = [
  ["HPTH501", "Triết học", 3, "KC"], ["HPTA502", "Tiếng Anh", 3, "KC"],
  ["QTKH540", "Phương pháp nghiên cứu khoa học trong kinh doanh", 2, "KC"], ["QTLK559", "Luật kinh doanh", 2, "KC"],
  ["QTTT547", "Truyền thông Marketing", 2, "CS"], ["QLTK508", "Thống kê kinh tế", 2, "CS"],
  ["QLTH531", "Quản lý thuế", 2, "CS"], ["QTKN541", "Khởi nghiệp đổi mới sáng tạo", 2, "CS"], ["QLCL515", "Quản trị chiến lược", 2, "CS"],
  ["QTNL560", "Quản trị nguồn nhân lực", 2, "CN"], ["QTBV548", "Quản trị kinh doanh bền vững", 2, "CN"],
  ["QLMA539", "Quản trị marketing", 2, "CN"], ["QTCĐ549", "Chuyên đề nghiên cứu QTKD", 2, "CN"],
  ["QTTT557", "Thực tập tốt nghiệp", 7, "CH"], ["QTĐA558", "Đề án tốt nghiệp", 9, "CH"],
];
export const robotRequired: SubjectDefinition[] = [
  ["HPTH501", "Triết học", 3, "KC"], ["HPTA502", "Tiếng Anh", 3, "KC"], ["PPNC506", "Phương pháp nghiên cứu khoa học", 2, "KC"],
  ["CKTĐ503", "Tự động và điều khiển các quá trình công nghiệp", 3, "CS"], ["CKVL504", "Vật liệu tiên tiến", 2, "CS"],
  ["KTGC507", "Kỹ thuật gia công tiên tiến", 2, "CS"], ["CKTB505", "Thiết bị công nghiệp", 2, "CS"],
  ["HLTH516", "Hệ thống sản xuất linh hoạt và tích hợp", 2, "CS"], ["CKLT508", "Kỹ thuật lập trình PLC và ứng dụng", 3, "CS"], ["CKCN509", "Công nghệ truyền động cơ khí", 2, "CS"],
  ["CKDD510", "Dao động kỹ thuật", 2, "CN"], ["CKUS511", "Phân tích ứng suất", 2, "CN"], ["CKTG512", "Thị giác máy tính", 2, "CN"],
  ["CKCL513", "Động lực học chất lỏng", 2, "CN"], ["CKTS514", "Thiết kế và sản xuất sản phẩm bền vững", 2, "CN"],
  ["TTTN524", "Thực tập chuyên ngành", 7, "CH"], ["ĐATN525", "Đề án tốt nghiệp", 9, "CH"],
];
export const robotElectives: SubjectDefinition[] = [
  ["CKHM515", "Học máy", 2, "TC"], ["CKHN517", "Hệ thống nhúng", 2, "TC"],
  ["CKTT518", "Thiết kế và tối ưu hóa kết cấu cơ khí", 2, "TC", "3.2a"], ["CKMH519", "Mô hình hóa các quá trình gia công", 2, "TC", "3.2a"],
  ["CKDK520", "Dự án kỹ thuật cơ khí", 2, "TC", "3.2a"], ["CKRB521", "Robot hiện đại", 2, "TC", "3.2b"],
  ["CKSS522", "Vật liệu, sensor, bộ truyền động và chế tạo robot", 2, "TC", "3.2b"], ["CKDR523", "Dự án robot", 2, "TC", "3.2b"],
];
export const mbaMajorId = seedId("major:8340101:Quản trị kinh doanh");
export const robotMajorId = seedId("major:8520103:Cơ khí thông minh và Robot");
export const financeMajorId = seedId("major:8310110:Quản lý tài chính");
export const subjectId = (majorId: string, code: string) => seedId(`subject:${majorId}:${code}`);

export const limitations = [
  "Không đủ dữ liệu: thiếu tên 15 môn tự chọn QTKD và phần chữ mã 551/Bảng 7.2. Không tạo catalog đoán, nhóm 2.2a/b, 3.2a/b QTKD hay CTĐT QTKD chính thức 60 TC.",
  "QTKD chỉ có 15 môn bắt buộc đã đủ căn cứ (44 TC); CTĐT tập con được đánh dấu TEST, không phải CTĐT đầy đủ.",
  "Robot: unique(curriculum_id,subject_id) và một elective_group_id không biểu diễn hai nhóm giao nhau. Hai PHƯƠNG ÁN TEST 60 TC (3.2a hoặc 3.2b) dùng chung Subject; không khẳng định là hai CTĐT chính thức của trường.",
  "Không đủ dữ liệu về prefix lớp QTKD, Robot và quản lý năng lượng: dùng mã TEST; riêng lớp QLTC dùng format có nguồn, marker ở tên/note.",
  "CourseExamGrade không có trạng thái vắng thi: để examScore=null/result=pending và ghi chú TEST, không tự thêm field absent.",
  "Không seed các module tiếng Anh/tốt nghiệp/tiến sĩ không cần cho luồng kiểm thử này; không kết luận module là stub chỉ vì bảng trống.",
];

export function catalogRows(): SeedRow[] {
  const rows: SeedRow[] = [];
  const add = (model: string, key: string, values: Record<string, any>, reference: Record<string, any>) => rows.push({ model, values: { id: seedId(key), ...values }, reference });
  add("TrainingLevel", "master-level", { code: "MASTER", name: "Thạc sĩ", durationYears: 2, active: true }, { code: "MASTER" });
  for (const [code, name, englishName, majors] of disciplineDefinitions) {
    add("Discipline", `discipline:${code}`, { code, name, englishName, active: true }, { code });
    for (const [majorName, majorEnglish] of majors) {
      const identity = { name: majorName, disciplineId: seedId(`discipline:${code}`), program: "masters" };
      add("Major", `major:${code}:${majorName}`, { ...identity, englishName: majorEnglish, trainingLevelId: seedId("master-level"), durationYears: 2, active: true }, identity);
    }
  }
  const definitions: Array<[string, SubjectDefinition[]]> = [[mbaMajorId, mbaSubjects], [robotMajorId, [...robotRequired, ...robotElectives]]];
  for (const [majorId, subjects] of definitions) {
    for (const [code, name, credits, subjectType] of subjects) {
      const common = ["HPTH501", "HPTA502"].includes(code);
      const canonicalSubjectId = common && majorId === robotMajorId ? subjectId(mbaMajorId, code) : null;
      const identity = { majorId, program: "masters", code };
      add("Subject", `subject:${majorId}:${code}`, { ...identity, name, codeText: code.replace(/\d+$/, ""), codeNumber: Number(code.match(/\d+$/)![0]), credits,
        subjectType, isRequired: subjectType !== "TC", active: true, canonicalSubjectId,
        allowCrossMajor: common && !canonicalSubjectId, sharedMajorIds: common && !canonicalSubjectId ? [robotMajorId] : [], majorAssignment: /tốt nghiệp/.test(name) && credits === 9,
      }, identity);
    }
  }
  return rows;
}
