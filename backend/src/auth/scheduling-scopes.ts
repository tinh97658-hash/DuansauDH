// Scope is automatic for each granted permission; this never grants another action.
export const SCHEDULING_SCOPES = {
  'scheduling.view': ['institution'], 'scheduling.write': ['institution'],
  'scheduling.organize': ['institution'], 'scheduling.assign': ['institution'],
} as const;
export const INSTITUTION_PERMISSIONS = new Set([
  ...Object.keys(SCHEDULING_SCOPES), 'gradebook.view', 'gradebook.submit',
  'gradebook.approve', 'gradebook.policy', 'studyleave.manage',
]);
export type SchedulingPermission = keyof typeof SCHEDULING_SCOPES;
export interface ScopedGrant { roleId: string; permission: SchedulingPermission; scope: string }
export function automaticInstitutionScopes(codes: string[]): Record<string, string> {
  return Object.fromEntries(codes.filter(code => INSTITUTION_PERMISSIONS.has(code)).map(code => [code, 'institution']));
}
