import {examCandidateConflicts,examCandidateConflictDetails,examConflictCandidateCount,arrangementProblems} from '../../features/exams/examArrangement';

const group=(extra={})=>({name:'Lớp A',subjectName:'Môn A',courseOfferingId:'a',roundNo:1,startTime:'08:00',endTime:'09:00',candidateIds:['admission:a'],candidateKeys:['student:s'],candidates:[{participantId:'admission:a',fullName:'Nguyễn An'}],...extra});
const other=extra=>group({name:'Lớp B',subjectName:'Môn B',courseOfferingId:'b',candidateIds:['student:s'],...extra});
it('recognizes the same learner across admission and student identities and reports the exact intersection',()=>{
 const errors=examCandidateConflicts(group(),[other({startTime:'08:30:00',endTime:'10:00:00'})]);
 expect(errors).toHaveLength(1);expect(errors[0]).toContain('Nguyễn An');expect(errors[0]).toContain('Môn A');expect(errors[0]).toContain('Môn B');expect(errors[0]).toContain('08:30–09:00');
});
it.each([['09:00','10:00'],['07:00','08:00']])('allows exams that meet at a boundary (%s–%s)',(startTime,endTime)=>{
 expect(examCandidateConflicts(group(),[other({startTime,endTime})])).toEqual([]);
});
it('does not infer learner conflicts from a shared class or name',()=>{
 expect(examCandidateConflicts(group(),[other({candidateIds:['admission:other'],candidateKeys:['student:other']})])).toEqual([]);
});
it('ignores cancelled sessions, other dates and the arrangement being edited',()=>{
 const form={period:'MORNING',examDate:'2026-10-23'};
 const sessions=[other({examDate:form.examDate,status:'cancelled'}),other({examDate:'2026-10-24'}),other({examDate:form.examDate,arrangementId:'editing'})];
 expect(arrangementProblems(form,[group()],sessions,'editing')).toEqual([]);
});
it('counts a learner once when they conflict with multiple exams under different aliases',()=>{
 const conflicts=examCandidateConflictDetails(group(),[other({}),other({candidateIds:['admission:linked']})]);
 expect(conflicts).toHaveLength(2);
 expect(examConflictCandidateCount(conflicts)).toBe(1);
});
it('counts different learners with the same name separately',()=>{
 const extra=group({candidateIds:['admission:b'],candidateKeys:['student:b']});
 const conflicts=[...examCandidateConflictDetails(group(),[other({})]),...examCandidateConflictDetails(extra,[other({candidateIds:['admission:b'],candidateKeys:['student:b']})])];
 expect(examConflictCandidateCount(conflicts)).toBe(2);
 expect(examConflictCandidateCount([])).toBe(0);
});
