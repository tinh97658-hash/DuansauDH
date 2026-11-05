import { ROUTE_PERMISSION_ENTRIES,routeViewCode } from './route-permissions.js';
export const permissionModules:Record<string,{id:string;name:string}>={
  account:{id:'administration',name:'Tài khoản & phân quyền'},role:{id:'administration',name:'Tài khoản & phân quyền'},audit:{id:'administration',name:'Tài khoản & phân quyền'},
  catalog:{id:'catalog',name:'Danh mục dùng chung'},plan:{id:'plan',name:'Kế hoạch & chương trình đào tạo'},admission:{id:'admission',name:'Tuyển sinh'},
  groups:{id:'groups',name:'Nhóm học viên'},masters:{id:'masters',name:'Đào tạo Thạc sĩ'},doctoral:{id:'doctoral',name:'Đào tạo Tiến sĩ'},
  scheduling:{id:'scheduling',name:'Lớp học phần & lịch học'},gradebook:{id:'assessment',name:'Thi & điểm'},exams:{id:'assessment',name:'Thi & điểm'},
  studyleave:{id:'learner-status',name:'Bảo lưu & chuyển chuyên ngành'},majortransfer:{id:'learner-status',name:'Bảo lưu & chuyển chuyên ngành'},
  reports:{id:'reports',name:'Báo cáo & thống kê'},supervision:{id:'supervision',name:'Hướng dẫn & phản biện'},
};
export const permissionReadDependencies:Record<string,string[]>={
  'account.manage':['account.view'],'account.password.reset':['account.view'],'role.manage':['role.view'],
  'catalog.manage':['catalog.view'],'plan.manage':['plan.view'],'admission.manage':['admission.view'],
  'groups.assign':['masters.view'],'masters.manage':['masters.view'],'doctoral.manage':['doctoral.view'],
  'scheduling.organize':['scheduling.view'],'scheduling.write':['scheduling.view'],'scheduling.assign':['scheduling.view'],
  'gradebook.submit':['gradebook.view'],'gradebook.approve':['gradebook.view'],'gradebook.policy':['masters.view'],
  'exams.write':['exams.view'],'studyleave.request':['plan.view'],'studyleave.approve':['plan.view'],
  'majortransfer.request':['admission.view'],'majortransfer.approve':['admission.view'],
  'reports.export':['reports.view'],'reports.payments.manage':['reports.view'],'supervision.review':['masters.view'],
};
export function permissionTreeMeta(code:string){
  const entry=ROUTE_PERMISSION_ENTRIES.find(entry=>entry.code===code);
  if(entry){
    const base=permissionModules[(entry.capability||entry.route.read[0]).split('.')[0]];
    return {moduleId:base.id,moduleName:base.name,kind:entry.capability?'write':'read',
      requires:entry.capability?[routeViewCode(entry.route.path),entry.capability]:entry.route.read,
      navigation:{section:entry.route.section,group:entry.route.group,path:entry.route.path,name:entry.route.name}};
  }
  const prefix=code.split('.')[0];
  if(prefix==='module')return {moduleId:code.slice(7),moduleName:'',kind:'module',requires:[]};
  const module=permissionModules[prefix]||{id:'other',name:'Quyền khác'};
  return {moduleId:module.id,moduleName:module.name,kind:code.endsWith('.view')?'read':'write',requires:permissionReadDependencies[code]||[]};
}
export function effectiveProfilePermissions(permissions:Set<string>){
  let result=new Set(permissions),previous=-1;
  while(previous!==result.size){previous=result.size;result=new Set([...result].filter(code=>code.startsWith('module.')||(
    result.has(`module.${permissionTreeMeta(code).moduleId}`)&&permissionTreeMeta(code).requires.every(read=>result.has(read)))));}
  return result;
}
