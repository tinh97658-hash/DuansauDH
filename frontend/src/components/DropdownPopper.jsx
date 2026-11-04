import React, { forwardRef, useLayoutEffect, useState } from 'react';
import { Popper } from '@mui/material';
import { dropdownAnchor, dropdownMenuGeometry } from '../utils/dropdownGeometry';

// Autocomplete uses a Popper rather than a Menu. Apply the same border-box anchor width.
const DropdownPopper = forwardRef(function DropdownPopper({ anchorEl, style, modifiers = [], ...props }, ref) {
  const [geometry, setGeometry] = useState(null);
  useLayoutEffect(() => {
    const anchor = dropdownAnchor(anchorEl);
    if (!anchor) return undefined;
    const measure = () => setGeometry(dropdownMenuGeometry(anchor));
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(anchor);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [anchorEl]);
  return <Popper {...props} ref={ref} anchorEl={anchorEl} placement="bottom-start"
    modifiers={[...modifiers, { name: 'flip', enabled: true, options: { fallbackPlacements: ['top-start'], padding: 8 } },
      { name: 'preventOverflow', options: { mainAxis: true, altAxis: true, padding: 8 } },
      { name: 'offset', options: { offset: [0, 4] } }]}
    style={{ ...style, width: geometry?.width, minWidth: geometry?.width, maxWidth: geometry?.width,
      '--app-dropdown-max-height': geometry ? `${geometry.maxHeight}px` : undefined, boxSizing: 'border-box' }} />;
});

export default DropdownPopper;
