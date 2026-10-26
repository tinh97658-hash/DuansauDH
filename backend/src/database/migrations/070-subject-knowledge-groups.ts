import {SUBJECT_KNOWLEDGE_GROUPS} from '../../plan/subject-knowledge-groups.js';

export async function up({context:qi}:any){
 await qi.sequelize.transaction(async(transaction:any)=>{
  await qi.sequelize.query(`SELECT pg_advisory_xact_lock(714062);
   DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM curriculum_blocks WHERE code IN ('TC','CH') AND min_credits<>0)
    THEN RAISE EXCEPTION 'Review legacy elective/seminar credit minimums before migrating knowledge groups'; END IF;
   END $$;
   UPDATE subjects SET subject_type=CASE
    WHEN lower(name) LIKE '%thực tập%' THEN 'TT'
    WHEN lower(name) LIKE '%tốt nghiệp%' OR lower(name) LIKE '%luận văn%' OR lower(name) LIKE '%luận án%' THEN 'TN'
    WHEN subject_type IN ('TC','CH') THEN 'CN' ELSE subject_type END
   WHERE subject_type IN ('TC','CH') OR lower(name) LIKE '%thực tập%' OR lower(name) LIKE '%tốt nghiệp%' OR lower(name) LIKE '%luận văn%' OR lower(name) LIKE '%luận án%';`,{transaction});
  for(const group of SUBJECT_KNOWLEDGE_GROUPS)await qi.sequelize.query(`
   INSERT INTO curriculum_blocks(id,curriculum_id,code,name,min_credits,sort_order,created_at,updated_at)
    SELECT gen_random_uuid(),id,:code,:name,0,:sort,now(),now() FROM curriculums
   ON CONFLICT(curriculum_id,code) DO UPDATE SET name=EXCLUDED.name,sort_order=EXCLUDED.sort_order,updated_at=now()`,
   {transaction,replacements:{code:group.code,name:group.name,sort:group.sortOrder}});
  await qi.sequelize.query(`UPDATE curriculum_subjects cs SET block_id=b.id,updated_at=now()
   FROM subjects s,curriculum_blocks b,curriculum_blocks old
   WHERE s.id=cs.subject_id AND b.curriculum_id=cs.curriculum_id AND b.code=s.subject_type
    AND old.id=cs.block_id AND old.code IN ('KC','CS','CN','TC','CH') AND cs.block_id<>b.id;
   DELETE FROM curriculum_blocks b WHERE b.code IN ('TC','CH') AND NOT EXISTS(SELECT 1 FROM curriculum_subjects cs WHERE cs.block_id=b.id);`,{transaction});
 });
}
export async function down(){
 throw new Error('Knowledge-group classification cannot be reconstructed automatically; restore the verified backup to roll back.');
}
