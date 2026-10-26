import {isExamPeriodClosed,nextExamSlot} from '../../features/exams/examPeriodAvailability';

it.each([
 ['MORNING','08:00:59',false],['MORNING','08:01:00',true],['MORNING','10:00:00',true],
 ['AFTERNOON','14:00:59',false],['AFTERNOON','14:01:00',true],['AFTERNOON','18:00:00',true],
])('closes %s at the correct minute (%s)',(period,time,closed)=>{
 expect(isExamPeriodClosed('2026-10-23',period,`2026-10-23 ${time}`)).toBe(closed);
});
it('keeps tomorrow open and past days closed',()=>{
 expect(isExamPeriodClosed('2026-10-24','MORNING','2026-10-23 23:59:59')).toBe(false);
 expect(isExamPeriodClosed('2026-10-22','AFTERNOON','2026-10-23 00:00:00')).toBe(true);
});
it.each([
 ['2026-10-23 07:59:59','2026-10-23','08:00'],
 ['2026-10-23 08:01:00','2026-10-23','14:00'],
 ['2026-10-23 14:01:00','2026-10-24','08:00'],
 ['2026-12-31 20:00:00','2027-01-01','08:00'],
])('chooses the next available period at %s',(now,examDate,startTime)=>{
 expect(nextExamSlot(now)).toMatchObject({examDate,startTime});
});
