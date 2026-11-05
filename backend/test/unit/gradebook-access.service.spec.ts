import { ForbiddenException } from '@nestjs/common';
import { Staff } from '../../src/database/models/staff.model.js';
import { GradebookAccessService } from '../../src/masters/gradebook-access.service.js';
import { ExamGradebookService } from '../../src/masters/exam-gradebook.service.js';

function fixture(roleCodes=['examiner'],readOnly=false) {
  const actor=Object.defineProperties(Object.create(Staff.prototype),{id:{value:'staff'},role:{value:'admin'}});
  const db:any={query:jest.fn(async(sql:string)=>sql.includes('responsible_staff_id')?[{id:'owned'}]
    :sql.includes('AS "classGroupId"')?[{classGroupId:'owned'}]:[{id:'merged'},{id:'single'}])};
  const rbac:any={effectiveAccess:jest.fn().mockResolvedValue({roleCodes,groupScope:{readOnly}})};
  const access=new GradebookAccessService(db,rbac);
  const service=new ExamGradebookService({} as any,{} as any,{} as any,{} as any,{} as any,db,
    undefined,rbac,undefined,access);
  return {actor,db,rbac,access,service};
}

it('uses effective roles and current responsibility instead of the actor role string',async()=>{
  const f=fixture();const access=await f.access.forActor(f.actor);
  expect(access.groupIds).toEqual(new Set(['owned']));
  expect(f.access.canEdit(access)).toBe(true);
});

it('keeps admin access and enforces readonly even for admins',async()=>{
  const f=fixture(['admin']);expect((await f.access.forActor(f.actor)).groupIds).toBeNull();
  const readonly=fixture(['admin'],true);
  expect(readonly.access.canEdit(await readonly.access.forActor(readonly.actor))).toBe(false);
});

it('does not trust a plain object impersonating staff',async()=>{
  const f=fixture();await expect(f.access.forActor({id:'staff',role:'admin'})).rejects.toThrow(ForbiddenException);
});

it('denies unrelated offerings and accounts without assignments',async()=>{
  const f=fixture();f.db.query.mockResolvedValue([]);
  await expect(f.access.assertOffering(f.actor,'unrelated')).rejects.toThrow(ForbiddenException);
  expect(await f.access.offeringIds(await f.access.forActor(f.actor))).toEqual(new Set());
});

it('makes every row of a merged offering editable for a responsible member',async()=>{
  const f=fixture();jest.spyOn(f.service,'get').mockResolvedValue({rows:[
    {participantId:'one',classGroupId:'owned'},{participantId:'two',classGroupId:'other'}]} as any);
  expect((await f.service.getForActor({classGroupId:'other',courseOfferingId:'merged'},f.actor)).rows)
    .toEqual([expect.objectContaining({participantId:'one',canEditGrade:true}),
      expect.objectContaining({participantId:'two',canEditGrade:true})]);
});

it('filters options and subjects without hiding partner groups of a visible merged offering',async()=>{
  const f=fixture();jest.spyOn(f.service,'options').mockResolvedValue({groups:[{id:'owned'},{id:'partner'},{id:'hidden'}],
    courseOfferings:[{id:'merged',groupLinks:[{classGroupId:'owned'},{classGroupId:'partner'}]},
      {id:'hidden',groupLinks:[{classGroupId:'hidden'}]}]} as any);
  const result=await f.service.optionsForActor(f.actor);
  expect(result.groups.map(group=>group.id)).toEqual(['owned','partner']);
  expect(result.courseOfferings.map(offering=>offering.id)).toEqual(['merged']);
  jest.spyOn(f.service,'subjects').mockResolvedValue([{id:'merged'},{id:'hidden'}] as any);
  expect((await f.service.subjectsForActor('partner',f.actor)).map(offering=>offering.id)).toEqual(['merged']);
});

it('blocks direct reads, history and saves before loading unrelated data',async()=>{
  const f=fixture();f.db.query.mockResolvedValue([]);
  const get=jest.spyOn(f.service,'get');const history=jest.spyOn(f.service,'history');
  const query={classGroupId:'other',courseOfferingId:'unrelated'};
  await expect(f.service.getForActor(query,f.actor)).rejects.toThrow(ForbiddenException);
  await expect(f.service.historyForActor(query,f.actor)).rejects.toThrow(ForbiddenException);
  await expect(f.service.save({...query,revision:0,rows:[]},f.actor)).rejects.toThrow(ForbiddenException);
  expect(get).not.toHaveBeenCalled();expect(history).not.toHaveBeenCalled();
});
