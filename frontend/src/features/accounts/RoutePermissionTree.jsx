import React, { useState } from 'react';
import { Box, Checkbox, IconButton, Tooltip, Typography } from '@mui/material';
import FolderOutlined from '@mui/icons-material/FolderOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import SubdirectoryArrowRightRounded from '@mui/icons-material/SubdirectoryArrowRightRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';

const COLUMNS_TEMPLATE = 'minmax(320px, 1fr) 92px 104px';

const rowSx = {
  display: 'grid',
  gridTemplateColumns: COLUMNS_TEMPLATE,
  minWidth: 520,
  minHeight: 38,
  borderBottom: '1px solid #E5EDF3',
  alignItems: 'stretch',
  transition: 'background-color 0.15s ease',
};

const cellNameSx = {
  display: 'flex',
  alignItems: 'center',
  minWidth: 0,
  py: 0.75,
  px: 1.5,
};

const cellActionSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderLeft: '1px solid #E5EDF3',
  px: 1,
  py: 0.5,
};

export default function RoutePermissionTree({ permissions, checked, onChange, assignable = () => true, disabled, search = '' }) {
  const [collapsed, setCollapsed] = useState(new Set());
  const needle = search.trim().toLocaleLowerCase('vi');
  const sections = new Map();

  for (const permission of permissions) {
    const nav = permission.navigation;
    if (!nav) continue;
    if (!sections.has(nav.section)) sections.set(nav.section, new Map());
    const groups = sections.get(nav.section);
    if (!groups.has(nav.group)) groups.set(nav.group, new Map());
    const pages = groups.get(nav.group);
    if (!pages.has(nav.path)) pages.set(nav.path, { ...nav, permissions: [] });
    pages.get(nav.path).permissions.push(permission);
  }

  const matches = page =>
    !needle ||
    `${page.section} ${page.group} ${page.name} ${page.path} ${page.permissions.map(p => `${p.name} ${p.code}`).join(' ')}`
      .toLocaleLowerCase('vi')
      .includes(needle);

  const branch = (id, label, pages, depth, children) => {
    const reads = pages.flatMap(page => page.permissions.filter(p => p.kind === 'read' && assignable(p)));
    const count = reads.filter(p => checked.has(p.code)).length;
    const open = !!needle || !collapsed.has(id);
    const isSection = depth === 0;

    return (
      <Box role="treeitem" aria-label={label} aria-expanded={open} key={id}>
        <Box
          sx={{
            ...rowSx,
            bgcolor: isSection ? '#EAF4FA' : '#F6F9FC',
            borderBottom: isSection ? '1px solid #D6E4EE' : '1px solid #E5EDF3',
            '&:hover': { bgcolor: isSection ? '#DFEEF7' : '#EFF5F9' },
          }}
        >
          <Box sx={{ ...cellNameSx, pl: isSection ? 1.25 : 3.5 }}>
            <IconButton
              size="small"
              aria-label={`${open ? 'Thu gọn' : 'Mở rộng'} ${label}`}
              onClick={() =>
                setCollapsed(previous => {
                  const next = new Set(previous);
                  next.has(id) ? next.delete(id) : next.add(id);
                  return next;
                })
              }
              sx={{ mr: 0.5, p: 0.5, color: isSection ? '#0788B8' : '#5C768D' }}
            >
              {open ? <ExpandMoreRounded fontSize="small" /> : <ChevronRightRounded fontSize="small" />}
            </IconButton>
            <FolderOutlined sx={{ color: isSection ? '#0788B8' : '#5C768D', fontSize: isSection ? 20 : 18, mr: 1, flexShrink: 0 }} />
            <Typography sx={{ fontWeight: isSection ? 700 : 600, fontSize: isSection ? 13 : 12.5, color: isSection ? '#173E75' : '#2D3748' }}>
              {label}
            </Typography>
          </Box>
          <Box sx={cellActionSx}>
            <Tooltip title="Bật hoặc tắt quyền xem các trang trong thư mục. Quyền thao tác được chọn riêng.">
              <span>
                <Checkbox
                  size="small"
                  checked={reads.length > 0 && count === reads.length}
                  indeterminate={count > 0 && count < reads.length}
                  disabled={disabled || !reads.length}
                  inputProps={{ 'aria-label': `Xem các trang ${label}` }}
                  onChange={(_, value) => onChange(reads.map(p => p.code), value)}
                  sx={{ p: 0.5 }}
                />
              </span>
            </Tooltip>
          </Box>
          <Box sx={cellActionSx}>
            <Typography variant="caption" sx={{ color: '#CBD5E1', fontSize: 13, userSelect: 'none' }}>—</Typography>
          </Box>
        </Box>
        {open && <Box role="group">{children}</Box>}
      </Box>
    );
  };

  const pageNode = page => {
    const view = page.permissions.find(p => p.kind === 'read');
    const enabled = !!view && checked.has(view.code);
    const writePermissions = page.permissions.filter(p => p.kind === 'write');

    return (
      <Box key={page.path} role="treeitem" aria-label={page.name}>
        <Box
          sx={{
            ...rowSx,
            bgcolor: '#FFFFFF',
            '&:hover': { bgcolor: '#F8FAFC' },
          }}
        >
          <Box sx={{ ...cellNameSx, pl: 6 }}>
            <DescriptionOutlined sx={{ color: '#0788B8', fontSize: 16, mr: 1, flexShrink: 0, opacity: 0.85 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>
              {page.name}
            </Typography>
            <Box component="span" sx={{ display: 'none' }}>{page.path}</Box>
          </Box>
          <Box sx={cellActionSx}>
            <Checkbox
              size="small"
              checked={enabled}
              disabled={disabled || !view || !assignable(view)}
              inputProps={{ 'aria-label': `Xem ${page.name}` }}
              onChange={(_, value) => onChange([view.code], value)}
              sx={{ p: 0.5 }}
            />
          </Box>
          <Box sx={cellActionSx}>
            <Typography variant="caption" sx={{ color: '#CBD5E1', fontSize: 13, userSelect: 'none' }}>—</Typography>
          </Box>
        </Box>
        {writePermissions.map(permission => (
          <Box
            key={permission.code}
            sx={{
              ...rowSx,
              bgcolor: '#FFFFFF',
              opacity: enabled ? 1 : 0.45,
              '&:hover': { bgcolor: enabled ? '#F8FAFC' : '#FFFFFF' },
            }}
          >
            <Box sx={{ ...cellNameSx, pl: 8.5 }}>
              <SubdirectoryArrowRightRounded sx={{ color: '#8DA2B5', fontSize: 15, mr: 0.75, flexShrink: 0 }} />
              <Tooltip title={permission.description || permission.code} placement="top-start">
                <Typography sx={{ fontSize: 12.5, color: '#475569', cursor: 'default' }}>
                  {permission.name}
                </Typography>
              </Tooltip>
            </Box>
            <Box sx={cellActionSx}>
              <Typography variant="caption" sx={{ color: '#CBD5E1', fontSize: 13, userSelect: 'none' }}>—</Typography>
            </Box>
            <Box sx={cellActionSx}>
              <Tooltip
                title={
                  !enabled
                    ? 'Cần bật quyền xem trang trước'
                    : permission.description || ''
                }
              >
                <span>
                  <Checkbox
                    size="small"
                    checked={assignable(permission) && checked.has(permission.code)}
                    disabled={disabled || !enabled || !assignable(permission)}
                    inputProps={{ 'aria-label': `${permission.name} · ${page.name}` }}
                    onChange={(_, value) => onChange([permission.code], value)}
                    sx={{ p: 0.5 }}
                  />
                </span>
              </Tooltip>
            </Box>
          </Box>
        ))}
      </Box>
    );
  };

  let count = 0;
  const content = [...sections].map(([section, groups]) => {
    const visibleGroups = [...groups]
      .map(([group, pages]) => [group, [...pages.values()].filter(matches)])
      .filter(([, pages]) => pages.length);
    if (!visibleGroups.length) return null;
    count += visibleGroups.length;
    return branch(
      section,
      section,
      visibleGroups.flatMap(([, pages]) => pages),
      0,
      visibleGroups.map(([group, pages]) => branch(`${section}/${group}`, group, pages, 1, pages.map(pageNode)))
    );
  });

  return (
    <Box
      role="tree"
      aria-label="Cây phân quyền theo route"
      sx={{
        border: '1px solid #D2DFEB',
        borderRadius: '8px',
        overflow: 'auto',
        bgcolor: '#FFFFFF',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}
    >
      <Box
        sx={{
          ...rowSx,
          bgcolor: '#F1F6FA',
          borderBottom: '2px solid #CBDCE8',
          minHeight: 40,
        }}
      >
        <Box sx={{ ...cellNameSx, fontWeight: 700, fontSize: 12, color: '#173E75', letterSpacing: '0.02em' }}>
          CHỨC NĂNG &amp; THAO TÁC
        </Box>
        <Box sx={{ ...cellActionSx, fontWeight: 700, fontSize: 12, color: '#173E75', letterSpacing: '0.02em' }}>
          XEM
        </Box>
        <Box sx={{ ...cellActionSx, fontWeight: 700, fontSize: 12, color: '#173E75', letterSpacing: '0.02em' }}>
          THAO TÁC
        </Box>
      </Box>
      {content}
      {!count && (
        <Typography sx={{ p: 3, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>
          Không có quyền phù hợp.
        </Typography>
      )}
    </Box>
  );
}
