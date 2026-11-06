import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Transaction } from 'sequelize';
import { randomUUID } from 'node:crypto';
import { Staff } from '../database/models/staff.model.js';
import { RbacService } from '../auth/rbac.service.js';
import { ExamWorkflowService } from './exam-workflow.service.js';
import { ConfirmExamDto, ExamCandidateAttendanceDto, ExamScheduleQueryDto, ExamSessionActionDto, RescheduleExamDto, ScheduleExamDto, SaveExamArrangementDto } from './dto/exam-schedule.dto.js';
import {activeExam, validateExamArrangement,externalInvigilatorKey,examRoomFits} from './exam-arrangement.js';
import { GradebookAccessService } from './gradebook-access.service.js';

@Injectable()
export class ExamScheduleService {
  constructor(@InjectConnection() private readonly db:Sequelize,private readonly workflow:ExamWorkflowService,private readonly rbac:RbacService,
    @Optional() private readonly access?:GradebookAccessService){}
  private query(sql:string,args:any={},tx?:Transaction){return this.workflow.query(sql,args,tx);}
  private async authorize(actor:any){if(!(actor instanceof Staff))throw new ForbiddenException('Bạn không có quyền xếp lịch thi.');const access=await this.rbac.effectiveAccess(actor,true);if(!access.permissions.has('exams.write')||access.groupScope?.readOnly)throw new ForbiddenException('Bạn không có quyền xếp lịch thi.');}
  async list(query:ExamScheduleQueryDto,actor?:any){
    let allowed:Set<string>|null=null;
    if(this.access){
      if(!(actor instanceof Staff)||(await this.rbac.effectiveAccess(actor,true)).permissions.has('exams.view')!==true)throw new ForbiddenException('Bạn không có quyền xem lịch thi.');
      allowed=await this.access.offeringIds(await this.access.forActor(actor));
    }
    const bounds=await this.query(`SELECT (CAST(:to AS date) - CAST(:from AS date)) BETWEEN 0 AND 62 ok`,query);
    if(!bounds[0]?.ok)throw new BadRequestException('Khoảng lịch tối đa 63 ngày.');
    let queue=await this.query(`SELECT o.id,o.name,s.name AS "subjectName",s.id AS "subjectId",s.code AS "subjectCode",
      w.eligibility_version AS "eligibilityVersion",p.id AS "snapshotId",
      (SELECT jsonb_agg(r->>'participantId') FROM jsonb_array_elements(p.rows) r WHERE r->>'eligible'='true' AND r->>'examExempt' IS DISTINCT FROM 'true') AS "candidateIds",
      (SELECT jsonb_agg(jsonb_build_object('participantId',r->>'participantId','code',r->>'code','fullName',r->>'fullName')) FROM jsonb_array_elements(p.rows) r WHERE r->>'eligible'='true' AND r->>'examExempt' IS DISTINCT FROM 'true') AS candidates,
      (SELECT jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'code',g.code,'academicYear',g.academic_year,'majorId',g.major_id,'majorName',m.name,'disciplineId',m.discipline_id,'disciplineName',d.name))
        FROM course_offering_class_groups l JOIN class_groups g ON g.id=l.class_group_id LEFT JOIN majors m ON m.id=g.major_id LEFT JOIN disciplines d ON d.id=m.discipline_id WHERE l.course_offering_id=o.id) AS groups,
      (SELECT count(*)::int FROM jsonb_array_elements(p.rows) r WHERE r->>'eligible'='true' AND r->>'examExempt' IS DISTINCT FROM 'true') AS "candidateCount",
      (SELECT count(*)::int FROM jsonb_array_elements(p.rows) r WHERE r->>'eligible'='true' AND r->>'examExempt' IS DISTINCT FROM 'true' AND NOT EXISTS(
        SELECT 1 FROM course_exam_sessions es JOIN course_exam_session_candidates c ON c.session_id=es.id
        WHERE es.course_offering_id=o.id AND es.status IN ('scheduled','held') AND c.participant_id=r->>'participantId')) AS "remainingCount"
      FROM course_exam_workflows w JOIN course_offerings o ON o.id=w.course_offering_id JOIN subjects s ON s.id=o.subject_id
      JOIN course_exam_eligibility_snapshots p ON p.id=w.eligibility_snapshot_id
      WHERE w.mode='new' AND w.eligibility_status='approved' AND o.status='completed' ORDER BY o.name,o.id`);
    let sessions=await this.query(`SELECT es.*,es.exam_date::text AS "examDate",es.start_time::text AS "startTime",es.end_time::text AS "endTime",
      es.course_offering_id AS "courseOfferingId",es.eligibility_snapshot_id AS "snapshotId",es.room_id AS "roomId",es.lecturer_id AS "lecturerId",COALESCE(l.name,es.external_invigilator_name) AS "lecturerName",
      l.academic_rank AS "lecturerAcademicRank",l.academic_degree AS "lecturerAcademicDegree",l2.academic_rank AS "secondLecturerAcademicRank",l2.academic_degree AS "secondLecturerAcademicDegree",
      es.external_invigilator_name AS "externalInvigilatorName",es.external_unit_name AS "externalUnitName",
      es.second_lecturer_id AS "secondLecturerId",COALESCE(l2.name,es.second_external_invigilator_name) AS "secondLecturerName",
      es.second_external_invigilator_name AS "secondExternalInvigilatorName",es.second_external_unit_name AS "secondExternalUnitName",
      es.arrangement_id AS "arrangementId",es.round_no AS "roundNo",a.version AS "arrangementVersion",a.note AS "arrangementNote",w.eligibility_version AS "eligibilityVersion",
      o.name,s.name AS "subjectName",s.id AS "subjectId",s.code AS "subjectCode",r.code AS "roomCode",r.name AS "roomName",
      (SELECT jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'code',g.code,'academicYear',g.academic_year,'majorId',g.major_id,'majorName',m.name,'disciplineId',m.discipline_id,'disciplineName',d.name))
        FROM course_offering_class_groups l JOIN class_groups g ON g.id=l.class_group_id LEFT JOIN majors m ON m.id=g.major_id LEFT JOIN disciplines d ON d.id=m.discipline_id WHERE l.course_offering_id=o.id) AS groups,
      (SELECT count(*)::int FROM course_exam_session_candidates c WHERE c.session_id=es.id) AS "candidateCount",
      (SELECT jsonb_agg(c.participant_id ORDER BY c.participant_id) FROM course_exam_session_candidates c WHERE c.session_id=es.id) AS "candidateIds",
      p.rows->0->>'classGroupId' AS "classGroupId",
      (SELECT jsonb_agg(jsonb_build_object('participantId',person->>'participantId','code',person->>'code','fullName',person->>'fullName',
        'attendanceStatus',COALESCE(att.status,'present'),'attendanceRecordedAt',att.recorded_at) ORDER BY candidate_order)
        FROM jsonb_array_elements(p.rows) WITH ORDINALITY AS people(person,candidate_order)
        JOIN course_exam_session_candidates c ON c.session_id=es.id AND c.participant_id=person->>'participantId'
        LEFT JOIN course_exam_candidate_attendance att ON att.session_id=c.session_id AND att.participant_id=c.participant_id) AS candidates,
      (es.status IN ('scheduled','held') AND w.mode='new' AND w.result_status NOT IN ('submitted','approved')
        AND (es.exam_date+es.start_time) AT TIME ZONE 'Asia/Ho_Chi_Minh'<=clock_timestamp()) AS "canRecordAttendance",
      (es.status='scheduled' AND (es.exam_date+es.start_time) AT TIME ZONE 'Asia/Ho_Chi_Minh'>clock_timestamp()) AS "canEdit",
      (es.status='scheduled' AND (es.exam_date+es.end_time) AT TIME ZONE 'Asia/Ho_Chi_Minh'<=clock_timestamp()) AS "pendingConfirmation"
      FROM course_exam_sessions es JOIN course_exam_arrangements a ON a.id=es.arrangement_id LEFT JOIN course_exam_workflows w ON w.course_offering_id=es.course_offering_id JOIN course_offerings o ON o.id=es.course_offering_id JOIN subjects s ON s.id=o.subject_id JOIN rooms r ON r.id=es.room_id LEFT JOIN lecturers l ON l.id=es.lecturer_id LEFT JOIN lecturers l2 ON l2.id=es.second_lecturer_id JOIN course_exam_eligibility_snapshots p ON p.id=es.eligibility_snapshot_id
      WHERE es.arrangement_id IN (SELECT x.arrangement_id FROM course_exam_sessions x WHERE x.exam_date BETWEEN :from::date AND :to::date OR (x.status='scheduled' AND (x.exam_date+x.end_time) AT TIME ZONE 'Asia/Ho_Chi_Minh'<=clock_timestamp()))
      ORDER BY es.exam_date,es.start_time,es.id`,query);
    if(allowed!==null){
      const visible=allowed;
      const mixed=new Set(sessions.filter(session=>!visible.has(session.courseOfferingId)).map(session=>session.arrangementId));
      queue=queue.filter(offering=>visible.has(offering.id));
      sessions=sessions.filter(session=>visible.has(session.courseOfferingId)).map(session=>({...session,
        canEdit:session.canEdit&&!mixed.has(session.arrangementId)}));
    }
    const rooms=await this.query('SELECT id,code,name,capacity,is_active AS "isActive" FROM rooms ORDER BY code,id');
    const lecturers=await this.query('SELECT id,code,name,active,academic_rank AS "academicRank",academic_degree AS "academicDegree",unit_id AS "unitId" FROM lecturers ORDER BY name,id');
    const units=await this.query('SELECT id,code,name,active FROM units ORDER BY sort_order,name,id');
    const candidateIds=[...new Set([...queue,...sessions].flatMap(s=>s.candidateIds||[]))];
    if(candidateIds.length){
      const links=await this.query(`SELECT id,student_id FROM admission_records WHERE 'admission:'||id::text IN (:ids) OR 'student:'||student_id::text IN (:ids)`,{ids:candidateIds});
      const identities=new Map(links.map(r=>['admission:'+r.id,r.student_id?'student:'+r.student_id:'admission:'+r.id]));
      for(const item of [...queue,...sessions])item.candidateKeys=(item.candidateIds||[]).map((p:string)=>identities.get(p)||p);
    }
    return {queue:queue.filter(o=>o.remainingCount>0),approvedOfferings:queue,sessions,rooms,lecturers,units,timeZone:'Asia/Ho_Chi_Minh'};
  }
  private async session(id:string,tx:Transaction){const [s]=await this.query('SELECT * FROM course_exam_sessions WHERE id= :id FOR UPDATE',{id},tx);if(!s)throw new NotFoundException('Không tìm thấy ca thi.');return s;}
  private checkVersion(session:any,version:number){if(session.version!==version)throw new ConflictException('Ca thi đã thay đổi. Hãy tải lại.');}
  private async resources(keys:string[],tx:Transaction){for(const key of [...new Set(keys)].sort())await this.query('SELECT pg_advisory_xact_lock(hashtextextended(:key,23066))',{key},tx);}
  private async aliases(candidates:string[],tx:Transaction,rows:any[]=[],names:Record<string,string>={}){
    // A frozen admission identity remains the same person after registration
    // links it to a Student. Lock/check both identities without changing the list.
    const records=await this.query(`SELECT ar.id,ar.student_id FROM admission_records ar
      WHERE 'admission:'||ar.id::text IN (:candidates) OR 'student:'||ar.student_id::text IN (:candidates)
        OR ar.student_id IN (SELECT linked.student_id FROM admission_records linked WHERE 'admission:'||linked.id::text IN (:candidates))
      ORDER BY ar.id`,{candidates},tx);
    for(const row of rows){
      const label=row.fullName||row.code||row.participantId;
      names[row.participantId]=label;
      const person=records.find(r=>'admission:'+r.id===row.participantId||'student:'+r.student_id===row.participantId);
      if(person){
        names['admission:'+person.id]=label;
        if(person.student_id){
          names['student:'+person.student_id]=label;
          for(const linked of records.filter(r=>r.student_id===person.student_id))names['admission:'+linked.id]=label;
        }
      }
    }
    return [...new Set([...candidates,...records.flatMap(r=>['admission:'+r.id,...(r.student_id?['student:'+r.student_id]:[])])])].sort();
  }
  private async future(date:string,time:string,tx:Transaction){
    const [r]=await this.query(`SELECT (CAST(:date AS date) + CAST(:time AS time)) AT TIME ZONE 'Asia/Ho_Chi_Minh' > clock_timestamp() ok`,{date,time},tx);
    if(!r.ok)throw new ConflictException({code:'EXAM_START_PASSED',message:'Không thể tạo hoặc chuyển ca thi vào thời điểm đã bắt đầu.'});
  }
  private async periodOpen(date:string,period:string,tx:Transaction){
    const cutoff=period==='AFTERNOON'?'14:01':'08:01';
    const [r]=await this.query(`SELECT (CAST(:date AS date) + CAST(:cutoff AS time)) AT TIME ZONE 'Asia/Ho_Chi_Minh' > clock_timestamp() ok`,{date,cutoff},tx);
    if(!r.ok)throw new ConflictException({code:'EXAM_PERIOD_CLOSED',message:`Buổi ${period==='AFTERNOON'?'chiều':'sáng'} đã khóa ghép thi từ ${cutoff}. Hãy chọn buổi hoặc ngày thi khác.`});
  }
  async saveArrangement(arrangementId:string|null,dto:SaveExamArrangementDto,actor:any){
    await this.authorize(actor);
    const lecturerId=dto.lecturerId||null,externalName=dto.externalInvigilatorName?.trim()||null,externalUnit=dto.externalUnitName?.trim()||null;
    if(lecturerId&&(externalName||externalUnit))throw new BadRequestException('Chỉ chọn giảng viên hoặc nhập giám thị bên ngoài.');
    if(!!externalName!==!!externalUnit)throw new BadRequestException('Nhập đầy đủ tên cán bộ coi thi và đơn vị bên ngoài, hoặc để trống cả hai.');
    const externalKey=externalName?externalInvigilatorKey(externalUnit!,externalName):null;
    const secondLecturer=dto.secondLecturerId||null,secondName=dto.secondExternalInvigilatorName?.trim()||null,secondUnit=dto.secondExternalUnitName?.trim()||null;
    if(secondLecturer&&(secondName||secondUnit))throw new BadRequestException('Cán bộ coi thi 2: chỉ chọn giảng viên hoặc nhập thông tin bên ngoài.');
    if(!!secondName!==!!secondUnit)throw new BadRequestException('Nhập đầy đủ tên và đơn vị cán bộ coi thi 2, hoặc để trống cả hai.');
    const secondKey=secondName?externalInvigilatorKey(secondUnit!,secondName):null;
    if((lecturerId&&lecturerId===secondLecturer)||(externalKey&&externalKey===secondKey))throw new BadRequestException('Hai cán bộ coi thi phải là hai người khác nhau.');
    const lecturerIds=[lecturerId,secondLecturer].filter((id):id is string=>!!id),externalKeys=[externalKey,secondKey].filter((key):key is string=>!!key);
    const id=arrangementId||randomUUID(),sessionIds:string[]=[];
    await this.db.transaction(async tx=>{
      const offeringIds=dto.groups.map(g=>g.courseOfferingId);
      if(new Set(offeringIds).size!==offeringIds.length)throw new BadRequestException('Một lớp học phần chỉ được xuất hiện một lần trong buổi.');
      // All mutations lock offerings before the arrangement, then resources.
      // Sorting gives concurrent multi-offering requests a consistent lock order.
      const states=new Map<string,any>();
      for(const offering of [...offeringIds].sort()){
        if(this.access)await this.access.assertOffering(actor,offering,tx);
        states.set(offering,(await this.workflow.lock(offering,tx)).state);
      }
      let existing:any[]=[];
      if(arrangementId){
        const [parent]=await this.query('SELECT * FROM course_exam_arrangements WHERE id= :id FOR UPDATE',{id},tx);
        if(!parent)throw new NotFoundException('Không tìm thấy buổi thi.');
        this.checkVersion(parent,dto.version!);
        // Inspect every member before FOR UPDATE: write RLS intentionally hides
        // unowned sessions from locking reads, but they still block parent edits.
        if(this.access){
          const references=await this.query('SELECT DISTINCT course_offering_id FROM course_exam_sessions WHERE arrangement_id=:id',{id},tx);
          for(const reference of references)await this.access.assertOffering(actor,reference.course_offering_id,tx);
        }
        existing=await this.query(`SELECT *,exam_date::text AS "examDate",start_time::text AS "startTime",end_time::text AS "endTime",
          (exam_date+start_time) AT TIME ZONE 'Asia/Ho_Chi_Minh'>clock_timestamp() AS future
          FROM course_exam_sessions WHERE arrangement_id= :id ORDER BY id FOR UPDATE`,{id},tx);
        if(this.access)for(const offering of new Set(existing.map(session=>session.course_offering_id)))await this.access.assertOffering(actor,offering,tx);
        if(existing.filter(activeExam).some(s=>!dto.groups.some(g=>g.id===s.id)))
          throw new ConflictException('Không được bỏ nhóm thi đang có hiệu lực. Hãy hủy riêng nhóm và nhập lý do.');
      }else if(dto.groups.some(g=>g.id))throw new BadRequestException('Nhóm thi mới không được có mã lịch cũ.');
      const prepared:any[]=[];
      for(const g of dto.groups){
        const old=g.id?existing.find(s=>s.id===g.id):null,state=states.get(g.courseOfferingId);
        if(g.id&&(!old||old.course_offering_id!==g.courseOfferingId||old.eligibility_snapshot_id!==g.snapshotId||!activeExam(old)))
          throw new ConflictException('Nhóm thi không thuộc buổi hoặc đã hủy/không diễn ra.');
        if(old)this.checkVersion(old,g.version!);
        const locked=old&&(!old.future||old.status!=='scheduled');
        if(locked){
          if(old.examDate!==dto.examDate||old.room_id!==dto.roomId||old.lecturer_id!==lecturerId||(old.external_invigilator_name||null)!==externalName||(old.external_unit_name||null)!==externalUnit||(old.second_lecturer_id||null)!==secondLecturer||(old.second_external_invigilator_name||null)!==secondName||(old.second_external_unit_name||null)!==secondUnit||old.round_no!==g.roundNo||old.startTime.slice(0,5)!==g.startTime||old.endTime.slice(0,5)!==g.endTime)
            throw new ConflictException('Nhóm đã bắt đầu hoặc đã xác nhận phải giữ nguyên lịch và phòng, giám thị.');
        }else{
          await this.periodOpen(dto.examDate,dto.period,tx);
          await this.future(dto.examDate,g.startTime,tx);
          if(state.mode!=='new'||state.eligibility_status!=='approved'||state.eligibility_version!==g.eligibilityVersion||(!old&&state.eligibility_snapshot_id!==g.snapshotId))
            throw new ConflictException('Danh sách thi chưa đủ điểm thành phần hoặc phiên bản đã thay đổi.');
          const [offering]=await this.query('SELECT status FROM course_offerings WHERE id= :id',{id:g.courseOfferingId},tx);
          if(offering?.status!=='completed')throw new ConflictException('Lớp học phần chưa hoàn thành giảng dạy.');
        }
        const [snapshot]=await this.query(`SELECT p.rows,o.name,s.name AS subject FROM course_exam_eligibility_snapshots p
          JOIN course_offerings o ON o.id=p.course_offering_id JOIN subjects s ON s.id=o.subject_id
          WHERE p.id= :id AND p.course_offering_id= :offering`,{id:g.snapshotId,offering:g.courseOfferingId},tx);
        if(!snapshot)throw new ConflictException('Danh sách thi không thuộc lớp học phần.');
        const rows=snapshot.rows.filter((r:any)=>r.eligible===true&&!r.examExempt);
        const assigned=old?[]:await this.query(`SELECT c.participant_id FROM course_exam_sessions es JOIN course_exam_session_candidates c ON c.session_id=es.id WHERE es.course_offering_id=:offering AND es.status IN ('scheduled','held')`,{offering:g.courseOfferingId},tx);
        const candidates=old?(await this.query('SELECT participant_id FROM course_exam_session_candidates WHERE session_id= :id',{id:old.id},tx)).map(r=>r.participant_id):rows.map((r:any)=>r.participantId).filter((id:string)=>!assigned.some(c=>c.participant_id===id));
        if(!candidates.length)throw new ConflictException('Không có thí sinh cần thi.');
        const aliasNames:Record<string,string>={};
        prepared.push({...g,old,locked,rows,candidates,aliases:await this.aliases(candidates,tx,rows,aliasNames),aliasNames,label:`${snapshot.name} / ${snapshot.subject}`});
      }
      const span=validateExamArrangement(prepared,dto.period);
      await this.resources([
        'room:'+dto.roomId,...lecturerIds.map(id=>'lecturer:'+id),...externalKeys.map(key=>'external-invigilator:'+key),
        ...existing.flatMap(s=>['room:'+s.room_id,...(s.second_lecturer_id?['lecturer:'+s.second_lecturer_id]:[]),...(s.second_external_invigilator_key?['external-invigilator:'+s.second_external_invigilator_key]:[]),...(s.lecturer_id?['lecturer:'+s.lecturer_id]:[]),...(s.external_invigilator_key?['external-invigilator:'+s.external_invigilator_key]:[])]),
        ...prepared.flatMap(g=>g.aliases.map((p:string)=>'candidate:'+p))
      ],tx);
      // Resource contention may have waited past a group's original/new start.
      for(const g of prepared)if(!g.locked){
        await this.periodOpen(dto.examDate,dto.period,tx);
        if(g.old)await this.future(g.old.examDate,g.old.startTime,tx);
        await this.future(dto.examDate,g.startTime,tx);
      }
      const [room]=await this.query('SELECT * FROM rooms WHERE id= :id FOR SHARE',{id:dto.roomId},tx);
      if(!room?.is_active||!examRoomFits(room.capacity,span.peak))
        throw new ConflictException({code:'EXAM_ROOM_CAPACITY',message:`Phòng phải hoạt động, có sức chứa rõ ràng và chỉ được vượt tối đa 2 thí sinh so với số chỗ (thi đồng thời: ${span.peak} thí sinh).`});
      for(const lecturerId of lecturerIds){
        const [lecturer]=await this.query('SELECT active FROM lecturers WHERE id= :id FOR SHARE',{id:lecturerId},tx);
        if(!lecturer?.active)throw new BadRequestException('Vui lòng chọn giảng viên đang hoạt động để coi thi.');
      }
      // Reserve the entire envelope, including gaps between rounds.
      const [busy]=await this.query(`SELECT arrangement_id,room_id= :room AS room FROM course_exam_sessions
        WHERE status IN ('scheduled','held') AND arrangement_id<> :id AND exam_date= :date::date
          AND (room_id= :room OR lecturer_id IN (:lecturers) OR second_lecturer_id IN (:lecturers)
            OR external_invigilator_key IN (:externalKeys) OR second_external_invigilator_key IN (:externalKeys))
        GROUP BY arrangement_id,room_id,lecturer_id,external_invigilator_key,second_lecturer_id,second_external_invigilator_key
        HAVING min(start_time)< :end::time AND max(end_time)> :start::time ORDER BY room DESC LIMIT 1`,
        {id,date:dto.examDate,room:dto.roomId,lecturers:lecturerIds.length?lecturerIds:[null],externalKeys:externalKeys.length?externalKeys:[null],...span},tx);
      if(busy?.room)throw new ConflictException({code:'EXAM_ROOM_CONFLICT',message:'Phòng đã có buổi thi trùng giờ (bao gồm khoảng nghỉ giữa các đợt).'});
      for(const g of prepared){
        const clashes=await this.query(`SELECT DISTINCT c.participant_id,o.name,su.name AS subject FROM course_exam_sessions s
          JOIN course_exam_session_candidates c ON c.session_id=s.id JOIN course_offerings o ON o.id=s.course_offering_id JOIN subjects su ON su.id=o.subject_id
          WHERE s.status IN ('scheduled','held') AND s.arrangement_id<> :id AND s.exam_date= :date::date
            AND s.start_time< :end::time AND s.end_time> :start::time AND c.participant_id IN (:candidates)`,
          {id,date:dto.examDate,start:g.startTime,end:g.endTime,candidates:g.aliases},tx);
        if(clashes.length)throw new ConflictException({code:'EXAM_CANDIDATE_CONFLICT',message:`Thí sinh của ${g.label} đã có lịch thi khác trùng giờ ${g.startTime}–${g.endTime}.`});
      }
      if(busy)throw new ConflictException({code:'EXAM_LECTURER_CONFLICT',message:'Giám thị đã có buổi thi trùng giờ.'});
      if(!arrangementId)await this.db.query('INSERT INTO course_exam_arrangements(id,note) VALUES(:id,:note)',{transaction:tx,replacements:{id,note:dto.note||''}});
      else await this.db.query('UPDATE course_exam_arrangements SET version=version+1,note= :note WHERE id= :id',{transaction:tx,replacements:{id,note:dto.note||''}});
      for(const g of prepared){
        const sessionId=g.id||randomUUID();sessionIds.push(sessionId);
        if(g.locked)continue;
        const replacements={id:sessionId,arrangement:id,round:g.roundNo,offering:g.courseOfferingId,snapshot:g.snapshotId,date:dto.examDate,start:g.startTime,end:g.endTime,room:dto.roomId,lecturer:lecturerId,externalName,externalUnit,externalKey,secondLecturer,secondName,secondUnit,secondKey,actor:actor.id,note:dto.note||''};
        if(g.old)await this.db.query(`UPDATE course_exam_sessions SET exam_date= :date,start_time= :start,end_time= :end,room_id= :room,lecturer_id= :lecturer,round_no= :round,
          external_invigilator_name= :externalName,external_unit_name= :externalUnit,external_invigilator_key= :externalKey,
          second_lecturer_id= :secondLecturer,second_external_invigilator_name= :secondName,second_external_unit_name= :secondUnit,second_external_invigilator_key= :secondKey,
          version=version+1,updated_by= :actor,updated_at=now() WHERE id= :id`,{transaction:tx,replacements});
        else{
          await this.db.query(`INSERT INTO course_exam_sessions(id,arrangement_id,round_no,course_offering_id,eligibility_snapshot_id,exam_date,start_time,end_time,room_id,lecturer_id,external_invigilator_name,external_unit_name,external_invigilator_key,second_lecturer_id,second_external_invigilator_name,second_external_unit_name,second_external_invigilator_key,created_by,updated_by,note)
            VALUES(:id,:arrangement,:round,:offering,:snapshot,:date,:start,:end,:room,:lecturer,:externalName,:externalUnit,:externalKey,:secondLecturer,:secondName,:secondUnit,:secondKey,:actor,:actor,:note)`,{transaction:tx,replacements});
          for(const participant of g.candidates)await this.db.query('INSERT INTO course_exam_session_candidates(session_id,participant_id) VALUES(:id,:participant)',{transaction:tx,replacements:{id:sessionId,participant}});
        }
        await this.workflow.event(g.courseOfferingId,g.old?'exam.reschedule':'exam.schedule',actor,dto.note||'Xếp buổi thi',g.old,{id:sessionId,arrangementId:id,roundNo:g.roundNo,...replacements,candidateCount:g.candidates.length},tx);
      }
    });
    return {id,sessionIds};
  }
  async schedule(dto:ScheduleExamDto,actor:any){
    const result=await this.saveArrangement(null,{...dto,period:dto.startTime<'13:00'?'MORNING':'AFTERNOON',groups:[{...dto,roundNo:1}]},actor);
    return {id:result.sessionIds[0]};
  }
  async reschedule(id:string,dto:RescheduleExamDto,actor:any){
    await this.authorize(actor);
    const [s]=await this.query(`SELECT s.*,a.version AS "arrangementVersion",(s.exam_date+s.start_time) AT TIME ZONE 'Asia/Ho_Chi_Minh'>clock_timestamp() AS future FROM course_exam_sessions s JOIN course_exam_arrangements a ON a.id=s.arrangement_id WHERE s.id= :id`,{id});
    if(!s)throw new NotFoundException('Không tìm thấy ca thi.');
    if(this.access)await this.access.assertOffering(actor,s.course_offering_id);
    const siblings=await this.query(`SELECT id FROM course_exam_sessions WHERE arrangement_id= :id AND status IN ('scheduled','held')`,{id:s.arrangement_id});
    if(siblings.length!==1||s.status!=='scheduled')throw new ConflictException('Hãy sửa lịch trong buổi thi chung để giữ đồng bộ phòng và giám thị.');
    if(!s.future)throw new ConflictException({code:'EXAM_START_PASSED',message:'Không thể sửa ca thi đã bắt đầu.'});
    await this.saveArrangement(s.arrangement_id,{...dto,version:s.arrangementVersion,period:dto.startTime<'13:00'?'MORNING':'AFTERNOON',groups:[{...dto,id,roundNo:s.round_no}]},actor);
    return {id};
  }

