// Synthetic fixtures for transcript validation; no application data is written.
export const transcriptScorecardFixture = {
  student: { participantId: "admission:ar1", admissionRecordId: "ar1", code: "HV001", fullName: "Nguyễn Văn An",
    dob: "1990-01-02", pob: "Hải Phòng", major: { name: "Công nghệ thông tin" }, academicYear: "2025",
    admissionDate: "2025-09-01", trainingLevel: "Thạc sĩ", trainingModeName: "Định hướng nghiên cứu",
    trainingModeGroup: "Chính quy", language: "Tiếng Việt", durationYears: null, masterDiplomaNumber: null,
    diplomaNumber: "UNDERGRAD-NOT-A-MASTERS-DEGREE" },
  group: { id: "g1", code: "CNTT2025.1.1", name: "Lớp Công nghệ thông tin" }, curriculum: { name: "CTĐT Công nghệ thông tin" },
  subjects: [
    { id: "hp1", code: "HP01", name: "Triết học", credits: 5, grade: { score: 0, result: "failed" } },
    { id: "hp2", code: "HP02", name: "Phương pháp nghiên cứu khoa học và ứng dụng các mô hình phân tích dữ liệu trong quản lý vận tải và chuỗi cung ứng hàng hải", credits: 3, grade: null },
    { id: "hp3", code: "HP03", name: "Ngoại ngữ", credits: 2, grade: { score: null, result: "exempt", details: { source: "gradebook" } } },
    { id: "hp4", code: "HP04", name: "Phân tích dữ liệu", credits: 4, grade: { score: 8, result: "exempt", details: { source: "recognition" } } },
  ],
};

export const longTranscriptScorecardFixture = {
  ...transcriptScorecardFixture,
  student: { ...transcriptScorecardFixture.student, code: "HV002",
    fullName: "Nguyễn Thị Hoàng Phương Thanh Bảo Ngọc Minh Anh", pob: "Phường Hồng Bàng, thành phố Hải Phòng",
    major: { name: "Quản lý vận tải và chuỗi cung ứng hàng hải quốc tế" } },
  subjects: [...transcriptScorecardFixture.subjects,
    ...Array.from({ length: 24 }, (_, index) => ({ id: `extra${index}`, code: `QL${500 + index}`,
      name: `Học phần ${index + 5}: Quản trị vận hành và nghiên cứu ứng dụng trong chuỗi cung ứng hàng hải quốc tế`,
      credits: 3, grade: { score: 7.5, result: "passed" } })),
  ],
};

export const officialTranscriptScorecardFixture = {
  ...transcriptScorecardFixture,
  subjects: [
    transcriptScorecardFixture.subjects[0],
    { ...transcriptScorecardFixture.subjects[1], name: "Các hệ thống mã nguồn mở và di động nâng cao" },
    { ...transcriptScorecardFixture.subjects[2], name: "Các phương pháp phân tích thiết kế phần mềm tiên tiến" },
    transcriptScorecardFixture.subjects[3],
    ...Array.from({ length: 18 }, (_, index) => ({ id: `compact${index}`, code: `CN${700 + index}`,
      name: `Học phần ứng dụng nâng cao ${index + 5}`, credits: 3, grade: { score: 7.5, result: "passed" } })),
  ],
};

export const missingMetadataTranscriptFixture = {
  ...officialTranscriptScorecardFixture,
  student: { participantId: "admission:ar3", admissionRecordId: "ar3", code: "HV003", fullName: "Học viên kiểm tra thiếu thông tin" },
};

// Dedicated geometry gate: 20 one-line courses and two names that wrap in both
// Times New Roman and the retained PDF serif, with real presentation edge cases.
export const hardSpecTranscriptScorecardFixture = {
  ...officialTranscriptScorecardFixture,
  subjects: officialTranscriptScorecardFixture.subjects.map((subject, index) => ({
    ...subject,
    name: index === 1 ? "Các hệ thống mã nguồn mở và di động nâng cao trong thực tiễn"
      : index === 2 ? "Các phương pháp phân tích thiết kế phần mềm tiên tiến và ứng dụng" : subject.name,
    grade: index < 4 || index === 8 || index === 12 ? subject.grade : null,
  })),
};

