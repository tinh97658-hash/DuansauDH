import React from 'react';
import {CheckIcon} from '../../components/AppIcons';

export default function ExamCandidatesTable({session,canWrite,busy,onAttendanceChange}) {
  const writable=canWrite&&session.canRecordAttendance===true&&Boolean(onAttendanceChange);
  return <>
    <p className="ep-attendance-help">Không chọn: có đi thi. CP: vắng có phép · KP: vắng không phép. Bấm lại để bỏ chọn.
      {writable?' Thay đổi được tự động lưu.':' Chỉ ghi nhận từ khi ca thi bắt đầu, trước khi gửi duyệt hoặc khóa kết quả.'}</p>
    <table className="v20-table ep-candidates-table" aria-label={`Danh sách thí sinh ${session.subjectName}`} aria-busy={busy||false}>
      <thead><tr><th>STT</th><th>Mã học viên</th><th>Họ tên</th><th>Trạng thái</th></tr></thead>
      <tbody>{(session.candidates||[]).map((candidate,index)=>{
        const status=candidate.attendanceStatus||'present';
        const name=[candidate.fullName,candidate.code].filter(Boolean).join(' · ')||candidate.participantId;
        return <tr key={candidate.participantId}>
          <td>{index+1}</td><td>{candidate.code||'—'}</td><td>{candidate.fullName||'—'}</td>
          <td><div className="ep-attendance-options" role="group" aria-label={`Trạng thái dự thi của ${name}`}>
            {[['absent_excused','Vắng CP','CP','Vắng có phép'],['absent_unexcused','Vắng KP','KP','Vắng không phép']].map(([value,label,shortLabel,description])=><label key={value} className={`ep-attendance-option ep-attendance-${value}`} title={description}>
              <input type="checkbox" checked={status===value} disabled={busy||!writable} aria-label={`${label} - ${name}`}
                onChange={event=>onAttendanceChange(session,candidate.participantId,event.target.checked?value:'present')}/>
              <span className="ep-attendance-chip"><span className="ep-attendance-mark" aria-hidden="true"><CheckIcon/></span>{shortLabel}</span>
            </label>)}
          </div></td>
        </tr>;
      })}{!session.candidates?.length&&<tr><td colSpan={4}>Chưa có danh sách thí sinh.</td></tr>}</tbody>
    </table>
  </>;
}
