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
