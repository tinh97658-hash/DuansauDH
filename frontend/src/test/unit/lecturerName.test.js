import {formatLecturerName} from '../../utils/lecturerName';
import {examInvigilatorName} from '../../features/exams/examInvigilators';

it.each([
 ['Phó giáo sư',null,'PGS.'],['Giáo sư',null,'GS.'],[null,'Tiến sĩ','TS.'],[null,'Thạc sĩ','ThS.'],
 ['Phó Giáo sư','Tiến sĩ','PGS. TS.'],['Giáo sư','TS','GS. TS.'],['PGS','ThS','PGS. ThS.'],
 ['  phó giáo sư ',' tiến sĩ ','PGS. TS.'],['PGS.','TS.','PGS. TS.'],
])('formats rank %s and degree %s before the name',(academicRank,academicDegree,prefix)=>{
 expect(formatLecturerName({name:'Nguyễn Văn An',academicRank,academicDegree})).toBe(`${prefix} Nguyễn Văn An`);
});
it('keeps missing names blank and leaves unqualified names alone',()=>{
 expect(formatLecturerName(null)).toBe('');
 expect(formatLecturerName({academicRank:'Giáo sư'})).toBe('');
 expect(formatLecturerName({name:'Nguyễn An'})).toBe('Nguyễn An');
});
it('does not repeat legacy prefixes or modify the saved person',()=>{
 const lecturer={name:'PGS.TS. Nguyễn An',academicRank:'Phó Giáo sư',academicDegree:'Tiến sĩ'};
 expect(formatLecturerName(lecturer)).toBe('PGS. TS. Nguyễn An');
 expect(lecturer.name).toBe('PGS.TS. Nguyễn An');
 expect(formatLecturerName('ThS. Trần Bình')).toBe('ThS. Trần Bình');
 expect(formatLecturerName({...lecturer,academicRank:'Giáo sư'})).toBe('GS. TS. Nguyễn An');
 expect(formatLecturerName('PGS. TS. Nguyễn An')).toBe('PGS. TS. Nguyễn An');
 expect(formatLecturerName({name:'Hồ Thị Hương Thơm',academicDegree:'Tiến sĩ'})).toBe('TS. Hồ Thị Hương Thơm');
 expect(formatLecturerName('TS Quách Thị Hà')).toBe('TS. Quách Thị Hà');
});
it('formats both exam invigilators and preserves typed outside staff names',()=>{
 const session={lecturerName:'Nguyễn An',lecturerAcademicRank:'Phó Giáo sư',lecturerAcademicDegree:'Tiến sĩ',secondLecturerName:'Trần Bình',secondLecturerAcademicDegree:'Thạc sĩ'};
 expect(examInvigilatorName(session)).toBe('PGS. TS. Nguyễn An');
 expect(examInvigilatorName(session,true)).toBe('ThS. Trần Bình');
 expect(examInvigilatorName({externalInvigilatorName:'Lê Minh'})).toBe('Lê Minh');
});
