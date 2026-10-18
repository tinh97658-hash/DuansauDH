import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { getConnectionToken } from "@nestjs/sequelize";
import { Sequelize } from "sequelize-typescript";
import { Op } from "sequelize";
import { AppModule } from "../../app.module.js";
import { COMMON_DISCIPLINE_CODE } from "../../common/major-scope.js";

/**
 * Seed Dữ liệu Mẫu chuẩn hóa theo thực tế Viện Đào tạo Sau Đại học - Trường Đại học Hàng hải Việt Nam (VMU)
 * Địa chỉ: Phòng 203, Nhà A6, 484 Lạch Tray, Lê Chân, Hải Phòng.
 * Website: https://sdh.vimaru.edu.vn | Email: sdh@vimaru.edu.vn
 *
 * Tính chất: IDEMPOTENT (Chạy lại an toàn mà không phá vỡ quan hệ khoá ngoại hay trùng lặp).
 */
async function run() {
  console.log("=========================================================================");
  console.log("   KHỞI TẠO DỮ LIỆU MẪU VIỆN ĐÀO TẠO SAU ĐẠI HỌC - ĐH HÀNG HẢI VIỆT NAM  ");
  console.log("=========================================================================");

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const sequelize = app.get<Sequelize>(getConnectionToken());
  const M = sequelize.models as any;

  const log = (module: string, info: string | number) =>
    console.log(`[VMU-SEED] ${module.padEnd(30)}: ${info}`);

  // 1. TRÌNH ĐỘ & HÌNH THỨC ĐÀO TẠO
  const [masterLevel] = await M.TrainingLevel.findOrCreate({
    where: { code: "MASTER" },
    defaults: { code: "MASTER", name: "Thạc sĩ", durationYears: 2, active: true },
  });
  const [doctorLevel] = await M.TrainingLevel.findOrCreate({
    where: { code: "DOCTOR" },
    defaults: { code: "DOCTOR", name: "Tiến sĩ", durationYears: 3, active: true },
  });

  const [cqGroup] = await M.TrainingModeGroup.findOrCreate({
    where: { code: "CQ" },
    defaults: { code: "CQ", name: "Chính quy", active: true },
  });

  const [cqMode] = await M.TrainingMode.findOrCreate({
    where: { code: "CQ_TT" },
    defaults: { code: "CQ_TT", name: "Chính quy - Tập trung", groupId: cqGroup.id, active: true },
  });

  const [progMaster] = await M.TrainingProgram.findOrCreate({
    where: { code: "CTTHS" },
    defaults: {
      code: "CTTHS",
      name: "Chương trình đào tạo Thạc sĩ",
      trainingLevelId: masterLevel.id,
      trainingModeId: cqMode.id,
      durationYears: 2,
      active: true,
    },
  });

  const [progDoctor] = await M.TrainingProgram.findOrCreate({
    where: { code: "CTTS" },
    defaults: {
      code: "CTTS",
      name: "Chương trình đào tạo Tiến sĩ",
      trainingLevelId: doctorLevel.id,
      trainingModeId: cqMode.id,
      durationYears: 3,
      active: true,
    },
  });

  log("Trình độ & Chương trình", "Đã khởi tạo Thạc sĩ & Tiến sĩ");

  // 2. PHÒNG HỌC & CƠ SỞ VẬT CHẤT VMU (Nhà A6, A1, C1, Giảng đường mô phỏng)
  const roomDefs = [
    { code: "A6-203", name: "Phòng Hội thảo Sau đại học - Nhà A6", capacity: 50 },
    { code: "A6-204", name: "Phòng học Sau đại học 1 - Nhà A6", capacity: 40 },
    { code: "A6-205", name: "Phòng học Sau đại học 2 - Nhà A6", capacity: 40 },
    { code: "A1-301", name: "Giảng đường Đa năng A1", capacity: 60 },
    { code: "C1-LAB", name: "Phòng Lab & AI Thực hành CNTT - Nhà C1", capacity: 45 },
    { code: "HH-SIM", name: "Phòng Mô phỏng Điều động & Khai thác Hàng hải", capacity: 35 },
    { code: "CK-LAB", name: "Phòng TN Động lực & Tự động thủy khí", capacity: 35 },
    { code: "TDH-302", name: "Phòng Thực hành Tự động hóa & PLC", capacity: 35 },
  ];

  const rooms: Record<string, any> = {};
  for (const r of roomDefs) {
    const [room] = await M.Room.findOrCreate({
      where: { code: r.code },
      defaults: { ...r, isActive: true },
    });
    await room.update({ name: r.name, capacity: r.capacity, isActive: true });
    rooms[r.code] = room;
  }
  log("Phòng học / Giảng đường", `${Object.keys(rooms).length} phòng tại VMU (Nhà A6, A1, C1...)`);

  // 3. DANH MỤC NGÀNH ĐÀO TẠO (DISCIPLINES) CHUẨN BỘ GD&ĐT TẠI VMU
  const disciplineDefs = [
    // Bậc Thạc sĩ (Mã 8xxxxxx)
    { code: "8840106", name: "Khoa học hàng hải", sortOrder: 1 },
    { code: "8840103", name: "Tổ chức và Quản lý vận tải", sortOrder: 2 },
    { code: "8340101", name: "Quản trị kinh doanh", sortOrder: 3 },
    { code: "8310110", name: "Quản lý kinh tế", sortOrder: 4 },
    { code: "8520116", name: "Kỹ thuật cơ khí động lực", sortOrder: 5 },
    { code: "8520216", name: "Kỹ thuật điều khiển và Tự động hóa", sortOrder: 6 },
    { code: "8520203", name: "Kỹ thuật điện tử", sortOrder: 7 },
    { code: "8580202", name: "Kỹ thuật xây dựng công trình thủy", sortOrder: 8 },
    { code: "8580201", name: "Kỹ thuật xây dựng", sortOrder: 9 },
    { code: "8520320", name: "Kỹ thuật môi trường", sortOrder: 10 },
    { code: "8480201", name: "Công nghệ thông tin", sortOrder: 11 },
    // Bậc Tiến sĩ (Mã 9xxxxxx)
    { code: "9840106", name: "Khoa học hàng hải (NCS)", sortOrder: 21 },
    { code: "9840103", name: "Tổ chức và Quản lý vận tải (NCS)", sortOrder: 22 },
    { code: "9520116", name: "Kỹ thuật cơ khí động lực (NCS)", sortOrder: 23 },
    { code: "9520216", name: "Kỹ thuật điều khiển và Tự động hóa (NCS)", sortOrder: 24 },
    { code: "9580202", name: "Kỹ thuật xây dựng công trình thủy (NCS)", sortOrder: 25 },
    { code: "9310110", name: "Quản lý kinh tế (NCS)", sortOrder: 26 },
    // Dùng chung
    { code: COMMON_DISCIPLINE_CODE, name: "Danh mục dùng chung", sortOrder: 999 },
  ];

  const disciplines: Record<string, any> = {};
  for (const d of disciplineDefs) {
    const [disp] = await M.Discipline.findOrCreate({
      where: { code: d.code },
      defaults: { ...d, active: true },
    });
    await disp.update({ name: d.name, sortOrder: d.sortOrder, active: true });
    disciplines[d.code] = disp;
  }
  log("Ngành đào tạo (Disciplines)", `${Object.keys(disciplines).length} ngành Thạc sĩ & Tiến sĩ`);

  // 4. DANH MỤC CHUYÊN NGÀNH ĐÀO TẠO (MAJORS)
  const majorDefs = [
    // Thạc sĩ
    { code: "KTHH", name: "Khai thác hàng hải", disciplineCode: "8840106", program: "masters", level: masterLevel },
    { code: "DKTB", name: "Điều khiển tàu biển", disciplineCode: "8840106", program: "masters", level: masterLevel },
    { code: "LOG", name: "Quản lý vận tải và Logistics", disciplineCode: "8840103", program: "masters", level: masterLevel },
    { code: "QTKD", name: "Quản trị kinh doanh", disciplineCode: "8340101", program: "masters", level: masterLevel },
    { code: "QLKT", name: "Quản lý kinh tế", disciplineCode: "8310110", program: "masters", level: masterLevel },
    { code: "QLTC", name: "Quản lý tài chính", disciplineCode: "8310110", program: "masters", level: masterLevel },
    { code: "KTTT", name: "Kỹ thuật tàu thủy", disciplineCode: "8520116", program: "masters", level: masterLevel },
    { code: "QLNL", name: "Quản lý năng lượng", disciplineCode: "8520116", program: "masters", level: masterLevel },
    { code: "TDH", name: "Kỹ thuật điều khiển và Tự động hóa", disciplineCode: "8520216", program: "masters", level: masterLevel },
    { code: "DTVT", name: "Kỹ thuật điện tử - viễn thông", disciplineCode: "8520203", program: "masters", level: masterLevel },
    { code: "XDCT", name: "Kỹ thuật xây dựng công trình thủy", disciplineCode: "8580202", program: "masters", level: masterLevel },
    { code: "QLDA", name: "Quản lý dự án đầu tư và xây dựng", disciplineCode: "8580201", program: "masters", level: masterLevel },
    { code: "KTMT", name: "Kỹ thuật môi trường", disciplineCode: "8520320", program: "masters", level: masterLevel },
    { code: "CNTT", name: "Công nghệ thông tin", disciplineCode: "8480201", program: "masters", level: masterLevel },
    // Tiến sĩ
    { code: "TS-KHHH", name: "Khoa học hàng hải (Tiến sĩ)", disciplineCode: "9840106", program: "doctoral", level: doctorLevel },
    { code: "TS-QLVT", name: "Tổ chức và Quản lý vận tải (Tiến sĩ)", disciplineCode: "9840103", program: "doctoral", level: doctorLevel },
    { code: "TS-CKDL", name: "Kỹ thuật cơ khí động lực (Tiến sĩ)", disciplineCode: "9520116", program: "doctoral", level: doctorLevel },
    { code: "TS-TDH", name: "Kỹ thuật điều khiển và Tự động hóa (Tiến sĩ)", disciplineCode: "9520216", program: "doctoral", level: doctorLevel },
    { code: "TS-CTTH", name: "Kỹ thuật xây dựng công trình thủy (Tiến sĩ)", disciplineCode: "9580202", program: "doctoral", level: doctorLevel },
    { code: "TS-QLKT", name: "Quản lý kinh tế (Tiến sĩ)", disciplineCode: "9310110", program: "doctoral", level: doctorLevel },
  ];

  const majors: Record<string, any> = {};
  for (const m of majorDefs) {
    const disp = disciplines[m.disciplineCode];
    if (!disp) continue;
    const [record] = await M.Major.findOrCreate({
      where: { name: m.name, program: m.program },
      defaults: {
        code: m.code,
        name: m.name,
        disciplineId: disp.id,
        trainingLevelId: m.level.id,
        program: m.program,
        durationYears: m.level.durationYears || 2,
        maxOvertimeYears: 2,
        active: true,
      },
    });
    await record.update({ code: m.code, disciplineId: disp.id, active: true });
    majors[m.code] = record;
  }
  log("Chuyên ngành (Majors)", `${Object.keys(majors).length} chuyên ngành đào tạo VMU`);

  // 5. BAN LÃNH ĐẠO VIỆN, CÁN BỘ & GIẢNG VIÊN CÁC KHOA VMU
  const lecturerDefs = [
    // Lãnh đạo Viện Đào tạo Sau đại học
    {
      code: "GV-SDH-01",
      name: "PGS.TS. Nguyễn Kim Phương",
      email: "phuongnk@vimaru.edu.vn",
      phone: "0903456789",
      academicRank: "Phó Giáo sư",
      academicDegree: "Tiến sĩ",
      teachingType: "Cơ hữu",
      title: "Viện trưởng",
      faculty: "Viện Đào tạo Sau đại học",
      department: "Bộ môn Phương pháp nghiên cứu",
    },
    {
      code: "GV-SDH-02",
      name: "TS. Lại Huy Thiện",
      email: "thienlh@vimaru.edu.vn",
      phone: "0903456790",
      academicRank: null,
      academicDegree: "Tiến sĩ",
      teachingType: "Cơ hữu",
      title: "Phó Viện trưởng",
      faculty: "Viện Đào tạo Sau đại học",
      department: "Bộ môn Lý luận chính trị",
    },
    {
      code: "GV-SDH-03",
      name: "ThS. Vũ Thị Hương",
      email: "huongvt@vimaru.edu.vn",
      phone: "0912111222",
      academicRank: null,
      academicDegree: "Thạc sĩ",
      teachingType: "Cơ hữu",
      title: "Chuyên viên QLĐT",
      faculty: "Viện Đào tạo Sau đại học",
      department: "Bộ môn Khoa học cơ bản",
    },
    {
      code: "GV-SDH-04",
      name: "ThS. Trần Thị Lan Anh",
      email: "lananhtt@vimaru.edu.vn",
      phone: "0912333444",
      academicRank: null,
      academicDegree: "Thạc sĩ",
      teachingType: "Cơ hữu",
      title: "Chuyên viên QLNCS",
      faculty: "Viện Đào tạo Sau đại học",
      department: "Bộ môn Khoa học cơ bản",
    },
    // Khoa Hàng hải
    {
      code: "GV-HH-01",
      name: "PGS.TS. Lê Văn Cường",
      email: "cuonglv@vimaru.edu.vn",
      phone: "0912456781",
      academicRank: "Phó Giáo sư",
      academicDegree: "Tiến sĩ",
      teachingType: "Cơ hữu",
      title: "Trưởng khoa",
      faculty: "Khoa Hàng hải",
      department: "Bộ môn Điều khiển tàu biển",
    },
    {
      code: "GV-HH-02",
      name: "TS. Đặng Hữu Bình",
      email: "binhdh@vimaru.edu.vn",
      phone: "0912456782",
      academicRank: null,
      academicDegree: "Tiến sĩ",
      teachingType: "Cơ hữu",
      title: "Trưởng bộ môn",
      faculty: "Khoa Hàng hải",
      department: "Bộ môn Khai thác hàng hải",
    },
    {
      code: "GV-HH-03",
      name: "TS. Trần Quang Minh",
      email: "minhtq@vimaru.edu.vn",
      phone: "0912456783",
      academicRank: null,
      academicDegree: "Tiến sĩ",
      teachingType: "Cơ hữu",
      title: "Giảng viên chính",
      faculty: "Khoa Hàng hải",
      department: "Bộ môn An toàn hàng hải",
    },
    // Khoa Kinh tế
    {
      code: "GV-KT-01",
      name: "PGS.TS. Phạm Xuân Dương",
      email: "duongpx@vimaru.edu.vn",
      phone: "0913567891",
      academicRank: "Phó Giáo sư",
      academicDegree: "Tiến sĩ",
      teachingType: "Cơ hữu",
      title: "Giảng viên cao cấp",
      faculty: "Khoa Kinh tế",
      department: "Bộ môn Quản lý kinh tế",
    },
    {
      code: "GV-KT-02",
      name: "TS. Phạm Thị Lan",
      email: "lanpt@vimaru.edu.vn",
      phone: "0913567892",
      academicRank: null,
      academicDegree: "Tiến sĩ",
      teachingType: "Cơ hữu",
      title: "Trưởng bộ môn",
      faculty: "Khoa Kinh tế",
      department: "Bộ môn Logistics",
    },
    {
      code: "GV-KT-03",
      name: "TS. Đặng Văn Tài",
      email: "taidv@vimaru.edu.vn",
      phone: "0913567893",
      academicRank: null,
      academicDegree: "Tiến sĩ",
      teachingType: "Cơ hữu",
      title: "Phó trưởng bộ môn",
      faculty: "Khoa Kinh tế",
      department: "Bộ môn Quản trị kinh doanh",
    },
    // Khoa Công nghệ thông tin
    {
      code: "GV-CNT-01",
      name: "PGS.TS. Trịnh Xuân Nam",
      email: "namtx@vimaru.edu.vn",
      phone: "0914678901",
      academicRank: "Phó Giáo sư",
      academicDegree: "Tiến sĩ",
      teachingType: "Cơ hữu",
      title: "Trưởng khoa",
      faculty: "Khoa Công nghệ thông tin",
      department: "Bộ môn Kỹ thuật máy tính",
    },
    {
      code: "GV-CNT-02",
      name: "TS. Phạm Văn Thành",
      email: "thanhpv@vimaru.edu.vn",
      phone: "0914678902",
      academicRank: null,
      academicDegree: "Tiến sĩ",
      teachingType: "Cơ hữu",
      title: "Trưởng bộ môn",
      faculty: "Khoa Công nghệ thông tin",
      department: "Bộ môn Công nghệ phần mềm",
    },
    {
      code: "GV-CNT-03",
      name: "TS. Đỗ Minh Đức",
      email: "ducdm@vimaru.edu.vn",
      phone: "0914678903",
      academicRank: null,
      academicDegree: "Tiến sĩ",
      teachingType: "Cơ hữu",
      title: "Trưởng bộ môn",
      faculty: "Khoa Công nghệ thông tin",
      department: "Bộ môn Hệ thống thông tin",
    },
    // Khoa Cơ khí
    {
      code: "GV-CK-01",
      name: "PGS.TS. Trần Anh Dũng",
      email: "dungta@vimaru.edu.vn",
      phone: "0915789011",
      academicRank: "Phó Giáo sư",
      academicDegree: "Tiến sĩ",
      teachingType: "Cơ hữu",
      title: "Trưởng khoa",
      faculty: "Khoa Cơ khí",
      department: "Bộ môn Kỹ thuật cơ khí",
    },
    {
      code: "GV-CK-02",
      name: "TS. Vũ Đức Trung",
      email: "trungvd@vimaru.edu.vn",
      phone: "0915789012",
      academicRank: null,
      academicDegree: "Tiến sĩ",
      teachingType: "Cơ hữu",
      title: "Trưởng bộ môn",
      faculty: "Khoa Cơ khí",
      department: "Bộ môn Động lực tàu thủy",
    },
    // Khoa Điện - Điện tử
    {
      code: "GV-DD-01",
      name: "PGS.TS. Hoàng Văn Khánh",
      email: "khanhhv@vimaru.edu.vn",
      phone: "0916890121",
      academicRank: "Phó Giáo sư",
      academicDegree: "Tiến sĩ",
      teachingType: "Cơ hữu",
      title: "Trưởng khoa",
      faculty: "Khoa Điện - Điện tử",
      department: "Bộ môn Tự động hóa",
    },
    {
      code: "GV-DD-02",
      name: "TS. Bùi Quang Huy",
      email: "huybq@vimaru.edu.vn",
      phone: "0916890122",
      academicRank: null,
      academicDegree: "Tiến sĩ",
      teachingType: "Cơ hữu",
      title: "Trưởng bộ môn",
      faculty: "Khoa Điện - Điện tử",
      department: "Bộ môn Kỹ thuật điện",
    },
    // Khoa Công trình
    {
      code: "GV-CT-01",
      name: "PGS.TS. Hoàng Văn Toàn",
      email: "toanhv@vimaru.edu.vn",
      phone: "0917901231",
      academicRank: "Phó Giáo sư",
      academicDegree: "Tiến sĩ",
      teachingType: "Cơ hữu",
      title: "Trưởng bộ môn",
      faculty: "Khoa Công trình",
      department: "Bộ môn Công trình thủy",
    },
    // Viện Môi trường
    {
      code: "GV-MT-01",
      name: "TS. Lê Thanh Tùng",
      email: "tunglt@vimaru.edu.vn",
      phone: "0918012341",
      academicRank: null,
      academicDegree: "Tiến sĩ",
      teachingType: "Cơ hữu",
      title: "Phó Viện trưởng",
      faculty: "Viện Môi trường",
      department: "Bộ môn Kỹ thuật môi trường",
    },
    // Khoa Ngoại ngữ
    {
      code: "GV-NN-01",
      name: "TS. Hoàng Minh Châu",
      email: "chauhvm@vimaru.edu.vn",
      phone: "0919123451",
      academicRank: null,
      academicDegree: "Tiến sĩ",
      teachingType: "Cơ hữu",
      title: "Trưởng khoa",
      faculty: "Khoa Ngoại ngữ",
      department: "Bộ môn Tiếng Anh chuyên ngành",
    },
  ];

  const lecturers: Record<string, any> = {};
  for (const l of lecturerDefs) {
    const [lec] = await M.Lecturer.findOrCreate({
      where: { code: l.code },
      defaults: { ...l, active: true },
    });
    await lec.update({ ...l, active: true });
    lecturers[l.code] = lec;
  }
  log("Giảng viên & Lãnh đạo Viện", `${Object.keys(lecturers).length} giảng viên cơ hữu VMU`);

  // 6. KẾ HOẠCH TUYỂN SINH, CHỈ TIÊU & BIỂU PHÍ (2024, 2025, 2026)
  const plans: Record<string, any> = {};
  for (const year of ["2024", "2025", "2026"]) {
    const [plan] = await M.TrainingPlan.findOrCreate({
      where: { code: `KH${year}` },
      defaults: {
        code: `KH${year}`,
        name: `Kế hoạch đào tạo Sau đại học năm ${year} (Khóa ${Number(year) - 1994})`,
        programId: progMaster.id,
        academicYear: year,
        startDate: `${year}-09-01`,
        endDate: `${Number(year) + 2}-09-30`,
        targetStudents: 150,
        status: year === "2024" ? "closed" : "active",
        note: `Kế hoạch tuyển sinh Thạc sĩ và Tiến sĩ năm ${year} - Viện ĐTSĐH VMU`,
      },
    });
    plans[year] = plan;

    // Biểu phí
    const fees = [
      { name: "Học phí học kỳ I", amount: 9500000, dueDate: `${year}-10-15`, note: "Học phí chuyên môn kỳ 1" },
      { name: "Lệ phí nhập học & Thẻ học viên", amount: 500000, dueDate: `${year}-09-15`, note: "Lệ phí thủ tục đầu vào" },
      { name: "Bảo hiểm y tế học viên", amount: 850000, dueDate: `${year}-10-15`, note: "BHYT năm học" },
      { name: "Kinh phí phản biện & bảo vệ luận văn", amount: 2500000, dueDate: `${Number(year) + 2}-05-30`, note: "Kinh phí hội đồng" },
    ];
    for (const f of fees) {
      await M.AnnualFee.findOrCreate({
        where: { planId: plan.id, name: f.name },
        defaults: { ...f, planId: plan.id },
      });
    }

    // Chỉ tiêu các ngành trọng điểm
    const quotaMap: Record<string, number> = { KTHH: 30, DKTB: 25, LOG: 35, QTKD: 40, CNTT: 30, TDH: 25 };
    for (const [mCode, quota] of Object.entries(quotaMap)) {
      const m = majors[mCode];
      if (!m) continue;
      await M.AdmissionTarget.findOrCreate({
        where: { planId: plan.id, majorId: m.id },
        defaults: { planId: plan.id, majorId: m.id, trainingModeId: cqMode.id, quota, note: `Chỉ tiêu ${m.name}` },
      });
    }
  }
  log("Kế hoạch & Biểu phí tuyển sinh", "Đã khởi tạo các năm 2024, 2025, 2026");

  // 7. ĐỢT XÉT TUYỂN (ADMISSION ROUNDS)
  const [round1] = await M.AdmissionRound.findOrCreate({
    where: { name: "Tuyển sinh Đợt 1 năm 2026", academicYear: "2026" },
    defaults: {
      name: "Tuyển sinh Đợt 1 năm 2026",
      academicYear: "2026",
      regulationNo: "Quy định số 315/QĐ-ĐHHHVN-SĐH",
      decisionNo: "482/QĐ-ĐHHHVN-SĐH",
      decisionDate: "2026-06-15",
      rules: { interviewWeight: 40, gpaWeight: 60, minTotalScore: 12 },
      majorThresholds: Object.values(majors).map((m: any) => ({ majorId: m.id, cutoff: 14.5 })),
    },
  });

  const [round2] = await M.AdmissionRound.findOrCreate({
    where: { name: "Tuyển sinh Đợt 2 năm 2026", academicYear: "2026" },
    defaults: {
      name: "Tuyển sinh Đợt 2 năm 2026",
      academicYear: "2026",
      regulationNo: "Quy định số 315/QĐ-ĐHHHVN-SĐH",
      decisionNo: "1025/QĐ-ĐHHHVN-SĐH",
      decisionDate: "2026-10-01",
      rules: { interviewWeight: 40, gpaWeight: 60, minTotalScore: 12 },
      majorThresholds: Object.values(majors).map((m: any) => ({ majorId: m.id, cutoff: 15.0 })),
    },
  });
  log("Đợt tuyển sinh & Điểm chuẩn", "Đợt 1 & Đợt 2 năm 2026");

  // 8. HỌC PHẦN (SUBJECTS) & CHƯƠNG TRÌNH KHUNG (CURRICULUMS)
  // Các ngành trọng điểm: KTHH, LOG, CNTT, QTKD
  const keyMajorCodes = ["KTHH", "LOG", "CNTT", "QTKD"];
  const curriculums: Record<string, any> = {};

  for (const majorCode of keyMajorCodes) {
    const major = majors[majorCode];
    if (!major) continue;

    // Tạo các CTĐT cho các năm 2024, 2025, 2026
    for (const year of ["2024", "2025", "2026"]) {
      const [curriculum] = await M.Curriculum.findOrCreate({
        where: { majorId: major.id, program: "masters", applicableFromYear: year },
        defaults: {
          code: `CT-${majorCode}-${year}`,
          name: `CTĐT Thạc sĩ ${major.name} - Khóa ${year}`,
          majorId: major.id,
          program: "masters",
          applicableFromYear: year,
          totalCredits: 60,
          active: true,
          note: `Khung chương trình chuẩn 60 tín chỉ ban hành theo Quyết định của Hiệu trưởng VMU`,
        },
      });
      curriculums[`${majorCode}-${year}`] = curriculum;

      // Khối kiến thức
      const blockDefs = [
        { code: "KC", name: "Kiến thức chung", sortOrder: 1 },
        { code: "CS", name: "Kiến thức cơ sở ngành", sortOrder: 2 },
        { code: "CN", name: "Kiến thức chuyên ngành", sortOrder: 3 },
        { code: "TC", name: "Học phần tự chọn", sortOrder: 4 },
        { code: "CH", name: "Thực tập & Luận văn tốt nghiệp", sortOrder: 5 },
      ];
      const blocks: Record<string, any> = {};
      for (const b of blockDefs) {
        const [block] = await M.CurriculumBlock.findOrCreate({
          where: { curriculumId: curriculum.id, code: b.code },
          defaults: { ...b, curriculumId: curriculum.id, minCredits: 0 },
        });
        blocks[b.code] = block;
      }

      // Danh sách học phần tiêu biểu của ngành
      let subjectSpecs: Array<{ code: string; codeNumber: number; name: string; credits: number; block: string; isRequired: boolean }> = [
        { code: `TRIET-${majorCode}`, codeNumber: 501, name: "Triết học (Sau đại học)", credits: 3, block: "KC", isRequired: true },
        { code: `TA-${majorCode}`, codeNumber: 502, name: "Tiếng Anh học thuật Sau đại học", credits: 3, block: "KC", isRequired: true },
        { code: `PPNC-${majorCode}`, codeNumber: 503, name: "Phương pháp nghiên cứu khoa học", credits: 2, block: "KC", isRequired: true },
      ];

      if (majorCode === "KTHH") {
        subjectSpecs.push(
          { code: "QTDTAU", codeNumber: 504, name: "Quản trị khai thác đội tàu", credits: 3, block: "CS", isRequired: true },
          { code: "THDLTT", codeNumber: 505, name: "Thủy động lực học tàu thủy nâng cao", credits: 3, block: "CS", isRequired: true },
          { code: "ATHHAI", codeNumber: 506, name: "An toàn hàng hải và Quản lý rủi ro", credits: 3, block: "CN", isRequired: true },
          { code: "SOLMAR", codeNumber: 507, name: "Công ước quốc tế SOLAS và MARPOL", credits: 2, block: "CN", isRequired: true },
          { code: "QTCANG", codeNumber: 508, name: "Quản trị và Khai thác cảng biển", credits: 3, block: "TC", isRequired: false },
          { code: "ISPSHH", codeNumber: 509, name: "An ninh hàng hải quốc tế (Bộ luật ISPS)", credits: 2, block: "TC", isRequired: false },
          { code: "LVTHS", codeNumber: 510, name: "Luận văn thạc sĩ Khai thác hàng hải", credits: 12, block: "CH", isRequired: true }
        );
      } else if (majorCode === "LOG") {
        subjectSpecs.push(
          { code: "LOGBIE", codeNumber: 504, name: "Logistics và Quản trị chuỗi cung ứng biển", credits: 3, block: "CS", isRequired: true },
          { code: "VTDPTH", codeNumber: 505, name: "Vận tải đa phương thức và Dịch vụ cảng", credits: 3, block: "CS", isRequired: true },
          { code: "KTVTB", codeNumber: 506, name: "Kinh tế và Thị trường vận tải biển", credits: 3, block: "CN", isRequired: true },
          { code: "BAOHIEM", codeNumber: 507, name: "Bảo hiểm hàng hải và Hợp đồng vận chuyển", credits: 2, block: "CN", isRequired: true },
          { code: "KHOBAI", codeNumber: 508, name: "Quản trị kho hàng và Trung tâm phân phối", credits: 3, block: "TC", isRequired: false },
          { code: "LOGXAN", codeNumber: 509, name: "Logistics xanh và Phát triển bền vững", credits: 2, block: "TC", isRequired: false },
          { code: "LVLOG", codeNumber: 510, name: "Luận văn thạc sĩ Logistics", credits: 12, block: "CH", isRequired: true }
        );
      } else if (majorCode === "CNTT") {
        subjectSpecs.push(
          { code: "CNPMNC", codeNumber: 504, name: "Công nghệ phần mềm tiên tiến", credits: 3, block: "CS", isRequired: true },
          { code: "CSDLNC", codeNumber: 505, name: "Hệ quản trị cơ sở dữ liệu phân tán & Big Data", credits: 3, block: "CS", isRequired: true },
          { code: "AIMLHH", codeNumber: 506, name: "Học máy và Ứng dụng AI trong Hàng hải", credits: 3, block: "CN", isRequired: true },
          { code: "ANMNCC", codeNumber: 507, name: "An ninh mạng và Bảo mật thông tin", credits: 3, block: "CN", isRequired: true },
          { code: "IOTBIE", codeNumber: 508, name: "Hệ thống IoT và Cảm biến thông minh", credits: 2, block: "TC", isRequired: false },
          { code: "DCLDDD", codeNumber: 509, name: "Điện toán đám mây và Kiến trúc Microservices", credits: 2, block: "TC", isRequired: false },
          { code: "LVCNTT", codeNumber: 510, name: "Luận văn thạc sĩ Công nghệ thông tin", credits: 12, block: "CH", isRequired: true }
        );
      } else if (majorCode === "QTKD") {
        subjectSpecs.push(
          { code: "QTCLNC", codeNumber: 504, name: "Quản trị chiến lược nâng cao", credits: 3, block: "CS", isRequired: true },
          { code: "QTTCNC", codeNumber: 505, name: "Quản trị tài chính doanh nghiệp hàng hải", credits: 3, block: "CS", isRequired: true },
          { code: "MKTQTE", codeNumber: 506, name: "Marketing quốc tế và Thương mại điện tử", credits: 3, block: "CN", isRequired: true },
          { code: "QTNLCC", codeNumber: 507, name: "Quản trị nguồn nhân lực chiến lược", credits: 2, block: "CN", isRequired: true },
          { code: "QTRRH", codeNumber: 508, name: "Quản trị rủi ro và Khủng hoảng doanh nghiệp", credits: 3, block: "TC", isRequired: false },
          { code: "KNST", codeNumber: 509, name: "Khởi nghiệp và Đổi mới sáng tạo", credits: 2, block: "TC", isRequired: false },
          { code: "LVQTKD", codeNumber: 510, name: "Luận văn thạc sĩ Quản trị kinh doanh", credits: 12, block: "CH", isRequired: true }
        );
      }

      for (const [idx, spec] of subjectSpecs.entries()) {
        const [subj] = await M.Subject.findOrCreate({
          where: { majorId: major.id, code: spec.code },
          defaults: {
            code: spec.code,
            codeText: spec.code.replace(/\d+$/, ""),
            codeNumber: spec.codeNumber,
            name: spec.name,
            majorId: major.id,
            program: "masters",
            credits: spec.credits,
            subjectType: spec.block,
            isRequired: spec.isRequired,
            majorAssignment: spec.code.startsWith("LV"),
            sortOrder: idx + 1,
            active: true,
          },
        });
        await subj.update({ name: spec.name, credits: spec.credits, isRequired: spec.isRequired, active: true });

        // Link vào CTĐT
        await M.CurriculumSubject.findOrCreate({
          where: { curriculumId: curriculum.id, subjectId: subj.id },
          defaults: {
            curriculumId: curriculum.id,
            blockId: blocks[spec.block]?.id || blocks.CN.id,
            subjectId: subj.id,
            isRequired: spec.isRequired,
            credits: spec.credits,
            sortOrder: idx + 1,
          },
        });
      }
    }
  }
  log("Chương trình khung (Curriculums)", "Đã tạo CTĐT 60 tín chỉ cho KTHH, LOG, CNTT, QTKD");

  // 9. LỚP HỌC (CLASS GROUPS) CHUẨN VMU
  const classDefs = [
    // Khai thác hàng hải
    { code: "CH-K31-KTHH", name: "Lớp ThS Khai thác hàng hải - Khóa 31", majorKey: "KTHH", year: "2025" },
    { code: "CH-K32-KTHH", name: "Lớp ThS Khai thác hàng hải - Khóa 32", majorKey: "KTHH", year: "2026" },
    // Quản lý vận tải & Logistics
    { code: "CH-K31-LOG", name: "Lớp ThS Logistics và Vận tải - Khóa 31", majorKey: "LOG", year: "2025" },
    { code: "CH-K32-LOG", name: "Lớp ThS Logistics và Vận tải - Khóa 32", majorKey: "LOG", year: "2026" },
    // Công nghệ thông tin
    { code: "CH-K31-CNTT", name: "Lớp ThS Công nghệ thông tin - Khóa 31", majorKey: "CNTT", year: "2025" },
    { code: "CH-K32-CNTT", name: "Lớp ThS Công nghệ thông tin - Khóa 32", majorKey: "CNTT", year: "2026" },
    // Quản trị kinh doanh
    { code: "CH-K31-QTKD", name: "Lớp ThS Quản trị kinh doanh - Khóa 31", majorKey: "QTKD", year: "2025" },
    { code: "CH-K32-QTKD", name: "Lớp ThS Quản trị kinh doanh - Khóa 32", majorKey: "QTKD", year: "2026" },
    // Tự động hóa & Tàu thủy
    { code: "CH-K32-TDH", name: "Lớp ThS Điều khiển & Tự động hóa - Khóa 32", majorKey: "TDH", year: "2026" },
    { code: "CH-K32-KTTT", name: "Lớp ThS Kỹ thuật tàu thủy - Khóa 32", majorKey: "KTTT", year: "2026" },
  ];

  const classGroups: Record<string, any> = {};
  for (const c of classDefs) {
    const major = majors[c.majorKey];
    const curr = curriculums[`${c.majorKey}-${c.year}`] || curriculums[`KTHH-${c.year}`];
    const [group] = await M.ClassGroup.findOrCreate({
      where: { code: c.code, program: "masters" },
      defaults: {
        code: c.code,
        name: c.name,
        majorId: major ? major.id : null,
        curriculumId: curr ? curr.id : null,
        academicYear: c.year,
        maxStudents: 35,
        status: "open",
        allowedWeekdays: [0, 6], // Học vào Thứ 7 và Chủ nhật
        note: `Lớp học Sau đại học khóa ${c.year} - Viện ĐTSĐH VMU`,
      },
    });
    await group.update({
      name: c.name,
      majorId: major ? major.id : null,
      curriculumId: curr ? curr.id : null,
      academicYear: c.year,
      status: "open",
    });
    classGroups[c.code] = group;
  }
  log("Lớp học (ClassGroups)", `${Object.keys(classGroups).length} lớp Thạc sĩ VMU (Khóa 31, 32)`);

  // 10. HỌC VIÊN MẪU (ADMISSION RECORDS) VÀ PHÂN LỚP
  const workplacesHP = [
    "Công ty Cổ phần Cảng Hải Phòng",
    "Tổng Công ty Hàng hải Việt Nam (VIMC) - Chi nhánh Hải Phòng",
    "Công ty Cổ phần Vận tải biển Việt Nam (VOSCO)",
    "Công ty Cổ phần Đại lý Hàng hải Việt Nam (VOSA Hải Phòng)",
    "Công ty Cổ phần Đầu tư và Phát triển Cảng Đình Vũ",
    "Cục Hải quan Thành phố Hải Phòng",
    "Ban Quản lý Khu kinh tế Hải Phòng (HEZA)",
    "Công ty Cổ phần Container Việt Nam (Viconship)",
    "Công ty TNHH LG Electronics Việt Nam Hải Phòng",
    "Công ty CP Đóng tàu Nam Triệu - SBIC",
    "Công ty CP Vận tải biển Vinaship",
    "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank) - CN Hải Phòng",
    "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV) - CN Hải Phòng",
    "Viettel Hải Phòng - Tập đoàn Công nghiệp - Viễn thông Quân đội",
    "Sở Giao thông Vận tải Hải Phòng",
    "Chi cục Đăng kiểm số 10 - Cục Đăng kiểm Việt Nam",
  ];

  const candidateNames = [
    { last: "Nguyễn Văn", first: "Thành", gender: "Nam", pob: "Hải Phòng", yob: 1996 },
    { last: "Trần Thị", first: "Mai", gender: "Nữ", pob: "Hải Phòng", yob: 1998 },
    { last: "Lê Hoàng", first: "Long", gender: "Nam", pob: "Quảng Ninh", yob: 1995 },
    { last: "Phạm Quốc", first: "Huy", gender: "Nam", pob: "Hải Phòng", yob: 1997 },
    { last: "Vũ Minh", first: "Đức", gender: "Nam", pob: "Hà Nội", yob: 1996 },
    { last: "Đỗ Thu", first: "Hà", gender: "Nữ", pob: "Hải Dương", yob: 1999 },
    { last: "Hoàng Đình", first: "Khánh", gender: "Nam", pob: "Hải Phòng", yob: 1994 },
    { last: "Bùi Thị", first: "Phương", gender: "Nữ", pob: "Thái Bình", yob: 1998 },
    { last: "Ngô Quang", first: "Dũng", gender: "Nam", pob: "Quảng Ninh", yob: 1995 },
    { last: "Đặng Thị", first: "Lan", gender: "Nữ", pob: "Hải Phòng", yob: 1997 },
    { last: "Nguyễn Đức", first: "Toàn", gender: "Nam", pob: "Nam Định", yob: 1996 },
    { last: "Trịnh Thị", first: "Hương", gender: "Nữ", pob: "Hải Phòng", yob: 1998 },
    { last: "Phan Văn", first: "An", gender: "Nam", pob: "Hà Nội", yob: 1995 },
    { last: "Vũ Thị", first: "Thảo", gender: "Nữ", pob: "Hải Phòng", yob: 1999 },
    { last: "Lê Văn", first: "Cường", gender: "Nam", pob: "Nghệ An", yob: 1994 },
    { last: "Phạm Thùy", first: "Dương", gender: "Nữ", pob: "Hải Phòng", yob: 1997 },
    { last: "Trần Bảo", first: "Ngọc", gender: "Nữ", pob: "Quảng Ninh", yob: 1998 },
    { last: "Đinh Xuân", first: "Trường", gender: "Nam", pob: "Hải Dương", yob: 1996 },
    { last: "Bùi Hải", first: "Nam", gender: "Nam", pob: "Hải Phòng", yob: 1995 },
    { last: "Hoàng Thị", first: "Yến", gender: "Nữ", pob: "Hà Nội", yob: 1999 },
  ];

  // Tạo các hồ sơ học viên phân bố qua các lớp
  let totalAdmitted = 0;
  let totalEnrolled = 0;

  for (const [classIdx, c] of classDefs.entries()) {
    const group = classGroups[c.code];
    const major = majors[c.majorKey];
    const plan = plans[c.year];
    const yearShort = c.year.slice(2);

    for (let i = 0; i < 6; i++) {
      const cand = candidateNames[(classIdx * 6 + i) % candidateNames.length];
      const seq = String(classIdx * 6 + i + 1).padStart(3, "0");
      const code = `HV${yearShort}-${c.majorKey}-${seq}`;
      const dob = `${cand.yob}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`;
      const workplace = workplacesHP[(classIdx + i) % workplacesHP.length];
      const isPaid = i < 5; // 5/6 người đã nộp học phí
      const isEnrolled = i < 4; // 4/6 người đã phân lớp, 1 người trúng tuyển đã nộp hp nhưng chưa phân lớp, 1 người trúng tuyển chưa nộp hp

      const studyStatus = isEnrolled ? "Đang học" : "Đã trúng tuyển";
      const paymentData = isPaid
        ? { paid: true, updatedAt: new Date().toISOString(), updatedBy: "PGS.TS. Nguyễn Kim Phương", updatedById: null }
        : { paid: false };

      const [record, wasCreated] = await M.AdmissionRecord.findOrCreate({
        where: { code },
        defaults: {
          code,
          lastName: cand.last,
          firstName: cand.first,
          fullName: `${cand.last} ${cand.first}`,
          dob,
          idCard: `031${cand.gender === "Nam" ? "0" : "1"}${String(cand.yob).slice(2)}${String(100000 + i * 11111)}`,
          gender: cand.gender,
          email: `${code.toLowerCase().replace(/-/g, ".")}@vimaru.edu.vn`,
          phone: `09${String(10000000 + classIdx * 100000 + i * 12345).padStart(8, "0")}`,
          pob: cand.pob,
          receiptType: "Trực tiếp",
          trainingLevel: "Thạc sĩ",
          trainingModeName: "Chính quy - Tập trung",
          majorId: major?.id || null,
          majorName: major?.name || "",
          academicYear: c.year,
          status: "approved",
          studyStatus,
          nationality: "Việt Nam",
          ethnicity: "Kinh",
          religion: "Không",
          city: "Thành phố Hải Phòng",
          workplace,
          job: cand.gender === "Nam" ? "Kỹ sư hàng hải" : "Chuyên viên quản lý",
          gradSchool: "Trường Đại học Hàng hải Việt Nam",
          gradMajor: major?.name || "Kỹ thuật",
          gradYear: String(cand.yob + 22),
          gpa: (7.5 + (i % 20) / 10).toFixed(1),
          gradClassification: i % 2 === 0 ? "Giỏi" : "Khá",
          extraData: { tuitionPayment: paymentData, seed: "VMU-SAMPLE-DATA" },
          planId: plan?.id || null,
        },
      });

      if (!wasCreated) {
        await record.update({
          majorId: major?.id || null,
          majorName: major?.name || "",
          academicYear: c.year,
          studyStatus,
          extraData: { tuitionPayment: paymentData, seed: "VMU-SAMPLE-DATA" },
        });
      }
      totalAdmitted++;

      // Ghi danh vào lớp (nếu isEnrolled)
      if (isEnrolled && group) {
        await M.ClassGroupMember.findOrCreate({
          where: { classGroupId: group.id, admissionRecordId: record.id },
          defaults: {
            classGroupId: group.id,
            admissionRecordId: record.id,
            enrolledAt: new Date(),
            note: "Phân lớp Sau đại học VMU",
          },
        });
        totalEnrolled++;
      }
    }
  }
  log("Hồ sơ học viên (Records)", `${totalAdmitted} học viên trúng tuyển, ${totalEnrolled} học viên đã phân lớp`);

  // 11. MỞ LỚP HỌC PHẦN (COURSE OFFERINGS) & LỊCH GIẢNG DẠY (TEACHING SESSIONS)
  // Mở lớp học phần mẫu cho Lớp CH-K32-KTHH và CH-K32-LOG
  const groupKTHH = classGroups["CH-K32-KTHH"];
  const groupLOG = classGroups["CH-K32-LOG"];

  const sampleOfferings = [
    {
      name: "Triết học Sau đại học (CH-K32)",
      subjectCode: "TRIET-KTHH",
      majorCode: "KTHH",
      lecturerCode: "GV-SDH-02", // TS. Lại Huy Thiện
      roomCode: "A6-203",
      dayOfWeek: 6, // Thứ 7
      period: "MORNING" as const,
      group: groupKTHH,
    },
    {
      name: "Tiếng Anh học thuật Sau đại học (CH-K32)",
      subjectCode: "TA-KTHH",
      majorCode: "KTHH",
      lecturerCode: "GV-NN-01", // TS. Hoàng Minh Châu
      roomCode: "A6-204",
      dayOfWeek: 0, // Chủ nhật
      period: "MORNING" as const,
      group: groupKTHH,
    },
    {
      name: "Phương pháp NCKH Sau đại học (CH-K32)",
      subjectCode: "PPNC-KTHH",
      majorCode: "KTHH",
      lecturerCode: "GV-SDH-01", // PGS.TS. Nguyễn Kim Phương
      roomCode: "A6-203",
      dayOfWeek: 6, // Thứ 7
      period: "AFTERNOON" as const,
      group: groupKTHH,
    },
    {
      name: "Quản trị khai thác đội tàu (CH-K32-KTHH)",
      subjectCode: "QTDTAU",
      majorCode: "KTHH",
      lecturerCode: "GV-HH-02", // TS. Đặng Hữu Bình
      roomCode: "HH-SIM",
      dayOfWeek: 0, // Chủ nhật
      period: "AFTERNOON" as const,
      group: groupKTHH,
    },
    {
      name: "Logistics và Chuỗi cung ứng biển (CH-K32-LOG)",
      subjectCode: "LOGBIE",
      majorCode: "LOG",
      lecturerCode: "GV-KT-02", // TS. Phạm Thị Lan
      roomCode: "A6-205",
      dayOfWeek: 6, // Thứ 7
      period: "MORNING" as const,
      group: groupLOG,
    },
  ];

  let offeringCount = 0;
  let sessionCount = 0;

  for (const off of sampleOfferings) {
    const major = majors[off.majorCode];
    if (!major) continue;
    const subj = await M.Subject.findOne({ where: { majorId: major.id, code: off.subjectCode } });
    const lec = lecturers[off.lecturerCode];
    const rm = rooms[off.roomCode];
    if (!subj || !lec || !rm) continue;

    const [offering] = await M.CourseOffering.findOrCreate({
      where: { subjectId: subj.id, name: off.name },
      defaults: {
        subjectId: subj.id,
        name: off.name,
        status: "active",
        gradebookStatus: "draft",
        gradebookVersion: 0,
        retakeWeekdays: [0, 6],
        note: "Lớp học phần chính thức Học kỳ 1 năm học 2026 - Viện ĐTSĐH VMU",
      },
    });
    offeringCount++;

    // Liên kết với lớp hành chính
    if (off.group) {
      await M.CourseOfferingClassGroup.findOrCreate({
        where: { courseOfferingId: offering.id, classGroupId: off.group.id },
        defaults: { courseOfferingId: offering.id, classGroupId: off.group.id },
      });
    }

    // Sinh 4 buổi học mẫu (2 buổi quá khứ, 2 buổi sắp tới)
    const anchor = new Date("2026-10-18");
    for (let w = -2; w <= 2; w++) {
      if (w === 0) continue;
      const sDate = new Date(anchor.getTime() + w * 7 * 86400000);
      // Điều chỉnh đúng thứ trong tuần
      const currentDay = sDate.getDay();
      const diff = off.dayOfWeek - currentDay;
      sDate.setDate(sDate.getDate() + diff);
      const sessionDateStr = sDate.toISOString().slice(0, 10);

      const isMorning = off.period === "MORNING";
      const [sess] = await M.TeachingSession.findOrCreate({
        where: { courseOfferingId: offering.id, sessionDate: sessionDateStr, period: off.period },
        defaults: {
          courseOfferingId: offering.id,
          sessionDate: sessionDateStr,
          startTime: isMorning ? "08:00:00" : "13:30:00",
          endTime: isMorning ? "11:30:00" : "17:00:00",
          period: off.period,
          lecturerId: lec.id,
          roomId: rm.id,
          status: w < 0 ? "held" : "planned",
          note: `Buổi học Sau đại học ngày ${sessionDateStr} tại ${rm.name}`,
        },
      });
      sessionCount++;
    }
  }
  log("Thời khóa biểu & Lịch học", `${offeringCount} lớp học phần, ${sessionCount} buổi giảng dạy`);

  console.log("=========================================================================");
  console.log("   HOÀN TẤT THÊM CƠ SỞ DỮ LIỆU MẪU VIỆN ĐÀO TẠO SAU ĐẠI HỌC VMU!        ");
  console.log("=========================================================================");

  await app.close();
}

run().catch((error) => {
  console.error("[VMU-SEED] LỖI:", error);
  process.exitCode = 1;
});
