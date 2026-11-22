import { CheckIcon } from "../../components/AppIcons";
import React,{useState} from 'react';
import {formatExamDate} from './examCalendar';
import ExamDialogLayout from './ExamDialogLayout';

const timeRange=s=>`${s.startTime.slice(0,5)}–${s.endTime.slice(0,5)}`;
export function ExamPendingCards({sessions,onSelect,canWrite,saving,onHeld,onNotHeld}){
 return [...sessions].sort((a,b)=>`${a.examDate} ${a.startTime}`.localeCompare(`${b.examDate} ${b.startTime}`)).map(s=><article className="sl-pending-card" key={s.id}>
  <div className="sl-pending-date"><strong>{formatExamDate(s.examDate)}</strong><span>{timeRange(s)}</span></div>
  <div className="sl-pending-copy"><h3 title={s.name}><button className="ep-pending-title" onClick={()=>onSelect(s)}>{s.name}</button></h3><span title={s.subjectName}>{s.subjectName}</span></div>
  <div className="sl-pending-side"><small title={`Phòng ${s.roomCode} · ${s.candidateCount} thí sinh`}>Phòng {s.roomCode} · {s.candidateCount} TS</small><div className="sl-pending-actions"><button className="sl-btn" disabled={!canWrite||saving||!!s.attendanceConfirmedAt} onClick={()=>onNotHeld(s)}>Không diễn ra</button><button className="sl-btn sl-btn-primary" disabled={!canWrite||saving||!!s.attendanceConfirmedAt} onClick={()=>onHeld(s)}><CheckIcon fontSize="inherit" /> Đã diễn ra</button></div></div>
 </article>);
}
export function ExamReasonDialog({action,session,saving,error,onClose,onConfirm,embedded=false}){
 const [note,setNote]=useState(''),cancel=action==='cancel';
 return <ExamDialogLayout embedded={embedded} title={cancel?'HỦY LỊCH THI':'KHÔNG DIỄN RA'} className="ep-reason" busy={saving} onClose={onClose} actions={<><button className="sl-btn" disabled={saving} onClick={onClose}>Quay lại</button><button className={`sl-btn ${cancel?'sl-btn-danger':'sl-btn-primary'}`} disabled={saving||!note.trim()} onClick={()=>onConfirm(note)}>{cancel?'Hủy lịch':'Xác nhận không diễn ra'}</button></>}>
  {embedded&&<h3>{cancel?'Hủy lịch thi':'Xác nhận không diễn ra'}</h3>}
  <p>{session.name}{embedded&&session.subjectName?` · ${session.subjectName}`:''} · {formatExamDate(session.examDate)} · {timeRange(session)}</p>{error&&<div role="alert" className="v20-error">{error}</div>}
  <label className="v20-field">{cancel?'Lý do hủy *':'Lý do không diễn ra *'}<textarea autoFocus aria-label={cancel?'Lý do hủy':'Lý do không diễn ra'} required maxLength={2000} value={note} disabled={saving} onChange={e=>setNote(e.target.value)}/></label>
 </ExamDialogLayout>;
}
export function ExamListTable({sessions,onSelect,confirmation,canWrite,saving,onHeld,onNotHeld}){
 return <table className="v20-table ep-session-table"><thead><tr><th>Ngày / giờ</th><th>Lớp học phần</th><th>Học phần</th><th>Phòng</th><th>Thí sinh</th>{confirmation&&<th>Xác nhận</th>}</tr></thead><tbody>{sessions.map(s=><tr key={s.id} tabIndex={confirmation?undefined:0} onClick={confirmation?undefined:()=>onSelect(s)} onKeyDown={confirmation?undefined:e=>{if(e.target===e.currentTarget&&['Enter',' '].includes(e.key)){e.preventDefault();onSelect(s);}}}><td>{formatExamDate(s.examDate)}<small>{timeRange(s)}</small></td><td><button className="sl-btn sl-btn-link" onClick={e=>{e.stopPropagation();onSelect(s);}}>{s.name}</button></td><td>{s.subjectName}</td><td>{s.roomCode}</td><td>{s.candidateCount}</td>{confirmation&&<td><div className="sl-pending-actions"><button className="sl-btn" disabled={!canWrite||saving||!!s.attendanceConfirmedAt} onClick={()=>onNotHeld(s)}>Không diễn ra</button><button className="sl-btn sl-btn-primary" disabled={!canWrite||saving||!!s.attendanceConfirmedAt} onClick={()=>onHeld(s)}><CheckIcon fontSize="inherit" /> Đã diễn ra</button></div></td>}</tr>)}</tbody></table>;
}
