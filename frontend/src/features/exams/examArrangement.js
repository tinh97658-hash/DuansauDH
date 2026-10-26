export const activeExamGroup=g=>['scheduled','held'].includes(g.status||'scheduled');
export const externalInvigilatorKey=(unit,name)=>JSON.stringify([unit,name].map(v=>String(v||'').trim().replace(/\s+/g,' ').toLowerCase()));
const time=t=>String(t||'').slice(0,5);
const candidateRecords=g=>(g.candidateIds||g.candidates?.map(c=>c.participantId)||[]).map((id,i)=>({id,key:g.candidateKeys?.[i]||id,person:g.candidates?.find(c=>c.participantId===id)}));
export function examCandidateConflictDetails(group,others){
 const records=candidateRecords(group),errors=[];
 for(const other of others){
  const start=[time(group.startTime),time(other.startTime)].sort().at(-1),end=[time(group.endTime),time(other.endTime)].sort()[0];
  if(!start||!end||start>=end)continue;
  const right=candidateRecords(other),shared=records.filter(a=>right.some(b=>a.key===b.key||a.id===b.id));
  if(!shared.length)continue;
  const people=[...new Set(shared.map(a=>a.person?.fullName||right.find(b=>a.key===b.key||a.id===b.id)?.person?.fullName||a.person?.code||a.id))];
  errors.push({candidateKeys:[...new Set(shared.map(a=>a.key))],message:`Trùng giờ thí sinh ${people.join(', ')}: ${group.subjectName} (${group.name}) và ${other.subjectName} (${other.name}), ${start}–${end}. Không thể ghép các môn này cùng đợt thi.`});
 }
 return errors;
}
export const examCandidateConflicts=(group,others)=>examCandidateConflictDetails(group,others).map(c=>c.message);
export const examConflictCandidateCount=conflicts=>new Set(conflicts.flatMap(c=>c.candidateKeys)).size;
export const otherExamSessions=(form,sessions,exclude)=>sessions.filter(s=>activeExamGroup(s)&&s.examDate===form.examDate&&(s.arrangementId||s.id)!==exclude);
export const examGroupsPeak=groups=>Math.max(0,...[...new Set(groups.map(g=>g.roundNo||1))].map(n=>groups.filter(g=>(g.roundNo||1)===n).reduce((sum,g)=>sum+Number(g.candidateCount||0),0)));
export function collectExamArrangements(sessions){
 const map=new Map();
 for(const s of sessions){const key=s.arrangementId||s.id;map.set(key,[...(map.get(key)||[]),s]);}
 return [...map.values()].map(members=>{
  if(members.length===1)return members[0];
  const active=members.filter(activeExamGroup),display=active.length?active:members,first=display[0];
  return {...first,id:first.arrangementId||first.id,isArrangement:true,members,
   name:`Phòng ${first.roomCode} · ${new Set(display.map(s=>s.roundNo||1)).size} đợt · ${display.length} nhóm thi`,
   code:`${new Set(display.map(s=>s.roundNo||1)).size} đợt · ${display.length} nhóm thi`,
   subjectName:[...new Set(display.map(s=>s.subjectName))].join(' · '),
   startTime:display.map(s=>s.startTime).sort()[0],endTime:display.map(s=>s.endTime).sort().at(-1),
   candidateCount:examGroupsPeak(active),groups:[...new Map(display.flatMap(s=>s.groups||[]).map(g=>[g.id,g])).values()],
   pendingConfirmation:active.some(s=>s.pendingConfirmation),
   status:active.some(s=>s.status==='scheduled')?'scheduled':active.length?'held':members.some(s=>s.status==='not_held')?'not_held':'cancelled'};
 });
}
export function arrangementProblems(form,groups,sessions,exclude){
 const errors=[],from=form.period==='MORNING'?'08:00':'14:00',to=form.period==='MORNING'?'12:00':'18:00';
 const rounds=[...new Set(groups.map(g=>g.roundNo))].sort((a,b)=>a-b);
 let previous=from;
 for(const n of rounds){
  const items=groups.filter(g=>g.roundNo===n),start=time(items[0].startTime),end=items.map(g=>time(g.endTime)).sort().at(-1);
  if(items.some(g=>time(g.startTime)!==start))errors.push(`Đợt ${n}: các nhóm phải bắt đầu cùng lúc.`);
  if(start<previous)errors.push(`Đợt ${n}: phải bắt đầu sau khi đợt trước kết thúc.`);
  if(items.some(g=>!/^\d{2}:[0-5]\d$/.test(g.startTime)||!/^\d{2}:[0-5]\d$/.test(g.endTime)||g.startTime<from||g.endTime>to||g.endTime<=g.startTime))errors.push(`Đợt ${n}: giờ thi phải nằm trong ${from}–${to}, kết thúc sau bắt đầu.`);
  previous=end;
 }
 if(new Set(groups.map(g=>g.courseOfferingId||g.id)).size!==groups.length)errors.push('Một lớp học phần chỉ được xếp một lần trong buổi.');
 const external=otherExamSessions(form,sessions,exclude);
 for(let i=0;i<groups.length;i++){
  errors.push(...examCandidateConflicts(groups[i],[...groups.slice(i+1),...external]));
 }
 return [...new Set(errors)];
}
