import React from "react";
import { Box, Button, Chip, Divider, Stack, TableBody, TableCell, TableContainer, TableRow, Typography } from "@mui/material";
import ResizableTable from "../../components/ResizableTable";

const columns = [
  { key: "subject", label: "Học phần", width: 420, minWidth: 200 },
  { key: "source", label: "Nguồn học", width: 180, minWidth: 120 },
  { key: "status", label: "Trạng thái", width: 170, minWidth: 140, align: "center" },
  { key: "result", label: "Kết quả", width: 160, minWidth: 120, align: "center" },
  { key: "actions", label: "Thao tác", width: 280, minWidth: 230, align: "center" },
];

export default function LearningTables({ studied, approvals, learningResults, sourceLabel, statusLabel, resultLabel, subjectLabel,
  onEdit, onSubmitDecision, busy }) {
  const studiedColumns = columns.slice(0, 4);
  return <>
    <TableContainer>
      <ResizableTable columns={studiedColumns} storageKey="learner-studied-subject-columns" aria-label="Học phần đã học trong chương trình đào tạo">
        <TableBody data-testid={studied.length ? "studied-subjects" : undefined}>
          {!studied.length && <TableRow><TableCell colSpan={studiedColumns.length} align="center">Học viên chưa có học phần đã học có kết quả trong chương trình đào tạo.</TableCell></TableRow>}
          {studied.map(row => {
            return <TableRow key={row.subject?.id || row.id} hover>
              <TableCell>{subjectLabel(row.subject || row.bridgeKnowledgeSubject)}</TableCell>
              <TableCell>{sourceLabel(row.sourceType)}</TableCell>
              <TableCell align="center"><Chip size="small" label={statusLabel(row.status)}
                color={row.result === "failed" ? "warning" : ["passed", "exempt"].includes(row.result) ? "success" : "default"}
                variant={["passed", "exempt"].includes(row.result) ? "filled" : "outlined"}
                sx={row.result === "failed" ? { borderColor: "#E5B52D", color: "#946200", bgcolor: "#FFFCF0" } : undefined} /></TableCell>
              <TableCell align="center">{row.studyLeaveFailure ? "Không đạt" : row.profileForeignLanguageExempt ? "Miễn thi" : resultLabel(row.result)}</TableCell>
            </TableRow>;
          })}
        </TableBody>
      </ResizableTable>
    </TableContainer>
    <Divider sx={{ my: 2 }} />
    <Typography sx={{ fontSize: 13, fontWeight: 800, mb: 1 }}>Quyết định công nhận học phần ({approvals.length})</Typography>
    <TableContainer>
      <ResizableTable columns={columns} storageKey="learner-recognition-columns" aria-label="Phê duyệt công nhận học phần">
        <TableBody>
          {!approvals.length && <TableRow><TableCell colSpan={columns.length} align="center">Chưa có đề xuất công nhận.</TableCell></TableRow>}
          {approvals.map(row => {
            const original = learningResults.find(item => item.id === (row.learningResultId || row.learningResult?.id));
            const learning = row.learningResult || original;
            const canApprove = learning?.status === "completed" && ["passed", "exempt"].includes(learning.result);
            const locked = row.status !== "pending";
            return <TableRow key={row.id} hover data-testid={`recognition-${row.id}`}>
              <TableCell>
                <Box>{subjectLabel(row.targetSubject || row.sourceSubject || learning?.subject || learning?.bridgeKnowledgeSubject)}</Box>
                {row.decisionNo && <Typography variant="caption" display="block">QĐ: {row.decisionNo}</Typography>}
              </TableCell>
              <TableCell>{sourceLabel(learning?.sourceType || row.sourceType)}</TableCell>
              <TableCell align="center"><Chip size="small" label={row.status === "approved" ? "ĐÃ DUYỆT" : row.status === "rejected" ? "TỪ CHỐI" : "CHỜ DUYỆT"}
                color={row.status === "approved" ? "success" : row.status === "rejected" ? "error" : "warning"} /></TableCell>
              <TableCell align="center">
                {learning?.studyLeaveFailure ? "Không đạt" : resultLabel(learning?.result || "pending")}
                {row.status === "pending" && !canApprove && <Typography variant="caption" display="block" sx={{ whiteSpace: "normal", mt: 0.5, color: "warning.dark" }}>
                  Cần hoàn thành và có kết quả Đạt hoặc Miễn học để duyệt.
                </Typography>}
              </TableCell>
              <TableCell align="center"><Stack direction="row" justifyContent="center" alignItems="center" flexWrap="wrap" sx={{ gap: 0.5 }}>
                <Button size="small" variant="contained" disabled={busy || locked || !canApprove} onClick={() => onSubmitDecision(row, "approved")}>Duyệt</Button>
                <Button size="small" color="error" variant="outlined" disabled={busy || locked} onClick={() => onSubmitDecision(row, "rejected")}>Từ chối</Button>
                {original && <Button size="small" variant="outlined" disabled={busy || locked} onClick={() => onEdit(original, { complete: true })}>Cập nhật kết quả</Button>}
              </Stack></TableCell>
            </TableRow>;
          })}
        </TableBody>
      </ResizableTable>
    </TableContainer>
  </>;
}
