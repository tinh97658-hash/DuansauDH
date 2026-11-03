// Resolve the complete control, including its border, rather than the Select's inner display.
export function dropdownAnchor(anchorEl) {
  const anchor = typeof anchorEl === 'function' ? anchorEl() : anchorEl;
  return anchor?.classList?.contains('MuiSelect-select')
    ? anchor.closest('.MuiInputBase-root') || anchor : anchor;
}

export function dropdownMenuGeometry(anchorEl) {
  const anchor = dropdownAnchor(anchorEl);
  const bounds = anchor?.getBoundingClientRect();
  if (!bounds?.width) return null;
  const viewportHeight = anchor.ownerDocument?.defaultView?.innerHeight || window.innerHeight;
  const top = bounds.bottom + 4;
  return { width: bounds.width, left: bounds.left, top, maxHeight: Math.max(0, Math.min(360, viewportHeight - top - 8)) };
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
