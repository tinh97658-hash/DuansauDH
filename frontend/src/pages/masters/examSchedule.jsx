import { ChevronLeftIcon, ChevronRightIcon, MagnifyingGlassIcon, PlusIcon } from "../../components/AppIcons";
import React,{useEffect,useRef,useState} from 'react';
import {listenForBackgroundRefresh} from '../../utils/backgroundRefresh';
import {useSearchParams} from 'react-router-dom';
import axios from 'axios';
import { notify } from '../../utils/notify';
import {Tooltip} from '@mui/material';
import YearSelect from '../../features/scheduling/YearSelect';
import ScheduleHeader from '../../features/scheduling/ScheduleHeader';
import FeatureLayout from '../../components/FeatureLayout';
import PendingConfirmationButton from '../../features/scheduling/PendingConfirmationButton';
import DocumentExportMenu from '../../components/DocumentExportMenu';
import {buildExamScheduleDocument} from '../../features/exams/examScheduleExport';
import {createScheduleExcel,createScheduleWord,downloadScheduleFile,exportSchedule} from '../../features/scheduling/scheduleExport';
import {usePermissions} from '../../features/accounts/usePermissions';
import {API_BASE_URL} from '../../config/http';
import {addDays,formatDateKey,getBusinessTodayKey,mondayOf} from '../../utils/schedulingCalendar';
import {notifyGradebookSaved} from '../../utils/gradebookRevision';
import {examPeriods,examSessionsForPeriod,formatExamDate} from '../../features/exams/examCalendar';
import {examCardStatus,examOfferingLabel,examStatus,matchesExam,uniqueOptions} from '../../features/exams/examPlanner';
import {ExamEditor,ExamListTable,ExamPendingCards,ExamReasonDialog} from '../../features/exams/ExamPlannerDialogs';
import ExamArrangementEditor from '../../features/exams/ExamArrangementEditor';
import ExamSessionDialog from '../../features/exams/ExamSessionDialog';
import {collectExamArrangements} from '../../features/exams/examArrangement';
import {isExamPeriodClosed,nextExamSlot,useExamWallTime} from '../../features/exams/examPeriodAvailability';
import {Modal,SearchSelect} from '../../features/scheduling/shared';
import '../../features/scheduling/reference.css';
import '../../features/scheduling/workspace.css';
import '../../features/exams/examSchedule.css';