// Visual QA data from the supplied document; never used by production.
export const referenceTranscriptScorecardFixture = {
  student: { code: "QA-REFERENCE", fullName: "Vũ Minh Dũng", dob: "2002-09-11", pob: "Hải Phòng",
    major: { name: "Công nghệ thông tin" }, academicYear: "2025-2027", admissionDate: "2025-03-26",
    trainingLevel: "Thạc sĩ", trainingModeName: "Ứng dụng", trainingModeGroup: "Chính quy",
    durationYears: "02", language: "Tiếng Việt", masterDiplomaNumber: null },
  subjects: [
  {
    "id": "ref1",
    "name": "An toàn bảo mật thông tin nâng cao",
    "code": "ITIS 515",
    "credits": 2,
    "grade": {
      "score": "8.9",
      "result": "pending"
    }
  },
  {
    "id": "ref2",
    "name": "Các hệ thống mã nguồn mở và di động nâng cao",
    "code": "ITOS 532",
    "credits": 2,
    "grade": null
  },
  {
    "id": "ref3",
    "name": "Các phương pháp phân tích thiết kế phần mềm tiên tiến",
    "code": "ITMA 504",
    "credits": 2,
    "grade": null
  },
  {
    "id": "ref4",
    "name": "Công nghệ Chuỗi khối",
    "code": "ITBT 531",
    "credits": 2,
    "grade": {
      "score": "9.0",
      "result": "pending"
    }
  },
  {
    "id": "ref5",
    "name": "Điện toán đám mây nâng cao",
    "code": "ITCC 527",
    "credits": 2,
    "grade": null
  },
  {
    "id": "ref6",
    "name": "Hệ cơ sở tri thức nâng cao",
    "code": "ITKB 513",
    "credits": 2,
    "grade": {
      "score": "7.8",
      "result": "pending"
    }
  },
  {
    "id": "ref7",
    "name": "Học máy nâng cao",
    "code": "ITML 525",
    "credits": 2,
    "grade": null
  },
  {
    "id": "ref8",
    "name": "Học sâu nâng cao",
    "code": "ITDL 524",
    "credits": 2,
    "grade": null
  },
  {
    "id": "ref9",
    "name": "Kiểm thử và đảm bảo chất lượng phần mềm",
    "code": "ITTQ 526",
    "credits": 2,
    "grade": null
  },
  {
    "id": "ref10",
    "name": "Kiến trúc máy tính tiên tiến nâng cao",
    "code": "ITCA 508",
    "credits": 2,
    "grade": {
      "score": "8.3",
      "result": "pending"
    }
  },
  {
    "id": "ref11",
    "name": "Nguyên lí các ngôn ngữ lập trình nâng cao",
    "code": "ITPP 507",
    "credits": 2,
    "grade": {
      "score": "8.0",
      "result": "pending"
    }
  },
  {
    "id": "ref12",
    "name": "Phân tích dữ liệu lớn nâng cao",
    "code": "ITBD 534",
    "credits": 2,
    "grade": null
  },
  {
    "id": "ref13",
    "name": "Phương pháp nghiên cứu khoa học",
    "code": "ITKH 503",
    "credits": 2,
    "grade": null
  },
  {
    "id": "ref14",
    "name": "Quản trị dự án công nghệ thông tin nâng cao",
    "code": "ITPM 514",
    "credits": 2,
    "grade": null
  },
  {
    "id": "ref15",
    "name": "Siêu dữ liệu nâng cao",
    "code": "ITDT 520",
    "credits": 2,
    "grade": null
  },
  {
    "id": "ref16",
    "name": "Thị giác máy tính nâng cao",
    "code": "ITCV 516",
    "credits": 2,
    "grade": null
  },
  {
    "id": "ref17",
    "name": "Thực tập chuyên ngành",
    "code": "ITTN 598",
    "credits": 7,
    "grade": null
  },
  {
    "id": "ref18",
    "name": "Tiếng Anh",
    "code": "HPTA 502",
    "credits": 3,
    "grade": {
      "score": "8.3",
      "result": "pending"
    }
  },
  {
    "id": "ref19",
    "name": "Trí tuệ nhân tạo nâng cao",
    "code": "ITAI 510",
    "credits": 2,
    "grade": null
  },
  {
    "id": "ref20",
    "name": "Triết học",
    "code": "HPTH 501",
    "credits": 3,
    "grade": {
      "score": "9.0",
      "result": "pending"
    }
  },
  {
    "id": "ref21",
    "name": "Tương tác người- máy nâng cao",
    "code": "ITHC 529",
    "credits": 2,
    "grade": null
  },
  {
    "id": "ref22",
    "name": "Xử lý ngôn ngữ tự nhiên nâng cao",
    "code": "ITNL 533",
    "credits": 2,
    "grade": {
      "score": "7.8",
      "result": "pending"
    }
  }
]
};
