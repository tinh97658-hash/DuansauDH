import { of } from 'rxjs';
import { StudyLeaveInterceptor } from '../../src/plan/study-leave.interceptor.js';
it.each(['/learner-codes/issue','/learner-codes/preview?recordIds=abc','/LEARNER-CODES/ISSUE/'])('đồng bộ bảo lưu trước %s',async url=>{
  const leaves={synchronize:jest.fn().mockResolvedValue(undefined)},handle=jest.fn(()=>of('ok'));
  const interceptor=new StudyLeaveInterceptor(leaves as any,{current:()=>({readOnly:false})} as any);
  await interceptor.intercept({getType:()=> 'http',switchToHttp:()=>({getRequest:()=>({url})})} as any,{handle});
  expect(leaves.synchronize).toHaveBeenCalledTimes(1);
  expect(leaves.synchronize.mock.invocationCallOrder[0]).toBeLessThan(handle.mock.invocationCallOrder[0]);
});
it('không ghi đồng bộ khi hồ sơ Chỉ xem',async()=>{
  const leaves={synchronize:jest.fn()};
  await new StudyLeaveInterceptor(leaves as any,{current:()=>({readOnly:true})} as any).intercept(
    {getType:()=> 'http',switchToHttp:()=>({getRequest:()=>({url:'/learner-codes/preview'})})} as any,{handle:()=>of('ok')});
  expect(leaves.synchronize).not.toHaveBeenCalled();
});
