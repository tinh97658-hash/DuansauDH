import { AsyncLocalStorage } from 'node:async_hooks';

export interface GroupScopeContext {
  staffId: string;
  restrictView: boolean;
  restrictEdit: boolean;
  readOnly: boolean;
}

export const groupScopeStorage = new AsyncLocalStorage<GroupScopeContext>();
