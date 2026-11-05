import {formatLecturerName} from '../../utils/lecturerName';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Alert, CircularProgress } from '@mui/material';
import { MagnifyingGlassIcon } from "../../components/AppIcons";
import FeatureLayout from '../../components/FeatureLayout';
import AppSelect from '../../components/AppSelect';
import OfferingDetails from '../../features/scheduling/OfferingDetails';
import { usePermissions } from '../../features/accounts/usePermissions';
import { useAuthSession } from '../../context/AuthSession';
import { API_BASE_URL } from '../../config/http';
import '../masters/classCourseHistory.css';
import './lecturerPayments.css';

const endpoint = `${API_BASE_URL}/reports/lecturer-payments`;
const headers = ['STT', 'Giảng viên', 'Lớp học phần', 'Số buổi', 'Ngày hoàn thành', 'Đã thanh toán'];
const dateLabel = value => value ? new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';
const failureMessage = error => error.response?.data?.message || 'Không thể xử lý dữ liệu thanh toán.';
const rowKey = row => `${row.courseOfferingId}:${row.lecturerId}`;
const matchesStatus = (row, status) => status === 'all' || row.paid === (status === 'paid');

export default function LecturerPayments() {
  const session = useAuthSession();
  const { can, access } = usePermissions();
  const [filters, setFilters] = useState({ from: '', to: '', unitId: '', lecturerId: '', paymentStatus: 'all', search: '' });
  const [options, setOptions] = useState({ units: [], lecturers: [] });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(new Set());
  const pendingRef = useRef(new Set());
  const tableRef = useRef(null), anchorRef = useRef(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [offering, setOffering] = useState(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const canManage = can('reports.payments.manage') && !access?.groupScope?.readOnly;
  const invalidDates = filters.from && filters.to && filters.from > filters.to;
  const change = (field, value) => {
    setError('');
    setFilters(current => ({ ...current, [field]: value, ...(field === 'unitId' ? { lecturerId: '' } : {}) }));
  };

  useEffect(() => {
    let active = true;
    axios.get(`${endpoint}/options`, { withCredentials: true }).then(({ data }) => active && setOptions(data))
      .catch(error => active && setError(failureMessage(error)));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (filters.from && filters.to && filters.from > filters.to) { setRows([]); setLoading(false); return undefined; }
    setLoading(true);
    axios.get(endpoint, { params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '')), withCredentials: true })
      .then(({ data }) => { if (active) setRows(data.rows); })
      .catch(error => active && setError(failureMessage(error)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [filters, revision]);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    anchorRef.current = null;
    if (!anchor?.element.isConnected) return;
    const shift = anchor.element.getBoundingClientRect().top - anchor.top;
    if (shift) window.scrollBy({ top: shift, left: 0, behavior: 'instant' });
    anchor.element.querySelector('input[data-payment-toggle]')?.focus({ preventScroll: true });
  }, [rows]);

  const applySaved = (changes, preferredKey) => {
    const updates = new Map(changes.map(row => [rowKey(row), row]));
    const elements = [...(tableRef.current?.querySelectorAll('[data-payment-key]') || [])];
    const leaving = element => {
      const changed = updates.get(element.dataset.paymentKey);
      return changed && !matchesStatus(changed, filtersRef.current.paymentStatus);
    };
    const index = elements.findIndex(element => element.dataset.paymentKey === preferredKey);
    if (elements.some(leaving)) {
      const candidates = index >= 0 ? [...elements.slice(index + 1), ...elements.slice(0, index).reverse()] : elements;
      const element = candidates.find(item => !leaving(item) && item.getBoundingClientRect().bottom > 0);
      if (element) anchorRef.current = { element, top: element.getBoundingClientRect().top };
    }
    setRows(current => current.map(row => updates.has(rowKey(row)) ? { ...row, ...updates.get(rowKey(row)) } : row)
      .filter(row => matchesStatus(row, filtersRef.current.paymentStatus)));
  };

  const update = async (row, paid) => {
    const key = rowKey(row);
    if (pendingRef.current.has(key)) return;
    pendingRef.current.add(key); setPending(new Set(pendingRef.current)); setError('');
    const filterSnapshot = filtersRef.current;
    try {
      const { data } = await axios.put(`${endpoint}/${row.courseOfferingId}/${row.lecturerId}`, { paid }, { withCredentials: true });
      applySaved([{ ...row, ...data }], key);
      // A filter request may have started before this write finished. Refresh it without clearing rows.
      if (filtersRef.current !== filterSnapshot) setRevision(value => value + 1);
    } catch (error) { setError(failureMessage(error)); }
    finally { pendingRef.current.delete(key); setPending(new Set(pendingRef.current)); }
  };
  const select = (field, label, items) => <label className="tp-filter tp-select-filter"><span>{label}</span>
    <AppSelect aria-label={label} value={filters[field]} onChange={event => change(field, event.target.value)}>
      <option value="">Tất cả</option>{items.map(item => <option key={item.id} value={item.id}>{field==='lecturerId'?formatLecturerName(item):item.name}</option>)}
    </AppSelect></label>;

  return <FeatureLayout title="Thống kê thanh toán giảng viên" exportConfig={false}>
    <div className="tp-page lp-page">
      <section className="tp-filters lp-filters" aria-label="Bộ lọc thanh toán">
        <div className="lp-date-filter" role="group" aria-label="Khoảng ngày hoàn thành">
          <label className="tp-filter"><span>Từ ngày</span><input aria-label="Từ ngày" type="date" value={filters.from} onChange={event => change('from', event.target.value)} /></label>
          <label className="tp-filter"><span>Đến ngày</span><input aria-label="Đến ngày" type="date" value={filters.to} onChange={event => change('to', event.target.value)} /></label>
        </div>
        {select('unitId', 'Đơn vị', options.units)}
        {select('lecturerId', 'Giảng viên', options.lecturers.filter(item => !filters.unitId || item.unitId === filters.unitId))}
        <label className="tp-filter tp-select-filter"><span>Trạng thái thanh toán</span>
          <AppSelect aria-label="Trạng thái thanh toán" value={filters.paymentStatus} onChange={event => change('paymentStatus', event.target.value)}>
            <option value="all">Tất cả</option><option value="paid">Đã thanh toán</option><option value="unpaid">Chưa thanh toán</option>
          </AppSelect></label>
        <label className="tp-filter"><span>Tìm kiếm</span><div className="tp-search"><MagnifyingGlassIcon />
          <input aria-label="Tìm kiếm" placeholder="Giảng viên, lớp học phần…" value={filters.search} onChange={event => change('search', event.target.value)} /></div></label>
      </section>
      {invalidDates && <Alert severity="warning">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      <div className="tp-table-wrap"><div className="tp-table-scroll"><table ref={tableRef} className="tp-table lp-table" aria-label="Thống kê thanh toán giảng viên" aria-busy={loading}>
        <colgroup>{[4, 19, 45, 7, 13, 12].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
        <thead><tr>{headers.map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={rowKey(row)} data-payment-key={rowKey(row)} aria-busy={pending.has(rowKey(row))}>
          <td>{index + 1}</td><td><span className="lp-cell-text" title={formatLecturerName({...row,name:row.lecturerName})}>{formatLecturerName({...row,name:row.lecturerName})}</span></td>
          <td><button className="lp-link" title={row.offeringName} onClick={() => setOffering({ id: row.courseOfferingId, name: row.offeringName })}><span className="lp-cell-text">{row.offeringName}</span></button></td>
          <td>{row.sessionCount}</td><td>{dateLabel(row.completedAt)}</td>
          <td><input type="checkbox" data-payment-toggle aria-label={`Đã thanh toán: ${formatLecturerName({...row,name:row.lecturerName})} – ${row.offeringName}`} checked={row.paid}
            disabled={pending.has(rowKey(row)) || loading || !canManage} onChange={event => update(row, event.target.checked)} /></td>
        </tr>)}
          {!rows.length && <tr><td colSpan={6}>{loading ? <CircularProgress size={24} aria-label="Đang tải" /> : 'Không có dữ liệu phù hợp.'}</td></tr>}
        </tbody></table></div></div>
    </div>
    {offering && <OfferingDetails offering={offering} user={session?.user || {}} readOnly
      readBasePath="/reports/lecturer-payments/offerings" onClose={() => setOffering(null)} />}
  </FeatureLayout>;
}
