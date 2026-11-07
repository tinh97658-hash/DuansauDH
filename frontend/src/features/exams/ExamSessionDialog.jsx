import {examInvigilatorName} from './examInvigilators';
import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {UsersIcon,TableCellsIcon,CheckCircleIcon,XCircleIcon,TrashIcon} from '../../components/AppIcons';
import {Modal} from '../scheduling/shared';
import {formatExamDate} from './examCalendar';
import {examStatus} from './examPlanner';
import {activeExamGroup,examGroupsPeak} from './examArrangement';
import ExamArrangementEditor from './ExamArrangementEditor';
import ExamLearnerClasses from './ExamLearnerClasses';
import ExamCandidatesTable from './ExamCandidatesTable';
import {ExamEditor,ExamReasonDialog} from './ExamPlannerDialogs';

export default function ExamSessionDialog({members,queue,rooms,lecturers,units,canWrite,saving,refreshing,error,attendanceSessionId,onClose,onClearError,onSaveArrangement,onSaveSession,onAction,onAttendanceChange,onAttendanceConfirm}){
 const [mode,setMode]=useState(null),[expanded,setExpanded]=useState(()=>attendanceSessionId?[attendanceSessionId]:[]);
 useEffect(()=>{
  if(!attendanceSessionId)return;
  setExpanded(ids=>ids.includes(attendanceSessionId)?ids:[...ids,attendanceSessionId]);
  const timer=setTimeout(()=>document.getElementById(`exam-candidates-${attendanceSessionId}`)?.scrollIntoView?.({block:'nearest'}),0);
  return()=>clearTimeout(timer);
 },[attendanceSessionId]);
 const sorted=[...members].sort((a,b)=>(a.roundNo||1)-(b.roundNo||1)||a.startTime.localeCompare(b.startTime)||(a.name||'').localeCompare(b.name||'','vi'));
 const active=sorted.filter(activeExamGroup),display=active.length?active:sorted,seed=display[0];
 if(!seed)return null;
 const busy=saving||refreshing,arrangement=!!seed.arrangementId;
 const editable=g=>g.status==='scheduled'&&g.canEdit!==false&&!g.pendingConfirmation;
 const canEdit=canWrite&&active.some(editable);
 const changeMode=next=>{onClearError();setMode(next);};
 const saved=async save=>{if(await save())setMode(null);};
 const confirmCandidates=async session=>{
  if(await onAttendanceConfirm?.(session))setExpanded(ids=>ids.filter(id=>id!==session.id));
 };
 const rowAction=(action,target)=>{if(action==='held')onAction(action,target);else changeMode({action,target});};
 const beginEdit=()=>changeMode({action:'edit',members});
 // Preserve the versions the user started editing, even if the calendar refreshes in the background.
 const editSeed=mode?.action==='edit'?(mode.members.find(activeExamGroup)||mode.members[0]):seed;
 const start=display.map(g=>g.startTime).sort()[0],end=display.map(g=>g.endTime).sort().at(-1);
 const classes=new Set(active.flatMap(g=>(g.groups||[]).map(c=>c.id)));
 return <Modal wide className="ep-arrangement-dialog ep-unified-dialog" title="CHI TIẾT BUỔI THI" busy={saving} onClose={onClose}
  actions={!mode&&<button className="sl-btn" disabled={saving} onClick={onClose}>Đóng</button>}>
  {mode?.action==='edit'?(arrangement?<ExamArrangementEditor embedded members={mode.members} queue={queue} rooms={rooms} lecturers={lecturers} units={units} canWrite={canWrite} saving={saving} error={error}
    onClose={()=>changeMode(null)} onSave={(form,id,retry)=>saved(()=>onSaveArrangement(form,id,retry))}/>
   :<ExamEditor embedded session={editSeed} offering={{...editSeed,id:editSeed.courseOfferingId}} rooms={rooms} lecturers={lecturers} units={units} canWrite={canWrite} saving={saving} error={error}
    onClose={()=>changeMode(null)} onSave={(form,retry)=>saved(()=>onSaveSession(editSeed,form,retry))}/>)
   :mode?<ExamReasonDialog embedded key={`${mode.action}:${mode.target.id}`} action={mode.action} session={mode.target} saving={saving} error={error}
     onClose={()=>changeMode(null)} onConfirm={note=>saved(()=>onAction(mode.action,mode.target,note))}/>
   :<>
    {error&&<div className="v20-error" role="alert">{error}</div>}
    <div className="ep-session-toolbar"><strong>Thông tin buổi thi</strong>{canEdit&&<button className="sl-btn sl-btn-primary" disabled={busy} onClick={beginEdit}>Chỉnh sửa buổi thi</button>}</div>
    <dl className="ep-session-summary">
     <div><dt>Ngày thi</dt><dd>{formatExamDate(seed.examDate)}</dd></div>
     <div><dt>Buổi / Giờ thi</dt><dd>{start<'13:00'?'Sáng':'Chiều'} · {start.slice(0,5)}–{end.slice(0,5)}</dd></div>
     <div><dt>Phòng thi</dt><dd>{seed.roomCode}{seed.roomName?` · ${seed.roomName}`:''}</dd></div>
     <div><dt>Cán bộ coi thi 1</dt><dd>{examInvigilatorName(seed)||'Chưa phân công'}{seed.externalUnitName&&<small>{seed.externalUnitName}</small>}</dd></div>
     <div><dt>Cán bộ coi thi 2</dt><dd>{examInvigilatorName(seed,true)||'Chưa phân công'}{seed.secondExternalUnitName&&<small>{seed.secondExternalUnitName}</small>}</dd></div>
    </dl>
    <p className="ep-session-counts">{new Set(active.map(g=>g.roundNo||1)).size} đợt · {classes.size} lớp · {active.length} nhóm có hiệu lực · Tối đa {examGroupsPeak(active)} thí sinh đồng thời</p>
    <div className="ep-round-table"><table className="v20-table ep-session-detail-table" aria-label="Các học phần trong buổi thi">
     <colgroup>
      <col className="ep-session-round-column"/><col className="ep-session-time-column"/>
      <col className="ep-session-classes-column"/><col/>
      <col className="ep-session-count-column"/><col className="ep-session-status-column"/>
      <col className="ep-session-actions-column"/>
     </colgroup>
     <thead><tr><th>Đợt</th><th>Giờ thi</th><th>Lớp học viên</th><th>Học phần</th><th>Thí sinh</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
     <tbody>{sorted.map(g=>{
      const open=expanded.includes(g.id),detailId=`exam-candidates-${g.id}`;
      return <React.Fragment key={g.id}><tr className={activeExamGroup(g)?'':'ep-session-history'}>
       <td>{g.roundNo||1}</td><td>{g.startTime.slice(0,5)}–{g.endTime.slice(0,5)}</td>
       <td><ExamLearnerClasses groups={g.groups}/></td>
       <td title={g.note?`Ghi chú: ${g.note}`:undefined}>{g.subjectName||'—'}{g.makeupCount>0&&<span className="ep-makeup-badge">{g.makeupCount} thi bù</span>}</td><td>{g.candidateCount}</td><td>{examStatus(g)}</td>
       <td><div className="ep-session-row-actions">
        <div className="ep-session-view-actions">
        <button className="sl-btn app-icon-action ep-icon-action" title="Danh sách thí sinh" aria-label={`Danh sách thí sinh ${g.subjectName} · ${g.name}`} aria-expanded={open} aria-controls={detailId} onClick={()=>setExpanded(ids=>open?ids.filter(id=>id!==g.id):[...ids,g.id])}><UsersIcon/></button>
        <Link className="sl-btn app-icon-action ep-icon-action" title="Mở bảng điểm" aria-label="Mở bảng điểm" to={`/masters/exam-lists?offeringId=${g.courseOfferingId}&groupId=${g.classGroupId||g.groups?.[0]?.id||''}`}><TableCellsIcon/></Link>
        </div>
        {canWrite&&editable(g)&&<button className="sl-btn sl-btn-danger app-icon-action ep-icon-action ep-icon-action-danger" title="Hủy lịch thi" disabled={busy} aria-label={`Hủy lịch ${g.subjectName} · ${g.name}`} onClick={()=>rowAction('cancel',g)}><TrashIcon/></button>}
        {canWrite&&g.pendingConfirmation&&<><button className="sl-btn app-icon-action ep-icon-action ep-icon-action-success" title="Xác nhận đã diễn ra" aria-label="Đã diễn ra" disabled={busy} onClick={()=>rowAction('held',g)}><CheckCircleIcon/></button><button className="sl-btn app-icon-action ep-icon-action ep-icon-action-warning" title="Xác nhận không diễn ra" aria-label="Không diễn ra" disabled={busy} onClick={()=>rowAction('not_held',g)}><XCircleIcon/></button></>}
       </div></td>
      </tr>{open&&<tr><td colSpan={7} className="ep-session-candidate-cell"><section id={detailId} aria-label={`Thí sinh ${g.subjectName} · ${g.name}`}>
       <h3>Danh sách thí sinh · {g.subjectName} ({g.candidateCount})</h3>
       <ExamCandidatesTable session={g} canWrite={canWrite} busy={busy} showAttendance={g.status==='held'} onAttendanceChange={onAttendanceChange} onAttendanceConfirm={confirmCandidates}/>
      </section></td></tr>}</React.Fragment>;
     })}</tbody>
    </table></div>
    {seed.arrangementNote&&<p>Ghi chú chung: {seed.arrangementNote}</p>}
   </>}
 </Modal>;
}
