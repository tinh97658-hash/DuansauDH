import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { getConnectionToken } from "@nestjs/sequelize";
import { Op } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { AppModule } from "../../app.module.js";

/**
 * Seed dữ liệu 2 chuyên ngành Thạc sĩ: Công nghệ thông tin (CNTT) và Quản trị kinh doanh (QTKD)
 * tại Viện Đào tạo Sau đại học - Trường Đại học Hàng hải Việt Nam (VMU).
 *
 * Phạm vi dữ liệu:
 *  1. 2 Chuyên ngành: CNTT (8480201) và QTKD (8340101) - Trình độ Thạc sĩ
 *  2. 3 học phần chung (Cấp Viện - KC) + 17 học phần CNTT + 17 học phần QTKD
 *  3. 3 Kế hoạch tuyển sinh: 2024 (K30), 2025 (K31), 2026 (K32)
 *  4. 6 Chương trình đào tạo (CTĐT) chuẩn 60 tín chỉ theo Khung ĐH Hàng hải
 *  5. 12 Lớp học chuẩn chỉ theo quy định VMU (mỗi ngành 3 khóa, mỗi khóa 2 lớp: A & B)
 *  6. 120 Hồ sơ học viên thực tế (10 học viên/lớp), email chuẩn @vimaru.edu.vn
 *  7. Phân bổ học viên vào đúng 12 lớp và đăng ký học phần tự chọn của lớp.
 *
 * Tính chất: IDEMPOTENT — có thể chạy lại nhiều lần an toàn mà không bị trùng lặp dữ liệu.
 */

// Danh sách sinh viên thực tế chuẩn chỉ theo quy định
interface StudentSeedData {
  stt: number;
  lastName: string;
  firstName: string;
  gender: "Nam" | "Nữ";
  dob: string;
  pob: string;
  idCard: string;
  phone: string;
  email: string;
  workplace: string;
  gradSchool: string;
  gradMajor: string;
  gradYear: string;
  gradClassification: string;
}

