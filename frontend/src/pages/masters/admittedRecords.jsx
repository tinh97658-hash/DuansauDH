import React, { useState } from "react";
import { Alert, Tab, Tabs } from "@mui/material";
import { useSearchParams } from "react-router-dom";
import AdmissionRecords from "../plan/admissionRecords";
import FeatureLayout from "../../components/FeatureLayout";
import LearnerCodeIssue from "../../features/learnerCodes/LearnerCodeIssue";
import { useAuthSession } from "../../context/AuthSession";

const AdmittedRecords = () => {
  const [params, setParams] = useSearchParams();
  const session = useAuthSession();
  const [busy, setBusy] = useState(false);
  const permissions = session?.access?.permissions || [];
  const canOpenCodes = permissions.includes('admission.view') && permissions.includes('route.plan.learner-codes.view');
  const requestedCodes = params.get('tab') === 'learner-codes';
  const codes = requestedCodes && canOpenCodes;
  const changeTab = (_, value) => {
    if (busy) return;
    const next = new URLSearchParams(params);
    if (value === 'learner-codes') next.set('tab', value);
    else {
      next.delete('tab');
      next.delete('recordId');
      next.delete('classGroupId');
    }
    setParams(next);
  };
  return <FeatureLayout title="Hồ sơ trúng tuyển" group="Thủ tục đầu vào">
    <Tabs value={codes ? 'learner-codes' : 'records'} onChange={changeTab} aria-label="Hồ sơ trúng tuyển" sx={{ mb: 2 }}>
      <Tab value="records" label="Danh sách hồ sơ" disabled={busy} id="admitted-records-tab" aria-controls="admitted-records-panel" />
      {canOpenCodes && <Tab value="learner-codes" label="Cấp mã học viên" disabled={busy} id="admitted-codes-tab" aria-controls="admitted-codes-panel" />}
    </Tabs>
    {requestedCodes && !canOpenCodes && <Alert severity="warning" sx={{ mb: 2 }}>Bạn chưa có quyền truy cập chức năng cấp mã học viên.</Alert>}
    <div role="tabpanel" id={codes ? 'admitted-codes-panel' : 'admitted-records-panel'} aria-labelledby={codes ? 'admitted-codes-tab' : 'admitted-records-tab'}>
      {codes ? <LearnerCodeIssue embedded onBusyChange={setBusy} /> : <AdmissionRecords mode="admitted-masters" embedded />}
    </div>
  </FeatureLayout>;
};

export default AdmittedRecords;
