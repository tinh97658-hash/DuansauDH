import type { QueryInterface } from 'sequelize';

// Freezing the historical roster is an internal consequence of an authorized
// timetable/membership change, not an organization or gradebook edit by its actor.
// Keep the helper private: scoped users must enter through the RLS-protected
// tables and cannot invoke it with an arbitrary offering or historical cutoff.
export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      ALTER FUNCTION freeze_started_offering_roster(uuid,timestamptz)
        SECURITY DEFINER SET search_path=pg_catalog,public
        SET app.scheduling_action='' SET app.academic_domain='';
      REVOKE ALL ON FUNCTION freeze_started_offering_roster(uuid,timestamptz) FROM PUBLIC;
      ALTER FUNCTION freeze_rosters_before_timetable_change()
        SECURITY DEFINER SET search_path=pg_catalog,public;
      ALTER FUNCTION freeze_rosters_before_membership_change()
        SECURITY DEFINER SET search_path=pg_catalog,public;
    `, { transaction });
  });
}

export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      ALTER FUNCTION freeze_rosters_before_timetable_change() SECURITY INVOKER RESET search_path;
      ALTER FUNCTION freeze_rosters_before_membership_change() SECURITY INVOKER RESET search_path;
      ALTER FUNCTION freeze_started_offering_roster(uuid,timestamptz)
        SECURITY INVOKER RESET search_path RESET app.scheduling_action RESET app.academic_domain;
      GRANT EXECUTE ON FUNCTION freeze_started_offering_roster(uuid,timestamptz) TO PUBLIC;
    `, { transaction });
  });
}
