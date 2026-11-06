import { BadRequestException, ConflictException, Injectable, Optional } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes, Transaction } from 'sequelize';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { RbacService } from '../auth/rbac.service.js';
import { assertGradebookWorkflowAccess } from './gradebook-workflow-access.js';
import { auditActor } from '../plan/membership-history.js';
import { calculateExamEligibility, calculateExamGrade, resolveSavedExamGrade } from './exam-grade-calculation.js';
import { LEGACY_GRADING_POLICY } from './grading-policy.js';
import { resolveApprovedExamRows, unresolvedExamRows } from './exam-tracking.js';
import { GradebookAccessService } from './gradebook-access.service.js';

export type ExamRosterLoader = (transaction: Transaction) => Promise<any[]>;
const emptyResult = { examScore: null, courseScore: null, grade4: null, letterGrade: '', attemptScores: [], result: 'pending' };
const fingerprint = (rows: any[]) => [...rows].sort((a,b)=>a.participantId.localeCompare(b.participantId)).map(row=>Object.fromEntries([
  'participantId','classGroupId','code','fullName','testScore','assignmentScore','examScore','eligible','examExempt',
  'gradingPolicy','eligibilityPolicy','studyLeaveFailure','profileForeignLanguageExempt','courseScore','result',
  'examAttendanceStatus','examSessionId','isMakeup',
].map(key=>[key,row[key]??null])));

