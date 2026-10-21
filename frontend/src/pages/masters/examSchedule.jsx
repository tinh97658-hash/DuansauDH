import React,{useEffect,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import axios from 'axios';
import {Tooltip} from '@mui/material';
import FeatureLayout from '../../components/FeatureLayout';
import {usePermissions} from '../../features/accounts/usePermissions';
import {API_BASE_URL} from '../../config/http';
import {addDays,formatDateKey,getBusinessTodayKey,mondayOf} from '../../utils/schedulingCalendar';
import {notifyGradebookSaved} from '../../utils/gradebookRevision';
import {examPeriods,examSessionsForPeriod,formatExamDate} from '../../features/exams/examCalendar';
import {examCardStatus,examOfferingLabel,examStatus,matchesExam,uniqueOptions} from '../../features/exams/examPlanner';
import {ExamDetail,ExamEditor,ExamListTable,ExamPendingCards,ExamReasonDialog} from '../../features/exams/ExamPlannerDialogs';
import {Modal,SearchSelect} from '../../features/scheduling/shared';
import '../../features/scheduling/reference.css';
import '../../features/scheduling/workspace.css';
import '../../features/exams/examSchedule.css';

const errorText=e=>{const message=e.response?.data?.message;return Array.isArray(message)?message.join(' '):message||'Không thể xử lý lịch thi. Hãy thử lại.';};
export default function ExamSchedule(){
 const {can}=usePermissions(),canWrite=can('scheduling.write'),canView=can('gradebook.view');const [params]=useSearchParams();
 const [week,setWeek]=useState(()=>formatDateKey(mondayOf(getBusinessTodayKey()))),[revision,setRevision]=useState(0);
 const [data,setData]=useState({queue:[],approvedOfferings:[],sessions:[],rooms:[]}),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const [filters,setFilters]=useState({discipline:'',major:'',year:'',search:''});
 const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
 const [offeringId,setOfferingId]=useState(params.get('offeringId')||''),[detail,setDetail]=useState(null),[editor,setEditor]=useState(null),[aggregate,setAggregate]=useState(null),[reason,setReason]=useState(null),[pendingOpen,setPendingOpen]=useState(false);
 const last=formatDateKey(addDays(week,6));
 useEffect(()=>{if(!canView)return;const refresh=()=>{if(document.visibilityState!=='hidden')setRevision(n=>n+1);};
  const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[canView]);
 useEffect(()=>{if(!canView){setLoading(false);return;}let active=true;setLoading(true);setError('');
  axios.get(`${API_BASE_URL}/masters/exam-schedule`,{params:{from:week,to:last},withCredentials:true}).then(({data:next})=>{if(active)setData(next);}).catch(e=>{if(active)setError(errorText(e));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
 },[week,last,revision,canView]);
 // Historical sessions retain academic context even when their old snapshot is no longer current.
 const offerings=[...new Map([...data.sessions.map(s=>({...s,id:s.courseOfferingId})),...(data.approvedOfferings||[])].map(o=>[o.id,o])).values()];
 const groups=offerings.flatMap(o=>o.groups||[]),disciplines=uniqueOptions(groups,'disciplineId','disciplineName');
 const majors=uniqueOptions(groups.filter(g=>!filters.discipline||g.disciplineId===filters.discipline),'majorId','majorName');
 const years=[...new Set(groups.filter(g=>(!filters.discipline||g.disciplineId===filters.discipline)&&(!filters.major||g.majorId===filters.major)).map(g=>g.academicYear).filter(Boolean))].sort().reverse();
 const matching=o=>matchesExam(o,filters);
 const context=s=>({...offerings.find(o=>o.id===s.courseOfferingId),...s});
 const filteredSessions=data.sessions.filter(s=>matching(context(s)));
 const sessions=filteredSessions;
 const queue=data.queue.filter(matching);
 const pending=filteredSessions.filter(s=>s.pendingConfirmation);
 const selected=data.queue.find(o=>o.id===offeringId&&matching(o));
 const changeFilter=(key,value)=>{setFilters(current=>({...current,[key]:value,...(key==='discipline'?{major:'',year:''}:key==='major'?{year:''}:{})}));setOfferingId('');};
 const openDetail=session=>{setAggregate(null);setPendingOpen(false);setDetail(session);setError('');};
 const mutate=async(action,target,note='',form,refreshAvailability)=>{if(!canWrite||saving)return;setSaving(true);setError('');
  try{const base=`${API_BASE_URL}/masters/exam-sessions`,options={withCredentials:true};
   if(action==='save'){
    const offering=editor.offering,payload={...form,courseOfferingId:offering.id,snapshotId:target?.snapshotId||offering.snapshotId,eligibilityVersion:offering.eligibilityVersion,...(target?{version:target.version}:{})};
    if(target)await axios.put(`${base}/${target.id}`,payload,options);else await axios.post(base,payload,options);
   }else await axios.post(`${base}/${target.id}/${action==='cancel'?'cancel':'confirm'}`,{version:target.version,note,...(action==='cancel'?{}:{status:action})},options);
   setEditor(null);setDetail(null);setReason(null);setOfferingId('');setRevision(n=>n+1);notifyGradebookSaved();
  }catch(e){setError(errorText(e));refreshAvailability?.();}finally{setSaving(false);}
 };
 const close=setter=>()=>{if(!saving){setter(null);setError('');}};
 const openEditor=(session,slot)=>{const offering=offerings.find(o=>o.id===(session?.courseOfferingId||offeringId));if(!offering||!canWrite)return;setDetail(null);setError('');setEditor({session,slot,offering});};
 if(!canView)return <FeatureLayout title="Xếp lịch thi"><div role="alert">Bạn không có quyền xem lịch thi.</div></FeatureLayout>;
 return <FeatureLayout title="Xếp lịch thi" maxWidth={1920} hideHeader workspaceMode><div className="scheduling-v20 v20-workspace v20-schedule-workspace">
  <section className={`sl-workspace sl-schedule-view exam-planner${sidebarCollapsed?' sl-sidebar-collapsed':''}`} aria-label="Không gian xếp lịch thi">
   <aside className="sl-left" aria-label="Phạm vi làm việc" data-collapsed={sidebarCollapsed}><button type="button" className="sl-sidebar-toggle" aria-label={sidebarCollapsed?'Mở phạm vi làm việc':'Thu gọn phạm vi làm việc'} aria-expanded={!sidebarCollapsed} onClick={()=>setSidebarCollapsed(value=>!value)}>{sidebarCollapsed?'›':'‹'}</button><div className="sl-sidebar-content">
    <div className="sl-scope"><div className="sl-eyebrow">PHẠM VI LÀM VIỆC</div><div className="sl-schedule-scope-fields">
     <div className="sl-schedule-scope-field"><div className="v20-scope-step"><b>1</b>NGÀNH</div><SearchSelect label="Ngành" value={filters.discipline} placeholder="Tất cả ngành" options={[{id:'',name:'Tất cả ngành'},...disciplines]} onChange={value=>changeFilter('discipline',value)}/></div>
     <div className="sl-schedule-scope-field"><div className="v20-scope-step"><b>2</b>CHUYÊN NGÀNH</div><SearchSelect label="Chuyên ngành" value={filters.major} placeholder="Tất cả chuyên ngành" options={[{id:'',name:'Tất cả chuyên ngành'},...majors]} onChange={value=>changeFilter('major',value)}/></div>
     <div className="sl-schedule-scope-field"><div className="v20-scope-step"><b>3</b>KHÓA / NĂM HỌC</div><select className={`sl-select sl-year-select${filters.year?'':' sl-placeholder'}`} aria-label="Khóa / năm học" value={filters.year} onChange={e=>changeFilter('year',e.target.value)}><option value="">Tất cả</option>{years.map(year=><option key={year}>{year}</option>)}</select></div>
    </div></div>
    <div className="sl-worklist"><div className="sl-search-wrap"><span aria-hidden="true">⌕</span><input className="sl-search" aria-label="Tìm kiếm" placeholder="Tìm lớp học phần..." value={filters.search} onChange={e=>changeFilter('search',e.target.value)}/></div>
     <div className="sl-card-scroll"><aside className="sl-section ep-queue" aria-label="Chưa xếp lịch"><h2><span>CHƯA XẾP LỊCH</span><b>{queue.length}</b></h2>
      {loading?<p role="status">Đang tải lịch thi…</p>:!queue.length&&<p>Không có danh sách cần xếp thi trong phạm vi này.</p>}
      {queue.map(o=><button key={o.id} className={selected?.id===o.id?'ep-active':''} aria-label={`${o.name} ${o.candidateCount} TS ${o.subjectName}`} aria-pressed={selected?.id===o.id} onClick={()=>{setOfferingId(o.id);setError('');}}><strong title={o.name}>{examOfferingLabel(o)}</strong><b>{o.candidateCount} TS</b><span>{o.subjectName}</span></button>)}
     </aside></div>
    </div>
   </div></aside>
   <section className="sl-right ep-calendar" aria-label="Lịch thi tuần">
    <div className="sl-schedule-head"><h1>XẾP LỊCH THI</h1><div className="sl-week"><button aria-label="Tuần trước" onClick={()=>setWeek(formatDateKey(addDays(week,-7)))}>‹</button><strong>{formatExamDate(week)} – {formatExamDate(last)}</strong><button aria-label="Tuần sau" onClick={()=>setWeek(formatDateKey(addDays(week,7)))}>›</button></div><div className="sl-actions"><button className="sl-btn sl-today" onClick={()=>setWeek(formatDateKey(mondayOf(getBusinessTodayKey())))}>Tuần này</button><button className="sl-pending" onClick={()=>{setError('');setPendingOpen(true);}}>{pending.length} chờ xác nhận</button></div></div>
    {selected&&<div className="sl-selected-strip"><span className="sl-selected-tag">ĐANG XẾP</span><strong className="sl-selected-offering" title={selected.name}>{examOfferingLabel(selected)}</strong><span className="sl-selected-meta">{selected.candidateCount} TS</span><button className="sl-btn sl-selected-clear" onClick={()=>setOfferingId('')}>Bỏ chọn</button></div>}
    {error&&!editor&&!reason&&<div role="alert" className="v20-error">{error}</div>}{!canWrite&&<div className="v20-hint">Chế độ chỉ xem — cần quyền xếp lịch để thay đổi ca thi.</div>}
    <div className="sl-calendar-wrap ep-calendar-scroll"><div className="sl-calendar ep-period-calendar" role="table" aria-label="Lịch thi theo tuần"><div className="sl-corner">BUỔI</div>
     {Array.from({length:7},(_,i)=>{const date=formatDateKey(addDays(week,i));return <div className="sl-day" key={date}><strong>{['T2','T3','T4','T5','T6','T7','CN'][i]}</strong><span>{formatExamDate(date,true)}</span></div>;})}
     {examPeriods.map(period=><React.Fragment key={period.id}><div className="sl-period"><span>{period.label}</span></div>{Array.from({length:7},(_,i)=>{
      const date=formatDateKey(addDays(week,i)),items=examSessionsForPeriod(sessions,date,period.id);
      const showList=()=>setAggregate({date,periodLabel:period.label,sessions:items});
      return <div className="sl-slot ep-period-slot" key={date}>
       <button className="ep-period-target" aria-label={`${selected?'Chọn':'Xem ca thi'} ${formatExamDate(date)} ${period.label==='SÁNG'?'Sáng':'Chiều'}`} disabled={saving||(!selected&&!items.length)||!!selected&&!canWrite} onClick={()=>selected?openEditor(null,{date,start:period.start,end:period.end,period:period.id}):showList()}/>
       <div className="ep-period-items">{items.slice(0,3).map(s=><Tooltip key={s.id} arrow placement="right" title={<div className="ep-exam-preview"><strong>{s.subjectName}</strong><span>{formatExamDate(s.examDate)} · {s.startTime.slice(0,5)}–{s.endTime.slice(0,5)}</span><span>Phòng {s.roomCode} · {s.candidateCount} thí sinh</span><small>{examCardStatus(s)}</small></div>}><button className={`ep-event ep-${s.pendingConfirmation?'pending':s.status}`} aria-label={`${s.name} ${s.subjectName} ${formatExamDate(s.examDate)} ${s.startTime.slice(0,5)} ${examStatus(s)}`} onClick={()=>openDetail(s)}><strong>{examOfferingLabel(s)}</strong><span className="ep-event-location">{s.roomCode} · {s.candidateCount} TS</span>{(s.pendingConfirmation||['held','not_held','cancelled'].includes(s.status))&&<small>{examCardStatus(s)}</small>}</button></Tooltip>)}
       {items.length>3&&<Tooltip arrow placement="right" title={<div className="ep-overflow-preview"><strong>{items.length-3} CA KHÁC</strong>{items.slice(3).map(s=><p key={s.id}>{examOfferingLabel(s)} · {s.roomCode} · {s.candidateCount} TS</p>)}</div>}><button className="ep-more" onClick={showList}>+{items.length-3} ca khác</button></Tooltip>}
       {selected&&<button className="v20-add-slot" onClick={()=>openEditor(null,{date,start:period.start,end:period.end,period:period.id})} disabled={!canWrite||saving}>+ Xếp lịch</button>}
       </div>
      </div>;
     })}</React.Fragment>)}
    </div>
    </div>
   </section>
  </section>
  {editor&&<ExamEditor session={editor.session} offering={editor.offering} slot={editor.slot} rooms={data.rooms} canWrite={canWrite} saving={saving} error={error} onClose={close(setEditor)} onSave={(form,refresh)=>mutate('save',editor.session,'',form,refresh)}/>}
  {detail&&<ExamDetail session={detail} canWrite={canWrite} saving={saving} onClose={close(setDetail)} onEdit={()=>openEditor(detail)} onCancel={()=>{setError('');setReason({action:'cancel',session:detail});}} onPending={()=>{setDetail(null);setPendingOpen(true);}}/>}
  {aggregate&&<Modal wide className="ep-list-dialog" title={`CÁC CA THI · ${formatExamDate(aggregate.date)} · ${aggregate.periodLabel}`} onClose={close(setAggregate)} actions={<button className="sl-btn" onClick={close(setAggregate)}>Đóng</button>}><ExamListTable sessions={aggregate.sessions} onSelect={openDetail}/></Modal>}
  {pendingOpen&&<Modal wide className="sl-pending-drawer ep-pending-dialog" bodyClassName="sl-pending-body" title={`CA THI CHỜ XÁC NHẬN · ${pending.length}`} busy={saving} onClose={()=>{if(!saving)setPendingOpen(false);}}>
   {error&&!reason&&<div role="alert" className="v20-error">{error}</div>}{pending.length?<ExamPendingCards sessions={pending} onSelect={openDetail} canWrite={canWrite} saving={saving} onHeld={s=>mutate('held',s)} onNotHeld={s=>{setError('');setReason({action:'not_held',session:s});}}/>:<p>Không có ca thi chờ xác nhận.</p>}
  </Modal>}
  {reason&&<ExamReasonDialog key={`${reason.action}:${reason.session.id}`} {...reason} saving={saving} error={error} onClose={close(setReason)} onConfirm={note=>mutate(reason.action,reason.session,note)}/>}
 </div></FeatureLayout>;
}
