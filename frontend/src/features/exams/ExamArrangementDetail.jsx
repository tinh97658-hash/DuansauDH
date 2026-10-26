import React from 'react';
import {Modal} from '../scheduling/shared';
import {formatExamDate} from './examCalendar';
import {examStatus} from './examPlanner';
import {activeExamGroup,examGroupsPeak} from './examArrangement';

export default function ExamArrangementDetail({session,canWrite,saving,onClose,onEdit,onSelect}){
 const members=[...session.members].sort((a,b)=>(a.roundNo||1)-(b.roundNo||1)||a.name.localeCompare(b.name,'vi'));
 const active=members.filter(activeExamGroup),classes=new Set(active.flatMap(g=>(g.groups||[]).map(c=>c.id)));
 return <Modal wide className="ep-arrangement-dialog" title="BUỔI THI CHUNG" busy={saving} onClose={onClose} actions={<><button className="sl-btn" onClick={onClose}>Đóng</button>{canWrite&&active.some(g=>g.status==='scheduled'&&g.canEdit!==false)&&<button className="sl-btn sl-btn-primary" disabled={saving} onClick={onEdit}>Sửa buổi thi / thêm học phần</button>}</>}>
  <p><strong>{formatExamDate(session.examDate)} · Phòng {session.roomCode} · {session.lecturerName||'Chưa phân công giám thị'}{session.externalUnitName&&` · ${session.externalUnitName}`}</strong></p>
  <p>{new Set(active.map(g=>g.roundNo||1)).size} đợt · {classes.size} lớp · {active.length} nhóm có hiệu lực · Tối đa {examGroupsPeak(active)} thí sinh đồng thời</p>
  <p>Chọn từng nhóm để xem danh sách, hủy riêng học phần hoặc mở bảng điểm. Các nhóm khác giữ nguyên lịch.</p>
  <div className="ep-round-table"><table className="v20-table ep-arrangement-detail-table"><thead><tr><th>Đợt</th><th>Giờ thi</th><th>Lớp học viên</th><th>Học phần</th><th>Thí sinh</th><th>Trạng thái</th><th>Chi tiết</th></tr></thead><tbody>{members.map(g=><tr key={g.id}>
   <td>{g.roundNo||1}</td><td>{g.startTime.slice(0,5)}–{g.endTime.slice(0,5)}</td><td>{(g.groups||[]).map(c=>c.code||c.name).filter(Boolean).join(', ')||g.name}</td><td>{g.subjectName}</td><td>{g.candidateCount}</td><td>{examStatus(g)}</td><td><button className="sl-btn" aria-label={`Chi tiết ${g.subjectName} · ${g.name}`} onClick={()=>onSelect(g)}>Chi tiết</button></td>
  </tr>)}</tbody></table></div>
  {session.arrangementNote&&<p>{session.arrangementNote}</p>}
 </Modal>;
}
