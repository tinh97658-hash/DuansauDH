import {examSessionsForPeriod,formatExamDate,validExamHours} from '../../features/exams/examCalendar';
import {addDays,formatDateKey,getBusinessTodayKey,mondayOf} from '../../utils/schedulingCalendar';
it('formats Vietnamese weeks independently of host timezone',()=>{
 expect(getBusinessTodayKey(new Date('2026-12-31T17:00:00Z'))).toBe('2027-01-01');const monday=formatDateKey(mondayOf('2027-01-01'));expect(formatExamDate(monday)).toBe('28/12/2026');expect(formatExamDate(formatDateKey(addDays(monday,6)))).toBe('03/01/2027');
});
const date='2026-10-21',session=(id,startTime,endTime)=>({id,startTime,endTime,examDate:date});
it('groups different exact times into the same period without merging their identities',()=>{
 const values=[session('later','11:00','12:00'),session('early','08:00','09:00'),session('pm','14:00','15:00')];
 expect(examSessionsForPeriod(values,date,'MORNING').map(s=>s.id)).toEqual(['early','later']);expect(examSessionsForPeriod(values,date,'AFTERNOON').map(s=>s.id)).toEqual(['pm']);expect(examSessionsForPeriod(values,'2026-10-22','MORNING')).toEqual([]);
});
it('displays a cross-13:00 session in both periods, with precise boundaries',()=>{
 const values=[session('end','12:00','13:00'),session('cross','12:30','13:30'),session('start','13:00','14:00')];
 expect(examSessionsForPeriod(values,date,'MORNING').map(s=>s.id)).toEqual(['end','cross']);expect(examSessionsForPeriod(values,date,'AFTERNOON').map(s=>s.id)).toEqual(['cross','start']);
});
it.each([['07:00','19:00',true],['12:30','13:30',true],['01:00','02:00',false],['06:59','08:00',false],['18:00','19:01',false],['09:00','08:00',false],['08:00','08:00',false],['08:60','10:00',false]])('validates %s–%s daytime=%s',(start,end,valid)=>expect(validExamHours(start,end)).toBe(valid));
