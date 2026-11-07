import React, { Children, useCallback, useEffect, useId, useRef, useState } from 'react';
import { ClickAwayListener, MenuItem, MenuList, Paper, Popper } from '@mui/material';

// Dashboard-only: avoid the global MuiMenu geometry override, which assumes a 360px menu.
export default function DashboardSelect({ children, onChange, ...props }) {
  const control = useRef(null);
  const popper = useRef(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(0);
  const options = Children.toArray(children).filter(child => child?.type === 'option');
  const focusOptions = useCallback(node => {
    // Default MenuList autofocus may scroll the page before a portal has been positioned.
    const option = node?.querySelector('[aria-selected="true"]:not([aria-disabled="true"])')
      || node?.querySelector('[role="option"]:not([aria-disabled="true"])');
    option?.focus({ preventScroll: true });
  }, []);
  const close = (restore = true) => { setOpen(false); if (restore) control.current?.focus({ preventScroll: true }); };
  const show = event => {
    event.preventDefault();
    if (props.disabled) return;
    control.current?.focus({ preventScroll: true });
    setWidth(control.current?.getBoundingClientRect().width || 0);
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return undefined;
    let frame;
    const measure = () => {
      setWidth(control.current?.getBoundingClientRect().width || 0);
      // Font changes can move the anchor without changing its width. Recheck
      // placement even when React skips an identical width state update.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { void popper.current?.update(); });
    };
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (control.current) observer?.observe(control.current);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [open]);
  useEffect(() => { if (props.disabled) setOpen(false); }, [props.disabled]);
  return <>
    <select {...props} ref={control} className={`od-select ${props.className || ''}`} onChange={onChange}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
      onMouseDown={event => { if (event.button === 0) show(event); }}
      onPointerDown={event => { if (event.pointerType === 'touch') show(event); }}
      onKeyDown={event => { if (['ArrowDown', 'ArrowUp', ' ', 'Enter', 'Home', 'End', 'F4'].includes(event.key)) show(event); }}>
      {children}
    </select>
    {/* Popper defaults to role="tooltip", whose global styles intentionally disable pointer events. */}
    <Popper role="presentation" open={open && !props.disabled} anchorEl={control.current} popperRef={popper} placement="bottom-start"
      popperOptions={{ strategy: 'fixed' }} modifiers={[
        { name: 'offset', options: { offset: [0, 6] } },
        { name: 'flip', options: { fallbackPlacements: ['top-start'] } },
        { name: 'preventOverflow', options: { padding: 8 } },
      ]} className="od-select-popper" style={{ width, maxWidth: 'calc(100vw - 16px)', zIndex: 1400 }}>
      <ClickAwayListener onClickAway={event => { if (!control.current?.contains(event.target)) close(false); }}>
        <Paper className="od-select-popup" elevation={0}>
          <MenuList ref={focusOptions} id={id} role="listbox" aria-label={props['aria-label']} autoFocusItem={false} variant="selectedMenu"
            onKeyDown={event => { if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); close(); } }}>
            {options.map(option => {
              const value = String(option.props.value ?? option.props.children);
              const selected = value === String(props.value);
              return <MenuItem key={value} role="option" selected={selected} aria-selected={selected} disabled={option.props.disabled}
                onClick={() => { onChange?.({ target: { value, name: props.name, id: props.id } }); close(); }}>{option.props.children}</MenuItem>;
            })}
          </MenuList>
        </Paper>
      </ClickAwayListener>
    </Popper>
  </>;
}
