import React, { useEffect, useRef, useState } from "react";
import { normalize } from "./shared";
import { lecturerGroupsForOffering, lecturerUnitOf } from "../../utils/lecturerQualification";

const lecturerSearchText = (value) => normalize(String(value || "").toLocaleLowerCase("vi"));

export default function LecturerPicker({ value, lecturers, offering, conflicts, disabled, locked, onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapper = useRef(null);
  const selected = lecturers.find((item) => item.id === value);
  useEffect(() => {
    const close = (event) => { if (!wrapper.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const available = lecturers.filter((row) => row.active !== false || row.id === value).map((row) => ({
    ...row,
    unit: lecturerUnitOf(row),
    busy: conflicts.some((item) => item.lecturerId === row.id),
  }));
  const visible = available.filter((row) => lecturerSearchText(`${row.name} ${row.code || ""} ${row.unit?.name || ""} ${row.unit?.code || ""}`).includes(lecturerSearchText(query)));
  const groups = lecturerGroupsForOffering(visible, offering);

  if (locked) return <div className="sl-fixed-lecturer" aria-label="Giảng viên cố định">
    <strong>{selected?.name || "Giảng viên đã phân công"}</strong>
    <span>{lecturerUnitOf(selected)?.name || "Đã cố định theo buổi học đầu tiên"}</span>
    <small>Giảng viên cố định của lớp · Các buổi sau chỉ thay đổi phòng học</small>
  </div>;

  return <div className="sl-lecturer-picker" ref={wrapper}>
    <button type="button" className="sl-lecturer-trigger" aria-label="Giảng viên" aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => { setQuery(""); setOpen((current) => !current); }}>
      <span>{selected?.name || "Chọn giảng viên"}</span><b aria-hidden="true">⌄</b>
    </button>
    {open && <div className="sl-lecturer-popover">
      <input autoFocus aria-label="Tìm giảng viên" placeholder="Tìm giảng viên..." value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="sl-lecturer-list" role="listbox" aria-label="Danh sách giảng viên">
        {groups.map((group) => <React.Fragment key={group.key}>
          <div className={`sl-lecturer-group ${group.recommended ? "sl-recommended" : ""}`}>
            <span>{group.name}</span>{group.recommended && <span className="sl-lecturer-recommendation">Đề xuất</span>}
          </div>
          {group.lecturers.map((row) =>
          <button key={row.id} type="button" role="option" aria-selected={row.id === value} disabled={row.busy || row.active === false} onClick={() => { onChange(row.id); setOpen(false); }}>
            <strong>{row.name}</strong>
            {row.busy ? <em className="sl-lecturer-busy">Đang bận</em> : row.active === false ? <em>Ngừng hoạt động</em> : null}
          </button>)}
        </React.Fragment>)}
        {!visible.length && <p>Không tìm thấy giảng viên phù hợp.</p>}
      </div>
    </div>}
  </div>;
}

