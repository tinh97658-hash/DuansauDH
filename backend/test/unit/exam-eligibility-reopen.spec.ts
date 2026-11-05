import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Staff } from '../../src/database/models/staff.model.js';
import { ExamWorkflowService } from '../../src/masters/exam-workflow.service.js';
import { LEGACY_GRADING_POLICY as policy } from '../../src/masters/grading-policy.js';

function fixture(access?: any) {
  const actor = Object.create(Staff.prototype);
  const state: any = { mode:'new',eligibility_status:'draft',eligibility_version:0,result_status:'not_available',result_version:0 };
  const db: any = {transaction:jest.fn(async cb=>cb({})),query:jest.fn().mockResolvedValue([])};
  const rbac: any = {effectiveAccess:jest.fn().mockResolvedValue({permissions:new Set(['gradebook.submit','gradebook.approve'])})};
  const service = new ExamWorkflowService(db,rbac,access);
  jest.spyOn(service,'lock').mockResolvedValue({state,offering:{}});
  jest.spyOn(service,'revision').mockResolvedValue(3);
  jest.spyOn(service,'state').mockResolvedValue(state);
  jest.spyOn(service,'query').mockResolvedValue([]);
  jest.spyOn(service,'event').mockResolvedValue();
  const write = jest.spyOn(service as any,'writeRows').mockResolvedValue(undefined);
  const row: any = {participantId:'learner',classGroupId:'group',testScore:8,assignmentScore:8,examScore:null,
    examExempt:false,eligible:null,gradingPolicy:policy,eligibilityPolicy:policy};
  const load = jest.fn().mockResolvedValue([row]);
  jest.spyOn(service,'approvedRows').mockImplementation(async()=>[row]);
  const dto = {courseOfferingId:'offering',revision:3,rows:[{...row,policyVersion:policy.version,policyRulesVersion:policy.rulesVersion}]};
  return {actor,state,db,service,write,row,load,dto};
}

it('automatically publishes complete components without an approval',async()=>{
  const f=fixture();await f.service.save(f.dto,f.actor,f.load);
  expect(f.db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO course_exam_eligibility_snapshots'),expect.any(Object));
  expect(f.db.query).toHaveBeenCalledWith(expect.stringContaining("eligibility_status='approved'"),expect.any(Object));
});

it('keeps incomplete components editable without publishing a roster',async()=>{
  const f=fixture();f.dto.rows[0].assignmentScore=null;
  await f.service.save(f.dto,f.actor,f.load);
  expect(f.write).toHaveBeenCalled();expect(f.db.query).not.toHaveBeenCalled();
});

it('publishes a complete special-status roster without editing profile-managed marks',async()=>{
  const f=fixture();f.row.profileForeignLanguageExempt=true;f.dto.rows=[];
  await f.service.save(f.dto,f.actor,f.load);
  expect(f.db.query).toHaveBeenCalledWith(expect.stringContaining("eligibility_status='approved'"),
    expect.objectContaining({replacements:expect.objectContaining({resultStatus:'draft'})}));
});

it('checks offering access inside the transaction and rejects before writing any marks',async()=>{
  const access={assertOffering:jest.fn().mockRejectedValue(new ForbiddenException())};
  const f=fixture(access);
  await expect(f.service.save(f.dto,f.actor,f.load)).rejects.toThrow(ForbiddenException);
  expect(access.assertOffering).toHaveBeenCalledWith(f.actor,'offering',expect.anything());
  expect(f.write).not.toHaveBeenCalled();expect(f.db.query).not.toHaveBeenCalled();
});

it.each(['not_available','draft'])('allows component edits after scheduling in %s',async status=>{
  const f=fixture();f.state.eligibility_status='approved';f.state.result_status=status;
  f.dto.rows[0].testScore=9;await f.service.save(f.dto,f.actor,f.load);
  expect(f.write.mock.calls[0][1]).toEqual([expect.objectContaining({testScore:9,eligibilityFrozen:false})]);
});

it.each(['submitted','approved'])('blocks edits once final results are %s',async status=>{
  const f=fixture();f.state.result_status=status;
  await expect(f.service.save(f.dto,f.actor,f.load)).rejects.toThrow(ConflictException);
  expect(f.write).not.toHaveBeenCalled();
});

it('requires a held exam for exam scores',async()=>{
  const f=fixture();f.state.eligibility_status='approved';f.state.result_status='draft';f.dto.rows[0].examScore=7;
  await expect(f.service.save(f.dto,f.actor,f.load)).rejects.toThrow(ConflictException);
  f.row.examScoreEditable=true;await f.service.save(f.dto,f.actor,f.load);
  expect(f.write.mock.calls[0][1][0]).toMatchObject({examScore:7,courseScore:7.5});
});

it.each(['submit','approve','reopen','request_reopen','reject_reopen'])('retires eligibility %s',async action=>{
  const f=fixture();await expect(f.service.transition({...f.dto,action},f.actor,'eligibility',f.load)).rejects.toThrow(BadRequestException);
  expect(f.db.transaction).not.toHaveBeenCalled();
});

it('keeps final submission, approval and reopening',async()=>{
  const f=fixture();f.state.eligibility_status='approved';f.state.result_status='draft';
  Object.assign(f.row,{eligible:true,examScore:8,courseScore:8,result:'passed'});
  await f.service.transition({...f.dto,action:'submit',version:0},f.actor,'final',f.load);
  f.state.result_status='submitted';f.state.result_snapshot={rows:[f.row]};
  await f.service.transition({...f.dto,action:'approve',version:0},f.actor,'final',f.load);
  f.state.result_status='approved';
  await expect(f.service.transition({...f.dto,action:'reopen',version:0},f.actor,'final',f.load)).rejects.toThrow(BadRequestException);
  await f.service.transition({...f.dto,action:'reopen',version:0,note:'Correction'},f.actor,'final',f.load);
  expect(f.service.event).toHaveBeenLastCalledWith('offering','final.reopen',f.actor,'Correction',expect.anything(),expect.anything(),expect.anything());
});
