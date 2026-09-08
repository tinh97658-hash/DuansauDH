import React, { useEffect, useState } from "react";
import axios from "axios";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { API_BASE_URL } from "../config/http";
export default function CreateClassFromStudentsDialog({ open, groups, selectedIds, allowEmpty = false, initialGroupId, onClose, onCreated }) {
  const [parentGroupId, setParentGroupId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setParentGroupId(initialGroupId || ""); setName(""); setCode(""); setError(""); } }, [open, initialGroupId]);
  const create = async () => {
    setSaving(true); setError("");
    try {
      const { data } = await axios.post(API_BASE_URL + "/masters/class-groups/from-students", {
        parentGroupId, name: name.trim(), code: code.trim(), admissionRecordIds: selectedIds,
      });
      onCreated(data);
    } catch (e) { setError(e.response?.data?.message || "Không tạo được lớp. Kiểm tra nhóm và danh sách học viên."); }
    finally { setSaving(false); }
  };
  return <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
    <DialogTitle>{allowEmpty ? "Tạo Lớp HP" : "Tạo Lớp HP từ học viên đã chọn"}</DialogTitle><DialogContent>
      {error && <Alert severity="error">{error}</Alert>}
      <Stack spacing={2} sx={{ mt: 1 }}>
        <Typography>{selectedIds.length} học viên đã chọn</Typography>
        <TextField select label="Nhóm HP" value={parentGroupId} onChange={(e) => setParentGroupId(e.target.value)} disabled={saving}>
          {groups.filter((g) => !g.parentGroupId).map((g) => <MenuItem key={g.id} value={g.id}>{g.code} · {g.name}</MenuItem>)}
        </TextField>
        <TextField label="Mã lớp" value={code} onChange={(e) => setCode(e.target.value)} disabled={saving} inputProps={{ maxLength: 30 }} />
        <TextField label="Tên Lớp HP" value={name} onChange={(e) => setName(e.target.value)} disabled={saving} inputProps={{ maxLength: 200 }} />
      </Stack>
    </DialogContent><DialogActions><Button onClick={onClose} disabled={saving}>Hủy</Button><Button variant="contained" onClick={create} disabled={saving || !parentGroupId || !name.trim() || !code.trim() || (!allowEmpty && !selectedIds.length)}>{saving ? "Đang tạo..." : "Tạo"}</Button></DialogActions>
  </Dialog>;
}
