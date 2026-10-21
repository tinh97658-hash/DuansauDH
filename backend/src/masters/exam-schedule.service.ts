import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Transaction } from 'sequelize';
import { randomUUID } from 'node:crypto';
import { Staff } from '../database/models/staff.model.js';
import { RbacService } from '../auth/rbac.service.js';
import { ExamWorkflowService } from './exam-workflow.service.js';
import { ConfirmExamDto, ExamScheduleQueryDto, ExamSessionActionDto, RescheduleExamDto, ScheduleExamDto } from './dto/exam-schedule.dto.js';

@Injectable()
export class ExamScheduleService {
  constructor(@InjectConnection() private readonly db:Sequelize,private readonly workflow:ExamWorkflowService,private readonly rbac:RbacService){}
  private query(sql:string,args:any={},tx?:Transaction){return this.workflow.query(sql,args,tx);}
  private async authorize(actor:any){if(!(actor instanceof Staff)||!(await this.rbac.effectiveAccess(actor)).permissions.has('scheduling.write'))throw new ForbiddenException('Bạn không có quyền xếp lịch thi.');}
  async list(query:ExamScheduleQueryDto){
    const bounds=await this.query(`SELECT (CAST(:to AS date) - CAST(:from AS date)) BETWEEN 0 AND 62 ok`,query);
    if(!bounds[0]?.ok)throw new BadRequestException('Khoảng lịch tối đa 63 ngày.');
    const queue=await this.query(`SELECT o.id,o.name,s.name AS "subjectName",s.id AS "subjectId",s.code AS "subjectCode",
      w.eligibility_version AS "eligibilityVersion",p.id AS "snapshotId",
      (SELECT jsonb_agg(r->>'participantId') FROM jsonb_array_elements(p.rows) r WHERE r->>'eligible'='true' AND r->>'examExempt' IS DISTINCT FROM 'true') AS "candidateIds",
      (SELECT jsonb_agg(jsonb_build_object('participantId',r->>'participantId','code',r->>'code','fullName',r->>'fullName')) FROM jsonb_array_elements(p.rows) r WHERE r->>'eligible'='true' AND r->>'examExempt' IS DISTINCT FROM 'true') AS candidates,
      (SELECT jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'code',g.code,'academicYear',g.academic_year,'majorId',g.major_id,'majorName',m.name,'disciplineId',m.discipline_id,'disciplineName',d.name))
        FROM course_offering_class_groups l JOIN class_groups g ON g.id=l.class_group_id LEFT JOIN majors m ON m.id=g.major_id LEFT JOIN disciplines d ON d.id=m.discipline_id WHERE l.course_offering_id=o.id) AS groups,
      (SELECT count(*)::int FROM jsonb_array_elements(p.rows) r WHERE r->>'eligible'='true' AND r->>'examExempt' IS DISTINCT FROM 'true') AS "candidateCount",
      (SELECT count(*)::int FROM jsonb_array_elements(p.rows) r WHERE r->>'eligible'='true' AND r->>'examExempt' IS DISTINCT FROM 'true' AND NOT EXISTS(
        SELECT 1 FROM course_exam_sessions es JOIN course_exam_session_candidates c ON c.session_id=es.id
        WHERE es.course_offering_id=o.id AND es.eligibility_snapshot_id=p.id AND es.status IN ('scheduled','held') AND c.participant_id=r->>'participantId')) AS "remainingCount"
      FROM course_exam_workflows w JOIN course_offerings o ON o.id=w.course_offering_id JOIN subjects s ON s.id=o.subject_id
      JOIN course_exam_eligibility_snapshots p ON p.id=w.eligibility_snapshot_id
      WHERE w.mode='new' AND w.eligibility_status='approved' AND o.status='completed' ORDER BY o.name,o.id`);
    const sessions=await this.query(`SELECT es.*,es.exam_date::text AS "examDate",es.start_time::text AS "startTime",es.end_time::text AS "endTime",
      es.course_offering_id AS "courseOfferingId",es.eligibility_snapshot_id AS "snapshotId",es.room_id AS "roomId",es.lecturer_id AS "lecturerId",l.name AS "lecturerName",
      o.name,s.name AS "subjectName",s.id AS "subjectId",s.code AS "subjectCode",r.code AS "roomCode",r.name AS "roomName",
      (SELECT jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'code',g.code,'academicYear',g.academic_year,'majorId',g.major_id,'majorName',m.name,'disciplineId',m.discipline_id,'disciplineName',d.name))
        FROM course_offering_class_groups l JOIN class_groups g ON g.id=l.class_group_id LEFT JOIN majors m ON m.id=g.major_id LEFT JOIN disciplines d ON d.id=m.discipline_id WHERE l.course_offering_id=o.id) AS groups,
      (SELECT count(*)::int FROM course_exam_session_candidates c WHERE c.session_id=es.id) AS "candidateCount",
      (SELECT jsonb_agg(c.participant_id ORDER BY c.participant_id) FROM course_exam_session_candidates c WHERE c.session_id=es.id) AS "candidateIds",
      p.rows->0->>'classGroupId' AS "classGroupId",
      (SELECT jsonb_agg(jsonb_build_object('participantId',person->>'participantId','code',person->>'code','fullName',person->>'fullName')) FROM jsonb_array_elements(p.rows) person WHERE EXISTS(SELECT 1 FROM course_exam_session_candidates c WHERE c.session_id=es.id AND c.participant_id=person->>'participantId')) AS candidates,
      (es.status='scheduled' AND (es.exam_date+es.start_time) AT TIME ZONE 'Asia/Ho_Chi_Minh'>clock_timestamp()) AS "canEdit",
      (es.status='scheduled' AND (es.exam_date+es.end_time) AT TIME ZONE 'Asia/Ho_Chi_Minh'<=clock_timestamp()) AS "pendingConfirmation"
      FROM course_exam_sessions es JOIN course_offerings o ON o.id=es.course_offering_id JOIN subjects s ON s.id=o.subject_id JOIN rooms r ON r.id=es.room_id LEFT JOIN lecturers l ON l.id=es.lecturer_id JOIN course_exam_eligibility_snapshots p ON p.id=es.eligibility_snapshot_id
      WHERE es.exam_date BETWEEN :from::date AND :to::date OR (es.status='scheduled' AND (es.exam_date+es.end_time) AT TIME ZONE 'Asia/Ho_Chi_Minh'<=clock_timestamp())
      ORDER BY es.exam_date,es.start_time,es.id`,query);
    const rooms=await this.query('SELECT id,code,name,capacity,is_active AS "isActive" FROM rooms ORDER BY code,id');
    const lecturers=await this.query('SELECT id,code,name,active,unit_id AS "unitId" FROM lecturers ORDER BY name,id');
    const units=await this.query('SELECT id,code,name,active FROM units ORDER BY sort_order,name,id');
    return {queue:queue.filter(o=>o.remainingCount>0),approvedOfferings:queue,sessions,rooms,lecturers,units,timeZone:'Asia/Ho_Chi_Minh'};
  }
  private async session(id:string,tx:Transaction){const [s]=await this.query('SELECT * FROM course_exam_sessions WHERE id=:id FOR UPDATE',{id},tx);if(!s)throw new NotFoundException('Không tìm thấy ca thi.');return s;}
  private checkVersion(session:any,version:number){if(session.version!==version)throw new ConflictException('Ca thi đã thay đổi. Hãy tải lại.');}
  private async resources(keys:string[],tx:Transaction){for(const key of [...new Set(keys)].sort())await this.query('SELECT pg_advisory_xact_lock(hashtextextended(:key,23066))',{key},tx);}
  private async aliases(candidates:string[],tx:Transaction){
    // A frozen admission identity remains the same person after registration
    // links it to a Student. Lock/check both identities without changing the list.
    const records=await this.query(`SELECT ar.id,ar.student_id FROM admission_records ar
      WHERE 'admission:'||ar.id::text IN (:candidates) OR 'student:'||ar.student_id::text IN (:candidates)
        OR ar.student_id IN (SELECT linked.student_id FROM admission_records linked WHERE 'admission:'||linked.id::text IN (:candidates))
      ORDER BY ar.id`,{candidates},tx);
    return [...new Set([...candidates,...records.flatMap(r=>['admission:'+r.id,...(r.student_id?['student:'+r.student_id]:[])])])].sort();
  }
  private async future(date:string,time:string,tx:Transaction){
    const [r]=await this.query(`SELECT (CAST(:date AS date) + CAST(:time AS time)) AT TIME ZONE 'Asia/Ho_Chi_Minh' > clock_timestamp() ok`,{date,time},tx);
    if(!r.ok)throw new ConflictException({code:'EXAM_START_PASSED',message:'Không thể tạo hoặc chuyển ca thi vào thời điểm đã bắt đầu.'});
  }
  private async validate(dto:ScheduleExamDto,candidates:string[],exclude:string|null,tx:Transaction,aliases:string[]=candidates){
    await this.future(dto.examDate,dto.startTime,tx);
    if(dto.endTime<=dto.startTime)throw new BadRequestException('Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.');
    if(dto.startTime<'07:00'||dto.endTime>'19:00')throw new BadRequestException({code:'EXAM_WORKING_HOURS',message:'Giờ thi phải nằm trong khoảng 07:00–19:00.'});
    if(!dto.lecturerId)throw new BadRequestException('Vui lòng chọn giảng viên.');
    const [lecturer]=await this.query('SELECT id,active FROM lecturers WHERE id=:id FOR SHARE',{id:dto.lecturerId},tx);
    if(!lecturer?.active)throw new BadRequestException('Vui lòng chọn giảng viên đang hoạt động.');
    const [room]=await this.query('SELECT * FROM rooms WHERE id=:id FOR SHARE',{id:dto.roomId},tx);
    if(!room?.is_active||room.capacity==null||room.capacity<candidates.length)throw new ConflictException({code:'EXAM_ROOM_CAPACITY',message:`Phòng phải hoạt động và đủ ${candidates.length} thí sinh.`});
    const args={date:dto.examDate,start:dto.startTime,end:dto.endTime,room:dto.roomId,lecturer:dto.lecturerId,exclude,candidates:aliases};
    const [conflict]=await this.query(`SELECT s.id,s.room_id=:room AS room,s.lecturer_id=:lecturer AS lecturer,EXISTS(SELECT 1 FROM course_exam_session_candidates c WHERE c.session_id=s.id AND c.participant_id IN (:candidates)) AS candidate
      FROM course_exam_sessions s WHERE s.status IN ('scheduled','held') AND (:exclude::uuid IS NULL OR s.id<>:exclude::uuid)
      AND s.exam_date = :date::date AND s.start_time < :end::time AND s.end_time > :start::time
      AND (s.room_id=:room OR s.lecturer_id=:lecturer OR EXISTS(SELECT 1 FROM course_exam_session_candidates c WHERE c.session_id=s.id AND c.participant_id IN (:candidates))) LIMIT 1`,args,tx);
    if(conflict)throw new ConflictException({code:conflict.room?'EXAM_ROOM_CONFLICT':conflict.candidate?'EXAM_CANDIDATE_CONFLICT':'EXAM_LECTURER_CONFLICT',message:conflict.room?'Phòng đã có ca thi trùng giờ.':conflict.candidate?'Thí sinh đã có ca thi khác trùng giờ.':'Giảng viên đã có ca thi trùng giờ.'});
  }
  async schedule(dto:ScheduleExamDto,actor:any){
    await this.authorize(actor);let id='';
    await this.db.transaction(async tx=>{
      const {state}=await this.workflow.lock(dto.courseOfferingId,tx);
      if(state.eligibility_status!=='approved'||state.eligibility_version!==dto.eligibilityVersion||state.eligibility_snapshot_id!==dto.snapshotId)throw new ConflictException('Danh sách thi chưa duyệt hoặc phiên bản đã thay đổi.');
      const [snapshot]=await this.query('SELECT rows FROM course_exam_eligibility_snapshots WHERE id=:id',{id:dto.snapshotId},tx);
      const candidates=snapshot.rows.filter((r:any)=>r.eligible===true&&!r.examExempt).map((r:any)=>r.participantId);
      if(!candidates.length)throw new ConflictException('Không có thí sinh cần thi.');
      if((await this.query(`SELECT id FROM course_exam_sessions WHERE course_offering_id=:id AND eligibility_snapshot_id=:snapshot AND status IN ('scheduled','held') LIMIT 1`,{id:dto.courseOfferingId,snapshot:dto.snapshotId},tx)).length)throw new ConflictException('Danh sách đã được xếp thi.');
      const aliases=await this.aliases(candidates,tx);
      await this.resources(['room:'+dto.roomId,'lecturer:'+dto.lecturerId,...aliases.map((p:string)=>'candidate:'+p)],tx);
      await this.validate(dto,candidates,null,tx,aliases);id=randomUUID();
      await this.db.query(`INSERT INTO course_exam_sessions(id,course_offering_id,eligibility_snapshot_id,exam_date,start_time,end_time,room_id,lecturer_id,created_by,updated_by,note)
        VALUES(:id,:offering,:snapshot,:date,:start,:end,:room,:lecturer,:actor,:actor,:note)`,{transaction:tx,replacements:{id,offering:dto.courseOfferingId,snapshot:dto.snapshotId,date:dto.examDate,start:dto.startTime,end:dto.endTime,room:dto.roomId,lecturer:dto.lecturerId,actor:actor.id,note:dto.note||''}});
      for(const participant of candidates)await this.db.query('INSERT INTO course_exam_session_candidates(session_id,participant_id) VALUES(:id,:participant)',{transaction:tx,replacements:{id,participant}});
      await this.workflow.event(dto.courseOfferingId,'exam.schedule',actor,dto.note||'Xếp lịch thi',null,{id,...dto,candidateCount:candidates.length},tx);
    });return {id};
  }
  async reschedule(id:string,dto:RescheduleExamDto,actor:any){
    await this.authorize(actor);
    await this.db.transaction(async tx=>{
      await this.workflow.lock(dto.courseOfferingId,tx);const s=await this.session(id,tx);this.checkVersion(s,dto.version);
      if(s.status!=='scheduled'||s.course_offering_id!==dto.courseOfferingId||s.eligibility_snapshot_id!==dto.snapshotId)throw new ConflictException('Không thể sửa ca thi này.');
      const state=await this.workflow.state(dto.courseOfferingId,tx);
      if(state.eligibility_version!==dto.eligibilityVersion||state.eligibility_snapshot_id!==dto.snapshotId)throw new ConflictException('Phiên bản danh sách thi đã thay đổi.');
      await this.future(s.exam_date,s.start_time,tx);
      const candidates=(await this.query('SELECT participant_id FROM course_exam_session_candidates WHERE session_id=:id',{id},tx)).map(r=>r.participant_id);
      const aliases=await this.aliases(candidates,tx);
      await this.resources(['room:'+s.room_id,'room:'+dto.roomId,...[s.lecturer_id,dto.lecturerId].filter(Boolean).map(id=>'lecturer:'+id),...aliases.map(p=>'candidate:'+p)],tx);await this.validate(dto,candidates,id,tx,aliases);
      await this.db.query(`UPDATE course_exam_sessions SET exam_date=:date,start_time=:start,end_time=:end,room_id=:room,lecturer_id=:lecturer,version=version+1,updated_by=:actor,updated_at=now(),note=:note WHERE id=:id`,{transaction:tx,replacements:{id,date:dto.examDate,start:dto.startTime,end:dto.endTime,room:dto.roomId,lecturer:dto.lecturerId,actor:actor.id,note:dto.note||''}});
      await this.workflow.event(dto.courseOfferingId,'exam.reschedule',actor,dto.note||'Đổi lịch thi',s,dto,tx);
    });return {id};
  }
  async cancel(id:string,dto:ExamSessionActionDto,actor:any){return this.finish(id,dto,actor,'cancelled');}
  async confirm(id:string,dto:ConfirmExamDto,actor:any){return this.finish(id,dto,actor,dto.status);}
  private async finish(id:string,dto:{version:number;note?:string},actor:any,status:'held'|'not_held'|'cancelled'){
    await this.authorize(actor);if(status!=='held'&&!dto.note?.trim())throw new BadRequestException(status==='cancelled'?'Nhập lý do hủy lịch thi.':'Nhập lý do không diễn ra.');
    const note=dto.note?.trim()||'';
    await this.db.transaction(async tx=>{
      // Offering first, matching all workflow/scheduling lock orders.
      const [ref]=await this.query('SELECT course_offering_id FROM course_exam_sessions WHERE id=:id',{id},tx);
      if(!ref)throw new NotFoundException('Không tìm thấy ca thi.');
      await this.workflow.lock(ref.course_offering_id,tx);const s=await this.session(id,tx);this.checkVersion(s,dto.version);
      if(s.status!=='scheduled')throw new ConflictException('Ca thi đã được xử lý. Lịch sử được bảo toàn.');
      const candidates=(await this.query('SELECT participant_id FROM course_exam_session_candidates WHERE session_id=:id',{id},tx)).map(r=>r.participant_id);
      const aliases=await this.aliases(candidates,tx);
      await this.resources(['room:'+s.room_id,...aliases.map(p=>'candidate:'+p)],tx);
      if(status==='cancelled')await this.future(s.exam_date,s.start_time,tx);
      else{
        const [ended]=await this.query(`SELECT (exam_date+end_time) AT TIME ZONE 'Asia/Ho_Chi_Minh'<=clock_timestamp() ok FROM course_exam_sessions WHERE id=:id`,{id},tx);
        if(!ended.ok)throw new ConflictException('Ca thi chưa kết thúc; chưa thể xác nhận.');
      }
      await this.db.query(`UPDATE course_exam_sessions SET status=:status,version=version+1,updated_by=:actor,updated_at=now(),note=:note,
        confirmed_by=CASE WHEN :status = 'cancelled' THEN NULL ELSE :actor::uuid END,confirmed_at=CASE WHEN :status = 'cancelled' THEN NULL ELSE clock_timestamp() END WHERE id=:id`,{transaction:tx,replacements:{id,status,actor:actor.id,note}});
      if(status==='held')await this.db.query(`UPDATE course_exam_workflows SET result_status='draft',updated_at=now() WHERE course_offering_id=:offering AND result_status='not_available'`,{transaction:tx,replacements:{offering:s.course_offering_id}});
      await this.workflow.event(s.course_offering_id,status==='cancelled'?'exam.cancel':`exam.${status}`,actor,note,s,{status},tx);
    });return {id,status};
  }
}
