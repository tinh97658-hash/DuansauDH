import { formatDate, formatDateTime, parseDisplayDate } from "../../utils/dateFormat";

it("formats ISO and legacy dates as dd/mm/yy, including date-time API values", () => {
  expect(formatDate("2026-10-17")).toBe("17/10/26");
  expect(formatDate("1995-06-18T00:00:00.000Z")).toBe("18/06/95");
  expect(formatDate("2/3/2001")).toBe("02/03/01");
  expect(formatDate(null)).toBe("—");
});

it("parses day first, checks leap days, and preserves the century of existing data", () => {
  expect(parseDisplayDate("17/10/26")).toBe("2026-10-17");
  expect(parseDisplayDate("18/06/95")).toBe("1995-06-18");
  expect(parseDisplayDate("18/06/95", "2095-01-01")).toBe("2095-06-18");
  expect(parseDisplayDate("18/06/2095")).toBe("2095-06-18");
  expect(parseDisplayDate("29/02/24")).toBe("2024-02-29");
  for (const date of ["29/02/25", "31/04/26", "10/17/26", "2026-02-30", "bad"]) {
    expect(parseDisplayDate(date)).toBe("");
  }
});

it("shows audit timestamps in Vietnam time with a short date", () => {
  expect(formatDateTime("2026-10-16T18:04:05Z")).toBe("17/10/26 01:04:05");
  expect(formatDateTime("bad")).toBe("—");
});
