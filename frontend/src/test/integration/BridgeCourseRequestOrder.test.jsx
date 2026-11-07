import React from 'react';
import {act,fireEvent,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import axios from 'axios';
import BridgeCourse from '../../pages/masters/bridgeCourse';
import {renderWithPermissions} from '../renderWithPermissions';

vi.mock('axios');
vi.mock('../../components/FeatureLayout',()=>({default:({children})=><div>{children}</div>}));
vi.mock('../../components/InlineReportExport',()=>({default:()=>null}));

it('retains the latest bridge-course scope when older requests finish later',async()=>{
  const pending=[];
  axios.get.mockImplementation(url=>url.includes('/masters/bridge-course?')
    ?new Promise(resolve=>pending.push({url,resolve})):Promise.resolve({data:[]}));
  renderWithPermissions(<MemoryRouter useTransitions={false}><BridgeCourse/></MemoryRouter>,['masters.view','masters.manage']);
  await waitFor(()=>expect(pending).toHaveLength(1));
  const oldYear=new URL(pending[0].url,'http://localhost').searchParams.get('academicYear');
  fireEvent.mouseDown(screen.getByLabelText('Năm học'));
  fireEvent.click(await screen.findByRole('option',{name:String(Number(oldYear)-1),exact:true}));
  await waitFor(()=>expect(pending).toHaveLength(2));
  const row=(code)=>({id:code,admissionRecord:{code,fullName:'Nguyễn Văn An'},subject:{code:'BSKT',name:'Kiến thức bổ sung'},academicYear:oldYear,status:'assigned',result:'pending'});
  await act(async()=>pending[1].resolve({data:{items:[row('BSKT-PHAM-VI-MOI')],summary:{}}}));
  expect(await screen.findByText('BSKT-PHAM-VI-MOI')).toBeVisible();
  await act(async()=>pending[0].resolve({data:{items:[row('BSKT-PHAN-HOI-CU')],summary:{}}}));
  expect(screen.getByText('BSKT-PHAM-VI-MOI')).toBeVisible();
  expect(screen.queryByText('BSKT-PHAN-HOI-CU')).not.toBeInTheDocument();
});
