import { QueryTypes, type QueryInterface, type Transaction } from 'sequelize';

// These decisions depend on the current profile, not the row being read. Scalar
// subqueries let PostgreSQL evaluate them once per statement, never across requests.
const domain = "COALESCE(current_setting('app.academic_domain',true),'')";
const action = "COALESCE(current_setting('app.scheduling_action',true),'')";
const responsibility: Record<string, string> = {
  class_groups: 'app_gradebook_group_visible(id)',
  class_group_members: 'app_gradebook_group_visible(class_group_id)',
  course_offerings: 'app_gradebook_offering_visible(id)',
  ...Object.fromEntries(['course_offering_class_groups', 'course_offering_students', 'course_offering_withdrawals',
    'course_exam_gradebooks', 'course_exam_workflows', 'course_exam_eligibility_snapshots', 'gradebook_events',
    'course_exam_sessions'].map(table => [table, 'app_gradebook_offering_visible(course_offering_id)'])),
};
const oldSchedule: Record<string, string> = {
  teaching_sessions: 'app_schedule_read(course_offering_id)',
  course_offerings: `CASE WHEN ${domain}<>'' AND (${domain}<>'studyleave' OR app_institution_permission('studyleave.manage',false))
    THEN app_academic_read() AND EXISTS(SELECT 1 FROM subjects s WHERE s.id=course_offerings.subject_id AND s.program='masters')
    ELSE app_schedule_read(id) OR (${action} IN ('','organize')
      AND scope_created_by_staff_id::text=current_setting('app.group_staff_id',true) AND app_offering_empty(id)) END`,
};

async function alter(qi: QueryInterface, transaction: Transaction, table: string, policy: string, expression: string) {
  const quote = (identifier: string) => '"' + identifier.replace(/"/g, '""') + '"';
  await qi.sequelize.query(`ALTER POLICY ${quote(policy)} ON public.${quote(table)} USING (${expression})`, { transaction });
}

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    const policies = await qi.sequelize.query<{ tablename: string; policyname: string; qual: string }>(`
      SELECT tablename, policyname, qual FROM pg_policies WHERE schemaname='public' AND cmd='SELECT'
        AND policyname IN ('group_scope_read','gradebook_responsibility_read')`,
    { type: QueryTypes.SELECT, transaction });
    for (const policy of policies) {
      let expression = policy.qual;
      if (policy.policyname === 'group_scope_read') {
        expression = expression.replace(/\bapp_academic_read\(\)/g, '(SELECT app_academic_read())');
        if (Object.hasOwn(oldSchedule, policy.tablename)) {
          // Institution scheduling.view is already a sufficient branch in
          // app_schedule_grants/app_schedule_allowed. All other paths retain the
          // original predicate, including academic-domain and legacy group scope.
          expression = `CASE WHEN ${domain}='' AND ${action}<>''
            AND (SELECT app_institution_permission('scheduling.view',false))
            THEN true ELSE (${expression}) END`;
        }
      } else if (Object.hasOwn(responsibility, policy.tablename)) {
        // Both original visibility helpers already allow app_gradebook_admin().
        // Keep the row-specific ownership predicate for every other profile.
        expression = `CASE WHEN (SELECT app_gradebook_admin()) THEN true ELSE (${expression}) END`;
      }
      if (expression !== policy.qual) await alter(qi, transaction, policy.tablename, policy.policyname, expression);
    }
  });
}

export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    const policies = await qi.sequelize.query<{ tablename: string; policyname: string; qual: string }>(`
      SELECT tablename, policyname, qual FROM pg_policies WHERE schemaname='public' AND cmd='SELECT'
        AND policyname IN ('group_scope_read','gradebook_responsibility_read')`,
    { type: QueryTypes.SELECT, transaction });
    for (const policy of policies) {
      let expression = policy.qual;
      if (policy.policyname === 'group_scope_read') {
        expression = oldSchedule[policy.tablename] || expression.replace(
          /\(\s*SELECT app_academic_read\(\)(?:\s+AS app_academic_read)?\s*\)/g, 'app_academic_read()');
      } else if (Object.hasOwn(responsibility, policy.tablename)) {
        expression = `${domain}<>'gradebook' OR ${responsibility[policy.tablename]}`;
      }
      if (expression !== policy.qual) await alter(qi, transaction, policy.tablename, policy.policyname, expression);
    }
  });
}
