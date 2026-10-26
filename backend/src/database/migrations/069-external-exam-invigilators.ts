export async function up({context:qi}:any){
 await qi.sequelize.transaction(async(transaction:any)=>{await qi.sequelize.query(`ALTER TABLE course_exam_sessions
  ADD COLUMN external_invigilator_name varchar(255),
  ADD COLUMN external_unit_name varchar(255),
  ADD COLUMN external_invigilator_key text,
  ADD CONSTRAINT course_exam_external_invigilator_consistent CHECK (
   (external_invigilator_name IS NULL AND external_unit_name IS NULL AND external_invigilator_key IS NULL)
   OR (lecturer_id IS NULL AND external_invigilator_name IS NOT NULL AND length(btrim(external_invigilator_name))>0
    AND external_unit_name IS NOT NULL AND length(btrim(external_unit_name))>0 AND external_invigilator_key IS NOT NULL));
  CREATE INDEX course_exam_sessions_external_invigilator_date
   ON course_exam_sessions(external_invigilator_key,exam_date) WHERE status IN ('scheduled','held');`,{transaction});});
}
export async function down({context:qi}:any){
 await qi.sequelize.transaction(async(transaction:any)=>{await qi.sequelize.query(`DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM course_exam_sessions WHERE external_invigilator_name IS NOT NULL)
  THEN RAISE EXCEPTION 'External invigilator history exists; downgrade refused'; END IF;
 END $$;
 ALTER TABLE course_exam_sessions DROP CONSTRAINT course_exam_external_invigilator_consistent,DROP COLUMN external_invigilator_name,DROP COLUMN external_unit_name,DROP COLUMN external_invigilator_key;`,{transaction});});
}
