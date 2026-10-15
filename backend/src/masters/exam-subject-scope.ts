import { Curriculum } from "../database/models/plan/curriculum.model.js";
import { CurriculumSubject } from "../database/models/plan/curriculum-subject.model.js";
import { Subject } from "../database/models/plan/subject.model.js";

// Match a shared offering to its explicitly linked cohort's local curriculum subject.
// SQL expressions here come from application code, never request values.
export function matchesExamSubjectSql(source: string, target: string, offering: string, group: string) {
  return `(COALESCE(${target}.canonical_subject_id, ${target}.id) = COALESCE(${source}.canonical_subject_id, ${source}.id)
    OR ((${source}.allow_cross_major OR cardinality(${source}.shared_major_ids) > 0)
      AND LOWER(TRIM(${target}.name)) = LOWER(TRIM(${source}.name))
      AND ${target}.credits = ${source}.credits AND ${target}.program = ${source}.program
      AND EXISTS (SELECT 1 FROM course_offering_class_groups subject_link
        WHERE subject_link.course_offering_id::text = ${offering}::text AND subject_link.class_group_id = ${group})))`;
}

export const examCurriculumInclude = {
  model: Curriculum, as: "curriculum", attributes: ["id"],
  include: [{ model: CurriculumSubject, as: "subjectEntries", attributes: ["subjectId"],
    include: [{ model: Subject, as: "subject", attributes: ["id", "code", "name", "credits", "majorId", "canonicalSubjectId"],
      where: { program: "masters" }, required: true }] }],
};

const normalizedName = (name: string) => String(name || "").normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");

// An offering is already explicitly linked to the group. Resolve its local CTDT
// entry without assuming that shared classes use the same subject code.
export function examSubjectForGroup(group: any, subject: any) {
  const entries = (group.curriculum?.subjectEntries || []).map((entry: any) => entry.subject).filter(Boolean);
  const root = subject.canonicalSubjectId || subject.id;
  const matches = entries.filter((entry: any) => entry.id === subject.id
    || (entry.canonicalSubjectId || entry.id) === root
    || (normalizedName(entry.name) === normalizedName(subject.name) && Number(entry.credits) === Number(subject.credits)));
  return matches.find((entry: any) => entry.majorId === group.majorId)
    || matches.find((entry: any) => entry.id === subject.id) || matches[0] || subject;
}
