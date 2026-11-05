import { ForbiddenException } from '@nestjs/common';
import { Staff } from '../../src/database/models/staff.model.js';
import { RbacService } from '../../src/auth/rbac.service.js';
import { workingProfileStorage } from '../../src/auth/profile-context.js';
import { WorkingProfileGuard,WorkingProfileMiddleware } from '../../src/auth/working-profile.js';
import { effectiveProfilePermissions } from '../../src/auth/permission-tree.js';

const staff=Object.defineProperty(Object.create(Staff.prototype),'id',{value:'staff'});
const profile=(id:string,codes:string[],readonly=false)=>({id,code:id,name:id,active:true,groupReadOnly:readonly,permissions:codes.map(code=>({code}))});
function fixture(){
  const staffRoles={findAll:jest.fn().mockResolvedValue([
    {role:profile('viewer',['module.assessment','gradebook.view'],true)},
    {role:profile('writer',['module.assessment','gradebook.view','gradebook.submit'])},
  ])};
  const roles={findOne:jest.fn()};return {staffRoles,roles,rbac:new RbacService(roles as any,staffRoles as any)};
}
it('shares fresh permission lookups within one HTTP read without caching across requests or profiles', async () => {
  const {rbac,staffRoles}=fixture();
  const context={staffId:'staff',roleId:'writer',selectionRequired:false,requestMethod:'GET'};
  await workingProfileStorage.run(context, async()=>{
    await Promise.all([rbac.effectiveAccess(staff,true),rbac.effectiveAccess(staff,true)]);
    expect(staffRoles.findAll).toHaveBeenCalledTimes(1);
    context.roleId='viewer';
    expect((await rbac.effectiveAccess(staff,true)).groupScope?.readOnly).toBe(true);
    expect(staffRoles.findAll).toHaveBeenCalledTimes(2);
    rbac.invalidate('staff');await rbac.effectiveAccess(staff,true);
    expect(staffRoles.findAll).toHaveBeenCalledTimes(3);
  });
  await workingProfileStorage.run({...context},()=>rbac.effectiveAccess(staff,true));
  expect(staffRoles.findAll).toHaveBeenCalledTimes(4);
});
it('loads profile choices without their permission graph while keeping the access lookup complete', async()=>{
  const {rbac,staffRoles}=fixture();
  const profiles=await rbac.profiles(staff);
  expect(profiles.map(profile=>profile.id)).toEqual(['viewer','writer']);
  expect(profiles[0].readOnly).toBe(true);
  expect(staffRoles.findAll).toHaveBeenLastCalledWith(expect.objectContaining({include:[expect.objectContaining({include:[]})]}));
  await workingProfileStorage.run({staffId:'staff',roleId:'writer',selectionRequired:false},()=>rbac.effectiveAccess(staff,true));
  expect(staffRoles.findAll.mock.calls.at(-1)![0].include[0].include.map((item:any)=>item.as)).toEqual(['permissions','permissionScopes']);
});
it('refreshes permissions on every write lookup even inside the same request', async()=>{
  const {rbac,staffRoles}=fixture();
  await workingProfileStorage.run({staffId:'staff',roleId:'writer',selectionRequired:false,requestMethod:'POST'},async()=>{
    expect((await rbac.effectiveAccess(staff,true)).permissions.has('gradebook.submit')).toBe(true);
    staffRoles.findAll.mockResolvedValue([]);
    expect((await rbac.effectiveAccess(staff,true)).permissions.size).toBe(0);
    expect(staffRoles.findAll).toHaveBeenCalledTimes(2);
  });
});
it('uses only the selected profile and never unions writer permissions or readonly flags from another profile',async()=>{
  const {rbac}=fixture();
  const read=await workingProfileStorage.run({staffId:'staff',roleId:'viewer',selectionRequired:false},()=>rbac.effectiveAccess(staff));
  expect(read.permissions.has('gradebook.submit')).toBe(false);expect(read.groupScope?.readOnly).toBe(true);
  const write=await workingProfileStorage.run({staffId:'staff',roleId:'writer',selectionRequired:false},()=>rbac.effectiveAccess(staff));
  expect(write.permissions.has('gradebook.submit')).toBe(true);expect(write.groupScope?.readOnly).toBe(false);
});
it('fails closed for absent, forged and revoked profiles without using a cached privileged context',async()=>{
  const {rbac,staffRoles}=fixture();
  for(const roleId of [null,'forged']){
    const result=await workingProfileStorage.run({staffId:'staff',roleId,selectionRequired:!roleId},()=>rbac.effectiveAccess(staff));
    expect(result.permissions.size).toBe(0);
  }
  await workingProfileStorage.run({staffId:'staff',roleId:'writer',selectionRequired:false},()=>rbac.effectiveAccess(staff));
  staffRoles.findAll.mockResolvedValue([{role:profile('viewer',['module.assessment','gradebook.view'])}]);
  const result=await workingProfileStorage.run({staffId:'staff',roleId:'writer',selectionRequired:false},()=>rbac.effectiveAccess(staff));
  expect(result.permissions.size).toBe(0);
});
it('requires module and shared read gates, including the shared read module',()=>{
  const permissions=new Set(['module.learner-status','studyleave.request','plan.view']);
  expect(effectiveProfilePermissions(permissions).has('studyleave.request')).toBe(false);
  permissions.add('module.plan');expect(effectiveProfilePermissions(permissions).has('studyleave.request')).toBe(true);
});
it('requires a choice for multiple profiles and refuses to silently replace a revoked selected profile',async()=>{
  const rbac:any={profiles:jest.fn().mockResolvedValue([{id:'one'},{id:'two'}])};
  const middleware=new WorkingProfileMiddleware(rbac);
  const req:any={user:staff,session:{}};
  await middleware.use(req,{},()=>expect(workingProfileStorage.getStore()?.selectionRequired).toBe(true));
  expect(req.activeProfile).toBeNull();
  rbac.profiles.mockResolvedValue([{id:'one'}]);req.session.activeProfileId='revoked';
  await middleware.use(req,{},()=>expect(req.profileSelectionRequired).toBe(true));
  req.session.activeProfileId='one';
  await middleware.use(req,{},()=>expect(workingProfileStorage.getStore()?.roleId).toBe('one'));
});
it('blocks business APIs without a profile and stale-tab profile IDs while allowing the picker',()=>{
  const guard=new WorkingProfileGuard();let path='/masters/exam-lists';
  const context:any={switchToHttp:()=>({getRequest:()=>({user:staff,originalUrl:path,get:()=> 'old'})})};
  expect(()=>guard.canActivate(context)).toThrow(ForbiddenException);
  path='/auth/profiles/select';expect(guard.canActivate(context)).toBe(true);
  path='/masters/exam-lists';
  workingProfileStorage.run({staffId:'staff',roleId:'new',selectionRequired:false},()=>expect(()=>guard.canActivate(context)).toThrow(ForbiddenException));
});
