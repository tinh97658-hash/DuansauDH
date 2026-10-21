/** Redact credential values before capture and scrub existing history.
 * Actual schema: staff.password, students.password/password_reset_token.
 * Additional credential names protect future snake_case/camelCase payloads.
 * Flags, expiry dates, changed columns and audit identity are preserved.
 */
const REDACT_FUNCTION = `
CREATE OR REPLACE FUNCTION audit_redact_credentials(payload jsonb) RETURNS jsonb AS $$
DECLARE result jsonb; item record;
BEGIN
  IF jsonb_typeof(payload) = 'object' THEN
    result := '{}'::jsonb;
    FOR item IN SELECT key, value FROM jsonb_each(payload) LOOP
      result := result || jsonb_build_object(item.key,
        CASE WHEN regexp_replace(lower(item.key), '[^a-z0-9]', '', 'g') = ANY (ARRAY[
          'password', 'passwordhash', 'passwordresettoken', 'resettoken',
          'refreshtoken', 'accesstoken', 'apikey', 'secret', 'clientsecret',
          'sessionsecret', 'privatekey', 'totpsecret', 'mfasecret', 'recoverycodes', 'backupcodes'
        ]) THEN to_jsonb('[REDACTED]'::text)
        ELSE audit_redact_credentials(item.value) END);
    END LOOP;
    RETURN result;
  ELSIF jsonb_typeof(payload) = 'array' THEN
    SELECT COALESCE(jsonb_agg(audit_redact_credentials(value) ORDER BY ord), '[]'::jsonb)
      INTO result FROM jsonb_array_elements(payload) WITH ORDINALITY AS e(value, ord);
    RETURN result;
  END IF;
  RETURN payload;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
`;
const CAPTURE_FUNCTION = `
CREATE OR REPLACE FUNCTION audit_capture() RETURNS trigger AS $$
DECLARE
  pk_cols text[];
  old_json jsonb;
  new_json jsonb;
  pk_json jsonb;
  changed_cols text[];
  actor_id uuid;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    old_json := to_jsonb(OLD);
  ELSIF (TG_OP = 'INSERT') THEN
    new_json := to_jsonb(NEW);
  ELSE
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    SELECT array_agg(e.key ORDER BY e.key) INTO changed_cols
    FROM jsonb_each(new_json) AS e
    WHERE old_json -> e.key IS DISTINCT FROM new_json -> e.key;
  END IF;

  SELECT array_agg(a.attname ORDER BY a.attnum) INTO pk_cols
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
  WHERE i.indrelid = TG_RELID AND i.indisprimary;

  IF pk_cols IS NOT NULL THEN
    IF (TG_OP = 'DELETE') THEN
      SELECT jsonb_object_agg(k, old_json -> k) INTO pk_json FROM unnest(pk_cols) AS k;
    ELSE
      SELECT jsonb_object_agg(k, new_json -> k) INTO pk_json FROM unnest(pk_cols) AS k;
    END IF;
  END IF;

  -- Không để lỗi ép kiểu actor làm hỏng giao dịch nghiệp vụ.
  BEGIN
    actor_id := NULLIF(current_setting('app.actor_staff_id', true), '')::uuid;
  EXCEPTION WHEN others THEN
    actor_id := NULL;
  END;

  INSERT INTO db_change_logs (
    table_name, operation, row_pk, old_data, new_data, changed_columns,
    actor_staff_id, actor_email, request_id, ip, user_agent, changed_at
  ) VALUES (
    TG_TABLE_NAME, TG_OP, pk_json::text, audit_redact_credentials(old_json), audit_redact_credentials(new_json), changed_cols,
    actor_id,
    NULLIF(current_setting('app.actor_email', true), ''),
    NULLIF(current_setting('app.request_id', true), ''),
    NULLIF(current_setting('app.ip', true), ''),
    NULLIF(current_setting('app.user_agent', true), ''),
    now()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
`;

export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(REDACT_FUNCTION, { transaction });
    await qi.sequelize.query(CAPTURE_FUNCTION, { transaction });
    await qi.sequelize.query(`
      UPDATE db_change_logs
      SET old_data = audit_redact_credentials(old_data),
          new_data = audit_redact_credentials(new_data)
      WHERE old_data IS DISTINCT FROM audit_redact_credentials(old_data)
         OR new_data IS DISTINCT FROM audit_redact_credentials(new_data)
    `, { transaction });
  });
}

export async function down() {
  // Intentionally retain the security fix. Erased credentials cannot be restored,
  // and rollback must never reintroduce unsafe capture for subsequent writes.
}
