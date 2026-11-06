import { dropdownMenuGeometry, dropdownMenuStyles } from '../../utils/dropdownGeometry';

const anchor = (top, left = 70, width = 150) => ({
  ownerDocument: { defaultView: { innerWidth: 900, innerHeight: 600 } },
  getBoundingClientRect: () => ({ top, bottom: top + 38, left, right: left + width, width }),
});
it('anchors short upward lists by their bottom edge instead of an estimated 360px height', () => {
  expect(dropdownMenuStyles(anchor(540))).toMatchObject({
    top: 'auto !important', bottom: '64px !important',
    transformOrigin: 'bottom left !important',
  });
});
it('keeps a bottom-only receipt menu below its field with scrolling space', () => {
  const trigger = anchor(400);
  trigger.getAttribute = name => name === 'data-dropdown-placement' ? 'bottom' : null;
  expect(dropdownMenuStyles(trigger)).toMatchObject({
    top: '442px !important', bottom: 'auto !important', maxHeight: '150px !important',
  });
});
it('retains NT left alignment and exact control width', () => {
  expect(dropdownMenuGeometry(anchor(50))).toEqual({ width: 150, left: 70, top: 92, maxHeight: 360 });
});
it('fits an export menu above a low trigger without changing its width', () => {
  const geometry = dropdownMenuGeometry(anchor(540), { allowFlip: true, menuHeight: 180 });
  expect(geometry).toEqual({ width: 150, left: 70, top: 356, maxHeight: 360 });
});
it('limits long export menus to the available viewport space', () => {
  const geometry = dropdownMenuGeometry(anchor(260), { allowFlip: true, menuHeight: 900 });
  expect(geometry.top).toBe(302);
  expect(geometry.top + geometry.maxHeight).toBeLessThanOrEqual(600);
  expect(geometry.width).toBe(150);
});
it('widens a sharing menu independently of its narrow table control', () => {
  expect(dropdownMenuGeometry(anchor(50, 70, 112), { minWidth: 380 }))
    .toEqual({ width: 380, left: 70, top: 92, maxHeight: 360 });
});
it('keeps an expanded sharing menu inside the right viewport edge', () => {
  const geometry = dropdownMenuGeometry(anchor(50, 800, 112), { minWidth: 380 });
  expect(geometry.left + geometry.width).toBe(892);
});
it('fits an expanded sharing menu on a small screen', () => {
  const trigger = anchor(50, 200, 112);
  trigger.ownerDocument.defaultView.innerWidth = 320;
  expect(dropdownMenuGeometry(trigger, { minWidth: 380 })).toMatchObject({ width: 304, left: 8 });
});
it('opens a sharing menu upwards automatically near the bottom of the screen', () => {
  const geometry = dropdownMenuGeometry(anchor(540, 750, 112), { minWidth: 380 });
  expect(geometry.top).toBe(176);
  expect(geometry.top + geometry.maxHeight).toBeLessThan(540);
  expect(geometry.left + geometry.width).toBeLessThanOrEqual(892);
});
it('fits the menu on the side with more space in a short viewport', () => {
  const trigger = anchor(200);
  trigger.ownerDocument.defaultView.innerHeight = 320;
  const geometry = dropdownMenuGeometry(trigger);
  expect(geometry).toMatchObject({ top: 8, maxHeight: 188 });
});
it('respects the visible viewport when a mobile keyboard reduces the available area', () => {
  const trigger = anchor(300);
  Object.assign(trigger.ownerDocument.defaultView, { visualViewport: { height: 360, width: 320, offsetTop: 100, offsetLeft: 0 } });
  const geometry = dropdownMenuGeometry(trigger, { minWidth: 380 });
  expect(geometry.top).toBeGreaterThanOrEqual(108);
  expect(geometry.top + geometry.maxHeight).toBeLessThanOrEqual(452);
  expect(geometry.left + geometry.width).toBeLessThanOrEqual(312);
});
