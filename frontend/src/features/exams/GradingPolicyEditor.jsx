import React, { useState } from "react";
import { Alert, Box, Button, FormControlLabel, IconButton, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import { calculatePolicyGrade, clonePolicy, DEFAULT_GRADING_POLICY, numericPolicy, POLICY_COMPONENTS, policyError } from "./gradingPolicy";

export default function GradingPolicyEditor({ subject, policy, mode, onApply, readOnly = false, shared = false }) {
  const draft = policy;
  const setDraft = update => onApply(update(clonePolicy(policy)));
  const [example, setExample] = useState({ testScore: "", assignmentScore: "", examScore: "", courseScore: "" });
  const conversion = mode === "conversion";
  const invalid = policyError(draft);
  const numeric = numericPolicy(draft);
  const roundedExample = Object.fromEntries(POLICY_COMPONENTS.map(([key]) => [key, example[key] === "" ? null : Math.round((Number(example[key]) + Number.EPSILON * 10) * 10) / 10]));
  const sharedScore = example.courseScore === "" ? null : Math.round((Number(example.courseScore) + Number.EPSILON * 10) * 10) / 10;
  const band = numeric.bands.find(level => sharedScore >= level.minimum);
  const sharedComplete = sharedScore !== null && Number.isFinite(sharedScore) && sharedScore >= 0 && sharedScore <= 10
    && (conversion || POLICY_COMPONENTS.every(([key]) => roundedExample[key] !== null && Number.isFinite(roundedExample[key]) && roundedExample[key] >= 0 && roundedExample[key] <= 10));
  const preview = invalid ? null : shared ? sharedComplete && band ? { courseScore: sharedScore, grade4: band.grade4, letterGrade: band.letter,
    result: sharedScore >= numeric.courseMinimum && POLICY_COMPONENTS.every(([key]) => roundedExample[key] >= numeric.minimums[key]) ? "passed" : "failed" } : null : calculatePolicyGrade(roundedExample, numeric);
  const bands = draft.useDefaultBands ? DEFAULT_GRADING_POLICY.bands : draft.bands;
  const field = (label, value, change, max = 10, disabled = false, showLabel = true) => {
    const input = <TextField size="small" fullWidth type="number" value={value}
      disabled={readOnly || disabled} onChange={event => change(event.target.value)} inputProps={{ min: 0, max, step: 0.1, "aria-label": label }} />;
    return showLabel ? <Box component="label" sx={{ display: "grid", gap: "6px", minWidth: 0, m: 0 }}>
      <Box component="span" sx={{ color: "#526A82", fontSize: "10.5px", fontWeight: 700, letterSpacing: ".025em", lineHeight: 1.2, textTransform: "uppercase" }}>{label}</Box>
      {input}
    </Box> : input;
  };
  const editBand = (index, key, value) => setDraft(current => ({ ...current, bands: current.bands.map((band, position) => position === index ? { ...band, [key]: value } : band) }));

  return <Stack spacing={2} role="region" aria-label={conversion ? "Quy đổi điểm của môn" : "Điều kiện đạt của môn"}>
      <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{conversion ? "Quy đổi thang 10 sang thang 4 và điểm chữ" : "Điều kiện đạt"}{shared ? " · Áp dụng chung cho tất cả học phần" : ` · ${subject.name}`}</Typography>
      {conversion ? <>
        <FormControlLabel control={<Switch checked={draft.useDefaultBands} disabled={readOnly} onChange={event => setDraft(current => ({ ...current, useDefaultBands: event.target.checked }))} />}
          label="Dùng bảng quy đổi chung" />
        <Typography variant="body2">Mỗi mức áp dụng từ ngưỡng đã nhập đến trước ngưỡng cao hơn kế tiếp. Điểm học phần được làm tròn 1 chữ số thập phân trước khi quy đổi.</Typography>
        <TableContainer><Table size="small" aria-label="Bảng quy đổi điểm">
          <TableHead><TableRow><TableCell>Điểm thang 10 từ</TableCell><TableCell>Điểm chữ</TableCell><TableCell>Điểm thang 4</TableCell><TableCell>Thao tác</TableCell></TableRow></TableHead>
          <TableBody>{bands.map((band, index) => <TableRow key={index}>
            <TableCell>{field(`Ngưỡng thang 10 mức ${index + 1}`, band.minimum, value => editBand(index, "minimum", value), 10, draft.useDefaultBands, false)}</TableCell>
            <TableCell><TextField size="small" fullWidth value={band.letter} disabled={readOnly || draft.useDefaultBands} onChange={event => editBand(index, "letter", event.target.value.toUpperCase())}
              inputProps={{ "aria-label": `Điểm chữ mức ${index + 1}`, maxLength: 10 }} /></TableCell>
            <TableCell>{field(`Thang 4 mức ${index + 1}`, band.grade4, value => editBand(index, "grade4", value), 4, draft.useDefaultBands, false)}</TableCell>
            <TableCell><IconButton size="small" color="error" disabled={readOnly || draft.useDefaultBands || bands.length <= 1} onClick={() => setDraft(current => ({ ...current, bands: current.bands.filter((_, position) => position !== index) }))}
              aria-label={`Xóa mức quy đổi ${index + 1}`} title="Xóa mức quy đổi" sx={{ "&.Mui-disabled": { color: "error.main", opacity: 0.4 } }}><DeleteRounded fontSize="small" /></IconButton></TableCell>
          </TableRow>)}</TableBody>
        </Table></TableContainer>
        {!draft.useDefaultBands && <Button variant="outlined" disabled={readOnly || bands.length >= 20} onClick={() => setDraft(current => ({ ...current, bands: [...current.bands, { minimum: "", letter: "", grade4: "" }] }))}>Thêm mức quy đổi</Button>}
      </> : <>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 2, alignItems: "start" }}>
          {POLICY_COMPONENTS.map(([key, label]) => <Box key={key}>
            {field(`${label} tối thiểu`, draft.minimums[key], value => setDraft(current => ({ ...current, minimums: { ...current.minimums, [key]: value } })), 10, !shared && Number(draft.weights[key]) === 0)}
            {!shared && <Typography variant="caption" color="text.secondary">Tỷ trọng {draft.weights[key]}%{Number(draft.weights[key]) === 0 ? " · Không đối chiếu" : ""}</Typography>}
          </Box>)}
          {field("Điểm học phần tối thiểu để đạt", draft.courseMinimum, value => setDraft(current => ({ ...current, courseMinimum: value })))}
        </Box>
        <Typography variant="body2">Đạt khi mọi thành phần có tỷ trọng lớn hơn 0 thỏa điểm tối thiểu và điểm học phần sau làm tròn thỏa ngưỡng đạt. Ngưỡng 0 không giới hạn thành phần đó.</Typography>
      </>}
      {invalid && <Alert severity="error">{invalid}</Alert>}
      <Box sx={{ p: 1.5, border: "1px solid var(--table-border-color, #D7E4EE)", borderRadius: "4px" }}>
        <Typography sx={{ mb: 1.5, fontWeight: 700, fontSize: 13 }}>Thử tính điểm</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          {(!shared || !conversion) && POLICY_COMPONENTS.map(([key, label]) => <Box key={key} sx={{ flex: 1 }}>{field(`Điểm mẫu ${label.toLocaleLowerCase("vi")}`, example[key], value => setExample(current => ({ ...current, [key]: value })), 10, !shared && Number(draft.weights[key]) === 0)}</Box>)}
          {shared && <Box sx={{ flex: 1 }}>{field("Điểm mẫu học phần (thang 10)", example.courseScore, value => setExample(current => ({ ...current, courseScore: value })))}</Box>}
        </Stack>
        <Typography sx={{ mt: 1.5, fontSize: 13 }} role="status">{preview?.courseScore == null ? shared ? conversion ? "Nhập điểm mẫu học phần để xem kết quả quy đổi." : "Nhập đủ điểm mẫu các thành phần và điểm học phần để đối chiếu điều kiện đạt." : "Nhập đủ điểm mẫu của các thành phần có tỷ trọng để xem kết quả." :
          `Thang 10: ${preview.courseScore.toFixed(1)} · Thang 4: ${preview.grade4} · Điểm chữ: ${preview.letterGrade}${shared && conversion ? "" : ` · ${preview.result === "passed" ? "Đạt" : "Không đạt"}`}`}</Typography>
        {shared && !conversion && <Typography variant="caption">Mẫu này đối chiếu cả ba thành phần. Khi tính điểm thực tế, thành phần có tỷ trọng 0% của môn được bỏ qua.</Typography>}
      </Box>
      <Typography variant="caption" color="text.secondary">{shared ? "Bấm “Lưu cấu hình” để lưu điều kiện đạt và quy đổi chung cho tất cả học phần, mọi năm và chuyên ngành." : "Bấm “Lưu cấu hình” để lưu cho môn và năm đang chọn."} Các điểm đã lưu trước đó giữ nguyên cách tính cũ.</Typography>
    </Stack>;
}
