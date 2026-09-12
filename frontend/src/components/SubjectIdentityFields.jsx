import React, { useMemo } from "react";
import {
  Alert, Box, CircularProgress, MenuItem, Paper, Stack, Switch, TextField, Typography,
} from "@mui/material";

export const emptySubjectIdentity = () => ({
  allowCrossMajor: false,
  canonicalSubjectId: null,
});

export const normalizeSubjectIdentity = (subject) => {
  return {
    canonicalSubjectId: null,
    allowCrossMajor: Boolean(subject?.allowCrossMajor || subject?.canonicalSubjectId),
  };
};

export const buildSubjectIdentityPayload = (identity) => normalizeSubjectIdentity(identity);

export const setSubjectRootEnabled = (enabled) => ({
  canonicalSubjectId: null,
  allowCrossMajor: Boolean(enabled),
});

export const setSubjectCanonicalRoot = (canonicalSubjectId) => ({
  canonicalSubjectId: canonicalSubjectId || null,
  allowCrossMajor: false,
});

export const filterSubjectRootCandidates = (subjects, currentSubjectId, program) => (
  (Array.isArray(subjects) ? subjects : []).filter((subject) => (
    subject.id !== currentSubjectId
    && subject.program === program
    && subject.active === true
    && subject.allowCrossMajor === true
    && !subject.canonicalSubjectId
  ))
);

const subjectCode = (subject) => subject?.codeText || subject?.code || subject?.codeNumber || "—";

const subjectLabel = (subject) => {
  const major = subject?.major?.code || subject?.major?.name || "Chưa xác định ngành";
  return `${subjectCode(subject)} · ${subject?.name || "Chưa có tên"} · ${major}`;
};

const SubjectIdentityFields = ({
  subject,
  identity,
  onChange,
  program,
  subjects,
  loading = false,
  error = "",
}) => {
  const value = normalizeSubjectIdentity(identity);
  const candidates = useMemo(
    () => filterSubjectRootCandidates(subjects, subject?.id, program),
    [program, subject?.id, subjects],
  );
  const selectedRoot = candidates.find((candidate) => candidate.id === value.canonicalSubjectId);

  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.5, borderColor: "#C9D9E4", bgcolor: "#F8FBFD", borderRadius: "3px" }}
    >
      <Stack spacing={1.25}>
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#173E75" }}>
            Học phần dùng chung giữa các ngành
          </Typography>
          <Typography variant="caption" sx={{ color: "#607486" }}>
            Chỉ cấu hình khi đây là học phần gốc dùng chung hoặc là bản ghi tương ứng của một ngành khác.
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 280 }}>
            <Switch
              size="small"
              checked={value.allowCrossMajor}
              disabled={Boolean(value.canonicalSubjectId)}
              onChange={(event) => onChange(setSubjectRootEnabled(event.target.checked))}
              inputProps={{ "aria-label": "Cho phép ghép lớp khác ngành" }}
            />
            <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>
              Cho phép ghép lớp khác ngành
            </Typography>
          </Stack>

          <TextField
            select
            size="small"
            label="Học phần chung tương ứng"
            value={value.canonicalSubjectId || ""}
            disabled={value.allowCrossMajor || loading}
            onChange={(event) => onChange(setSubjectCanonicalRoot(event.target.value))}
            sx={{ minWidth: { xs: "100%", md: 390 }, bgcolor: "#fff" }}
            InputLabelProps={{ shrink: true }}
            SelectProps={{ displayEmpty: true }}
            inputProps={{ "aria-label": "Học phần chung tương ứng" }}
          >
            <MenuItem value="">Không ánh xạ tới học phần khác</MenuItem>
            {value.canonicalSubjectId && !selectedRoot && (
              <MenuItem value={value.canonicalSubjectId} disabled>
                Đang tải học phần gốc đã ánh xạ…
              </MenuItem>
            )}
            {candidates.map((candidate) => (
              <MenuItem key={candidate.id} value={candidate.id}>
                {subjectLabel(candidate)}
              </MenuItem>
            ))}
          </TextField>

          {loading && <CircularProgress size={20} aria-label="Đang tải học phần gốc" />}
        </Stack>

        {error && <Alert severity="error" sx={{ py: 0 }}>{error}</Alert>}

        {value.canonicalSubjectId && selectedRoot && (
          <Alert severity="warning" sx={{ py: 0.25 }}>
            <strong>{subjectCode(subject)} · {subject?.name || "Học phần đang cấu hình"}</strong>
            {" sẽ được xem là cùng học phần logic với "}
            <strong>{subjectCode(selectedRoot)} · {selectedRoot.name}</strong>
            {" trong chức năng Tạo lớp học phần / Xếp lịch."}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
};

export default SubjectIdentityFields;
