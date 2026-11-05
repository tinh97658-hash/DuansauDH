import { routePermissionAllowed } from '../../src/auth/route-authorization.js';
import { effectiveProfilePermissions } from '../../src/auth/permission-tree.js';
import { routeViewCode,routeActionCode } from '../../src/auth/route-permissions.js';

describe('Route-specific read and action permissions',()=>{
  const schedule='/masters/schedule',offerings='/masters/course-offerings';
  it('allows viewing the schedule but denies direct writes even with a leftover broad write grant',()=>{
    const grants=new Set(['scheduling.view','scheduling.write',routeViewCode(schedule)]);
    expect(routePermissionAllowed(grants,'/scheduling/teaching-sessions','GET',['scheduling.view'])).toBe(true);
    expect(routePermissionAllowed(grants,'/scheduling/teaching-sessions','POST',['scheduling.write'])).toBe(false);
    expect(routePermissionAllowed(grants,'/scheduling/course-offerings','POST',['scheduling.organize'])).toBe(false);
  });
  it('separates scheduling from organizing offerings and exam scheduling',()=>{
    const grants=new Set([routeViewCode(schedule),routeActionCode(schedule,'scheduling.write')]);
    expect(routePermissionAllowed(grants,'/scheduling/teaching-sessions','PUT',['scheduling.write'])).toBe(true);
    expect(routePermissionAllowed(grants,'/scheduling/course-offerings','POST',['scheduling.organize'])).toBe(false);
    expect(routePermissionAllowed(grants,'/masters/exam-sessions','POST',['exams.write'])).toBe(false);
    grants.add(routeViewCode(offerings));grants.add(routeActionCode(offerings,'scheduling.organize'));
    expect(routePermissionAllowed(grants,'/scheduling/course-offerings','POST',['scheduling.organize'])).toBe(true);
  });
  it('separates creating groups from assigning members, despite their shared legacy capability',()=>{
    const path='/masters/assign-class-groups';
    const grants=new Set([routeViewCode(path),routeActionCode(path,'masters.manage')]);
    expect(routePermissionAllowed(grants,'/masters/class-groups/id/members','POST',['masters.manage'])).toBe(true);
    expect(routePermissionAllowed(grants,'/masters/class-groups','POST',['masters.manage'])).toBe(false);
  });
  it('fails closed without the route read grant or its original module and read dependencies',()=>{
    const action=routeActionCode(schedule,'scheduling.write');
    const grants=new Set(['module.scheduling','scheduling.view','scheduling.write',action]);
    expect(effectiveProfilePermissions(grants).has(action)).toBe(false);
    grants.add(routeViewCode(schedule));expect(effectiveProfilePermissions(grants).has(action)).toBe(true);
    grants.delete('module.scheduling');expect(effectiveProfilePermissions(grants).has(action)).toBe(false);
  });
  it('does not allow editing a different catalog through a shared catalog.manage grant',()=>{
    const grants=new Set([routeViewCode('/system/cities'),routeActionCode('/system/cities','catalog.manage')]);
    expect(routePermissionAllowed(grants,'/system/cities/id','PUT',['catalog.manage'])).toBe(true);
    expect(routePermissionAllowed(grants,'/system/majors/id','PUT',['catalog.manage'])).toBe(false);
  });
});
