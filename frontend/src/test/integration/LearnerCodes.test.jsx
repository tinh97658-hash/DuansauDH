import React from 'react';
import {render,screen,fireEvent,waitFor,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {vi} from 'vitest';
import axios from 'axios';
import LearnerCodeIssue from '../../features/learnerCodes/LearnerCodeIssue';
import LearnerCodeSettings from '../../features/learnerCodes/LearnerCodeSettings';
import {AuthSessionContext} from '../../context/AuthSession';

vi.mock('axios',()=>{const client=vi.fn();client.get=vi.fn();client.post=vi.fn();client.put=vi.fn();client.defaults={};return {default:client};});
vi.mock('../../components/FeatureLayout',()=>({default:({children,title})=><main><h1>{title}</h1>{children}</main>}));
let grants=new Set();
vi.mock('../../features/accounts/usePermissions',()=>({usePermissions:()=>({can:code=>grants.has(code),access:{groupScope:{restrictEdit:false,readOnly:false}}})}));
const group='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const row={id,code:'HV26002',full_name:'Nguyễn An',learner_code_state:'provisional',type_name:'Tiền thạc sĩ'};
const view=(Component,profile='a',entry='/')=><MemoryRouter useTransitions={false} initialEntries={[entry]}><AuthSessionContext.Provider value={{user:{id:'staff'},activeProfile:{id:profile}}}><Component/></AuthSessionContext.Provider></MemoryRouter>;
beforeEach(()=>{
  vi.clearAllMocks();grants=new Set(['learnercode.preview','learnercode.issue','learnercode.config.manage']);
  axios.get.mockImplementation(async url=>{
    if(url.endsWith('/options'))return {data:{types:[],groups:[{id:group,code:'CN-2026',name:'Lớp 2',academic_year:'2026'}]}};
    if(url.includes('/class/'))return {data:[row]};
    if(url.endsWith('/preview'))return {data:{fingerprint:'a'.repeat(64),rows:[{id,fullName:row.full_name,typeName:row.type_name,oldCode:row.code,code:'CN261201B',components:['CN','26','1','2','01B']}],counters:[]}};
    if(url.endsWith('/config'))return {data:{types:[{id:'type',key:'pre_masters',name:'Tiền thạc sĩ',letter:'B',active:true,requires_admission:true,version:1}],rules:[],abbreviations:[],majors:[],groups:[]}};
    return {data:[]};
  });
  axios.post.mockResolvedValue({data:{}});axios.mockResolvedValue({data:{}});
});
it('shows server-generated special codes in preview and confirms with the same fingerprint and selected records',async()=>{
  render(view(LearnerCodeIssue));
  fireEvent.click(await screen.findByRole('checkbox',{name:'Chọn Nguyễn An'}));
  fireEvent.click(screen.getByRole('button',{name:'Xem trước 1 hồ sơ'}));
  const dialog=await screen.findByRole('dialog');
  expect(within(dialog).getByText('CN261201B')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button',{name:'Xác nhận cấp mã'}));
  await waitFor(()=>expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/learner-codes/issue'),expect.objectContaining({recordIds:[id],classGroupId:group,fingerprint:'a'.repeat(64),requestId:expect.any(String)})));
});
it('allows preview without displaying the issuance button for a reader',async()=>{
  grants=new Set(['learnercode.preview']);render(view(LearnerCodeIssue));
  fireEvent.click(await screen.findByRole('checkbox',{name:'Chọn Nguyễn An'}));fireEvent.click(screen.getByRole('button',{name:'Xem trước 1 hồ sơ'}));
  const dialog=await screen.findByRole('dialog');expect(within(dialog).queryByRole('button',{name:'Xác nhận cấp mã'})).not.toBeInTheDocument();
});
it('persists a configured letter instead of hardcoding the special suffix',async()=>{
  render(view(LearnerCodeSettings));fireEvent.click(await screen.findByRole('button',{name:'Sửa'}));
  fireEvent.change(screen.getByLabelText('Chữ cái của loại hồ sơ (A–Z)'),{target:{value:'H'}});
  fireEvent.click(screen.getByRole('button',{name:'Lưu'}));
  await waitFor(()=>expect(axios).toHaveBeenCalledWith(expect.objectContaining({method:'put',url:expect.stringContaining('/types/type'),data:expect.objectContaining({letter:'H',version:1})})));
});
it('drops the previous profile selection and preview on a profile switch',async()=>{
  const mounted=render(view(LearnerCodeIssue));fireEvent.click(await screen.findByRole('checkbox',{name:'Chọn Nguyễn An'}));
  fireEvent.click(screen.getByRole('button',{name:'Xem trước 1 hồ sơ'}));await screen.findByRole('dialog');
  mounted.rerender(view(LearnerCodeIssue,'b'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(await screen.findByRole('checkbox',{name:'Chọn Nguyễn An'})).not.toBeChecked();
});
it('opens an unassigned application for classification without choosing an unrelated class or enabling issuance',async()=>{
  grants.add('learnercode.type.assign');
  const previous=axios.get.getMockImplementation();
  axios.get.mockImplementation(async(url,config)=>url.endsWith('/options')?{data:{types:[],groups:[{id:group,code:'OTHER',name:'Lớp khác'}],requestedRecord:row}}:previous(url,config));
  render(view(LearnerCodeIssue,'a',`/plan/learner-codes?recordId=${id}`));
  expect(await screen.findByRole('checkbox',{name:'Chọn Nguyễn An'})).toBeChecked();
  expect(screen.getByRole('button',{name:'Xem trước 1 hồ sơ'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'Gán/đổi loại hồ sơ'})).toBeInTheDocument();
  expect(axios.get.mock.calls.some(([url])=>url.includes('/class/'))).toBe(false);
});
it('refreshes both the row and cached unassigned application after saving its type',async()=>{
  grants.add('learnercode.type.assign');
  const original={...row,type_name:'Bình thường',learner_code_type_id:'regular'};
  let saved=false;
  axios.get.mockImplementation(async url=>url.endsWith('/options')?{data:{groups:[{id:group,code:'OTHER',name:'Lớp khác'}],types:[{id:'regular',name:'Bình thường',active:true},{id:'special',name:'Tiền thạc sĩ',active:true}],requestedRecord:original}}
    :url.includes('/class/')?{data:[]}:{data:{...original,type_name:saved?'Tiền thạc sĩ':'Bình thường',learner_code_type_id:saved?'special':'regular'}});
  axios.put.mockImplementation(async()=>{saved=true;return {data:{message:'ok'}};});
  render(view(LearnerCodeIssue,'a',`/plan/learner-codes?recordId=${id}`));
  fireEvent.click(await screen.findByRole('button',{name:'Gán/đổi loại hồ sơ'}));
  const dialog=await screen.findByRole('dialog');fireEvent.mouseDown(within(dialog).getByLabelText('Loại hồ sơ'));
  fireEvent.click(await screen.findByRole('option',{name:'Tiền thạc sĩ'}));
  fireEvent.change(within(dialog).getByLabelText('Lý do bắt buộc'),{target:{value:'Phân loại chính xác'}});
  fireEvent.click(within(dialog).getByRole('button',{name:'Xác nhận'}));
  await waitFor(()=>expect(screen.getByRole('table')).toHaveTextContent('Tiền thạc sĩ'));
  expect(screen.getByRole('table')).not.toHaveTextContent('Bình thường');
  fireEvent.mouseDown(screen.getAllByLabelText('Lớp hành chính').find(element=>element.getAttribute('role')==='button'));
  fireEvent.click(await screen.findByRole('option',{name:'OTHER · Lớp khác ·'}));
  await screen.findByText('Chưa có hồ sơ trong lớp được chọn.');
  fireEvent.mouseDown(screen.getAllByLabelText('Lớp hành chính').find(element=>element.getAttribute('role')==='button'));
  fireEvent.click(await screen.findByRole('option',{name:'Hồ sơ chưa có một lớp hành chính chính phù hợp'}));
  await waitFor(()=>expect(screen.getByRole('table')).toHaveTextContent('Tiền thạc sĩ'));
  expect(screen.getByRole('table')).not.toHaveTextContent('Bình thường');
});

it('renders learner code settings sections in tables and uses AppDialog without floating labels',async()=>{
  axios.get.mockResolvedValue({data:{
    types:[{id:'type',key:'pre_masters',name:'Tiền thạc sĩ',letter:'B',active:true,requires_admission:true,version:1}],
    rules:[{id:'rule-1',name:'Chuẩn thạc sĩ',version:1,active:true,counter_scope:'class',start_number:1,parts:[{kind:'major'},{kind:'sequence',width:3}]}],
    abbreviations:[{major_id:'m-1',abbreviation:'CN'}],
    majors:[{id:'m-1',name:'Công nghệ thông tin'},{id:'m-2',name:'Kỹ thuật tàu thủy'}],
    groups:[],
  }});
  axios.put.mockResolvedValue({data:{ok:true}});
  render(view(LearnerCodeSettings));
  const abbrTable=await screen.findByRole('table',{name:'Viết tắt chuyên ngành'});
  expect(within(abbrTable).getByText('Công nghệ thông tin')).toBeInTheDocument();
  expect(within(abbrTable).getByText('CN')).toBeInTheDocument();
  expect(within(abbrTable).getByText('Chưa cấu hình')).toBeInTheDocument();
  const ruleTable=screen.getByRole('table',{name:'Mẫu và phạm vi cấp mã'});
  expect(within(ruleTable).getByText('Chuẩn thạc sĩ')).toBeInTheDocument();
  const configButtons=within(abbrTable).getAllByRole('button',{name:'Cấu hình'});
  fireEvent.click(configButtons[1]);
  const dialog=await screen.findByRole('dialog');
  expect(dialog.closest('.app-popup')).not.toBeNull();
  expect(dialog.querySelector('.MuiInputLabel-root')).toBeNull();
  fireEvent.change(within(dialog).getByLabelText('Viết tắt (2–12 chữ/số)'),{target:{value:'KTTT'}});
  fireEvent.click(within(dialog).getByRole('button',{name:'Lưu'}));
  await waitFor(()=>expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/abbreviations/m-2'),{abbreviation:'KTTT'}));
});
it('allows adding a custom profile category with optional special letter in LearnerCodeSettings',async()=>{
  render(view(LearnerCodeSettings));
  fireEvent.click(await screen.findByRole('button',{name:'Thêm loại'}));
  const dialog=await screen.findByRole('dialog');
  expect(within(dialog).queryByLabelText('Chữ cái của loại hồ sơ (A–Z)')).not.toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText('Tên loại hồ sơ'),{target:{value:'Chuyển tiếp'}});
  fireEvent.click(within(dialog).getByRole('checkbox',{name:'Kích hoạt (cho phép cấp mã)'}));
  fireEvent.click(within(dialog).getByRole('button',{name:'Lưu'}));
  await waitFor(()=>expect(axios).toHaveBeenCalledWith(expect.objectContaining({
    method:'post',
    url:expect.stringContaining('/learner-codes/types'),
    data:expect.objectContaining({name:'Chuyển tiếp',usesSpecialCode:false,letter:undefined,active:true}),
  })));
  fireEvent.click(await screen.findByRole('button',{name:'Thêm loại'}));
  const specialDialog=await screen.findByRole('dialog');
  fireEvent.change(within(specialDialog).getByLabelText('Tên loại hồ sơ'),{target:{value:'Thí sinh dự khuyết'}});
  fireEvent.click(within(specialDialog).getByRole('checkbox',{name:'Cấp mã đặc biệt (gắn chữ cái phân biệt ở cuối mã)'}));
  fireEvent.change(within(specialDialog).getByLabelText('Chữ cái của loại hồ sơ (A–Z)'),{target:{value:'K'}});
  fireEvent.click(within(specialDialog).getByRole('checkbox',{name:'Kích hoạt (cho phép cấp mã)'}));
  fireEvent.click(within(specialDialog).getByRole('button',{name:'Lưu'}));
  await waitFor(()=>expect(axios).toHaveBeenCalledWith(expect.objectContaining({
    method:'post',
    url:expect.stringContaining('/learner-codes/types'),
    data:expect.objectContaining({name:'Thí sinh dự khuyết',usesSpecialCode:true,letter:'K',active:true}),
  })));
});
it('shows a single unified profile type column with letter/inactive hints and fallback original category only when needed',async()=>{
  axios.get.mockImplementation(async url=>{
    if(url.endsWith('/options'))return {data:{types:[],groups:[{id:group,code:'CN-2026',name:'Lớp 2',academic_year:'2026'}]}};
    if(url.includes('/class/'))return {data:[
      {id:'r1',code:'HV01',full_name:'Nguyễn An',profile_category:'Bình thường',type_name:'Bình thường',uses_special_code:false,letter:null,type_active:true,learner_code_state:'legacy'},
      {id:'r2',code:'HV02',full_name:'Bùi Hương',profile_category:'Cựu SV Tiền thạc sỹ',type_name:'Cựu SV Tiền thạc sỹ',uses_special_code:true,letter:'B',type_active:true,learner_code_state:'legacy'},
      {id:'r3',code:'HV03',full_name:'Lê Minh',profile_category:'Dự thính',type_name:'Dự thính',uses_special_code:false,letter:null,type_active:false,learner_code_state:'legacy'},
      {id:'r4',code:'HV04',full_name:'Trần Cũ',profile_category:'Không rõ',type_name:null,learner_code_state:'legacy'},
    ]};
    return {data:[]};
  });
  render(view(LearnerCodeIssue));
  const table=await screen.findByRole('table',{name:'Danh sách hồ sơ cấp mã'});
  await within(table).findByText('Nguyễn An');
  expect(within(table).queryByText('Phân loại hiện có')).not.toBeInTheDocument();
  expect(within(table).queryByText('Loại hồ sơ để cấp mã')).not.toBeInTheDocument();
  expect(within(table).getByRole('columnheader',{name:'Loại hồ sơ'})).toBeInTheDocument();
  expect(within(table).getAllByText('Bình thường')).toHaveLength(1);
  expect(within(table).getByText('B')).toBeInTheDocument();
  expect(within(table).getByText('Chưa kích hoạt')).toBeInTheDocument();
  expect(within(table).getByText('Phân loại gốc: Không rõ')).toBeInTheDocument();
});
