import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { API_BASE_URL } from "../config/http";
export default function ClassRoster({ classId, onClose, onChanged }) {
  const [group, setGroup] = useState(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState({});
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!classId) return;
    setLoading(true); setError("");
    try {
      const [response, auth] = await Promise.all([axios.get(API_BASE_URL + "/masters/class-groups/" + classId), axios.get(API_BASE_URL + "/auth/session")]);
      setGroup(response.data); setName(response.data.name);
      setNotes(Object.fromEntries((response.data.members || []).map((m) => [m.id, m.note || ""])));
      setCanManage(auth.data?.user?.canManageScheduling === true);
    } catch (e) { setError(e.response?.data?.message || "Không tải được lớp học phần."); }
    finally { setLoading(false); }
  }, [classId]);
  useEffect(() => { setGroup(null); load(); }, [load]);
  const saveName = async () => {
    setSaving(true); setError("");
    try {
      await axios.put(API_BASE_URL + "/masters/class-groups/" + classId + "/name", { name: name.trim() });
      setGroup((g) => ({ ...g, name: name.trim() })); onChanged?.();
    } catch (e) { setError(e.response?.data?.message || "Không đổi được tên lớp."); }
    finally { setSaving(false); }
  };
  const saveNote = async (member) => {
    setSaving(true); setError("");
    try {
      await axios.put(API_BASE_URL + "/masters/class-groups/" + classId + "/member-notes/" + member.id, { note: notes[member.id] || "" });
      setGroup((g) => ({ ...g, members: g.members.map((m) => m.id === member.id ? { ...m, note: notes[m.id] } : m) }));
    } catch (e) { setError(e.response?.data?.message || "Không lưu được ghi chú; vui lòng thử lại."); }
    finally { setSaving(false); }
  };
  return <Box data-testid="class-roster">
    <DialogTitle>{"DANH SÁCH HỌC VIÊN — " + (group?.name || "")}</DialogTitle>
    <DialogContent>
      {error && <Alert severity="error" action={<Button onClick={load}>Tải lại</Button>}>{error}</Alert>}
      {loading ? <Typography role="status">Đang tải học viên...</Typography> : group && <>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ my: 2 }}>
          <TextField label="Tên lớp" fullWidth size="small" value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage || saving} inputProps={{ maxLength: 200 }} />
          {canManage && <Button onClick={saveName} disabled={!name.trim() || saving || name.trim() === group.name}>Đổi tên</Button>}
        </Stack>
        <Typography variant="body2">{group.major?.name} · {group.members?.length || 0} học viên</Typography>
        <TableContainer><Table size="small" sx={{ minWidth: 560 }}><TableHead><TableRow>
          {["STT", "Mã HV", "Họ tên", "Ghi chú"].map((label) => <TableCell key={label}>{label}</TableCell>)}
        </TableRow></TableHead><TableBody>
          {(group.members || []).map((member, index) => <TableRow key={member.id}>
            <TableCell>{index + 1}</TableCell><TableCell>{member.student?.regNo || member.admissionRecord?.code || "—"}</TableCell>
            <TableCell>{member.student?.fullName || member.admissionRecord?.fullName || "—"}</TableCell>
            <TableCell>{canManage ? <Stack direction="row" spacing={0.5}><TextField size="small" value={notes[member.id] || ""} disabled={saving} inputProps={{ "aria-label": "Ghi chú học viên " + (index + 1), maxLength: 2000 }} onChange={(e) => setNotes((n) => ({ ...n, [member.id]: e.target.value }))} /><Button disabled={saving || (notes[member.id] || "") === (member.note || "")} onClick={() => saveNote(member)}>Lưu</Button></Stack> : member.note || "—"}</TableCell>
          </TableRow>)}
          {!group.members?.length && <TableRow><TableCell colSpan={4}>Lớp chưa có học viên.</TableCell></TableRow>}
        </TableBody></Table></TableContainer>
      </>}
    </DialogContent>{onClose && <DialogActions><Button onClick={onClose} disabled={saving}>Đóng</Button></DialogActions>}
  </Box>;
}
