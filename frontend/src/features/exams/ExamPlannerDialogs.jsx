import React,{useEffect,useRef,useState} from 'react';
import axios from 'axios';
import {Link} from 'react-router-dom';
import {Modal} from '../scheduling/shared';
import {API_BASE_URL} from '../../config/http';
import {parseDisplayDate} from '../../utils/dateFormat';
import {formatExamDate,validExamHours} from './examCalendar';
import {examRoomReason,examStatus,overlappingExams,roomFloor} from './examPlanner';

export function ExamDateInput({value,onChange,disabled}){
 const [draft,setDraft]=useState(formatExamDate(value));
 const emitted=useRef(value);
 useEffect(()=>{if(value!==emitted.current){setDraft(formatExamDate(value));emitted.current=value;}},[value]);
 return <input aria-label="Ngày thi" placeholder="dd/mm/yyyy" value={draft} disabled={disabled} maxLength={10} aria-invalid={!!draft&&!parseDisplayDate(draft)} onChange={e=>{const text=e.target.value;setDraft(text);const date=parseDisplayDate(text)||'';emitted.current=date;onChange(date);}}/>;
}
const errorText=e=>{const text=e.response?.data?.message;return Array.isArray(text)?text.join(' '):text||'Không thể tải tình trạng phòng. Hãy thử lại.';};
const timeRange=s=>`${s.startTime.slice(0,5)}–${s.endTime.slice(0,5)}`;
export function ExamPendingCards({sessions,onSelect,canWrite,saving,onHeld,onNotHeld}){
 return [...sessions].sort((a,b)=>`${a.examDate} ${a.startTime}`.localeCompare(`${b.examDate} ${b.startTime}`)).map(s=><article className="sl-pending-card" key={s.id}>
  <div className="sl-pending-date"><strong>{formatExamDate(s.examDate)}</strong><span>{timeRange(s)}</span></div>
  <div className="sl-pending-copy"><h3 title={s.name}><button className="ep-pending-title" onClick={()=>onSelect(s)}>{s.name}</button></h3><span title={s.subjectName}>{s.subjectName}</span></div>
  <div className="sl-pending-side"><small title={`Phòng ${s.roomCode} · ${s.candidateCount} thí sinh`}>Phòng {s.roomCode} · {s.candidateCount} TS</small><div className="sl-pending-actions"><button className="sl-btn" disabled={!canWrite||saving} onClick={()=>onNotHeld(s)}>Không diễn ra</button><button className="sl-btn sl-btn-primary" disabled={!canWrite||saving} onClick={()=>onHeld(s)}>✓ Đã diễn ra</button></div></div>
 </article>);
}
export function CandidateList({item}){
 return <details className="ep-candidates"><summary>Danh sách thí sinh ({item.candidateCount})</summary><ol>{(item.candidates||[]).map(c=><li key={c.participantId}>{c.code?`${c.code} · `:''}{c.fullName}</li>)}</ol></details>;
}
export function ExamEditor({session,offering,slot,rooms,canWrite,saving,error,onClose,onSave}){
 const [form,setForm]=useState({examDate:session?.examDate||slot.date,startTime:session?.startTime.slice(0,5)||slot.start,endTime:session?.endTime.slice(0,5)||slot.end,roomId:session?.roomId||'',note:session?.note||''});
 const [availability,setAvailability]=useState({sessions:[],loading:true,error:''}),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!form.examDate){setAvailability({sessions:[],loading:false,error:''});return;}let active=true;setAvailability({sessions:[],loading:true,error:''});
  const timer=setTimeout(()=>axios.get(`${API_BASE_URL}/masters/exam-schedule`,{params:{from:form.examDate,to:form.examDate},withCredentials:true}).then(({data})=>{if(active)setAvailability({sessions:data.sessions,loading:false,error:''});}).catch(e=>{if(active)setAvailability({sessions:[],loading:false,error:errorText(e)});}),180);
  return()=>{active=false;clearTimeout(timer);};
 },[form.examDate,retry]);
 const item=session||offering,count=item.candidateCount,conflicts=overlappingExams(availability.sessions,form,session?.id);
 const candidateIds=new Set(item.candidateIds||[]),candidateConflicts=new Set(conflicts.flatMap(s=>(s.candidateIds||[]).filter(id=>candidateIds.has(id))));
 const room=rooms.find(r=>r.id===form.roomId),reason=room?examRoomReason(room,count,conflicts):'';
 const validTime=validExamHours(form.startTime,form.endTime);
 const valid=canWrite&&form.examDate&&validTime&&room&&!reason&&!candidateConflicts.size&&!availability.loading&&!availability.error;
 const floors=[...new Set(rooms.map(roomFloor))].sort((a,b)=>(a??99)-(b??99));
 const change=(key,value)=>setForm(current=>({...current,[key]:value}));
 return <Modal wide className="sl-session-editor-dialog ep-editor" bodyClassName="sl-session-editor-body" title={session?'SỬA LỊCH THI':'XẾP LỊCH THI'} busy={saving} onClose={onClose} actions={<><button className="sl-btn" disabled={saving} onClick={onClose}>Hủy</button><button className="sl-btn sl-btn-primary" disabled={!valid||saving} onClick={()=>onSave(form,()=>setRetry(n=>n+1))}>{session?'Lưu lịch':'Xếp lịch'}</button></>}>
  {error&&<div role="alert" className="v20-error">{error}</div>}
  <div className="v20-composer">
   <section className="sl-editor-info"><h4>THÔNG TIN CA THI</h4><strong>{item.name}</strong><p>{item.subjectName}</p><span>{count} thí sinh</span>
    <CandidateList item={item}/>
    <label className="v20-field">Ngày thi<ExamDateInput value={form.examDate} disabled={saving} onChange={value=>change('examDate',value)}/></label>
    <div className="ep-period-value">Buổi: <strong>{form.startTime<'13:00'?(form.endTime>'13:00'?'Sáng / Chiều':'Sáng'):'Chiều'}</strong></div>
    <div className="ep-times">{[['startTime','Bắt đầu'],['endTime','Kết thúc']].map(([key,label])=><label key={key} className="v20-field">{label}<span className="ep-clock"><span aria-hidden="true">◷</span><input type="time" lang="vi" min="07:00" max="19:00" step="60" aria-label={label} value={form[key]} onChange={e=>change(key,e.target.value)} disabled={saving}/></span></label>)}</div>
    <label className="v20-field">Ghi chú<textarea aria-label="Ghi chú" value={form.note} maxLength={2000} disabled={saving} onChange={e=>change('note',e.target.value)}/></label>
    <div className="ep-validation" aria-live="polite">{form.endTime<=form.startTime&&<span role="alert">Giờ kết thúc phải sau giờ bắt đầu.</span>}
     {form.endTime>form.startTime&&!validTime&&<span role="alert">Giờ thi phải nằm trong khoảng 07:00–19:00.</span>}
     {reason&&room&&<span role="alert">{room.code}: {reason}</span>}
     {candidateConflicts.size>0&&<span role="alert">{candidateConflicts.size} thí sinh đang có lịch thi khác trong khoảng {form.startTime}–{form.endTime}.</span>}
     {availability.loading&&<span role="status">Đang kiểm tra phòng…</span>}
     {availability.error&&<div role="alert">{availability.error} <button className="sl-btn" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></div>}
    </div>
   </section>
   <section className="sl-editor-rooms" aria-label="Phòng thi toàn viện"><h4>PHÒNG THI TOÀN VIỆN</h4>
    {floors.map(floor=><div className="v20-room-floor" key={floor??'other'}><h4>{floor==null?'PHÒNG KHÁC':`TẦNG ${floor}`}</h4><div className="v20-room-grid">{rooms.filter(r=>roomFloor(r)===floor).map(r=>{const blocked=examRoomReason(r,count,conflicts),chosen=form.roomId===r.id;return <button key={r.id} aria-pressed={chosen} title={r.name} className={`v20-room ${chosen?'sl-on':''} ${blocked==='ĐÃ CÓ LỊCH'?'v20-busy':blocked?'v20-unavailable':''}`} disabled={!canWrite||saving||availability.loading||!!availability.error||!form.examDate||!validTime||!!blocked} onClick={()=>change('roomId',r.id)}><strong>{r.code}</strong><span>{r.capacity==null?'Chưa có sức chứa':`${r.capacity} chỗ`}</span><small>{blocked|| (chosen?'ĐANG CHỌN':'TRỐNG')}</small></button>;})}</div></div>)}
   </section>
  </div>
 </Modal>;
}
export function ExamDetail({session,canWrite,saving,onClose,onEdit,onCancel,onPending}){
 return <Modal title="LỊCH THI" className="ep-detail" busy={saving} onClose={onClose} actions={<><button className="sl-btn" onClick={onClose}>Đóng</button>{canWrite&&session.status==='scheduled'&&session.canEdit!==false&&!session.pendingConfirmation&&<><button className="sl-btn sl-btn-danger" onClick={onCancel}>Hủy lịch</button><button className="sl-btn sl-btn-primary" onClick={onEdit}>Sửa lịch</button></>}{session.pendingConfirmation&&<button className="sl-btn sl-btn-primary" onClick={onPending}>Xác nhận ca thi</button>}</>}>
  <h3>{session.name}</h3><p>{session.subjectName}</p><dl className="ep-detail-data"><dt>Ngày thi</dt><dd>{formatExamDate(session.examDate)}</dd><dt>Thời gian</dt><dd>{timeRange(session)}</dd><dt>Phòng</dt><dd>{session.roomCode} {session.roomName?`· ${session.roomName}`:''}</dd><dt>Thí sinh</dt><dd>{session.candidateCount}</dd><dt>Trạng thái</dt><dd>{examStatus(session)}</dd></dl><CandidateList item={session}/>
  {session.note&&<p>Ghi chú: {session.note}</p>}
  <Link to={`/masters/exam-lists?offeringId=${session.courseOfferingId}&groupId=${session.classGroupId||session.groups?.[0]?.id||''}`}>Mở bảng điểm</Link>
 </Modal>;
}
export function ExamReasonDialog({action,session,saving,error,onClose,onConfirm}){
 const [note,setNote]=useState(''),cancel=action==='cancel';
 return <Modal title={cancel?'HỦY LỊCH THI':'KHÔNG DIỄN RA'} className="ep-reason" busy={saving} onClose={onClose} actions={<><button className="sl-btn" disabled={saving} onClick={onClose}>Quay lại</button><button className={`sl-btn ${cancel?'sl-btn-danger':'sl-btn-primary'}`} disabled={saving||!note.trim()} onClick={()=>onConfirm(note)}>{cancel?'Hủy lịch':'Xác nhận không diễn ra'}</button></>}>
  <p>{session.name} · {formatExamDate(session.examDate)} · {timeRange(session)}</p>{error&&<div role="alert" className="v20-error">{error}</div>}
  <label className="v20-field">{cancel?'Lý do hủy *':'Lý do không diễn ra *'}<textarea autoFocus aria-label={cancel?'Lý do hủy':'Lý do không diễn ra'} required maxLength={2000} value={note} disabled={saving} onChange={e=>setNote(e.target.value)}/></label>
 </Modal>;
}
export function ExamListTable({sessions,onSelect,confirmation,canWrite,saving,onHeld,onNotHeld}){
 return <table className="v20-table ep-session-table"><thead><tr><th>Ngày / giờ</th><th>Lớp học phần</th><th>Học phần</th><th>Phòng</th><th>Thí sinh</th>{confirmation&&<th>Xác nhận</th>}</tr></thead><tbody>{sessions.map(s=><tr key={s.id} tabIndex={confirmation?undefined:0} onClick={confirmation?undefined:()=>onSelect(s)} onKeyDown={confirmation?undefined:e=>{if(e.target===e.currentTarget&&['Enter',' '].includes(e.key)){e.preventDefault();onSelect(s);}}}><td>{formatExamDate(s.examDate)}<small>{timeRange(s)}</small></td><td><button className="sl-btn sl-btn-link" onClick={e=>{e.stopPropagation();onSelect(s);}}>{s.name}</button></td><td>{s.subjectName}</td><td>{s.roomCode}</td><td>{s.candidateCount}</td>{confirmation&&<td><div className="sl-pending-actions"><button className="sl-btn" disabled={!canWrite||saving} onClick={()=>onNotHeld(s)}>Không diễn ra</button><button className="sl-btn sl-btn-primary" disabled={!canWrite||saving} onClick={()=>onHeld(s)}>✓ Đã diễn ra</button></div></td>}</tr>)}</tbody></table>;
}
