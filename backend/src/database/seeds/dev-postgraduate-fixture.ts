import { createHash } from "node:crypto";

export const SEED_MARKER = "dev-postgraduate-admissions-v1";
export const YEAR_COUNTS = { "2024": 50, "2025": 70, "2026": 90 } as const;
export type SeedMajor = { id: string; name: string; code: string; program: string; disciplineId: string };
export type SeedCatalog = { majors: SeedMajor[]; cities: string[]; ethnicities: string[]; nationalities: string[] };

function randomGenerator(seed: number) {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}
function stableId(key: string) {
  const hex = createHash("sha256").update(key).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
const surnames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Đỗ", "Phan", "Ngô", "Dương", "Đinh", "Hồ", "Võ", "Lý", "Đoàn", "Trịnh", "Mai", "Tạ"];
const maleNames = ["Quốc Huy", "Hoàng Nam", "Đức Anh", "Minh Tuấn", "Quang Huy", "Gia Bảo", "Trung Kiên", "Hữu Phúc", "Mạnh Cường", "Tuấn Khải", "Thanh Tùng", "Đình Phong", "Anh Dũng", "Việt Hoàng", "Thành Đạt"];
const femaleNames = ["Minh Anh", "Thu Trang", "Ngọc Mai", "Thanh Hà", "Khánh Linh", "Thảo Nguyên", "Quỳnh Hoa", "Bảo Ngọc", "Hồng Nhung", "Mai Phương", "Thùy Dương", "Hải Yến", "Phương Thảo", "Ngọc Hân", "Lan Chi"];

export function buildAdmissions(catalog: SeedCatalog, seed = 20261018) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295) throw new Error("SEED_RANDOM must be a uint32 integer.");
  const majors = [...catalog.majors].sort((a, b) => a.id.localeCompare(b.id));
  if (!majors.length || majors.some((major) => !major.disciplineId || !["masters", "doctoral"].includes(major.program))) {
    throw new Error("DEV DATA: no valid active postgraduate majors with disciplines; catalog will not be invented.");
  }
  if (!catalog.cities.length || !catalog.ethnicities.length || !catalog.nationalities.length) {
    throw new Error("DEV DATA: existing active cities/ethnicities/nationalities are required.");
  }
  const random = randomGenerator(seed);
  const pick = <T>(rows: T[]) => rows[Math.floor(random() * rows.length)];
  const names = surnames.flatMap((surname) => [
    ...maleNames.map((name) => ({ fullName: `${surname} ${name}`, gender: "Nam" })),
    ...femaleNames.map((name) => ({ fullName: `${surname} ${name}`, gender: "Nữ" })),
  ]);
  for (let index = names.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [names[index], names[target]] = [names[target], names[index]];
  }
  // Ensure every major gets coverage, with larger cohorts in two deterministic focus majors.
  // Default 2026 has ~25 learners in each focus major: enough for 2–3 staff-created small groups.
  const focus = majors.filter((major) => major.program === "masters").slice(0, 2);
  const weighted = [...majors, ...Array.from({ length: 6 }, () => focus).flat()];
  const records: any[] = [];
  for (const [year, count] of Object.entries(YEAR_COUNTS)) {
    for (let index = 0; index < count; index++) {
      const sequence = records.length + 1;
      const major = index < majors.length ? majors[index] : pick(weighted);
      const person = names[sequence - 1];
      const split = person.fullName.lastIndexOf(" ");
      const birthYear = 1984 + Math.floor(random() * 17);
      const city = pick(catalog.cities);
      const day = String(1 + Math.floor(random() * 27)).padStart(2, "0");
      const month = String(1 + Math.floor(random() * 8)).padStart(2, "0");
      const submittedAt = new Date(`${year}-${month}-${day}T02:00:00.000Z`);
      records.push({
        id: stableId(`${SEED_MARKER}:${seed}:${year}:${index}`),
        // Admission codes are optional manual input in PlanService/UI; no automatic generator exists.
        // Leave the field for staff rather than fabricate an institutional learner-code convention.
        code: null, fullName: person.fullName, lastName: person.fullName.slice(0, split),
        firstName: person.fullName.slice(split + 1), gender: person.gender,
        dob: `${birthYear}-${month}-${day}`,
        email: `hoso.${year}.${String(index + 1).padStart(3, "0")}@example.invalid`,
        phone: `000${String(sequence).padStart(7, "0")}`,
        idCard: null, // Optional: avoid plausible government identifiers.
        majorId: major.id, majorName: major.name,
        trainingLevel: major.program === "masters" ? "Thạc sĩ" : "Tiến sĩ",
        academicYear: year, studentId: null, planId: null,
        status: "pending", studyStatus: "Nộp hồ sơ đầu vào",
        receiptType: index % 3 ? "Trực tuyến" : "Trực tiếp",
        nationality: catalog.nationalities.includes("Việt Nam") ? "Việt Nam" : catalog.nationalities[0],
        ethnicity: index % 10 && catalog.ethnicities.includes("Kinh") ? "Kinh" : pick(catalog.ethnicities),
        religion: "Không", city, pob: city, ward: `Số ${12 + index}, đường Hoa Ban (địa chỉ giả lập)`,
        gradSchool: pick(["Trường Đại học Hàng hải Việt Nam", "Trường Đại học Hải Phòng", "Trường Đại học Kinh tế Quốc dân"]),
        gradMajor: major.name, gradYear: String(birthYear + 23), gradDegreeType: "Chính quy",
        gpa: (6.8 + Math.floor(random() * 24) / 10).toFixed(1),
        gradClassification: index % 4 === 0 ? "Giỏi" : "Khá", priorityObject: "Không",
        documents: {}, submittedAt, createdAt: submittedAt, updatedAt: submittedAt,
        note: "Dữ liệu giả lập phục vụ kiểm thử quy trình Sau đại học trên máy phát triển.",
        extraData: { seed: SEED_MARKER, seedRandom: seed, localOnly: true },
      });
    }
  }
  return records;
}

export function summarizeAdmissions(records: any[], majors: SeedMajor[]) {
  return {
    total: records.length,
    byYear: Object.fromEntries(Object.keys(YEAR_COUNTS).map((year) => {
      const rows = records.filter((row) => row.academicYear === year);
      return [year, { admissions: rows.length, majors: new Set(rows.map((row) => row.majorId)).size }];
    })),
    byMajor: majors.map((major) => ({ ...major, total: records.filter((row) => row.majorId === major.id).length,
      years: Object.fromEntries(Object.keys(YEAR_COUNTS).map((year) => [year, records.filter((row) => row.majorId === major.id && row.academicYear === year).length])) })),
    names: records.slice(0, 10).map((row) => row.fullName),
    initialStatus: "pending / Nộp hồ sơ đầu vào", tuition: "Not confirmed; tuition is a separate post-admission step.",
  };
}
