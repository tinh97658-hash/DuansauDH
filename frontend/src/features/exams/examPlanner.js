import {getRoomFloor} from '../../utils/schedulingCalendar';
import {normalize} from '../scheduling/shared';
import {collectExamArrangements} from './examArrangement';

export const examLabels={scheduled:'Đã xếp lịch',held:'Đã diễn ra',not_held:'Không diễn ra',cancelled:'Đã hủy'};
export const examStatus=session=>session.pendingConfirmation?'Chờ xác nhận':examLabels[session.status];
export function examOfferingLabel(offering){
 if(offering.code?.trim())return offering.code.trim();
 const groups=[...new Set((offering.groups||[]).map(g=>g.code||g.name).filter(Boolean))];
 return groups.length?`${groups[0]}${groups.length>1?` +${groups.length-1}`:''}`:offering.name||'Lớp học phần';
}
export const examCardStatus=session=>session.pendingConfirmation?'CHỜ XÁC NHẬN':({scheduled:'ĐÃ XẾP',held:'ĐÃ DIỄN RA',not_held:'KHÔNG DIỄN RA',cancelled:'ĐÃ HỦY'}[session.status]||'');
export const roomFloor=room=>getRoomFloor(room.code)??(Number(String(room.code||'').match(/^[^0-9]*([0-9])/)?.[1])||null);
export const uniqueOptions=(items,id,name)=>[...new Map(items.filter(i=>i[id]).map(i=>[i[id],{id:i[id],name:i[name]||i[id]}])).values()].sort((a,b)=>a.name.localeCompare(b.name,'vi'));
export function matchesExam(offering,{discipline='',major='',year='',subject='',search=''}={}){
 return (!subject||offering.subjectId===subject)&&normalize(`${offering.name||''} ${offering.code||''} ${offering.subjectName||''} ${offering.subjectCode||''}`).includes(normalize(search))&&
  (!(discipline||major||year)||(offering.groups||[]).some(g=>(!discipline||g.disciplineId===discipline)&&(!major||g.majorId===major)&&(!year||g.academicYear===year)));
}
export function overlappingExams(sessions,form,exclude){
 const available=sessions.filter(s=>s.id!==exclude&&['scheduled','held'].includes(s.status)&&s.examDate===form.examDate);
 const overlaps=s=>s.startTime.slice(0,5)<form.endTime&&s.endTime.slice(0,5)>form.startTime;
 const actual=available.filter(overlaps);
 const reservations=collectExamArrangements(available).filter(s=>s.isArrangement&&overlaps(s)).map(s=>({...s,candidateIds:[],candidateKeys:[]}));
 return [...actual,...reservations];
}
export function examRoomReason(room,count,conflicts){
 if(room.isActive===false)return 'NGỪNG SỬ DỤNG';
 if(room.capacity==null)return 'CHƯA CÓ SỨC CHỨA';
 if(room.capacity<count)return 'KHÔNG ĐỦ CHỖ';
 return conflicts.some(s=>s.roomId===room.id)?'ĐÃ CÓ LỊCH':'';
}