// Hàm sinh 120 hồ sơ học viên chất lượng cao, tên chuẩn người Việt
function generateStudentList(): Record<string, StudentSeedData[]> {
  const maleFirst = [
    "Anh", "Bình", "Cường", "Dũng", "Đạt", "Đức", "Giang", "Hải", "Hiếu", "Hoàng",
    "Hùng", "Huy", "Khánh", "Khoa", "Lâm", "Long", "Minh", "Nam", "Nghĩa", "Phong",
    "Phúc", "Quân", "Quang", "Sơn", "Thắng", "Thịnh", "Tiến", "Toàn", "Trung", "Tuấn",
    "Tùng", "Việt", "Vinh", "Vũ", "Bách", "Trọng", "Thành", "Kiên", "Duy", "Hưng"
  ];
  const femaleFirst = [
    "Anh", "Châu", "Diệp", "Dung", "Giang", "Hà", "Hạnh", "Hoa", "Hương", "Huyền",
    "Lan", "Linh", "Ly", "Mai", "My", "Nga", "Ngân", "Ngọc", "Nhung", "Oanh",
    "Phương", "Quỳnh", "Thảo", "Trang", "Trâm", "Tuyết", "Uyên", "Vân", "Vy", "Yến",
    "Hiền", "Thúy", "Thu", "Tâm", "Hằng", "Thơ", "Bích", "Loan", "Thanh", "Thư"
  ];
  const maleMiddle = ["Văn", "Đức", "Minh", "Quang", "Hữu", "Tuấn", "Quốc", "Trọng", "Tiến", "Đình", "Ngọc", "Hải", "Thanh", "Công"];
  const femaleMiddle = ["Thị", "Thu", "Phương", "Mai", "Thanh", "Thùy", "Kim", "Ngọc", "Hồng", "Mỹ", "Bảo", "Lan", "Ánh", "Khánh"];
  const lastNames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Phan", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Đinh", "Đoàn"];

  const cities = ["Hải Phòng", "Hà Nội", "Quảng Ninh", "Hải Dương", "Thái Bình", "Nam Định", "Thanh Hóa", "Nghệ An", "Hưng Yên", "Bắc Ninh"];

  const itWorkplaces = [
    "Công ty Cổ phần Cảng Hải Phòng",
    "Công ty TNHH Phần mềm FPT Hải Phòng",
    "Trung tâm CNTT - Tổng Công ty Hàng hải Việt Nam (VIMC)",
    "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank) - CN Hải Phòng",
    "Công ty Cổ phần Tin học Hàng hải",
    "Cục Hải quan Thành phố Hải Phòng",
    "Viettel Hải Phòng - Chi nhánh Tập đoàn Công nghiệp Viễn thông Quân đội",
    "Công ty TNHH LG Electronics Việt Nam Hải Phòng",
    "Công ty Cổ phần Giải pháp Phần mềm Hanel",
    "VNPT Hải Phòng"
  ];

  const baWorkplaces = [
    "Công ty Cổ phần Vận tải biển Việt Nam (VOSCO)",
    "Công ty Cổ phần Đại lý Hàng hải Việt Nam (VOSA)",
    "Công ty Cổ phần Viconship (Cảng Xanh)",
    "Chi nhánh Ngân hàng BIDV Đông Hải Phòng",
    "Công ty Cổ phần Đầu tư và Quản lý Bất động sản Duyên hải",
    "Công ty TNHH MTV Đóng tàu Nam Triệu",
    "Tập đoàn Hateco Logistics",
    "Công ty Cổ phần Vận tải biển Vinaship",
    "Tổng Công ty Bảo hiểm Bảo Việt - Hải Phòng",
    "Công ty CP Cung ứng Dịch vụ Hàng hải Gemadept"
  ];

  const colleges = [
    "Trường Đại học Hàng hải Việt Nam",
    "Trường Đại học Bách khoa Hà Nội",
    "Trường Đại học Kinh tế Quốc dân",
    "Trường Đại học Hải Phòng",
    "Trường Đại học Công nghệ - ĐHQGHN",
    "Trường Đại học Ngoại thương"
  ];

  const classifications = ["Giỏi", "Khá", "Khá", "Giỏi", "Khá"];

  // Dữ liệu 12 nhóm (mỗi nhóm đúng 10 học viên)
  const classKeys = [
    "THS-CNTT-K30A", "THS-CNTT-K30B",
    "THS-CNTT-K31A", "THS-CNTT-K31B",
    "THS-CNTT-K32A", "THS-CNTT-K32B",
    "THS-QTKD-K30A", "THS-QTKD-K30B",
    "THS-QTKD-K31A", "THS-QTKD-K31B",
    "THS-QTKD-K32A", "THS-QTKD-K32B",
  ];

  const result: Record<string, StudentSeedData[]> = {};
  let globalStudentIndex = 1;

  for (const classKey of classKeys) {
    const isIT = classKey.includes("CNTT");
    const year = classKey.includes("K30") ? "24" : classKey.includes("K31") ? "25" : "26";
    const majorCode = isIT ? "CNTT" : "QTKD";
    const students: StudentSeedData[] = [];

    for (let i = 1; i <= 10; i++) {
      const isMale = (i + globalStudentIndex) % 3 !== 0; // Tỷ lệ ~66% Nam, 34% Nữ
      const lastName = lastNames[(globalStudentIndex * 7 + i) % lastNames.length];
      const middleName = isMale
        ? maleMiddle[(globalStudentIndex * 3 + i) % maleMiddle.length]
        : femaleMiddle[(globalStudentIndex * 5 + i) % femaleMiddle.length];
      const firstName = isMale
        ? maleFirst[(globalStudentIndex * 11 + i) % maleFirst.length]
        : femaleFirst[(globalStudentIndex * 13 + i) % femaleFirst.length];

      const birthYear = 1994 + ((globalStudentIndex + i) % 7); // 1994 -> 2000
      const birthMonth = 1 + ((globalStudentIndex * 2 + i) % 12);
      const birthDay = 1 + ((globalStudentIndex * 3 + i) % 28);
      const dob = `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`;

      const pob = cities[(globalStudentIndex + i) % cities.length];
      const idPrefix = pob === "Hải Phòng" ? "031" : pob === "Hà Nội" ? "001" : pob === "Quảng Ninh" ? "022" : "030";
      const idCard = `${idPrefix}${isMale ? "0" : "1"}${String(birthYear).slice(2)}${String(100000 + (globalStudentIndex * 37 + i * 19) % 900000)}`;

      const phone = `09${String(10000000 + (globalStudentIndex * 12345 + i * 6789) % 90000000).padStart(8, "0")}`;
      const codeIndex = classKey.endsWith("A") ? i : 10 + i;
      const code = `HV${year}-${majorCode}-${String(codeIndex).padStart(3, "0")}`;
      const email = `${code.toLowerCase().replace(/-/g, ".")}@vimaru.edu.vn`;

      const workplaceList = isIT ? itWorkplaces : baWorkplaces;
      const workplace = workplaceList[(globalStudentIndex + i) % workplaceList.length];
      const gradSchool = colleges[(globalStudentIndex + i) % colleges.length];
      const gradMajor = isIT
        ? (i % 2 === 0 ? "Công nghệ thông tin" : "Khoa học máy tính")
        : (i % 2 === 0 ? "Quản trị kinh doanh" : "Kinh tế quốc tế");
      const gradYear = String(birthYear + 22);
      const gradClassification = classifications[(globalStudentIndex + i) % classifications.length];

      students.push({
        stt: codeIndex,
        lastName: `${lastName} ${middleName}`,
        firstName,
        gender: isMale ? "Nam" : "Nữ",
        dob,
        pob,
        idCard,
        phone,
        email,
        workplace,
        gradSchool,
        gradMajor,
        gradYear,
        gradClassification,
      });

      globalStudentIndex++;
    }
    result[classKey] = students;
  }

  return result;
}

