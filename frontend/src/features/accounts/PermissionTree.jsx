import React, { useState } from 'react';
import { Box, Checkbox, IconButton, Switch, Tooltip, Typography } from '@mui/material';
import FolderOutlined from '@mui/icons-material/FolderOutlined';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import SubdirectoryArrowRightRounded from '@mui/icons-material/SubdirectoryArrowRightRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';

export function buildPermissionModules(catalog) {
  const result = new Map();
  for (const group of catalog) {
    for (const permission of group.permissions || []) {
      const id = permission.moduleId || (permission.code.startsWith('module.') ? permission.code.slice(7) : permission.code.split('.')[0]);
      if (!result.has(id)) result.set(id, { id, name: permission.moduleName || group.group, children: [], root: null });
      const module = result.get(id);
      if (permission.code.startsWith('module.')) module.root = permission;
      else module.children.push({ ...permission, kind: permission.kind || (permission.code.endsWith('.view') ? 'read' : 'write') });
      if (permission.moduleName) module.name = permission.moduleName;
    }
  }
  return [...result.values()];
}

const COLUMNS_TEMPLATE = 'minmax(300px, 1fr) 92px 92px';

const rowSx = {
  display: 'grid',
  gridTemplateColumns: COLUMNS_TEMPLATE,
  minWidth: 480,
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

export default function PermissionTree({ modules, checked, onToggle, onModuleChange, assignable = () => true, disabled, search = '' }) {
  const [collapsed, setCollapsed] = useState(new Set());
  const needle = search.trim().toLocaleLowerCase('vi');
  const visible = modules
    .map(module => ({
      ...module,
      children:
        !needle || module.name.toLocaleLowerCase('vi').includes(needle)
          ? module.children
          : module.children.filter(permission => `${permission.name} ${permission.code}`.toLocaleLowerCase('vi').includes(needle)),
    }))
    .filter(module => !needle || module.children.length || module.name.toLocaleLowerCase('vi').includes(needle));

  return (
    <Box
      role="tree"
      aria-label="Cây phân quyền Module và Tab"
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
          GHI
        </Box>
      </Box>

      {!visible.length && (
        <Typography sx={{ p: 3, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>
          Không có quyền phù hợp.
        </Typography>
      )}

      {visible.map(module => {
        const open = needle || !collapsed.has(module.id);
        const enabled = !!module.root && checked.has(module.root.code);

        return (
          <Box key={module.id} role="treeitem" aria-expanded={!!open} aria-label={module.name}>
            <Box
              sx={{
                ...rowSx,
                bgcolor: enabled ? '#EAF4FA' : '#F6F9FC',
                borderBottom: '1px solid #D6E4EE',
                '&:hover': { bgcolor: enabled ? '#DFEEF7' : '#EFF5F9' },
              }}
            >
              <Box sx={{ ...cellNameSx, pl: 1.25 }}>
                <IconButton
                  size="small"
                  aria-label={`${open ? 'Thu gọn' : 'Mở rộng'} ${module.name}`}
                  onClick={() =>
                    setCollapsed(previous => {
                      const next = new Set(previous);
                      next.has(module.id) ? next.delete(module.id) : next.add(module.id);
                      return next;
                    })
                  }
                  sx={{ mr: 0.5, p: 0.5, color: enabled ? '#0788B8' : '#5C768D' }}
                >
                  {open ? <ExpandMoreRounded fontSize="small" /> : <ChevronRightRounded fontSize="small" />}
                </IconButton>
                {open ? (
                  <FolderOpenOutlined sx={{ fontSize: 20, color: '#0788B8', mr: 1, flexShrink: 0 }} />
                ) : (
                  <FolderOutlined sx={{ fontSize: 20, color: '#5C768D', mr: 1, flexShrink: 0 }} />
                )}
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: enabled ? '#173E75' : '#2D3748' }}>
                  {module.name}
                </Typography>
              </Box>
              <Box sx={cellActionSx}>
                <Tooltip
                  title={
                    module.root
                      ? 'Mở cổng module; chọn quyền xem và ghi của từng chức năng bên dưới.'
                      : 'Chưa có cổng module trong danh mục. Cần cập nhật hệ thống.'
                  }
                >
                  <span>
                    <Switch
                      size="small"
                      checked={enabled}
                      disabled={disabled || !module.root || !assignable(module.root)}
                      onChange={(_, value) => onModuleChange(module, value)}
                      inputProps={{ 'aria-label': `Mở module ${module.name}` }}
                    />
                  </span>
                </Tooltip>
              </Box>
              <Box sx={cellActionSx}>
                <Typography variant="caption" sx={{ color: '#CBD5E1', fontSize: 13, userSelect: 'none' }}>—</Typography>
              </Box>
            </Box>

            {open && (
              <Box role="group">
                {module.children.map(permission => {
                  const missing = (permission.requires || []).some(code => !checked.has(code));
                  const reason = !enabled
                    ? 'Cần bật module cha trước'
                    : missing
                    ? 'Cần bật quyền xem liên quan trước'
                    : permission.description || '';
                  const isRead = permission.kind === 'read';

                  return (
                    <Box
                      key={permission.id}
                      sx={{
                        ...rowSx,
                        bgcolor: '#FFFFFF',
                        opacity: enabled ? 1 : 0.45,
                        '&:hover': { bgcolor: enabled ? '#F8FAFC' : '#FFFFFF' },
                      }}
                    >
                      <Box sx={{ ...cellNameSx, pl: isRead ? 5 : 7.5 }}>
                        {isRead ? (
                          <DescriptionOutlined sx={{ color: '#0788B8', fontSize: 16, mr: 1, flexShrink: 0, opacity: 0.85 }} />
                        ) : (
                          <SubdirectoryArrowRightRounded sx={{ color: '#8DA2B5', fontSize: 15, mr: 0.75, flexShrink: 0 }} />
                        )}
                        <Tooltip title={permission.description || permission.code} placement="top-start">
                          <Typography
                            sx={{
                              fontSize: isRead ? 13 : 12.5,
                              fontWeight: isRead ? 600 : 400,
                              color: isRead ? '#1E293B' : '#475569',
                              cursor: 'default',
                            }}
                          >
                            {permission.name}
                          </Typography>
                        </Tooltip>
                      </Box>
                      {['read', 'write'].map(kind => (
                        <Box key={kind} sx={cellActionSx}>
                          {permission.kind === kind ? (
                            <Tooltip title={reason}>
                              <span>
                                <Checkbox
                                  size="small"
                                  checked={assignable(permission) && checked.has(permission.code)}
                                  disabled={disabled || !enabled || missing || !assignable(permission)}
                                  inputProps={{ 'aria-label': permission.name }}
                                  onChange={() => onToggle(permission.code)}
                                  sx={{ p: 0.5 }}
                                />
                              </span>
                            </Tooltip>
                          ) : (
                            <Typography variant="caption" sx={{ color: '#CBD5E1', fontSize: 13, userSelect: 'none' }}>—</Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
