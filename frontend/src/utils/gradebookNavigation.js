import { gradePayload } from "../features/exams/gradebook";

// Compare persisted values, including raw scores, rather than input formatting.
export function hasGradeChanges(saved, draft) {
  return !saved || JSON.stringify(gradePayload(saved)) !== JSON.stringify(gradePayload(draft));
}
