import 'reflect-metadata';
import {plainToInstance} from 'class-transformer';
import {validate} from 'class-validator';
import {CreateSubjectDto,UpdateSubjectDto} from '../../src/plan/dto/plan.dto.js';
import {SUBJECT_KNOWLEDGE_GROUPS} from '../../src/plan/subject-knowledge-groups.js';

it.each(['KC','CS','CN','TT','TN'])('accepts knowledge group %s for create and update',async subjectType=>{
 const create=plainToInstance(CreateSubjectDto,{codeNumber:501,codeText:'HP01',name:'Học phần',majorId:'00000000-0000-4000-8000-000000000001',subjectType});
 expect(await validate(create)).toEqual([]);
 expect(await validate(plainToInstance(UpdateSubjectDto,{subjectType}))).toEqual([]);
});
it.each(['TC','CH','UNKNOWN'])('rejects obsolete or unknown group %s',async subjectType=>{
 expect((await validate(plainToInstance(UpdateSubjectDto,{subjectType}))).some(e=>e.property==='subjectType')).toBe(true);
});
it('uses the five requested knowledge group labels',()=>{
 expect(SUBJECT_KNOWLEDGE_GROUPS.map(g=>g.name)).toEqual(['Kiến thức chung','Kiến thức ngành','Kiến thức chuyên ngành','Thực tập','Tốt nghiệp']);
});
