import "reflect-metadata";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { QueryTypes } from "sequelize";
import { isDeepStrictEqual } from "node:util";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { environmentFiles, environmentSchema } from "../../config/configuration.js";
import { requireDevelopment } from "./scheduling-test-fixture.js";
import { catalogRows, limitations, TEST_MARKER, seedId, mbaMajorId, robotMajorId, subjectId, type SeedRow } from "./realistic-test-catalog.js";
import { scenarioRows, fixtureAnchor, classId, offeringId, learnerId } from "./realistic-test-fixture.js";
import { assertPreserved, auditForeignKeys, auditSchedule, databaseSnapshot } from "./realistic-test-audit.js";

async function run() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--preview" && !arg.startsWith("--anchor-date="))) throw new Error("Supported: --preview --anchor-date=YYYY-MM-DD. No reset/delete mode.");
  const preview = args.includes("--preview");
  const anchor = args.find(arg => arg.startsWith("--anchor-date="))?.slice(14) || fixtureAnchor;
  // Reuse the existing scheduling-test startup guard. No environment override or synchronize.
  await ConfigModule.forRoot({ envFilePath: environmentFiles, expandVariables: true, validate: config => {
    requireDevelopment(config.NODE_ENV ?? "development");
    const { value, error } = environmentSchema.validate(config);
    if (error) throw new Error("Invalid backend configuration");
    const url = new URL(value.DATABASE_URL);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Seed restricted to a loopback development database");
    return value;
  } });
  const [{ NestFactory }, { getConnectionToken }, { AppModule }, { SchedulingService }, { ExamGradebookService }, { CurriculumService }, { AdmissionEvaluationService }, { MajorTransferService }, { SubjectRecognitionService }] = await Promise.all([
    import("@nestjs/core"), import("@nestjs/sequelize"), import("../../app.module.js"), import("../../scheduling/scheduling.service.js"),
    import("../../masters/exam-gradebook.service.js"), import("../../plan/curriculum.service.js"), import("../../plan/admission-evaluation.service.js"),
    import("../../plan/major-transfer.service.js"), import("../../plan/subject-recognition.service.js"),
  ]);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const db = app.get<import("sequelize-typescript").Sequelize>(getConnectionToken());
    db.options.logging = false;
    requireDevelopment(app.get(ConfigService).get("NODE_ENV"));
    const before = await databaseSnapshot(db);
    console.log("BEFORE"); console.table(before.counts);
    const reference: SeedRow[] = [
      ...catalogRows(),
      { model: "TrainingModeGroup", reference: { code: "CQ" }, values: { id: seedId("mode-group"), code: "CQ", name: "Chính quy", active: true } },
      { model: "TrainingMode", reference: { code: "CQ_TT" }, values: { id: seedId("mode"), code: "CQ_TT", name: "Chính quy - Tập trung", groupId: seedId("mode-group"), active: true } },
    ];
    const rows = [...reference, ...scenarioRows(anchor)];
    const remap = new Map<string, string>();
    const resolve: any = (value: any): any => typeof value === "string" ? remap.get(value) || value : Array.isArray(value) ? value.map(resolve) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolve(item)])) : value;
    const report: any = { marker: TEST_MARKER, preview, anchor, before: before.counts, limitations, created: {}, skipped: {}, manifest: {} };
    const transaction = await db.transaction();
    let transactionEnded = false;
    try {
      await db.query("SELECT pg_advisory_xact_lock(21025), pg_advisory_xact_lock(20261007)", { transaction });
      for (const row of rows) {
        const model = db.models[row.model];
        if (!model) throw new Error(`Unknown current model ${row.model}`);
        const values = resolve(row.values);
        const unknown = Object.keys(values).filter(key => !model.getAttributes()[key]);
        if (unknown.length) throw new Error(`Unknown fields ${row.model}: ${unknown}`);
        const existing = row.reference
          ? await model.findAll({ where: resolve(row.reference), limit: 2, transaction })
          : [await model.findByPk(values.id, { transaction })].filter(Boolean);
        if (existing.length > 1) throw new Error(`Ambiguous reference ${row.model}/${values.id}`);
        if (existing.length) {
          const actual = existing[0].get({ plain: true }) as any;
          const keys = row.reference ? [...Object.keys(row.reference), "name", ...(row.model === "Subject" ? ["credits", "isRequired", "subjectType"] : [])] : Object.keys(values).filter(key => key.endsWith("Id") && key !== "id");
          for (const key of keys) if (!isDeepStrictEqual(actual[key] ?? null, values[key] ?? null)) throw new Error(`Existing ${row.model}/${actual.id} conflicts on ${key}; nothing overwritten`);
          if (!row.reference) {
            const hasMarker = [actual.code, actual.name, actual.note, actual.reason, actual.actor, actual.extraData?.seed].some(item => String(item || "").includes(TEST_MARKER));
            const linkOnly = ["AdmissionEvaluation", "CurriculumBlock", "CurriculumElectiveGroup", "CurriculumSubject", "ClassGroupMember", "ClassGroupElective", "CourseOfferingClassGroup", "CourseOfferingStudent", "CourseExamGradebook"].includes(row.model);
            if (!hasMarker && !linkOnly) throw new Error(`Seed ownership marker missing: ${row.model}/${actual.id}`);
          }
          remap.set(row.values.id, actual.id);
          report.skipped[row.model] = (report.skipped[row.model] || 0) + 1;
        } else {
          try { await model.create(values, { transaction, validate: true }); }
          catch (error) { throw new Error(`Insert ${row.model}/${values.code || values.id}: ${(error as any).parent?.message || (error as Error).message}`); }
          report.created[row.model] = (report.created[row.model] || 0) + 1;
        }
        (report.manifest[row.model] ||= []).push(resolve(row.values.id));
      }
      // scheduling_retakes is intentionally a SQL-only table in the current retake policy.
      const retake = resolve({ id: seedId("retake"), admissionRecordId: learnerId("OLD24-01"), subjectId: subjectId(mbaMajorId, "QLTK508"), sourceCourseOfferingId: offeringId("COMPLETED"), assignedCourseOfferingId: offeringId("RETAKE") });
      const [existingRetake] = await db.query<any>(`SELECT admission_record_id, subject_id, source_course_offering_id, assigned_course_offering_id FROM scheduling_retakes WHERE id=:id`, { type: QueryTypes.SELECT, replacements: retake, transaction });
      if (existingRetake) {
        if (existingRetake.admission_record_id !== retake.admissionRecordId || existingRetake.subject_id !== retake.subjectId || existingRetake.source_course_offering_id !== retake.sourceCourseOfferingId || existingRetake.assigned_course_offering_id !== retake.assignedCourseOfferingId) throw new Error("Retake identity collision; nothing overwritten");
        report.skipped.SchedulingRetake = 1;
      } else {
        await db.query(`INSERT INTO scheduling_retakes (id,admission_record_id,subject_id,source_course_offering_id,assigned_course_offering_id,created_at) VALUES (:id,:admissionRecordId,:subjectId,:sourceCourseOfferingId,:assignedCourseOfferingId,NOW())`, { replacements: retake, transaction });
        report.created.SchedulingRetake = 1;
      }
      for (const [model, ids] of Object.entries(report.manifest) as Array<[string, string[]]>) {
        const unique = [...new Set(ids)];
        if (await db.models[model].count({ where: { id: unique }, transaction }) !== unique.length) throw new Error(`Post-insert count mismatch ${model}`);
      }
      report.foreignKeys = await auditForeignKeys(db, transaction);
      report.relations = await auditSchedule(db, transaction);
      const staged = await databaseSnapshot(db, transaction);
      report.preservedRows = assertPreserved(before, staged);
      report.staged = staged.counts;
      if (preview) await transaction.rollback(); else await transaction.commit();
      transactionEnded = true;
    } catch (error) { if (!transactionEnded) await transaction.rollback(); throw error; }
    const after = await databaseSnapshot(db);
    assertPreserved(before, after);
    report.after = after.counts;
    if (preview && !isDeepStrictEqual(before.counts, after.counts)) throw new Error("Preview rollback count mismatch");
    if (!preview) {
      // Read through the same services as the authenticated GET endpoints; no admin/session mutation.
      const scheduling = app.get(SchedulingService);
      const curriculum = app.get(CurriculumService);
      const scope = { program: "masters", majorId: resolve(mbaMajorId), academicYear: "2026" };
      const candidates = await scheduling.listCourseOfferingCandidates(scope);
      const progress = await scheduling.getClassCurriculumProgress(scope);
      const historicalProgress = await scheduling.getClassCurriculumProgress({ ...scope, academicYear: "2024" });
      const progressStates = [...new Set([...progress.classes, ...historicalProgress.classes].flatMap(group => group.subjects.map(subject => subject.status)))];
      const book = await app.get(ExamGradebookService).get({ classGroupId: resolve(classId("LONG")), courseOfferingId: resolve(offeringId("ROBOT-B")), page: 1, pageSize: 15 });
      const mbaCurricula = (await curriculum.list(resolve(mbaMajorId), "masters")).filter(item => item.applicableFromYear === "2026");
      const robotCurricula = (await curriculum.list(resolve(robotMajorId), "masters")).filter(item => item.applicableFromYear === "2026");
      const evaluation = await app.get(AdmissionEvaluationService).detail(resolve(learnerId("AT-PENDING")));
      const transfers = await app.get(MajorTransferService).list(resolve(learnerId("TRANSFER")));
      const recognition = app.get(SubjectRecognitionService);
      const recognizedCredits = await recognition.recognizedCredits(resolve(learnerId("RECOGNITION")));
      report.serviceChecks = { candidateSubjects: candidates.subjects.length, progressStates, gradebookTotal: book.totalRows, gradebookPageLength: book.rows.length,
        mbaCurricula2026: mbaCurricula.length, robotCurricula2026: robotCurricula.length, thresholdResult: evaluation.evaluation?.result,
        pendingTransfers: transfers.length, learningResults: (await recognition.listLearningResults(resolve(learnerId("RECOGNITION")))).length, recognizedCredits };
      if (!candidates.subjects.length || book.totalRows !== 30 || book.rows.length !== 15 || mbaCurricula.length !== 1 || robotCurricula.length !== 2 || recognizedCredits !== 3 || !transfers.length || evaluation.evaluation?.result.total !== 15) throw new Error("GET service verification failed after commit; see seed data, no automatic deletion");
      for (const state of ["not_started", "scheduled", "in_progress", "completed"]) if (!progressStates.includes(state)) throw new Error(`Missing progress scenario ${state}`);
      // Exercise the real write validator only with requests expected to fail and roll back.
      // Do not run date-sensitive probes after the fixture's future dates have passed.
      const conflictDate = new Date(Date.parse(`${anchor}T12:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
      report.conflictChecks = {};
      if (Date.parse(`${conflictDate}T00:00:00Z`) > Date.now()) {
        const probes = [
          ["ROOM_CONFLICT", "ROBOT-A", "ROBOT", "SHORT"],
          ["LECTURER_CONFLICT", "FUTURE", "MBA", "EXACT"],
          ["CLASS_GROUP_CONFLICT", "NOSESSIONS", "MBA2", "LARGE"],
          ["ROOM_CAPACITY_EXCEEDED", "MERGED", "MBA", "TINY"],
        ];
        for (const [expected, offering, lecturer, room] of probes) {
          try {
            await scheduling.createTeachingSession({ courseOfferingId: resolve(offeringId(offering)), sessionDate: conflictDate, startTime: "07:00", endTime: "11:00", period: "MORNING", lecturerId: resolve(seedId(`lecturer:${lecturer}`)), roomId: resolve(seedId(`room:${room}`)), note: `${TEST_MARKER} expected rejected probe` });
            throw new Error(`Unexpectedly accepted ${expected}`);
          } catch (error) {
            const code = (error as any).getResponse?.()?.code;
            if (code !== expected) throw error;
            report.conflictChecks[expected] = "rejected as expected";
          }
        }
      } else report.conflictChecks.skipped = "Future probe date has passed; rerun against a fresh fixture with an explicit anchor";
    }
    const path = join(tmpdir(), `codex-realistic-test-${preview ? "preview" : "applied"}.json`);
    writeFileSync(path, JSON.stringify(report, null, 2), "utf8");
    console.log(JSON.stringify({ ...report, manifest: undefined }, null, 2));
    console.log(`Report: ${path}`);
  } finally { await app.close(); }
}
run().catch(error => { console.error(`[realistic-test] ${error instanceof Error ? error.stack : "Failed"}`); process.exitCode = 1; });
