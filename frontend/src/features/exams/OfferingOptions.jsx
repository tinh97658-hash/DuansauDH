import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ListSubheader, MenuItem } from '@mui/material';
import { stageGroups, stageOf } from './offeringStages';

export const offeringMenuProps = {
  variant: 'menu',
  anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
  transformOrigin: { vertical: 'top', horizontal: 'left' },
  marginThreshold: 16,
  PaperProps: {
    className: 'exam-stage-menu',
    sx: {
      maxHeight: 'min(420px, calc(100dvh - 32px))',
      overflowY: 'auto', overflowX: 'hidden', overscrollBehaviorY: 'contain',
    },
  },
};

export function useOfferingMenu() {
  const selectRoot = useRef(null);
  const [width, setWidth] = useState();
  // MUI Select exposes its hidden input; its parent is the outlined Select root.
  const inputRef = useCallback(handle => { selectRoot.current = handle?.node?.parentElement || null; }, []);
  useLayoutEffect(() => {
    const root = selectRoot.current;
    if (!root) return;
    const measure = () => setWidth(root.getBoundingClientRect().width);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(root);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  return { inputRef, menuProps: { ...offeringMenuProps, PaperProps: {
    ...offeringMenuProps.PaperProps,
    style: { width, minWidth: width, maxWidth: width, boxSizing: 'border-box' },
  } } };
}

function OfferingGroupHeader({ children }) {
  return <ListSubheader role="presentation" className="exam-stage-header">{children}</ListSubheader>;
}
OfferingGroupHeader.muiSkipListHighlight = true;

// Flat Select children preserve MUI values and keyboard navigation.
export function offeringOptions(choices, labelOf, onReselect) {
  return choices.flatMap((entry, index) => {
    const stage = stageOf(entry.offering);
    const label = labelOf(entry);
    return [
      ...(index === 0 || stageOf(choices[index - 1].offering).group !== stage.group
        ? [<OfferingGroupHeader key={`stage-${stage.group}`} disabled>
          <span>{stageGroups[stage.group]}</span>
          <span className="exam-stage-count">{choices.filter(item => stageOf(item.offering).group === stage.group).length} lớp</span>
        </OfferingGroupHeader>] : []),
      <MenuItem key={entry.offering.id} value={entry.offering.id} className="exam-stage-option"
        onClick={() => onReselect?.(entry)}>
        <span className="exam-stage-name" title={label}>{label}</span>
        <span className={`exam-stage-badge exam-stage-${stage.tone}`}>{stage.label}</span>
      </MenuItem>,
    ];
  });
}
