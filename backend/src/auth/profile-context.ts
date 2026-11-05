import { AsyncLocalStorage } from 'node:async_hooks';

export interface WorkingProfileContext {
  staffId: string;
  roleId: string | null;
  selectionRequired: boolean;
  requestPath?: string;
  requestMethod?: string;
}

// Server-owned request context; never read a profile from a query/header/body.
export const workingProfileStorage=new AsyncLocalStorage<WorkingProfileContext>();
