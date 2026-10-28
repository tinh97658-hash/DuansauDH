import { AsyncLocalStorage } from 'node:async_hooks';

export interface GroupScopeContext {
  staffId: string;
  restrictView: boolean;
  restrictEdit: boolean;
  readOnly: boolean;
  schedulingView?: boolean;
  schedulingAction?: 'view' | 'write' | 'organize';
  schedulingGrants?: import('./scheduling-scopes.js').ScopedGrant[];
  academicDomain?: 'gradebook' | 'exam' | 'studyleave' | 'policy';
  academicPermission?: string;
}

export const groupScopeStorage = new AsyncLocalStorage<GroupScopeContext>();
