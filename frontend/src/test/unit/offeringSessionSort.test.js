import { sortOfferingsByHeldSessions } from "../../features/scheduling/offeringSessionSort";

const offering = (id, name, heldCount, code = id) => Object.freeze({
  id, name, subject: { code }, sessionSummary: { heldCount, futurePlannedCount: 99 - heldCount },
});

it("sorts the displayed held count, retaining source order in default without mutating the dataset", () => {
  const source = Object.freeze([offering("A", "Lớp A", 5), offering("B", "Lớp B", 0),
    offering("C", "Lớp C", 2), offering("D", "Lớp D", 0)]);
  const ids = direction => sortOfferingsByHeldSessions(source, direction).map(row => row.id);
  expect(ids("asc")).toEqual(["B", "D", "C", "A"]);
  expect(ids("desc")).toEqual(["A", "C", "B", "D"]);
  expect(ids("default")).toEqual(["A", "B", "C", "D"]);
  expect(source.map(row => row.id)).toEqual(["A", "B", "C", "D"]);
});

it("breaks equal counts by Vietnamese title, then stable code and id in both directions", () => {
  const source = [offering("z", "Lớp Điện toán", 0), offering("a", "Lớp Dữ liệu", 0),
    offering("d", "LỚP AN TOÀN", 0, "B"), offering("c", "Lớp An toàn", 0, "A"),
    offering("b", "Lớp An toàn", 0, "A")];
  for (const direction of ["asc", "desc"]) {
    expect(sortOfferingsByHeldSessions(source, direction).map(row => row.id)).toEqual(["b", "c", "d", "a", "z"]);
    expect(sortOfferingsByHeldSessions([...source].reverse(), direction).map(row => row.id)).toEqual(["b", "c", "d", "a", "z"]);
  }
});
