import { randomUUID } from 'node:crypto';
import { QueryTypes } from 'sequelize';

export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    // Creating the automatic roster is part of saving marks. Final result
    // approval still requires gradebook.approve at both the service and DB layers.
    await qi.sequelize.query(`
      CREATE POLICY automatic_exam_snapshot_insert ON course_exam_eligibility_snapshots
        FOR INSERT TO pgsms_group_scoped WITH CHECK (
          current_setting('app.academic_domain',true)='gradebook'
          AND current_setting('app.academic_permission',true)='gradebook.submit'
          AND app_academic_write() AND app_schedule_supported(course_offering_id));
      CREATE FUNCTION app_exam_final_approval() RETURNS trigger
      LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
      BEGIN
        IF COALESCE(current_setting('app.academic_domain',true),'')<>''
          AND NEW.result_status='approved' THEN
          IF TG_OP='INSERT' THEN
            IF NOT public.app_institution_permission('gradebook.approve',true) THEN
              RAISE EXCEPTION 'Approval permission required' USING ERRCODE='42501';
            END IF;
          ELSIF OLD.result_status IS DISTINCT FROM NEW.result_status THEN
            IF NOT public.app_institution_permission('gradebook.approve',true) THEN
              RAISE EXCEPTION 'Approval permission required' USING ERRCODE='42501';
            END IF;
          END IF;
        END IF;
        RETURN NEW;
      END $$;
      DROP TRIGGER academic_column_guard ON course_exam_workflows;
      CREATE TRIGGER academic_column_guard BEFORE INSERT OR UPDATE ON course_exam_workflows
        FOR EACH ROW EXECUTE FUNCTION app_exam_final_approval();
    `, { transaction });
    // Submitted rosters already passed completeness checks in the old workflow.
    // Preserve their rows and history while removing the pending approval gate.
    const pending: any[] = await qi.sequelize.query(`SELECT * FROM course_exam_workflows
      WHERE mode='new' AND eligibility_status='submitted' AND result_status IN ('not_available','draft') FOR UPDATE`, { transaction, type: QueryTypes.SELECT });
    for (const state of pending) {
      const rows = state.eligibility_submission?.rows;
      if (!Array.isArray(rows) || !rows.length) {
        await qi.sequelize.query(`UPDATE course_exam_workflows SET eligibility_status='draft',
          eligibility_version=eligibility_version+1,eligibility_submission=NULL,updated_at=now()
          WHERE course_offering_id=:id`, { transaction, replacements: { id: state.course_offering_id } });
        continue;
      }
      const replacements = { id: state.course_offering_id, snapshot: randomUUID(), version: state.eligibility_version + 1,
        rows: JSON.stringify(rows), actor: JSON.stringify({ source: 'automatic-exam-eligibility-migration' }),
        resultStatus: state.result_status==='draft'||!rows.some((row:any)=>row.eligible===true&&!row.examExempt)?'draft':'not_available' };
      await qi.sequelize.query(`INSERT INTO course_exam_eligibility_snapshots(id,course_offering_id,version,rows,actor)
        VALUES(:snapshot,:id,:version,CAST(:rows AS jsonb),CAST(:actor AS jsonb))`, { transaction, replacements });
      await qi.sequelize.query(`UPDATE course_exam_workflows SET eligibility_status='approved',
        eligibility_version=:version,eligibility_snapshot_id=:snapshot,eligibility_submission=NULL,
        result_status=:resultStatus,updated_at=now() WHERE course_offering_id=:id`, { transaction, replacements });
    }
  });
}

export async function down() {
  throw new Error('Automatic eligibility has business history; downgrade refused to preserve exam rosters.');
}
