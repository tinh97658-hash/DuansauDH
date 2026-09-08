import React, { useMemo } from "react";
import {
  Alert, Box, CircularProgress, MenuItem, Paper, Stack, Checkbox, FormControlLabel, TextField, Typography,
} from "@mui/material";

export const emptySubjectIdentity = () => ({
  allowCrossMajor: false,
  canonicalSubjectId: null,
});

export const normalizeSubjectIdentity = (subject) => {
  const canonicalSubjectId = subject?.canonicalSubjectId || null;
  return {
    canonicalSubjectId,
    allowCrossMajor: canonicalSubjectId ? false : Boolean(subject?.allowCrossMajor),
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
  const selectedRoot = candidates.find((candidate) => candidate.id === value.canonicalSubjectId) || subject?.canonicalSubject;

  return (
    <Paper
      variant="outlined"
      data-testid="subject-identity-fields"
      sx={{ p: 1.5, borderColor: "#C9D9E4", bgcolor: "#F8FBFD", borderRadius: "3px" }}
    >
      <Stack spacing={1.25}>
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#173B70" }}>
            Học phần dùng chung giữa các ngành
          </Typography>
          <Typography variant="caption" sx={{ color: "#68737D" }}>
            Chỉ cấu hình khi đây là học phần gốc dùng chung hoặc là bản ghi tương ứng của một ngành khác.
          </Typography>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(180px, 0.7fr) minmax(0, 1.3fr)" }, gap: 2, alignItems: "end" }}>
          <Box>
            <FormControlLabel sx={{ m: 0, minHeight: 36 }} label="Có thể ghép lớp" control={
              <Checkbox size="small"
                checked={value.canonicalSubjectId ? selectedRoot?.allowCrossMajor === true : value.allowCrossMajor}
                disabled={Boolean(value.canonicalSubjectId)}
                onChange={(event) => onChange(setSubjectRootEnabled(event.target.checked))}
                inputProps={{ "aria-label": "Có thể ghép lớp" }} />
            } />
            {value.canonicalSubjectId && <Typography variant="caption" display="block">Theo cấu hình của học phần chung tương ứng.</Typography>}
          </Box>
          <Box sx={{ minWidth: 0 }}>
          <Typography component="label" htmlFor="shared-subject-root" sx={{ display: "block", mb: 0.75, fontSize: 12.5, color: "text.secondary" }}>Học phần chung tương ứng</Typography>
          <TextField
            select
            size="small"
            id="shared-subject-root"
            value={value.canonicalSubjectId || ""}
            disabled={value.allowCrossMajor || loading}
            onChange={(event) => onChange(setSubjectCanonicalRoot(event.target.value))}
            fullWidth
            sx={{ bgcolor: "#fff", "& .MuiSelect-select": { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }}
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

          </Box>
          {loading && <CircularProgress size={20} aria-label="Đang tải học phần gốc" />}
        </Box>

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
