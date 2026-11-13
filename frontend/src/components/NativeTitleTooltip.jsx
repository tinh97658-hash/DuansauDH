import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../styles/tooltips.css';

// Render title hints in the app so their appearance does not depend on the OS.
export default function NativeTitleTooltip() {
  const [hint, setHint] = useState(null);
  const bubble = useRef(null);
  const tooltipId = useId();

  useEffect(() => {
    let active = null;
    let timer;
    const hide = () => {
      clearTimeout(timer);
      if (active && !active.element.hasAttribute('title')) active.element.setAttribute('title', active.text);
      if (active && active.element.getAttribute('aria-describedby') === active.descriptionWithTooltip) {
        if (active.description) active.element.setAttribute('aria-describedby', active.description);
        else active.element.removeAttribute('aria-describedby');
      }
      active = null;
      setHint(null);
    };
    const enter = event => {
      if (!(event.target instanceof Element)) return;
      if (active?.element.contains(event.target)) return;
      hide();
      const element = event.target.closest('[title]');
      const text = element?.getAttribute('title');
      if (!text?.trim() || element.closest('.MuiTooltip-popper, [role="tooltip"]')) return;
      // Leave SVG accessibility titles alone.
      if (!(element instanceof HTMLElement)) return;
      const description = element.getAttribute('aria-describedby');
      active = { element, text, description, descriptionWithTooltip: [description, tooltipId].filter(Boolean).join(' ') };
      element.removeAttribute('title');
      const rect = element.getBoundingClientRect();
      const x = event.type === 'focusin' ? rect.left : event.clientX;
      const y = event.type === 'focusin' ? rect.bottom : event.clientY;
      timer = setTimeout(() => {
        if (!element.isConnected) { hide(); return; }
        element.setAttribute('aria-describedby', active.descriptionWithTooltip);
        setHint({ text, x: x + 12, y: y + 18 });
      }, event.type === 'focusin' ? 0 : 400);
    };
    const leave = event => {
      if (active && (!(event.relatedTarget instanceof Node) || !active.element.contains(event.relatedTarget))) hide();
    };
    const keydown = event => { if (event.key === 'Escape') hide(); };
    document.addEventListener('mouseover', enter, true);
    document.addEventListener('mouseout', leave, true);
    document.addEventListener('focusin', enter, true);
    document.addEventListener('focusout', leave, true);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('keydown', keydown, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    window.addEventListener('blur', hide);
    return () => {
      hide();
      document.removeEventListener('mouseover', enter, true);
      document.removeEventListener('mouseout', leave, true);
      document.removeEventListener('focusin', enter, true);
      document.removeEventListener('focusout', leave, true);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('keydown', keydown, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      window.removeEventListener('blur', hide);
    };
  }, [tooltipId]);

  useLayoutEffect(() => {
    if (!hint || !bubble.current) return;
    const rect = bubble.current.getBoundingClientRect();
    bubble.current.style.left = `${Math.max(8, Math.min(hint.x, window.innerWidth - rect.width - 8))}px`;
    bubble.current.style.top = `${Math.max(8, Math.min(hint.y, window.innerHeight - rect.height - 8))}px`;
  }, [hint]);

  return hint && createPortal(<div ref={bubble} id={tooltipId} role="tooltip" className="app-title-tooltip"
    style={{ left: hint.x, top: hint.y }}>{hint.text}</div>, document.body);
}