async function run() {
  console.log("=== BẮT ĐẦU SEED DỮ LIỆU THẠC SĨ CNTT & QTKD (VMU) ===");
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const sequelize = app.get<Sequelize>(getConnectionToken());
  const M = sequelize.models as any;

  const log = (step: string, detail: string | number) =>
    console.log(`[seed-masters] ${step.padEnd(32)}: ${detail}`);

  // =========================================================================
  // 1. TRÌNH ĐỘ ĐÀO TẠO & HÌNH THỨC ĐÀO TẠO
  // =========================================================================
  let masterLevel = await M.TrainingLevel.findOne({ where: { code: "MASTER" } });
  if (!masterLevel) {
    masterLevel = await M.TrainingLevel.create({
      code: "MASTER",
      name: "Thạc sĩ",
      durationYears: 2,
      active: true,
    });
  }

  let cqMode = await M.TrainingMode.findOne({ where: { code: "CQ_TT" } });
  if (!cqMode) {
    let cqGroup = await M.TrainingModeGroup.findOne({ where: { code: "CQ" } });
    if (!cqGroup) {
      cqGroup = await M.TrainingModeGroup.create({ code: "CQ", name: "Chính quy", active: true });
    }
    cqMode = await M.TrainingMode.create({
      code: "CQ_TT",
      name: "Chính quy - Tập trung",
      groupId: cqGroup.id,
      active: true,
    });
  }

  // =========================================================================
  // 2. CHUYÊN NGÀNH THẠC SĨ (majors)
  // =========================================================================
  const majorDefs = [
    {
      code: "CNTT",
      name: "Công nghệ thông tin",
      program: "masters",
      trainingLevelId: masterLevel.id,
      durationYears: 2,
      maxOvertimeYears: 2,
      description: "Chương trình đào tạo Thạc sĩ Công nghệ thông tin - Định hướng ứng dụng AI, Big Data và Chuyển đổi số logistics biển (VMU)",
      active: true,
    },
    {
      code: "QTKD",
      name: "Quản trị kinh doanh",
      program: "masters",
      trainingLevelId: masterLevel.id,
      durationYears: 2,
      maxOvertimeYears: 2,
      description: "Chương trình đào tạo Thạc sĩ Quản trị kinh doanh (MBA) - Định hướng quản trị chiến lược, tài chính và logistics biển (VMU)",
      active: true,
    },
  ];

  const majors: Record<string, any> = {};
  for (const def of majorDefs) {
    let [major, created] = await M.Major.findOrCreate({
      where: { code: def.code, program: "masters" },
      defaults: def,
    });
    if (!created) {
      await major.update(def);
    }
    majors[def.code] = major;
  }
  log("Chuyên ngành Thạc sĩ", "Đã sẵn sàng CNTT và QTKD");

  // Đảm bảo ngành dùng chung CHUNG (Cấp Viện)
  let [commonMajor] = await M.Major.findOrCreate({
    where: { code: "CHUNG", program: "masters" },
    defaults: {
      code: "CHUNG",
      name: "Học phần chung (Cấp Viện)",
      program: "masters",
      trainingLevelId: masterLevel.id,
      durationYears: 2,
      maxOvertimeYears: 2,
      description: "Danh mục học phần dùng chung toàn trường do Viện Đào tạo Sau đại học quản lý",
      active: true,
    },
  });

  // =========================================================================
  // 3. DANH MỤC HỌC PHẦN DÙNG CHUNG CẤP VIỆN (KC)
  // =========================================================================
  const commonSubjectDefs = [
    { codeNumber: 101, code: "TRIET", name: "Triết học (Triết học Mác - Lênin nâng cao)", credits: 3, subjectType: "KC", isRequired: true },
    { codeNumber: 102, code: "TA_CHUNG", name: "Tiếng Anh học thuật (Sau đại học)", credits: 4, subjectType: "KC", isRequired: true },
    { codeNumber: 103, code: "PPNC_CHUNG", name: "Phương pháp nghiên cứu khoa học", credits: 2, subjectType: "KC", isRequired: true },
  ];

  const commonSubjects: any[] = [];
  for (const def of commonSubjectDefs) {
    const attr = {
      code: def.code,
      codeText: def.code,
      codeNumber: def.codeNumber,
      name: def.name,
      majorId: commonMajor.id,
      program: "masters",
      credits: def.credits,
      majorAssignment: false,
      subjectType: def.subjectType,
      isRequired: def.isRequired,
      allowCrossMajor: true,
      active: true,
    };
    let [sub] = await M.Subject.findOrCreate({
      where: { majorId: commonMajor.id, program: "masters", codeNumber: def.codeNumber },
      defaults: attr,
    });
    await sub.update(attr);
    commonSubjects.push(sub);
  }
  log("Học phần chung (KC)", `${commonSubjects.length} học phần`);

  // =========================================================================
  // 4. DANH MỤC HỌC PHẦN CHUYÊN NGÀNH CNTT (17 học phần)
  // =========================================================================
  const itSubjectDefs: Array<[number, string, string, number, string, boolean, boolean]> = [
    // [codeNumber, code, name, credits, subjectType, isRequired, majorAssignment]
    // Cơ sở ngành (CS)
    [601, "TRNA", "Toán rời rạc nâng cao", 3, "CS", true, false],
    [602, "PPNC-IT", "Phương pháp nghiên cứu khoa học trong CNTT", 2, "CS", true, false],
    [603, "PTTT", "Phân tích và thiết kế thuật toán nâng cao", 3, "CS", true, false],
    [604, "TACN", "Tiếng Anh chuyên ngành CNTT", 3, "CS", true, false],
    // Chuyên ngành bắt buộc (CN)
    [605, "KTMT", "Kiến trúc máy tính và hệ thống phân tán tiên tiến", 3, "CN", true, false],
    [606, "TTNT", "Trí tuệ nhân tạo và học máy nâng cao", 3, "CN", true, false],
    [607, "TGMT", "Thị giác máy tính và xử lý ảnh", 3, "CN", true, false],
    [608, "KPDL", "Khai phá dữ liệu và dữ liệu lớn (Big Data)", 3, "CN", true, false],
    [609, "ATTT", "An toàn, an ninh thông tin và mật mã ứng dụng", 3, "CN", true, false],
    [610, "KNPM", "Kỹ nghệ phần mềm tiên tiến", 3, "CN", true, false],
    [611, "CSDL", "Cơ sở dữ liệu phân tán và NoSQL", 3, "CN", true, false],
    // Tự chọn (TC)
    [612, "DTDM", "Điện toán đám mây và ảo hóa", 3, "TC", false, false],
    [613, "IOTH", "Internet vạn vật (IoT) và mạng cảm biến trong hàng hải", 3, "TC", false, false],
    [614, "TTNM", "Tương tác người - máy (HCI) và trực quan hóa dữ liệu", 3, "TC", false, false],
    [615, "XNNT", "Xử lý ngôn ngữ tự nhiên (NLP)", 3, "TC", false, false],
    [616, "CDSH", "Chuyển đổi số trong logistics và hàng hải", 3, "TC", false, false],
    // Tốt nghiệp
    [617, "LV-CNTT", "Luận văn thạc sĩ Công nghệ thông tin", 9, "CN", true, true],
  ];

  const itSubjects: any[] = [];
  for (const [codeNumber, code, name, credits, subjectType, isRequired, majorAssignment] of itSubjectDefs) {
    const attr = {
      code,
      codeText: code,
      codeNumber,
      name,
      majorId: majors.CNTT.id,
      program: "masters",
      credits,
      majorAssignment,
      subjectType,
      isRequired,
      sortOrder: itSubjects.length + 1,
      allowCrossMajor: false,
      active: true,
    };
    let [sub] = await M.Subject.findOrCreate({
      where: { majorId: majors.CNTT.id, program: "masters", codeNumber },
      defaults: attr,
    });
    await sub.update(attr);
    itSubjects.push(sub);
  }
  log("Học phần chuyên ngành CNTT", `${itSubjects.length} học phần`);

  // =========================================================================
  // 5. DANH MỤC HỌC PHẦN CHUYÊN NGÀNH QTKD (17 học phần)
  // =========================================================================
  const qtkdSubjectDefs: Array<[number, string, string, number, string, boolean, boolean]> = [
    // [codeNumber, code, name, credits, subjectType, isRequired, majorAssignment]
    // Cơ sở ngành (CS)
    [701, "KTQL", "Kinh tế học quản lý nâng cao", 3, "CS", true, false],
    [702, "PPNC-KD", "Phương pháp nghiên cứu kinh doanh & xử lý dữ liệu", 3, "CS", true, false],
    [703, "KTQT", "Kế toán quản trị chiến lược trong doanh nghiệp", 3, "CS", true, false],
    [704, "VHDN", "Văn hóa doanh nghiệp và đạo đức kinh doanh", 2, "CS", true, false],
    // Chuyên ngành bắt buộc (CN)
    [705, "QTCL", "Quản trị chiến lược nâng cao", 3, "CN", true, false],
    [706, "QTTCDN", "Quản trị tài chính doanh nghiệp nâng cao", 3, "CN", true, false],
    [707, "QTMKT", "Quản trị Marketing hiện đại", 3, "CN", true, false],
    [708, "QTNS", "Quản trị nguồn nhân lực chiến lược", 3, "CN", true, false],
    [709, "QTCCU", "Quản trị chuỗi cung ứng và logistics quốc tế", 3, "CN", true, false],
    [710, "QTHD", "Quản trị hoạt động và sản xuất tiên tiến", 3, "CN", true, false],
    [711, "QTRRO", "Quản trị rủi ro doanh nghiệp", 3, "CN", true, false],
    // Tự chọn (TC)
    [712, "QTDAN", "Quản trị dự án kinh doanh", 3, "TC", false, false],
    [713, "DAMPHAN", "Đàm phán và giải quyết xung đột kinh doanh quốc tế", 3, "TC", false, false],
    [714, "KHOINGHIEP", "Quản trị đổi mới sáng tạo và khởi nghiệp", 3, "TC", false, false],
    [715, "TMQT", "Thương mại quốc tế và chính sách hàng hải", 3, "TC", false, false],
    [716, "LOGHH", "Quản trị khai thác cảng và logistics biển", 3, "TC", false, false],
    // Tốt nghiệp
    [717, "LV-QTKD", "Luận văn thạc sĩ Quản trị kinh doanh", 9, "CN", true, true],
  ];

  const qtkdSubjects: any[] = [];
  for (const [codeNumber, code, name, credits, subjectType, isRequired, majorAssignment] of qtkdSubjectDefs) {
    const attr = {
      code,
      codeText: code,
      codeNumber,
      name,
      majorId: majors.QTKD.id,
      program: "masters",
      credits,
      majorAssignment,
      subjectType,
      isRequired,
      sortOrder: qtkdSubjects.length + 1,
      allowCrossMajor: false,
      active: true,
    };
    let [sub] = await M.Subject.findOrCreate({
      where: { majorId: majors.QTKD.id, program: "masters", codeNumber },
      defaults: attr,
    });
    await sub.update(attr);
    qtkdSubjects.push(sub);
  }
  log("Học phần chuyên ngành QTKD", `${qtkdSubjects.length} học phần`);

  // =========================================================================
  // 6. KẾ HOẠCH TUYỂN SINH (TrainingPlans) CHO 2024, 2025, 2026
  // =========================================================================
  let [progMaster] = await M.TrainingProgram.findOrCreate({
    where: { code: "CTTHS" },
    defaults: {
      code: "CTTHS",
      name: "Chương trình đào tạo Thạc sĩ",
      trainingLevelId: masterLevel.id,
      trainingModeId: cqMode.id,
      majorId: null,
      durationYears: 2,
      active: true,
    },
  });

  const planYears = [
    { year: "2024", code: "KH2024", name: "Kế hoạch tuyển sinh sau đại học năm 2024 (Khóa 30)" },
    { year: "2025", code: "KH2025", name: "Kế hoạch tuyển sinh sau đại học năm 2025 (Khóa 31)" },
    { year: "2026", code: "KH2026", name: "Kế hoạch tuyển sinh sau đại học năm 2026 (Khóa 32)" },
  ];

  const plansByYear: Record<string, any> = {};
  for (const p of planYears) {
    let [plan] = await M.TrainingPlan.findOrCreate({
      where: { code: p.code },
      defaults: {
        code: p.code,
        name: p.name,
        programId: progMaster.id,
        academicYear: p.year,
        startDate: `${p.year}-09-01`,
        endDate: `${Number(p.year) + 1}-01-31`,
        targetStudents: 150,
        status: "active",
        note: `Kế hoạch đào tạo và tuyển sinh Thạc sĩ năm ${p.year}`,
      },
    });
    plansByYear[p.year] = plan;
  }
  log("Kế hoạch tuyển sinh", "Đã đảm bảo KH2024, KH2025, KH2026");

  // =========================================================================
  // 7. CHƯƠNG TRÌNH ĐÀO TẠO (6 CTĐT) CHO 2 NGÀNH VÀ 3 KHÓA
  // =========================================================================
  const blockDefs = [
    { code: "KC", name: "Khối kiến thức chung", sortOrder: 1, minCredits: 9 },
    { code: "CS", name: "Khối kiến thức cơ sở ngành", sortOrder: 2, minCredits: 11 },
    { code: "CN", name: "Khối kiến thức chuyên ngành", sortOrder: 3, minCredits: 30 },
    { code: "TC", name: "Khối kiến thức tự chọn", sortOrder: 4, minCredits: 6 },
  ];

  const curriculums: Record<string, any> = {};

  const majorConfigs = [
    { key: "CNTT", major: majors.CNTT, subjectList: itSubjects },
    { key: "QTKD", major: majors.QTKD, subjectList: qtkdSubjects },
  ];

  for (const { key, major, subjectList } of majorConfigs) {
    for (const year of ["2024", "2025", "2026"]) {
      const kCode = year === "2024" ? "K30" : year === "2025" ? "K31" : "K32";
      const currCode = `CT-${key}-${year}`;
      const currName = `Chương trình đào tạo ${major.name} - Khóa ${year} (${kCode})`;

      let [curriculum] = await M.Curriculum.findOrCreate({
        where: { majorId: major.id, program: "masters", applicableFromYear: year },
        defaults: {
          code: currCode,
          name: currName,
          majorId: major.id,
          program: "masters",
          applicableFromYear: year,
          totalCredits: 60,
          active: true,
          note: `CTĐT Thạc sĩ ${major.name} Khóa ${kCode} chuẩn 60 tín chỉ`,
        },
      });
      await curriculum.update({ code: currCode, name: currName, active: true });
      curriculums[`${key}-${year}`] = curriculum;

      // Tạo các khối kiến thức cho CTĐT
      const blocks: Record<string, any> = {};
      for (const bDef of blockDefs) {
        let [block] = await M.CurriculumBlock.findOrCreate({
          where: { curriculumId: curriculum.id, code: bDef.code },
          defaults: { ...bDef, curriculumId: curriculum.id },
        });
        blocks[bDef.code] = block;
      }

      // Nạp các học phần vào CTĐT: Môn chung (KC) + Môn chuyên ngành
      const allEntries = [...commonSubjects, ...subjectList];
      let reqCredits = 0;

      for (let idx = 0; idx < allEntries.length; idx++) {
        const sub = allEntries[idx];
        const block = blocks[sub.subjectType] || blocks.CN;
        const entryAttr = {
          curriculumId: curriculum.id,
          blockId: block.id,
          electiveGroupId: null,
          subjectId: sub.id,
          isRequired: sub.isRequired,
          credits: sub.credits,
          sortOrder: idx + 1,
        };
        let [entry] = await M.CurriculumSubject.findOrCreate({
          where: { curriculumId: curriculum.id, subjectId: sub.id },
          defaults: entryAttr,
        });
        await entry.update(entryAttr);
        if (sub.isRequired) reqCredits += Number(sub.credits) || 0;
      }
      await curriculum.update({ totalCredits: reqCredits + 6 }); // Cộng 6 TC tự chọn đạt chuẩn 60 TC
    }
  }
  log("Chương trình đào tạo (CTĐT)", "6 CTĐT chuẩn 60 tín chỉ cho 2 ngành x 3 khóa");

  // =========================================================================
  // 8. KHỞI TẠO 12 LỚP HỌC (mỗi ngành 3 khóa, mỗi khóa 2 lớp A và B)
  // =========================================================================
  const classDefs = [
    // CNTT
    { code: "THS-CNTT-K30A", name: "Lớp Thạc sĩ CNTT Khóa 30 - Lớp A", majorKey: "CNTT", year: "2024" },
    { code: "THS-CNTT-K30B", name: "Lớp Thạc sĩ CNTT Khóa 30 - Lớp B", majorKey: "CNTT", year: "2024" },
    { code: "THS-CNTT-K31A", name: "Lớp Thạc sĩ CNTT Khóa 31 - Lớp A", majorKey: "CNTT", year: "2025" },
    { code: "THS-CNTT-K31B", name: "Lớp Thạc sĩ CNTT Khóa 31 - Lớp B", majorKey: "CNTT", year: "2025" },
    { code: "THS-CNTT-K32A", name: "Lớp Thạc sĩ CNTT Khóa 32 - Lớp A", majorKey: "CNTT", year: "2026" },
    { code: "THS-CNTT-K32B", name: "Lớp Thạc sĩ CNTT Khóa 32 - Lớp B", majorKey: "CNTT", year: "2026" },
    // QTKD
    { code: "THS-QTKD-K30A", name: "Lớp Thạc sĩ QTKD Khóa 30 - Lớp A", majorKey: "QTKD", year: "2024" },
    { code: "THS-QTKD-K30B", name: "Lớp Thạc sĩ QTKD Khóa 30 - Lớp B", majorKey: "QTKD", year: "2024" },
    { code: "THS-QTKD-K31A", name: "Lớp Thạc sĩ QTKD Khóa 31 - Lớp A", majorKey: "QTKD", year: "2025" },
    { code: "THS-QTKD-K31B", name: "Lớp Thạc sĩ QTKD Khóa 31 - Lớp B", majorKey: "QTKD", year: "2025" },
    { code: "THS-QTKD-K32A", name: "Lớp Thạc sĩ QTKD Khóa 32 - Lớp A", majorKey: "QTKD", year: "2026" },
    { code: "THS-QTKD-K32B", name: "Lớp Thạc sĩ QTKD Khóa 32 - Lớp B", majorKey: "QTKD", year: "2026" },
  ];

  const classGroups: Record<string, any> = {};
  for (const c of classDefs) {
    const major = majors[c.majorKey];
    const curriculum = curriculums[`${c.majorKey}-${c.year}`];
    const attr = {
      program: "masters",
      code: c.code,
      name: c.name,
      majorId: major.id,
      curriculumId: curriculum.id,
      academicYear: c.year,
      maxStudents: 20,
      status: "open",
      note: `Lớp Thạc sĩ ${major.name} tuyển sinh năm ${c.year} theo chuẩn VMU`,
    };
    let [group] = await M.ClassGroup.findOrCreate({
      where: { program: "masters", code: c.code },
      defaults: attr,
    });
    await group.update(attr);
    classGroups[c.code] = group;

    // Đồng bộ học phần tự chọn của CTĐT cho lớp
    const electiveEntries = await M.CurriculumSubject.findAll({
      where: { curriculumId: curriculum.id, isRequired: false },
    });
    // Dọn các electives cũ của lớp nếu có
    await M.ClassGroupElective.destroy({ where: { classGroupId: group.id } });
    for (const el of electiveEntries) {
      await M.ClassGroupElective.create({
        classGroupId: group.id,
        curriculumSubjectId: el.id,
      });
    }
  }
  log("Lớp học (ClassGroups)", "12 lớp học chuẩn chỉ (6 lớp CNTT + 6 lớp QTKD)");

  // =========================================================================
  // 9. SINH 120 HỒ SƠ HỌC VIÊN & GHI DANH VÀO 12 LỚP (10 HỌC VIÊN/LỚP)
  // =========================================================================
  const studentDataByClass = generateStudentList();

  // Dọn các hồ sơ cũ nếu đã tồn tại để đảm bảo tính idempotent
  const allStudentCodes: string[] = [];
  for (const classKey of Object.keys(studentDataByClass)) {
    for (const s of studentDataByClass[classKey]) {
      const year = classKey.includes("K30") ? "24" : classKey.includes("K31") ? "25" : "26";
      const majorCode = classKey.includes("CNTT") ? "CNTT" : "QTKD";
      allStudentCodes.push(`HV${year}-${majorCode}-${String(s.stt).padStart(3, "0")}`);
    }
  }

  // Dọn liên kết lớp cũ của các học viên này
  const oldRecords = await M.AdmissionRecord.findAll({
    where: { code: { [Op.in]: allStudentCodes } },
    attributes: ["id"],
  });
  const oldRecordIds = oldRecords.map((r: any) => r.id);
  if (oldRecordIds.length > 0) {
    await M.ClassGroupMember.destroy({ where: { admissionRecordId: { [Op.in]: oldRecordIds } } });
    await M.AdmissionRecord.destroy({ where: { id: { [Op.in]: oldRecordIds } } });
  }

  let totalStudentsCreated = 0;
  let totalMembersEnrolled = 0;

  for (const c of classDefs) {
    const group = classGroups[c.code];
    const major = majors[c.majorKey];
    const plan = plansByYear[c.year];
    const students = studentDataByClass[c.code];

    for (const s of students) {
      const year = c.year.slice(2);
      const studentCode = `HV${year}-${c.majorKey}-${String(s.stt).padStart(3, "0")}`;

      const admissionRecord = await M.AdmissionRecord.create({
        code: studentCode,
        lastName: s.lastName,
        firstName: s.firstName,
        fullName: `${s.lastName} ${s.firstName}`,
        dob: s.dob,
        idCard: s.idCard,
        gender: s.gender,
        email: s.email,
        phone: s.phone,
        pob: s.pob,
        receiptType: "Trực tiếp",
        profileCategory: "Học viên cao học chính quy",
        trainingLevel: "Thạc sĩ",
        trainingModeName: "Chính quy - Tập trung",
        trainingModeId: cqMode.id,
        planId: plan.id,
        majorId: major.id,
        majorName: major.name,
        language: "Tiếng Việt",
        studyStatus: "Đã trúng tuyển",
        academicYear: c.year,
        nationality: "Việt Nam",
        ethnicity: "Kinh",
        religion: "Không",
        city: s.pob,
        workplace: s.workplace,
        job: c.majorKey === "CNTT" ? "Kỹ sư phần mềm / Quản trị hệ thống" : "Chuyên viên quản lý / Kinh doanh",
        gradSchool: s.gradSchool,
        gradDegreeType: "Chính quy",
        gradYear: s.gradYear,
        gradMajor: s.gradMajor,
        gradClassification: s.gradClassification,
        status: "approved",
        note: `Học viên Thạc sĩ Khóa ${c.code.split("-")[2].slice(0, 3)} - Lớp ${c.name}`,
      });

      totalStudentsCreated++;

      // Ghi danh học viên vào lớp (ClassGroupMember)
      await M.ClassGroupMember.create({
        classGroupId: group.id,
        admissionRecordId: admissionRecord.id,
        studentId: null,
        enrolledAt: new Date(),
        note: `Biên chế chính thức vào ${c.code}`,
      });

      totalMembersEnrolled++;
    }
  }

  log("Hồ sơ học viên (AdmissionRecord)", `${totalStudentsCreated} học viên chuẩn chỉ`);
  log("Ghi danh lớp (ClassGroupMember)", `${totalMembersEnrolled} học viên (10 HV/lớp)`);

  console.log("\n=== TỔNG KẾT SEED DỮ LIỆU THẠC SĨ VMU ===");
  console.log(`- 2 Chuyên ngành: CNTT, QTKD`);
  console.log(`- 34 Học phần chuyên ngành (17 CNTT, 17 QTKD) + 3 Học phần chung Cấp Viện`);
  console.log(`- 6 Chương trình đào tạo (CTĐT) chuẩn 60 tín chỉ`);
  console.log(`- 12 Lớp học: 6 lớp CNTT, 6 lớp QTKD theo 3 khóa 2024 (K30), 2025 (K31), 2026 (K32)`);
  console.log(`- 120 Học viên đầy đủ hồ sơ tuyển sinh thực tế, mỗi lớp đúng 10 học viên`);
  console.log("=== HOÀN TẤT THÀNH CÔNG ===");

  await app.close();
}

run().catch((error) => {
  console.error("[seed-masters] THẤT BẠI:", error);
  process.exitCode = 1;
});
