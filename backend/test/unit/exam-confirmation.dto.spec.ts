import {validate} from 'class-validator';
import {plainToInstance} from 'class-transformer';
import {ConfirmExamDto,ExamSessionActionDto} from '../../src/masters/dto/exam-schedule.dto.js';

describe('Exam confirmation HTTP DTO contract',()=>{
 it.each([undefined,''])('accepts Held with note %s',async(note)=>{
  expect(await validate(plainToInstance(ConfirmExamDto,{version:0,status:'held',...(note===undefined?{}:{note})}))).toEqual([]);
 });
 it('still requires the cancel note and validates provided confirmation notes',async()=>{
  expect((await validate(plainToInstance(ExamSessionActionDto,{version:0}))).some(e=>e.property==='note')).toBe(true);
  expect((await validate(plainToInstance(ConfirmExamDto,{version:0,status:'held',note:23}))).some(e=>e.property==='note')).toBe(true);
 });
 it('rejects unsupported states and stale-shaped versions',async()=>{
  const errors=await validate(plainToInstance(ConfirmExamDto,{version:-1,status:'cancelled'}));
  expect(errors.map(e=>e.property)).toEqual(expect.arrayContaining(['version','status']));
 });
});