  async cancel(id:string,dto:ExamSessionActionDto,actor:any){return this.finish(id,dto,actor,'cancelled');}
  async recordAttendance(id:string,dto:ExamCandidateAttendanceDto,actor:any){
    await this.authorize(actor);
    return this.db.transaction(async tx=>{
      const [ref]=await this.query('SELECT course_offering_id,arrangement_id FROM course_exam_sessions WHERE id= :id',{id},tx);
      if(!ref)throw new NotFoundException('Không tìm thấy ca thi.');
      if(this.access){
        const scope=await this.access.assertOffering(actor,ref.course_offering_id,tx);
        if(scope.readOnly)throw new ForbiddenException('Bạn chỉ có quyền xem danh sách thí sinh.');
      }
      const {state}=await this.workflow.lock(ref.course_offering_id,tx);
      if(['submitted','approved'].includes(state.result_status))throw new ConflictException('Kết quả đã gửi duyệt hoặc đã khóa; không thể sửa trạng thái dự thi.');
      await this.query('SELECT id FROM course_exam_arrangements WHERE id= :id FOR UPDATE',{id:ref.arrangement_id},tx);
      const session=await this.session(id,tx);this.checkVersion(session,dto.version);
      if(!['scheduled','held'].includes(session.status))throw new ConflictException('Ca thi đã hủy hoặc không diễn ra; chỉ được xem trạng thái thí sinh.');
      const [started]=await this.query(`SELECT (exam_date+start_time) AT TIME ZONE 'Asia/Ho_Chi_Minh'<=clock_timestamp() ok FROM course_exam_sessions WHERE id= :id`,{id},tx);
      if(!started.ok)throw new ConflictException('Chỉ ghi nhận vắng từ khi ca thi bắt đầu.');
      const [candidate]=await this.query(`SELECT c.participant_id,COALESCE(a.status,'present') AS status
        FROM course_exam_session_candidates c LEFT JOIN course_exam_candidate_attendance a
          ON a.session_id=c.session_id AND a.participant_id=c.participant_id
        WHERE c.session_id=:id AND c.participant_id=:participant`,{id,participant:dto.participantId},tx);
      if(!candidate)throw new NotFoundException('Thí sinh không thuộc danh sách của ca thi này.');
      await this.db.query(`INSERT INTO course_exam_candidate_attendance(session_id,participant_id,status,recorded_by,recorded_at)
        VALUES(:id,:participant,:status,:actor,clock_timestamp()) ON CONFLICT(session_id,participant_id)
        DO UPDATE SET status=EXCLUDED.status,recorded_by=EXCLUDED.recorded_by,recorded_at=EXCLUDED.recorded_at`,
        {transaction:tx,replacements:{id,participant:dto.participantId,status:dto.status,actor:actor.id}});
      const [updated]=await this.query(`UPDATE course_exam_sessions SET version=version+1,updated_by=:actor,updated_at=now() WHERE id=:id RETURNING version`,{id,actor:actor.id},tx);
      const [arrangement]=await this.query('UPDATE course_exam_arrangements SET version=version+1 WHERE id=:id RETURNING version',{id:session.arrangement_id},tx);
      await this.workflow.event(session.course_offering_id,'exam.attendance',actor,'Ghi nhận trạng thái dự thi',
        {sessionId:id,participantId:dto.participantId,status:candidate.status},{sessionId:id,participantId:dto.participantId,status:dto.status},tx);
      return {id,participantId:dto.participantId,status:dto.status,version:updated.version,arrangementId:session.arrangement_id,arrangementVersion:arrangement.version};
    });
  }
  async confirm(id:string,dto:ConfirmExamDto,actor:any){return this.finish(id,dto,actor,dto.status);}
  private async finish(id:string,dto:{version:number;note?:string},actor:any,status:'held'|'not_held'|'cancelled'){
    await this.authorize(actor);if(status!=='held'&&!dto.note?.trim())throw new BadRequestException(status==='cancelled'?'Nhập lý do hủy lịch thi.':'Nhập lý do không diễn ra.');
    const note=dto.note?.trim()||'';
    await this.db.transaction(async tx=>{
      // Offering first, matching all workflow/scheduling lock orders.
      const [ref]=await this.query('SELECT course_offering_id,arrangement_id FROM course_exam_sessions WHERE id= :id',{id},tx);
      if(!ref)throw new NotFoundException('Không tìm thấy ca thi.');
      if(this.access)await this.access.assertOffering(actor,ref.course_offering_id,tx);
      await this.workflow.lock(ref.course_offering_id,tx);
      await this.query('SELECT id FROM course_exam_arrangements WHERE id= :id FOR UPDATE',{id:ref.arrangement_id},tx);
      const s=await this.session(id,tx);this.checkVersion(s,dto.version);
      if(s.status!=='scheduled')throw new ConflictException('Ca thi đã được xử lý. Lịch sử được bảo toàn.');
      const candidates=(await this.query('SELECT participant_id FROM course_exam_session_candidates WHERE session_id= :id',{id},tx)).map(r=>r.participant_id);
      const aliases=await this.aliases(candidates,tx);
      await this.resources(['room:'+s.room_id,...(s.second_lecturer_id?['lecturer:'+s.second_lecturer_id]:[]),...(s.second_external_invigilator_key?['external-invigilator:'+s.second_external_invigilator_key]:[]),...(s.lecturer_id?['lecturer:'+s.lecturer_id]:[]),...(s.external_invigilator_key?['external-invigilator:'+s.external_invigilator_key]:[]),...aliases.map(p=>'candidate:'+p)],tx);
      if(status==='cancelled')await this.future(s.exam_date,s.start_time,tx);
      else{
        const [ended]=await this.query(`SELECT (exam_date+end_time) AT TIME ZONE 'Asia/Ho_Chi_Minh'<=clock_timestamp() ok FROM course_exam_sessions WHERE id= :id`,{id},tx);
        if(!ended.ok)throw new ConflictException('Ca thi chưa kết thúc; chưa thể xác nhận.');
      }
      await this.db.query(`UPDATE course_exam_sessions SET status= :status,version=version+1,updated_by= :actor,updated_at=now(),note= :note,
        confirmed_by=CASE WHEN :status = 'cancelled' THEN NULL ELSE :actor::uuid END,confirmed_at=CASE WHEN :status = 'cancelled' THEN NULL ELSE clock_timestamp() END WHERE id= :id`,{transaction:tx,replacements:{id,status,actor:actor.id,note}});
      if(status==='held')await this.db.query(`UPDATE course_exam_workflows SET result_status='draft',updated_at=now() WHERE course_offering_id= :offering AND result_status='not_available'`,{transaction:tx,replacements:{offering:s.course_offering_id}});
      await this.db.query('UPDATE course_exam_arrangements SET version=version+1 WHERE id= :id',{transaction:tx,replacements:{id:s.arrangement_id}});
      await this.workflow.event(s.course_offering_id,status==='cancelled'?'exam.cancel':`exam.${status}`,actor,note,s,{status},tx);
    });return {id,status};
  }
}
