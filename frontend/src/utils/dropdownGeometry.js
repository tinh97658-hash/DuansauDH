// Resolve the complete control, including its border, rather than the Select's inner display.
export function dropdownAnchor(anchorEl) {
  const anchor = typeof anchorEl === 'function' ? anchorEl() : anchorEl;
  return anchor?.classList?.contains('MuiSelect-select')
    ? anchor.closest('.MuiInputBase-root') || anchor : anchor;
}

export function dropdownMenuGeometry(anchorEl, { allowFlip = true, menuHeight = 360, minWidth = 0 } = {}) {
  const anchor = dropdownAnchor(anchorEl);
  const bounds = anchor?.getBoundingClientRect();
  if (!bounds?.width) return null;
  const view = anchor.ownerDocument?.defaultView || window;
  const viewportHeight = view.visualViewport?.height || view.innerHeight;
  const viewportWidth = view.visualViewport?.width || view.innerWidth;
  const viewportTop = view.visualViewport?.offsetTop || 0;
  const viewportLeft = view.visualViewport?.offsetLeft || 0;
  const width = Math.min(Math.max(bounds.width, minWidth), Math.max(0, viewportWidth - 16));
  const below = Math.max(0, viewportTop + viewportHeight - bounds.bottom - 12);
  const above = Math.max(0, bounds.top - viewportTop - 12);
  const upwards = allowFlip && below < Math.min(menuHeight, 360) && above > below;
  const maxHeight = Math.min(360, upwards ? above : below);
  const desiredTop = upwards ? bounds.top - 4 - Math.min(menuHeight, maxHeight) : bounds.bottom + 4;
  const top = Math.max(viewportTop + 8, Math.min(desiredTop, viewportTop + viewportHeight - Math.min(menuHeight, maxHeight) - 8));
  return { width, left: allowFlip || minWidth > 0 ? Math.max(viewportLeft + 8, Math.min(bounds.left, viewportLeft + viewportWidth - width - 8)) : bounds.left,
    top, maxHeight };
}

export function dropdownMenuStyles(anchorEl) {
  const anchor = dropdownAnchor(anchorEl);
  const requestedWidth = Number(anchor?.getAttribute?.('data-dropdown-min-width'));
  const geometry = dropdownMenuGeometry(anchorEl, { minWidth: Number.isFinite(requestedWidth) ? Math.max(0, requestedWidth) : 0 });
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
