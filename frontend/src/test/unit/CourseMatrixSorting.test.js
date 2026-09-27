import { sortCourseOfferings } from "../../features/scheduling/CourseMatrix";

const offering = (id, name, status, totalCount, firstPlannedSessionDate = null) => ({
  id,
  status,
  subject: { id: `subject-${id}`, name },
  sessionSummary: { totalCount, firstPlannedSessionDate },
});

it("orders course offerings by schedule state, nearest date, then Vietnamese subject name", () => {
  const rows = [
    offering("completed-triet", "Triết học", "completed", 3),
    offering("scheduled-far", "Cơ sở dữ liệu", "active", 2, "2026-10-01"),
    offering("unscheduled-triet", "Triết học", "active", 0),
    offering("completed-an", "An toàn thông tin", "completed", 4),
    offering("scheduled-near", "Toán cao cấp", "active", 1, "2026-09-13"),
    offering("unscheduled-an", "An toàn hàng hải", "active", 0),
  ];

  expect(sortCourseOfferings(rows, "2026-09-12").map((item) => item.id)).toEqual([
    "unscheduled-an",
    "unscheduled-triet",
    "scheduled-near",
    "scheduled-far",
    "completed-an",
    "completed-triet",
  ]);
});

it("puts scheduled offerings without a planned date after dated offerings", () => {
  const rows = [
    offering("without-date", "An toàn thông tin", "active", 2),
    offering("with-date", "Triết học", "active", 1, "2026-09-14"),
  ];

  expect(sortCourseOfferings(rows, "2026-09-12").map((item) => item.id)).toEqual([
    "with-date",
    "without-date",
  ]);
});
