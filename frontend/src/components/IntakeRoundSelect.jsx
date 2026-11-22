import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Alert, FormControl, MenuItem, Select } from '@mui/material';
import { API_BASE_URL } from '../config/http';
import FilterSelectField from './FilterSelectField';

export function matchesIntakeRound(row, value) {
  return !value || (value === 'unassigned' ? row.intakeRound == null : Number(row.intakeRound) === Number(value));
}

// One year + round number is shared by admissions, class codes and reports.
export default function IntakeRoundSelect({
  year,
  value,
  onChange,
  rows = [],
  required = false,
  disabled = false,
  label = 'Đợt tuyển sinh',
  sx,
  selectSx,
  configuredOnly = false,
  variant = 'filter',
  id,
  labelId,
  className = '',
  menuClassName = '',
  role = 'combobox',
}) {
  const [catalog, setCatalog] = useState([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const root = useRef(null);
  const menuAction = useRef(null);
  const [open, setOpen] = useState(false);
  const [menuWidth, setMenuWidth] = useState();

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => axios.get(`${API_BASE_URL}/system/intake-rounds`, { withCredentials: true, signal: controller.signal }))
      .then(({ data }) => { if (!controller.signal.aborted) { setCatalog(Array.isArray(data) ? data : []); setError(false); } })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  useLayoutEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useLayoutEffect(() => {
    if (variant !== 'scheduling' || !open || disabled) return undefined;
    const measure = () => setMenuWidth(root.current?.getBoundingClientRect().width || undefined);
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (root.current) observer?.observe(root.current);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [variant, open, disabled]);

  useLayoutEffect(() => {
    if (variant === 'scheduling' && open) menuAction.current?.updatePosition();
  }, [variant, open, menuWidth]);

  const candidates = [...catalog.filter(row => !configuredOnly || row.configured), ...(!configuredOnly ? rows : [])]
    .filter(row => (!year || String(row.academicYear) === String(year)) && row.intakeRound != null);
  const numbers = [...new Set(candidates.map(row => Number(row.intakeRound)))];
  if (value && value !== 'unassigned' && !numbers.includes(Number(value))) numbers.push(Number(value));
  numbers.sort((a, b) => a - b);

  const emptyLabel = required ? (loading ? 'Đang tải đợt…' : 'Chọn đợt') : 'Tất cả đợt';
  const menuItems = [
    <MenuItem key="" value="">{emptyLabel}</MenuItem>,
    ...(!required ? [<MenuItem key="unassigned" value="unassigned">Chưa xác định đợt</MenuItem>] : []),
    ...numbers.map(number => <MenuItem key={number} value={String(number)}>Đợt {number}</MenuItem>),
  ];
  const errorAlert = error
    ? <Alert severity="warning" sx={{ py: 0, mt: 0.5 }}>Không tải được danh mục đợt. Hãy tải lại trang.</Alert>
    : null;

  if (variant === 'scheduling') {
    return <>
      <Select
        ref={root}
        className={`${className}${value ? '' : ' sl-placeholder'}`.trim()}
        variant="standard"
        disableUnderline
        displayEmpty
        open={open && !disabled}
        onClose={() => setOpen(false)}
        onOpen={() => {
          setMenuWidth(root.current?.getBoundingClientRect().width || undefined);
          setOpen(true);
        }}
        SelectDisplayProps={{ 'aria-label': label, role }}
        value={value ?? ''}
        disabled={disabled}
        onChange={event => onChange(event.target.value)}
        sx={{
          '& .MuiSelect-select': {
            display: 'flex',
            alignItems: 'center',
            boxSizing: 'border-box',
            height: '100%',
            minHeight: 0,
            padding: 0,
            background: 'transparent',
          },
          '&.Mui-focused': { borderColor: 'var(--primary)', boxShadow: '0 0 0 1px var(--primary)' },
          ...selectSx,
        }}
        MenuProps={{
          action: menuAction,
          anchorEl: () => root.current,
          anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
          transformOrigin: { vertical: 'top', horizontal: 'left' },
          PaperProps: {
            className: menuClassName,
            style: { width: menuWidth, minWidth: menuWidth, maxWidth: menuWidth },
            sx: { borderRadius: 0, border: '1px solid var(--dropdown-border, #b9cad8)' },
          },
        }}
      >
        {menuItems}
      </Select>
      {errorAlert}
    </>;
  }

  if (variant === 'plain') {
    return <>
      <FormControl fullWidth size="small" required={required} disabled={disabled} sx={sx}>
        <Select
          id={id}
          labelId={labelId}
          displayEmpty
          value={value ?? ''}
          inputProps={{ 'aria-label': label }}
          onChange={event => onChange(event.target.value)}
          sx={selectSx}
        >
          {menuItems}
        </Select>
      </FormControl>
      {errorAlert}
    </>;
  }

  return <>
    <FilterSelectField
      label={label}
      inputLabel={label}
      value={value ?? ''}
      disabled={disabled}
      required={required}
      onChange={event => onChange(event.target.value)}
      sx={{ flex: '1 1 125px', minWidth: 120, ...sx }}
      selectSx={selectSx}
    >
      {menuItems}
    </FilterSelectField>
    {errorAlert}
  </>;
}
