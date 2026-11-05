import { lastValueFrom, NEVER, of, throwError } from 'rxjs';
import { GroupScopeInterceptor } from '../../src/auth/group-scope.interceptor.js';
import { Staff } from '../../src/database/models/staff.model.js';

function setup(method = 'GET') {
  const state: any = {};
  const transactions: string[] = [];
  const scope: any = {
    current: () => state, configure: jest.fn(), assertWriteReferences: jest.fn(async () => {}),
    run: (_staff: any, _access: any, work: any) => Promise.resolve().then(work),
    withReadTransaction: jest.fn(async (work: any) => {
      transactions.push('begin');
      try { const value = await work(); transactions.push('commit'); return value; }
      catch (error) { transactions.push('rollback'); throw error; }
    }),
  };
  const rbac: any = { effectiveAccess: async () => ({ groupScope: { readOnly: false } }) };
  const user = Object.assign(Object.create(Staff.prototype), { id: 'staff' });
  const context: any = { switchToHttp: () => ({ getRequest: () => ({ method, user,
    originalUrl: '/scheduling/teaching-sessions', body: {} }) }) };
  return { scope, transactions, context, interceptor: new GroupScopeInterceptor(rbac, scope) };
}

it('completes an academic read only after its protected transaction commits', async () => {
  const { interceptor, context, transactions } = setup();
  const stream = await interceptor.intercept(context, { handle: () => of({ rows: [1] }) });
  expect(await lastValueFrom(stream)).toEqual({ rows: [1] });
  expect(transactions).toEqual(['begin', 'commit']);
});

it('rolls back read errors and disconnected subscriptions', async () => {
  const failed = setup();
  const stream = await failed.interceptor.intercept(failed.context, { handle: () => throwError(() => new Error('failed read')) });
  await expect(lastValueFrom(stream)).rejects.toThrow('failed read');
  expect(failed.transactions).toEqual(['begin', 'rollback']);
  const cancelled = setup();
  const pending = await cancelled.interceptor.intercept(cancelled.context, { handle: () => NEVER });
  const subscription = pending.subscribe();
  await new Promise(resolve => setImmediate(resolve));
  subscription.unsubscribe();
  await new Promise(resolve => setImmediate(resolve));
  expect(cancelled.transactions).toEqual(['begin', 'rollback']);
});

it('leaves write transactions under the existing service locks', async () => {
  const { interceptor, context, scope } = setup('POST');
  const stream = await interceptor.intercept(context, { handle: () => of({ saved: true }) });
  expect(await lastValueFrom(stream)).toEqual({ saved: true });
  expect(scope.withReadTransaction).not.toHaveBeenCalled();
});

it.each([['request_reopen','gradebook.submit'],['reject_reopen','gradebook.approve'],['reopen','gradebook.approve']])('uses the matching academic scope for %s', async (action,permission) => {
  const { interceptor, context, scope } = setup('POST');
  const request = context.switchToHttp().getRequest();
  context.switchToHttp = () => ({getRequest:()=>({...request,originalUrl:'/masters/exam-lists/eligibility/workflow',body:{action}})});
  const stream = await interceptor.intercept(context,{handle:()=>of({saved:true})});
  await lastValueFrom(stream);
  expect(scope.current()).toMatchObject({academicDomain:'gradebook',academicPermission:permission});
});

it.each([['GET','exams.view'],['POST','exams.write']])('uses the independent exam permission for %s',async(method,permission)=>{
  const {interceptor,context,scope}=setup(method);
  const request=context.switchToHttp().getRequest();
  context.switchToHttp=()=>({getRequest:()=>({...request,originalUrl:'/masters/exam-schedule'})});
  const stream=await interceptor.intercept(context,{handle:()=>of({ok:true})});
  await lastValueFrom(stream);
  expect(scope.current()).toMatchObject({academicDomain:'exam',academicPermission:permission});
});

it.each([
  ['GET', '/plan/admission-rounds/round/ranking', 'view'],
  ['PUT', '/plan/admission-rounds/round/scores', 'manage'],
  ['POST', '/plan/admission-rounds/round/confirm', 'manage'],
  ['GET', '/plan/admission-records/record', 'view'],
  ['POST', '/plan/admission-records', 'manage'],
  ['PUT', '/plan/admission-records/record/evaluation', 'manage'],
  ['GET', '/plan/admission-records/record/learning-results', undefined],
  ['GET', '/plan/admission-records/record/study-leaves', undefined],
  ['POST', '/plan/admission-records/record/major-transfers', undefined],
  ['PUT', '/plan/admission-records/record/tuition', undefined],
  ['GET', '/reports/class-score-summary', undefined],
])('selects the pre-class admission scope for %s %s', async (method, path, action) => {
  const { interceptor, context, scope } = setup(method);
  const request = context.switchToHttp().getRequest();
  context.switchToHttp = () => ({ getRequest: () => ({ ...request, originalUrl: path }) });
  await lastValueFrom(await interceptor.intercept(context, { handle: () => of({}) }));
  expect(scope.current().admissionAction).toBe(action);
});

it.each(['learners', 'study-management'])('keeps %s lists under learner scope', async admissionStage => {
  const { interceptor, context, scope } = setup();
  const request = context.switchToHttp().getRequest();
  context.switchToHttp = () => ({ getRequest: () => ({ ...request,
    originalUrl: '/plan/admission-records?admissionStage=' + admissionStage, query: { admissionStage } }) });
  await lastValueFrom(await interceptor.intercept(context, { handle: () => of({}) }));
  expect(scope.current().admissionAction).toBeUndefined();
});
