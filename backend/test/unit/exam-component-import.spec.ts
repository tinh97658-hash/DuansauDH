import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Staff } from '../../src/database/models/staff.model.js';
import { ExamWorkflowService } from '../../src/masters/exam-workflow.service.js';
import { ImportExamComponentsDto } from '../../src/masters/dto/exam-gradebook.dto.js';
import { LEGACY_GRADING_POLICY as policy } from '../../src/masters/grading-policy.js';

function fixture() {
  const actor = Object.create(Staff.prototype), tx = {} as any;
  const db:any = { transaction: jest.fn(async cb => cb(tx)), query: jest.fn().mockResolvedValue([]) };
  const rbac:any = { effectiveAccess: jest.fn().mockResolvedValue({ permissions: new Set(['gradebook.submit']) }) };
  const service = new ExamWorkflowService(db, rbac);
  const lock = jest.spyOn(service, 'lock').mockResolvedValue({ state: { mode:'new',eligibility_status:'draft',eligibility_version:0,result_status:'not_available' }, offering:{} });
  jest.spyOn(service, 'revision').mockResolvedValue(3);
  const query = jest.spyOn(service, 'query').mockResolvedValue([]);
  const write = jest.spyOn(service as any, 'writeRows').mockResolvedValue(undefined);
  const event = jest.spyOn(service, 'event').mockResolvedValue();
  const current:any = { participantId:'student:one', classGroupId:'g1', testScore:7, assignmentScore:null, examScore:null,
    examExempt:false, eligible:null, notes:'Giữ ghi chú', gradingPolicy:policy,eligibilityPolicy:policy };
  const load = jest.fn().mockResolvedValue([current]);
  const dto:any = { courseOfferingId:'o1', revision:3, rows:[{ participantId:current.participantId,testScore:0,assignmentScore:8 }] };
  return { service,actor,tx,query,write,event,current,load,dto,lock,rbac, run: () => service.save(dto,actor,load,{componentImport:true}) };
}

it('imports only the allowed components using authoritative exemption, notes and policy',async()=>{
  const f=fixture();Object.assign(f.dto.rows[0],{examScore:10,examExempt:true,notes:'Injected',result:'passed',policyVersion:999});
  await f.run();
  expect(f.write.mock.calls[0][1][0]).toMatchObject({testScore:0,assignmentScore:8,examScore:null,examExempt:false,notes:'Giữ ghi chú'});
  expect(f.event).toHaveBeenCalledWith('o1','save',f.actor,'Nhập điểm KT và TL/BTL từ Excel',expect.any(Array),expect.any(Array),f.tx);
});

it('checks for any created session under the scheduling offering lock and rejects cancelled sessions too',async()=>{
  const f=fixture();f.query.mockImplementation(async sql=>sql.includes('course_exam_sessions')?[{id:'cancelled-session'}]:[]);
  await expect(f.run()).rejects.toThrow(ConflictException);
  expect(f.lock.mock.invocationCallOrder[0]).toBeLessThan(f.query.mock.invocationCallOrder[1]);
  expect(f.query).toHaveBeenCalledWith(expect.stringContaining('FROM course_exam_sessions'),{id:'o1'},f.tx);
  expect(f.query.mock.calls.find(([sql])=>sql.includes('course_exam_sessions'))?.[0]).not.toContain('status');
  expect(f.write).not.toHaveBeenCalled();
});

it('preserves a score for an empty imported cell and rejects stale revisions',async()=>{
  const f=fixture();delete f.dto.rows[0].testScore;await f.run();
  expect(f.write.mock.calls[0][1][0].testScore).toBe(7);
  f.dto.revision=2;await expect(f.run()).rejects.toThrow(ConflictException);
});

it.each([11,-1,'8',NaN])('rejects invalid component values at the trusted boundary: %s',async value=>{
  const f=fixture();f.dto.rows[0].testScore=value;await expect(f.run()).rejects.toThrow(BadRequestException);expect(f.write).not.toHaveBeenCalled();
});

it('rejects nonmembers, duplicates, empty scores and protected profiles atomically',async()=>{
  const f=fixture();f.dto.rows[0].participantId='outsider';await expect(f.run()).rejects.toThrow(BadRequestException);
  f.dto.rows=[{participantId:f.current.participantId}];await expect(f.run()).rejects.toThrow(BadRequestException);
  f.dto.rows=[{participantId:f.current.participantId,testScore:8},{participantId:f.current.participantId,testScore:9}];await expect(f.run()).rejects.toThrow(BadRequestException);
  f.dto.rows.pop();f.current.studyLeaveFailure=true;await expect(f.run()).rejects.toThrow(ConflictException);
  expect(f.write).not.toHaveBeenCalled();
});

it('requires a staff actor with grade submission permission',async()=>{
  const f=fixture();f.rbac.effectiveAccess.mockResolvedValue({permissions:new Set()});
  await expect(f.run()).rejects.toThrow(ForbiddenException);expect(f.lock).not.toHaveBeenCalled();
});

it('validates the minimal import DTO, score limits and unknown fields',async()=>{
  const base={classGroupId:'11111111-1111-4111-8111-111111111111',courseOfferingId:'22222222-2222-4222-8222-222222222222',revision:0,rows:[{participantId:'student:one',testScore:0,assignmentScore:8}]};
  expect(await validate(plainToInstance(ImportExamComponentsDto,base))).toHaveLength(0);
  for(const rows of [[],[{participantId:'student:one',testScore:11}],[{participantId:'student:one',examScore:8}]]){
    expect((await validate(plainToInstance(ImportExamComponentsDto,{...base,rows}),{whitelist:true,forbidNonWhitelisted:true})).length).toBeGreaterThan(0);
  }
});
