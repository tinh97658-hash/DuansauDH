import React, { useLayoutEffect, useRef } from 'react';

// The shared grid sizes to its panels; extra viewport space does not enlarge them.
export default function DashboardColumns({ className, children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const node = ref.current;
    const summary = node.querySelector('.od-summary');
    if (!summary) return undefined;
    // Measure content only: KPI wrapping must still leave room for the work list.
    const measure = () => node.style.setProperty('--od-summary-height', `${summary.getBoundingClientRect().height}px`);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(summary);
    measure();
    return () => observer?.disconnect();
  }, []);
  return <div className={className} ref={ref}>{children}</div>;
}
