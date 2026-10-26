import React,{useEffect,useState} from 'react';
import axios from 'axios';
import {Link} from 'react-router-dom';
import {Modal,SearchSelect,normalize} from '../scheduling/shared';
import LecturerPicker from '../scheduling/LecturerPicker';
import {API_BASE_URL} from '../../config/http';
import {getBusinessTodayKey} from '../../utils/schedulingCalendar';
import {formatExamDate,validExamHours} from './examCalendar';
import {isExamPeriodClosed,useExamWallTime} from './examPeriodAvailability';
import {examRoomReason,examStatus,overlappingExams,roomFloor} from './examPlanner';

const errorText=e=>{const text=e.response?.data?.message;return Array.isArray(text)?text.join(' '):text||'Không thể tải tình trạng phòng. Hãy thử lại.';};
const examUnitNames=new Set(['vien dao tao sdh','vien dao tao sau dai hoc']);
const isExamUnit=unit=>examUnitNames.has(normalize(String(unit.name||'').toLocaleLowerCase('vi')).trim().replace(/\s+/g,' '));
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
export function ExamEditor({session,offering,slot,rooms,lecturers=[],units=[],canWrite,saving,error,onClose,onSave,onCompose}){
 const wallTime=useExamWallTime();
 const [form,setForm]=useState({examDate:session?.examDate||slot.date,startTime:session?.startTime.slice(0,5)||slot.start,endTime:session?.endTime.slice(0,5)||slot.end,roomId:session?.roomId||'',lecturerId:session?.lecturerId||'',note:session?.note||''});
 const [unitId,setUnitId]=useState(()=>{const lecturer=lecturers.find(l=>l.id===session?.lecturerId);return lecturer&&units.some(unit=>unit.id===lecturer.unitId&&isExamUnit(unit))?lecturer.unitId:'';});
 const [availability,setAvailability]=useState({sessions:[],loading:true,error:''}),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!form.examDate){setAvailability({sessions:[],loading:false,error:''});return;}let active=true;setAvailability({sessions:[],loading:true,error:''});
  const timer=setTimeout(()=>axios.get(`${API_BASE_URL}/masters/exam-schedule`,{params:{from:form.examDate,to:form.examDate},withCredentials:true}).then(({data})=>{if(active)setAvailability({sessions:data.sessions,loading:false,error:''});}).catch(e=>{if(active)setAvailability({sessions:[],loading:false,error:errorText(e)});}),180);
  return()=>{active=false;clearTimeout(timer);};
 },[form.examDate,retry]);
 const item=session||offering,count=item.candidateCount,conflicts=overlappingExams(availability.sessions,form,session?.id);
 const candidateIds=new Set(item.candidateKeys||item.candidateIds||[]),candidateConflicts=new Set(conflicts.flatMap(s=>(s.candidateKeys||s.candidateIds||[]).filter(id=>candidateIds.has(id))));
 const room=rooms.find(r=>r.id===form.roomId),reason=room?examRoomReason(room,count,conflicts):'';
 const validTime=validExamHours(form.startTime,form.endTime),pastDate=form.examDate&&form.examDate<getBusinessTodayKey(),periodClosed=isExamPeriodClosed(form.examDate,form.startTime<'13:00'?'MORNING':'AFTERNOON',wallTime);
 const lecturer=lecturers.find(l=>l.id===form.lecturerId),lecturerBusy=conflicts.some(s=>s.lecturerId===form.lecturerId);
 const visibleUnits=units.filter(unit=>isExamUnit(unit)&&(unit.active!==false||unit.id===unitId)).sort((a,b)=>a.name.localeCompare(b.name,'vi'));
 const filteredLecturers=lecturers.filter(l=>visibleUnits.some(unit=>unit.id===unitId)&&l.unitId===unitId&&(l.active||l.id===form.lecturerId))
  .map(l=>({...l,unit:units.find(unit=>unit.id===l.unitId)||null}));
 const valid=canWrite&&form.examDate&&!pastDate&&!periodClosed&&validTime&&room&&!reason&&lecturer?.active&&filteredLecturers.some(l=>l.id===form.lecturerId)&&!lecturerBusy&&!candidateConflicts.size&&!availability.loading&&!availability.error;
 const floors=[...new Set(rooms.map(roomFloor))].sort((a,b)=>(a??99)-(b??99));
 const change=(key,value)=>setForm(current=>({...current,[key]:value}));
 return <Modal wide className="sl-session-editor-dialog ep-editor" bodyClassName="sl-session-editor-body" title={session?'SỬA LỊCH THI':'XẾP LỊCH THI'} busy={saving} onClose={onClose} actions={<><button className="sl-btn" disabled={saving} onClick={onClose}>Hủy</button><button className="sl-btn sl-btn-primary" disabled={!valid||saving} onClick={()=>onSave(form,()=>setRetry(n=>n+1))}>{session?'Lưu lịch':'Xếp lịch'}</button></>}>
  {error&&<div role="alert" className="v20-error">{error}</div>}
  <div className="v20-composer">
   <section className="sl-editor-info"><h4>THÔNG TIN CA THI</h4><strong>{item.name}</strong><p>{item.subjectName}</p>
    <CandidateList item={item}/>
    {onCompose&&!periodClosed&&<button className="sl-btn" disabled={saving||!canWrite} onClick={()=>onCompose(form)}>Ghép học phần / thêm đợt thi</button>}
    <div className="ep-period-value">Buổi: <strong>{form.startTime<'13:00'?(form.endTime>'13:00'?'Sáng / Chiều':'Sáng'):'Chiều'}</strong></div>
    <label className="v20-field sl-unit-field">Đơn vị
     <SearchSelect label="Đơn vị" value={unitId} options={visibleUnits}
      placeholder="Nhập để tìm đơn vị..." disabled={!canWrite||saving}
      onChange={value=>{if(value!==unitId){setUnitId(value);change('lecturerId','');}}}/>
    </label>
    <label className="v20-field">Giảng viên
     <LecturerPicker key={unitId} value={form.lecturerId} lecturers={filteredLecturers} offering={offering||session}
      conflicts={conflicts} disabled={!unitId||!canWrite||saving||availability.loading||!!availability.error}
      onChange={value=>change('lecturerId',value)}/>
    </label>
    {!lecturers.some(l=>l.active)&&<div className="v20-hint">Chưa có giảng viên đang hoạt động. Khai báo tại Hệ thống → Giảng viên.</div>}
    {unitId&&lecturers.some(l=>l.active)&&!filteredLecturers.some(l=>l.active)&&<div className="v20-hint">Đơn vị này chưa có giảng viên đang hoạt động.</div>}
    <label className="v20-field">Ghi chú<textarea aria-label="Ghi chú" value={form.note} maxLength={2000} disabled={saving} onChange={e=>change('note',e.target.value)}/></label>
    <div className="ep-validation" aria-live="polite">{pastDate&&<span role="alert">Không thể xếp lịch thi vào ngày đã qua.</span>}{form.endTime<=form.startTime&&<span role="alert">Giờ kết thúc phải sau giờ bắt đầu.</span>}
     {form.endTime>form.startTime&&!validTime&&<span role="alert">Giờ thi phải nằm trong khoảng 07:00–19:00.</span>}
     {periodClosed&&!pastDate&&<span role="alert">Buổi thi đã khóa ghép theo giờ thực. Hãy chọn buổi hoặc ngày thi khác.</span>}
     {reason&&room&&<span role="alert">{room.code}: {reason}</span>}
     {lecturerBusy&&<span role="alert">Giảng viên đã có ca thi trùng giờ.</span>}
     {candidateConflicts.size>0&&<span role="alert">{candidateConflicts.size} thí sinh đang có lịch thi khác trong khoảng {form.startTime}–{form.endTime}.</span>}
     {availability.loading&&<span role="status">Đang kiểm tra phòng…</span>}
     {availability.error&&<div role="alert">{availability.error} <button className="sl-btn" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></div>}
    </div>
   </section>
   <section className="sl-editor-rooms" aria-label="Phòng thi toàn viện"><h4>PHÒNG THI TOÀN VIỆN</h4>
    {floors.map(floor=><div className="v20-room-floor" key={floor??'other'}><h4>{floor==null?'PHÒNG KHÁC':`TẦNG ${floor}`}</h4><div className="v20-room-grid">{rooms.filter(r=>roomFloor(r)===floor).map(r=>{const blocked=examRoomReason(r,count,conflicts),chosen=form.roomId===r.id;return <button key={r.id} aria-pressed={chosen} title={r.name} className={`v20-room ${chosen?'sl-on':''} ${blocked==='ĐÃ CÓ LỊCH'?'v20-busy':blocked?'v20-unavailable':''}`} disabled={!canWrite||saving||availability.loading||!!availability.error||!form.examDate||!!pastDate||!validTime||!!blocked} onClick={()=>change('roomId',r.id)}><strong>{r.code}</strong><span>{r.capacity==null?'Chưa có sức chứa':`${r.capacity} chỗ`}</span><small>{blocked|| (chosen?'ĐANG CHỌN':'TRỐNG')}</small></button>;})}</div></div>)}
   </section>
  </div>
 </Modal>;
}
export function ExamDetail({session,canWrite,saving,onClose,onEdit,onCancel,onPending,onCompose}){
 return <Modal title="LỊCH THI" className="ep-detail" busy={saving} onClose={onClose} actions={<><button className="sl-btn" onClick={onClose}>Đóng</button>{canWrite&&session.status==='scheduled'&&session.canEdit!==false&&!session.pendingConfirmation&&<><button className="sl-btn sl-btn-danger" onClick={onCancel}>Hủy lịch</button><button className="sl-btn sl-btn-primary" onClick={onEdit}>Sửa lịch</button></>}{session.pendingConfirmation&&<button className="sl-btn sl-btn-primary" onClick={onPending}>Xác nhận ca thi</button>}</>}>
  <h3>{session.name}</h3><p>{session.subjectName}</p><dl className="ep-detail-data"><dt>Ngày thi</dt><dd>{formatExamDate(session.examDate)}</dd><dt>Phòng</dt><dd>{session.roomCode} {session.roomName?`· ${session.roomName}`:''}</dd><dt>Giảng viên</dt><dd>{session.lecturerName||'Chưa phân công'}</dd><dt>Thí sinh</dt><dd>{session.candidateCount}</dd><dt>Trạng thái</dt><dd>{examStatus(session)}</dd></dl><CandidateList item={session}/>
  {session.groups?.length>0&&<p>Lớp học viên: {session.groups.map(g=>g.code||g.name).join(', ')}</p>}
  {session.externalUnitName&&<p>Đơn vị giám thị: {session.externalUnitName}</p>}
  {onCompose&&canWrite&&<button className="sl-btn" disabled={saving} onClick={onCompose}>Xem / sửa buổi thi chung</button>}
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
