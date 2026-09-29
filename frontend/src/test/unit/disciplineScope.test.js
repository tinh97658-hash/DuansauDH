import { disciplinesFromMajors, majorsForDiscipline } from "../../utils/disciplineScope";

const majors = [
  { id: "major-1", name: "Chuyên ngành 1", disciplineId: "discipline-1", discipline: { id: "discipline-1", code: "N1", name: "Ngành 1" } },
  { id: "major-2", name: "Chuyên ngành 2", disciplineId: "discipline-2", discipline: { id: "discipline-2", code: "N2", name: "Ngành 2" } },
];

describe("disciplineScope", () => {
  it("keeps every major selectable when no discipline is selected", () => {
    expect(majorsForDiscipline(majors, "")).toEqual(majors);
  });

  it("filters majors only after a discipline is selected", () => {
    expect(majorsForDiscipline(majors, "discipline-2")).toEqual([majors[1]]);
    expect(disciplinesFromMajors(majors)).toHaveLength(2);
  });
});
