import { dropdownMenuGeometry } from '../../utils/dropdownGeometry';

const anchor = (top, left = 70, width = 150) => ({
  ownerDocument: { defaultView: { innerWidth: 900, innerHeight: 600 } },
  getBoundingClientRect: () => ({ top, bottom: top + 38, left, right: left + width, width }),
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
