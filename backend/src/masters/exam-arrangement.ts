import {BadRequestException, ConflictException} from '@nestjs/common';

export const activeExam = (s:any) => ['scheduled','held'].includes(s.status);
export const externalInvigilatorKey=(unit:string,name:string)=>JSON.stringify([unit,name].map(v=>v.trim().replace(/\s+/g,' ').toLowerCase()));
export const overlapExam = (a:any,b:any) => a.startTime<b.endTime && a.endTime>b.startTime;

// Candidates have already been resolved from immutable approved snapshots.
export function validateExamArrangement(groups:any[],period:string) {
  const from=period==='MORNING'?'08:00':'14:00',to=period==='MORNING'?'12:00':'18:00';
  const rounds=new Map<number,any[]>();
  for(const g of groups){
    if(g.startTime<'08:00'||g.endTime>'18:00')throw new BadRequestException({code:'EXAM_WORKING_HOURS',message:'Giờ thi phải nằm trong khoảng 08:00–18:00.'});
    if(g.startTime<from||g.endTime>to||g.endTime<=g.startTime)
      throw new BadRequestException('Giờ thi phải hợp lệ và nằm trọn trong buổi đã chọn (sáng 08:00–12:00, chiều 14:00–18:00).');
    rounds.set(g.roundNo,[...(rounds.get(g.roundNo)||[]),g]);
  }
  let previousEnd=from,peak=0;
  for(const [,items] of [...rounds].sort((a,b)=>a[0]-b[0])){
    const start=items[0].startTime,end=items.reduce((v,g)=>g.endTime>v?g.endTime:v,start);
    if(items.some(g=>g.startTime!==start))throw new BadRequestException('Các nhóm trong một đợt phải bắt đầu cùng lúc.');
    if(start<previousEnd)throw new BadRequestException('Đợt tiếp theo chỉ được bắt đầu khi tất cả nhóm của đợt trước đã kết thúc.');
    previousEnd=end;
    peak=Math.max(peak,items.reduce((n,g)=>n+g.candidates.length,0));
    for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
      const right=new Set(items[j].aliases);
      const shared=items[i].aliases.filter((id:string)=>right.has(id));
      if(shared.length){
        const people=[...new Set(shared.map((id:string)=>items[i].aliasNames?.[id]||items[j].aliasNames?.[id]||items[i].rows.find((r:any)=>r.participantId===id)?.fullName).filter(Boolean))];
        throw new ConflictException({code:'EXAM_CANDIDATE_CONFLICT',message:`Thí sinh ${people.join(', ')||shared.join(', ')} bị trùng giờ giữa ${items[i].label} và ${items[j].label} (${start}–${items[i].endTime<items[j].endTime?items[i].endTime:items[j].endTime}).`});
      }
    }
  }
  return {peak,start:groups.reduce((v,g)=>g.startTime<v?g.startTime:v,to),end:previousEnd};
}
