export async function up({context:qi}:any){
 await qi.sequelize.transaction(async(transaction:any)=>{
  await qi.sequelize.query(`ALTER TABLE course_exam_sessions
   ADD COLUMN second_lecturer_id uuid REFERENCES lecturers(id) ON DELETE RESTRICT,
   ADD COLUMN second_external_invigilator_name varchar(255),
   ADD COLUMN second_external_unit_name varchar(255),
   ADD COLUMN second_external_invigilator_key text,
   ADD CONSTRAINT course_exam_second_invigilator_consistent CHECK (
    (second_external_invigilator_name IS NULL AND second_external_unit_name IS NULL AND second_external_invigilator_key IS NULL)
    OR (second_lecturer_id IS NULL AND second_external_invigilator_name IS NOT NULL AND length(btrim(second_external_invigilator_name))>0
     AND second_external_unit_name IS NOT NULL AND length(btrim(second_external_unit_name))>0 AND second_external_invigilator_key IS NOT NULL)),
   ADD CONSTRAINT course_exam_distinct_invigilators CHECK (
    (lecturer_id IS NULL OR second_lecturer_id IS NULL OR lecturer_id<>second_lecturer_id)
    AND (external_invigilator_key IS NULL OR second_external_invigilator_key IS NULL OR external_invigilator_key<>second_external_invigilator_key));
   CREATE INDEX course_exam_sessions_second_lecturer_date ON course_exam_sessions(second_lecturer_id,exam_date) WHERE status IN ('scheduled','held');
   CREATE INDEX course_exam_sessions_second_external_date ON course_exam_sessions(second_external_invigilator_key,exam_date) WHERE status IN ('scheduled','held');`,{transaction});
 });
}
export async function down({context:qi}:any){
 await qi.sequelize.transaction(async(transaction:any)=>{
  await qi.sequelize.query(`DO $$ BEGIN
   IF EXISTS(SELECT 1 FROM course_exam_sessions WHERE second_lecturer_id IS NOT NULL OR second_external_invigilator_name IS NOT NULL)
   THEN RAISE EXCEPTION 'Second invigilator assignments exist; downgrade refused'; END IF;
  END $$;
  ALTER TABLE course_exam_sessions DROP CONSTRAINT course_exam_distinct_invigilators,
   DROP CONSTRAINT course_exam_second_invigilator_consistent,
   DROP COLUMN second_lecturer_id,DROP COLUMN second_external_invigilator_name,
   DROP COLUMN second_external_unit_name,DROP COLUMN second_external_invigilator_key;`,{transaction});
 });
}
