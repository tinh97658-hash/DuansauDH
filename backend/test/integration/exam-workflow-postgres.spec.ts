import {randomUUID} from 'node:crypto';
import {NestFactory} from '@nestjs/core';
import {getConnectionToken} from '@nestjs/sequelize';
import {Sequelize} from 'sequelize-typescript';
import {AppModule} from '../../src/app.module.js';
import {ExamGradebookService} from '../../src/masters/exam-gradebook.service.js';
import {ExamWorkflowService} from '../../src/masters/exam-workflow.service.js';
import {ExamScheduleService} from '../../src/masters/exam-schedule.service.js';
import {AuditContextService} from '../../src/audit/audit-context.js';
import {up,down} from '../../src/database/migrations/066-masters-exam-workflow.js';
import {up as addLecturer} from '../../src/database/migrations/067-exam-session-lecturer.js';
import {LEGACY_GRADING_POLICY} from '../../src/masters/grading-policy.js';
import {ClassScoreSummaryService} from '../../src/reports/class-score-summary.service.js';
import {ExamScheduleQueryDto} from '../../src/masters/dto/exam-schedule.dto.js';
import {GradingPolicyService} from '../../src/masters/grading-policy.service.js';

const describeDb=process.env.RUN_POSTGRES_EXAM_TESTS==='true'?describe:describe.skip;
describeDb('Two-phase exam workflow and scheduling on PostgreSQL',()=>{
 let app:any,db:Sequelize,m:any,grades:ExamGradebookService,workflow:ExamWorkflowService,schedule:ExamScheduleService,f:any;
 let legacy:any[],legacyGrades:any[];
 const sql=async(q:string,replacements:any={})=>workflow.query(q,replacements);
 async function fixture(){
  const code='EW'+randomUUID().replace(/-/g,'').slice(0,9);
  const actor=await m.Staff.create({name:code,email:code.toLowerCase()+'@example.invalid',role:'admin'});
  const discipline=await m.Discipline.create({code,name:code,active:true});
  const major=await m.Major.create({code,name:code,disciplineId:discipline.id,program:'masters',active:true});
  const subject=await m.Subject.create({code,codeText:code,codeNumber:1,name:code,majorId:major.id,program:'masters',credits:3,active:true});
  const curriculum=await m.Curriculum.create({code,name:code,majorId:major.id,program:'masters',applicableFromYear:'2026'});
  const block=await m.CurriculumBlock.create({curriculumId:curriculum.id,code:'KC',name:code});
  await m.CurriculumSubject.create({curriculumId:curriculum.id,blockId:block.id,subjectId:subject.id});
  const group=await m.ClassGroup.create({code,name:code,majorId:major.id,program:'masters',academicYear:'2026',curriculumId:curriculum.id});
  const people=[];for(let i=0;i<2;i++)people.push(await m.AdmissionRecord.create({code:code+i,fullName:code+' Learner '+i,majorId:major.id,trainingLevel:'Thạc sĩ',academicYear:'2026',status:'approved',studyStatus:'Đang học'}));
  await m.ClassGroupMember.bulkCreate(people.map(p=>({admissionRecordId:p.id,classGroupId:group.id})));
  const offering=await m.CourseOffering.create({subjectId:subject.id,name:code,status:'completed',completedAt:new Date(),completedByStaffId:actor.id});
  await m.CourseOfferingClassGroup.create({courseOfferingId:offering.id,classGroupId:group.id});
  const room=await m.Room.create({code,name:code,capacity:2,isActive:true});
  const lecturer=await m.Lecturer.create({code,name:code,active:true});
  return {actor,subject,group,people,offering,room,lecturer,scope:{classGroupId:group.id,courseOfferingId:offering.id,rosterScope:'offering' as const}};
 }
 async function read(){const first=await grades.get({...f.scope,page:1,pageSize:15});const rows=[...first.rows];for(let page=2;rows.length<first.total;page++)rows.push(...(await grades.get({...f.scope,page,pageSize:15})).rows);return {...first,rows};}
 async function save(overrides:any={}){
  const before=await read();return grades.save({...f.scope,revision:before.revision,rows:before.rows.map((r:any)=>({participantId:r.participantId,
   testScore:8,assignmentScore:8,examScore:null,examExempt:false,letterGrade:'',attemptScores:[],result:'pending',policyVersion:r.eligibilityPolicy.version,policyRulesVersion:r.eligibilityPolicy.rulesVersion,...overrides}))},f.actor);
 }
 async function transition(phase:'eligibility'|'final',action:'submit'|'approve'|'reopen',extra:any={}){
  const before=await read();return grades.transition({...f.scope,action,note:'QA exam workflow',revision:before.revision,version:(before.workflow as any)[phase].version,...extra},f.actor,phase);
 }
 async function approve(){await save();await transition('eligibility','submit');return transition('eligibility','approve');}
 async function exam(overrides:any={}){
  const state=(await read()).workflow as any;
  return schedule.schedule({courseOfferingId:f.offering.id,snapshotId:state.eligibility.snapshotId,eligibilityVersion:state.eligibility.version,
   examDate:'2099-05-04',startTime:'08:00',endTime:'10:00',roomId:f.room.id,lecturerId:f.lecturer.id,...overrides},f.actor);
 }
 async function ended(id:string){await db.query(`UPDATE course_exam_sessions SET exam_date='2000-01-01' WHERE id=:id`,{replacements:{id}});}
 async function held(){const e=await exam();await ended(e.id);await schedule.confirm(e.id,{version:0,note:'QA held',status:'held'},f.actor);return e;}
 async function saveExam(score:number|null=7){
  const b=await read();return grades.save({...f.scope,revision:b.revision,rows:b.rows.map((r:any)=>({participantId:r.participantId,testScore:r.testScore,assignmentScore:r.assignmentScore,
   examScore:score,examExempt:r.examExempt,letterGrade:'',attemptScores:[],result:'pending'}))},f.actor);
 }
 beforeAll(async()=>{
  process.env.NODE_ENV='test';app=await NestFactory.createApplicationContext(AppModule,{logger:false});db=app.get(getConnectionToken());m=db.models;
  const originalQuery=db.query.bind(db);
  db.query=((...args:any[])=>originalQuery(args[0],args[1]).catch((error:any)=>{throw new Error(error.original?.message||error.message);})) as any;
  grades=app.get(ExamGradebookService);workflow=app.get(ExamWorkflowService);schedule=app.get(ExamScheduleService);
  legacy=[];legacyGrades=[];
  for(const state of ['draft','submitted','approved']){
   const l=await fixture();const values=[{participantId:'admission:'+l.people[0].id,testScore:8,assignmentScore:8,examScore:7,courseScore:7.5,grade4:3,letterGrade:'B',result:'passed',finalized:state==='approved'}];
   await l.offering.update({gradebookStatus:state,gradebookSnapshot:state==='approved'?{rows:values}:null});
   await m.CourseExamGradebook.create({classGroupId:l.group.id,courseOfferingId:l.offering.id,grades:values,revision:3});legacy.push(l);legacyGrades.push(values);
  }
  await up({context:db.getQueryInterface()});
  await down({context:db.getQueryInterface()});
  await up({context:db.getQueryInterface()});
  await addLecturer({context:db.getQueryInterface()});
 },60000);
 beforeEach(async()=>{f=await fixture();});
 afterAll(async()=>{await app?.close();});

 it('persists and reloads the assigned exam lecturer and supports reassignment',async()=>{
  await save();await transition('eligibility','submit');await transition('eligibility','approve');
  const e=await exam();
  const find=async()=> (await schedule.list({from:'2099-05-04',to:'2099-05-05'})).sessions.find(s=>s.id===e.id);
  expect(await find()).toMatchObject({lecturerId:f.lecturer.id,lecturerName:f.lecturer.name});
  const peer=await fixture(),state=(await read()).workflow as any;
  await schedule.reschedule(e.id,{courseOfferingId:f.offering.id,snapshotId:state.eligibility.snapshotId,eligibilityVersion:state.eligibility.version,version:0,examDate:'2099-05-04',startTime:'08:00',endTime:'10:00',roomId:f.room.id,lecturerId:peer.lecturer.id},f.actor);
  expect(await find()).toMatchObject({lecturerId:peer.lecturer.id,lecturerName:peer.lecturer.name});
 });
 it('rejects missing and inactive lecturers without creating an exam',async()=>{
  await save();await transition('eligibility','submit');await transition('eligibility','approve');
  await expect(exam({lecturerId:undefined})).rejects.toThrow('chọn giảng viên');
  await f.lecturer.update({active:false});
  await expect(exam()).rejects.toThrow('giảng viên đang hoạt động');
  expect(await sql('SELECT id FROM course_exam_sessions WHERE course_offering_id=:id',{id:f.offering.id})).toHaveLength(0);
 });
 it('serializes overlapping exam bookings for one lecturer across different rooms and rosters',async()=>{
  await save();await transition('eligibility','submit');await transition('eligibility','approve');const first=f;
  f=await fixture();await save();await transition('eligibility','submit');await transition('eligibility','approve');const second=f;
  const payload=async(x:any)=>{const w=(await grades.get(x.scope)).workflow as any;return {courseOfferingId:x.offering.id,snapshotId:w.eligibility.snapshotId,eligibilityVersion:w.eligibility.version,examDate:'2099-08-01',startTime:'08:00',endTime:'10:00',roomId:x.room.id,lecturerId:first.lecturer.id};};
  const a=await payload(first),b=await payload(second),results=await Promise.allSettled([schedule.schedule(a,first.actor),schedule.schedule(b,second.actor)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  const failure=results.find(r=>r.status==='rejected') as PromiseRejectedResult;
  expect(failure.reason.response.code).toBe('EXAM_LECTURER_CONFLICT');
 });

 it('maps ambiguous old states conservatively and never rewrites legacy grades during up/down',async()=>{
  for(let i=0;i<legacy.length;i++){
   expect((await workflow.state(legacy[i].offering.id)).mode).toBe('legacy_preserved');
   const b=await m.CourseExamGradebook.findOne({where:{courseOfferingId:legacy[i].offering.id}});expect(b.grades).toEqual(legacyGrades[i]);
   expect((await grades.get(legacy[i].scope)).rows[0].examScore).toBe(7);
   await expect(grades.save({...legacy[i].scope,revision:3,rows:[]},legacy[i].actor)).rejects.toThrow('bảo toàn');
  }
 });
 it('tracks component entry, approval, actual held-exam end and complete marks from the same domain roster',async()=>{
  const offerings=[{id:f.offering.id,status:'completed',groupLinks:[{classGroupId:f.group.id}]}];
  const tracking=async()=> (await grades.tracking(offerings,true)).get(f.offering.id);
  expect(await tracking()).toMatchObject({componentsEntered:false,componentsApproved:false,examCompleted:false,examGradesComplete:false});
  await save();expect(await tracking()).toMatchObject({componentsEntered:true,componentsApproved:false});
  await transition('eligibility','submit');expect(await tracking()).toMatchObject({componentsEntered:true,componentsApproved:false});
  await transition('eligibility','approve');const approved=await tracking();
  const [snapshot]=await sql('SELECT created_at FROM course_exam_eligibility_snapshots WHERE course_offering_id=:id',{id:f.offering.id});
  expect(approved.componentScoreApprovedAt).toEqual(snapshot.created_at);expect(approved.componentsApproved).toBe(true);
  const e=await exam();expect((await tracking()).examCompleted).toBe(false);
  await ended(e.id);expect((await tracking()).examCompleted).toBe(false);
  await schedule.confirm(e.id,{version:0,status:'held'},f.actor);
  const confirmed=await tracking();expect(confirmed).toMatchObject({examCompleted:true,examGradesComplete:false});
  expect(new Date(confirmed.examCompletedAt).toISOString()).toBe('2000-01-01T03:00:00.000Z');
  await saveExam(0);expect((await tracking()).examGradesComplete).toBe(true);
  expect((await read()).offering.examGradesComplete).toBe(true);
  expect((await grades.options()).courseOfferings.find((o:any)=>o.id===f.offering.id)?.examGradesComplete).toBe(true);
  await saveExam(null);expect((await tracking()).examGradesComplete).toBe(false);
  expect((await read()).offering.examGradesComplete).toBe(false);
 });
 it('does not infer exam completion from Not Held or legacy grades',async()=>{
  await approve();const e=await exam();await ended(e.id);await schedule.confirm(e.id,{version:0,status:'not_held',note:'Hoãn thi'},f.actor);
  const rows=[{id:f.offering.id,status:'completed'},...legacy.map(l=>({id:l.offering.id,status:'completed'}))];
  const states=await grades.tracking(rows);
  expect(states.get(f.offering.id)).toMatchObject({componentsApproved:true,examCompleted:false,examGradesComplete:false,examCompletedAt:null});
  for(const [index,l] of legacy.entries())expect(states.get(l.offering.id)).toMatchObject({legacy:true,componentsApproved:false,examCompleted:false,examGradesComplete:index===2,examCompletedAt:null});
 });
 it('accepts transformed Nest query DTO instances instead of treating them as SQL replacement objects',async()=>{
  const result=await schedule.list(Object.assign(new ExamScheduleQueryDto(),{from:'2099-05-01',to:'2099-05-07'}));
  expect(result).toMatchObject({queue:expect.any(Array),rooms:expect.any(Array),sessions:expect.any(Array)});
 });
 it('blocks grade entry before teaching completion and exam marks during components',async()=>{
  await f.offering.update({status:'active',completedAt:null,completedByStaffId:null});await expect(save()).rejects.toThrow('hoàn thành');
  await f.offering.update({status:'completed',completedAt:new Date(),completedByStaffId:f.actor.id});await expect(save({examScore:7})).rejects.toThrow('giai đoạn');
 });
 it('requires both normal component marks and returns unresolved identities',async()=>{
  await save({assignmentScore:null});await expect(transition('eligibility','submit')).rejects.toMatchObject({response:{unresolved:expect.arrayContaining([expect.objectContaining({participantId:'admission:'+f.people[0].id})])}});
 });
 it('locks submitted components and rejects stale versions/revisions',async()=>{
  await save();await transition('eligibility','submit');await expect(save()).rejects.toThrow('đã khóa');
  await expect(transition('eligibility','approve',{version:0})).rejects.toThrow('Phiên bản');
  await expect(transition('eligibility','approve',{revision:0})).rejects.toThrow('Điểm đã thay đổi');
 });
 it('freezes identity, components, eligibility and policy, ignoring later profile/roster changes',async()=>{
  const approved=await approve(),ids=approved.rows.map((r:any)=>r.participantId);
  await f.people[0].update({fullName:'Changed after snapshot'});
  await m.ClassGroupMember.destroy({where:{admissionRecordId:f.people[0].id}});
  await db.query(`UPDATE course_exam_gradebooks SET grades=jsonb_set(grades,'{0,testScore}','1') WHERE course_offering_id=:id`,{replacements:{id:f.offering.id}});
  const result=await grades.get({...f.scope,mode:'exam',includeIds:'admission:fake',excludeIds:ids.join(',')});
  expect(result.rows.map((r:any)=>r.participantId)).toEqual(ids);expect(result.rows[0].testScore).toBe(8);expect(result.rows[0].fullName).not.toBe('Changed after snapshot');
  await expect(db.query('UPDATE course_exam_eligibility_snapshots SET rows=rows WHERE id=:id',{replacements:{id:(approved.workflow as any).eligibility.snapshotId}})).rejects.toThrow('immutable');
 });
 it('does not turn a new approved ineligible decision into 0/F or put it in DS thi',async()=>{
  await save({testScore:1});await transition('eligibility','submit');const b=await transition('eligibility','approve');
  expect(b.rows[0]).toMatchObject({eligible:false,examScore:null,courseScore:null,grade4:null,letterGrade:'',result:'pending'});
  expect((await grades.get({...f.scope,mode:'exam'})).total).toBe(0);await expect(exam()).rejects.toThrow('Không có thí sinh');
 });
 it('supports existing exemption completion without counting exempt people as exam candidates',async()=>{
  await save({examExempt:true,testScore:null,assignmentScore:null});await transition('eligibility','submit');const b=await transition('eligibility','approve');
  expect(b.rows.every((r:any)=>r.examExempt)).toBe(true);expect((await grades.get({...f.scope,mode:'exam'})).total).toBe(0);
 });
 it('allows audited eligibility reopening before scheduling and blocks it when history exists',async()=>{
  await approve();await transition('eligibility','reopen');await approve();await exam();
  await expect(transition('eligibility','reopen')).rejects.toThrow('Lịch thi');
 });
 it('requires approved eligibility, checks snapshot versions and uses candidate capacity',async()=>{
  await expect(exam()).rejects.toThrow('chưa duyệt');await approve();
  await expect(exam({eligibilityVersion:0})).rejects.toThrow('phiên bản');
  await f.room.update({capacity:1});await expect(exam()).rejects.toThrow('đủ 2');
  await f.room.update({capacity:2});await exam();
  expect((await sql('SELECT * FROM course_exam_session_candidates')).filter(r=>r.session_id)).not.toHaveLength(0);
 });
 it.each(['2000-01-01','2020-01-01'])('rejects past starts %s',async(date)=>{await approve();await expect(exam({examDate:date})).rejects.toThrow('đã bắt đầu');});
 it('allows Held without a reason, retains history and unlocks only its candidates',async()=>{
  await approve();const e=await exam();await ended(e.id);
  await schedule.confirm(e.id,{version:0,status:'held'},f.actor);
  const listed=await schedule.list({from:'2000-01-01',to:'2000-01-07'});
  const persisted=(await sql('SELECT status,note,confirmed_by FROM course_exam_sessions WHERE id=:id',{id:e.id}))[0];
  expect(persisted).toMatchObject({status:'held',note:'',confirmed_by:f.actor.id});
  expect((await read()).rows.every(r=>r.examScoreEditable)).toBe(true);
  expect(listed.queue.some(o=>o.id===f.offering.id)).toBe(false);
  await expect(schedule.cancel(e.id,{version:1,note:'must not erase held'},f.actor)).rejects.toThrow('đã được xử lý');
 });
 it('requires reasons for Not Held and future cancellation without changing session or releasing it',async()=>{
  await approve();const e=await exam();
  await expect(schedule.cancel(e.id,{version:0,note:'  '},f.actor)).rejects.toThrow('lý do');
  await ended(e.id);
  await expect(schedule.confirm(e.id,{version:0,status:'not_held'},f.actor)).rejects.toThrow('lý do');
  expect((await sql('SELECT status,version FROM course_exam_sessions WHERE id=:id',{id:e.id}))[0]).toMatchObject({status:'scheduled',version:0});
  expect((await read()).rows.every(r=>!r.examScoreEditable)).toBe(true);
 });
 it('rejects cancellation after the original start and preserves pending history',async()=>{
  await approve();const e=await exam();await ended(e.id);
  const before=await sql('SELECT * FROM course_exam_sessions WHERE id=:id',{id:e.id});
  await expect(schedule.cancel(e.id,{version:0,note:'Cannot erase elapsed history'},f.actor)).rejects.toThrow('đã bắt đầu');
  expect(await sql('SELECT * FROM course_exam_sessions WHERE id=:id',{id:e.id})).toEqual(before);
  expect((await read()).rows[0].examScoreEditable).toBe(false);
 });
 it('does not unlock exam scores when time passes without explicit confirmation',async()=>{
  await approve();const e=await exam();await ended(e.id);
  expect((await schedule.list({from:'2000-01-01',to:'2000-01-07'})).sessions.find(s=>s.id===e.id).pendingConfirmation).toBe(true);
  await expect(saveExam()).rejects.toThrow('đã khóa');expect((await read()).rows[0].examScoreEditable).toBe(false);
 });
 it('preserves not-held history, leaves scores locked and allows a new legitimate session',async()=>{
  await approve();const e=await exam();await ended(e.id);await schedule.confirm(e.id,{version:0,status:'not_held',note:'QA not held'},f.actor);
  await expect(saveExam()).rejects.toThrow('đã khóa');const replacement=await exam();expect(replacement.id).not.toBe(e.id);
  expect((await sql('SELECT status FROM course_exam_sessions WHERE id=:id',{id:e.id}))[0].status).toBe('not_held');
 });
 it('allows final grading only for held candidates, freezes components and keeps approvals separate',async()=>{
  await approve();await held();const b=await saveExam();expect(b.rows[0].courseScore).toBe(7.5);
  const row=b.rows[0];await expect(grades.save({...f.scope,revision:b.revision,rows:[{...row,testScore:1,examScore:7}]},f.actor)).rejects.toThrow('thành phần');
  await transition('final','submit');const final=await transition('final','approve');expect((final.workflow as any).final.status).toBe('approved');
  await expect(saveExam()).rejects.toThrow('đã khóa');const reopened=await transition('final','reopen');
  expect((reopened.workflow as any).eligibility.status).toBe('approved');expect((reopened.workflow as any).final.status).toBe('draft');
 });
 it('allows a held missing-score draft but blocks final submission',async()=>{
  await approve();await held();await saveExam(null);await expect(transition('final','submit')).rejects.toThrow('đủ kết quả');
 });
 it('requires end time and an unprocessed version for confirmation',async()=>{
  await approve();const e=await exam();await expect(schedule.confirm(e.id,{version:0,status:'held',note:'QA'},f.actor)).rejects.toThrow('chưa kết thúc');
  await ended(e.id);await expect(schedule.confirm(e.id,{version:3,status:'held',note:'QA'},f.actor)).rejects.toThrow('đã thay đổi');
 });
 it('cancels explicitly, preserves candidate history and allows safe eligibility reopening',async()=>{
  await approve();const e=await exam();await schedule.cancel(e.id,{version:0,note:'QA cancelled'},f.actor);
  await transition('eligibility','reopen');expect((await sql('SELECT status FROM course_exam_sessions WHERE id=:id',{id:e.id}))[0].status).toBe('cancelled');
  expect((await sql('SELECT * FROM course_exam_session_candidates WHERE session_id=:id',{id:e.id}))).toHaveLength(2);
 });
 it('reschedules future sessions with optimistic versions and retains snapshot/candidates',async()=>{
  const b=await approve(),e=await exam(),w=b.workflow as any;
  await schedule.reschedule(e.id,{courseOfferingId:f.offering.id,snapshotId:w.eligibility.snapshotId,eligibilityVersion:w.eligibility.version,version:0,examDate:'2099-05-05',startTime:'09:00',endTime:'10:00',roomId:f.room.id,lecturerId:f.lecturer.id},f.actor);
  await expect(schedule.cancel(e.id,{version:0,note:'QA stale'},f.actor)).rejects.toThrow('đã thay đổi');
  expect((await sql('SELECT * FROM course_exam_session_candidates WHERE session_id=:id',{id:e.id}))).toHaveLength(2);
 });
 it('releases cancelled room and candidates for the exact same slot while retaining history',async()=>{
  await approve();const old=await exam();await schedule.cancel(old.id,{version:0,note:'Đổi kế hoạch'},f.actor);
  const replacement=await exam();expect(replacement.id).not.toBe(old.id);
  expect((await sql('SELECT status,room_id,updated_by,note FROM course_exam_sessions WHERE id=:id',{id:old.id}))[0]).toMatchObject({status:'cancelled',room_id:f.room.id,updated_by:f.actor.id,note:'Đổi kế hoạch'});
  expect(await sql('SELECT participant_id FROM course_exam_session_candidates WHERE session_id=:id',{id:old.id})).toHaveLength(2);
  expect(await sql('SELECT participant_id FROM course_exam_session_candidates WHERE session_id=:id',{id:replacement.id})).toHaveLength(2);
 });
 it('retains academic filter metadata on cancelled history after eligibility is reopened',async()=>{
  await approve();const e=await exam();await schedule.cancel(e.id,{version:0,note:'Đổi kế hoạch'},f.actor);await transition('eligibility','reopen');
  const listed=await schedule.list({from:'2099-05-01',to:'2099-05-07'}),historic=listed.sessions.find(s=>s.id===e.id);
  expect(listed.approvedOfferings.some(o=>o.id===f.offering.id)).toBe(false);
  expect(historic).toMatchObject({subjectId:f.subject.id,subjectCode:f.subject.code,groups:[expect.objectContaining({id:f.group.id,majorId:f.group.majorId,disciplineId:expect.any(String),disciplineName:expect.any(String)})]});
 });
 it('requires real scheduling permissions independently of approval permission',async()=>{
  await approve();const noAccess=await m.Staff.create({name:'QA no access',email:randomUUID()+'@example.invalid',role:'unknown'});
  await expect(schedule.schedule({} as any,noAccess)).rejects.toThrow('quyền xếp lịch');
  await expect(grades.transition({...f.scope,action:'approve',revision:0,version:0,note:'QA'},noAccess,'eligibility')).rejects.toThrow('quyền');
 });
 it('counts only approved eligible candidates for capacity, excluding ineligible classmates',async()=>{
  const b=await read();await grades.save({...f.scope,revision:b.revision,rows:b.rows.map((r:any,i:number)=>({participantId:r.participantId,testScore:i?1:8,assignmentScore:8,examScore:null,examExempt:false,letterGrade:'',attemptScores:[],result:'pending',policyVersion:r.eligibilityPolicy.version,policyRulesVersion:r.eligibilityPolicy.rulesVersion}))},f.actor);
  await transition('eligibility','submit');await transition('eligibility','approve');await f.room.update({capacity:1});
  const e=await exam();expect(await sql('SELECT participant_id FROM course_exam_session_candidates WHERE session_id=:id',{id:e.id})).toHaveLength(1);
 });
 async function concurrentPair(sharedCandidates:boolean){
  const first=f;await approve();let second:any;
  if(sharedCandidates){
   const offering=await m.CourseOffering.create({subjectId:first.subject.id,name:'QA peer',status:'completed',completedAt:new Date(),completedByStaffId:first.actor.id});
   await m.CourseOfferingClassGroup.create({courseOfferingId:offering.id,classGroupId:first.group.id});
   second={...first,offering,scope:{...first.scope,courseOfferingId:offering.id}};
  }else second=await fixture();
  f=second;await approve();f=first;
  const payload=async(x:any)=>{const w=(await grades.get(x.scope)).workflow as any;return {courseOfferingId:x.offering.id,snapshotId:w.eligibility.snapshotId,eligibilityVersion:w.eligibility.version,examDate:'2099-07-01',startTime:'08:00',endTime:'10:00',roomId:sharedCandidates?x.room.id:first.room.id,lecturerId:x.lecturer.id};};
  const a=await payload(first),b=await payload(second);
  const results=await Promise.allSettled([schedule.schedule(a,first.actor),schedule.schedule(b,second.actor)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  const rejected=results.find(r=>r.status==='rejected') as PromiseRejectedResult;
  expect(rejected.reason.response.code).toBe(sharedCandidates?'EXAM_CANDIDATE_CONFLICT':'EXAM_ROOM_CONFLICT');
 }
 it('serializes concurrent room bookings across different offerings',()=>concurrentPair(false));
 it('serializes concurrent candidate bookings across different offerings and rooms',async()=>{
  // Same candidates, different room resources: only candidate locking can prevent the race.
  const original=f;const room=await m.Room.create({code:'Q'+randomUUID().slice(0,8),name:'QA second room',capacity:2,isActive:true});
  await approve();const offering=await m.CourseOffering.create({subjectId:f.subject.id,name:'QA peer candidate',status:'completed',completedAt:new Date(),completedByStaffId:f.actor.id});
  await m.CourseOfferingClassGroup.create({courseOfferingId:offering.id,classGroupId:f.group.id});
  f={...original,offering,room,scope:{...original.scope,courseOfferingId:offering.id}};await approve();const second=f;f=original;
  const payload=async(x:any)=>{const w=(await grades.get(x.scope)).workflow as any;return {courseOfferingId:x.offering.id,snapshotId:w.eligibility.snapshotId,eligibilityVersion:w.eligibility.version,examDate:'2099-07-02',startTime:'08:00',endTime:'10:00',roomId:x.room.id,lecturerId:x.lecturer.id};};
  const a=await payload(original),b=await payload(second);const results=await Promise.allSettled([schedule.schedule(a,original.actor),schedule.schedule(b,second.actor)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason.response.code).toBe('EXAM_CANDIDATE_CONFLICT');
 });
 it('retains semantic actor/correlation audit and refuses destructive down migration',async()=>{
  const audit=app.get(AuditContextService);await audit.runAsStaff(f.actor,()=>approve());
  const events=await sql('SELECT action,actor FROM gradebook_events WHERE course_offering_id=:id',{id:f.offering.id});
  expect(events.map(r=>r.action)).toEqual(expect.arrayContaining(['eligibility.save','eligibility.submit','eligibility.approve']));
  expect(events.every(r=>r.actor.id===f.actor.id)).toBe(true);
  expect((await sql("SELECT * FROM db_change_logs WHERE table_name='course_exam_eligibility_snapshots' AND actor_staff_id=:id",{id:f.actor.id})).length).toBeGreaterThan(0);
  await expect(down({context:db.getQueryInterface()})).rejects.toThrow('downgrade refused');
 });
 it('rejects approval when policy changes after component submission',async()=>{
  await save();await transition('eligibility','submit');
  await db.query(`INSERT INTO course_grading_policies(id,subject_id,academic_year,version,policy,created_at) VALUES(:id,:subject,'2026',1,CAST(:policy AS jsonb),now())`,{replacements:{id:randomUUID(),subject:f.subject.id,policy:JSON.stringify({...LEGACY_GRADING_POLICY,version:1,weights:{testScore:10,assignmentScore:20,examScore:70}})}});
  await expect(transition('eligibility','approve')).rejects.toThrow('cấu hình đã thay đổi');
 });
 it('uses configured weights and keeps frozen eligibility/policy through final reopening and report reads',async()=>{
  await db.query(`INSERT INTO course_grading_policies(id,subject_id,academic_year,version,policy,created_at) VALUES(:id,:subject,'2026',1,CAST(:policy AS jsonb),now())`,{replacements:{id:randomUUID(),subject:f.subject.id,policy:JSON.stringify({...LEGACY_GRADING_POLICY,version:1,weights:{testScore:10,assignmentScore:20,examScore:70}})}});
  await approve();await held();const b=await saveExam(6);expect(b.rows[0].courseScore).toBe(6.6);
  await transition('final','submit');await transition('final','approve');
  const ruleVersion=900000;
  try{
   await db.query('INSERT INTO shared_grading_rules(version,policy,created_at) VALUES(:version,CAST(:policy AS jsonb),now())',{replacements:{version:ruleVersion,policy:JSON.stringify({...LEGACY_GRADING_POLICY,version:ruleVersion,minimums:{testScore:9,assignmentScore:9,examScore:9}})}});
   await transition('final','reopen');expect((await read()).rows[0]).toMatchObject({eligible:true,courseScore:6.6,result:'passed'});
   const card=await app.get(ClassScoreSummaryService).learnerScorecard(f.people[0].id,f.group.id);
   expect(card.subjects[0].grade).toMatchObject({score:6.6,result:'passed',details:{eligibilityFrozen:true}});
  }finally{await db.query('DELETE FROM shared_grading_rules WHERE version=:version',{replacements:{version:ruleVersion}});}
 });
 it('prevents concurrent final mark overwrites using the grade revision',async()=>{
  await approve();await held();const b=await read();
  const payload={...f.scope,revision:b.revision,rows:b.rows.map((r:any)=>({...r,examScore:7}))};
  const result=await Promise.allSettled([grades.save(payload,f.actor),grades.save({...payload,rows:payload.rows.map((r:any)=>({...r,examScore:8}))},f.actor)]);
  expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((result.find(r=>r.status==='rejected') as PromiseRejectedResult).reason.message).toContain('Điểm đã thay đổi');
 });
 it.each([0,10,5.55])('accepts component and exam score boundary %s without zero coercion',async(score)=>{
  const rounded=Math.round((score+Number.EPSILON*10)*10)/10;
  await save({testScore:score,assignmentScore:score});expect((await read()).rows[0].testScore).toBe(rounded);
  if(score<5)await save();await transition('eligibility','submit');await transition('eligibility','approve');await held();
  const result=await saveExam(score);expect(result.rows[0].examScore).toBe(rounded);expect(result.rows[0].courseScore).not.toBeNull();
 });
 it.each([-0.01,10.01])('rejects out-of-range scores %s in each phase without changing persisted grades',async(score)=>{
  await save();const before=await read();
  await expect(save({testScore:score})).rejects.toThrow();await expect(save({assignmentScore:score})).rejects.toThrow();expect((await read()).revision).toBe(before.revision);
  await transition('eligibility','submit');await transition('eligibility','approve');await held();const current=await read();
  await expect(saveExam(score)).rejects.toThrow();expect((await read()).revision).toBe(current.revision);
 });
 it.each([['08:00','10:00',true],['07:00','09:00',true],['09:00','11:00',true],['07:00','11:00',true],['10:00','11:00',false],['12:00','13:00',false]])('checks room interval %s–%s overlap=%s',async(start,end,conflict)=>{
  const original=f;await approve();await exam();const peer=await fixture();f=peer;await approve();
  if(conflict)await expect(exam({roomId:original.room.id,startTime:start,endTime:end})).rejects.toMatchObject({response:{code:'EXAM_ROOM_CONFLICT'}});
  else await exam({roomId:original.room.id,startTime:start,endTime:end});
  const stored=await sql('SELECT id FROM course_exam_sessions WHERE course_offering_id=:id',{id:peer.offering.id});expect(stored).toHaveLength(conflict?0:1);
 });
 it.each([['06:59','08:00'],['01:00','02:00'],['18:00','19:01']])('rejects outside working hours %s–%s without scheduling',async(startTime,endTime)=>{
  await approve();await expect(exam({startTime,endTime})).rejects.toMatchObject({response:{code:'EXAM_WORKING_HOURS'}});
  expect(await sql('SELECT id FROM course_exam_sessions WHERE course_offering_id=:id',{id:f.offering.id})).toHaveLength(0);
 });
 it.each([['07:00','08:00'],['18:00','19:00'],['12:30','13:30']])('accepts daytime boundaries and cross-period exact intervals %s–%s',async(startTime,endTime)=>{
  await approve();const e=await exam({startTime,endTime});expect(e.id).toBeTruthy();
 });
 it.each([['07:59',true],['08:00',false],['08:01',false]])('uses a controlled Vietnam DB start boundary at %s',async(clock,allowed)=>{
  await approve();const original=workflow.query.bind(workflow);
  const spy=jest.spyOn(workflow,'query').mockImplementation((query,args,tx)=>original(query.replaceAll('clock_timestamp()',`TIMESTAMPTZ '2099-05-04 ${clock}:00+07'`),args,tx));
  try{if(allowed)await exam();else await expect(exam()).rejects.toThrow('đã bắt đầu');}finally{spy.mockRestore();}
 });
 it.each([['09:59:59',false],['10:00:00',true],['10:00:01',true]])('uses a controlled exact-end boundary at %s for explicit confirmation',async(clock,allowed)=>{
  await approve();const e=await exam();const original=workflow.query.bind(workflow);
  const spy=jest.spyOn(workflow,'query').mockImplementation((query,args,tx)=>original(query.replaceAll('clock_timestamp()',`TIMESTAMPTZ '2099-05-04 ${clock}+07'`),args,tx));
  try{const list=await schedule.list({from:'2099-05-04',to:'2099-05-04'});expect(list.sessions.find(s=>s.id===e.id).pendingConfirmation).toBe(allowed);
   expect((await read()).rows[0].examScoreEditable).toBe(false);
   if(allowed)await schedule.confirm(e.id,{version:0,status:'held',note:'QA exact end'},f.actor);else await expect(schedule.confirm(e.id,{version:0,status:'held',note:'QA before end'},f.actor)).rejects.toThrow('chưa kết thúc');
  }finally{spy.mockRestore();}
 });
 it('retries semantic actions safely without duplicate snapshots, sessions or results',async()=>{
  await save();await transition('eligibility','submit');await expect(transition('eligibility','submit')).rejects.toThrow();await transition('eligibility','approve');await expect(transition('eligibility','approve')).rejects.toThrow();
  const e=await exam();await expect(exam()).rejects.toThrow();await ended(e.id);await schedule.confirm(e.id,{version:0,status:'held',note:'QA'},f.actor);await expect(schedule.confirm(e.id,{version:1,status:'held',note:'QA retry'},f.actor)).rejects.toThrow();
  await saveExam();await transition('final','submit');await expect(transition('final','submit')).rejects.toThrow();await transition('final','approve');await expect(transition('final','approve')).rejects.toThrow();
  expect(await sql('SELECT id FROM course_exam_sessions WHERE course_offering_id=:id',{id:f.offering.id})).toHaveLength(1);
  expect(await sql('SELECT id FROM course_exam_eligibility_snapshots WHERE course_offering_id=:id',{id:f.offering.id})).toHaveLength(1);
 });
 it('serializes simultaneous Held versus Not Held and retains exactly one confirmation',async()=>{
  await approve();const e=await exam();await ended(e.id);
  const results=await Promise.allSettled(['held','not_held'].map(status=>schedule.confirm(e.id,{version:0,status:status as any,note:'QA confirmation race'},f.actor)));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);const [stored]=await sql('SELECT * FROM course_exam_sessions WHERE id=:id',{id:e.id});expect(stored.version).toBe(1);
  expect(['held','not_held']).toContain(stored.status);expect(await sql("SELECT id FROM gradebook_events WHERE course_offering_id=:id AND action IN ('exam.held','exam.not_held')",{id:f.offering.id})).toHaveLength(1);
 });
 it('serializes final submission versus a score save and retains consistent locks',async()=>{
  await approve();await held();await saveExam();const before=await read();const rows=before.rows.map((r:any)=>({...r,examScore:9}));
  const results=await Promise.allSettled([transition('final','submit'),grades.save({...f.scope,revision:before.revision,rows},f.actor)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);const after=await read();
  if((after.workflow as any).final.status==='submitted')expect(after.rows.every((r:any)=>!r.examScoreEditable)).toBe(true);else expect(after.rows[0].examScore).toBe(9);
 });
 it('rejects invalid phase jumps and outside-roster/duplicate rows transactionally',async()=>{
  await expect(transition('eligibility','approve')).rejects.toThrow();await expect(transition('final','approve')).rejects.toThrow();
  const b=await read(),row={participantId:b.rows[0].participantId,testScore:8,assignmentScore:8,examScore:null};
  await expect(grades.save({...f.scope,revision:b.revision,rows:[row,row]},f.actor)).rejects.toThrow();
  await expect(grades.save({...f.scope,revision:b.revision,rows:[{...row,participantId:'admission:'+randomUUID()}]},f.actor)).rejects.toThrow();
  expect((await read()).revision).toBe(b.revision);await approve();await expect(transition('final','submit')).rejects.toThrow();
 });
 it('completes the Not Held → replacement Held → final approval branch without rewriting old history',async()=>{
  await approve();const old=await exam();await ended(old.id);await schedule.confirm(old.id,{version:0,status:'not_held',note:'QA not held'},f.actor);
  expect((await read()).rows.every((r:any)=>!r.examScoreEditable)).toBe(true);await held();await saveExam();await transition('final','submit');await transition('final','approve');
  expect((await sql('SELECT status FROM course_exam_sessions WHERE id=:id',{id:old.id}))[0].status).toBe('not_held');expect((await read()).rows.every((r:any)=>r.finalized)).toBe(true);
 });
 it('serializes component saves using the same revision',async()=>{
  const b=await read();const values=b.rows.map((r:any)=>({participantId:r.participantId,testScore:8,assignmentScore:8,examScore:null,examExempt:false,policyVersion:r.eligibilityPolicy.version,policyRulesVersion:r.eligibilityPolicy.rulesVersion}));
  const results=await Promise.allSettled([grades.save({...f.scope,revision:b.revision,rows:values},f.actor),grades.save({...f.scope,revision:b.revision,rows:values.map((r:any)=>({...r,testScore:9}))},f.actor)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((await read()).revision).toBeGreaterThan(b.revision);
 });
 it('coordinates a policy update against a component save without mixed policy evidence',async()=>{
  const b=await read();const policy=app.get(GradingPolicyService);const values=b.rows.map((r:any)=>({participantId:r.participantId,testScore:8,assignmentScore:8,examScore:null,examExempt:false,policyVersion:r.eligibilityPolicy.version,policyRulesVersion:r.eligibilityPolicy.rulesVersion}));
  const results=await Promise.allSettled([policy.save({rows:[{subjectId:f.subject.id,year:'2026',revision:0,weights:{testScore:10,assignmentScore:20,examScore:70}}]},f.actor.id),grades.save({...f.scope,revision:b.revision,rows:values},f.actor)]);
  expect(results[0].status).toBe('fulfilled');const stored=await sql('SELECT grades FROM course_exam_gradebooks WHERE course_offering_id=:id',{id:f.offering.id});
  if(results[1].status==='fulfilled')expect(stored[0].grades.every((r:any)=>r.gradingPolicy.version===0)).toBe(true);else expect(stored).toHaveLength(0);
  expect((await policy.latest(f.subject.id,'2026')).version).toBe(1);
 });
 it('serializes a reschedule against a competing room booking',async()=>{
  const original=f;await approve();const e=await exam();const state=(await read()).workflow as any;const peer=await fixture();f=peer;await approve();
  const peerState=(await read()).workflow as any;
  const results=await Promise.allSettled([schedule.reschedule(e.id,{courseOfferingId:original.offering.id,snapshotId:state.eligibility.snapshotId,eligibilityVersion:state.eligibility.version,version:0,examDate:'2099-05-05',startTime:'08:00',endTime:'10:00',roomId:original.room.id,lecturerId:original.lecturer.id},original.actor),schedule.schedule({courseOfferingId:peer.offering.id,snapshotId:peerState.eligibility.snapshotId,eligibilityVersion:peerState.eligibility.version,examDate:'2099-05-05',startTime:'08:00',endTime:'10:00',roomId:original.room.id,lecturerId:peer.lecturer.id},peer.actor)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(await sql("SELECT id FROM course_exam_sessions WHERE exam_date='2099-05-05' AND room_id=:id",{id:original.room.id})).toHaveLength(1);
 });
 it.each([1,10,40])('handles a representative %s-person approved set with exact room capacity',async(size)=>{
  if(size===1)await m.ClassGroupMember.destroy({where:{admissionRecordId:f.people[1].id}});
  for(let i=2;i<size;i++){const person=await m.AdmissionRecord.create({code:'QA'+randomUUID().slice(0,12),fullName:'QA performance '+i,majorId:f.group.majorId,trainingLevel:'Thạc sĩ',academicYear:'2026',status:'approved',studyStatus:'Đang học'});await m.ClassGroupMember.create({admissionRecordId:person.id,classGroupId:f.group.id});}
  await f.room.update({capacity:size});await approve();const e=await exam();expect(await sql('SELECT participant_id FROM course_exam_session_candidates WHERE session_id=:id',{id:e.id})).toHaveLength(size);
  const planner=await schedule.list({from:'2099-05-04',to:'2099-05-04'});expect(planner.sessions.find(s=>s.id===e.id).candidateCount).toBe(size);
 });
 it('protects session snapshot foreign keys and immutable candidate associations',async()=>{
  const b=await approve(),e=await exam();
  await expect(db.query('UPDATE course_exam_sessions SET eligibility_snapshot_id=:snapshot WHERE id=:id',{replacements:{id:e.id,snapshot:randomUUID()}})).rejects.toThrow('foreign key');
  await expect(db.query('DELETE FROM course_exam_session_candidates WHERE session_id=:id',{replacements:{id:e.id}})).rejects.toThrow('immutable');
  await ended(e.id);await schedule.confirm(e.id,{version:0,status:'held',note:'QA'},f.actor);
  await expect(schedule.cancel(e.id,{version:1,note:'QA'},f.actor)).rejects.toThrow('Lịch sử');
 });
 it('detects the same candidate after an approved admission identity is linked to a Student',async()=>{
  const original=f;await approve();await exam();
  const student=await m.Student.create({nameWithInitials:'QA',fullName:'QA registration',postalAddress:'QA',email:randomUUID()+'@example.invalid',telNo:'0',password:'test-no-login',accountType:'registered',regNo:'EW'+randomUUID().slice(0,8)});
  await f.people[0].update({studentId:student.id});
  const offering=await m.CourseOffering.create({subjectId:f.subject.id,name:'QA identity peer',status:'completed',completedAt:new Date(),completedByStaffId:f.actor.id});
  await m.CourseOfferingClassGroup.create({courseOfferingId:offering.id,classGroupId:f.group.id});
  const room=await m.Room.create({code:'QA'+randomUUID().slice(0,8),name:'QA identity room',capacity:2,isActive:true});
  f={...original,offering,room,scope:{...original.scope,courseOfferingId:offering.id}};
  const b=await read();await grades.save({...f.scope,revision:b.revision,rows:b.rows.map((r:any)=>({participantId:r.participantId,testScore:8,assignmentScore:8,examScore:null,examExempt:r.participantId!=='student:'+student.id,letterGrade:'',attemptScores:[],result:'pending',policyVersion:r.eligibilityPolicy.version,policyRulesVersion:r.eligibilityPolicy.rulesVersion}))},f.actor);
  await transition('eligibility','submit');await transition('eligibility','approve');
  await expect(exam()).rejects.toMatchObject({response:{code:'EXAM_CANDIDATE_CONFLICT'}});
  const frozen=await grades.get(original.scope);expect(frozen.rows.some((r:any)=>r.participantId==='admission:'+original.people[0].id)).toBe(true);
 });
});
