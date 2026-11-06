import type { QueryInterface } from 'sequelize';

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      DO $$ BEGIN
        IF pg_get_serial_sequence('db_change_logs','id') IS NULL THEN
          RAISE EXCEPTION 'Notification activation requires the audit journal sequence';
        END IF;
        IF EXISTS (SELECT 1 FROM pg_sequence
          WHERE seqrelid=pg_get_serial_sequence('db_change_logs','id')::regclass
            AND (seqincrement<>1 OR seqcache<>1 OR seqcycle)) THEN
          RAISE EXCEPTION 'Notification activation requires an increasing, uncached, noncycling audit sequence';
        END IF;
      END $$;
      CREATE TABLE notification_activation (
        id boolean PRIMARY KEY DEFAULT true CHECK(id), activated_at timestamptz NOT NULL,
        activated_after_change_id bigint NOT NULL CHECK(activated_after_change_id>=0)
      );
      -- Capture allocated IDs, including uncommitted pre-activation facts. The clock
      -- is metadata only: an NTP/VM clock correction must not hide new source facts.
      INSERT INTO notification_activation(id,activated_at,activated_after_change_id)
      SELECT true,clock_timestamp(),COALESCE(pg_sequence_last_value(pg_get_serial_sequence('db_change_logs','id')::regclass),0);
      CREATE TABLE notification_ingested_changes (change_id bigint PRIMARY KEY, processed_at timestamptz NOT NULL DEFAULT clock_timestamp());
      CREATE TABLE notification_events (
        id uuid PRIMARY KEY, source_key text NOT NULL UNIQUE, change_id bigint NOT NULL,
        source_record_id uuid NOT NULL, entity_id uuid NOT NULL, kind text NOT NULL,
        occurred_at timestamptz NOT NULL, actor_staff_id uuid, actor_profile_id uuid,
        title text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
      );
      CREATE TABLE notification_deliveries (
        id uuid PRIMARY KEY, event_id uuid NOT NULL REFERENCES notification_events(id) ON DELETE CASCADE,
        staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
        profile_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        audience text NOT NULL CHECK(audience IN ('approver','sender')), read_at timestamptz,
        UNIQUE(event_id,staff_id,profile_id)
      );
      CREATE INDEX notification_delivery_inbox ON notification_deliveries(staff_id,profile_id,event_id);
      CREATE INDEX notification_event_time ON notification_events(occurred_at DESC,id);
      ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
      ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;
      GRANT SELECT,UPDATE(read_at) ON notification_deliveries TO pgsms_group_scoped;
      GRANT SELECT ON notification_events TO pgsms_group_scoped;
      CREATE POLICY notification_recipient_select ON notification_deliveries FOR SELECT TO pgsms_group_scoped USING (
        staff_id::text = current_setting('app.group_staff_id',true)
        AND profile_id::text = current_setting('app.active_profile_id',true));
      CREATE POLICY notification_recipient_read ON notification_deliveries FOR UPDATE TO pgsms_group_scoped USING (
        staff_id::text = current_setting('app.group_staff_id',true)
        AND profile_id::text = current_setting('app.active_profile_id',true)) WITH CHECK (
        staff_id::text = current_setting('app.group_staff_id',true)
        AND profile_id::text = current_setting('app.active_profile_id',true));
      CREATE POLICY notification_event_select ON notification_events FOR SELECT TO pgsms_group_scoped USING (
        EXISTS(SELECT 1 FROM notification_deliveries d WHERE d.event_id=notification_events.id));
    `, { transaction });
    // Deliberately no new triggers on business tables or changes to business RLS.
  });
}
export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query('DROP TABLE notification_deliveries, notification_events, notification_ingested_changes, notification_activation', { transaction });
  });
}
