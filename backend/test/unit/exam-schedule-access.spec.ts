import { ForbiddenException } from '@nestjs/common';
import { Staff } from '../../src/database/models/staff.model.js';
import { ExamScheduleService } from '../../src/masters/exam-schedule.service.js';

function fixture(permissions=['exams.view','exams.write'],readOnly=false){
  const actor=Object.defineProperty(Object.create(Staff.prototype),'id',{value:'staff'});
  const db:any={transaction:jest.fn(async cb=>cb({})),query:jest.fn()};
  const scope={groupIds:new Set(['owned']),readOnly};
  const access:any={forActor:jest.fn().mockResolvedValue(scope),offeringIds:jest.fn().mockResolvedValue(new Set(['shared'])),
    assertOffering:jest.fn().mockResolvedValue(scope)};
  const sessions=[{id:'one',courseOfferingId:'shared',arrangementId:'mixed',canEdit:true,candidateIds:[]},
    {id:'two',courseOfferingId:'hidden',arrangementId:'mixed',canEdit:true,candidateIds:[]}];
  const query=jest.fn(async(sql:string)=>sql.includes('BETWEEN 0 AND 62')?[{ok:true}]
    :sql.includes('FROM course_exam_workflows w')?[{id:'shared',remainingCount:2,candidateIds:[]},{id:'hidden',remainingCount:1,candidateIds:[]}]
    :sql.includes('FROM course_exam_sessions es JOIN course_exam_arrangements')?sessions:[]);
  const workflow:any={query,lock:jest.fn().mockResolvedValue({state:{}})};
  const rbac:any={effectiveAccess:jest.fn().mockResolvedValue({permissions:new Set(permissions),roleCodes:['custom'],groupScope:{readOnly}})};
  return {actor,db,access,workflow,rbac,service:new ExamScheduleService(db,workflow,rbac,access)};
}

it.each([['scheduling.view','scheduling.write'],['gradebook.view','gradebook.submit']])('requires explicit exam permissions instead of %s',async(...permissions)=>{
  const f=fixture(permissions);
  await expect(f.service.list({from:'2099-01-01',to:'2099-01-02'},f.actor)).rejects.toThrow(ForbiddenException);
  await expect(f.service.schedule({} as any,f.actor)).rejects.toThrow(ForbiddenException);
  expect(f.db.transaction).not.toHaveBeenCalled();
});

it('filters queue, offerings and sessions, and disables editing a partly hidden arrangement',async()=>{
  const f=fixture();const result=await f.service.list({from:'2099-01-01',to:'2099-01-02'},f.actor);
  expect(result.queue.map(row=>row.id)).toEqual(['shared']);
  expect(result.approvedOfferings.map(row=>row.id)).toEqual(['shared']);
  expect(result.sessions).toEqual([expect.objectContaining({id:'one',canEdit:false})]);
});

it('admin can retain all sessions and offerings',async()=>{
  const f=fixture();f.access.offeringIds.mockResolvedValue(null);
  const result=await f.service.list({from:'2099-01-01',to:'2099-01-02'},f.actor);
  expect(result.queue).toHaveLength(2);expect(result.sessions).toHaveLength(2);
});

it('checks ownership in the transaction before locking or changing an offering',async()=>{
  const f=fixture();f.access.assertOffering.mockRejectedValue(new ForbiddenException());
  await expect(f.service.saveArrangement(null,{lecturerId:'lecturer',groups:[{courseOfferingId:'hidden'}]} as any,f.actor)).rejects.toThrow(ForbiddenException);
  expect(f.workflow.lock).not.toHaveBeenCalled();expect(f.db.query).not.toHaveBeenCalled();
});

it('rejects edits to a shared exam arrangement when any existing offering is outside scope',async()=>{
  const f=fixture();f.access.assertOffering.mockImplementation(async(_actor:any,offering:string)=>{
    if(offering==='hidden')throw new ForbiddenException();return {};
  });
  f.workflow.query.mockImplementation(async(sql:string)=>sql.includes('FROM course_exam_arrangements')?[{id:'mixed',version:1}]
    :sql.includes('SELECT DISTINCT course_offering_id')?[{course_offering_id:'shared'},{course_offering_id:'hidden'}]:[]);
  await expect(f.service.saveArrangement('mixed',{lecturerId:'lecturer',version:1,groups:[{courseOfferingId:'shared'}]} as any,f.actor)).rejects.toThrow(ForbiddenException);
  expect(f.db.query).not.toHaveBeenCalled();
  expect(f.access.assertOffering).toHaveBeenCalledWith(f.actor,'hidden',expect.anything());
});

it('readonly wins over exam write permission',async()=>{
  const f=fixture(['exams.view','exams.write'],true);
  await expect(f.service.schedule({} as any,f.actor)).rejects.toThrow(ForbiddenException);
  expect(f.db.transaction).not.toHaveBeenCalled();
});
