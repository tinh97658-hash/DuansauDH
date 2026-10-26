const minutes=time=>Number(time.slice(0,2))*60+Number(time.slice(3,5));
export const formatExamDate=(value,short=false)=>value?`${value.slice(8,10)}/${value.slice(5,7)}${short?'':'/'+value.slice(0,4)}`:'';
export const examPeriods=[{id:'MORNING',label:'SÁNG',start:'08:00',end:'09:00',from:420,to:780},{id:'AFTERNOON',label:'CHIỀU',start:'14:00',end:'15:00',from:780,to:1140}];
export function examSessionsForPeriod(sessions,date,period){
 const bounds=examPeriods.find(p=>p.id===period);
 return sessions.filter(s=>s.examDate===date&&minutes(s.startTime)<bounds.to&&minutes(s.endTime)>bounds.from)
  .sort((a,b)=>a.startTime.localeCompare(b.startTime)||a.endTime.localeCompare(b.endTime)||a.id.localeCompare(b.id));
}
export const validExamHours=(start,end)=>/^\d{2}:[0-5]\d$/.test(start)&&/^\d{2}:[0-5]\d$/.test(end)&&start>='07:00'&&end<='19:00'&&end>start;
