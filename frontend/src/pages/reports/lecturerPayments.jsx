import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Alert, CircularProgress } from '@mui/material';
import { MagnifyingGlassIcon } from "../../components/AppIcons";
import FeatureLayout from '../../components/FeatureLayout';
import AppSelect from '../../components/AppSelect';
import DateField from '../../components/DateField';
import ConfirmDialog from '../../components/ConfirmDialog';
import { getBusinessTodayKey } from '../../utils/schedulingCalendar';
import OfferingDetails from '../../features/scheduling/OfferingDetails';
import { usePermissions } from '../../features/accounts/usePermissions';
import { useAuthSession } from '../../context/AuthSession';
import { API_BASE_URL } from '../../config/http';
import '../masters/classCourseHistory.css';
import './lecturerPayments.css';

const endpoint = `${API_BASE_URL}/reports/lecturer-payments`;
const headers = ['STT', 'Giảng viên', 'Lớp học phần', 'Lớp tham gia', 'Số buổi', 'Ngày hoàn thành', 'Đã thanh toán', 'Ngày thanh toán', 'Ghi chú'];
const dateLabel = value => value ? new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';
const failureMessage = error => error.response?.data?.message || 'Không thể xử lý dữ liệu thanh toán.';
const rowKey = row => `${row.courseOfferingId}:${row.lecturerId}`;
const matchesStatus = (row, status) => status === 'all' || row.paid === (status === 'paid');

