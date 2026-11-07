import React, { useLayoutEffect, useRef } from 'react';

// Reserve the same space on each side so the week stays at the calendar's center.
export default function ScheduleHeader({ children }) {
  const header = useRef(null);
  useLayoutEffect(() => {
    const element = header.current;
    const sides = [element.firstElementChild, element.lastElementChild];
    let frame;
    const measure = () => {
      const width = Math.ceil(Math.max(...sides.map(side => side.getBoundingClientRect().width)));
      const value = `${width}px`;
      if (element.style.getPropertyValue('--sl-toolbar-side-width') !== value) {
        element.style.setProperty('--sl-toolbar-side-width', value);
      }
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    sides.forEach(side => observer?.observe(side));
    window.addEventListener('resize', schedule);
    measure();
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener('resize', schedule); };
  }, []);
  return <div className="sl-schedule-head" ref={header}>{children}</div>;
}
