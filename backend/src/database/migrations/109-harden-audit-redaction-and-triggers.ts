/**
 * Security hardening migration (SEC-001, SEC-004, SEC-005, SEC-021):
 * 1. Syncs SQL `audit_redact_credentials` with `CREDENTIAL_KEYS` (adds
 *    `sessionversion`, `idcardhash`, `phonehash`, `telnohash`) and redacts
 *    encrypted PII ciphertexts (`enc:v1:...` / `enc:v2:...`) to `[ENCRYPTED]`.
 * 2. Scrubs existing `db_change_logs` rows using the updated policy.
 * 3. Attaches `audit_capture_trg` to newer business/RBAC tables created after
 *    migration 063 (`permission_requirements`, `upload_storage_*`, `learner_code_*`).
 */
const UPDATED_REDACT_FUNCTION = `
CREATE OR REPLACE FUNCTION audit_redact_credentials(payload jsonb) RETURNS jsonb AS $$
DECLARE
  result jsonb;
  item record;
  text_val text;
BEGIN
  IF jsonb_typeof(payload) = 'object' THEN
    result := '{}'::jsonb;
    FOR item IN SELECT key, value FROM jsonb_each(payload) LOOP
      result := result || jsonb_build_object(item.key,
        CASE WHEN regexp_replace(lower(item.key), '[^a-z0-9]', '', 'g') = ANY (ARRAY[
          'password', 'passwordhash', 'passwordresettoken', 'resettoken',
          'refreshtoken', 'accesstoken', 'apikey', 'secret', 'clientsecret',
          'sessionsecret', 'sessionversion', 'privatekey', 'totpsecret',
          'mfasecret', 'recoverycodes', 'backupcodes', 'dataencryptionkey',
          'idcardhash', 'phonehash', 'telnohash'
        ]) THEN to_jsonb('[REDACTED]'::text)
        ELSE audit_redact_credentials(item.value) END);
    END LOOP;
    RETURN result;
  ELSIF jsonb_typeof(payload) = 'array' THEN
    SELECT COALESCE(jsonb_agg(audit_redact_credentials(value) ORDER BY ord), '[]'::jsonb)
      INTO result FROM jsonb_array_elements(payload) WITH ORDINALITY AS e(value, ord);
    RETURN result;
  ELSIF jsonb_typeof(payload) = 'string' THEN
    text_val := payload #>> '{}';
    IF text_val LIKE 'enc:v1:%' OR text_val LIKE 'enc:v2:%' THEN
      RETURN to_jsonb('[ENCRYPTED]'::text);
    END IF;
  END IF;
  RETURN payload;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
`;

const MISSING_AUDIT_TABLES = [
  "permission_requirements",
  "upload_storage_accounts",
  "upload_storage_files",
  "learner_code_types",
  "learner_code_abbreviations",
  "learner_code_rules",
  "learner_code_counters",
] as const;

export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(UPDATED_REDACT_FUNCTION, { transaction });

    await qi.sequelize.query(`
      UPDATE db_change_logs
      SET old_data = audit_redact_credentials(old_data),
          new_data = audit_redact_credentials(new_data)
      WHERE table_name IN ('staff', 'students', 'admission_records', 'lecturers')
        AND (
          old_data IS DISTINCT FROM audit_redact_credentials(old_data)
          OR new_data IS DISTINCT FROM audit_redact_credentials(new_data)
        )
    `, { transaction });

    for (const table of MISSING_AUDIT_TABLES) {
      await qi.sequelize.query(`
        DO $$
        BEGIN
          IF to_regclass('public.${table}') IS NOT NULL
             AND to_regproc('audit_capture_change()') IS NOT NULL THEN
            DROP TRIGGER IF EXISTS audit_capture_trg ON public.${table};
            CREATE TRIGGER audit_capture_trg
              AFTER INSERT OR UPDATE OR DELETE ON public.${table}
              FOR EACH ROW EXECUTE FUNCTION audit_capture_change();
          END IF;
        END $$;
      `, { transaction });
    }
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    for (const table of MISSING_AUDIT_TABLES) {
      await qi.sequelize.query(`
        DO $$
        BEGIN
          IF to_regclass('public.${table}') IS NOT NULL THEN
            DROP TRIGGER IF EXISTS audit_capture_trg ON public.${table};
          END IF;
        END $$;
      `, { transaction });
    }
  });
}
