import {ExamScheduleService} from '../../src/masters/exam-schedule.service.js';

it.each([['MORNING','08:01'],['AFTERNOON','14:01']])('enforces the %s cutoff using the database clock',async(period,cutoff)=>{
 const query=jest.fn().mockResolvedValue([{ok:true}]);
 const service=new ExamScheduleService({} as any,{query} as any,{} as any);
 const tx={} as any;
 await expect((service as any).periodOpen('2099-01-01',period,tx)).resolves.toBeUndefined();
 expect(query).toHaveBeenCalledWith(expect.stringContaining("AT TIME ZONE 'Asia/Ho_Chi_Minh' > clock_timestamp()"),{date:'2099-01-01',cutoff},tx);
 query.mockResolvedValue([{ok:false}]);
 await expect((service as any).periodOpen('2099-01-01',period,tx)).rejects.toMatchObject({response:{code:'EXAM_PERIOD_CLOSED'}});
});
