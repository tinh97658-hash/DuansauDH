import {randomUUID} from 'node:crypto';
import {Sequelize} from 'sequelize-typescript';
import {QueryTypes} from 'sequelize';
import {ExamScheduleService} from '../../src/masters/exam-schedule.service.js';
import {ExamWorkflowService} from '../../src/masters/exam-workflow.service.js';
import {Staff} from '../../src/database/models/staff.model.js';
import {up as workflowUp} from '../../src/database/migrations/066-masters-exam-workflow.js';
import {up as lecturerUp} from '../../src/database/migrations/067-exam-session-lecturer.js';
import {up as arrangementsUp,down as arrangementsDown} from '../../src/database/migrations/068-exam-arrangements.js';
import {up as externalInvigilatorsUp} from '../../src/database/migrations/069-external-exam-invigilators.js';

const describeDb=process.env.RUN_POSTGRES_EXAM_ARRANGEMENT_TESTS==='true'?describe:describe.skip;
describeDb('Grouped exam reservations on PostgreSQL',()=>{
 let db:Sequelize,admin:Sequelize,service:ExamScheduleService,actor:any,room:string,lecturer:string;
 const schema='exam_arrangement_test_'+randomUUID().replace(/-/g,'');
 const sql=(q:string,r:any={})=>db.query(q,{replacements:r,type:QueryTypes.SELECT}) as Promise<any[]>;
 const date='2099-05-04';
 async function offering(people:string[],name='Triết học'){
  const id=randomUUID(),subject=randomUUID(),snapshot=randomUUID();
  await sql(`INSERT INTO subjects(id,name,program) VALUES(:subject,:name,'masters');
    INSERT INTO course_offerings(id,subject_id,name,status) VALUES(:id,:subject,:name,'completed');
    INSERT INTO course_exam_eligibility_snapshots(id,course_offering_id,version,rows,actor) VALUES(:snapshot,:id,1,CAST(:rows AS jsonb),'{}');
    INSERT INTO course_exam_workflows(course_offering_id,eligibility_status,eligibility_version,eligibility_snapshot_id) VALUES(:id,'approved',1,:snapshot)`,
    {id,subject,snapshot,name,rows:JSON.stringify(people.map(participantId=>({participantId,fullName:participantId,eligible:true,examExempt:false})))});
  return {courseOfferingId:id,snapshotId:snapshot,eligibilityVersion:1,roundNo:1,startTime:'08:00',endTime:'09:00'};
 }
 const payload=(groups:any[],extra:any={})=>({examDate:date,period:'MORNING' as const,roomId:room,lecturerId:lecturer,groups,...extra});
 beforeAll(async()=>{
  if(!process.env.TEST_DATABASE_URL)throw new Error('Set TEST_DATABASE_URL to a disposable PostgreSQL database.');
  admin=new Sequelize(process.env.TEST_DATABASE_URL,{logging:false});await admin.query(`CREATE SCHEMA ${schema}`);
  db=new Sequelize(process.env.TEST_DATABASE_URL,{logging:false,dialectOptions:{options:`-c search_path=${schema}`}});
  await sql(`CREATE TABLE staff(id uuid PRIMARY KEY);
    CREATE TABLE subjects(id uuid PRIMARY KEY,name text,code text,program text);
    CREATE TABLE course_offerings(id uuid PRIMARY KEY,subject_id uuid,name text,status text,gradebook_status text DEFAULT 'draft',gradebook_snapshot jsonb,gradebook_version int DEFAULT 0);
    CREATE TABLE course_exam_gradebooks(course_offering_id uuid,grades jsonb);
    CREATE TABLE rooms(id uuid PRIMARY KEY,capacity int,is_active boolean,code text,name text);
    CREATE TABLE lecturers(id uuid PRIMARY KEY,active boolean,code text,name text,unit_id uuid);
    CREATE TABLE units(id uuid,code text,name text,active boolean,sort_order int);
    CREATE TABLE course_offering_class_groups(course_offering_id uuid,class_group_id uuid);
    CREATE TABLE class_groups(id uuid,name text,code text,academic_year text,major_id uuid);
    CREATE TABLE majors(id uuid,name text,discipline_id uuid);
    CREATE TABLE disciplines(id uuid,name text);
    CREATE TABLE admission_records(id uuid PRIMARY KEY,student_id uuid);
    CREATE TABLE gradebook_events(id uuid,course_offering_id uuid,action text,actor jsonb,note text,before_data jsonb,after_data jsonb);
    CREATE FUNCTION audit_capture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;`);
  await workflowUp({context:db.getQueryInterface()});await lecturerUp({context:db.getQueryInterface()});
  const actorId=randomUUID();room=randomUUID();lecturer=randomUUID();
  actor=Object.create(Staff.prototype);Object.defineProperties(actor,{id:{value:actorId},name:{value:'Scheduler'},role:{value:'admin'}});
  await sql('INSERT INTO staff VALUES(:id); INSERT INTO rooms VALUES(:room,30,true); INSERT INTO lecturers VALUES(:lecturer,true)',{id:actorId,room,lecturer});
  const rbac:any={effectiveAccess:async()=>({permissions:new Set(['scheduling.write'])})};
  // Verify backfill against a real pre-migration session and roster.
  const legacy=await offering(['legacy']);const session=randomUUID();
  await sql(`INSERT INTO course_exam_sessions(id,course_offering_id,eligibility_snapshot_id,exam_date,start_time,end_time,room_id,lecturer_id,created_by,updated_by)
    VALUES(:session,:offering,:snapshot,'2098-01-01','08:00','09:00',:room,:lecturer,:actor,:actor)`,{session,offering:legacy.courseOfferingId,snapshot:legacy.snapshotId,room,lecturer,actor:actorId});
  await arrangementsUp({context:db.getQueryInterface()});
  await externalInvigilatorsUp({context:db.getQueryInterface()});
  expect((await sql('SELECT arrangement_id,round_no FROM course_exam_sessions WHERE id=:id',{id:session}))[0]).toEqual({arrangement_id:session,round_no:1});
  service=new ExamScheduleService(db,new ExamWorkflowService(db,rbac),rbac);
 },30000);
 beforeEach(async()=>{
  // Unique resources isolate scenarios without deleting immutable exam history.
  room=randomUUID();lecturer=randomUUID();
  await sql('INSERT INTO rooms VALUES(:room,30,true); INSERT INTO lecturers VALUES(:lecturer,true)',{room,lecturer});
 });
 afterAll(async()=>{await db?.close();if(admin){await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.close();}});
 it('handles all three scenarios, peaks at 30 seats, cancels one group and preserves all other slots',async()=>{
  const a=await offering(['a1','a2']),b=await offering(['b1'],'Xác suất'),c=await offering(['a1','a2'],'Xác suất'),d=await offering(['b1'],'Kinh tế');
  const result=await service.saveArrangement(null,payload([a,b,{...c,roundNo:2,startTime:'09:15',endTime:'10:45'},{...d,roundNo:2,startTime:'09:15',endTime:'10:15'}]),actor);
  const before=await sql('SELECT * FROM course_exam_sessions WHERE arrangement_id=:id ORDER BY id',{id:result.id});
  await service.cancel(result.sessionIds[0],{version:0,note:'Hoãn riêng Triết'},actor);
  const after=await sql('SELECT * FROM course_exam_sessions WHERE arrangement_id=:id ORDER BY id',{id:result.id});
  expect(after.filter(s=>s.id!==result.sessionIds[0])).toEqual(before.filter(s=>s.id!==result.sessionIds[0]));
  expect(after.find(s=>s.id===result.sessionIds[0]).status).toBe('cancelled');
  expect((await sql('SELECT * FROM course_exam_session_candidates WHERE session_id=:id',{id:result.sessionIds[0]}))).toHaveLength(2);
  expect((await sql('SELECT * FROM course_exam_workflows WHERE course_offering_id=:id',{id:a.courseOfferingId}))[0].result_status).toBe('not_available');
  const listed=await service.list({from:date,to:date});
  expect(listed.sessions.filter(s=>s.arrangementId===result.id)).toHaveLength(4);
  expect(listed.queue.some(o=>o.id===a.courseOfferingId)).toBe(true);
  expect(listed.queue.some(o=>o.id===b.courseOfferingId)).toBe(false);
 });
 it('blocks concurrent candidates even after an admission identity has been linked to a student',async()=>{
  const record=randomUUID(),student=randomUUID();await sql('INSERT INTO admission_records VALUES(:record,:student)',{record,student});
  const a=await offering(['admission:'+record]),b=await offering(['student:'+student]);
  await expect(service.saveArrangement(null,payload([a,b]),actor)).rejects.toMatchObject({response:{code:'EXAM_CANDIDATE_CONFLICT'}});
  expect(await sql('SELECT id FROM course_exam_sessions WHERE course_offering_id IN (:ids)',{ids:[a.courseOfferingId,b.courseOfferingId]})).toHaveLength(0);
  await expect(service.saveArrangement(null,payload([a,{...b,roundNo:2,startTime:'09:15',endTime:'10:15'}]),actor)).resolves.toBeDefined();
 });
 it('uses combined capacity in a round, not total participation across consecutive rounds',async()=>{
  const people=(prefix:string,n:number)=>Array.from({length:n},(_,i)=>prefix+i);
  const a=await offering(people('cap_a',15)),b=await offering(people('cap_b',9)),c=await offering(people('cap_a',18)),d=await offering(people('cap_b',12));
  await expect(service.saveArrangement(null,payload([a,b,{...c,roundNo:2,startTime:'09:15',endTime:'10:15'},{...d,roundNo:2,startTime:'09:15',endTime:'10:45'}]),actor)).resolves.toBeDefined();
  const e=await offering(people('cap_e',20)),f=await offering(people('cap_f',11));
  await expect(service.saveArrangement(null,payload([e,f],{examDate:'2099-05-05'}),actor)).rejects.toMatchObject({response:{code:'EXAM_ROOM_CAPACITY'}});
 });
 it('reserves breaks between rounds and serializes competing room bookings',async()=>{
  const a=await offering(['gap_a']),b=await offering(['gap_a']);
  await service.saveArrangement(null,payload([a,{...b,roundNo:2,startTime:'10:00',endTime:'11:00'}]),actor);
  const c=await offering(['gap_c']);
  await expect(service.saveArrangement(null,payload([{...c,startTime:'08:30',endTime:'09:30'}]),actor)).rejects.toMatchObject({response:{code:'EXAM_ROOM_CONFLICT'}});
  const x=await offering(['race_x']),y=await offering(['race_y']);
  const results=await Promise.allSettled([service.saveArrangement(null,payload([x],{examDate:'2099-05-06'}),actor),service.saveArrangement(null,payload([y],{examDate:'2099-05-06'}),actor)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 });
 it('requires current versions and explicit cancellation instead of silently removing groups',async()=>{
  const a=await offering(['edit_a']),b=await offering(['edit_b']);
  const result=await service.saveArrangement(null,payload([a,b]),actor);
  const groups=[a,b].map((g,i)=>({...g,id:result.sessionIds[i],version:0}));
  await expect(service.saveArrangement(result.id,payload([groups[0]],{version:0}),actor)).rejects.toThrow('hủy riêng');
  await service.saveArrangement(result.id,payload(groups.map(g=>({...g,endTime:'09:30'})),{version:0}),actor);
  await expect(service.saveArrangement(result.id,payload(groups,{version:0}),actor)).rejects.toThrow('đã thay đổi');
  await expect(service.cancel(result.sessionIds[0],{version:0,note:'Stale'},actor)).rejects.toThrow('đã thay đổi');
 });
 it('preserves started groups while allowing changes to future groups',async()=>{
  const a=await offering(['started_a']),b=await offering(['started_b']);
  const result=await service.saveArrangement(null,payload([a,{...b,roundNo:2,startTime:'10:00',endTime:'11:00'}]),actor);
  // Simulate one ended group while keeping the other future, without changing identities.
  await sql("UPDATE course_exam_sessions SET exam_date='2000-01-01' WHERE id=:id",{id:result.sessionIds[0]});
  await service.confirm(result.sessionIds[0],{version:0,status:'held'},actor);
  expect((await sql('SELECT result_status FROM course_exam_workflows WHERE course_offering_id=:id',{id:a.courseOfferingId}))[0].result_status).toBe('draft');
  expect((await sql('SELECT result_status FROM course_exam_workflows WHERE course_offering_id=:id',{id:b.courseOfferingId}))[0].result_status).toBe('not_available');
  await expect(service.cancel(result.sessionIds[0],{version:1,note:'Cannot cancel held'},actor)).rejects.toThrow('đã được xử lý');
  await sql('UPDATE course_exam_sessions SET exam_date=:date WHERE id=:id',{date,id:result.sessionIds[0]});
  const groups=[{...a,id:result.sessionIds[0],version:1},{...b,id:result.sessionIds[1],version:0,roundNo:2,startTime:'10:00',endTime:'11:30'}];
  await expect(service.saveArrangement(result.id,payload(groups,{version:1}),actor)).resolves.toBeDefined();
  const unchanged=(await sql('SELECT status,start_time,end_time,version FROM course_exam_sessions WHERE id=:id',{id:result.sessionIds[0]}))[0];
  expect(unchanged).toEqual({status:'held',start_time:'08:00:00',end_time:'09:00:00',version:1});
 });
 it('refuses downgrade when grouped history exists',async()=>{
  await expect(arrangementsDown({context:db.getQueryInterface()})).rejects.toThrow('downgrade refused');
 });
 it('persists external invigilators and checks normalized names across rooms',async()=>{
  const a=await offering(['external_a']),b=await offering(['external_b']);
  const external={lecturerId:undefined,externalInvigilatorName:' Lê Văn Bình ',externalUnitName:' Trung tâm Khảo thí ',examDate:'2099-06-01'};
  const saved=await service.saveArrangement(null,payload([a],external),actor);
  const [row]=await sql('SELECT lecturer_id,external_invigilator_name,external_unit_name FROM course_exam_sessions WHERE id=:id',{id:saved.sessionIds[0]});
  expect(row).toEqual({lecturer_id:null,external_invigilator_name:'Lê Văn Bình',external_unit_name:'Trung tâm Khảo thí'});
  const otherRoom=randomUUID();await sql('INSERT INTO rooms(id,capacity,is_active) VALUES(:id,30,true)',{id:otherRoom});
  await expect(service.saveArrangement(null,payload([b],{...external,roomId:otherRoom,externalInvigilatorName:'lê  văn bình',externalUnitName:'trung tâm khảo thí'}),actor)).rejects.toMatchObject({response:{code:'EXAM_LECTURER_CONFLICT'}});
  await service.saveArrangement(saved.id,payload([{...a,id:saved.sessionIds[0],version:0}],{...external,version:0,externalInvigilatorName:'Giám thị mới'}),actor);
  expect((await sql('SELECT external_invigilator_name FROM course_exam_sessions WHERE id=:id',{id:saved.sessionIds[0]}))[0].external_invigilator_name).toBe('Giám thị mới');
 });
 it('requires complete external details and rejects mixed internal/external assignments',async()=>{
  const a=await offering(['invalid_external']);
  for(const extra of [
   {lecturerId:undefined,externalInvigilatorName:'   ',externalUnitName:'Đơn vị'},
   {lecturerId:undefined,externalInvigilatorName:'Giám thị',externalUnitName:'   '},
   {externalInvigilatorName:'Giám thị',externalUnitName:'Đơn vị'},
  ])await expect(service.saveArrangement(null,payload([a],extra),actor)).rejects.toThrow();
 });
 it.each(['MORNING','AFTERNOON'])('rejects closed %s periods before attempting to schedule',async(period)=>{
  const a=await offering(['expired_'+period]);
  await expect(service.saveArrangement(null,payload([{...a,startTime:period==='MORNING'?'10:00':'16:00',endTime:period==='MORNING'?'11:00':'17:00'}],{examDate:'2000-01-01',period}),actor)).rejects.toMatchObject({response:{code:'EXAM_PERIOD_CLOSED'}});
 });
});
