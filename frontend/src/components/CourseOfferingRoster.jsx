import React from "react";
import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";

export const participantKey = (participant) => participant.identity
  || (participant.studentId ? "student:" + participant.studentId : "admission:" + participant.admissionRecordId);

export default function CourseOfferingRoster({ participants, notes, onNoteChange, disabled = false }) {
  return <Box data-testid="course-offering-roster">
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
      <Typography variant="subtitle2">DANH SÁCH HỌC VIÊN</Typography>
      <Typography variant="body2">{participants.length} học viên</Typography>
    </Stack>
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small" aria-label="Danh sách học viên">
        <TableHead><TableRow>
          <TableCell sx={{ width: "6%" }}>STT</TableCell>
          <TableCell sx={{ width: "16%" }}>Mã học viên</TableCell>
          <TableCell sx={{ width: "46%" }}>Họ và tên học viên</TableCell>
          <TableCell sx={{ width: "32%" }}>Ghi chú</TableCell>
        </TableRow></TableHead>
        <TableBody>{participants.map((participant, index) => <TableRow key={participantKey(participant)}>
          <TableCell>{String(index + 1).padStart(2, "0")}</TableCell>
          <TableCell>{participant.regNo || "—"}</TableCell>
          <TableCell>{participant.fullName || "—"}</TableCell>
          <TableCell><TextField size="small" fullWidth placeholder="Nhập ghi chú..." disabled={disabled}
            inputProps={{ "aria-label": "Ghi chú " + (participant.regNo || participant.fullName), maxLength: 2000 }}
            value={notes[participantKey(participant)] ?? participant.note ?? ""}
            onChange={(event) => onNoteChange(participantKey(participant), event.target.value)} /></TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </Box>
    {!participants.length && <Typography color="text.secondary" sx={{ p: 2 }}>Lớp / nhóm được chọn chưa có học viên.</Typography>}
  </Box>;
}