const errorText=e=>{const message=e.response?.data?.message;return Array.isArray(message)?message.join(' '):message||'Không thể xử lý lịch thi. Hãy thử lại.';};
export default function ExamSchedule(){
 const {can}=usePermissions(),canWrite=can('exams.write'),canView=can('exams.view');const [params]=useSearchParams();
 const [week,setWeek]=useState(()=>formatDateKey(mondayOf(getBusinessTodayKey()))),[revision,setRevision]=useState(0);
 const [data,setData]=useState({queue:[],approvedOfferings:[],sessions:[],rooms:[]}),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const [loadError,setLoadError]=useState('');
 const [hasLoaded,setHasLoaded]=useState(false);
 const [filters,setFilters]=useState({discipline:'',major:'',year:'',search:''});
 const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
 const [selectedIds,setSelectedIds]=useState(()=>params.get('offeringId')?[params.get('offeringId')]:[]);
 const [mergeMode,setMergeMode]=useState(false);
 const [detail,setDetail]=useState(null),[editor,setEditor]=useState(null),[aggregate,setAggregate]=useState(null),[reason,setReason]=useState(null),[pendingOpen,setPendingOpen]=useState(false);
 const wallTime=useExamWallTime(),last=formatDateKey(addDays(week,6)),today=wallTime.slice(0,10);
 const requestState=useRef({inFlight:false,at:0});
 useEffect(()=>{if(!canView)return;
  return listenForBackgroundRefresh(()=>setRevision(n=>n+1),{interval:60000,minInterval:60000,
   canRefresh:()=>!saving&&!requestState.current.inFlight&&Date.now()-requestState.current.at>=60000});
 },[canView,saving]);
 useEffect(()=>{if(!canView){setLoading(false);return;}let active=true;setLoading(true);setError('');setLoadError('');
  const controller=new AbortController();requestState.current={inFlight:true,at:Date.now()};
  axios.get(`${API_BASE_URL}/masters/exam-schedule`,{params:{from:week,to:last},withCredentials:true,signal:controller.signal}).then(({data:next})=>{if(active){setData(next);setHasLoaded(true);}}).catch(e=>{if(active){const message=errorText(e);setError(message);setLoadError(message);}}).finally(()=>{if(active){requestState.current.inFlight=false;setLoading(false);}});return()=>{active=false;controller.abort();};
 },[week,last,revision,canView]);
 // Historical sessions retain academic context even when their old snapshot is no longer current.
 const offerings=[...new Map([...data.sessions.map(s=>({...s,id:s.courseOfferingId})),...(data.approvedOfferings||[])].map(o=>[o.id,o])).values()];
 const groups=offerings.flatMap(o=>o.groups||[]),disciplines=uniqueOptions(groups,'disciplineId','disciplineName');
 const majors=uniqueOptions(groups.filter(g=>!filters.discipline||g.disciplineId===filters.discipline),'majorId','majorName');
 const years=[...new Set(groups.filter(g=>(!filters.discipline||g.disciplineId===filters.discipline)&&(!filters.major||g.majorId===filters.major)).map(g=>g.academicYear).filter(Boolean))].sort().reverse();
 const matching=o=>matchesExam(o,filters);
 const context=s=>({...offerings.find(o=>o.id===s.courseOfferingId),...s});
 const filteredSessions=data.sessions.filter(s=>matching(context(s)));
 const sessions=collectExamArrangements(data.sessions).filter(s=>s.isArrangement?s.members.some(g=>matching(context(g))):matching(context(s)));
 const printSchedule=()=>buildExamScheduleDocument({week,end:last,sessions:filteredSessions.map(context)});
 const downloadExport=async(format)=>{const snapshot=printSchedule();downloadScheduleFile(await (format==='docx'?createScheduleWord(snapshot):createScheduleExcel(snapshot)),`lich-thi-${week}-${last}.${format}`);};
 const queue=data.queue.filter(matching);
 const pending=filteredSessions.filter(s=>s.pendingConfirmation);
 const selectedOfferings=data.queue.filter(o=>selectedIds.includes(o.id)),selected=selectedOfferings[0];
 const selectedCandidates=new Set(selectedOfferings.flatMap(o=>o.candidateKeys||o.candidateIds||o.candidates?.map(c=>c.participantId)||[]));
 const selectedCount=selectedCandidates.size||selectedOfferings.reduce((sum,o)=>sum+Number(o.candidateCount||0),0);
 useEffect(()=>{if(hasLoaded)setSelectedIds(ids=>ids.filter(id=>data.queue.some(o=>o.id===id)));},[data.queue,hasLoaded]);
 const clearSelection=()=>{setSelectedIds([]);setMergeMode(false);};
 const toggleOffering=(id,merge=false)=>{if(!canView||loading||saving)return;setSelectedIds(ids=>ids.includes(id)?ids.filter(value=>value!==id):[...ids,id]);if(merge)setMergeMode(true);setError('');};
 const changeFilter=(key,value)=>{setFilters(current=>({...current,[key]:value,...(key==='discipline'?{major:'',year:''}:key==='major'?{year:''}:{})}));};
 const openDetail=session=>{setAggregate(null);setPendingOpen(false);setDetail(session);setError('');};
 const mutate=async(action,target,note='',form,refreshAvailability,keepDetail=false)=>{if(!canWrite||saving)return false;setSaving(true);setError('');
  try{const base=`${API_BASE_URL}/masters/exam-sessions`,options={withCredentials:true};
   if(action==='save'){
    const offering=editor?.offering||offerings.find(o=>o.id===target?.courseOfferingId),payload={...form,courseOfferingId:offering.id,snapshotId:target?.snapshotId||offering.snapshotId,eligibilityVersion:offering.eligibilityVersion,...(target?{version:target.version}:{})};
    if(target)await axios.put(`${base}/${target.id}`,payload,options);else await axios.post(base,payload,options);
   }else await axios.post(`${base}/${target.id}/${action==='cancel'?'cancel':'confirm'}`,{version:target.version,note,...(action==='cancel'?{}:{status:action})},options);
   setEditor(null);
   if(action==='held'){setPendingOpen(false);setAggregate(null);setDetail({...target,attendanceSessionId:target.id});}
   else if(!keepDetail)setDetail(null);
   setReason(null);clearSelection();setRevision(n=>n+1);notifyGradebookSaved();return true;
  }catch(e){notify.error(errorText(e));refreshAvailability?.();return false;}finally{setSaving(false);}
 };
 const close=setter=>()=>{if(!saving){setter(null);setError('');}};
 const compose=(session,initial={})=>{if(!canWrite||session?.canEdit===false)return;const members=session?data.sessions.filter(s=>(s.arrangementId||s.id)===(session.arrangementId||session.id)):[];setDetail(null);setError('');setEditor({mode:'arrangement',members,initial:{...(!session?nextExamSlot():{}),...initial}});};
 const openEditor=(session,slot)=>{if(session?.canEdit===false)return;if(!session&&slot&&isExamPeriodClosed(slot.date,slot.period))return;if(!session&&slot&&selected&&(mergeMode||selectedOfferings.length>1)){compose(null,{examDate:slot.date,startTime:slot.start,endTime:undefined,offerings:selectedOfferings});return;}if(session?.arrangementId&&(session.externalInvigilatorName||data.sessions.filter(s=>s.arrangementId===session.arrangementId).length>1)){compose(session);return;}const offering=offerings.find(o=>o.id===(session?.courseOfferingId||selected?.id));if(!offering||!canWrite||(session?.examDate||slot?.date)<getBusinessTodayKey())return;setDetail(null);setError('');setEditor({session,slot,offering});};
 const saveArrangement=async(form,id,refresh,keepDetail=false)=>{if(!canWrite||saving)return false;setSaving(true);setError('');try{
  const url=`${API_BASE_URL}/masters/exam-arrangements`,options={withCredentials:true};
  if(id)await axios.put(`${url}/${id}`,form,options);else await axios.post(url,form,options);
  if(keepDetail&&form.examDate)setWeek(formatDateKey(mondayOf(form.examDate)));
  setEditor(null);if(!keepDetail)setDetail(null);clearSelection();setRevision(n=>n+1);notifyGradebookSaved();return true;
 }catch(e){notify.error(errorText(e));refresh?.();return false;}finally{setSaving(false);}};
 const detailMembers=detail?data.sessions.filter(s=>detail.arrangementId?s.arrangementId===detail.arrangementId:s.id===detail.id):[];
 const saveAttendance=async(session,participantId,status)=>{
  if(!canWrite||saving||loading)return;
  setSaving(true);setError('');
  try{
   const {data:updated}=await axios.put(`${API_BASE_URL}/masters/exam-sessions/${session.id}/attendance`,{version:session.version,participantId,status},{withCredentials:true});
   setData(current=>({...current,sessions:current.sessions.map(row=>({...row,
    ...(row.arrangementId===updated.arrangementId?{arrangementVersion:updated.arrangementVersion}:{}),
    ...(row.id===session.id?{version:updated.version,candidates:(row.candidates||[]).map(candidate=>candidate.participantId===participantId?{...candidate,attendanceStatus:updated.status}:candidate)}:{})
   }))}));
   setRevision(n=>n+1);notifyGradebookSaved();
  }catch(failure){const message=errorText(failure);setError(message);notify.error(message);if(failure.response?.status===409)setRevision(n=>n+1);}
  finally{setSaving(false);}
 };
 const confirmAttendance=async session=>{
  if(!canWrite||saving||loading||session.status!=='held'||!session.canConfirmAttendance)return false;
  setSaving(true);setError('');
  try{
   const {data:updated}=await axios.post(`${API_BASE_URL}/masters/exam-sessions/${session.id}/attendance/confirm`,{version:session.version},{withCredentials:true});
   setData(current=>({...current,sessions:current.sessions.map(row=>({...row,
    ...(row.arrangementId===updated.arrangementId?{arrangementVersion:updated.arrangementVersion}:{}),
    ...(row.id===session.id?{version:updated.version,attendanceConfirmedAt:updated.attendanceConfirmedAt,canRecordAttendance:false,canConfirmAttendance:false}:{})
   }))}));
   setDetail(current=>current?.attendanceSessionId===session.id?{...current,attendanceSessionId:null}:current);
   setRevision(n=>n+1);notifyGradebookSaved();return true;
  }catch(failure){const message=errorText(failure);setError(message);notify.error(message);if(failure.response?.status===409)setRevision(n=>n+1);return false;}
  finally{setSaving(false);}
 };
 if(!canView)return <FeatureLayout title="Xếp lịch thi"><div role="alert">Bạn không có quyền xem lịch thi.</div></FeatureLayout>;
 return <FeatureLayout title="Xếp lịch thi" maxWidth={1920} hideHeader workspaceMode contentPadding={0}><div className="scheduling-v20 v20-workspace v20-schedule-workspace">
  <section className={`sl-workspace sl-schedule-view exam-planner${sidebarCollapsed?' sl-sidebar-collapsed':''}`} aria-label="Không gian xếp lịch thi">
   <aside className="sl-left" aria-label="Phạm vi làm việc" data-collapsed={sidebarCollapsed}><button type="button" className="sl-sidebar-toggle" aria-label={sidebarCollapsed?'Mở phạm vi làm việc':'Thu gọn phạm vi làm việc'} aria-expanded={!sidebarCollapsed} onClick={()=>setSidebarCollapsed(value=>!value)}>{sidebarCollapsed ? <ChevronRightIcon fontSize="inherit" /> : <ChevronLeftIcon fontSize="inherit" />}</button><div className="sl-sidebar-content">
    <div className="sl-scope"><div className="sl-eyebrow">PHẠM VI LÀM VIỆC</div><div className="sl-schedule-scope-fields">
     <div className="sl-schedule-scope-field"><div className="v20-scope-step"><b>1</b>NGÀNH</div><SearchSelect label="Ngành" value={filters.discipline} placeholder="Tất cả ngành" options={[{id:'',name:'Tất cả ngành'},...disciplines]} onChange={value=>changeFilter('discipline',value)}/></div>
     <div className="sl-schedule-scope-field"><div className="v20-scope-step"><b>2</b>CHUYÊN NGÀNH</div><SearchSelect label="Chuyên ngành" value={filters.major} placeholder="Tất cả chuyên ngành" options={[{id:'',name:'Tất cả chuyên ngành'},...majors]} onChange={value=>changeFilter('major',value)}/></div>
     <div className="sl-schedule-scope-field"><div className="v20-scope-step"><b>3</b>KHÓA / NĂM HỌC</div><YearSelect className={`sl-select sl-year-select${filters.year?'':' sl-placeholder'}`} label="Khóa / năm học" value={filters.year} years={years} onChange={value=>changeFilter('year',value)}/></div>
    </div></div>
    <div className="sl-worklist"><div className="sl-search-wrap"><span aria-hidden="true"><MagnifyingGlassIcon fontSize="inherit" /></span><input className="sl-search" aria-label="Tìm kiếm" placeholder="Tìm lớp học phần..." value={filters.search} onChange={e=>changeFilter('search',e.target.value)}/></div>
     <div className="sl-card-scroll"><aside className="sl-section ep-queue" aria-label="Chưa xếp lịch"><h2><span>CHƯA XẾP LỊCH</span><b>{queue.length}</b></h2>
      {loading?<p role="status">Đang tải lịch thi…</p>:!queue.length&&<p>Không có danh sách cần xếp thi trong phạm vi này.</p>}
      {canWrite&&<p className="ep-selection-help">{mergeMode?'Tích chọn các lớp cần ghép, rồi chọn ô Sáng / Chiều trên lịch.':'Tích chọn nhiều lớp để ghép thi, hoặc bấm tên lớp để xếp riêng.'}</p>}
      {queue.map(o=><div key={o.id} className={`ep-queue-card${selectedIds.includes(o.id)?' ep-active':''}`}>
       {canWrite&&<input type="checkbox" aria-label={`Chọn lớp ${o.name} · ${o.subjectName}`} checked={selectedIds.includes(o.id)} disabled={loading||saving} onChange={()=>toggleOffering(o.id,true)} />}
       <button type="button" className="ep-queue-select" disabled={loading||saving} aria-label={`${o.name} ${o.candidateCount} TS ${o.subjectName}${o.makeupCount?' · Thi bù':''}`} aria-pressed={selectedIds.includes(o.id)} onClick={()=>toggleOffering(o.id)}><strong title={o.name}>{examOfferingLabel(o)}</strong><b>{o.candidateCount} TS</b><span>{o.subjectName}</span>{o.makeupCount>0&&<small className="ep-makeup-badge">Thi bù · {o.makeupCount} học viên</small>}</button>
      </div>)}
     </aside></div>
    </div>
   </div></aside>
   <section className="sl-right ep-calendar" aria-label="Lịch thi tuần">
    <ScheduleHeader><div className="ep-heading-actions"><h1>XẾP LỊCH THI</h1><div className="sl-actions"><DocumentExportMenu className="sl-btn sl-export-trigger" disabled={loading||saving||!!error} onWord={()=>downloadExport('docx')} onExcel={()=>downloadExport('xlsx')} onPdf={()=>exportSchedule(printSchedule())} onError={e=>setError(e.message||'Không thể xuất lịch thi.')}/></div></div><nav className="sl-week ep-week-navigation" aria-label="Chuyển tuần lịch thi"><button aria-label="Tuần trước" onClick={()=>setWeek(formatDateKey(addDays(week,-7)))}><ChevronLeftIcon fontSize="inherit" /></button><strong>{formatExamDate(week)} – {formatExamDate(last)}</strong><button aria-label="Tuần sau" onClick={()=>setWeek(formatDateKey(addDays(week,7)))}><ChevronRightIcon fontSize="inherit" /></button></nav><div className="sl-actions"><button className="sl-btn sl-today" onClick={()=>setWeek(formatDateKey(mondayOf(getBusinessTodayKey())))}>Tuần này</button><PendingConfirmationButton showIcon={false} count={hasLoaded?pending.length:undefined} loading={loading} error={loadError} open={pendingOpen} controls="exam-pending-dialog" onClick={()=>setPendingOpen(true)} /></div></ScheduleHeader>

    {!!selectedOfferings.length&&<div className="sl-selected-strip ep-selection-strip" aria-label="Các lớp đang chọn">
     <span className="sl-selected-tag">{mergeMode||selectedOfferings.length>1?'ĐANG GHÉP':'ĐANG XẾP'}</span>
     <div className="ep-selected-classes">{selectedOfferings.map(o=><span className="ep-selected-class" key={o.id}><span title={o.subjectName}>{examOfferingLabel(o)}</span><button type="button" aria-label={`Bỏ chọn lớp ${o.name} · ${o.subjectName}`} disabled={saving} onClick={()=>toggleOffering(o.id)}>Bỏ</button></span>)}</div>
     <span className="sl-selected-meta">{selectedOfferings.length} lớp · {selectedCount} thí sinh</span>
     <button className="sl-btn sl-selected-clear" disabled={saving} onClick={clearSelection}>Bỏ chọn tất cả</button>
    </div>}
    {error&&!editor&&!reason&&<div role="alert" className="v20-error">{error}</div>}{!canWrite&&<div className="v20-hint">Chế độ chỉ xem — cần quyền “Xếp, sửa và xác nhận lịch thi” để thay đổi ca thi.</div>}
    <div className="sl-calendar-wrap ep-calendar-scroll"><div className="sl-calendar ep-period-calendar" role="table" aria-label="Lịch thi theo tuần"><div className="sl-corner">BUỔI</div>
     {Array.from({length:7},(_,i)=>{const date=formatDateKey(addDays(week,i)),isToday=date===today;return <div className={`sl-day${isToday?' sl-is-today':''}`} key={date} aria-current={isToday?'date':undefined}><strong>{['T2','T3','T4','T5','T6','T7','CN'][i]}</strong><span>{formatExamDate(date,true)}</span>{isToday&&<i className="sl-today-indicator" aria-label="Hôm nay" title="Hôm nay"/>}</div>;})}
     {examPeriods.map(period=><React.Fragment key={period.id}><div className="sl-period"><span>{period.label}</span></div>{Array.from({length:7},(_,i)=>{
      const date=formatDateKey(addDays(week,i)),closed=isExamPeriodClosed(date,period.id,wallTime),items=examSessionsForPeriod(sessions,date,period.id);
      const showList=()=>setAggregate({date,periodLabel:period.label,sessions:items});
      return <div className="sl-slot ep-period-slot" key={date}>
       <button className="ep-period-target" aria-label={`${selected?'Chọn':'Xem ca thi'} ${formatExamDate(date)} ${period.label==='SÁNG'?'Sáng':'Chiều'}`} disabled={saving||(!selected&&!items.length)||!!selected&&(!canWrite||closed)} onClick={()=>selected?openEditor(null,{date,start:period.start,end:period.end,period:period.id}):showList()}/>
       <div className="ep-period-items">{items.slice(0,3).map(s=><Tooltip key={s.id} arrow placement="right" title={<div className="ep-exam-preview"><strong>{s.subjectName}</strong><span>{formatExamDate(s.examDate)} · {s.startTime.slice(0,5)}–{s.endTime.slice(0,5)}</span><span>Phòng {s.roomCode} · {s.candidateCount} thí sinh</span><small>{examCardStatus(s)}</small></div>}><button className={`ep-event ep-${s.pendingConfirmation?'pending':s.status}`} aria-label={`${s.name} ${s.subjectName} ${formatExamDate(s.examDate)} ${s.startTime.slice(0,5)} ${examStatus(s)}`} onClick={()=>openDetail(s)}><strong>{examOfferingLabel(s)}</strong><span className="ep-event-location">{s.roomCode} · {s.candidateCount} TS</span>{s.makeupCount>0&&<small className="ep-makeup-badge">Thi bù · {s.makeupCount} HV</small>}{(s.pendingConfirmation||['held','not_held','cancelled'].includes(s.status))&&<small>{examCardStatus(s)}</small>}</button></Tooltip>)}
       {items.length>3&&<Tooltip arrow placement="right" title={<div className="ep-overflow-preview"><strong>{items.length-3} CA KHÁC</strong>{items.slice(3).map(s=><p key={s.id}>{examOfferingLabel(s)} · {s.roomCode} · {s.candidateCount} TS</p>)}</div>}><button className="ep-more" onClick={showList}>+{items.length-3} ca khác</button></Tooltip>}
       {selected&&!closed&&<button className="v20-add-slot" onClick={()=>openEditor(null,{date,start:period.start,end:period.end,period:period.id})} disabled={!canWrite||saving}><PlusIcon fontSize="inherit" /> Xếp lịch</button>}
       </div>
      </div>;
     })}</React.Fragment>)}
    </div>
    </div>
   </section>
  </section>
  {editor&&(editor.mode==='arrangement'?<ExamArrangementEditor initial={editor.initial} members={editor.members} queue={data.queue} rooms={data.rooms} lecturers={data.lecturers} units={data.units} canWrite={canWrite} saving={saving} error={error} onClose={close(setEditor)} onSave={saveArrangement}/>:<ExamEditor session={editor.session} offering={editor.offering} slot={editor.slot} rooms={data.rooms} lecturers={data.lecturers} units={data.units} canWrite={canWrite} saving={saving} error={error} onClose={close(setEditor)} onSave={(form,refresh)=>mutate('save',editor.session,'',form,refresh)}/>)}
  {detail&&<ExamSessionDialog key={detail.arrangementId||detail.id} attendanceSessionId={detail.attendanceSessionId} members={detailMembers} queue={data.queue} rooms={data.rooms} lecturers={data.lecturers} units={data.units}
   canWrite={canWrite} saving={saving} refreshing={loading} error={error} onClose={close(setDetail)} onClearError={()=>setError('')} onAttendanceChange={saveAttendance} onAttendanceConfirm={confirmAttendance}
   onSaveArrangement={(form,id,retry)=>saveArrangement(form,id,retry,true)}
   onSaveSession={(session,form,retry)=>mutate('save',session,'',form,retry,true)}
   onAction={(action,session,note)=>mutate(action,session,note,undefined,undefined,true)}/>}
  {aggregate&&<Modal wide className="ep-list-dialog" title={`CÁC CA THI · ${formatExamDate(aggregate.date)} · ${aggregate.periodLabel}`} onClose={close(setAggregate)} actions={<button className="sl-btn" onClick={close(setAggregate)}>Đóng</button>}><ExamListTable sessions={aggregate.sessions} onSelect={openDetail}/></Modal>}
  {pendingOpen&&<Modal id="exam-pending-dialog" wide className="sl-pending-drawer ep-pending-dialog" bodyClassName="sl-pending-body" title={`CA THI CHỜ XÁC NHẬN · ${pending.length}`} busy={saving} onClose={()=>{if(!saving)setPendingOpen(false);}}>
   {error&&!reason&&<div role="alert" className="v20-error">{error}</div>}{pending.length?<ExamPendingCards sessions={pending} onSelect={openDetail} canWrite={canWrite} saving={saving} onHeld={s=>mutate('held',s)} onNotHeld={s=>{setError('');setReason({action:'not_held',session:s});}}/>:<p>Không có ca thi chờ xác nhận.</p>}
  </Modal>}
  {reason&&<ExamReasonDialog key={`${reason.action}:${reason.session.id}`} {...reason} saving={saving} error={error} onClose={close(setReason)} onConfirm={note=>mutate(reason.action,reason.session,note)}/>}
 </div></FeatureLayout>;
}
