import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { getConnectionToken } from "@nestjs/sequelize";
import { Op } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { AppModule } from "../app.module.js";

/**
 * Seed dữ liệu demo cho toàn bộ hệ thống (idempotent — chạy lại được).
 * Dữ liệu được đánh dấu bằng tiền tố code "DEMO" / dải code riêng để khi
 * chạy lại sẽ xóa bản cũ rồi chèn mới, không phá dữ liệu thật.
 *
 * Phạm vi:
 *  - Danh mục: quận/huyện, phường/xã (bổ sung cho các thành phố đã có), giảng viên.
 *  - Kế hoạch: chương trình đào tạo, kế hoạch tuyển sinh, chỉ tiêu, khoản thu.
 *  - Kế hoạch đào tạo: 30 học phần cho ngành Khai thác hàng hải (Thạc sĩ),
 *    2 lớp + 2 gói học phần/lớp (21 môn, 1 gói chính thức).
 *  - Hồ sơ tuyển sinh: ~20 hồ sơ Thạc sĩ (đủ điều kiện phân nhóm) + phân nhóm
 *    học viên vào 2 lớp.
 */
async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const sequelize = app.get<Sequelize>(getConnectionToken());
  const M = sequelize.models as any;

  const log = (label: string, count: number | string) =>
    console.log(`[seed-demo] ${label}: ${count}`);

  // =====================================================================
  // 0. DỌN DỮ LIỆU DEMO CŨ (chỉ xóa các dòng do seed này tạo)
  // =====================================================================
  const demoClassGroups = await M.ClassGroup.findAll({ where: { code: { [Op.like]: "THS-K32%" } }, attributes: ["id"] });
  const demoClassIds: string[] = demoClassGroups.map((g: any) => g.id);
  const demoPackages = await M.SubjectPackage.findAll({
    where: demoClassIds.length ? { classGroupId: { [Op.in]: demoClassIds } } : { id: null },
    attributes: ["id"],
  });
  const demoPackageIds: string[] = demoPackages.map((p: any) => p.id);
  const kthhCleanup = await M.Major.findOne({ where: { code: "KTHH", program: "masters" } });

  await M.ClassGroupMember.destroy({ where: demoClassIds.length ? { classGroupId: { [Op.in]: demoClassIds } } : { id: null } });
  await M.SubjectPackageSubject.destroy({ where: demoPackageIds.length ? { packageId: { [Op.in]: demoPackageIds } } : { id: null } });
  await M.SubjectPackage.destroy({ where: demoClassIds.length ? { classGroupId: { [Op.in]: demoClassIds } } : { id: null } });
  await M.ClassGroup.destroy({ where: demoClassIds.length ? { id: { [Op.in]: demoClassIds } } : { id: null } });
  await M.Subject.destroy({ where: kthhCleanup ? { majorId: kthhCleanup.id, codeNumber: { [Op.gte]: 500 } } : { id: null } });
  await M.AdmissionRecord.destroy({
    where: { [Op.and]: [{ code: { [Op.like]: "HV26%" } }, { code: { [Op.ne]: "HV26001" } }] },
  });
  log("dọn demo cũ", `${demoClassIds.length} lớp demo cũ đã xóa`);

  // =====================================================================
  // 1. QUẬN/HUYỆN + PHƯỜNG/XÃ (bổ sung danh mục chung)
  // =====================================================================
  const cityId = async (code: string) => {
    const city = await M.City.findOne({ where: { code } });
    return city ? city.id : null;
  };

  const districts = [
    // Hải Phòng
    { cityCode: "HP", code: "QNQ", name: "Quận Ngô Quyền" },
    { cityCode: "HP", code: "QLC", name: "Quận Lê Chân" },
    { cityCode: "HP", code: "QHB", name: "Quận Hồng Bàng" },
    { cityCode: "HP", code: "QKA", name: "Quận Kiến An" },
    { cityCode: "HP", code: "QDS", name: "Quận Đồ Sơn" },
    { cityCode: "HP", code: "HTN", name: "Huyện Thủy Nguyên" },
    // Hà Nội
    { cityCode: "HN", code: "QHK", name: "Quận Hoàn Kiếm" },
    { cityCode: "HN", code: "QDD", name: "Quận Đống Đa" },
    { cityCode: "HN", code: "QTX", name: "Quận Thanh Xuân" },
    { cityCode: "HN", code: "QCG", name: "Quận Cầu Giấy" },
    // Quảng Ninh
    { cityCode: "QN", code: "TPHL", name: "TP Hạ Long" },
    { cityCode: "QN", code: "TPCP", name: "TP Cẩm Phả" },
    { cityCode: "QN", code: "TXMC", name: "TX Móng Cái" },
  ];

  const wardDefs: Array<[string, string, string]> = [
    // [districtCode, wardCode, wardName]
    ["QNQ", "PH_MAYTO", "Phường Máy Tơ"],
    ["QNQ", "PH_LACHTRAY", "Phường Lạch Tray"],
    ["QNQ", "PH_DONGKHE", "Phường Đông Khê"],
    ["QNQ", "PH_CUONGDONG", "Phường Cầu Đất"],
    ["QLC", "PH_ANBINH", "Phường An Biên"],
    ["QLC", "PH_HANGDANH", "Phường Hàng Dương"],
    ["QLC", "PH_LAMHA", "Phường Lam Hà"],
    ["QHB", "PH_HOANGVANTHU", "Phường Hoàng Văn Thụ"],
    ["QHB", "PH_HONGBAO", "Phường Hồng Bàng"],
    ["QHB", "PH_QUANTOAN", "Phường Quán Toan"],
    ["QKA", "PH_BACSON", "Phường Bắc Sơn"],
    ["QKA", "PH_NAMSON", "Phường Nam Sơn"],
    ["QDS", "PH_VANHUONG", "Phường Vạn Hương"],
    ["QDS", "PH_NGOCXUYEN", "Phường Ngọc Xuyên"],
    ["HTN", "XA_DUONGQUAN", "Xã Dương Quan"],
    ["HTN", "XA_TANDUONG", "Xã Tân Dương"],
    ["QHK", "PH_HANGBAI", "Phường Hàng Bạc"],
    ["QHK", "PH_TRANGTIEN", "Phường Tràng Tiền"],
    ["QDD", "PH_KIMLIEN", "Phường Kim Liên"],
    ["QDD", "PH_THINHQUANG", "Phường Thịnh Quang"],
    ["QTX", "PH_THANHXUANBAC", "Phường Thanh Xuân Bắc"],
    ["QTX", "PH_THANHXUANTRUNG", "Phường Thanh Xuân Trung"],
    ["QCG", "PH_DICHVONG", "Phường Dịch Vọng"],
    ["QCG", "PH_NGHIATAN", "Phường Nghĩa Tân"],
    ["TPHL", "PH_BAHANG", "Phường Bãi Cháy"],
    ["TPHL", "PH_HONGHAI", "Phường Hồng Hải"],
    ["TPHL", "PH_HAKHAU", "Phường Hà Khẩu"],
    ["TPCP", "PH_CAMTHINH", "Phường Cẩm Thịnh"],
    ["TPCP", "PH_QUANGHANH", "Phường Quang Hanh"],
    ["TXMC", "PH_KALONG", "Phường Ka Long"],
  ];

  const districtIds: Record<string, string> = {};
  let dCount = 0;
  for (const d of districts) {
    const city = await cityId(d.cityCode);
    if (!city) continue;
    const [record, created] = await M.District.findOrCreate({
      where: { code: d.code },
      defaults: { code: d.code, name: d.name, cityId: city, sortOrder: 0, active: true },
    });
    if (created || !record.cityId) await record.update({ name: d.name, cityId: city });
    districtIds[d.code] = record.id;
    if (created) dCount++;
  }
  log("quận/huyện", dCount ? `${dCount} mới` : "đã có");

  let wCount = 0;
  for (const [dCode, wCode, wName] of wardDefs) {
    const districtId = districtIds[dCode];
    if (!districtId) continue;
    const [record, created] = await M.Ward.findOrCreate({
      where: { code: wCode },
      defaults: { code: wCode, name: wName, districtId, sortOrder: 0, active: true },
    });
    if (created || !record.districtId) await record.update({ name: wName, districtId });
    if (created) wCount++;
  }
  log("phường/xã", wCount ? `${wCount} mới` : "đã có");

  // =====================================================================
  // 2. GIẢNG VIÊN
  // =====================================================================
  const lecturers = [
    { code: "GV001", name: "GS.TS. Nguyễn Văn Hải", email: "hainv@vimaru.edu.vn", phone: "0912345678", academicRank: "Giáo sư", academicDegree: "TS", title: "Giám đốc", department: "Viện Đào tạo Sau đại học" },
    { code: "GV002", name: "PGS.TS. Trần Quang Minh", email: "minhtq@vimaru.edu.vn", phone: "0912345679", academicRank: "Phó Giáo sư", academicDegree: "TS", title: "Phó Giám đốc", department: "Viện Đào tạo Sau đại học" },
    { code: "GV003", name: "PGS.TS. Lê Văn Cường", email: "cuonglv@vimaru.edu.vn", phone: "0912345680", academicRank: "Phó Giáo sư", academicDegree: "TS", title: "Trưởng bộ môn", department: "Khoa Điều khiển tàu biển" },
    { code: "GV004", name: "TS. Phạm Thị Lan", email: "lanpt@vimaru.edu.vn", phone: "0912345681", academicRank: "", academicDegree: "TS", title: "Phó trưởng bộ môn", department: "Khoa Kinh tế vận tải biển" },
    { code: "GV005", name: "TS. Vũ Đức Trung", email: "trungvd@vimaru.edu.vn", phone: "0912345682", academicRank: "", academicDegree: "TS", title: "Trưởng bộ môn", department: "Khoa Cơ khí - Động lực" },
    { code: "GV006", name: "ThS. Ngô Thị Hoa", email: "hoant@vimaru.edu.vn", phone: "0912345683", academicRank: "", academicDegree: "ThS", title: "Giảng viên", department: "Khoa Điện - Điện tử" },
    { code: "GV007", name: "TS. Đặng Hữu Bình", email: "binhdh@vimaru.edu.vn", phone: "0912345684", academicRank: "", academicDegree: "TS", title: "Trưởng bộ môn", department: "Khoa Hàng hải" },
    { code: "GV008", name: "PGS.TS. Hoàng Văn Toàn", email: "toanhv@vimaru.edu.vn", phone: "0912345685", academicRank: "Phó Giáo sư", academicDegree: "TS", title: "Trưởng bộ môn", department: "Khoa Xây dựng công trình thủy" },
    { code: "GV009", name: "ThS. Mai Thị Thu", email: "thumt@vimaru.edu.vn", phone: "0912345686", academicRank: "", academicDegree: "ThS", title: "Giảng viên", department: "Khoa Ngoại ngữ" },
    { code: "GV010", name: "TS. Trịnh Xuân Nam", email: "namtx@vimaru.edu.vn", phone: "0912345687", academicRank: "", academicDegree: "TS", title: "Phó trưởng khoa", department: "Khoa Công nghệ thông tin" },
  ];
  let lecCreated = 0, lecUpdated = 0;
  for (const l of lecturers) {
    const [record, created] = await M.Lecturer.findOrCreate({ where: { code: l.code }, defaults: l });
    if (!created) { await record.update(l); lecUpdated++; } else { lecCreated++; }
  }
  log("giảng viên", `mới=${lecCreated}, cập nhật=${lecUpdated}`);

  // =====================================================================
  // 3. CHƯƠNG TRÌNH ĐÀO TẠO + KẾ HOẠCH TUYỂN SINH
  // =====================================================================
  const masterLevel = await M.TrainingLevel.findOne({ where: { code: "MASTER" } });
  const doctorLevel = await M.TrainingLevel.findOne({ where: { code: "DOCTOR" } });
  const cqMode = await M.TrainingMode.findOne({ where: { code: "CQ_TT" } });

  const progDefs = [
    { code: "CTTHS", name: "Chương trình đào tạo Thạc sĩ", level: masterLevel, duration: 2 },
    { code: "CTTS", name: "Chương trình đào tạo Tiến sĩ", level: doctorLevel, duration: 3 },
  ];
  const programIds: Record<string, string> = {};
  for (const p of progDefs) {
    if (!p.level || !cqMode) continue;
    const [record, created] = await M.TrainingProgram.findOrCreate({
      where: { code: p.code },
      defaults: {
        code: p.code, name: p.name, trainingLevelId: p.level.id, trainingModeId: cqMode.id,
        majorId: null, durationYears: p.duration, active: true,
      },
    });
    if (!created) await record.update({ name: p.name });
    programIds[p.code] = record.id;
  }
  log("chương trình đào tạo", Object.keys(programIds).length);

  const plan2026 = await M.TrainingPlan.findOne({ where: { code: "KH2026" } });
  if (plan2026) await M.TrainingPlan.destroy({ where: { code: "KH2026" } });
  const plan = await M.TrainingPlan.create({
    code: "KH2026",
    name: "Kế hoạch tuyển sinh sau đại học năm 2026",
    programId: programIds.CTTHS || null,
    academicYear: "2026",
    semester: "HK1",
    startDate: "2026-09-01",
    endDate: "2027-01-31",
    targetStudents: 120,
    status: "active",
    note: "Kế hoạch tuyển sinh Thạc sĩ khóa 32 - demo",
  });
  log("kế hoạch tuyển sinh", plan.id ? plan.code : 0);

  // Chỉ tiêu xét tuyển theo ngành
  const targetDefs: Array<[string, number]> = [
    ["KTHH", 30], ["DKTB", 25], ["KTVB", 25], ["DTDD", 20], ["XDCT", 20],
  ];
  let targetCount = 0;
  for (const [majorCode, quota] of targetDefs) {
    const major = await M.Major.findOne({ where: { code: majorCode, program: "masters" } });
    if (!major || !cqMode) continue;
    const [target, created] = await M.AdmissionTarget.findOrCreate({
      where: { planId: plan.id, majorId: major.id },
      defaults: { planId: plan.id, majorId: major.id, trainingModeId: cqMode.id, quota, note: `Chỉ tiêu ${major.name}` },
    });
    if (!created) await target.update({ quota });
    if (created) targetCount++;
  }
  log("chỉ tiêu xét tuyển", targetCount || "đã có");

  // Khoản thu đầu năm
  const feeDefs: Array<[string, string | number, string, string]> = [
    ["Học phí học kỳ I", 8000000, "2026-10-15", "Học phí học kỳ đầu tiên"],
    ["Lệ phí nhập học", 500000, "2026-09-15", "Lệ phí làm thủ tục nhập học"],
    ["Bảo hiểm y tế", 700000, "2026-10-15", "Bảo hiểm y tế năm học 2026-2027"],
    ["Kinh phí bảo vệ luận văn", 1000000, "2027-05-30", "Kinh phí cho hội đồng bảo vệ luận văn"],
  ];
  await M.AnnualFee.destroy({ where: { planId: plan.id } });
  for (const [name, amount, dueDate, note] of feeDefs) {
    await M.AnnualFee.create({ planId: plan.id, name, amount, dueDate, note });
  }
  log("khoản thu đầu năm", feeDefs.length);

  // =====================================================================
  // 4. HỌC PHẦN (30 môn — ngành KTHH Thạc sĩ)
  // =====================================================================
  const majorKTHH = await M.Major.findOne({ where: { code: "KTHH", program: "masters" } });
  if (!majorKTHH) throw new Error("Chưa có ngành KTHH (masters). Hãy chạy seed-common trước.");

  // [codeNumber, codeText, name, credits, subjectType, isRequired, majorAssignment]
  const subjectDefs: Array<[number, string, string, number, string, boolean, boolean]> = [
    [501, "QTHH", "Quản trị khai thác đội tàu", 3, "CN", true, false],
    [502, "KTHT", "Kỹ thuật khai thác tàu", 3, "CN", true, false],
    [503, "ANHH", "An toàn hàng hải", 2, "CN", true, false],
    [504, "BVMT", "Bảo vệ môi trường biển", 2, "CN", true, false],
    [505, "PPNC", "Phương pháp nghiên cứu khoa học", 2, "CS", true, false],
    [506, "TAHD", "Tiếng Anh học thuật", 3, "CS", true, false],
    [507, "THDL", "Thủy động lực học tàu thủy", 3, "CN", true, false],
    [508, "KKTB", "Kết cấu tàu và kiểm tra tàu", 3, "CN", true, false],
    [509, "DCLT", "Động cơ đốt trong tàu thủy", 3, "CN", true, false],
    [510, "TDCD", "Thiết bị đẩy tàu", 3, "CN", true, false],
    [511, "DHDK", "Điều động tàu", 2, "CN", true, false],
    [512, "VTBH", "Vận tải biển", 3, "CN", true, false],
    [513, "LOGT", "Logistics và chuỗi cung ứng", 3, "TC", false, false],
    [514, "HHDT", "Hàng hải điện tử và định vị", 2, "CN", true, false],
    [515, "KTHS", "Kỹ thuật hàng hải", 3, "CN", true, false],
    [516, "QLRR", "Quản lý rủi ro hàng hải", 2, "TC", false, false],
    [517, "MARP", "Công ước MARPOL và quản lý môi trường", 2, "CS", true, false],
    [518, "SOLA", "Công ước SOLAS và an toàn tàu", 2, "CS", true, false],
    [519, "ISPS", "An ninh hàng hải ISPS", 2, "CS", true, false],
    [520, "QLCB", "Quản lý cảng biển", 3, "TC", false, false],
    [521, "NCDH", "Nghiên cứu định hướng", 2, "CS", true, false],
    [522, "THDB", "Thực hành đi biển", 2, "CN", true, false],
    [523, "KTVC", "Kinh tế vận tải", 3, "CN", true, false],
    [524, "BHLD", "Bảo hộ lao động", 2, "CS", true, false],
    [525, "HTTH", "Hệ thống thông tin hàng hải", 2, "TC", false, false],
    [526, "XDLV", "Xây dựng đề cương luận văn", 6, "CN", true, true],
    [527, "SKNN", "Sức khỏe nghề nghiệp", 2, "CS", true, false],
    [528, "VHGT", "Văn hóa giao tiếp trong doanh nghiệp", 2, "CH", false, false],
    [529, "QTDA", "Quản trị dự án", 2, "TC", false, false],
    [530, "TDHK", "Tự động hóa hàng hải", 3, "CN", true, false],
  ];

  const subjects = [];
  for (const [codeNumber, codeText, name, credits, subjectType, isRequired, majorAssignment] of subjectDefs) {
    const subject = await M.Subject.create({
      code: codeText,
      codeNumber,
      codeText,
      name,
      majorId: majorKTHH.id,
      program: "masters",
      credits,
      majorAssignment,
      subjectType,
      isRequired,
      sortOrder: subjects.length,
      active: true,
    });
    subjects.push(subject);
  }
  log("học phần", subjects.length);

  // =====================================================================
  // 5. LỚP HỌC + GÓI HỌC PHẦN (2 lớp, mỗi lớp 2 gói / 21 môn)
  // =====================================================================
  const classDefs = [
    { code: "THS-K32-N01", name: "Nhóm 1 - Khóa 32", maxStudents: 20 },
    { code: "THS-K32-N02", name: "Nhóm 2 - Khóa 32", maxStudents: 20 },
  ];
  const classGroups = [];
  for (const c of classDefs) {
    const group = await M.ClassGroup.create({
      program: "masters",
      code: c.code,
      name: c.name,
      majorId: majorKTHH.id,
      academicYear: "2026",
      term: "HK1",
      maxStudents: c.maxStudents,
      status: "open",
      note: "Nhóm học phần demo khóa 32",
    });
    classGroups.push(group);
  }
  log("lớp học", classGroups.length);

  // Gói học phần: G1 = 21 môn đầu, G2 = 21 môn lệch (demo sự khác biệt giữa 2 gói)
  const packagePlans: Array<{ group: any; pkg: Array<{ code: string; name: string; official: boolean; indexes: number[] }> }> = [
    {
      group: classGroups[0],
      pkg: [
        { code: "G1-THS-K32-N01", name: "Gói học phần 1", official: true, indexes: Array.from({ length: 21 }, (_, i) => i) },
        { code: "G2-THS-K32-N01", name: "Gói học phần 2", official: false, indexes: [...Array.from({ length: 20 }, (_, i) => i), 22] },
      ],
    },
    {
      group: classGroups[1],
      pkg: [
        { code: "G1-THS-K32-N02", name: "Gói học phần 1", official: true, indexes: Array.from({ length: 21 }, (_, i) => i) },
        { code: "G2-THS-K32-N02", name: "Gói học phần 2", official: false, indexes: Array.from({ length: 21 }, (_, i) => i + 1) },
      ],
    },
  ];
  let pkgCount = 0;
  for (const { group, pkg } of packagePlans) {
    for (const def of pkg) {
      const p = await M.SubjectPackage.create({
        code: def.code,
        name: def.name,
        classGroupId: group.id,
        majorId: majorKTHH.id,
        totalSubjects: def.indexes.length,
        active: true,
        isOfficial: def.official,
      });
      await M.SubjectPackageSubject.bulkCreate(
        def.indexes.map((idx, order) => ({
          packageId: p.id,
          subjectId: subjects[idx].id,
          sortOrder: order + 1,
        })),
      );
      pkgCount++;
    }
  }
  log("gói học phần", pkgCount);

  // =====================================================================
  // 6. HỒ SƠ TUYỂN SINH (Thạc sĩ — đủ điều kiện phân nhóm)
  // =====================================================================
  const mastersMajors: Record<string, any> = {};
  for (const code of ["KTHH", "DKTB", "KTVB"]) {
    mastersMajors[code] = await M.Major.findOne({ where: { code, program: "masters" } });
  }

  // [stt, lastName, firstName, gender, dob, majorCode, cityName]
  const records: Array<[number, string, string, string, string, string, string]> = [
    [2, "Nguyễn Văn", "An", "Nam", "1998-03-12", "KTHH", "Hải Phòng"],
    [3, "Trần Thị", "Bình", "Nữ", "1997-07-25", "KTHH", "Hà Nội"],
    [4, "Lê Quang", "Cường", "Nam", "1996-11-02", "KTHH", "Quảng Ninh"],
    [5, "Phạm Thu", "Dung", "Nữ", "1999-01-18", "KTHH", "Hải Phòng"],
    [6, "Hoàng Văn", "Đạt", "Nam", "1995-05-30", "KTHH", "Thanh Hóa"],
    [7, "Vũ Thị", "Hà", "Nữ", "1998-09-14", "KTHH", "Hải Dương"],
    [8, "Đặng Minh", "Huy", "Nam", "1997-12-08", "KTHH", "Hưng Yên"],
    [9, "Bùi Thị", "Lan", "Nữ", "1996-04-21", "KTHH", "Nghệ An"],
    [10, "Ngô Đức", "Long", "Nam", "1994-08-17", "KTHH", "Quảng Ninh"],
    [11, "Đỗ Thị", "Mai", "Nữ", "1998-02-03", "KTHH", "Hải Phòng"],
    [12, "Trịnh Văn", "Nam", "Nam", "1997-06-27", "KTHH", "Hà Nội"],
    [13, "Phan Thị", "Ngọc", "Nữ", "1999-10-11", "KTHH", "Hải Phòng"],
    [14, "Nguyễn Thị", "Phương", "Nữ", "1996-01-29", "DKTB", "Đà Nẵng"],
    [15, "Trần Đức", "Quân", "Nam", "1995-07-09", "DKTB", "Khánh Hòa"],
    [16, "Lê Thị", "Sương", "Nữ", "1998-05-16", "DKTB", "Quảng Ninh"],
    [17, "Phạm Văn", "Thắng", "Nam", "1997-03-22", "DKTB", "Hải Phòng"],
    [18, "Hoàng Thị", "Trang", "Nữ", "1999-08-06", "KTVB", "Hà Nội"],
    [19, "Vũ Minh", "Tuấn", "Nam", "1996-12-13", "KTVB", "Hải Phòng"],
    [20, "Đặng Thị", "Vân", "Nữ", "1998-06-19", "KTVB", "Hải Dương"],
    [21, "Bùi Quốc", "Việt", "Nam", "1995-09-25", "KTVB", "Quảng Ninh"],
  ];

  const createdRecords: any[] = [];
  for (const [stt, lastName, firstName, gender, dob, majorCode, cityName] of records) {
    const major = mastersMajors[majorCode];
    if (!major) continue;
    const record = await M.AdmissionRecord.create({
      code: `HV26${String(stt).padStart(3, "0")}`,
      lastName,
      firstName,
      fullName: `${lastName} ${firstName}`,
      dob,
      gender,
      email: `hv${stt}@demo.vimaru.edu.vn`,
      phone: `09${String(10000000 + stt * 111111).padStart(8, "0")}`,
      pob: cityName,
      receiptType: "Trực tiếp",
      trainingLevel: "Thạc sĩ",
      trainingModeName: "Chính quy - Tập trung",
      majorId: major.id,
      majorName: major.name,
      academicYear: "2026",
      status: "approved",
      studyStatus: "Đã trúng tuyển",
      nationality: "Việt Nam",
      ethnicity: "Kinh",
    });
    createdRecords.push(record);
  }
  log("hồ sơ tuyển sinh", createdRecords.length);

  // =====================================================================
  // 7. PHÂN NHÓM HỌC VIÊN (12 hồ sơ KTHH vào 2 lớp)
  // =====================================================================
  const kthhRecords = createdRecords.filter((r) => r.majorId === majorKTHH.id).slice(0, 12);
  const half = Math.ceil(kthhRecords.length / 2);
  let memberCount = 0;
  for (let i = 0; i < kthhRecords.length; i++) {
    const group = i < half ? classGroups[0] : classGroups[1];
    await M.ClassGroupMember.create({
      classGroupId: group.id,
      admissionRecordId: kthhRecords[i].id,
      studentId: null,
      enrolledAt: new Date(),
      note: "Phân nhóm demo",
    });
    memberCount++;
  }
  log("học viên đã phân nhóm", memberCount);

  console.log("\n[seed-demo] HOÀN TẤT — dữ liệu demo đã sẵn sàng.");
  await app.close();
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
