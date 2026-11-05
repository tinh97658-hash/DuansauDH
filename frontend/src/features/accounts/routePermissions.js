export const routeViewCode=path=>`route.${path.replace(/^\//,'').replaceAll('/','.')}.view`;
export const routeActionCode=(path,action)=>`route.${path.replace(/^\//,'').replaceAll('/','.')}.${action.replaceAll('.','-')}`;
export function permissionRoute(catalog,path=''){
  if(path.startsWith('/reports/learner-transcript/'))path='/reports/class-score-summary';
  return (catalog||[]).filter(route=>path===route.path||path.startsWith(`${route.path}/`)).sort((a,b)=>b.path.length-a.path.length)[0];
}
