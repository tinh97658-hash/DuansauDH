import {validateExamArrangement} from '../../src/masters/exam-arrangement.js';
import {plainToInstance} from 'class-transformer';
import {validate} from 'class-validator';
import {SaveExamArrangementDto} from '../../src/masters/dto/exam-schedule.dto.js';

const group=(count:number,extra:any={})=>({roundNo:1,startTime:'08:00',endTime:'09:00',candidates:Array.from({length:count},(_,i)=>`a${i}`),aliases:[],rows:[],label:'Lớp A / Triết',...extra});
it('supports parallel different subjects and uses combined round capacity',()=>{
 expect(validateExamArrangement([group(15),group(9,{label:'Lớp B / Xác suất',endTime:'09:30'})],'MORNING')).toEqual({peak:24,start:'08:00',end:'09:30'});
});
it('supports sequential subjects for the same people without summing their seats',()=>{
 const aliases=['student:1'];
 expect(validateExamArrangement([group(15,{aliases}),group(18,{aliases,roundNo:2,startTime:'09:45',endTime:'11:15'})],'MORNING').peak).toBe(18);
});
it('supports parallel classes followed by another parallel round',()=>{
 expect(validateExamArrangement([group(15),group(9),group(18,{roundNo:2,startTime:'09:45',endTime:'11:15'}),group(12,{roundNo:2,startTime:'09:45',endTime:'10:15'})],'MORNING').peak).toBe(30);
});
it('identifies a shared learner in concurrent subjects including resolved aliases',()=>{
 expect(()=>validateExamArrangement([group(1,{aliases:['admission:a','student:s'],aliasNames:{'student:s':'Nguyễn An'},rows:[{participantId:'admission:a',fullName:'Nguyễn An'}]}),group(1,{aliases:['student:s'],label:'Lớp B / Xác suất'})],'MORNING')).toThrow('Nguyễn An');
});
it.each([
 [group(1),group(1,{roundNo:2,startTime:'07:30'})],
 [group(1),group(1,{startTime:'07:15',endTime:'09:30'})],
 [group(1,{endTime:'13:01'})],
 [group(1,{endTime:'07:00'})],
])('rejects intersecting rounds, inconsistent starts and invalid period bounds (%#)',(...groups)=>{
 expect(()=>validateExamArrangement(groups,'MORNING')).toThrow();
});
it('validates nested HTTP groups and prevents caller-supplied candidate lists',async()=>{
 const dto=plainToInstance(SaveExamArrangementDto,{examDate:'2099-01-01',period:'MORNING',roomId:'00000000-0000-4000-8000-000000000001',lecturerId:'00000000-0000-4000-8000-000000000002',groups:[{roundNo:0,startTime:'25:00',endTime:'08:00',candidateIds:['student:x']}]});
 const errors=await validate(dto);
 expect(errors.find(e=>e.property==='groups')?.children?.[0].children?.map(e=>e.property)).toEqual(expect.arrayContaining(['roundNo','startTime','candidateIds','snapshotId']));
});

it.each([['MORNING','08:00','12:00',true],['MORNING','07:59','09:00',false],['MORNING','11:00','12:01',false],['AFTERNOON','14:00','18:00',true],['AFTERNOON','13:59','15:00',false],['AFTERNOON','17:00','18:01',false]])('enforces %s bounds %s?%s', (period,startTime,endTime,valid)=>{const check=()=>validateExamArrangement([group(1,{startTime,endTime})],period as string);if(valid)expect(check).not.toThrow();else expect(check).toThrow();});
