import React, { Children, Fragment, useEffect, useId, useRef, useState } from "react";
import { Menu, MenuItem } from "@mui/material";

const optionsOf = children => Children.toArray(children).flatMap(child =>
  child?.type === Fragment ? optionsOf(child.props.children) : child?.type === "option" ? [child] : []);

/** Keep native form values and sizing, with a consistent menu on every platform. */
export default function AppSelect({ children, onMouseDown, onKeyDown, onPointerDown, ...props }) {
  const control = useRef(null);
  const menuId = useId();
  const [open, setOpen] = useState(false);
  useEffect(() => { if (props.disabled) setOpen(false); }, [props.disabled]);
  const showMenu = event => {
    event.preventDefault();
    if (!props.disabled) {
      control.current?.focus();
      setOpen(true);
    }
  };
  const choose = value => {
    control.current.value = String(value);
    control.current.dispatchEvent(new Event("change", { bubbles: true }));
    setOpen(false);
  };
  return <>
    <select {...props} data-app-select="true" ref={control} aria-haspopup="listbox" aria-expanded={open && !props.disabled}
      aria-controls={open ? menuId : undefined}
      onMouseDown={event => {
        onMouseDown?.(event);
        if (!event.defaultPrevented && event.button === 0) showMenu(event);
      }}
      onPointerDown={event => {
        onPointerDown?.(event);
        if (!event.defaultPrevented && event.pointerType === "touch") showMenu(event);
      }}
      onKeyDown={event => {
        onKeyDown?.(event);
        if (!event.defaultPrevented && ["ArrowDown", "ArrowUp", " ", "Enter", "Home", "End", "F4"].includes(event.key)) showMenu(event);
      }}>{children}</select>
    {open && !props.disabled && <Menu open anchorEl={control.current} onClose={() => setOpen(false)}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }} transformOrigin={{ vertical: "top", horizontal: "left" }}
      MenuListProps={{ id: menuId, role: "listbox", "aria-label": props["aria-label"] || control.current?.labels?.[0]?.textContent }}
      PaperProps={{ style: { width: control.current?.getBoundingClientRect().width,
        minWidth: control.current?.getBoundingClientRect().width, maxWidth: control.current?.getBoundingClientRect().width,
        boxSizing: 'border-box' }, sx: { borderRadius: 0 } }}>
      {optionsOf(children).map((option, index) => {
        const value = option.props.value ?? option.props.children;
        const selected = String(value) === String(control.current?.value ?? props.value ?? props.defaultValue ?? "");
        return <MenuItem key={option.key ?? index} role="option" disabled={option.props.disabled}
          selected={selected} aria-selected={selected}
          onClick={() => choose(value)}>{option.props.children}</MenuItem>;
      })}
    </Menu>}
  </>;
}
