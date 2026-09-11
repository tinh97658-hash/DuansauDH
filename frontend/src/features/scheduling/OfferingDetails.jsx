import React, { useState } from "react";
import { api, groupsOf, message, Modal, Notice, offeringTitle, rows, subjectLabel, useLoad } from "./shared";
import { shortTime, vietnameseDate, vietnameseDayLabel, isSessionPast } from "../../utils/schedulingCalendar";

export default function OfferingDetails({ offering, user, onClose, onSaved, onOpenSession, onSelect }) {
  const detail = useLoad(() => api.get(`/scheduling/course-offerings/${offering.id}`), [offering.id]);
  const roster = useLoad(() => api.get(`/scheduling/course-offerings/${offering.id}/roster`), [offering.id]);
  const sessions = useLoad(async () => rows(await api.get(`/scheduling/course-offerings/${offering.id}/teaching-sessions`)), [offering.id]);
  const unresolved = useLoad(async () => rows(await api.get(`/scheduling/course-offerings/${offering.id}/unresolved-teaching-sessions`)), [offering.id]);
  const [sessionFilter, setSessionFilter] = useState("all");
  const [notes, setNotes] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [retakeId, setRetakeId] = useState("");
  const [retakeOpen, setRetakeOpen] = useState(false);
  const [success, setSuccess] = useState("");
  const value = detail.data || offering;
  const canManage = user?.canManageScheduling === true;
  const canNotes = canManage || user?.role === "admin";
  const summary = value.sessionSummary || {};
  const allSessions = sessions.data || [];

  const getSessionCategory = (s) => {
    if (s.status === "held") return "held";
    if (s.status === "not_held") return "not_held";
    if (s.status === "planned") {
      return isSessionPast(s) ? "pending" : "future";
    }
    return "other";
  };

  const getSessionBadge = (s) => {
    const cat = getSessionCategory(s);
    if (cat === "held") return { label: "Đã diễn ra", color: "#1b8754", bg: "#e8f5e9" };
    if (cat === "pending") return { label: "Chờ xác nhận", color: "#c57a00", bg: "#fff3cd" };
    if (cat === "future") return { label: "Đã xếp sắp tới", color: "#0d6efd", bg: "#e7f1ff" };
    if (cat === "not_held") return { label: "Không diễn ra", color: "#dc3545", bg: "#f8d7da" };
    return { label: s.status, color: "#6c757d", bg: "#e9ecef" };
  };

  const filteredSessions = allSessions.filter((s) => {
    if (sessionFilter === "all") return true;
    return getSessionCategory(s) === sessionFilter;
  });

  const statCards = [
    { key: "held", count: summary.heldCount || 0, label: "Đã diễn ra", color: "#1b8754" },
    { key: "pending", count: summary.pendingCount || 0, label: "Chờ xác nhận", color: "#c57a00" },
    { key: "future", count: summary.futurePlannedCount || 0, label: "Đã xếp sắp tới", color: "#0d6efd" },
  ];

  const mutate = async (action, done) => {
    setSaving(true); setError(""); setSuccess("");
    try { await action(); if (done) done(); }
    catch (failure) { setError(message(failure)); }
    finally { setSaving(false); }
  };
  const saveNotes = () => mutate(() => api.put(`/scheduling/course-offerings/${offering.id}/roster-notes`, {
    participantNotes: (roster.data?.participants || []).map((row) => ({ participantId: row.id, note: (notes[row.id] !== undefined ? notes[row.id] : row.note || "").trim() })).filter((row) => row.note),
  }), () => { setSuccess("Đã lưu ghi chú."); roster.reload(); setNotes({}); });
  return <Modal wide hideHeader className="sl-offering-drawer" bodyClassName="sl-offering-body" title="CHI TIẾT LỚP HỌC PHẦN" busy={saving} onClose={onClose} actions={<>
    {canManage && value.status === "active" && onSelect && <><button className="sl-btn" onClick={() => onSelect(value)}>Xếp lịch / Xếp thêm</button><button className="sl-btn sl-btn-primary" disabled={saving || detail.loading || unresolved.loading || !!unresolved.error || !summary.heldCount || !!unresolved.data?.length} onClick={() => setCompleting(true)}>Xác nhận hoàn thành giảng dạy</button></>}
    {canManage && value.status === "completed" && <button className="sl-btn" disabled={roster.loading || !!roster.error} onClick={() => setRetakeOpen(true)}>Ghi nhận học viên cần học lại</button>}
  </>}>
    <header className="sl-offering-hero"><div><div className="sl-eyebrow">LỚP HỌC PHẦN</div><h2>{offeringTitle(value)}</h2><strong>{subjectLabel(value)}</strong><p>{groupsOf(value).length} lớp/nhóm · {value.participantCount ?? 0} học viên</p><span className={`sl-state ${value.status === "completed" ? "sl-complete" : "sl-progress"}`}>{value.status === "completed" ? "HOÀN THÀNH" : "ĐANG DẠY"}</span></div><button className="sl-drawer-close" aria-label="Đóng" disabled={saving} onClick={onClose}>×</button></header>
    <div className="sl-offering-content">{detail.error && <Notice error={detail.error} />}{error && <Notice error={error} />}{success && <Notice>{success}</Notice>}
      <div className="sl-offering-stats">
        {statCards.map((item) => {
          const isActive = sessionFilter === item.key;
          return (
            <div
              key={item.key}
              className={`sl-stat-clickable ${isActive ? "sl-stat-active" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => setSessionFilter((prev) => (prev === item.key ? "all" : item.key))}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSessionFilter((prev) => (prev === item.key ? "all" : item.key)); }}
              title={`Bấm để lọc các buổi ${item.label.toLowerCase()}`}
            >
              <strong style={{ color: isActive ? item.color : undefined }}>{item.count}</strong>
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>

      {/* Danh sách lịch học đã xếp */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "24px 0 10px", flexWrap: "wrap", gap: 8 }}>
        <h3 className="sl-offering-groups-title" style={{ margin: 0 }}>
          LỊCH HỌC ĐÃ XẾP {allSessions.length > 0 && `(${allSessions.length} buổi)`}
        </h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            className={`sl-filter-chip ${sessionFilter === "all" ? "active" : ""}`}
            onClick={() => setSessionFilter("all")}
          >
            Tất cả ({allSessions.length})
          </button>
          <button
            type="button"
            className={`sl-filter-chip ${sessionFilter === "future" ? "active" : ""}`}
            onClick={() => setSessionFilter("future")}
          >
            Sắp tới ({summary.futurePlannedCount || 0})
          </button>
          <button
            type="button"
            className={`sl-filter-chip ${sessionFilter === "pending" ? "active" : ""}`}
            onClick={() => setSessionFilter("pending")}
          >
            Chờ xác nhận ({summary.pendingCount || 0})
          </button>
          <button
            type="button"
            className={`sl-filter-chip ${sessionFilter === "held" ? "active" : ""}`}
            onClick={() => setSessionFilter("held")}
          >
            Đã diễn ra ({summary.heldCount || 0})
          </button>
        </div>
      </div>

      {sessions.loading ? (
        <Notice>Đang tải danh sách lịch học...</Notice>
      ) : sessions.error ? (
        <Notice error={sessions.error} />
      ) : filteredSessions.length === 0 ? (
        <div style={{ padding: "18px", textAlign: "center", background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 6, color: "#64748b" }}>
          {allSessions.length === 0 ? (
            <>
              <p style={{ margin: "0 0 10px 0", fontSize: "14px" }}>Chưa có buổi học nào được xếp lịch cho lớp học phần này.</p>
              {canManage && value.status === "active" && onSelect && (
                <button type="button" className="sl-btn sl-btn-primary" style={{ padding: "6px 16px", fontSize: "13px" }} onClick={() => onSelect(value)}>
                  🗓️ Xếp lịch ngay
                </button>
              )}
            </>
          ) : (
            <p style={{ margin: 0, fontSize: "13px" }}>Không có buổi học nào phù hợp với bộ lọc hiện tại.</p>
          )}
        </div>
      ) : (
        <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #d5dfe6", borderRadius: 4, background: "#fff" }}>
          <table className="v20-table sl-sessions-table">
            <thead>
              <tr>
                <th style={{ width: 44, textAlign: "center" }}>STT</th>
                <th style={{ width: 145 }}>NGÀY HỌC</th>
                <th style={{ width: 135 }}>CA / GIỜ HỌC</th>
                <th>PHÒNG HỌC</th>
                <th>GIẢNG VIÊN</th>
                <th style={{ width: 125, textAlign: "center" }}>TRẠNG THÁI</th>
                {(onOpenSession || onSelect) && <th style={{ width: 90, textAlign: "right" }}>THAO TÁC</th>}
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((session, index) => {
                const badge = getSessionBadge(session);
                const periodText = session.period === "MORNING" ? "Sáng" : "Chiều";
                const timeText = `${shortTime(session.startTime)} - ${shortTime(session.endTime)}`;
                return (
                  <tr
                    key={session.id}
                    style={{ cursor: onOpenSession ? "pointer" : "default" }}
                    onClick={() => onOpenSession && onOpenSession(session)}
                  >
                    <td style={{ textAlign: "center", fontWeight: 600, color: "#64748b" }}>{index + 1}</td>
                    <td>
                      <strong style={{ color: "#173e75" }}>{vietnameseDayLabel(session.sessionDate)}</strong>
                      <div style={{ fontSize: "11.5px", color: "#64748b" }}>{vietnameseDate(session.sessionDate)}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: session.period === "MORNING" ? "#0b7285" : "#d9480f" }}>{periodText}</span>
                      <div style={{ fontSize: "12px", color: "#475569" }}>{timeText}</div>
                    </td>
                    <td>
                      <strong>{session.room?.code || "Chưa xếp"}</strong>
                      {session.room?.name && <div style={{ fontSize: "11.5px", color: "#64748b" }}>{session.room.name}</div>}
                    </td>
                    <td>
                      <strong>{session.lecturer?.name || "Chưa phân công"}</strong>
                      {session.lecturer?.code && <div style={{ fontSize: "11.5px", color: "#64748b" }}>{session.lecturer.code}</div>}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: badge.color,
                        background: badge.bg,
                        whiteSpace: "nowrap",
                      }}>
                        {badge.label}
                      </span>
                    </td>
                    {(onOpenSession || onSelect) && (
                      <td style={{ textAlign: "right" }}>
                        {onOpenSession ? (
                          <button
                            type="button"
                            className="sl-btn"
                            style={{ padding: "2px 8px", fontSize: "12px", height: "auto", minHeight: "26px" }}
                            onClick={(e) => { e.stopPropagation(); onOpenSession(session); }}
                          >
                            Chi tiết
                          </button>
                        ) : onSelect ? (
                          <button
                            type="button"
                            className="sl-btn"
                            style={{ padding: "2px 8px", fontSize: "12px", height: "auto", minHeight: "26px" }}
                            onClick={(e) => { e.stopPropagation(); onSelect(value); }}
                          >
                            Lịch tuần
                          </button>
                        ) : null}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <h3 className="sl-offering-groups-title">LỚP / NHÓM THAM GIA</h3>
      <div className="sl-offering-groups">{groupsOf(value).map((group) => <div key={group.id}><strong>{group.name || group.code}</strong><span>{group.major?.name || value.subject?.major?.name || "Chưa có chuyên ngành"} · {group.memberCount ?? 0} học viên</span></div>)}</div>
      <h3 className="sl-offering-groups-title" style={{ marginTop: 14 }}>DANH SÁCH HỌC VIÊN</h3>
      {roster.loading ? <Notice>Đang tải danh sách...</Notice> : roster.error ? <Notice error={roster.error} /> : (
        <>
          <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #d5dfe6", borderRadius: 4, background: "#fff" }}>
            <table className="v20-table">
              <thead><tr><th>STT</th><th>HỌC VIÊN</th><th>GHI CHÚ</th></tr></thead>
              <tbody>
                {(roster.data?.participants || []).map((row, index) => (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td><strong>{row.code}</strong><br /><span>{row.fullName}</span></td>
                    <td>
                      <input
                        aria-label={`Ghi chú ${row.code}`}
                        maxLength={2000}
                        disabled={!canNotes || saving}
                        value={notes[row.id] !== undefined ? notes[row.id] : (row.note || "")}
                        placeholder="Ghi chú..."
                        onChange={(event) => {
                          const note = event.target.value;
                          setNotes((current) => ({ ...current, [row.id]: note }));
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canNotes && (
            <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="sl-btn"
                disabled={saving || !Object.keys(notes).length}
                onClick={saveNotes}
              >
                Lưu ghi chú
              </button>
            </div>
          )}
        </>
      )}
    </div>
    {completing && <Modal title="Hoàn thành giảng dạy" onClose={() => setCompleting(false)} busy={saving} actions={<><button className="sl-btn" disabled={saving} onClick={() => setCompleting(false)}>Hủy</button><button className="sl-btn sl-btn-primary" disabled={saving} onClick={() => mutate(() => api.put(`/scheduling/course-offerings/${value.id}/completion`, {}), onSaved)}>Xác nhận hoàn thành</button></>}><p>Xác nhận lớp {value.subject?.code} đã hoàn thành giảng dạy? Lớp hoàn thành sẽ không được xếp thêm buổi học.</p>{error && <Notice error={error} />}</Modal>}
    {retakeOpen && <Modal title="Ghi nhận nhu cầu học lại" onClose={() => setRetakeOpen(false)} busy={saving} actions={<><button className="sl-btn" disabled={saving} onClick={() => setRetakeOpen(false)}>Hủy</button><button className="sl-btn sl-btn-primary" disabled={saving || !retakeId} onClick={() => mutate(() => api.post("/scheduling/retakes", { sourceCourseOfferingId: value.id, participantId: retakeId }), () => { setRetakeOpen(false); setSuccess("Đã ghi nhận nhu cầu học lại. Học viên sẽ xuất hiện khi tổ chức học phần phù hợp cho khóa sau."); })}>Ghi nhận học lại</button></>}>
      <p>Chọn học viên của lớp đã hoàn thành có nhu cầu học lại học phần {value.subject?.name}.</p><label className="v20-field">Học viên<select aria-label="Học viên cần học lại" value={retakeId} onChange={(event) => setRetakeId(event.target.value)}><option value="">Chọn học viên</option>{roster.data?.participants.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.fullName}</option>)}</select></label>{error && <Notice error={error} />}
    </Modal>}
  </Modal>;
}
