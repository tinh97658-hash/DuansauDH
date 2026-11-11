import { PERMISSIONS } from '../../auth/permissions.js';
import { permissionTreeMeta } from '../../auth/permission-tree.js';

export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(`
      CREATE TABLE learner_code_types(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),key text NOT NULL UNIQUE,
        name text NOT NULL,letter text,active boolean NOT NULL DEFAULT true,requires_admission boolean NOT NULL DEFAULT true,
        version integer NOT NULL DEFAULT 1, CHECK(letter IS NULL OR letter ~ '^[A-Z]$'),
        CHECK(key<>'regular' OR (letter IS NULL AND requires_admission)));
      CREATE UNIQUE INDEX learner_code_type_letters ON learner_code_types(letter) WHERE letter IS NOT NULL;
      INSERT INTO learner_code_types(key,name,letter,active) VALUES
        ('regular','Hồ sơ bình thường',NULL,true),('pre_masters','Đã học tiền thạc sĩ',NULL,false),('early_study','Học trước',NULL,false);
      CREATE TABLE learner_code_abbreviations(major_id uuid PRIMARY KEY REFERENCES majors(id),abbreviation varchar(12) NOT NULL
        CHECK(abbreviation ~ '^[A-Z0-9]{2,12}$'));
      CREATE TABLE learner_code_rules(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,active boolean NOT NULL,
        program text CHECK(program IN ('masters','doctoral')),major_id uuid REFERENCES majors(id),academic_year text,
        intake_round integer,class_group_id uuid REFERENCES class_groups(id),type_id uuid REFERENCES learner_code_types(id),
        counter_scope text NOT NULL,start_number bigint NOT NULL CHECK(start_number>=1),parts jsonb NOT NULL,
        version integer NOT NULL DEFAULT 1,effective_from date NOT NULL DEFAULT '1970-01-01',updated_at timestamptz NOT NULL DEFAULT now());
      INSERT INTO learner_code_rules(name,active,counter_scope,start_number,parts) VALUES
        ('Mẫu chuẩn 9 ký tự',true,'class',1,'[{"kind":"major"},{"kind":"year","width":2},{"kind":"round","width":1},{"kind":"group","width":1},{"kind":"sequence","width":3}]');
      CREATE TABLE learner_code_counters(key text PRIMARY KEY,next_number bigint NOT NULL CHECK(next_number>=1));
      ALTER TABLE admission_records ADD COLUMN learner_code_type_id uuid REFERENCES learner_code_types(id),
        ADD COLUMN learner_code_state text NOT NULL DEFAULT 'legacy' CHECK(learner_code_state IN ('legacy','provisional','official')),
        ADD COLUMN intake_code varchar(50);
      CREATE TABLE learner_code_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),record_id uuid REFERENCES admission_records(id) ON DELETE SET NULL,
        actor_id uuid NOT NULL REFERENCES staff(id),profile_id uuid NOT NULL REFERENCES roles(id),action text NOT NULL,
        before_data jsonb,after_data jsonb,reason text,created_at timestamptz NOT NULL DEFAULT now());
      CREATE INDEX learner_code_event_record ON learner_code_events(record_id,created_at DESC);
      CREATE TABLE learner_code_requests(id uuid PRIMARY KEY,actor_id uuid NOT NULL,profile_id uuid NOT NULL,
        fingerprint text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
      CREATE FUNCTION app_learner_code_primary_group(record_id uuid) RETURNS uuid
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
        SELECT CASE WHEN COUNT(DISTINCT g.id)=1 THEN (array_agg(DISTINCT g.id))[1] ELSE NULL END
        FROM public.admission_records r JOIN public.class_group_members m
          ON m.admission_record_id=r.id OR (r.student_id IS NOT NULL AND m.student_id=r.student_id)
        JOIN public.class_groups g ON g.id=m.class_group_id AND g.group_type='ADMINISTRATIVE'
          AND g.major_id=r.major_id AND g.academic_year=r.academic_year
          AND g.program::text=CASE WHEN r.training_level='Tiến sĩ' THEN 'doctoral' ELSE 'masters' END
        WHERE r.id=$1 $$;
      CREATE FUNCTION app_learner_code_guard() RETURNS trigger LANGUAGE plpgsql AS $$
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
      CREATE TRIGGER z_learner_code_guard BEFORE INSERT OR UPDATE ON admission_records FOR EACH ROW EXECUTE FUNCTION app_learner_code_guard();
      GRANT SELECT,INSERT,UPDATE,DELETE ON learner_code_types,learner_code_rules,learner_code_abbreviations,
        learner_code_counters,learner_code_events,learner_code_requests TO pgsms_group_scoped;
      GRANT SELECT ON learner_code_reservations TO pgsms_group_scoped;
    `, { transaction });
    const permissions = PERMISSIONS.filter((p: any) => p.code.startsWith('learnercode.') || p.code==='module.learnercode'
      || p.code.startsWith('route.system.learner-codes.') || p.code.startsWith('route.plan.learner-codes.'));
    for (const p of permissions) {
      await qi.sequelize.query(`INSERT INTO permissions(id,code,name,"group",description,sort_order,created_at,updated_at)
        VALUES(gen_random_uuid(),:code,:name,:group,:description,900,now(),now()) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description;
        INSERT INTO role_permissions(role_id,permission_id,created_at,updated_at)
          SELECT r.id,p.id,now(),now() FROM roles r CROSS JOIN permissions p WHERE r.code='admin' AND p.code=:code ON CONFLICT DO NOTHING`,
      { replacements: { ...p, description:p.description||'' }, transaction });
    }
    for (const p of permissions.filter((p: any) => !p.code.startsWith('module.'))) {
      const meta = permissionTreeMeta(p.code);
      await qi.sequelize.query(`INSERT INTO permission_requirements(permission_id,required_permission_id)
        SELECT p.id,r.id FROM permissions p CROSS JOIN permissions r WHERE p.code=:code AND r.code IN (:required)
        AND p.id<>r.id ON CONFLICT DO NOTHING`, { replacements:{code:p.code,required:[`module.${meta.moduleId}`,...meta.requires]},transaction });
    }
    // Close transitive requirements, including cross-module read dependencies.
    for (let i=0;i<5;i++) await qi.sequelize.query(`INSERT INTO permission_requirements(permission_id,required_permission_id)
      SELECT a.permission_id,b.required_permission_id FROM permission_requirements a JOIN permission_requirements b
      ON b.permission_id=a.required_permission_id WHERE a.permission_id<>b.required_permission_id ON CONFLICT DO NOTHING`,{transaction});
    for (const table of ['learner_code_types','learner_code_rules','learner_code_abbreviations']) {
      await qi.sequelize.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
        CREATE POLICY code_read ON ${table} FOR SELECT TO pgsms_group_scoped USING
          (app_institution_permission('learnercode.config.view',false) OR app_institution_permission('admission.view',false));
        CREATE POLICY code_write ON ${table} FOR ALL TO pgsms_group_scoped USING
          (app_institution_permission('learnercode.config.manage',true) AND NOT app_group_scope_enabled(true))
          WITH CHECK(app_institution_permission('learnercode.config.manage',true) AND NOT app_group_scope_enabled(true));`,{transaction});
    }
    await qi.sequelize.query(`ALTER TABLE learner_code_counters ENABLE ROW LEVEL SECURITY;
      CREATE POLICY counter_read ON learner_code_counters FOR SELECT TO pgsms_group_scoped USING
        (app_institution_permission('learnercode.preview',false) OR app_institution_permission('learnercode.config.view',false));
      CREATE POLICY counter_write ON learner_code_counters FOR ALL TO pgsms_group_scoped USING
        (app_institution_permission('learnercode.issue',true) OR app_institution_permission('learnercode.reissue',true)
         OR (app_institution_permission('learnercode.counter.advance',true) AND NOT app_group_scope_enabled(true)))
        WITH CHECK(app_institution_permission('learnercode.issue',true) OR app_institution_permission('learnercode.reissue',true)
         OR (app_institution_permission('learnercode.counter.advance',true) AND NOT app_group_scope_enabled(true)));
      ALTER TABLE learner_code_events ENABLE ROW LEVEL SECURITY;
      CREATE POLICY code_history_read ON learner_code_events FOR SELECT TO pgsms_group_scoped USING
        (app_institution_permission('learnercode.history.view',false) AND (app_record_allowed(record_id,false) OR app_admission_unassigned_allowed(record_id,false)));
      CREATE POLICY code_history_write ON learner_code_events FOR INSERT TO pgsms_group_scoped WITH CHECK
        (actor_id::text=current_setting('app.group_staff_id',true) AND profile_id::text=current_setting('app.active_profile_id',true));
      ALTER TABLE learner_code_requests ENABLE ROW LEVEL SECURITY;
      CREATE POLICY code_request_owner ON learner_code_requests FOR ALL TO pgsms_group_scoped USING
        (actor_id::text=current_setting('app.group_staff_id',true) AND profile_id::text=current_setting('app.active_profile_id',true))
        WITH CHECK(actor_id::text=current_setting('app.group_staff_id',true) AND profile_id::text=current_setting('app.active_profile_id',true));`,{transaction});
  });
}
export async function down() { throw new Error('Không tự xóa lịch sử mã học viên hoặc tái sử dụng bộ đếm. Khôi phục từ bản sao lưu đã kiểm chứng.'); }