@Injectable()
export class ExamWorkflowService {
  constructor(@InjectConnection() private readonly db: Sequelize, private readonly rbac: RbacService,
    @Optional() private readonly access?: GradebookAccessService) {}
  async query(sql: string, replacements: any = {}, transaction?: Transaction): Promise<any[]> {
    return this.db.query(sql,{replacements:{...replacements},transaction,type:QueryTypes.SELECT});
  }
  async state(id: string, transaction?: Transaction) {
    const [state] = await this.query(`SELECT w.*, NOT EXISTS (
      SELECT 1 FROM course_exam_sessions s WHERE s.course_offering_id=w.course_offering_id AND s.status<>'cancelled'
    ) AS eligibility_can_reopen FROM course_exam_workflows w WHERE w.course_offering_id=:id`,{id},transaction);
    return state || {course_offering_id:id,mode:'new',eligibility_status:'draft',eligibility_version:0,result_status:'not_available',result_version:0};
  }
  publicState(s: any) {
    return {mode:s.mode,eligibility:{status:s.eligibility_status,version:s.eligibility_version,
      snapshotId:s.eligibility_snapshot_id||null,canReopen:false,reopenRequest:null},
      final:{status:s.result_status,version:s.result_version},
      status:['submitted','approved'].includes(s.result_status)?s.result_status:'draft',version:s.result_version};
  }
  async lock(id: string, transaction: Transaction) {
    const [offering]=await this.query(`SELECT o.*,s.program FROM course_offerings o JOIN subjects s ON s.id=o.subject_id WHERE o.id=:id FOR UPDATE OF o`,{id},transaction);
    if (!offering || offering.program!=='masters') throw new BadRequestException('Không tìm thấy lớp học phần Thạc sĩ.');
    if(offering.status!=='completed') throw new ConflictException({code:'TEACHING_NOT_COMPLETED',message:'Vui lòng xác nhận hoàn thành giảng dạy trước khi nhập điểm.'});
    await this.db.query('INSERT INTO course_exam_workflows(course_offering_id) VALUES(:id) ON CONFLICT DO NOTHING',{replacements:{id},transaction});
    const state=await this.state(id,transaction);
    if(state.mode!=='new') throw new ConflictException({code:'LEGACY_REVIEW_REQUIRED',message:'Bảng điểm cũ được bảo toàn. Cần rà soát chuyển đổi trước khi dùng quy trình mới.'});
    return {offering,state};
  }
  async revision(id: string, transaction?: Transaction) {
    const [r]=await this.query('SELECT COALESCE(SUM(revision),0)::int revision FROM course_exam_gradebooks WHERE course_offering_id=:id',{id},transaction);
    return r.revision;
  }
  async event(id:string,action:string,actor:any,note:string,before:any,after:any,transaction:Transaction) {
    await this.db.query(`INSERT INTO gradebook_events(id,course_offering_id,action,actor,note,before_data,after_data)
      VALUES(:event,:id,:action,CAST(:actor AS jsonb),:note,CAST(:before AS jsonb),CAST(:after AS jsonb))`,
      {transaction,replacements:{event:randomUUID(),id,action,actor:JSON.stringify(auditActor(actor)),note,before:JSON.stringify(before),after:JSON.stringify(after)}});
  }
  private requireRevision(actual:number,expected:number){if(actual!==expected)throw new ConflictException('Điểm đã thay đổi. Hãy tải lại trước khi xử lý.');}
  private async writeRows(id:string,rows:any[],transaction:Transaction) {
    const books=await this.query('SELECT * FROM course_exam_gradebooks WHERE course_offering_id=:id ORDER BY class_group_id FOR UPDATE',{id},transaction);
    const groups=new Set(rows.map(row=>row.classGroupId));
    for(const group of groups){
      const book=books.find(b=>b.class_group_id===group);
      const merged=new Map<string,any>((book?.grades||[]).map((row:any)=>[row.participantId,row]));
      for(const row of rows.filter(row=>row.classGroupId===group))merged.set(row.participantId,row);
      await this.db.query(`INSERT INTO course_exam_gradebooks(id,class_group_id,course_offering_id,revision,grades,created_at,updated_at)
        VALUES(:book,:group,:id,1,CAST(:grades AS jsonb),now(),now()) ON CONFLICT(class_group_id,course_offering_id)
        DO UPDATE SET grades=EXCLUDED.grades,revision=course_exam_gradebooks.revision+1,updated_at=now()`,
        {transaction,replacements:{book:book?.id||randomUUID(),group,id,grades:JSON.stringify([...merged.values()])}});
    }
  }
  async approvedRows(id:string,state:any,transaction?:Transaction) {
    const [snapshot]=await this.query('SELECT * FROM course_exam_eligibility_snapshots WHERE id=:snapshot AND course_offering_id=:id',{snapshot:state.eligibility_snapshot_id,id},transaction);
    if(!snapshot)throw new ConflictException('Không tìm thấy snapshot tư cách đã duyệt.');
    const books=await this.query('SELECT grades FROM course_exam_gradebooks WHERE course_offering_id=:id ORDER BY updated_at DESC,class_group_id',{id},transaction);
    const held=(await this.query(`SELECT c.participant_id FROM course_exam_session_candidates c JOIN course_exam_sessions s ON s.id=c.session_id
      WHERE s.course_offering_id=:id AND s.status='held'`,{id,snapshot:snapshot.id},transaction)).map(r=>r.participant_id);
    const attempts=await this.query(`SELECT DISTINCT ON (c.participant_id) c.participant_id,c.session_id,c.makeup_for_session_id,s.status,
      COALESCE(a.status,'present') AS attendance FROM course_exam_sessions s JOIN course_exam_session_candidates c ON c.session_id=s.id
      LEFT JOIN course_exam_candidate_attendance a ON a.session_id=c.session_id AND a.participant_id=c.participant_id
      WHERE s.course_offering_id=:id AND s.status IN ('scheduled','held')
      ORDER BY c.participant_id,s.exam_date DESC,s.start_time DESC,s.created_at DESC,s.id DESC`,{id},transaction);
    return resolveApprovedExamRows(snapshot.rows,books,held,state,attempts);
  }
  componentRow(row:any) {
    return {...row,...emptyResult,eligible:calculateExamEligibility(row,row.eligibilityPolicy),workflowPhase:'components',eligibilityFrozen:false,examScoreEditable:false,
      ...(row.studyLeaveFailure?{result:'failed'}:row.profileForeignLanguageExempt?{result:'passed'}:row.examExempt?{result:'exempt'}:{})};
  }
  async save(dto:any,actor:any,load:ExamRosterLoader,{componentImport=false}={}) {
    await assertGradebookWorkflowAccess(actor,'submit',this.rbac);
    await this.db.transaction(async transaction=>{
      // Retain the existing grade/policy/transcript-publication mutex. Exam
      // scheduling itself uses offering/resource locks, not this shared lock.
      await this.query('SELECT pg_advisory_xact_lock(21026)',{},transaction);
      const {state}=await this.lock(dto.courseOfferingId,transaction);
      if(this.access)await this.access.assertOffering(actor,dto.courseOfferingId,transaction);
      if(componentImport){
        // Scheduling takes the same offering row lock. Check inside this
        // transaction so a concurrently created session cannot slip through.
        const sessions=await this.query('SELECT id FROM course_exam_sessions WHERE course_offering_id=:id LIMIT 1',{id:dto.courseOfferingId},transaction);
        if(sessions.length)throw new ConflictException({code:'COMPONENT_IMPORT_CLOSED',message:'Lớp học phần đã tạo lịch thi, không được nhập điểm từ Excel (kể cả lịch thi đã hủy).'});
        if(!Array.isArray(dto.rows)||!dto.rows.length||dto.rows.length>1000)throw new BadRequestException('File phải có từ 1 đến 1000 học viên cần cập nhật.');
      }
      this.requireRevision(await this.revision(dto.courseOfferingId,transaction),dto.revision);
      if(['submitted','approved'].includes(state.result_status))throw new ConflictException('Bảng điểm đã gửi duyệt hoặc đã khóa. Cần mở lại kết quả trước khi sửa.');
      const rows:any[]=state.eligibility_status==='approved'?await this.approvedRows(dto.courseOfferingId,state,transaction):await load(transaction);
      const byId=new Map<string,any>(rows.map(row=>[row.participantId,row]));const ids=new Set<string>();const changed:any[]=[];
      for(const input of dto.rows){
        let value=input;
        if(componentImport){
          const current=byId.get(input.participantId);
          if(!current)throw new BadRequestException('Học viên không thuộc danh sách lớp học phần.');
          if(input.testScore==null&&input.assignmentScore==null)throw new BadRequestException('Học viên chưa có điểm KT hoặc TL/BTL để nhập.');
          const policy=current.eligibilityPolicy||LEGACY_GRADING_POLICY;
          // Only these two fields may cross the import boundary. Empty cells
          // preserve saved scores; results, exemption and notes stay authoritative.
          value={...current,testScore:input.testScore??current.testScore,assignmentScore:input.assignmentScore??current.assignmentScore,
            policyVersion:policy.version,policyRulesVersion:policy.rulesVersion};
        }
        for(const key of ['testScore','assignmentScore','examScore']){
          const score=value[key];
          if(score!=null&&(typeof score!=='number'||!Number.isFinite(score)||score<0||score>10))throw new BadRequestException('Điểm phải là số từ 0 đến 10.');
        }
        const row=byId.get(value.participantId);
        if(!row||ids.has(value.participantId))throw new BadRequestException('Học viên ngoài danh sách hoặc bị lặp.');ids.add(value.participantId);
        if(row.profileForeignLanguageExempt||row.studyLeaveFailure)throw new ConflictException('Trạng thái đặc biệt được quản lý từ hồ sơ, không sửa điểm trực tiếp.');
        const policy=row.eligibilityPolicy||LEGACY_GRADING_POLICY;
        const componentsChanged=value.testScore!==row.testScore||value.assignmentScore!==row.assignmentScore||value.examExempt!==row.examExempt;
        if((state.eligibility_status!=='approved'||componentsChanged||value.policyVersion!==undefined)&&
          ((value.policyVersion??0)!==policy.version||(value.policyRulesVersion??0)!==(policy.rulesVersion??0)))throw new ConflictException('Cấu hình điểm đã thay đổi. Hãy tải lại.');
        const examScore=value.examScore===undefined?row.examScore??null:value.examScore;
        if(examScore!==row.examScore&&examScore!=null&&!row.examScoreEditable)throw new ConflictException('Chỉ nhập điểm thi sau khi ca thi của học viên được xác nhận Đã diễn ra.');
        const updated={...row,testScore:value.testScore??null,assignmentScore:value.assignmentScore??null,
          examExempt:value.examExempt,examScore,notes:value.notes||'',gradingPolicy:row.gradingPolicy||policy,
          eligibilityFrozen:false,finalized:false};
        updated.eligible=calculateExamEligibility(updated,policy);
        changed.push({...updated,...calculateExamGrade(updated,updated.gradingPolicy,policy),
          workflowPhase:row.workflowPhase,attemptScores:examScore==null?[]:[examScore]});
      }
      await this.writeRows(dto.courseOfferingId,changed,transaction);
      const roster=rows.map(row=>changed.find(value=>value.participantId===row.participantId)||row);
      if(state.eligibility_status!=='approved'||changed.some(row=>{
        const old=byId.get(row.participantId);
        return ['testScore','assignmentScore','examExempt','eligible'].some(key=>row[key]!==old[key]);
      }))await this.refreshEligibility(dto.courseOfferingId,state,roster,actor,transaction);
      await this.event(dto.courseOfferingId,'save',actor,componentImport?'Nhập điểm KT và TL/BTL từ Excel':'Lưu điểm',rows.filter(row=>ids.has(row.participantId)),changed,transaction);
    });
  }
  private async refreshEligibility(id:string,state:any,rows:any[],actor:any,transaction:Transaction) {
    const complete=rows.length>0&&rows.every(row=>row.examExempt||row.profileForeignLanguageExempt||row.studyLeaveFailure||row.eligible!=null);
    if(!complete&&state.eligibility_status!=='approved')return;
    // Keep each scheduling snapshot immutable. Existing sessions retain their original roster.
    const snapshotId=randomUUID(),version=state.eligibility_version+1;
    await this.db.query(`INSERT INTO course_exam_eligibility_snapshots(id,course_offering_id,version,rows,actor)
      VALUES(:snapshotId,:id,:version,CAST(:rows AS jsonb),CAST(:actor AS jsonb))`,
      {transaction,replacements:{snapshotId,id,version,rows:JSON.stringify(rows),actor:JSON.stringify(auditActor(actor))}});
    await this.db.query(`UPDATE course_exam_workflows SET eligibility_status='approved',eligibility_version=:version,
      eligibility_snapshot_id=:snapshotId,eligibility_submission=NULL,result_status=:resultStatus,updated_at=now() WHERE course_offering_id=:id`,
      {transaction,replacements:{id,version,snapshotId,resultStatus:state.result_status==='draft'||!rows.some(row=>row.eligible===true&&!row.examExempt)?'draft':'not_available'}});
  }
  async transition(dto:any,actor:any,phase:'eligibility'|'final',_load:ExamRosterLoader) {
    await assertGradebookWorkflowAccess(actor,dto.action,this.rbac);
    if(phase!=='final'||!['submit','approve','reopen'].includes(dto.action))throw new BadRequestException('Tư cách thi được tính tự động khi lưu điểm, không cần duyệt hoặc mở khóa trước khi thi.');
    const note = dto.note?.trim() || '';
    if(dto.action==='reopen' && !note)throw new BadRequestException('Nhập lý do hoặc căn cứ mở lại.');
    await this.db.transaction(async transaction=>{
      await this.query('SELECT pg_advisory_xact_lock(21026)',{},transaction);
      const {state}=await this.lock(dto.courseOfferingId,transaction);const id=dto.courseOfferingId;
      if(this.access)await this.access.assertOffering(actor,id,transaction);
      const status=state.result_status;
      const version=state.result_version;
      if(version!==dto.version)throw new ConflictException('Phiên bản quy trình đã thay đổi. Hãy tải lại.');
      this.requireRevision(await this.revision(id,transaction),dto.revision);
      const expected=dto.action==='submit'?'draft':dto.action==='approve'?'submitted':null;
      if(expected?status!==expected:!['approved','submitted'].includes(status))throw new ConflictException('Thao tác không phù hợp trạng thái.');
      const next=dto.action==='submit'?'submitted':dto.action==='approve'?'approved':'draft';
      if(state.eligibility_status!=='approved')throw new ConflictException('Chưa có danh sách thi đã duyệt.');
      const rows=await this.approvedRows(id,state,transaction);
      if(dto.action!=='reopen'){
        const unresolved=unresolvedExamRows(rows);
        if(!rows.length||unresolved.length)throw new ConflictException({message:'Chưa có đủ kết quả thi đã diễn ra.',unresolved:unresolved.map(r=>({participantId:r.participantId,code:r.code}))});
        if(dto.action==='approve'&&!isDeepStrictEqual(fingerprint(rows),fingerprint(state.result_snapshot?.rows||[])))throw new ConflictException('Kết quả thay đổi sau khi gửi duyệt.');
        if(dto.action==='approve')await this.writeRows(id,rows.map(row=>({...row,finalized:true})),transaction);
      }
      const snapshot=dto.action==='reopen'?null:{rows,actor:auditActor(actor),at:new Date().toISOString()};
      await this.db.query(`UPDATE course_exam_workflows SET result_status=:next,result_version=result_version+1,result_snapshot=CAST(:snapshot AS jsonb),updated_at=now() WHERE course_offering_id=:id`,{transaction,replacements:{id,next,snapshot:JSON.stringify(snapshot)}});
      // Existing transcript consumers retain their established finalized representation.
      if(dto.action==='reopen')await this.writeRows(id,rows.map(row=>({...row,finalized:false})),transaction);
      await this.db.query(`UPDATE course_offerings SET gradebook_status=:next,gradebook_version=gradebook_version+1,gradebook_snapshot=CAST(:snapshot AS jsonb) WHERE id=:id`,{transaction,replacements:{id,next,snapshot:JSON.stringify(snapshot)}});
      await this.event(id,`${phase}.${dto.action}`,actor,note,state,await this.state(id,transaction),transaction);
    });
  }
}
