import React from 'react';
import {fireEvent,screen,waitFor,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import axios from 'axios';
import {renderWithPermissions} from '../renderWithPermissions';
import ExamSchedule from '../../pages/masters/examSchedule';
import {ExamListTable} from '../../features/exams/ExamPlannerDialogs';
vi.mock('axios',()=>({default:{get:vi.fn(),post:vi.fn(),put:vi.fn(),defaults:{}}}));
vi.mock('../../components/FeatureLayout',()=>({default:({children})=><div>{children}</div>}));
// Layout and palette are verified in the real browser; keep DOM interaction tests independent of CSS selector cost.
vi.mock('../../features/scheduling/reference.css',()=>({}));
vi.mock('../../features/scheduling/workspace.css',()=>({}));
vi.mock('../../features/exams/examSchedule.css',()=>({}));
vi.mock('../../utils/schedulingCalendar',async()=>({...await vi.importActual('../../utils/schedulingCalendar'),getBusinessTodayKey:()=> '2026-10-19'}));
const date='2026-10-19',offering={id:'offering',name:'Lớp QT 2026',subjectId:'subject',subjectName:'Quản trị',subjectCode:'QT',snapshotId:'snapshot',eligibilityVersion:2,candidateCount:2,candidateIds:['student:a','student:b'],remainingCount:2,groups:[{id:'group',name:'QTKD2026',academicYear:'2026',majorId:'major',majorName:'Quản trị kinh doanh',disciplineId:'discipline',disciplineName:'Kinh doanh'}]};
const room={id:'room',name:'Phòng giảng đường',code:'301',capacity:2,isActive:true};let data;
const renderPage=(permissions=['gradebook.view','scheduling.write'])=>renderWithPermissions(<MemoryRouter><ExamSchedule/></MemoryRouter>,permissions);
const queueButton=()=>within(screen.getByRole('complementary',{name:'Chưa xếp lịch'})).getByRole('button',{name:/Lớp QT/});
const open=async()=>{fireEvent.click(await within(screen.getByRole('complementary',{name:'Chưa xếp lịch'})).findByRole('button',{name:/Lớp QT/}));fireEvent.click(screen.getByRole('button',{name:'Chọn 19/10/2026 Sáng'}));await screen.findByRole('dialog',{name:'XẾP LỊCH THI'});await waitFor(()=>expect(screen.getByRole('button',{name:/301 2 chỗ TRỐNG/})).toBeEnabled());};
const chooseScope=(label,name)=>{fireEvent.focus(screen.getByRole('combobox',{name:label}));fireEvent.click(screen.getByRole('option',{name}));};
const selectRoom=()=>fireEvent.click(screen.getByRole('button',{name:/301 2 chỗ/}));
function session(extra={}){return {id:'session',courseOfferingId:offering.id,snapshotId:'snapshot',version:3,name:offering.name,subjectId:offering.subjectId,subjectName:offering.subjectName,groups:offering.groups,candidateCount:2,candidateIds:offering.candidateIds,examDate:date,startTime:'08:00',endTime:'10:00',roomId:room.id,roomCode:room.code,status:'scheduled',canEdit:true,...extra};}
beforeEach(()=>{vi.clearAllMocks();data={queue:[offering],approvedOfferings:[offering],sessions:[],rooms:[room,{...room,id:'small',code:'201',capacity:1}]};axios.get.mockImplementation(async()=>({data}));axios.post.mockResolvedValue({data:{id:'new'}});axios.put.mockResolvedValue({data:{}});});
it('fails closed without view permission',()=>{renderPage([]);expect(screen.getByRole('alert')).toHaveTextContent('không có quyền');expect(axios.get).not.toHaveBeenCalled();});
it('reuses the Teaching page shell with exactly three scope selectors above search and queue',async()=>{
 renderPage();await screen.findByRole('button',{name:/Lớp QT/});for(const name of ['Ngành','Chuyên ngành','Khóa / năm học'])expect(screen.getByRole('combobox',{name})).toBeInTheDocument();
 const shell=document.querySelector('.sl-workspace.sl-schedule-view'),left=shell.querySelector(':scope > .sl-left'),right=shell.querySelector(':scope > .sl-right');expect(shell.children).toHaveLength(2);expect(left).toHaveTextContent('PHẠM VI LÀM VIỆC');expect(left.querySelector('.sl-schedule-scope-fields').children).toHaveLength(3);expect(left).toContainElement(screen.getByLabelText('Tìm kiếm'));expect(right.querySelector('.sl-schedule-head')).toHaveTextContent('XẾP LỊCH THI');
 expect(screen.queryByLabelText('Học phần')).toBeNull();expect(screen.queryByLabelText('Trạng thái')).toBeNull();expect(document.querySelector('.ep-toolbar,.ep-week,.ep-areas')).toBeNull();expect(screen.queryByText(/chưa xếp · .*đã xếp/)).toBeNull();expect(screen.queryByRole('complementary',{name:'Chi tiết lịch thi'})).toBeNull();expect(queueButton()).toHaveTextContent('2 TS');expect(queueButton()).not.toHaveTextContent('DS thi đã duyệt');
});
it('clears dependent specialization/year and selected queue when hierarchy changes',async()=>{
 const other={...offering,id:'other',subjectId:'other-subject',subjectName:'Triết học',groups:[{academicYear:'2025',disciplineId:'d2',disciplineName:'Xã hội',majorId:'m2',majorName:'Triết học'}]};data.approvedOfferings.push(other);renderPage();await screen.findByRole('button',{name:/Lớp QT/});
 chooseScope('Ngành','Kinh doanh');chooseScope('Chuyên ngành','Quản trị kinh doanh');fireEvent.change(screen.getByLabelText('Khóa / năm học'),{target:{value:'2026'}});
 fireEvent.click(queueButton());chooseScope('Ngành','Xã hội');expect(screen.getByLabelText('Chuyên ngành')).toHaveValue('Tất cả chuyên ngành');expect(screen.getByLabelText('Khóa / năm học')).toHaveValue('');expect(screen.queryByRole('button',{name:/^Bỏ chọn$/})).toBeNull();fireEvent.focus(screen.getByLabelText('Chuyên ngành'));expect(screen.queryByRole('option',{name:'Quản trị kinh doanh'})).toBeNull();
});
it('reuses the Teaching scope collapse/expand interaction',async()=>{renderPage();await screen.findByRole('button',{name:/Lớp QT/});fireEvent.click(screen.getByRole('button',{name:'Thu gọn phạm vi làm việc'}));expect(document.querySelector('.sl-workspace')).toHaveClass('sl-sidebar-collapsed');fireEvent.click(screen.getByRole('button',{name:'Mở phạm vi làm việc'}));expect(document.querySelector('.sl-workspace')).not.toHaveClass('sl-sidebar-collapsed');});
it('searches course/subject context from the scope panel without extra dropdowns',async()=>{renderPage();await screen.findByRole('button',{name:/Lớp QT/});fireEvent.change(screen.getByLabelText('Tìm kiếm'),{target:{value:'QT'}});expect(queueButton()).toBeInTheDocument();fireEvent.change(screen.getByLabelText('Tìm kiếm'),{target:{value:'Không tìm thấy'}});expect(screen.queryByRole('button',{name:/Lớp QT/})).toBeNull();});
it('navigates weeks, displays daytime and Vietnamese dates',async()=>{renderPage();await screen.findByRole('button',{name:/Lớp QT/});expect(screen.getByText('SÁNG')).toBeInTheDocument();expect(screen.getByText('CHIỀU')).toBeInTheDocument();expect(screen.queryByText('07:00')).toBeNull();expect(screen.queryByText('19:00')).toBeNull();expect(document.querySelectorAll('.ep-period-slot')).toHaveLength(14);expect(screen.queryByText('06:00')).toBeNull();expect(screen.queryByText(/UTC/)).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Tuần sau'}));await waitFor(()=>expect(axios.get).toHaveBeenLastCalledWith(expect.any(String),expect.objectContaining({params:{from:'2026-10-26',to:'2026-11-01'}})));});
it('creates from a slot using immutable approved snapshot and shared floor-grouped room cards',async()=>{
 renderPage();await open();expect(screen.queryByLabelText('Phòng thi')).toBeNull();expect(screen.getByText('TẦNG 2')).toBeInTheDocument();expect(screen.getByText('TẦNG 3')).toBeInTheDocument();expect(screen.getByLabelText('Bắt đầu')).toHaveAttribute('type','time');expect(screen.getByRole('button',{name:/201 1 chỗ KHÔNG ĐỦ CHỖ/})).toBeDisabled();
 selectRoom();expect(screen.getByRole('button',{name:/301 2 chỗ ĐANG CHỌN/})).toHaveAttribute('aria-pressed','true');fireEvent.click(screen.getByRole('button',{name:'Xếp lịch'}));await waitFor(()=>expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/masters/exam-sessions'),expect.objectContaining({courseOfferingId:'offering',snapshotId:'snapshot',eligibilityVersion:2,roomId:'room',examDate:date,startTime:'08:00',endTime:'09:00'}),{withCredentials:true}));
});
it('recalculates occupied rooms on time change and fetches a changed date',async()=>{
 data.sessions=[session({id:'busy',courseOfferingId:'other',candidateIds:['other']})];renderPage();fireEvent.click(await screen.findByRole('button',{name:/Lớp QT 2026 2 TS/}));fireEvent.click(screen.getByRole('button',{name:'Chọn 19/10/2026 Sáng'}));
 expect(await screen.findByRole('button',{name:/301 2 chỗ ĐÃ CÓ LỊCH/})).toBeDisabled();fireEvent.change(screen.getByLabelText('Bắt đầu'),{target:{value:'11:00'}});fireEvent.change(screen.getByLabelText('Kết thúc'),{target:{value:'12:00'}});await waitFor(()=>expect(screen.getByRole('button',{name:/301 2 chỗ TRỐNG/})).toBeEnabled());fireEvent.change(screen.getByLabelText('Ngày thi'),{target:{value:'20/10/2026'}});await waitFor(()=>expect(axios.get).toHaveBeenLastCalledWith(expect.any(String),expect.objectContaining({params:{from:'2026-10-20',to:'2026-10-20'}})));
});
it('blocks candidate conflict and keeps authoritative server error/form on failure',async()=>{
 axios.post.mockRejectedValue({response:{status:409,data:{message:'Thí sinh trùng ca thi trên máy chủ'}}});renderPage();await open();selectRoom();fireEvent.click(screen.getByRole('button',{name:'Xếp lịch'}));expect(await screen.findByRole('alert')).toHaveTextContent('máy chủ');expect(screen.getByLabelText('Ngày thi')).toHaveValue('19/10/2026');
});
it('keeps read-only calendar controls disabled',async()=>{renderPage(['gradebook.view']);await screen.findByRole('button',{name:/Lớp QT/});fireEvent.click(queueButton());expect(screen.getByRole('button',{name:'Chọn 19/10/2026 Sáng'})).toBeDisabled();expect(screen.queryByRole('dialog')).toBeNull();});
it('shows two direct full-width cards, then +N with hover preview and full-list drilldown',async()=>{
 data.sessions=Array.from({length:4},(_,i)=>session({id:'s'+i,name:'Lớp '+i,roomCode:'30'+i}));renderPage();const more=await screen.findByRole('button',{name:'+1 ca khác'});expect(document.querySelectorAll('.ep-event')).toHaveLength(3);fireEvent.mouseOver(more);expect(await screen.findByRole('tooltip')).toHaveTextContent('QTKD2026');fireEvent.click(more);const list=screen.getByRole('dialog',{name:/CÁC CA THI/});expect(within(list).getAllByRole('row')).toHaveLength(5);fireEvent.click(within(list).getByRole('button',{name:'Lớp 3'}));expect(screen.getByRole('dialog',{name:'LỊCH THI'})).toHaveTextContent('Lớp 3');
});
it.each([1,2])('renders %i overlapping exams directly without a summary',async(count)=>{data.sessions=Array.from({length:count},(_,i)=>session({id:String(i)}));renderPage();await waitFor(()=>expect(document.querySelectorAll('.ep-event')).toHaveLength(count));expect(screen.queryByText(/ca khác/)).toBeNull();});
it('opens edit with same room grid and saves session version',async()=>{
 data.sessions=[session()];data.queue=[];renderPage();fireEvent.click(await screen.findByRole('button',{name:/19\/10\/2026 08:00 Đã xếp lịch/}));fireEvent.click(screen.getByRole('button',{name:'Sửa lịch'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Lưu lịch'})).toBeEnabled());fireEvent.change(screen.getByLabelText('Kết thúc'),{target:{value:'11:00'}});fireEvent.click(screen.getByRole('button',{name:'Lưu lịch'}));await waitFor(()=>expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/session'),expect.objectContaining({version:3,endTime:'11:00'}),{withCredentials:true}));
});
it('requires a dedicated cancellation reason dialog',async()=>{
 data.sessions=[session()];renderPage();fireEvent.click(await screen.findByRole('button',{name:/19\/10\/2026 08:00 Đã xếp lịch/}));fireEvent.click(screen.getByRole('button',{name:'Hủy lịch'}));const dialog=screen.getByRole('dialog',{name:'HỦY LỊCH THI'}),button=within(dialog).getByRole('button',{name:'Hủy lịch'});expect(button).toBeDisabled();fireEvent.change(within(dialog).getByLabelText('Lý do hủy'),{target:{value:'Đổi kế hoạch'}});fireEvent.click(button);await waitFor(()=>expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/session/cancel'),{version:3,note:'Đổi kế hoạch'},{withCredentials:true}));
});
it('confirms Held directly without any reason field',async()=>{
 data.sessions=[session({pendingConfirmation:true,canEdit:false})];renderPage();fireEvent.click(await screen.findByRole('button',{name:'1 chờ xác nhận'}));const dialog=screen.getByRole('dialog');expect(within(dialog).queryByRole('textbox')).toBeNull();fireEvent.click(within(dialog).getByRole('button',{name:'✓ Đã diễn ra'}));await waitFor(()=>expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/session/confirm'),{version:3,note:'',status:'held'},{withCredentials:true}));
});
it.each([0,1,3])('uses the vt5 pending card layout with %i sessions',async(count)=>{
 data.sessions=Array.from({length:count},(_,i)=>session({id:'pending'+i,pendingConfirmation:true,canEdit:false,name:'Lớp học phần có tên dài '+i,subjectName:'Quản trị nguồn nhân lực và phát triển tổ chức'}));
 renderPage();fireEvent.click(await screen.findByRole('button',{name:count+' chờ xác nhận'}));
 const dialog=screen.getByRole('dialog',{name:'CA THI CHỜ XÁC NHẬN · '+count});
 expect(dialog).toHaveClass('sl-pending-drawer','ep-pending-dialog','v20-wide');
 expect(within(dialog).queryByRole('table')).toBeNull();
 expect(within(dialog).queryByRole('textbox')).toBeNull();
 if(count){expect(within(dialog).getAllByRole('article')).toHaveLength(count);expect(within(dialog).getAllByRole('button',{name:'Không diễn ra'})).toHaveLength(count);expect(dialog).toHaveTextContent('Quản trị nguồn nhân lực và phát triển tổ chức');expect(dialog).toHaveTextContent('Phòng 301 · 2 TS');}
 else expect(dialog).toHaveTextContent('Không có ca thi chờ xác nhận.');
 for(const button of within(dialog).getAllByRole('button',{name:'Đóng'}))expect(button).toBeEnabled();
});
it('asks for Not Held reason only after choosing that action',async()=>{
 data.sessions=[session({pendingConfirmation:true,canEdit:false})];renderPage();fireEvent.click(await screen.findByRole('button',{name:'1 chờ xác nhận'}));fireEvent.click(screen.getByRole('button',{name:'Không diễn ra'}));const dialog=screen.getByRole('dialog',{name:'KHÔNG DIỄN RA'}),button=within(dialog).getByRole('button',{name:'Xác nhận không diễn ra'});expect(button).toBeDisabled();fireEvent.change(within(dialog).getByLabelText('Lý do không diễn ra'),{target:{value:'Mưa bão'}});fireEvent.click(button);await waitFor(()=>expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/session/confirm'),{version:3,note:'Mưa bão',status:'not_held'},{withCredentials:true}));
});
it('sorts pending cards by time, preserves detail access and disables confirmation for read-only users',async()=>{
 data.sessions=[session({id:'later',name:'Lớp muộn',startTime:'11:00',pendingConfirmation:true}),session({id:'early',name:'Lớp sớm',pendingConfirmation:true})];
 renderPage(['gradebook.view']);fireEvent.click(await screen.findByRole('button',{name:'2 chờ xác nhận'}));
 const dialog=screen.getByRole('dialog'),cards=within(dialog).getAllByRole('article');expect(cards[0]).toHaveTextContent('Lớp sớm');expect(cards[1]).toHaveTextContent('Lớp muộn');
 for(const card of cards){expect(within(card).getByRole('button',{name:'Không diễn ra'})).toBeDisabled();expect(within(card).getByRole('button',{name:'✓ Đã diễn ra'})).toBeDisabled();}
 fireEvent.click(within(cards[0]).getByRole('button',{name:'Lớp sớm'}));expect(screen.getByRole('dialog',{name:'LỊCH THI'})).toHaveTextContent('Lớp sớm');expect(axios.post).not.toHaveBeenCalled();
});
it.each(['held','not_held','cancelled'])('retains historical %s session and hides mutations',async(status)=>{data.sessions=[session({status,canEdit:false})];renderPage();const card=await screen.findByRole('button',{name:/^Lớp QT.*19\/10\/2026 08:00/});fireEvent.click(card);expect(screen.queryByRole('button',{name:'Hủy lịch'})).toBeNull();expect(screen.queryByRole('button',{name:'Sửa lịch'})).toBeNull();});
it('hides edit/cancel for elapsed scheduled sessions',async()=>{data.sessions=[session({canEdit:false})];renderPage();fireEvent.click(await screen.findByRole('button',{name:/^Lớp QT.*19\/10\/2026 08:00/}));expect(screen.queryByRole('button',{name:'Hủy lịch'})).toBeNull();expect(screen.queryByRole('button',{name:'Sửa lịch'})).toBeNull();});
it('blocks a loaded candidate overlap even when a different room is free',async()=>{data.sessions=[session({id:'other',courseOfferingId:'other',roomId:'other-room'})];renderPage();await open();selectRoom();expect(screen.getByRole('button',{name:'Xếp lịch'})).toBeDisabled();expect(screen.getByRole('alert')).toHaveTextContent('2 thí sinh đang có lịch thi khác');});
it.each(['click','Enter',' '])('opens an entire overlap list row with %s',action=>{
 const select=vi.fn(),item=session();renderWithPermissions(<MemoryRouter><ExamListTable sessions={[item]} onSelect={select}/></MemoryRouter>,[]);
 const row=screen.getAllByRole('row')[1];if(action==='click')fireEvent.click(row);else fireEvent.keyDown(row,{key:action});expect(select).toHaveBeenCalledOnce();expect(select).toHaveBeenCalledWith(item);
});
it('keeps long academic names out of queue identifiers, calendar cards and active bar, with details on hover',async()=>{
 const item={...offering,name:'QTKD 2026 — Quản trị nguồn nhân lực — Nhóm 11',subjectName:'Quản trị nguồn nhân lực',groups:[{...offering.groups[0],code:'QTKD 2026.1.11'}]};
 data.queue=[item];data.approvedOfferings=[item];data.sessions=[session({name:item.name,subjectName:item.subjectName,groups:item.groups,pendingConfirmation:true})];renderPage();
 const queue=await within(screen.getByRole('complementary',{name:'Chưa xếp lịch'})).findByRole('button',{name:/Nhóm 11/});expect(queue).toHaveTextContent('QTKD 2026.1.11');expect(queue.textContent).not.toContain('Nhóm 11');expect(queue).toHaveTextContent('Quản trị nguồn nhân lực');
 fireEvent.click(queue);const strip=document.querySelector('.sl-selected-strip');expect(strip).toHaveTextContent('ĐANG XẾP');expect(strip).toHaveTextContent('QTKD 2026.1.11');expect(strip).toHaveTextContent('2 TS');expect(strip).not.toHaveTextContent(item.subjectName);
 const card=document.querySelector('.ep-event');expect(card).toHaveTextContent('QTKD 2026.1.11');expect(card).toHaveTextContent('301 · 2 TS');expect(card).toHaveTextContent('CHỜ XÁC NHẬN');expect(card.textContent).not.toContain(item.subjectName);expect(card.textContent).not.toContain('08:00');
 fireEvent.mouseOver(card);const tooltip=await screen.findByRole('tooltip');expect(tooltip).toHaveTextContent(item.subjectName);expect(tooltip).toHaveTextContent('19/10/2026 · 08:00–10:00');expect(tooltip).toHaveTextContent('Phòng 301 · 2 thí sinh');
});
it('prefills the clicked afternoon date/period, keeps 24-hour exact times and rejects night/reversed times',async()=>{
 renderPage();fireEvent.click(await within(screen.getByRole('complementary',{name:'Chưa xếp lịch'})).findByRole('button',{name:/Lớp QT/}));fireEvent.click(screen.getByRole('button',{name:'Chọn 19/10/2026 Chiều'}));
 expect(screen.getByLabelText('Ngày thi')).toHaveValue('19/10/2026');expect(screen.getByText('Chiều')).toBeInTheDocument();expect(screen.getByLabelText('Bắt đầu')).toHaveValue('13:00');expect(screen.getByLabelText('Kết thúc')).toHaveValue('14:00');await waitFor(()=>expect(screen.getByRole('button',{name:/301 2 chỗ TRỐNG/})).toBeEnabled());selectRoom();
 expect(screen.queryByText(/Sức chứa phù hợp|Không trùng thí sinh trong lịch đã tải/)).toBeNull();
 fireEvent.change(screen.getByLabelText('Bắt đầu'),{target:{value:'01:00'}});expect(screen.getByRole('button',{name:'Xếp lịch'})).toBeDisabled();expect(screen.getByRole('alert')).toHaveTextContent('07:00–19:00');
 fireEvent.change(screen.getByLabelText('Bắt đầu'),{target:{value:'15:30'}});expect(screen.getByRole('alert')).toHaveTextContent('Giờ kết thúc phải sau');fireEvent.change(screen.getByLabelText('Kết thúc'),{target:{value:'16:30'}});expect(screen.getByRole('button',{name:'Xếp lịch'})).toBeEnabled();
});
it('allows the same candidates/room at a different exact time within the same morning',async()=>{
 data.sessions=[session({id:'existing',courseOfferingId:'other'})];renderPage();fireEvent.click(await within(screen.getByRole('complementary',{name:'Chưa xếp lịch'})).findByRole('button',{name:/Lớp QT/}));fireEvent.click(screen.getByRole('button',{name:'Chọn 19/10/2026 Sáng'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:/301 2 chỗ ĐÃ CÓ LỊCH/})).toBeDisabled());fireEvent.change(screen.getByLabelText('Bắt đầu'),{target:{value:'10:00'}});fireEvent.change(screen.getByLabelText('Kết thúc'),{target:{value:'11:00'}});selectRoom();expect(screen.getByRole('button',{name:'Xếp lịch'})).toBeEnabled();expect(screen.queryByText(/thí sinh đang có lịch/)).toBeNull();
});
it('opens all different-time exams in the morning by clicking the cell background',async()=>{
 data.sessions=[session(),session({id:'later',startTime:'11:00',endTime:'12:00'})];renderPage();fireEvent.click(await screen.findByRole('button',{name:'Xem ca thi 19/10/2026 Sáng'}));const list=screen.getByRole('dialog',{name:/CÁC CA THI.*SÁNG/});expect(within(list).getAllByRole('row')).toHaveLength(3);expect(list).toHaveTextContent('08:00–10:00');expect(list).toHaveTextContent('11:00–12:00');
});
