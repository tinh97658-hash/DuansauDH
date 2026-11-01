import { QueryTypes } from 'sequelize';

// Reservations intentionally have no foreign key: deleting a profile must never free its code.
export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    const [{ schema }] = await qi.sequelize.query('SELECT current_schema() AS schema', { type: QueryTypes.SELECT, transaction });
    const ns = `"${String(schema).replace(/"/g, '""')}"`;
    await qi.sequelize.query(`
      SELECT pg_advisory_xact_lock(21026);
      LOCK TABLE ${ns}.admission_records IN SHARE ROW EXCLUSIVE MODE;
      CREATE UNIQUE INDEX admission_records_code_unique ON ${ns}.admission_records (lower(btrim(code)))
        WHERE NULLIF(btrim(code), '') IS NOT NULL;
      CREATE TABLE ${ns}.learner_code_reservations (
        code_key text PRIMARY KEY,
        admission_record_id uuid NOT NULL,
        reserved_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO ${ns}.learner_code_reservations(code_key, admission_record_id)
        SELECT lower(btrim(code)), id FROM ${ns}.admission_records WHERE NULLIF(btrim(code), '') IS NOT NULL;
      CREATE SEQUENCE ${ns}.learner_code_sequence;
      SELECT setval('${ns}.learner_code_sequence', GREATEST(1, COALESCE((
        SELECT MAX(substring(code FROM '^HV[0-9]{2}([0-9]+)$')::bigint) + 1
        FROM ${ns}.admission_records WHERE code ~ '^HV[0-9]{2}[0-9]+$'
      ), 1)), false);
    `, { transaction });

    const [audit] = await qi.sequelize.query('SELECT to_regclass(:name) AS name', {
      replacements: { name: `${ns}.db_change_logs` }, type: QueryTypes.SELECT, transaction,
    });
    if (audit.name) {
      await qi.sequelize.query(`
        INSERT INTO ${ns}.learner_code_reservations(code_key, admission_record_id, reserved_at)
        SELECT lower(btrim(snapshot->>'code')), (snapshot->>'id')::uuid, changed_at
        FROM ${ns}.db_change_logs log
        CROSS JOIN LATERAL (VALUES (log.old_data), (log.new_data)) versions(snapshot)
        WHERE log.table_name = 'admission_records' AND NULLIF(btrim(snapshot->>'code'), '') IS NOT NULL
          AND snapshot->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        ORDER BY changed_at ON CONFLICT (code_key) DO NOTHING;
      `, { transaction });
    }

    await qi.sequelize.query(`
      CREATE FUNCTION ${ns}.reserve_learner_code() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = ${ns}, pg_temp AS $$
      DECLARE
        candidate text;
        serial_number text;
        owner_id uuid;
      BEGIN
        IF NULLIF(btrim(NEW.code), '') IS NULL THEN
          IF TG_OP = 'UPDATE' AND NULLIF(btrim(OLD.code), '') IS NOT NULL THEN
            RAISE EXCEPTION 'Mã học viên không được để trống.' USING ERRCODE = '23514', CONSTRAINT = 'admission_records_code_required';
          END IF;
          LOOP
            serial_number := nextval('learner_code_sequence')::text;
            candidate := 'HV' || right(CASE WHEN NEW.academic_year ~ '^[0-9]{4}$' THEN NEW.academic_year
              ELSE to_char(CURRENT_DATE, 'YYYY') END, 2)
              || lpad(serial_number, GREATEST(3, length(serial_number)), '0');
            INSERT INTO learner_code_reservations(code_key, admission_record_id)
              VALUES (lower(candidate), NEW.id) ON CONFLICT DO NOTHING RETURNING admission_record_id INTO owner_id;
            EXIT WHEN owner_id IS NOT NULL;
          END LOOP;
          NEW.code := candidate;
        ELSE
          NEW.code := upper(btrim(NEW.code));
          INSERT INTO learner_code_reservations AS reserved(code_key, admission_record_id)
            VALUES (lower(NEW.code), NEW.id)
            ON CONFLICT (code_key) DO UPDATE SET admission_record_id = reserved.admission_record_id
              WHERE reserved.admission_record_id = EXCLUDED.admission_record_id
            RETURNING admission_record_id INTO owner_id;
          IF owner_id IS NULL THEN
            RAISE EXCEPTION 'Mã học viên đã được sử dụng. Vui lòng nhập mã khác.'
              USING ERRCODE = '23505', CONSTRAINT = 'admission_records_code_reserved';
          END IF;
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER admission_records_reserve_code BEFORE INSERT OR UPDATE OF code ON ${ns}.admission_records
        FOR EACH ROW EXECUTE FUNCTION ${ns}.reserve_learner_code();
      UPDATE ${ns}.admission_records SET code = NULL WHERE NULLIF(btrim(code), '') IS NULL;
      ALTER TABLE ${ns}.admission_records ALTER COLUMN code SET NOT NULL;
      ALTER TABLE ${ns}.admission_records ADD CONSTRAINT admission_records_code_required CHECK (btrim(code) <> '');
    `, { transaction });
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(`
      DROP TRIGGER admission_records_reserve_code ON admission_records;
      DROP FUNCTION reserve_learner_code();
      DROP INDEX admission_records_code_unique;
      DROP TABLE learner_code_reservations;
      DROP SEQUENCE learner_code_sequence;
      ALTER TABLE admission_records DROP CONSTRAINT admission_records_code_required;
      ALTER TABLE admission_records ALTER COLUMN code DROP NOT NULL;
    `, { transaction });
  });
}
