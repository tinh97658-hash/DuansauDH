import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Alert, Button, CircularProgress } from '@mui/material';
import SearchRounded from '@mui/icons-material/SearchRounded';
import FeatureLayout from '../../components/FeatureLayout';
import AppSelect from '../../components/AppSelect';
import OfferingDetails from '../../features/scheduling/OfferingDetails';
import { usePermissions } from '../../features/accounts/usePermissions';
import { useAuthSession } from '../../context/AuthSession';
import { API_BASE_URL } from '../../config/http';
import { downloadReport } from '../../utils/reportExport';
import '../masters/classCourseHistory.css';
import './lecturerPayments.css';

const endpoint = `${API_BASE_URL}/reports/lecturer-payments`;
const headers = ['STT', 'Giảng viên', 'Lớp học phần', 'Số buổi', 'Ngày hoàn thành', 'Đã thanh toán'];
const dateLabel = value => value ? new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';
const failureMessage = error => error.response?.data?.message || 'Không thể xử lý dữ liệu thanh toán.';

export default function LecturerPayments() {
  const session = useAuthSession();
  const { can, access } = usePermissions();
  const [filters, setFilters] = useState({ from: '', to: '', unitId: '', lecturerId: '', paymentStatus: 'all', search: '' });
  const [options, setOptions] = useState({ units: [], lecturers: [] });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [offering, setOffering] = useState(null);
  const invalidDates = filters.from && filters.to && filters.from > filters.to;
  const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''));
  const change = (field, value) => setFilters(current => ({ ...current, [field]: value,
    ...(field === 'unitId' ? { lecturerId: '' } : {}) }));

  useEffect(() => {
    let active = true;
    axios.get(`${endpoint}/options`, { withCredentials: true }).then(({ data }) => active && setOptions(data))
      .catch(error => active && setError(failureMessage(error)));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setRows([]);
    if (filters.from && filters.to && filters.from > filters.to) { setLoading(false); return undefined; }
    setLoading(true);
    axios.get(endpoint, { params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '')), withCredentials: true })
      .then(({ data }) => { if (active) { setRows(data.rows); setError(''); } })
      .catch(error => active && setError(failureMessage(error)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [filters, revision]);

  const update = async (row, paid) => {
    setSaving(true); setError('');
    try {
      await axios.put(`${endpoint}/${row.courseOfferingId}/${row.lecturerId}`, { paid }, { withCredentials: true });
      setRevision(value => value + 1);
    } catch (error) { setError(failureMessage(error)); }
    finally { setSaving(false); }
  };
  const exportExcel = async () => {
    setExporting(true); setError('');
    try {
      const { data } = await axios.get(`${endpoint}/export`, { params, withCredentials: true });
      await downloadReport({ title: 'Thống kê thanh toán giảng viên', sections: [{ headers,
        rows: data.rows.map((row, index) => [index + 1, row.lecturerName, row.offeringName, row.sessionCount,
          dateLabel(row.completedAt), row.paid ? 'Đã thanh toán' : 'Chưa thanh toán']) }] }, 'excel');
    } catch (error) { setError(failureMessage(error)); }
    finally { setExporting(false); }
  };
  const select = (field, label, items) => <label className="tp-filter tp-select-filter"><span>{label}</span>
    <AppSelect aria-label={label} value={filters[field]} disabled={saving} onChange={event => change(field, event.target.value)}>
      <option value="">Tất cả</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </AppSelect></label>;

  return <FeatureLayout title="Thống kê thanh toán giảng viên" exportConfig={false}>
    <div className="tp-page lp-page">
      <section className="tp-filters lp-filters" aria-label="Bộ lọc thanh toán">
        <div className="lp-date-filter" role="group" aria-label="Khoảng ngày hoàn thành">
          <label className="tp-filter"><span>Từ ngày</span><input aria-label="Từ ngày" type="date" value={filters.from} disabled={saving} onChange={event => change('from', event.target.value)} /></label>
          <label className="tp-filter"><span>Đến ngày</span><input aria-label="Đến ngày" type="date" value={filters.to} disabled={saving} onChange={event => change('to', event.target.value)} /></label>
        </div>
        {select('unitId', 'Đơn vị', options.units)}
        {select('lecturerId', 'Giảng viên', options.lecturers.filter(item => !filters.unitId || item.unitId === filters.unitId))}
        <label className="tp-filter tp-select-filter"><span>Trạng thái thanh toán</span>
          <AppSelect aria-label="Trạng thái thanh toán" value={filters.paymentStatus} disabled={saving} onChange={event => change('paymentStatus', event.target.value)}>
            <option value="all">Tất cả</option><option value="paid">Đã thanh toán</option><option value="unpaid">Chưa thanh toán</option>
          </AppSelect></label>
        <label className="tp-filter"><span>Tìm kiếm</span><div className="tp-search"><SearchRounded />
          <input aria-label="Tìm kiếm" placeholder="Giảng viên, lớp học phần…" value={filters.search} disabled={saving} onChange={event => change('search', event.target.value)} /></div></label>
        {can('reports.export') && <Button data-export-exclude="true" disabled={loading || saving || exporting || !!invalidDates || !rows.length} onClick={exportExcel}>Xuất Excel</Button>}
      </section>
      {invalidDates && <Alert severity="warning">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      <div className="tp-table-wrap"><div className="tp-table-scroll"><table className="tp-table lp-table" aria-label="Thống kê thanh toán giảng viên" aria-busy={loading}>
        <colgroup>{[4, 19, 45, 7, 13, 12].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
        <thead><tr>{headers.map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={`${row.courseOfferingId}:${row.lecturerId}`}>
          <td>{index + 1}</td><td><span className="lp-cell-text" title={row.lecturerName}>{row.lecturerName}</span></td>
          <td><button className="lp-link" title={row.offeringName} onClick={() => setOffering({ id: row.courseOfferingId, name: row.offeringName })}><span className="lp-cell-text">{row.offeringName}</span></button></td>
          <td>{row.sessionCount}</td><td>{dateLabel(row.completedAt)}</td>
          <td><input type="checkbox" aria-label={`Đã thanh toán: ${row.lecturerName} – ${row.offeringName}`} checked={row.paid}
            disabled={saving || !can('reports.payments.manage') || access?.groupScope?.readOnly} onChange={event => update(row, event.target.checked)} /></td>
        </tr>)}
          {!rows.length && <tr><td colSpan={6}>{loading ? <CircularProgress size={24} aria-label="Đang tải" /> : 'Không có dữ liệu phù hợp.'}</td></tr>}
        </tbody></table></div></div>
    </div>
    {offering && <OfferingDetails offering={offering} user={session?.user || {}} readOnly
      readBasePath="/reports/lecturer-payments/offerings" onClose={() => setOffering(null)} />}
  </FeatureLayout>;
}
