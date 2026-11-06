import React,{useState} from 'react';
import {fireEvent,render,screen} from '@testing-library/react';
import ExamCandidatesTable from '../../features/exams/ExamCandidatesTable';

const candidate={participantId:'student:one',code:'HV001',fullName:'Nguyễn Văn An'};
const initial={id:'session',subjectName:'Quản trị',canRecordAttendance:true,candidates:[candidate]};

it('treats both unchecked as present, switches exclusively between CP and KP, and clears an absence',()=>{
 const changed=vi.fn();
 function Example(){
  const [session,setSession]=useState(initial);
  return <ExamCandidatesTable session={session} canWrite onAttendanceChange={(s,id,status)=>{
   changed(s.id,id,status);setSession({...s,candidates:s.candidates.map(c=>({...c,attendanceStatus:status}))});
  }}/>;
 }
 render(<Example/>);
 const cp=screen.getByRole('checkbox',{name:/Vắng CP/}),kp=screen.getByRole('checkbox',{name:/Vắng KP/});
 expect(cp).not.toBeChecked();expect(kp).not.toBeChecked();
 fireEvent.click(cp);expect(cp).toBeChecked();expect(kp).not.toBeChecked();
 fireEvent.click(kp);expect(cp).not.toBeChecked();expect(kp).toBeChecked();
 fireEvent.click(kp);expect(cp).not.toBeChecked();expect(kp).not.toBeChecked();
 expect(changed.mock.calls.map(c=>c[2])).toEqual(['absent_excused','absent_unexcused','present']);
});

it.each([{canWrite:false},{busy:true},{session:{...initial,canRecordAttendance:false}}])('keeps attendance visible and disables editing when %j',props=>{
 render(<ExamCandidatesTable session={{...initial,candidates:[{...candidate,attendanceStatus:'absent_excused'}]}} canWrite onAttendanceChange={vi.fn()} {...props}/>);
 expect(screen.getByRole('checkbox',{name:/Vắng CP/})).toBeDisabled();
 expect(screen.getByRole('checkbox',{name:/Vắng KP/})).toBeDisabled();
});

it('shows a status column and an empty row spanning all four columns',()=>{
 render(<ExamCandidatesTable session={{...initial,candidates:[]}} canWrite/>);
 expect(screen.getByRole('columnheader',{name:'Trạng thái'})).toBeInTheDocument();
 expect(screen.getByText('Chưa có danh sách thí sinh.')).toHaveAttribute('colspan','4');
});
