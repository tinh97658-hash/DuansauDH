import { PERMISSION_ROUTES,routeActionCode,routeViewCode } from './route-permissions.js';
import { authorizationPath } from './request-path.js';

// These are server resource mappings. No URL supplied by the client chooses its
// authorization context. Shared lookup endpoints retain their existing guards.
export function permissionRoutesForRequest(path:string,method:string){
  path=authorizationPath(path);
  method=method.toUpperCase();
  const paths=(...paths:string[])=>PERMISSION_ROUTES.filter(route=>paths.includes(route.path));
  if(path.startsWith('/scheduling/')){
    if(path.includes('class-curriculum-progress'))return paths('/masters/class-course-history','/masters/course-matrix');
    if(path.includes('teaching-sessions')||path.endsWith('/completion'))return paths('/masters/schedule','/masters/course-matrix');
    if(path.endsWith('/assignee'))return paths('/masters/course-offerings','/system/accounts');
    return paths('/masters/course-offerings','/masters/schedule','/masters/course-matrix');
  }
  if(/^\/masters\/class-groups(?:\/|$)/.test(path)){
    if(path.includes('/members')||path.endsWith('/auto-assign'))return paths('/masters/assign-class-groups');
    if(method!=='GET')return paths('/masters/create-class-groups');
    return paths('/masters/create-class-groups','/masters/assign-class-groups');
  }
  if(/^\/masters\/exam-(sessions|arrangements)(?:\/|$)/.test(path))return paths('/masters/exam-schedule');
  if(/^\/masters\/grading-(policies|rules)/.test(path))return paths('/masters/create-class-groups','/masters/exam-lists');
  if(path.startsWith('/groups/'))return paths('/masters/create-class-groups');
  if(/^\/plan\/(subjects|classes|curriculums)(?:\/|$)/.test(path)){
    // GET lookups are shared by admission, groups and scheduling screens.
    return method==='GET'?[]:paths('/plan/training-plan');
  }
  if(/^\/plan\/admission-records\/[^/]+\/study-leaves/.test(path))return paths('/masters/study-leaves');
  if(/^\/plan\/admission-rounds(?:\/|$)/.test(path))return paths('/masters/admission-scores','/plan/admission-records');
  if(/^\/plan\/(admission-records|major-transfers|subject-recognitions|learning-results)(?:\/|$)/.test(path))
    return paths('/plan/admission-records','/masters/admitted-records','/masters/admission-scores','/masters/study-leaves');
  if(/^\/(?:plan\/)?study-leaves(?:\/|$)/.test(path))return paths('/masters/study-leaves');
  if(/^\/reports\/(learner-scorecard|transcript-issues)(?:\/|$)/.test(path))return paths('/reports/class-score-summary');
  if(path==='/accounts/me/permissions'||path==='/accounts/me/password'||path==='/roles/permissions')return [];
  if(path==='/data/tobereviewed'||path==='/data/submitreview')return paths('/reviewer');
  if(/^\/accounts\/(audit-logs|change-logs)/.test(path))return paths('/system/audit-logs');
  if(method==='GET'&&path.startsWith('/system/')&&PERMISSION_ROUTES.some(route=>route.path===path&&route.read.includes('catalog.view')))return [];
  if(path==='/accounts'||path.startsWith('/accounts/'))return paths('/system/accounts');
  if(path==='/roles'&&method==='GET')return paths('/system/roles','/system/accounts');
  if(path==='/roles'||path.startsWith('/roles/'))return paths('/system/roles');
  // Frontend and API paths coincide for the remaining business pages.
  return PERMISSION_ROUTES.filter(route=>path===route.path||path.startsWith(`${route.path}/`));
}

export function routePermissionAllowed(permissions:Set<string>,path:string,method:string,capabilities:string[]){
  const routes=permissionRoutesForRequest(path,method);
  // Shared reads keep their existing capability guards. Unmapped mutations
  // must never inherit a broad write grant from a different page.
  if(!routes.length)return ['GET','HEAD','OPTIONS'].includes(method.toUpperCase())
    || (authorizationPath(path)==='/accounts/me/password' && method.toUpperCase()==='PATCH');
  const actions=capabilities.filter(code=>!code.endsWith('.view')&&!code.startsWith('module.'));
  return routes.some(route=>permissions.has(routeViewCode(route.path))&&actions.every(action=>
    route.actions.includes(action)&&permissions.has(routeActionCode(route.path,action))));
}
