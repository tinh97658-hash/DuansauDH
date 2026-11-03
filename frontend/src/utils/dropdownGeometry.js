// Resolve the complete control, including its border, rather than the Select's inner display.
export function dropdownAnchor(anchorEl) {
  const anchor = typeof anchorEl === 'function' ? anchorEl() : anchorEl;
  return anchor?.classList?.contains('MuiSelect-select')
    ? anchor.closest('.MuiInputBase-root') || anchor : anchor;
}

export function dropdownMenuGeometry(anchorEl, { allowFlip = false, menuHeight = 360 } = {}) {
  const anchor = dropdownAnchor(anchorEl);
  const bounds = anchor?.getBoundingClientRect();
  if (!bounds?.width) return null;
  const viewportHeight = anchor.ownerDocument?.defaultView?.innerHeight || window.innerHeight;
  const viewportWidth = anchor.ownerDocument?.defaultView?.innerWidth || window.innerWidth;
  const below = Math.max(0, viewportHeight - bounds.bottom - 12);
  const above = Math.max(0, bounds.top - 12);
  const upwards = allowFlip && below < Math.min(menuHeight, 360) && above > below;
  const maxHeight = Math.min(360, upwards ? above : below);
  const top = upwards ? Math.max(8, bounds.top - 4 - Math.min(menuHeight, maxHeight)) : bounds.bottom + 4;
  return { width: bounds.width, left: allowFlip ? Math.max(0, Math.min(bounds.left, viewportWidth - bounds.width)) : bounds.left,
    top, maxHeight };
}

export function dropdownMenuStyles(anchorEl) {
  const geometry = dropdownMenuGeometry(anchorEl);
  if (!geometry) return {};
  return {
    width: `${geometry.width}px !important`,
    minWidth: `${geometry.width}px !important`,
    maxWidth: `${geometry.width}px !important`,
    left: `${geometry.left}px !important`, top: `${geometry.top}px !important`,
    maxHeight: `${geometry.maxHeight}px !important`, minHeight: '0 !important',
    margin: '0 !important', transformOrigin: 'top left !important', overflowY: 'auto',
    boxSizing: 'border-box',
  };
}
