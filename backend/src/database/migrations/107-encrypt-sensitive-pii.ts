import { QueryTypes } from "sequelize";
import {
  encryptPiiIfPlaintext,
  hashIdCard,
  hashPhone,
  isEncryptedPii,
  isPiiEncryptionEnabled,
} from "../../common/pii-encryption.js";

const UPDATED_REDACT_FUNCTION = `
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
          'sessionsecret', 'privatekey', 'totpsecret', 'mfasecret', 'recoverycodes',
          'backupcodes', 'dataencryptionkey'
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

export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    // 1. Widen sensitive PII columns to TEXT to hold AES-256-GCM payloads.
    await qi.sequelize.query(`
      ALTER TABLE admission_records
        ALTER COLUMN id_card TYPE TEXT,
        ALTER COLUMN phone TYPE TEXT,
        ALTER COLUMN ward TYPE TEXT,
        ALTER COLUMN diploma_number TYPE TEXT,
        ALTER COLUMN registry_book_number TYPE TEXT,
        ADD COLUMN IF NOT EXISTS id_card_hash VARCHAR(64),
        ADD COLUMN IF NOT EXISTS phone_hash VARCHAR(64);
    `, { transaction });

    await qi.sequelize.query(`
      ALTER TABLE students
        ALTER COLUMN tel_no TYPE TEXT,
        ADD COLUMN IF NOT EXISTS tel_no_hash VARCHAR(64);
    `, { transaction });

    await qi.sequelize.query(`
      ALTER TABLE lecturers
        ALTER COLUMN phone TYPE TEXT,
        ADD COLUMN IF NOT EXISTS phone_hash VARCHAR(64);
    `, { transaction });

    // 2. Add B-tree indexes for blind-index exact lookups.
    await qi.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_admission_records_id_card_hash ON admission_records (id_card_hash);
      CREATE INDEX IF NOT EXISTS idx_admission_records_phone_hash ON admission_records (phone_hash);
      CREATE INDEX IF NOT EXISTS idx_students_tel_no_hash ON students (tel_no_hash);
      CREATE INDEX IF NOT EXISTS idx_lecturers_phone_hash ON lecturers (phone_hash);
    `, { transaction });

    // 3. Keep SQL audit credential redaction in sync with CREDENTIAL_KEYS.
    await qi.sequelize.query(UPDATED_REDACT_FUNCTION, { transaction });

    // 4. Backfill existing plaintext rows when DATA_ENCRYPTION_KEY is configured.
    if (!isPiiEncryptionEnabled()) return;

    const admissionRows = await qi.sequelize.query(
      `SELECT id, id_card, phone, ward, diploma_number, registry_book_number, id_card_hash, phone_hash
       FROM admission_records`,
      { type: QueryTypes.SELECT, transaction },
    ) as Array<Record<string, string | null>>;

    for (const row of admissionRows) {
      const nextIdCard = encryptPiiIfPlaintext(row.id_card, "admission_records:id_card");
      const nextPhone = encryptPiiIfPlaintext(row.phone, "admission_records:phone");
      const nextWard = encryptPiiIfPlaintext(row.ward, "admission_records:ward");
      const nextDiploma = encryptPiiIfPlaintext(row.diploma_number, "admission_records:diploma_number");
      const nextRegistry = encryptPiiIfPlaintext(row.registry_book_number, "admission_records:registry_book_number");
      const nextIdCardHash = hashIdCard(row.id_card, { allowEncrypted: true, aad: "admission_records:id_card" });
      const nextPhoneHash = hashPhone(row.phone, { allowEncrypted: true, aad: "admission_records:phone" });

      const changed =
        nextIdCard !== row.id_card ||
        nextPhone !== row.phone ||
        nextWard !== row.ward ||
        nextDiploma !== row.diploma_number ||
        nextRegistry !== row.registry_book_number ||
        nextIdCardHash !== row.id_card_hash ||
        nextPhoneHash !== row.phone_hash;

      if (changed) {
        await qi.sequelize.query(
          `UPDATE admission_records
           SET id_card = :idCard,
               phone = :phone,
               ward = :ward,
               diploma_number = :diplomaNumber,
               registry_book_number = :registryBookNumber,
               id_card_hash = :idCardHash,
               phone_hash = :phoneHash
           WHERE id = :id`,
          {
            replacements: {
              id: row.id,
              idCard: nextIdCard,
              phone: nextPhone,
              ward: nextWard,
              diplomaNumber: nextDiploma,
              registryBookNumber: nextRegistry,
              idCardHash: nextIdCardHash,
              phoneHash: nextPhoneHash,
            },
            transaction,
          },
        );
      }
    }

    const studentRows = await qi.sequelize.query(
      `SELECT id, postal_address, tel_no, tel_no_hash FROM students`,
      { type: QueryTypes.SELECT, transaction },
    ) as Array<Record<string, string | null>>;

    for (const row of studentRows) {
      const nextAddress = encryptPiiIfPlaintext(row.postal_address, "students:postal_address");
      const nextTel = encryptPiiIfPlaintext(row.tel_no, "students:tel_no");
      const nextTelHash = hashPhone(row.tel_no, { allowEncrypted: true, aad: "students:tel_no" });

      if (
        nextAddress !== row.postal_address ||
        nextTel !== row.tel_no ||
        nextTelHash !== row.tel_no_hash
      ) {
        await qi.sequelize.query(
          `UPDATE students
           SET postal_address = :postalAddress,
               tel_no = :telNo,
               tel_no_hash = :telNoHash
           WHERE id = :id`,
          {
            replacements: {
              id: row.id,
              postalAddress: nextAddress,
              telNo: nextTel,
              telNoHash: nextTelHash,
            },
            transaction,
          },
        );
      }
    }

    const lecturerRows = await qi.sequelize.query(
      `SELECT id, phone, phone_hash FROM lecturers`,
      { type: QueryTypes.SELECT, transaction },
    ) as Array<Record<string, string | null>>;

    for (const row of lecturerRows) {
      const nextPhone = encryptPiiIfPlaintext(row.phone, "lecturers:phone");
      const nextPhoneHash = hashPhone(row.phone, { allowEncrypted: true, aad: "lecturers:phone" });

      if (
        (row.phone && !isEncryptedPii(row.phone)) ||
        nextPhone !== row.phone ||
        nextPhoneHash !== row.phone_hash
      ) {
        await qi.sequelize.query(
          `UPDATE lecturers
           SET phone = :phone,
               phone_hash = :phoneHash
           WHERE id = :id`,
          {
            replacements: {
              id: row.id,
              phone: nextPhone,
              phoneHash: nextPhoneHash,
            },
            transaction,
          },
        );
      }
    }
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(`
      DROP INDEX IF EXISTS idx_admission_records_id_card_hash;
      DROP INDEX IF EXISTS idx_admission_records_phone_hash;
      DROP INDEX IF EXISTS idx_students_tel_no_hash;
      DROP INDEX IF EXISTS idx_lecturers_phone_hash;
      ALTER TABLE admission_records
        DROP COLUMN IF EXISTS id_card_hash,
        DROP COLUMN IF EXISTS phone_hash;
      ALTER TABLE students
        DROP COLUMN IF EXISTS tel_no_hash;
      ALTER TABLE lecturers
        DROP COLUMN IF EXISTS phone_hash;
    `, { transaction });
  });
}
