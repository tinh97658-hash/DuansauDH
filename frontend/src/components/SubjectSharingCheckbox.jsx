import React, { useState } from "react";
import { Checkbox, Tooltip } from "@mui/material";
import { toast } from "react-toastify";

export default function SubjectSharingCheckbox({ subject, disabled = false, onChange }) {
  const [saving, setSaving] = useState(false);
  const checked = Boolean(subject.allowCrossMajor || subject.canonicalSubjectId);

  const handleChange = async (event) => {
    setSaving(true);
    try {
      await onChange({
        allowCrossMajor: event.target.checked,
        canonicalSubjectId: null,
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể cập nhật lựa chọn học chung khác ngành");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Tooltip title="Tự động cho phép ghép lớp với môn trùng tên và số tín chỉ ở ngành khác">
      <span onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
        <Checkbox
          size="small"
          checked={checked}
          disabled={disabled || saving}
          onChange={handleChange}
          inputProps={{ "aria-label": `Học chung khác ngành: ${subject.name || "Học phần mới"}` }}
          sx={{ p: 0.5 }}
        />
      </span>
    </Tooltip>
  );
}
