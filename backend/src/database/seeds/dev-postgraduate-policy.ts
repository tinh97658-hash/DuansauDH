/** Audited against migrations 001–060 and the live public-schema FK catalog.
 * New tables must be classified explicitly. Never infer delete permission from a FK.
 */
export const PRESERVED_TABLES = [
  "disciplines", "majors", "lecturers", "units", "ethnicities", "nationalities",
  "cities", "districts", "wards", "rooms", "training_levels", "training_modes",
  "training_mode_groups", "study_statuses", "training_programs", "subjects",
  "bridge_knowledge_subjects", "curriculums", "curriculum_blocks", "curriculum_subjects",
  "curriculum_elective_groups", "course_grading_policies", "shared_grading_rules",
  // Intake plans, quotas, fee definitions and admission rules are configuration, not payments/results.
  "training_plans", "admission_targets", "annual_fees", "admission_rounds",
  "staff", "sessions", "sequelize_meta",
  // Legacy catalog tables, if still present on an older installation.
  "subject_packages", "subject_package_subjects",
] as const;

export const LIFECYCLE_TABLES = [
  "admission_evaluation_history", "admission_evaluations", "admission_records",
  "masters_admission_scores", "masters_bridge_courses", "major_transfers",
  "subject_recognitions", "learner_subject_results", "study_leaves",
  "course_offering_withdrawals", "scheduling_retakes", "course_exam_gradebooks",
  "exam_results", "exam_eligibilities", "exam_sessions", "english_exam_scores",
  "english_exam_sessions", "english_certifications", "graduation_records",
  "graduation_defenses", "doctoral_admission_scores", "doctoral_thesis_topics",
  "doctoral_workshops", "doctoral_defenses", "doctoral_reviews", "teaching_sessions",
  "course_offering_students", "course_offering_class_groups", "course_offerings",
  "class_group_members", "class_group_electives", "class_groups", "staff_students",
  "submissions", "students",
] as const;

export type ForeignKey = {
  name: string; child: string; parent: string; childSchema: string; parentSchema: string; definition: string;
};

export function requireLocalDev(config: Record<string, any>, writing: boolean) {
  if (!["development", "test"].includes(config.NODE_ENV)) {
    throw new Error("DEV DATA: NODE_ENV must explicitly resolve to development or test; production is forbidden.");
  }
  let url: URL;
  try { url = new URL(config.DATABASE_URL); } catch { throw new Error("DEV DATA: invalid DATABASE_URL."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)
    || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("DEV DATA: only a loopback PostgreSQL database is allowed (no remote/shared/staging hosts).");
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  // pgsms: the audited repository Docker Compose development DB, published only on port 55432.
  const repositoryDevDb = database === "pgsms" && url.port === "55432";
  const namedDevDb = /(?:^|[_-])(dev|development|local|test)(?:$|[_-])/i.test(database);
  if (/prod|stag|shared/i.test(database) || !(repositoryDevDb || namedDevDb)
    || config.DATABASE_SSL === true || config.DATABASE_SSL === "true"
    || [...url.searchParams.keys()].length) {
    throw new Error("DEV DATA: database identity is not explicitly local/dev/test, or SSL/URL overrides are enabled.");
  }
  if (writing && config.CONFIRM_DEV_DATA_RESET !== "YES") {
    throw new Error("DEV DATA: aborting without CONFIRM_DEV_DATA_RESET=YES. Run --preview first.");
  }
  return { host: url.hostname, port: url.port || "5432", database, environment: config.NODE_ENV };
}

export function deletionOrder(tables: string[], foreignKeys: ForeignKey[]): string[] {
  const known = new Set<string>([...PRESERVED_TABLES, ...LIFECYCLE_TABLES]);
  const unknown = tables.filter((table) => !known.has(table));
  if (unknown.length) throw new Error(`DEV DATA: unclassified tables: ${unknown.join(", ")}. Audit before resetting.`);
  const deleting = new Set(tables.filter((table) => (LIFECYCLE_TABLES as readonly string[]).includes(table)));
  for (const key of foreignKeys) {
    if (key.parentSchema === "public" && deleting.has(key.parent)
      && (key.childSchema !== "public" || !deleting.has(key.child))) {
      throw new Error(`DEV DATA: preserved/external table references reset data: ${key.name}. Abort even for CASCADE/SET NULL.`);
    }
  }
  const edges = foreignKeys.filter((key) => key.childSchema === "public" && key.parentSchema === "public"
    && deleting.has(key.child) && deleting.has(key.parent));
  const result: string[] = [];
  while (deleting.size) {
    // Delete children first, including nullable and ON DELETE CASCADE relationships.
    const ready = [...deleting].filter((table) => !edges.some((key) => key.parent === table && deleting.has(key.child))).sort();
    if (!ready.length) throw new Error(`DEV DATA: cyclic lifecycle FK graph: ${[...deleting].join(", ")}. No constraints disabled.`);
    for (const table of ready) { result.push(table); deleting.delete(table); }
  }
  return result;
}
