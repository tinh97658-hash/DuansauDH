import { renderToastHost } from "../renderToastHost";
beforeEach(renderToastHost);
import {formatDate} from "../../utils/dateFormat";
import React from 'react';
import {act,fireEvent,screen,waitFor,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import axios from 'axios';
import {renderWithPermissions} from '../renderWithPermissions';
import ExamSchedule from '../../pages/masters/examSchedule';
const examClock=vi.hoisted(()=>({value:'2026-10-19 07:00:00'}));
vi.mock('axios',()=>({default:{get:vi.fn(),post:vi.fn(),put:vi.fn(),defaults:{}}}));
vi.mock('../../components/FeatureLayout',()=>({default:({children})=><div>{children}</div>}));
vi.mock('../../features/scheduling/reference.css',()=>({}));
vi.mock('../../features/scheduling/workspace.css',()=>({}));
vi.mock('../../features/exams/examSchedule.css',()=>({}));
vi.mock('../../utils/schedulingCalendar',async()=>({...await vi.importActual('../../utils/schedulingCalendar'),getBusinessTodayKey:()=> '2026-10-19',getBusinessWallTime:()=>examClock.value}));
const makeOffering=(id,name,subjectName,count,prefix)=>({id,name,subjectName,subjectId:'subject-'+id,snapshotId:'snapshot-'+id,eligibilityVersion:1,candidateCount:count,remainingCount:count,
 candidateIds:Array.from({length:count},(_,i)=>prefix+i),candidates:Array.from({length:count},(_,i)=>({participantId:prefix+i,fullName:prefix+' learner '+i})),groups:[{id:name,code:name,name,academicYear:'2026'}]});
const a=makeOffering('a','CNTT 2026.1.1','Triết học',15,'cntt'),b=makeOffering('b','QTKD 2026.1.1','Xác suất',9,'qtkd'),c=makeOffering('c','CNTT 2026.1.1','Xác suất',18,'cntt'),d=makeOffering('d','QTKD 2026.1.1','Kinh tế',12,'qtkd');
let data;
beforeEach(()=>{examClock.value='2026-10-19 07:00:00';vi.clearAllMocks();data={queue:[a,b,c,d],approvedOfferings:[a,b,c,d],sessions:[],rooms:[{id:'room',code:'301',capacity:30,isActive:true}],units:[{id:'unit',name:'Viện Đào tạo SĐH',active:true}],lecturers:[{id:'lecturer',name:'Nguyễn An',unitId:'unit',active:true}]};axios.get.mockImplementation(async()=>({data}));axios.post.mockResolvedValue({data:{}});axios.put.mockResolvedValue({data:{}});});
const renderPage=()=>renderWithPermissions(<MemoryRouter useTransitions={false}><ExamSchedule/></MemoryRouter>,['gradebook.view','scheduling.write']);
const choose=(label,name)=>{fireEvent.focus(screen.getByRole('combobox',{name:label}));fireEvent.click(screen.getByRole('option',{name}));};
const add=(n,o)=>{fireEvent.focus(screen.getByRole('combobox',{name:`Thêm học phần đợt ${n}`}));fireEvent.click(screen.getByRole('option',{name:`${o.name} · ${o.candidateCount} TS`}));};
async function open(){renderPage();await waitFor(()=>expect(screen.getByRole('button',{name:'Tạo buổi thi ghép'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Tạo buổi thi ghép'}));await waitFor(()=>expect(screen.getByRole('button',{name:'301 · 30 chỗ'})).toBeEnabled());choose('Đơn vị','Viện Đào tạo SĐH');choose('Giám thị','Nguyễn An');fireEvent.click(screen.getByRole('button',{name:'301 · 30 chỗ'}));}
it('creates a mixed parallel and sequential arrangement with immutable per-offering snapshots',async()=>{
 await open();add(1,a);add(1,b);fireEvent.click(screen.getByRole('button',{name:'Thêm đợt thi'}));add(2,c);add(2,d);
 expect(screen.getByText(/Thi đồng thời:/)).toHaveTextContent('30 thí sinh');
 expect(screen.getByText(/Thi đồng thời:/)).toHaveTextContent('54 lượt dự thi');
 fireEvent.click(screen.getByRole('button',{name:'Lưu buổi thi'}));
 await waitFor(()=>expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/masters/exam-arrangements'),expect.objectContaining({examDate:'2026-10-19',period:'MORNING',roomId:'room',lecturerId:'lecturer',groups:[
  expect.objectContaining({courseOfferingId:'a',snapshotId:'snapshot-a',roundNo:1,startTime:'08:00',endTime:'09:00'}),expect.objectContaining({courseOfferingId:'b',roundNo:1}),
  expect.objectContaining({courseOfferingId:'c',roundNo:2,startTime:'09:00',endTime:'10:00'}),expect.objectContaining({courseOfferingId:'d',roundNo:2})]}),{withCredentials:true}));
});
it('moves populated and empty rounds with the selected period and uses it for new rounds',async()=>{
 await open();
 fireEvent.change(screen.getByRole('combobox',{name:'Buổi thi'}),{target:{value:'AFTERNOON'}});
 add(1,a);
 fireEvent.change(screen.getByLabelText(`Kết thúc ${a.name}`),{target:{value:'14:50'}});
 fireEvent.click(screen.getByRole('button',{name:'Thêm đợt thi'}));
 expect(screen.getByLabelText('Bắt đầu đợt 2')).toHaveValue('14:50');
 fireEvent.change(screen.getByRole('combobox',{name:'Buổi thi'}),{target:{value:'MORNING'}});
 expect(screen.getByLabelText('Bắt đầu đợt 1')).toHaveValue('08:00');
 expect(screen.getByLabelText(`Kết thúc ${a.name}`)).toHaveValue('08:50');
 expect(screen.getByLabelText('Bắt đầu đợt 2')).toHaveValue('08:50');
 fireEvent.click(screen.getByRole('button',{name:'Bỏ đợt 2'}));
 fireEvent.click(screen.getByRole('button',{name:'Thêm đợt thi'}));
 expect(screen.getByLabelText('Bắt đầu đợt 2')).toHaveValue('08:50');
 add(2,c);
 fireEvent.change(screen.getByRole('combobox',{name:'Buổi thi'}),{target:{value:'AFTERNOON'}});
 expect(screen.getByLabelText('Bắt đầu đợt 1')).toHaveValue('14:00');
 expect(screen.getByLabelText('Bắt đầu đợt 2')).toHaveValue('14:50');
 expect(within(screen.getByRole('region',{name:'Đợt 2'})).getByLabelText(`Kết thúc ${c.name}`)).toHaveValue('15:50');
 fireEvent.click(screen.getByRole('button',{name:'Lưu buổi thi'}));
 await waitFor(()=>expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/masters/exam-arrangements'),expect.objectContaining({period:'AFTERNOON',groups:[
  expect.objectContaining({courseOfferingId:'a',startTime:'14:00',endTime:'14:50'}),
  expect.objectContaining({courseOfferingId:'c',startTime:'14:50',endTime:'15:50'}),
 ]}),{withCredentials:true}));
});
it('rejects duplicate learners before adding a group and allows a later non-overlapping round',async()=>{
 await open();add(1,a);add(1,c);
 expect(screen.queryByRole('button',{name:'Gỡ Xác suất'})).toBeNull();
 expect(screen.getByRole('alert')).toHaveClass('ep-candidate-warning');
 expect(screen.getByRole('alert').textContent).toBe('Không thể ghép các môn này cùng đợt thi vì có 15 thí sinh trùng lịch.Hãy chọn đợt hoặc giờ thi khác không trùng lịch.');
 expect(screen.getByText(/Thi đồng thời:/)).toHaveTextContent('15 lượt dự thi');
 fireEvent.click(screen.getByRole('button',{name:'Thêm đợt thi'}));add(2,c);
 expect(screen.queryByRole('alert')).toBeNull();expect(screen.getByRole('button',{name:'Lưu buổi thi'})).toBeEnabled();
 fireEvent.change(screen.getAllByRole('combobox',{name:`Chuyển đợt ${c.name}`})[1],{target:{value:'1'}});
 expect(screen.getByRole('alert')).toHaveClass('ep-candidate-warning');
 expect(screen.getAllByRole('combobox',{name:`Chuyển đợt ${c.name}`})[1]).toHaveValue('2');
 expect(screen.getByLabelText('Bắt đầu đợt 2')).toHaveValue('09:00');
});
it('blocks learners already booked in another arrangement and reports their count',async()=>{
 data.sessions=[session(c,'other-exam',{arrangementId:'other-arrangement',roomId:'other-room',lecturerId:'other-lecturer',startTime:'08:30',endTime:'09:30'})];
 await open();add(1,a);
 expect(screen.queryByRole('button',{name:'Gỡ Triết học'})).toBeNull();
 const warning=screen.getByText(/Không thể ghép các môn này/).closest('[role="alert"]');
 expect(warning).toHaveClass('ep-candidate-warning');
 expect(warning).toHaveTextContent('có 15 thí sinh trùng lịch.');
 expect(screen.getByRole('button',{name:'Lưu buổi thi'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Bắt đầu đợt 1'),{target:{value:'09:30'}});add(1,a);
 expect(screen.queryByRole('alert')).toBeNull();
 expect(screen.getByRole('button',{name:'Lưu buổi thi'})).toBeEnabled();
});
it('warns in yellow and blocks saving when an edited end time overlaps another subject',async()=>{
 await open();add(1,a);fireEvent.click(screen.getByRole('button',{name:'Thêm đợt thi'}));add(2,c);
 fireEvent.change(screen.getAllByLabelText(`Kết thúc ${a.name}`)[0],{target:{value:'09:30'}});
 expect(screen.getByText(/Không thể ghép các môn này/).closest('[role="alert"]')).toHaveClass('ep-candidate-warning');
 expect(screen.getByText(/Không thể ghép các môn này/)).toHaveTextContent('có 15 thí sinh trùng lịch.');
 expect(screen.getByRole('button',{name:'Lưu buổi thi'})).toBeDisabled();
 fireEvent.change(screen.getAllByLabelText(`Kết thúc ${a.name}`)[0],{target:{value:'09:00'}});
 expect(screen.queryByRole('alert')).toBeNull();expect(screen.getByRole('button',{name:'Lưu buổi thi'})).toBeEnabled();
});
it.each([31,32,33])('checks the two-person room tolerance for %s candidates',async count=>{
 const offering=makeOffering('extra','Lớp thêm','Môn thêm',count,'extra');
 data.queue=[offering];data.approvedOfferings=[offering];
 await open();add(1,offering);
 expect(screen.getByText(/Thi đồng thời:/)).toHaveTextContent(`${count} thí sinh`);
 const save=screen.getByRole('button',{name:'Lưu buổi thi'});
 if(count<=32){
  expect(save).toBeEnabled();fireEvent.click(save);
  await waitFor(()=>expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/masters/exam-arrangements'),expect.objectContaining({roomId:'room'}),expect.anything()));
 }else expect(save).toBeDisabled();
});
it('blocks insufficient capacity and rounds overlapping the previous longest exam',async()=>{
 data.queue=[a,b,c,makeOffering('d',d.name,d.subjectName,12,'capacity')];
 await open();add(1,a);add(1,b);add(1,d);
 expect(screen.getByRole('button',{name:'Lưu buổi thi'})).toBeDisabled();expect(screen.getByText(/Phòng 301: KHÔNG ĐỦ CHỖ/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Gỡ Kinh tế'}));
 fireEvent.change(screen.getByLabelText(`Kết thúc ${a.name}`),{target:{value:'10:00'}});
 fireEvent.click(screen.getByRole('button',{name:'Thêm đợt thi'}));add(2,d);
 fireEvent.change(screen.getByLabelText('Bắt đầu đợt 2'),{target:{value:'09:30'}});
 expect(screen.getByRole('button',{name:'Lưu buổi thi'})).toBeDisabled();expect(screen.getByRole('alert')).toHaveTextContent('đợt trước kết thúc');
});
it('retains the composed form and server conflict details on a stale save',async()=>{
 await open();add(1,a);axios.post.mockRejectedValue({response:{data:{message:'Thí sinh Nguyễn An trùng giờ với môn khác'}}});fireEvent.click(screen.getByRole('button',{name:'Lưu buổi thi'}));
 expect((await screen.findByText('Thí sinh Nguyễn An trùng giờ với môn khác')).closest('.Toastify__toast')).toHaveClass('Toastify__toast--error');
 expect(screen.getByRole('dialog',{name:'TẠO BUỔI THI'})).toHaveTextContent('Triết học');
 expect(screen.getByRole('button',{name:'Lưu buổi thi'})).toBeEnabled();
 expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/masters/exam-arrangements'),expect.objectContaining({groups:[expect.objectContaining({courseOfferingId:'a',snapshotId:'snapshot-a'})]}),{withCredentials:true});
});
const session=(o,id,extra={})=>({...o,id,courseOfferingId:o.id,arrangementId:'arrangement',arrangementVersion:0,roundNo:1,version:0,examDate:'2026-10-19',startTime:'08:00',endTime:'09:00',roomId:'room',roomCode:'301',lecturerId:'lecturer',lecturerName:'Nguyễn An',status:'scheduled',canEdit:true,...extra});
it('places the compose button beside the heading and hides expired calendar actions on clock updates',async()=>{
 examClock.value='2026-10-19 08:00:59';renderPage();
 const composeButton=await screen.findByRole('button',{name:'Tạo buổi thi ghép'});
 expect(composeButton.closest('.sl-schedule-head')).toContainElement(screen.getByRole('heading',{name:'XẾP LỊCH THI'}));
 fireEvent.click(await screen.findByRole('button',{name:/CNTT 2026.1.1 15 TS Triết học/}));
 const morning=screen.getByRole('button',{name:'Chọn 19/10/2026 Sáng'}),afternoon=screen.getByRole('button',{name:'Chọn 19/10/2026 Chiều'});
 expect(morning).toBeEnabled();
 examClock.value='2026-10-19 08:01:00';fireEvent.focus(window);
 expect(morning).toBeDisabled();expect(afternoon).toBeEnabled();
 expect(within(morning.closest('.sl-slot')).queryByRole('button',{name:'Xếp lịch'})).toBeNull();
 examClock.value='2026-10-19 14:01:00';fireEvent.focus(window);
 expect(afternoon).toBeDisabled();
 expect(within(afternoon.closest('.sl-slot')).queryByRole('button',{name:'Xếp lịch'})).toBeNull();
 expect(screen.getByRole('button',{name:'Chọn 20/10/2026 Sáng'})).toBeEnabled();
});
it.each([
 ['2026-10-19 08:01:00','2026-10-19','AFTERNOON','14:00'],
 ['2026-10-19 14:01:00','2026-10-20','MORNING','08:00'],
])('defaults composition to the next available period at %s',async(now,date,period,start)=>{
 examClock.value=now;renderPage();
 await waitFor(()=>expect(screen.getByRole('button',{name:'Tạo buổi thi ghép'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Tạo buổi thi ghép'}));
 expect(screen.getByLabelText('Ngày thi')).toHaveValue(formatDate(date));
 expect(screen.getByRole('combobox',{name:'Buổi thi'})).toHaveValue(period);
 expect(screen.getByLabelText('Bắt đầu đợt 1')).toHaveValue(start);
});
it('locks an open composition form when its period closes',async()=>{
 await open();add(1,a);expect(screen.getByRole('button',{name:'Lưu buổi thi'})).toBeEnabled();
 examClock.value='2026-10-19 08:01:00';fireEvent.focus(window);
 expect(screen.getByRole('button',{name:'Lưu buổi thi'})).toBeDisabled();
 expect(screen.getByRole('combobox',{name:'Thêm học phần đợt 1'})).toBeDisabled();
 expect(screen.getByText(/đã khóa ghép thi từ 08:01/)).toBeInTheDocument();
});
it('shows one calendar card and cancels only the chosen subject group',async()=>{
 const s1=session(a,'session-a'),s2=session(b,'session-b');data.sessions=[s1,s2];data.queue=[c,d];renderPage();
 const card=await screen.findByRole('button',{name:/Phòng 301 · 1 đợt · 2 nhóm thi/});expect(document.querySelectorAll('.ep-event')).toHaveLength(1);fireEvent.click(card);
 const detail=screen.getByRole('dialog',{name:'CHI TIẾT BUỔI THI'});
 expect(screen.queryByRole('button',{name:/^Chi tiết /})).toBeNull();
 fireEvent.click(within(detail).getByRole('button',{name:`Danh sách thí sinh Triết học · ${a.name}`}));
 expect(within(detail).getByRole('table',{name:'Danh sách thí sinh Triết học'})).toHaveTextContent('cntt learner 0');
 expect(within(detail).getAllByRole('link',{name:'Mở bảng điểm'})).toHaveLength(2);
 fireEvent.click(screen.getByRole('button',{name:`Hủy lịch Triết học · ${a.name}`}));
 expect(screen.getAllByRole('dialog')).toHaveLength(1);
 fireEvent.change(screen.getByRole('textbox',{name:'Lý do hủy'}),{target:{value:'Hoãn riêng môn Triết'}});
 data.sessions=[{...s1,status:'cancelled',canEdit:false,version:1,arrangementVersion:1},{...s2,arrangementVersion:1}];
 fireEvent.click(within(detail).getByRole('button',{name:'Hủy lịch'}));
 await waitFor(()=>expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/session-a/cancel'),{version:0,note:'Hoãn riêng môn Triết'},{withCredentials:true}));
 expect(axios.put).not.toHaveBeenCalled();
 await waitFor(()=>expect(detail).toHaveTextContent('Đã hủy'));expect(detail).toHaveTextContent('Xác suất');expect(detail).toHaveTextContent('08:00–09:00');
 expect(screen.getAllByRole('dialog')).toHaveLength(1);
});

it('edits only an unlocked group in the same dialog and keeps the form on a rejected save',async()=>{
 const held=session(a,'held',{status:'held',canEdit:false,version:3,arrangementVersion:7});
 const future=session(b,'future',{roundNo:2,startTime:'10:00',endTime:'11:00',version:4,arrangementVersion:7});
 data.sessions=[held,future];renderPage();
 fireEvent.click(await screen.findByRole('button',{name:/Phòng 301 · 2 đợt · 2 nhóm thi/}));
 const dialog=screen.getByRole('dialog',{name:'CHI TIẾT BUỔI THI'});
 fireEvent.click(within(dialog).getByRole('button',{name:'Chỉnh sửa buổi thi'}));
 expect(screen.getAllByRole('dialog')).toHaveLength(1);expect(dialog).toBeInTheDocument();
 expect(screen.getByLabelText('Ngày thi')).toBeDisabled();expect(screen.getByRole('combobox',{name:'Giám thị'})).toBeDisabled();
 expect(screen.getByLabelText(`Kết thúc ${held.name}`)).toBeDisabled();
 expect(screen.getByLabelText(`Kết thúc ${future.name}`)).toBeEnabled();
 fireEvent.change(screen.getByLabelText(`Kết thúc ${future.name}`),{target:{value:'10:30'}});
 data.sessions=[{...held,arrangementVersion:8},{...future,version:5,arrangementVersion:8}];
 await act(async()=>fireEvent.focus(window));
 axios.put.mockRejectedValueOnce({response:{data:{message:'Lịch thi đã thay đổi trên máy chủ'}}});
 await waitFor(()=>expect(screen.getByRole('button',{name:'Lưu thay đổi'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Lưu thay đổi'}));
 expect((await screen.findByText('Lịch thi đã thay đổi trên máy chủ')).closest('.Toastify__toast')).toHaveClass('Toastify__toast--error');
 expect(screen.getByLabelText(`Kết thúc ${future.name}`)).toHaveValue('10:30');
 expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/exam-arrangements/arrangement'),expect.objectContaining({version:7,groups:[
  expect.objectContaining({id:'held',version:3,startTime:'08:00',endTime:'09:00'}),
  expect.objectContaining({id:'future',version:4,startTime:'10:00',endTime:'10:30'}),
 ]}),{withCredentials:true});
 fireEvent.click(screen.getByRole('button',{name:'Hủy chỉnh sửa'}));
 expect(within(dialog).getByRole('table',{name:'Các học phần trong buổi thi'})).toHaveTextContent('10:00–11:00');
 expect(within(dialog).queryByRole('alert')).toBeNull();expect(axios.put).toHaveBeenCalledTimes(1);
});

it('keeps the overview open and follows the new week after moving an arrangement',async()=>{
 data.sessions=[session(a,'moving')];renderPage();
 fireEvent.click(await screen.findByRole('button',{name:/19\/10\/2026 08:00 Đã xếp lịch/}));
 const dialog=screen.getByRole('dialog',{name:'CHI TIẾT BUỔI THI'});
 fireEvent.click(screen.getByRole('button',{name:'Chỉnh sửa buổi thi'}));
 fireEvent.change(screen.getByLabelText('Ngày thi'),{target:{value:'26/10/2026'}});
 axios.put.mockImplementation(async()=>{data.sessions=[session(a,'moving',{examDate:'2026-10-26',version:1,arrangementVersion:1})];return {data:{}};});
 await waitFor(()=>expect(screen.getByRole('button',{name:'Lưu thay đổi'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Lưu thay đổi'}));
 await waitFor(()=>expect(within(dialog).getByRole('table',{name:'Các học phần trong buổi thi'})).toBeInTheDocument());
 await waitFor(()=>expect(dialog).toHaveTextContent('26/10/2026'));
 expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/masters/exam-schedule'),expect.objectContaining({params:{from:'2026-10-26',to:'2026-11-01'}}));
 expect(screen.getAllByRole('dialog')).toHaveLength(1);
});

it('opens the same shared overview for viewers with inline candidates and direct gradebook links only',async()=>{
 const mixed=session(a,'a',{groups:[...a.groups,{id:'ktdk',code:'KTDK 2026.1.1'}]});
 data.sessions=[mixed,session(b,'b')];
 renderWithPermissions(<MemoryRouter useTransitions={false}><ExamSchedule/></MemoryRouter>,['gradebook.view']);
 fireEvent.click(await screen.findByRole('button',{name:/Phòng 301 · 1 đợt · 2 nhóm thi/}));
 const dialog=screen.getByRole('dialog',{name:'CHI TIẾT BUỔI THI'});
 const subjectCell=within(dialog).getByRole('cell',{name:'Triết học'});
 const cells=within(subjectCell.closest('tr')).getAllByRole('cell');
 expect(cells[2]).toHaveTextContent(`${a.groups[0].code} + KTDK 2026.1.1`);
 expect(cells[2]).not.toHaveTextContent('Triết học');
 expect(within(dialog).getByRole('columnheader',{name:'Lớp học viên'})).toBeInTheDocument();
 expect(within(dialog).queryByRole('button',{name:'Chỉnh sửa buổi thi'})).toBeNull();
 expect(within(dialog).queryByRole('button',{name:/^Hủy lịch/})).toBeNull();
 const links=within(dialog).getAllByRole('link',{name:'Mở bảng điểm'});
 expect(links[0]).toHaveAttribute('href',expect.stringContaining('offeringId=a'));
 fireEvent.click(within(dialog).getByRole('button',{name:`Danh sách thí sinh Triết học · ${a.name}`}));
 expect(within(dialog).getByRole('table',{name:'Danh sách thí sinh Triết học'})).toHaveTextContent('cntt learner 0');
 expect(screen.getAllByRole('dialog')).toHaveLength(1);expect(axios.post).not.toHaveBeenCalled();
});

it('confirms groups and requests a not-held reason directly inside the common overview',async()=>{
 const first=session(a,'first',{pendingConfirmation:true,canEdit:false,version:3});
 const second=session(b,'second',{pendingConfirmation:true,canEdit:false,version:4});
 data.sessions=[first,second];renderPage();
 fireEvent.click(await screen.findByRole('button',{name:/Phòng 301 · 1 đợt · 2 nhóm thi/}));
 const dialog=screen.getByRole('dialog',{name:'CHI TIẾT BUỔI THI'});
 const firstRow=within(dialog).getByText('Triết học').closest('tr');
 data.sessions=[{...first,status:'held',pendingConfirmation:false,version:4},second];
 fireEvent.click(within(firstRow).getByRole('button',{name:'Đã diễn ra'}));
 await waitFor(()=>expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/first/confirm'),{version:3,note:'',status:'held'},{withCredentials:true}));
 await waitFor(()=>expect(within(firstRow).queryByRole('button',{name:'Đã diễn ra'})).toBeNull());
 fireEvent.click(within(dialog).getByRole('button',{name:'Không diễn ra'}));
 expect(screen.getAllByRole('dialog')).toHaveLength(1);
 const confirm=within(dialog).getByRole('button',{name:'Xác nhận không diễn ra'});expect(confirm).toBeDisabled();
 fireEvent.change(within(dialog).getByLabelText('Lý do không diễn ra'),{target:{value:'Hoãn thi riêng học phần'}});
 data.sessions=[data.sessions[0],{...second,status:'not_held',pendingConfirmation:false,version:5}];
 fireEvent.click(confirm);
 await waitFor(()=>expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/second/confirm'),{version:4,note:'Hoãn thi riêng học phần',status:'not_held'},{withCredentials:true}));
 await waitFor(()=>expect(within(dialog).getByRole('table',{name:'Các học phần trong buổi thi'})).toHaveTextContent('Không diễn ra'));
 expect(screen.getAllByRole('dialog')).toHaveLength(1);
});

it('uses the requested morning and afternoon hours when composing an arrangement',async()=>{
 await open();
 expect(screen.getByRole('option',{name:'Sáng · 08:00–12:00'})).toBeInTheDocument();
 expect(screen.getByRole('option',{name:'Chiều · 14:00–18:00'})).toBeInTheDocument();
 fireEvent.change(screen.getByRole('combobox',{name:'Buổi thi'}),{target:{value:'AFTERNOON'}});
 expect(screen.getByLabelText('Bắt đầu đợt 1')).toHaveValue('14:00');
 add(1,a);
 expect(screen.getByRole('button',{name:'Lưu buổi thi'})).toBeEnabled();
 fireEvent.change(screen.getByLabelText(`Kết thúc ${a.name}`),{target:{value:'18:01'}});
 expect(screen.getByRole('button',{name:'Lưu buổi thi'})).toBeDisabled();
 expect(screen.getByRole('alert')).toHaveTextContent('14:00–18:00');
 fireEvent.change(screen.getByLabelText(`Kết thúc ${a.name}`),{target:{value:'18:00'}});
 fireEvent.click(screen.getByRole('button',{name:'Lưu buổi thi'}));
 await waitFor(()=>expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/masters/exam-arrangements'),expect.objectContaining({period:'AFTERNOON',groups:[expect.objectContaining({startTime:'14:00',endTime:'18:00'})]}),{withCredentials:true}));
});
it('saves typed external unit and invigilator names without a lecturer ID',async()=>{
 await open();add(1,a);
 fireEvent.change(screen.getByRole('combobox',{name:'Đơn vị'}),{target:{value:'Trung tâm Khảo thí ngoài viện'}});
 expect(screen.getByRole('combobox',{name:'Giám thị'})).toHaveValue('');
 expect(screen.getByRole('button',{name:'Lưu buổi thi'})).toBeDisabled();
 fireEvent.change(screen.getByRole('combobox',{name:'Giám thị'}),{target:{value:'  Lê Văn Bình  '}});
 fireEvent.click(screen.getByRole('button',{name:'Lưu buổi thi'}));
 await waitFor(()=>expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/masters/exam-arrangements'),expect.objectContaining({lecturerId:undefined,externalUnitName:'Trung tâm Khảo thí ngoài viện',externalInvigilatorName:'Lê Văn Bình'}),{withCredentials:true}));
});
it('only suggests the two postgraduate units and lecturers from the selected unit while allowing other typed choices',async()=>{
 data.units.push({id:'postgraduate',name:'Viện Đào tạo Sau đại học',active:true},{id:'other',name:'Khoa Công nghệ thông tin',active:true});
 data.lecturers.push({id:'second',name:'Trần Bình',unitId:'postgraduate',active:true},{id:'outside',name:'Lê Minh',unitId:'other',active:true});
 await open();add(1,a);
 fireEvent.focus(screen.getByRole('combobox',{name:'Đơn vị'}));
 const unitOptions=within(screen.getByRole('listbox',{name:'Đơn vị'}));
 expect(unitOptions.getAllByRole('option').map(o=>o.textContent)).toEqual(['Viện Đào tạo SĐH','Viện Đào tạo Sau đại học']);
 choose('Giám thị','Nguyễn An');
 fireEvent.focus(screen.getByRole('combobox',{name:'Giám thị'}));
 expect(within(screen.getByRole('listbox',{name:'Giám thị'})).getAllByRole('option').map(o=>o.textContent)).toEqual(['Nguyễn An']);
 choose('Đơn vị','Viện Đào tạo Sau đại học');
 expect(screen.getByRole('combobox',{name:'Giám thị'})).toHaveValue('');
 fireEvent.focus(screen.getByRole('combobox',{name:'Giám thị'}));
 expect(within(screen.getByRole('listbox',{name:'Giám thị'})).getAllByRole('option').map(o=>o.textContent)).toEqual(['Trần Bình']);
 fireEvent.change(screen.getByRole('combobox',{name:'Đơn vị'}),{target:{value:'Khoa Công nghệ thông tin'}});
 expect(within(screen.getByRole('listbox',{name:'Đơn vị'})).queryAllByRole('option')).toHaveLength(0);
 fireEvent.change(screen.getByRole('combobox',{name:'Giám thị'}),{target:{value:'Lê Minh'}});
 expect(within(screen.getByRole('listbox',{name:'Giám thị'})).queryAllByRole('option')).toHaveLength(0);
 fireEvent.click(screen.getByRole('button',{name:'Lưu buổi thi'}));
 await waitFor(()=>expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/masters/exam-arrangements'),expect.objectContaining({lecturerId:undefined,externalUnitName:'Khoa Công nghệ thông tin',externalInvigilatorName:'Lê Minh'}),{withCredentials:true}));
});
it('restores external names when editing a single-group arrangement',async()=>{
 data.sessions=[session(a,'external',{lecturerId:null,lecturerName:'Lê Văn Bình',externalInvigilatorName:'Lê Văn Bình',externalUnitName:'Trung tâm Khảo thí'})];
 renderPage();fireEvent.click(await screen.findByRole('button',{name:/19\/10\/2026 08:00 Đã xếp lịch/}));
 const detail=screen.getByRole('dialog',{name:'CHI TIẾT BUỔI THI'});expect(detail).toHaveTextContent('Lê Văn Bình');
 fireEvent.click(screen.getByRole('button',{name:'Chỉnh sửa buổi thi'}));expect(screen.getAllByRole('dialog')).toHaveLength(1);expect(detail).toBeInTheDocument();
 expect(screen.getByRole('combobox',{name:'Đơn vị'})).toHaveValue('Trung tâm Khảo thí');
 expect(screen.getByRole('combobox',{name:'Giám thị'})).toHaveValue('Lê Văn Bình');
 await waitFor(()=>expect(screen.getByRole('button',{name:'Lưu thay đổi'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Lưu thay đổi'}));
 await waitFor(()=>expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/masters/exam-arrangements/arrangement'),expect.objectContaining({externalInvigilatorName:'Lê Văn Bình',externalUnitName:'Trung tâm Khảo thí'}),{withCredentials:true}));
});
