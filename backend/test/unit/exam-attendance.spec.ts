import {ConflictException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {validate} from 'class-validator';
import {plainToInstance} from 'class-transformer';
import {Staff} from '../../src/database/models/staff.model.js';
import {ExamScheduleService} from '../../src/masters/exam-schedule.service.js';
import {ExamCandidateAttendanceDto} from '../../src/masters/dto/exam-schedule.dto.js';

const participantId='admission:11111111-1111-4111-8111-111111111111';
const dto={version:4,participantId,status:'absent_excused' as const};
function fixture(){
 const actor=Object.defineProperty(Object.create(Staff.prototype),'id',{value:'staff'});
 const tx={},db:any={transaction:jest.fn(async cb=>cb(tx)),query:jest.fn().mockResolvedValue([])};
 const session={id:'session',course_offering_id:'offering',arrangement_id:'arrangement',status:'held',version:4};
 const query=jest.fn(async(sql:string)=>{
  if(sql.startsWith('SELECT course_offering_id'))return [{course_offering_id:'offering',arrangement_id:'arrangement'}];
  if(sql.startsWith('SELECT * FROM course_exam_sessions'))return [session];
  if(sql.includes('clock_timestamp() ok'))return [{ok:true}];
  if(sql.startsWith('SELECT c.participant_id'))return [{participant_id:participantId,status:'present'}];
  if(sql.startsWith('UPDATE course_exam_sessions'))return [{version:5}];
  if(sql.startsWith('UPDATE course_exam_arrangements'))return [{version:8}];
  return [];
 });
 const workflow:any={query,lock:jest.fn().mockResolvedValue({state:{result_status:'draft'}}),event:jest.fn()};
 const rbac:any={effectiveAccess:jest.fn().mockResolvedValue({permissions:new Set(['exams.write']),groupScope:{readOnly:false}})};
 const access:any={assertOffering:jest.fn().mockResolvedValue({readOnly:false})};
 return {actor,tx,db,session,query,workflow,rbac,access,service:new ExamScheduleService(db,workflow,rbac,access)};
}

it.each(['present','absent_excused','absent_unexcused'])('persists %s with audit history and new session/arrangement versions',async status=>{
 const f=fixture();
 const result=await f.service.recordAttendance('session',{...dto,status:status as any},f.actor);
 expect(result).toEqual({id:'session',participantId,status,version:5,arrangementId:'arrangement',arrangementVersion:8});
 expect(f.db.query).toHaveBeenCalledTimes(1);
 expect(f.db.query).toHaveBeenCalledWith(expect.any(String),expect.objectContaining({transaction:f.tx,replacements:{id:'session',participant:participantId,status,actor:'staff'}}));
 expect(f.workflow.event).toHaveBeenCalledWith('offering','exam.attendance',f.actor,expect.any(String),
  {sessionId:'session',participantId,status:'present'},{sessionId:'session',participantId,status},f.tx);
});

it('rejects staff without exam-write access and read-only profiles',async()=>{
 const f=fixture();f.rbac.effectiveAccess.mockResolvedValue({permissions:new Set(['exams.view'])});
 await expect(f.service.recordAttendance('session',dto,f.actor)).rejects.toThrow(ForbiddenException);
 expect(f.db.transaction).not.toHaveBeenCalled();
 f.rbac.effectiveAccess.mockResolvedValue({permissions:new Set(['exams.write']),groupScope:{readOnly:true}});
 await expect(f.service.recordAttendance('session',dto,f.actor)).rejects.toThrow(ForbiddenException);
 expect(f.db.transaction).not.toHaveBeenCalled();
});

it('checks offering responsibility before locking or writing',async()=>{
 const f=fixture();f.access.assertOffering.mockRejectedValue(new ForbiddenException());
 await expect(f.service.recordAttendance('session',dto,f.actor)).rejects.toThrow(ForbiddenException);
 expect(f.workflow.lock).not.toHaveBeenCalled();expect(f.db.query).not.toHaveBeenCalled();
});

it.each(['submitted','approved'])('preserves %s final results',async result_status=>{
 const f=fixture();f.workflow.lock.mockResolvedValue({state:{result_status}});
 await expect(f.service.recordAttendance('session',dto,f.actor)).rejects.toThrow(ConflictException);
 expect(f.db.query).not.toHaveBeenCalled();
});

it.each(['cancelled','not_held'])('does not mark attendance for %s sessions',async status=>{
 const f=fixture();f.session.status=status;
 await expect(f.service.recordAttendance('session',dto,f.actor)).rejects.toThrow(ConflictException);
 expect(f.db.query).not.toHaveBeenCalled();
});

it('rejects stale versions and future exams without writing',async()=>{
 const f=fixture();await expect(f.service.recordAttendance('session',{...dto,version:3},f.actor)).rejects.toThrow(ConflictException);
 const original=f.query.getMockImplementation()!;
 f.query.mockImplementation(async sql=>sql.includes('clock_timestamp() ok')?[{ok:false}]:original(sql));
 await expect(f.service.recordAttendance('session',dto,f.actor)).rejects.toThrow(ConflictException);
 expect(f.db.query).not.toHaveBeenCalled();
});

it('rejects candidates outside the frozen roster',async()=>{
 const f=fixture(),original=f.query.getMockImplementation()!;
 f.query.mockImplementation(async sql=>sql.startsWith('SELECT c.participant_id')?[]:original(sql));
 await expect(f.service.recordAttendance('session',dto,f.actor)).rejects.toThrow(NotFoundException);
 expect(f.db.query).not.toHaveBeenCalled();
});

it('validates mutually exclusive attendance, participant identity and version',async()=>{
 for(const status of ['present','absent_excused','absent_unexcused'])expect(await validate(plainToInstance(ExamCandidateAttendanceDto,{...dto,status}))).toEqual([]);
 for(const change of [{status:['absent_excused','absent_unexcused']},{status:'absent'},{version:-1},{version:'4'},{participantId:'not-a-candidate'},{participantId:''}])
  expect((await validate(plainToInstance(ExamCandidateAttendanceDto,{...dto,...change}))).length).toBeGreaterThan(0);
});
