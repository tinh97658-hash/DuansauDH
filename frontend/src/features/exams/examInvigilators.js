import {externalInvigilatorKey} from './examArrangement';
import {formatLecturerName} from '../../utils/lecturerName';

export const examInvigilatorName=(session,second=false)=>formatLecturerName(second
 ?{name:session.secondExternalInvigilatorName||session.secondLecturerName,academicRank:session.secondLecturerAcademicRank,academicDegree:session.secondLecturerAcademicDegree}
 :{name:session.externalInvigilatorName||session.lecturerName,academicRank:session.lecturerAcademicRank,academicDegree:session.lecturerAcademicDegree});

export const examInvigilators=session=>[
 {id:session.lecturerId,name:session.externalInvigilatorName,unit:session.externalUnitName},
 {id:session.secondLecturerId,name:session.secondExternalInvigilatorName,unit:session.secondExternalUnitName},
];
const samePerson=(a,b)=>a.id&&b.id?a.id===b.id:!a.id&&!b.id&&!!a.name?.trim()&&!!b.name?.trim()&&externalInvigilatorKey(a.unit,a.name)===externalInvigilatorKey(b.unit,b.name);
export const examInvigilatorBusy=(person,sessions)=>sessions.some(s=>examInvigilators(s).some(other=>samePerson(person,other)));
export const duplicateExamInvigilators=form=>{const [a,b]=examInvigilators(form);return !!samePerson(a,b);};
export const secondInvigilatorValid=(form,lecturers)=>form.secondLecturerId?lecturers.some(l=>l.id===form.secondLecturerId&&l.active):!form.secondExternalInvigilatorName?.trim()||!!form.secondExternalUnitName?.trim();
export const secondInvigilatorPayload=form=>({secondLecturerId:form.secondLecturerId||undefined,
 secondExternalInvigilatorName:form.secondLecturerId?undefined:form.secondExternalInvigilatorName?.trim()||undefined,
 secondExternalUnitName:form.secondLecturerId||!form.secondExternalInvigilatorName?.trim()?undefined:form.secondExternalUnitName?.trim()||undefined});
