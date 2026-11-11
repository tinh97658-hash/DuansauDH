import React from "react";
import { Alert, Tab, Tabs } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import CatalogManager from "../../components/CatalogManager";
import FeatureLayout from '../../components/FeatureLayout';
import AdmissionRoundManagement from '../../features/admission/AdmissionRoundManagement';
import { AuthSessionContext, useAuthSession } from '../../context/AuthSession';
import { formatDate } from "../../utils/dateFormat";

const fields = [{ key: "startDate", label: "Ngày bắt đầu", type: "date", required: true, render: row => formatDate(row.startDate) }];
export default function TrainingYears() {
  const [params, setParams] = useSearchParams();
  const session = useAuthSession();
  const permissions = session?.access?.permissions || [];
  const canViewRounds = permissions.includes('admission.view') && permissions.includes('route.masters.admission-scores.view');
  const requestedRounds = params.get('tab') === 'rounds';
  const rounds = requestedRounds && canViewRounds;
  return <FeatureLayout title="Năm và đợt tuyển sinh" group="Danh mục đào tạo">
    <Tabs value={rounds ? 'rounds' : 'years'} onChange={(_, tab) => {
      const next = new URLSearchParams(params);
      if (tab === 'rounds') next.set('tab', tab); else next.delete('tab');
      setParams(next);
    }} aria-label="Quản lý năm và đợt tuyển sinh" sx={{ mb: 2 }}>
      <Tab value="years" label="Năm đào tạo" id="training-years-tab" aria-controls="training-years-panel" />
      {canViewRounds && <Tab value="rounds" label="Đợt xét tuyển" id="admission-rounds-tab" aria-controls="admission-rounds-panel" />}
    </Tabs>
    {requestedRounds && !canViewRounds && <Alert severity="warning" sx={{ mb: 2 }}>Bạn chưa có quyền xem đợt xét tuyển.</Alert>}
    <div role="tabpanel" id={rounds ? 'admission-rounds-panel' : 'training-years-panel'} aria-labelledby={rounds ? 'admission-rounds-tab' : 'training-years-tab'}>
    {rounds ? <AuthSessionContext.Provider value={{ ...session, currentPath: '/masters/admission-scores' }}>
      <AdmissionRoundManagement />
    </AuthSessionContext.Provider> : <CatalogManager embedded title="Năm đào tạo" group="Danh mục đào tạo"
    desc="Quản lý năm và ngày bắt đầu. Các năm đang hoạt động được hiển thị trong danh sách chọn năm."
    endpoint="/system/training-years" itemName="năm đào tạo" nameLabel="Năm"
    showCode={false} sortable={false} editOnDoubleClick fields={fields}
    validate={form => !/^[1-9][0-9]{3}$/.test(form.name?.trim()) ? "Vui lòng nhập năm gồm 4 chữ số." : null} />}
    </div>
  </FeatureLayout>;
}
