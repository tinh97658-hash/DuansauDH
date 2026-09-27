import {
  getProgramForTrainingLevel,
  getSelectableMajors,
  normalizeMajorsResponse,
  selectMajorForLevel,
} from "../../utils/majors";

const majors = [
  { id: "m2", name: "Điều khiển", program: "masters", active: true },
  { id: "d1", name: "Khoa học hàng hải", program: "doctoral", active: true },
  { id: "m1", name: "Công nghệ", program: "masters", active: false },
];

describe("major catalog helpers", () => {
  it.each([
    ["Thạc sĩ", "masters"],
    ["Tiến sĩ", "doctoral"],
    ["masters", "masters"],
    ["doctoral", "doctoral"],
  ])("maps training level %s to program %s", (level, program) => {
    expect(getProgramForTrainingLevel(level)).toBe(program);
  });

  it("normalizes wrapped API responses and sorts Vietnamese names", () => {
    expect(normalizeMajorsResponse({ data: majors }).map((major) => major.id)).toEqual(["m1", "m2", "d1"]);
  });

  it("only exposes active majors belonging to the selected level", () => {
    expect(getSelectableMajors(majors, "Thạc sĩ").map((major) => major.id)).toEqual(["m2"]);
    expect(getSelectableMajors(majors, "Tiến sĩ").map((major) => major.id)).toEqual(["d1"]);
  });

  it("keeps a valid selection and replaces an invalid cross-level selection", () => {
    expect(selectMajorForLevel(majors, "Thạc sĩ", "m2")?.id).toBe("m2");
    expect(selectMajorForLevel(majors, "Tiến sĩ", "m2")?.id).toBe("d1");
  });
});
