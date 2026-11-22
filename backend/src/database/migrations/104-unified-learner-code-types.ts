import type { QueryInterface } from 'sequelize';

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      ALTER TABLE admission_records ALTER COLUMN profile_category TYPE varchar(120);

      ALTER TABLE learner_code_types ADD COLUMN uses_special_code boolean NOT NULL DEFAULT false;

      UPDATE learner_code_types
      SET name = 'Bình thường', uses_special_code = false, letter = NULL, active = true, requires_admission = true
      WHERE key = 'regular';

      UPDATE learner_code_types
      SET name = 'Cựu SV Tiền thạc sỹ', uses_special_code = true
      WHERE key = 'pre_masters';

      UPDATE learner_code_types
      SET name = 'Cựu SV học trước', uses_special_code = true
      WHERE key = 'early_study';

      UPDATE learner_code_types
      SET uses_special_code = true
      WHERE letter IS NOT NULL;

      INSERT INTO learner_code_types(key, name, letter, active, requires_admission, uses_special_code) VALUES
        ('auditing', 'Dự thính', NULL, false, true, false),
        ('student', 'Sinh viên', NULL, false, true, false)
      ON CONFLICT (key) DO NOTHING;

      ALTER TABLE learner_code_types
        ADD CONSTRAINT learner_code_types_regular_chk
          CHECK (key <> 'regular' OR (letter IS NULL AND requires_admission AND active AND NOT uses_special_code)),
        ADD CONSTRAINT learner_code_types_special_letter_chk
          CHECK (uses_special_code OR letter IS NULL);

      CREATE UNIQUE INDEX learner_code_type_names_lower ON learner_code_types (lower(btrim(name)));

      CREATE OR REPLACE FUNCTION app_sync_learner_code_type_name() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
      BEGIN
        UPDATE public.admission_records
        SET profile_category = NEW.name, updated_at = now()
        WHERE learner_code_type_id = NEW.id
          AND profile_category IS DISTINCT FROM NEW.name;
        RETURN NEW;
      END $$;

      CREATE TRIGGER sync_learner_code_type_name
        AFTER UPDATE OF name ON learner_code_types
        FOR EACH ROW WHEN (NEW.name IS DISTINCT FROM OLD.name)
        EXECUTE FUNCTION app_sync_learner_code_type_name();

      CREATE OR REPLACE FUNCTION app_resolve_learner_code_type(category text) RETURNS uuid
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
        WITH norm AS (SELECT lower(btrim(COALESCE($1, ''))) AS val)
        SELECT COALESCE(
          (SELECT t.id FROM public.learner_code_types t, norm WHERE lower(btrim(t.name)) = norm.val LIMIT 1),
          (SELECT t.id FROM public.learner_code_types t, norm WHERE t.key = CASE norm.val
            WHEN '' THEN 'regular'
            WHEN 'bình thường' THEN 'regular'
            WHEN 'hồ sơ bình thường' THEN 'regular'
            WHEN 'dự thính' THEN 'auditing'
            WHEN 'sinh viên' THEN 'student'
            WHEN 'học trước' THEN 'early_study'
            WHEN 'cựu sv học trước' THEN 'early_study'
            WHEN 'đã học tiền thạc sĩ' THEN 'pre_masters'
            WHEN 'cựu sv tiền thạc sĩ' THEN 'pre_masters'
            WHEN 'cựu sv tiền thạc sỹ' THEN 'pre_masters'
            ELSE NULL
          END LIMIT 1)
        )
      $$;

      ALTER TABLE admission_records DISABLE TRIGGER z_learner_code_guard;

      UPDATE admission_records
      SET learner_code_type_id = app_resolve_learner_code_type(profile_category)
      WHERE learner_code_state <> 'official'
        AND learner_code_type_id IS NULL
        AND app_resolve_learner_code_type(profile_category) IS NOT NULL;

      UPDATE admission_records r
      SET profile_category = t.name
      FROM learner_code_types t
      WHERE r.learner_code_type_id = t.id
        AND r.profile_category IS DISTINCT FROM t.name;

      ALTER TABLE admission_records ENABLE TRIGGER z_learner_code_guard;

      CREATE OR REPLACE FUNCTION app_learner_code_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        wanted text;
        resolved uuid;
      BEGIN
        IF TG_OP = 'INSERT' THEN
          IF NEW.learner_code_state = 'official' THEN
            RAISE EXCEPTION 'Cấp mã qua chức năng Cấp mã học viên' USING ERRCODE = '42501';
          END IF;
          resolved := public.app_resolve_learner_code_type(NEW.profile_category);
          IF NEW.learner_code_type_id IS NULL THEN
            NEW.learner_code_type_id := resolved;
          ELSIF NEW.learner_code_type_id IS DISTINCT FROM resolved THEN
            RAISE EXCEPTION 'Gán loại đặc biệt qua chức năng phân loại hồ sơ' USING ERRCODE = '42501';
          END IF;
          NEW.learner_code_state := 'provisional';
          NEW.intake_code := NEW.code;
          RETURN NEW;
        END IF;

        IF OLD.learner_code_state = 'official' THEN
          IF NEW.learner_code_type_id IS DISTINCT FROM OLD.learner_code_type_id
            OR (NEW.profile_category IS DISTINCT FROM OLD.profile_category
              AND public.app_resolve_learner_code_type(NEW.profile_category) IS DISTINCT FROM OLD.learner_code_type_id) THEN
            wanted := 'learnercode.type.change';
          END IF;
          IF NEW.learner_code_state IS DISTINCT FROM OLD.learner_code_state
            OR NEW.intake_code IS DISTINCT FROM OLD.intake_code
            OR NEW.code IS DISTINCT FROM OLD.code THEN
            wanted := 'learnercode.reissue';
          END IF;
        ELSE
          IF NEW.learner_code_state IS DISTINCT FROM OLD.learner_code_state
            OR NEW.intake_code IS DISTINCT FROM OLD.intake_code THEN
            wanted := 'learnercode.issue';
          ELSIF COALESCE(current_setting('app.learner_code_write', true), '') = 'learnercode.type.assign'
            AND NEW.learner_code_type_id IS DISTINCT FROM OLD.learner_code_type_id THEN
            wanted := 'learnercode.type.assign';
          ELSE
            IF NEW.profile_category IS DISTINCT FROM OLD.profile_category
              AND NEW.learner_code_type_id IS NOT DISTINCT FROM OLD.learner_code_type_id THEN
              NEW.learner_code_type_id := public.app_resolve_learner_code_type(NEW.profile_category);
            ELSIF NEW.learner_code_type_id IS DISTINCT FROM OLD.learner_code_type_id
              AND NEW.learner_code_type_id IS DISTINCT FROM public.app_resolve_learner_code_type(NEW.profile_category) THEN
              wanted := 'learnercode.type.assign';
            END IF;
          END IF;
        END IF;

        IF wanted IS NOT NULL AND (
          COALESCE(current_setting('app.learner_code_write', true), '') <> wanted
          OR NOT app_institution_permission(wanted, true)
        ) THEN
          RAISE EXCEPTION 'Thao tác mã học viên không được phép' USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
      END $$;
    `, { transaction });
  });
}

export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      CREATE OR REPLACE FUNCTION app_learner_code_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE wanted text; BEGIN
        IF TG_OP='INSERT' THEN
          IF NEW.learner_code_state='official' THEN RAISE EXCEPTION 'Cấp mã qua chức năng Cấp mã học viên' USING ERRCODE='42501'; END IF;
          IF NEW.learner_code_type_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM learner_code_types WHERE id=NEW.learner_code_type_id AND key='regular') THEN
            RAISE EXCEPTION 'Gán loại đặc biệt qua chức năng phân loại hồ sơ' USING ERRCODE='42501'; END IF;
          NEW.learner_code_state='provisional'; NEW.intake_code=NEW.code;
          IF NEW.learner_code_type_id IS NULL AND COALESCE(NULLIF(btrim(NEW.profile_category),''),'Bình thường')='Bình thường' THEN
            SELECT id INTO NEW.learner_code_type_id FROM learner_code_types WHERE key='regular'; END IF;
          RETURN NEW;
        END IF;
        IF NEW.learner_code_type_id IS DISTINCT FROM OLD.learner_code_type_id THEN
          wanted=CASE WHEN OLD.learner_code_state='official' THEN 'learnercode.type.change' ELSE 'learnercode.type.assign' END;
        END IF;
        IF NEW.learner_code_state IS DISTINCT FROM OLD.learner_code_state OR NEW.intake_code IS DISTINCT FROM OLD.intake_code
          OR (OLD.learner_code_state='official' AND NEW.code IS DISTINCT FROM OLD.code) THEN
          wanted=CASE WHEN OLD.learner_code_state='official' THEN 'learnercode.reissue' ELSE 'learnercode.issue' END;
        END IF;
        IF wanted IS NOT NULL AND (COALESCE(current_setting('app.learner_code_write',true),'')<>wanted
          OR NOT app_institution_permission(wanted,true)) THEN
          RAISE EXCEPTION 'Thao tác mã học viên không được phép' USING ERRCODE='42501';
        END IF;
        RETURN NEW;
      END $$;

      DROP TRIGGER IF EXISTS sync_learner_code_type_name ON learner_code_types;
      DROP FUNCTION IF EXISTS app_sync_learner_code_type_name();
      DROP FUNCTION IF EXISTS app_resolve_learner_code_type(text);
      DROP INDEX IF EXISTS learner_code_type_names_lower;
      ALTER TABLE learner_code_types
        DROP CONSTRAINT IF EXISTS learner_code_types_special_letter_chk,
        DROP CONSTRAINT IF EXISTS learner_code_types_regular_chk,
        DROP COLUMN IF EXISTS uses_special_code;
      DELETE FROM learner_code_types WHERE key IN ('auditing', 'student');
      UPDATE learner_code_types SET name = 'Hồ sơ bình thường' WHERE key = 'regular';
      UPDATE learner_code_types SET name = 'Đã học tiền thạc sĩ' WHERE key = 'pre_masters';
      UPDATE learner_code_types SET name = 'Học trước' WHERE key = 'early_study';
    `, { transaction });
  });
}
