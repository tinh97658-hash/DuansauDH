import { QueryTypes } from 'sequelize';

const buildReserveLearnerCodeSql = (ns: string, prefix: 'HS' | 'HV') => `
  CREATE OR REPLACE FUNCTION ${ns}.reserve_learner_code() RETURNS trigger
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
        candidate := '${prefix}' || right(CASE WHEN NEW.academic_year ~ '^[0-9]{4}$' THEN NEW.academic_year
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
`;

export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    const [{ schema }] = await qi.sequelize.query('SELECT current_schema() AS schema', { type: QueryTypes.SELECT, transaction });
    const ns = `"${String(schema).replace(/"/g, '""')}"`;
    await qi.sequelize.query(buildReserveLearnerCodeSql(ns, 'HS'), { transaction });
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    const [{ schema }] = await qi.sequelize.query('SELECT current_schema() AS schema', { type: QueryTypes.SELECT, transaction });
    const ns = `"${String(schema).replace(/"/g, '""')}"`;
    await qi.sequelize.query(buildReserveLearnerCodeSql(ns, 'HV'), { transaction });
  });
}
