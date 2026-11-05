import { isIsolatedScopeDatabase } from '../helpers/isolated-database.js';
import { randomUUID } from 'node:crypto';
import { QueryTypes, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

const describeDb=process.env.RUN_GROUP_SCOPE_POSTGRES_TESTS==='true'?describe:describe.skip;
describeDb('Gradebook responsibility through real PostgreSQL RLS',()=>{
  let db:Sequelize,tx:Transaction;
  let ids:Record<string,string>;
  const q=(sql:string,replacements:any={})=>db.query<any>(sql,{transaction:tx,replacements,type:QueryTypes.SELECT})
    .catch(error=>{throw new Error(error.original?.message||error.message);});
  beforeAll(()=>{
    if(!isIsolatedScopeDatabase(process.env.DATABASE_URL))throw new Error('Use the isolated pgsms_group_scope_test database.');
    db=new Sequelize(process.env.DATABASE_URL,{logging:false});
  });
  beforeEach(async()=>{
    ids=Object.fromEntries(['a','b','admin','role','discipline','major','groupA','groupB','groupC','merged','single','hidden','subject','bookA','bookB','bookC','room','arrangement','snapshotA','snapshotC','examA','examC'].map(key=>[key,randomUUID()]));
    tx=await db.transaction();
    for(const code of ['gradebook.view','gradebook.submit','gradebook.approve','exams.view','exams.write'])await q(`INSERT INTO permissions(id,code,name,"group",created_at,updated_at)
      VALUES(:id,:code,:code,'Gradebook',now(),now()) ON CONFLICT(code) DO NOTHING RETURNING id`,{id:randomUUID(),code});
    await q(`INSERT INTO roles(id,code,name,active,created_at,updated_at) VALUES(:id,:id,'Grade input',true,now(),now()) RETURNING id`,{id:ids.role});
    await q(`INSERT INTO role_permissions(role_id,permission_id,created_at,updated_at)
      SELECT :role,id,now(),now() FROM permissions WHERE code IN ('module.assessment','gradebook.view','gradebook.submit','exams.view','exams.write') RETURNING role_id`,{role:ids.role});
    const [adminRole]=await q(`INSERT INTO roles(id,code,name,active,created_at,updated_at)
      VALUES(:id,'admin','Admin',true,now(),now()) ON CONFLICT(code) DO UPDATE SET active=true RETURNING id`,{id:randomUUID()});
    ids.adminRole=adminRole.id;
    await q(`INSERT INTO role_permissions(role_id,permission_id,created_at,updated_at)
      SELECT :role,id,now(),now() FROM permissions WHERE code IN ('module.assessment','module.administration','gradebook.view','gradebook.submit','gradebook.approve','exams.view','exams.write')
      ON CONFLICT DO NOTHING RETURNING role_id`,{role:adminRole.id});
    for(const key of ['a','b','admin']){
      await q(`INSERT INTO staff(id,name,email,role,status) VALUES(:id,'Grade scope',:email,'examiner','active') RETURNING id`,{id:ids[key],email:ids[key]+'@example.invalid'});
      await q(`INSERT INTO staff_roles(staff_id,role_id,created_at,updated_at) VALUES(:staff,:role,now(),now()) RETURNING staff_id`,{staff:ids[key],role:key==='admin'?adminRole.id:ids.role});
    }
    for(const [group,staff] of [['groupA','a'],['groupB','b'],['groupC','b']])await q(`INSERT INTO class_groups(id,code,name,program,responsible_staff_id,created_at,updated_at)
      VALUES(:id,:id,:id,'masters',:staff,now(),now()) RETURNING id`,{id:ids[group],staff:ids[staff]});
    await q(`INSERT INTO disciplines(id,code,name,created_at,updated_at) VALUES(:id,:code,'Scope discipline',now(),now()) RETURNING id`,{id:ids.discipline,code:'GS'+ids.discipline.slice(0,8)});
    await q(`INSERT INTO majors(id,discipline_id,code,name,program,created_at,updated_at) VALUES(:id,:discipline,:code,'Scope major','masters',now(),now()) RETURNING id`,{id:ids.major,discipline:ids.discipline,code:'GS'+ids.major.slice(0,8)});
    await q(`INSERT INTO subjects(id,major_id,code,name,program,created_at,updated_at) VALUES(:id,:major,:code,'Scope subject','masters',now(),now()) RETURNING id`,{id:ids.subject,major:ids.major,code:'GS'+ids.subject.slice(0,8)});
    for(const key of ['merged','single','hidden'])await q(`INSERT INTO course_offerings(id,subject_id,name,created_at,updated_at)
      VALUES(:id,:subject,'Grade scope',now(),now()) RETURNING id`,{id:ids[key],subject:ids.subject});
    for(const [offering,group] of [['merged','groupA'],['merged','groupB'],['single','groupA'],['hidden','groupC']])await q(`INSERT INTO course_offering_class_groups(id,course_offering_id,class_group_id,created_at,updated_at)
      VALUES(:id,:offering,:group,now(),now()) RETURNING id`,{id:randomUUID(),offering:ids[offering],group:ids[group]});
    for(const [book,offering,group] of [['bookA','merged','groupA'],['bookB','merged','groupB'],['bookC','hidden','groupC']])await q(`INSERT INTO course_exam_gradebooks(id,course_offering_id,class_group_id,grades,revision,created_at,updated_at)
      VALUES(:id,:offering,:group,'[]',1,now(),now()) RETURNING id`,{id:ids[book],offering:ids[offering],group:ids[group]});
  });
  afterEach(async()=>{if(tx&&!(tx as any).finished)await tx.rollback();});
  afterAll(async()=>{await db?.close();});
  const scoped=async(staff='a',permission='gradebook.submit',readOnly=false,domain='gradebook')=>{
    await db.query('SET LOCAL ROLE pgsms_group_scoped',{transaction:tx});
    await q(`SELECT set_config('app.group_staff_id',:staff,true),set_config('app.academic_domain',:domain,true),
      set_config('app.academic_permission',:permission,true),set_config('app.group_read_only',:readonly,true),
      set_config('app.scheduling_action','',true),set_config('app.group_view_restricted','false',true),set_config('app.group_edit_restricted','false',true)`,
      {staff:ids[staff],permission,readonly:String(readOnly),domain});
  };

  it('shows both groups of a related merged class and hides unrelated classes even with old unrestricted flags',async()=>{
    await scoped();
    expect((await q('SELECT id FROM course_offerings WHERE id IN (:ids)',{ids:[ids.merged,ids.single,ids.hidden]})).map(row=>row.id).sort())
      .toEqual([ids.merged,ids.single].sort());
    expect((await q('SELECT id FROM class_groups WHERE id IN (:ids)',{ids:[ids.groupA,ids.groupB,ids.groupC]})).map(row=>row.id).sort())
      .toEqual([ids.groupA,ids.groupB].sort());
    expect((await q('SELECT id FROM course_exam_gradebooks WHERE id IN (:ids)',{ids:[ids.bookA,ids.bookB,ids.bookC]})).map(row=>row.id).sort())
      .toEqual([ids.bookA,ids.bookB].sort());
  });
  it('lets either responsible member edit all books of the merged class',async()=>{
    await scoped();
    expect(await q('UPDATE course_exam_gradebooks SET revision=revision+1 WHERE id=:id RETURNING id',{id:ids.bookA})).toHaveLength(1);
    expect(await q('UPDATE course_exam_gradebooks SET revision=revision+1 WHERE id=:id RETURNING id',{id:ids.bookB})).toHaveLength(1);
    expect(await q('UPDATE course_exam_gradebooks SET revision=revision+1 WHERE id=:id RETURNING id',{id:ids.bookC})).toHaveLength(0);
    await db.query('RESET ROLE',{transaction:tx});await scoped('b');
    expect(await q('UPDATE course_exam_gradebooks SET revision=revision+1 WHERE id=:id RETURNING id',{id:ids.bookB})).toHaveLength(1);
    expect(await q('UPDATE course_exam_gradebooks SET revision=revision+1 WHERE id=:id RETURNING id',{id:ids.bookA})).toHaveLength(1);
  });
  it('allows automatic eligibility with input permission while final approval remains protected',async()=>{
    await scoped();const snapshot=randomUUID();
    await q(`INSERT INTO course_exam_workflows(course_offering_id) VALUES(:id) RETURNING course_offering_id`,{id:ids.merged});
    expect(await q(`INSERT INTO course_exam_eligibility_snapshots(id,course_offering_id,version,rows,actor)
      VALUES(:snapshot,:offering,1,'[]','{}') RETURNING id`,{snapshot,offering:ids.merged})).toHaveLength(1);
    expect(await q(`UPDATE course_exam_workflows SET eligibility_status='approved',eligibility_snapshot_id=:snapshot
      WHERE course_offering_id=:offering RETURNING course_offering_id`,{snapshot,offering:ids.merged})).toHaveLength(1);
    await expect(db.transaction({transaction:tx},savepoint=>db.query(`UPDATE course_exam_workflows SET result_status='approved'
      WHERE course_offering_id=:id`,{transaction:savepoint,replacements:{id:ids.merged}}))).rejects.toThrow();
  });
  it('keeps admin access to all classes and readonly still blocks writes',async()=>{
    await scoped('admin');
    expect(await q('SELECT id FROM course_offerings WHERE id=:id',{id:ids.hidden})).toHaveLength(1);
    expect(await q('UPDATE course_exam_gradebooks SET revision=2 WHERE id=:id RETURNING id',{id:ids.bookC})).toHaveLength(1);
    await q("SELECT set_config('app.group_read_only','true',true)");
    expect(await q('UPDATE course_exam_gradebooks SET revision=3 WHERE id=:id RETURNING id',{id:ids.bookC})).toHaveLength(0);
  });

  async function examFixtures(){
    await q(`INSERT INTO rooms(id,code,name,capacity,is_active,created_at,updated_at)
      VALUES(:id,:code,'Scope room',40,true,now(),now()) RETURNING id`,{id:ids.room,code:'ER'+ids.room.slice(0,8)});
    await q(`INSERT INTO course_exam_arrangements(id,note) VALUES(:id,'Scope arrangement') RETURNING id`,{id:ids.arrangement});
    for(const [snapshot,offering,session,round] of [['snapshotA','merged','examA',1],['snapshotC','hidden','examC',2]] as const){
      await q(`INSERT INTO course_exam_eligibility_snapshots(id,course_offering_id,version,rows,actor)
        VALUES(:id,:offering,1,'[]','{}') RETURNING id`,{id:ids[snapshot],offering:ids[offering]});
      await q(`INSERT INTO course_exam_sessions(id,arrangement_id,round_no,course_offering_id,eligibility_snapshot_id,exam_date,start_time,end_time,room_id,created_by,updated_by)
        VALUES(:id,:arrangement,:round,:offering,:snapshot,'2099-01-01','08:00','10:00',:room,:actor,:actor) RETURNING id`,
        {id:ids[session],arrangement:ids.arrangement,round,offering:ids[offering],snapshot:ids[snapshot],room:ids.room,actor:ids.a});
    }
  }

  it('uses independent exam permissions and only writes related exams while retaining global conflict reads',async()=>{
    await examFixtures();await scoped('a','exams.write',false,'exam');
    expect(await q('SELECT id FROM course_exam_sessions WHERE id IN (:ids)',{ids:[ids.examA,ids.examC]})).toHaveLength(2);
    expect(await q("UPDATE course_exam_sessions SET note='allowed' WHERE id=:id RETURNING id",{id:ids.examA})).toHaveLength(1);
    expect(await q("UPDATE course_exam_sessions SET note='blocked' WHERE id=:id RETURNING id",{id:ids.examC})).toHaveLength(0);
    await q("SELECT set_config('app.academic_permission','scheduling.write',true)");
    expect(await q("UPDATE course_exam_sessions SET note='legacy blocked' WHERE id=:id RETURNING id",{id:ids.examA})).toHaveLength(0);
  });

  it('does not let exam-view or readonly accounts change exams',async()=>{
    await examFixtures();await scoped('a','exams.view',false,'exam');
    expect(await q("UPDATE course_exam_sessions SET note='blocked' WHERE id=:id RETURNING id",{id:ids.examA})).toHaveLength(0);
    await q("SELECT set_config('app.academic_permission','exams.write',true),set_config('app.group_read_only','true',true)");
    expect(await q("UPDATE course_exam_sessions SET note='blocked' WHERE id=:id RETURNING id",{id:ids.examA})).toHaveLength(0);
  });

  it('does not combine privileges from another assigned profile or grant admin scope from it',async()=>{
    await q(`INSERT INTO staff_roles(staff_id,role_id,created_at,updated_at) VALUES(:staff,:role,now(),now()) RETURNING staff_id`,{staff:ids.a,role:ids.adminRole});
    await scoped('a','gradebook.approve');
    await q("SELECT set_config('app.profile_enforced','true',true),set_config('app.active_profile_id',:role,true)",{role:ids.role});
    expect(await q("SELECT app_institution_permission('gradebook.approve',true) AS allowed,app_gradebook_admin() AS admin"))
      .toEqual([{allowed:false,admin:false}]);
    await q("SELECT set_config('app.active_profile_id',:role,true)",{role:ids.adminRole});
    expect(await q("SELECT app_institution_permission('gradebook.approve',true) AS allowed,app_gradebook_admin() AS admin"))
      .toEqual([{allowed:true,admin:true}]);
    await q("SELECT set_config('app.active_profile_id','',true)");
    expect(await q("SELECT app_institution_permission('gradebook.approve',true) AS allowed")).toEqual([{allowed:false}]);
  });

  it('requires the real module foreign-key grant and records the actor profile with before/after values',async()=>{
    await scoped();await q("SELECT set_config('app.profile_enforced','true',true),set_config('app.active_profile_id',:role,true),set_config('app.actor_profile_id',:role,true),set_config('app.actor_staff_id',:staff,true)",{role:ids.role,staff:ids.a});
    expect(await q('UPDATE course_exam_gradebooks SET revision=2 WHERE id=:id RETURNING id',{id:ids.bookA})).toHaveLength(1);
    await db.query('RESET ROLE',{transaction:tx});
    const [log]=await q(`SELECT actor_profile_id,actor_profile,old_data->>'revision' AS before,new_data->>'revision' AS after
      FROM db_change_logs WHERE table_name='course_exam_gradebooks' AND new_data->>'id'=:id AND operation='UPDATE'
      ORDER BY id DESC LIMIT 1`,{id:ids.bookA});
    expect(log).toMatchObject({actor_profile_id:ids.role,actor_profile:{id:ids.role,name:'Grade input'},before:'1',after:'2'});
    await q(`DELETE FROM role_permissions WHERE role_id=:role AND permission_id=(SELECT id FROM permissions WHERE code='module.assessment') RETURNING role_id`,{role:ids.role});
    await scoped();await q("SELECT set_config('app.profile_enforced','true',true),set_config('app.active_profile_id',:role,true)",{role:ids.role});
    expect(await q("SELECT app_institution_permission('gradebook.submit',true) AS allowed")).toEqual([{allowed:false}]);
    expect(await q('UPDATE course_exam_gradebooks SET revision=3 WHERE id=:id RETURNING id',{id:ids.bookA})).toHaveLength(0);
  });
});
