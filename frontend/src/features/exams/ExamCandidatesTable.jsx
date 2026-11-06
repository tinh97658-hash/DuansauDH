import React from 'react';
import {CheckIcon,LockClosedIcon} from '../../components/AppIcons';

export default function ExamCandidatesTable({session,canWrite,busy,onAttendanceChange,onAttendanceConfirm}) {
  const confirmed=!!session.attendanceConfirmedAt;
  const writable=canWrite&&!confirmed&&session.canRecordAttendance===true&&Boolean(onAttendanceChange);
  const candidates=session.candidates||[],cp=candidates.filter(c=>c.attendanceStatus==='absent_excused').length,kp=candidates.filter(c=>c.attendanceStatus==='absent_unexcused').length;
  return <>
    <p className="ep-attendance-help">Không chọn: có đi thi. CP: vắng có phép · KP: vắng không phép. Bấm lại để bỏ chọn.
      {confirmed?' Trạng thái đã xác nhận và khóa.':writable?' Thay đổi được tự động lưu.':' Chỉ ghi nhận từ khi ca thi bắt đầu, trước khi gửi duyệt hoặc khóa kết quả.'}</p>
    <table className="v20-table ep-candidates-table" aria-label={`Danh sách thí sinh ${session.subjectName}`} aria-busy={busy||false}>
      <thead><tr><th>STT</th><th>Mã học viên</th><th>Họ tên</th><th>Trạng thái</th></tr></thead>
      <tbody>{(session.candidates||[]).map((candidate,index)=>{
        const status=candidate.attendanceStatus||'present';
        const name=[candidate.fullName,candidate.code].filter(Boolean).join(' · ')||candidate.participantId;
        return <tr key={candidate.participantId}>
          <td>{index+1}</td><td>{candidate.code||'—'}</td><td>{candidate.fullName||'—'}{candidate.isMakeup&&<span className="ep-makeup-badge">Thi bù</span>}</td>
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
    <div className="ep-attendance-footer">
      <div><p>Có mặt: <strong>{candidates.length-cp-kp}</strong> · Vắng CP: <strong>{cp}</strong> · Vắng KP: <strong>{kp}</strong></p>
        {!confirmed&&canWrite&&session.canConfirmAttendance&&<small>Xác nhận sẽ khóa trạng thái dự thi của cả ca thi.</small>}</div>
      {confirmed?<span className="ep-attendance-confirmed" role="status"><LockClosedIcon/> Đã xác nhận trạng thái dự thi</span>
        :canWrite&&session.canConfirmAttendance&&onAttendanceConfirm&&<button type="button" className="sl-btn sl-btn-primary" disabled={busy} onClick={()=>onAttendanceConfirm(session)}><CheckIcon/> Xác nhận trạng thái dự thi</button>}
    </div>
  </>;
}
