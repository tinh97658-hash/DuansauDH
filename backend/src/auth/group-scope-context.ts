import { AsyncLocalStorage } from 'node:async_hooks';
import type { Transaction } from 'sequelize';

export interface GroupScopeContext {
  // Internal only; never populated from request input or returned to clients.
  readTransaction?: Transaction;
  staffId: string;
  restrictView: boolean;
  restrictEdit: boolean;
  readOnly: boolean;
  admissionAction?: 'view' | 'manage';
  schedulingView?: boolean;
  schedulingAction?: 'view' | 'write' | 'organize';
  schedulingGrants?: import('./scheduling-scopes.js').ScopedGrant[];
  academicDomain?: 'gradebook' | 'exam' | 'studyleave' | 'policy';
  academicPermission?: string;
}

export const groupScopeStorage = new AsyncLocalStorage<GroupScopeContext>();