// Keep unrelated rows and date fields stable while another pair is being edited.
const PaymentRow = React.memo(function PaymentRow({ row, index, draft, disabled, busy, edit, commitField, toggle, setOffering }) {
  const value = { ...row, ...draft };
  const name = `${row.lecturerName} – ${row.offeringName}`;
  const groups = row.participatingGroups || [];
  const groupNames = groups.map(group => group.name || group.code).filter(Boolean).join(', ');
  const needsDate = value.paid && !value.paymentDate;
  return <tr data-payment-key={rowKey(row)} aria-busy={busy}>
  <td>{index + 1}</td><td><span className="lp-cell-text" title={row.lecturerName}>{row.lecturerName}</span></td>
  <td><button className="lp-link" title={row.offeringName} onClick={() => setOffering({ id: row.courseOfferingId, name: row.offeringName })}><span className="lp-cell-text">{row.offeringName}</span></button></td>
  <td><span className="lp-group-names" title={groupNames || undefined}>{groupNames || '—'}</span></td>
  <td>{row.sessionCount}</td><td>{dateLabel(row.completedAt)}</td>
  <td><input type="checkbox" data-payment-toggle aria-label={`Đã thanh toán: ${name}`} checked={value.paid}
    disabled={disabled || (busy && draft?.paid !== undefined)} onChange={event => toggle(row, event.target.checked)} /></td>
  <td><DateField size="small" value={value.paid ? value.paymentDate || '' : ''} disabled={disabled || !value.paid}
    className="lp-payment-date" inputProps={{ 'aria-label': `Ngày thanh toán: ${name}` }}
    onChange={event => edit(row, { paymentDate: event.target.value })}
    onAccept={date => commitField(row, 'paymentDate', date)}
    onBlur={() => commitField(row, 'paymentDate')}
    onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commitField(row, 'paymentDate'); } }} />
    {needsDate && <span className="lp-missing-date">Cần bổ sung ngày</span>}</td>
  <td><input className="lp-note" aria-label={`Ghi chú: ${name}`} placeholder="Ghi chú (không bắt buộc)" title={value.note || ''}
    maxLength={2000} disabled={disabled} value={value.note || ''} onChange={event => edit(row, { note: event.target.value })}
    onBlur={() => commitField(row, 'note')}
    onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); commitField(row, 'note'); } }} />
    {busy && <span className="lp-saving" role="status">Đang lưu…</span>}
    {draft?.error && <div className="lp-row-error" role="alert">{draft.error}</div>}</td>
  </tr>;
});
export default function LecturerPayments() {
  const session = useAuthSession();
  const { can, access } = usePermissions();
  const [filters, setFilters] = useState({ from: '', to: '', unitId: '', lecturerId: '', paymentStatus: 'all', search: '' });
  const [options, setOptions] = useState({ units: [], lecturers: [] });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(new Set());
  const pendingRef = useRef(new Set());
  const savedRef = useRef(new Map()), queuesRef = useRef(new Map()), submittedRef = useRef(new Map());
  const draftsRef = useRef({});
  const tableRef = useRef(null), anchorRef = useRef(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [offering, setOffering] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [unpay, setUnpay] = useState(null);
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
      .then(({ data }) => { if (active) {
        data.rows.forEach(row => { if (!pendingRef.current.has(rowKey(row))) savedRef.current.set(rowKey(row), row); });
        setRows(data.rows);
      } })
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

  const applySaved = useCallback((changes, preferredKey) => {
    changes.forEach(row => savedRef.current.set(rowKey(row), row));
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
  }, []);

  const changeDraft = useCallback((key, change) => {
    const next = change(draftsRef.current[key] || {}), all = { ...draftsRef.current };
    if (Object.keys(next).length) all[key] = next; else delete all[key];
    draftsRef.current = all; setDrafts(all);
  }, []);
  const edit = useCallback((row, changes) => changeDraft(rowKey(row), current => ({ ...current, ...changes, error: '' })), [changeDraft]);
  const update = useCallback((row, changes) => {
    const key = rowKey(row);
    if (!canManage) return;
    const fields = Object.entries(changes);
    if (fields.every(([field, value]) => submittedRef.current.get(`${key}:${field}`)?.value === value)) return;
    const token = {};
    fields.forEach(([field, value]) => submittedRef.current.set(`${key}:${field}`, { value, token }));
    edit(row, changes);
    pendingRef.current.add(key); setPending(new Set(pendingRef.current));
    const filterSnapshot = filtersRef.current;
    const previous = queuesRef.current.get(key) || Promise.resolve();
    const task = previous.then(async () => {
      try {
        // Each field saves independently, using the version returned by the preceding save for this pair.
        const saved = savedRef.current.get(key) || row;
        if (fields.some(([field, value]) => value !== (saved[field] ?? (field === 'note' ? '' : null)))) {
          const body = { paid: saved.paid, paymentVersion: saved.paymentVersion ?? null, ...changes };
          const { data } = await axios.put(`${endpoint}/${row.courseOfferingId}/${row.lecturerId}`, body, { withCredentials: true });
          applySaved([{ ...saved, ...data }], key);
        }
        changeDraft(key, current => {
          const next = { ...current }; fields.forEach(([field, value]) => {
            if (submittedRef.current.get(`${key}:${field}`)?.token === token && next[field] === value) delete next[field];
          });
          delete next.error; return next;
        });
        if (filtersRef.current !== filterSnapshot) setRevision(value => value + 1);
      } catch (error) {
        changeDraft(key, current => {
          const next = { ...current, error: failureMessage(error) };
          // A failed checkbox request must not look like a saved payment; typed notes/dates stay available for retry.
          if (Object.hasOwn(changes, 'paid') && next.paid === changes.paid) delete next.paid;
          return next;
        });
      } finally {
        fields.forEach(([field]) => { if (submittedRef.current.get(`${key}:${field}`)?.token === token) submittedRef.current.delete(`${key}:${field}`); });
        if (queuesRef.current.get(key) === task) {
          queuesRef.current.delete(key); pendingRef.current.delete(key); setPending(new Set(pendingRef.current));
        }
      }
    });
    queuesRef.current.set(key, task);
    return task;
  }, [canManage, applySaved, changeDraft, edit]);
  const commitField = useCallback((row, field, accepted) => {
    const draft = draftsRef.current[rowKey(row)] || {};
    if (field === 'paymentDate' && !(draft.paid ?? savedRef.current.get(rowKey(row))?.paid ?? row.paid)) return;
    if (accepted === undefined && !Object.hasOwn(draft, field)) return;
    const value = accepted === undefined ? draft[field] : accepted;
    if (field === 'paymentDate' && !value) {
      changeDraft(rowKey(row), current => ({ ...current, error: 'Hãy nhập ngày thanh toán hợp lệ.' })); return;
    }
    update(row, { [field]: value });
  }, [update, changeDraft]);
  const toggle = useCallback((row, paid) => {
    const key = rowKey(row);
    if (submittedRef.current.has(`${key}:paid`)) return;
    if (!paid && (savedRef.current.get(key) || row).paid) { setUnpay(row); return; }
    update(row, { paid, paymentDate: paid ? (draftsRef.current[key]?.paymentDate || savedRef.current.get(key)?.paymentDate || getBusinessTodayKey()) : null });
  }, [update]);
  const select = (field, label, items) => <label className="tp-filter tp-select-filter"><span>{label}</span>
    <AppSelect aria-label={label} value={filters[field]} onChange={event => change(field, event.target.value)}>
      <option value="">Tất cả</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </AppSelect></label>;

  return <FeatureLayout title="Báo cáo tài chính" exportConfig={false}>
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
          <input aria-label="Tìm kiếm" placeholder="Giảng viên, lớp học phần, lớp tham gia…" value={filters.search} onChange={event => change('search', event.target.value)} /></div></label>
      </section>
      {invalidDates && <Alert severity="warning">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      <div className="tp-table-wrap"><div className="tp-table-scroll"><table ref={tableRef} className="tp-table lp-table" aria-label="Báo cáo tài chính" aria-busy={loading}>
        <colgroup>{[4, 13, 20, 12, 5, 9, 7, 14, 16].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
        <thead><tr>{headers.map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <PaymentRow key={rowKey(row)} row={row} index={index} draft={drafts[rowKey(row)]}
          disabled={loading || !canManage || !Object.hasOwn(row, 'paymentDate')} busy={pending.has(rowKey(row))}
          edit={edit} commitField={commitField} toggle={toggle} setOffering={setOffering} />)}
          {!rows.length && <tr><td colSpan={9}>{loading ? <CircularProgress size={24} aria-label="Đang tải" /> : 'Không có dữ liệu phù hợp.'}</td></tr>}
        </tbody></table></div></div>
    </div>
    {offering && <OfferingDetails offering={offering} user={session?.user || {}} readOnly
      readBasePath="/reports/lecturer-payments/offerings" onClose={() => setOffering(null)} />}
    <ConfirmDialog open={!!unpay} title="Xác nhận bỏ thanh toán" confirmText="Bỏ thanh toán"
      content="Bạn muốn chuyển dòng này sang chưa thanh toán? Ngày thanh toán sẽ không còn hiệu lực. Ghi chú và lịch sử thao tác được giữ lại."
      onClose={() => setUnpay(null)} onConfirm={() => { const current = unpay; setUnpay(null); update(current, { paid: false, paymentDate: null }); }} />
  </FeatureLayout>;
}
