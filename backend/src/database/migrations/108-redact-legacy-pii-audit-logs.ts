/**
 * Scrub legacy plaintext PII values captured in `db_change_logs` prior to
 * migration 107 (including `old_data` snapshots from the backfill itself).
 * Encrypted values (`enc:v1:...`), empty strings, NULLs, and `changed_columns`
 * metadata remain intact.
 */
const SCRUB_FUNCTION = `
CREATE OR REPLACE FUNCTION audit_redact_legacy_pii(payload jsonb) RETURNS jsonb AS $$
DECLARE
  result jsonb;
  item record;
  normalized_key text;
  text_val text;
BEGIN
  IF jsonb_typeof(payload) = 'object' THEN
    result := '{}'::jsonb;
    FOR item IN SELECT key, value FROM jsonb_each(payload) LOOP
      normalized_key := regexp_replace(lower(item.key), '[^a-z0-9]', '', 'g');
      IF normalized_key = ANY (ARRAY[
        'idcard', 'phone', 'ward', 'diplomanumber',
        'registrybooknumber', 'postaladdress', 'telno'
      ]) AND jsonb_typeof(item.value) = 'string' THEN
        text_val := btrim(item.value #>> '{}');
        IF text_val <> '' AND text_val <> '[REDACTED]' AND text_val NOT LIKE 'enc:v1:%' THEN
          result := result || jsonb_build_object(item.key, to_jsonb('[REDACTED]'::text));
        ELSE
          result := result || jsonb_build_object(item.key, item.value);
        END IF;
      ELSE
        result := result || jsonb_build_object(item.key, audit_redact_legacy_pii(item.value));
      END IF;
    END LOOP;
    RETURN result;
  ELSIF jsonb_typeof(payload) = 'array' THEN
    SELECT COALESCE(jsonb_agg(audit_redact_legacy_pii(value) ORDER BY ord), '[]'::jsonb)
      INTO result FROM jsonb_array_elements(payload) WITH ORDINALITY AS e(value, ord);
    RETURN result;
  END IF;
  RETURN payload;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
`;

export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(SCRUB_FUNCTION, { transaction });
    await qi.sequelize.query(`
      UPDATE db_change_logs
      SET old_data = audit_redact_legacy_pii(old_data),
          new_data = audit_redact_legacy_pii(new_data)
      WHERE table_name IN ('admission_records', 'students', 'lecturers')
        AND (
          old_data IS DISTINCT FROM audit_redact_legacy_pii(old_data)
          OR new_data IS DISTINCT FROM audit_redact_legacy_pii(new_data)
        )
    `, { transaction });
  });
}

export async function down() {
  // Intentionally retain scrubbed audit history; redacted legacy PII cannot be restored.
}
