import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes, Transaction } from 'sequelize';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { RbacService } from '../auth/rbac.service.js';
import { assertGradebookWorkflowAccess } from './gradebook-workflow-access.js';
import { auditActor } from '../plan/membership-history.js';
import { calculateExamEligibility, calculateExamGrade, roundExamScore } from './exam-grade-calculation.js';
import { LEGACY_GRADING_POLICY } from './grading-policy.js';
import { resolveApprovedExamRows, unresolvedExamRows } from './exam-tracking.js';

export type ExamRosterLoader = (transaction: Transaction) => Promise<any[]>;
const emptyResult = { examScore: null, courseScore: null, grade4: null, letterGrade: '', attemptScores: [], result: 'pending' };
const fingerprint = (rows: any[]) => [...rows].sort((a,b)=>a.participantId.localeCompare(b.participantId)).map(row=>Object.fromEntries([
  'participantId','classGroupId','code','fullName','testScore','assignmentScore','examScore','eligible','examExempt',
  'gradingPolicy','eligibilityPolicy','studyLeaveFailure','profileForeignLanguageExempt','courseScore','result',
].map(key=>[key,row[key]??null])));

@Injectable()
export class ExamWorkflowService {
  constructor(@InjectConnection() private readonly db: Sequelize, private readonly rbac: RbacService) {}
  async query(sql: string, replacements: any = {}, transaction?: Transaction): Promise<any[]> {
    return this.db.query(sql,{replacements:{...replacements},transaction,type:QueryTypes.SELECT});
  }
  async state(id: string, transaction?: Transaction) {
    const [state] = await this.query('SELECT * FROM course_exam_workflows WHERE course_offering_id=:id',{id},transaction);
    return state || {course_offering_id:id,mode:'new',eligibility_status:'draft',eligibility_version:0,result_status:'not_available',result_version:0};
  }
  publicState(s: any) {
    return {mode:s.mode,eligibility:{status:s.eligibility_status,version:s.eligibility_version,snapshotId:s.eligibility_snapshot_id||null},
      final:{status:s.result_status,version:s.result_version},status:s.result_status==='not_available'?s.eligibility_status:s.result_status,
      version:s.eligibility_version};
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
      WHERE s.course_offering_id=:id AND s.eligibility_snapshot_id=:snapshot AND s.status='held'`,{id,snapshot:snapshot.id},transaction)).map(r=>r.participant_id);
    return resolveApprovedExamRows(snapshot.rows,books,held,state);
  }
  componentRow(row:any) {
    return {...row,...emptyResult,eligible:calculateExamEligibility(row,row.eligibilityPolicy),workflowPhase:'components',eligibilityFrozen:false,examScoreEditable:false,
      ...(row.studyLeaveFailure?{result:'failed'}:row.profileForeignLanguageExempt?{result:'passed'}:row.examExempt?{result:'exempt'}:{})};
  }
  async save(dto:any,actor:any,load:ExamRosterLoader) {
    await assertGradebookWorkflowAccess(actor,'submit',this.rbac);
    await this.db.transaction(async transaction=>{
      // Retain the existing grade/policy/transcript-publication mutex. Exam
      // scheduling itself uses offering/resource locks, not this shared lock.
      await this.query('SELECT pg_advisory_xact_lock(21026)',{},transaction);
      const {state}=await this.lock(dto.courseOfferingId,transaction);
      this.requireRevision(await this.revision(dto.courseOfferingId,transaction),dto.revision);
      const approved=state.eligibility_status==='approved';
      if(approved?state.result_status!=='draft':state.eligibility_status!=='draft')throw new ConflictException('Giai đoạn này đã khóa, không thể sửa điểm.');
      const rows:any[]=approved?await this.approvedRows(dto.courseOfferingId,state,transaction):await load(transaction);
      const byId=new Map<string,any>(rows.map(row=>[row.participantId,row]));const ids=new Set<string>();const changed:any[]=[];
      for(const value of dto.rows){
        for(const key of ['testScore','assignmentScore','examScore']){
          const score=value[key];
          if(score!=null&&(typeof score!=='number'||!Number.isFinite(score)||score<0||score>10))throw new BadRequestException('Điểm phải là số từ 0 đến 10.');
        }
        const row=byId.get(value.participantId);
        if(!row||ids.has(value.participantId))throw new BadRequestException('Học viên ngoài danh sách hoặc bị lặp.');ids.add(value.participantId);
        if(row.profileForeignLanguageExempt||row.studyLeaveFailure)throw new ConflictException('Trạng thái đặc biệt được quản lý từ hồ sơ, không sửa điểm trực tiếp.');
        if(approved){
          if((value.testScore!==undefined&&value.testScore!==row.testScore)||(value.assignmentScore!==undefined&&value.assignmentScore!==row.assignmentScore)||value.examExempt!==row.examExempt)throw new ConflictException('Điểm thành phần và tư cách đã duyệt không được thay đổi.');
          if(!row.examScoreEditable)throw new ConflictException('Chỉ nhập điểm thi sau khi ca thi của học viên được xác nhận Đã diễn ra.');
          const examScore=roundExamScore(value.examScore);
          changed.push({...row,examScore,...calculateExamGrade({...row,examScore},row.gradingPolicy,row.eligibilityPolicy),notes:value.notes||'',attemptScores:examScore==null?[]:[examScore]});
        }else{
          if(value.examScore!=null)throw new ConflictException('Chưa đến giai đoạn nhập điểm thi.');
          const policy=row.eligibilityPolicy||LEGACY_GRADING_POLICY;
          if((value.policyVersion??0)!==policy.version||(value.policyRulesVersion??0)!==(policy.rulesVersion??0))throw new ConflictException('Cấu hình điểm đã thay đổi. Hãy tải lại.');
          changed.push(this.componentRow({...row,testScore:roundExamScore(value.testScore),assignmentScore:roundExamScore(value.assignmentScore),examExempt:value.examExempt,notes:value.notes||'',gradingPolicy:row.gradingPolicy||policy}));
        }
      }
      await this.writeRows(dto.courseOfferingId,changed,transaction);
      await this.event(dto.courseOfferingId,approved?'final.save':'eligibility.save',actor,'Lưu điểm',rows.filter(row=>ids.has(row.participantId)),changed,transaction);
    });
  }
  async transition(dto:any,actor:any,phase:'eligibility'|'final',load:ExamRosterLoader) {
    await assertGradebookWorkflowAccess(actor,dto.action,this.rbac);
    if(!dto.note?.trim())throw new BadRequestException('Nhập lý do hoặc căn cứ xử lý.');
    await this.db.transaction(async transaction=>{
      await this.query('SELECT pg_advisory_xact_lock(21026)',{},transaction);
      const {state}=await this.lock(dto.courseOfferingId,transaction);const id=dto.courseOfferingId;
      const status=phase==='eligibility'?state.eligibility_status:state.result_status;
      const version=phase==='eligibility'?state.eligibility_version:state.result_version;
      if(version!==dto.version)throw new ConflictException('Phiên bản quy trình đã thay đổi. Hãy tải lại.');
      this.requireRevision(await this.revision(id,transaction),dto.revision);
      const expected=dto.action==='submit'?'draft':dto.action==='approve'?'submitted':null;
      if(expected?status!==expected:!['approved','submitted'].includes(status))throw new ConflictException('Thao tác không phù hợp trạng thái.');
      const next=dto.action==='submit'?'submitted':dto.action==='approve'?'approved':'draft';
      if(phase==='eligibility'){
        if(dto.action==='reopen'){
          const sessions=await this.query(`SELECT id FROM course_exam_sessions WHERE course_offering_id=:id AND status<>'cancelled' LIMIT 1`,{id},transaction);
          if(sessions.length)throw new ConflictException('Lịch thi còn lịch sử chưa được hủy/giải quyết; không thể mở lại tư cách.');
          await this.db.query(`UPDATE course_exam_workflows SET eligibility_status='draft',eligibility_version=eligibility_version+1,
            eligibility_snapshot_id=NULL,eligibility_submission=NULL,result_status='not_available',updated_at=now() WHERE course_offering_id=:id`,{transaction,replacements:{id}});
        }else{
          const rows=await load(transaction);
          const unresolved=rows.filter(row=>!row.examExempt&&!row.profileForeignLanguageExempt&&!row.studyLeaveFailure&&calculateExamEligibility(row,row.eligibilityPolicy)==null);
          if(!rows.length||unresolved.length)throw new ConflictException({message:'Chưa đủ điểm thành phần để gửi duyệt tư cách.',unresolved:unresolved.map(r=>({participantId:r.participantId,code:r.code,fullName:r.fullName}))});
          if(dto.action==='approve'&&!isDeepStrictEqual(fingerprint(rows),fingerprint(state.eligibility_submission?.rows||[])))throw new ConflictException('Danh sách, điểm thành phần hoặc cấu hình đã thay đổi. Mở lại và gửi duyệt lại.');
          const snapshot={rows,actor:auditActor(actor),at:new Date().toISOString()};
          let snapshotId=null;
          if(dto.action==='approve'){
            snapshotId=randomUUID();await this.db.query(`INSERT INTO course_exam_eligibility_snapshots(id,course_offering_id,version,rows,actor)
              VALUES(:snapshotId,:id,:version,CAST(:rows AS jsonb),CAST(:actor AS jsonb))`,{transaction,replacements:{snapshotId,id,version:version+1,rows:JSON.stringify(rows),actor:JSON.stringify(auditActor(actor))}});
            await this.writeRows(id,rows.map(row=>({...row,eligibilityFrozen:true,workflowPhase:'final',examScoreEditable:false})),transaction);
          }
          await this.db.query(`UPDATE course_exam_workflows SET eligibility_status=:next,eligibility_version=eligibility_version+1,
            eligibility_submission=CAST(:submission AS jsonb),eligibility_snapshot_id=:snapshotId,
            result_status=:resultStatus,updated_at=now() WHERE course_offering_id=:id`,{transaction,replacements:{id,next,submission:JSON.stringify(snapshot),snapshotId,resultStatus:next==='approved'&&!rows.some(r=>r.eligible===true&&!r.examExempt)?'draft':'not_available'}});
        }
      }else{
        if(state.eligibility_status!=='approved')throw new ConflictException('Chưa có danh sách thi đã duyệt.');
        const rows=await this.approvedRows(id,state,transaction);
        if(dto.action!=='reopen'){
          const unresolved=unresolvedExamRows(rows);
          if(unresolved.length)throw new ConflictException({message:'Chưa có đủ kết quả thi đã diễn ra.',unresolved:unresolved.map(r=>({participantId:r.participantId,code:r.code}))});
          if(dto.action==='approve'&&!isDeepStrictEqual(fingerprint(rows),fingerprint(state.result_snapshot?.rows||[])))throw new ConflictException('Kết quả thay đổi sau khi gửi duyệt.');
          if(dto.action==='approve')await this.writeRows(id,rows.map(row=>({...row,finalized:true})),transaction);
        }
        const snapshot=dto.action==='reopen'?null:{rows,actor:auditActor(actor),at:new Date().toISOString()};
        await this.db.query(`UPDATE course_exam_workflows SET result_status=:next,result_version=result_version+1,result_snapshot=CAST(:snapshot AS jsonb),updated_at=now() WHERE course_offering_id=:id`,{transaction,replacements:{id,next,snapshot:JSON.stringify(snapshot)}});
        // Existing transcript consumers retain their established finalized representation.
        if(dto.action==='reopen')await this.writeRows(id,rows.map(row=>({...row,finalized:false})),transaction);
        await this.db.query(`UPDATE course_offerings SET gradebook_status=:next,gradebook_version=gradebook_version+1,gradebook_snapshot=CAST(:snapshot AS jsonb) WHERE id=:id`,{transaction,replacements:{id,next,snapshot:JSON.stringify(snapshot)}});
      }
      await this.event(id,`${phase}.${dto.action}`,actor,dto.note,state,await this.state(id,transaction),transaction);
    });
  }
}
