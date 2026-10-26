import React,{useEffect,useRef,useState} from 'react';
import axios from 'axios';
import {Modal,SearchSelect,normalize} from '../scheduling/shared';
import ExamResourceInput from './ExamResourceInput';
import {isExamPeriodClosed,nextExamSlot,useExamWallTime} from './examPeriodAvailability';
import {API_BASE_URL} from '../../config/http';
import {getBusinessTodayKey} from '../../utils/schedulingCalendar';
import {arrangementProblems,collectExamArrangements,examGroupsPeak,activeExamGroup,externalInvigilatorKey,examCandidateConflictDetails,examConflictCandidateCount,otherExamSessions} from './examArrangement';

const groupForm=g=>({...g,courseOfferingId:g.courseOfferingId||g.id,sessionId:g.courseOfferingId?g.id:undefined,roundNo:g.roundNo||1,startTime:g.startTime?.slice(0,5)||'08:00',endTime:g.endTime?.slice(0,5)||'09:00'});
const nextHour=t=>{const m=Number(t.slice(0,2))*60+Number(t.slice(3,5))+60;return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;};
const movedEnd=(g,start)=>{const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3,5));const end=minutes(start)+minutes(g.endTime)-minutes(g.startTime);return `${String(Math.floor(end/60)).padStart(2,'0')}:${String(end%60).padStart(2,'0')}`;};
const suggestedUnitNames=new Set(['vien dao tao sdh','vien dao tao sau dai hoc']);
export default function ExamArrangementEditor({initial={},members=[],queue=[],rooms=[],lecturers=[],units=[],canWrite,saving,error,onClose,onSave}){
 const wallTime=useExamWallTime(),defaultSlot=nextExamSlot(wallTime);
 const initialStart=initial.startTime==='13:00'?'14:00':initial.startTime||defaultSlot.startTime;
 const initialEnd=initial.startTime==='13:00'?nextHour(initialStart):initial.endTime;
 const seed=members.find(activeExamGroup)||members[0],arrangementId=seed?.arrangementId;
 const [form,setForm]=useState(()=>({examDate:seed?.examDate||initial.examDate||defaultSlot.examDate,period:(seed?.startTime||initialStart)<'13:00'?'MORNING':'AFTERNOON',roomId:seed?.roomId||initial.roomId||'',lecturerId:seed?.lecturerId||initial.lecturerId||'',note:seed?.arrangementNote||initial.note||''}));
 const [groups,setGroups]=useState(()=>members.length?members.filter(activeExamGroup).map(groupForm):initial.offering?[groupForm({...initial.offering,startTime:initialStart,endTime:initialEnd})]:[]);
 const [unitId,setUnitId]=useState(()=>lecturers.find(l=>l.id===(seed?.lecturerId||initial.lecturerId))?.unitId||'');
 const [unitText,setUnitText]=useState(()=>seed?.externalUnitName||units.find(u=>u.id===lecturers.find(l=>l.id===(seed?.lecturerId||initial.lecturerId))?.unitId)?.name||'');
 const [invigilatorText,setInvigilatorText]=useState(()=>seed?.externalInvigilatorName||lecturers.find(l=>l.id===(seed?.lecturerId||initial.lecturerId))?.name||'');
 const [rounds,setRounds]=useState(()=>{const numbers=[...new Set(members.filter(activeExamGroup).map(s=>s.roundNo||1))];return numbers.length?numbers.sort((a,b)=>a-b):[1];});
 const [roundStarts,setRoundStarts]=useState(()=>Object.fromEntries(rounds.map(n=>[n,groups.find(g=>g.roundNo===n)?.startTime||initialStart])));
 const [availability,setAvailability]=useState({loading:true,sessions:[],error:''}),[retry,setRetry]=useState(0);
 const [blockedConflicts,setBlockedConflicts]=useState([]),warningRef=useRef(null);
 useEffect(()=>setBlockedConflicts([]),[groups,form.examDate,form.period,rounds,roundStarts,availability.sessions]);
 useEffect(()=>{let active=true;setAvailability({loading:true,sessions:[],error:''});
  axios.get(`${API_BASE_URL}/masters/exam-schedule`,{params:{from:form.examDate,to:form.examDate},withCredentials:true}).then(({data})=>{if(active)setAvailability({loading:false,sessions:data.sessions,error:''});}).catch(()=>{if(active)setAvailability({loading:false,sessions:[],error:'Không tải được lịch để kiểm tra. Hãy thử lại.'});});
  return()=>{active=false;};
 },[form.examDate,retry]);
 const locked=groups.some(g=>g.sessionId&&(g.canEdit===false||g.status!=='scheduled'));
 const isLocked=g=>g.sessionId&&(g.canEdit===false||g.status!=='scheduled');
 const periodClosed=isExamPeriodClosed(form.examDate,form.period,wallTime);
 const problems=arrangementProblems(form,groups,availability.sessions,arrangementId);
 const candidateConflicts=groups.flatMap((g,i)=>examCandidateConflictDetails(g,[...groups.slice(i+1),...otherExamSessions(form,availability.sessions,arrangementId)]));
 const conflictCount=examConflictCandidateCount([...blockedConflicts,...candidateConflicts]);
 const warningText=conflictCount?`Không thể ghép các môn này cùng đợt thi vì có ${conflictCount} thí sinh trùng lịch.`:'';
 useEffect(()=>{if(warningText)warningRef.current?.scrollIntoView?.({block:'nearest',behavior:'smooth'});},[warningText]);
 if(rounds.some(n=>!groups.some(g=>g.roundNo===n)))problems.push('Mỗi đợt cần ít nhất một nhóm thi; hãy thêm học phần hoặc bỏ đợt trống.');
 if(form.examDate<getBusinessTodayKey())problems.push('Không thể xếp lịch vào ngày đã qua.');
 if(periodClosed)problems.push(`Buổi ${form.period==='MORNING'?'sáng':'chiều'} đã khóa ghép thi từ ${form.period==='MORNING'?'08:01':'14:01'}. Hãy chọn buổi hoặc ngày thi khác.`);
 const activeGroups=groups.filter(activeExamGroup),peak=examGroupsPeak(activeGroups),start=groups.map(g=>g.startTime).sort()[0]||'',end=groups.map(g=>g.endTime).sort().at(-1)||'';
 const busy=collectExamArrangements(availability.sessions.filter(s=>activeExamGroup(s)&&s.examDate===form.examDate)).filter(s=>(s.arrangementId||s.id)!==arrangementId&&s.startTime.slice(0,5)<end&&s.endTime.slice(0,5)>start);
 const roomReason=r=>r.isActive===false?'NGỪNG SỬ DỤNG':r.capacity==null?'CHƯA CÓ SỨC CHỨA':r.capacity<peak?'KHÔNG ĐỦ CHỖ':busy.some(s=>s.roomId===r.id)?'ĐÃ CÓ LỊCH':'';
 const selectedRoom=rooms.find(r=>r.id===form.roomId),lecturer=lecturers.find(l=>l.id===form.lecturerId),lecturerBusy=busy.some(s=>form.lecturerId?s.lecturerId===form.lecturerId:!!s.externalInvigilatorName&&externalInvigilatorKey(s.externalUnitName,s.externalInvigilatorName)===externalInvigilatorKey(unitText,invigilatorText));
 const visibleUnits=units.filter(u=>suggestedUnitNames.has(normalize(u.name||'').trim().replace(/\s+/g,' '))&&(u.active!==false||u.id===unitId));
 const filteredLecturers=lecturers.filter(l=>l.unitId===unitId&&visibleUnits.some(u=>u.id===unitId)&&(l.active||l.id===form.lecturerId));
 const invigilatorValid=form.lecturerId?lecturer?.active&&filteredLecturers.some(l=>l.id===form.lecturerId):unitText.trim()&&invigilatorText.trim();
 const valid=canWrite&&groups.length&&!problems.length&&selectedRoom&&!roomReason(selectedRoom)&&invigilatorValid&&!lecturerBusy&&!availability.loading&&!availability.error;
 const change=(key,value)=>setForm(f=>({...f,[key]:value}));
 const changeStart=(n,value)=>{setRoundStarts(s=>({...s,[n]:value}));setGroups(gs=>gs.map(g=>g.roundNo===n?{...g,startTime:value,endTime:movedEnd(g,value)}:g));};
 const tryGroup=(candidate,others)=>{if(isExamPeriodClosed(form.examDate,form.period))return false;const conflicts=examCandidateConflictDetails(candidate,[...others,...otherExamSessions(form,availability.sessions,arrangementId)]);setBlockedConflicts(conflicts);return !conflicts.length;};
 const add=(offeringId,n)=>{const o=queue.find(q=>q.id===offeringId);if(!o)return;const candidate=groupForm({...o,startTime:roundStarts[n],endTime:nextHour(roundStarts[n]),roundNo:n});if(tryGroup(candidate,groups))setGroups(gs=>[...gs,candidate]);};
 const moveGroup=(g,target)=>{const candidate={...g,roundNo:target,startTime:roundStarts[target],endTime:movedEnd(g,roundStarts[target])};if(tryGroup(candidate,groups.filter(x=>x!==g)))setGroups(gs=>gs.map(x=>x===g?candidate:x));};
 const submit=()=>{if(isExamPeriodClosed(form.examDate,form.period))return;onSave({...form,lecturerId:form.lecturerId||undefined,...(!form.lecturerId?{externalUnitName:unitText.trim(),externalInvigilatorName:invigilatorText.trim()}:{}),...(arrangementId?{version:seed.arrangementVersion}:{}),groups:groups.map(g=>({...(g.sessionId?{id:g.sessionId,version:g.version}:{}),courseOfferingId:g.courseOfferingId,snapshotId:g.snapshotId,eligibilityVersion:g.eligibilityVersion,roundNo:g.roundNo,startTime:g.startTime,endTime:g.endTime}))},arrangementId,()=>setRetry(n=>n+1));};
 return <Modal wide className="ep-arrangement-dialog" title={arrangementId?'SỬA BUỔI THI':'TẠO BUỔI THI'} busy={saving} onClose={onClose} actions={<><button className="sl-btn" disabled={saving} onClick={onClose}>Đóng</button><button className="sl-btn sl-btn-primary" disabled={!valid||saving} onClick={submit}>Lưu buổi thi</button></>}>
  {error&&<div role="alert" className={/thí sinh.*trùng|trùng.*thí sinh/i.test(error)?'ep-candidate-warning':'v20-error'}>{error}</div>}
  <div className="ep-arrangement-fields">
   <label className="v20-field">Ngày thi<input aria-label="Ngày thi" type="date" value={form.examDate} disabled={locked||saving} onChange={e=>change('examDate',e.target.value)}/></label>
   <label className="v20-field">Buổi<select aria-label="Buổi thi" value={form.period} disabled={locked||saving} onChange={e=>{const period=e.target.value;change('period',period);if(!groups.length)setRoundStarts(starts=>Object.fromEntries(Object.keys(starts).map(n=>[n,period==='MORNING'?'08:00':'14:00'])));}}><option value="MORNING" disabled={isExamPeriodClosed(form.examDate,'MORNING',wallTime)}>Sáng · 08:00–12:00</option><option value="AFTERNOON" disabled={isExamPeriodClosed(form.examDate,'AFTERNOON',wallTime)}>Chiều · 14:00–18:00</option></select></label>
   <label className="v20-field">Đơn vị<ExamResourceInput label="Đơn vị" value={unitText} options={visibleUnits} placeholder="Chọn hoặc nhập đơn vị" disabled={locked||saving} onChange={value=>{setUnitText(value);setUnitId(visibleUnits.find(u=>normalize(u.name).trim()===normalize(value).trim())?.id||'');setInvigilatorText('');change('lecturerId','');}} onSelect={u=>{setUnitText(u.name);setUnitId(u.id);setInvigilatorText('');change('lecturerId','');}}/></label>
   <label className="v20-field">Giám thị<ExamResourceInput label="Giám thị" value={invigilatorText} placeholder="Chọn hoặc nhập tên giám thị" options={filteredLecturers.map(l=>({...l,disabled:busy.some(s=>s.lecturerId===l.id)}))} disabled={!unitText.trim()||locked||saving||availability.loading||!!availability.error} onChange={value=>{setInvigilatorText(value);change('lecturerId',filteredLecturers.find(l=>normalize(l.name).trim()===normalize(value).trim())?.id||'');}} onSelect={l=>{setInvigilatorText(l.name);change('lecturerId',l.id);}}/></label>
  </div>
  {locked&&<p className="v20-hint">Buổi có nhóm đã bắt đầu hoặc đã xác nhận: giữ nguyên ngày, phòng và giám thị. Chỉ sửa các nhóm chưa bắt đầu.</p>}
  <p>Phòng cần ít nhất <strong>{peak} chỗ</strong> · {groups.reduce((n,g)=>n+Number(g.candidateCount||0),0)} lượt dự thi · Giữ phòng và giám thị {start||'…'}–{end||'…'}, gồm khoảng nghỉ.</p>
  <div className="ep-arrangement-rooms" aria-label="Phòng thi">{rooms.map(r=><button key={r.id} className={`sl-btn ${r.id===form.roomId?'sl-btn-primary':''}`} disabled={locked||saving||availability.loading||!!availability.error||!!roomReason(r)} aria-pressed={r.id===form.roomId} onClick={()=>change('roomId',r.id)}>{r.code} · {r.capacity??'?'} chỗ {roomReason(r)}</button>)}</div>
  {rounds.map(n=>{const items=groups.filter(g=>g.roundNo===n),roundLocked=items.some(isLocked);return <section className="ep-round" key={n} aria-label={`Đợt ${n}`}>
   <div className="ep-round-heading"><h3>Đợt {n} · {items.reduce((sum,g)=>sum+Number(g.candidateCount||0),0)} thí sinh</h3><label>Bắt đầu <input aria-label={`Bắt đầu đợt ${n}`} type="time" value={roundStarts[n]} disabled={roundLocked||saving} onChange={e=>changeStart(n,e.target.value)}/></label>{!items.length&&<button className="sl-btn" onClick={()=>setRounds(rs=>rs.filter(r=>r!==n))}>Bỏ đợt {n}</button>}</div>
   <div className="ep-round-table"><table className="v20-table"><thead><tr><th>Lớp học viên / lớp học phần</th><th>Học phần</th><th>Thí sinh</th><th>Kết thúc</th><th>Thao tác</th></tr></thead><tbody>{items.map(g=><tr key={g.courseOfferingId}>
    <td>{g.name}<small>{(g.groups||[]).map(c=>c.code||c.name).join(', ')}</small></td><td>{g.subjectName}</td>
    <td><details><summary>{g.candidateCount} người</summary><ul>{(g.candidates||[]).map(c=><li key={c.participantId}>{c.code} · {c.fullName}</li>)}</ul></details></td>
    <td><input aria-label={`Kết thúc ${g.name}`} type="time" value={g.endTime} disabled={isLocked(g)||saving} onChange={e=>setGroups(gs=>gs.map(x=>x===g?{...x,endTime:e.target.value}:x))}/></td>
    <td>{!isLocked(g)&&<select aria-label={`Chuyển đợt ${g.name}`} value={g.roundNo} disabled={saving||periodClosed} onChange={e=>{moveGroup(g,Number(e.target.value));}}>{rounds.filter(r=>r===g.roundNo||!groups.some(x=>x.roundNo===r&&isLocked(x))).map(r=><option key={r} value={r}>Đợt {r}</option>)}</select>}{g.sessionId?<small>{isLocked(g)?'Giữ lịch sử':'Hủy riêng tại chi tiết nhóm thi'}</small>:<button className="sl-btn" aria-label={`Gỡ ${g.subjectName}`} disabled={saving} onClick={()=>setGroups(gs=>gs.filter(x=>x!==g))}>Gỡ</button>}</td>
   </tr>)}</tbody></table></div>
   <SearchSelect label={`Thêm học phần đợt ${n}`} value="" placeholder="Thêm lớp học phần đã duyệt..." disabled={periodClosed||roundLocked||saving||availability.loading||!!availability.error} options={queue.filter(o=>!groups.some(g=>g.courseOfferingId===o.id)).map(o=>({id:o.id,name:`${o.name} · ${o.candidateCount} TS`}))} onChange={value=>add(value,n)}/>
  </section>;})}
  {conflictCount>0&&<div ref={warningRef} role="alert" className="ep-candidate-warning"><div>{warningText}</div><div>Hãy chọn đợt hoặc giờ thi khác không trùng lịch.</div></div>}
  <button className="sl-btn" disabled={saving||periodClosed} onClick={()=>{const n=Math.max(0,...rounds)+1;setRounds(rs=>[...rs,n]);setRoundStarts(s=>({...s,[n]:end|| (form.period==='MORNING'?'08:00':'14:00')}));}}>+ Thêm đợt thi</button>
  <label className="v20-field">Ghi chú chung<textarea aria-label="Ghi chú chung" maxLength={2000} value={form.note} disabled={saving} onChange={e=>change('note',e.target.value)}/></label>
  <div className="ep-validation" aria-live="polite">{problems.filter(p=>!p.startsWith('Tr\u00f9ng gi\u1edd th\u00ed sinh')).map(p=><span role="alert" key={p}>{p}</span>)}{selectedRoom&&roomReason(selectedRoom)&&<span role="alert">Phòng {selectedRoom.code}: {roomReason(selectedRoom)}</span>}{lecturerBusy&&<span role="alert">Giám thị đã có buổi thi trùng giờ.</span>}{availability.loading&&<span role="status">Đang kiểm tra lịch…</span>}{availability.error&&<span role="alert">{availability.error} <button className="sl-btn" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></span>}</div>
 </Modal>;
}
