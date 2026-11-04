const directions = {
  ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
};
const editable = input => !input.disabled && !input.readOnly;

// Navigate only the rendered score grid. Tab and modified arrows retain their
// normal behavior; focusing the next input runs the current input's usual blur.
export function navigateScoreGrid(event) {
  const direction = directions[event.key];
  if (!direction || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
    || event.isComposing || event.nativeEvent?.isComposing) return;
  const input = event.target;
  if (!input?.matches?.('input[data-score-column]') || !editable(input)) return;
  const row = input.closest('tr');
  const body = row?.closest('tbody');
  if (!row || !body) return;
  event.preventDefault();
  const [vertical, horizontal] = direction;
  let target;
  if (horizontal) {
    const cells = [...row.querySelectorAll('input[data-score-column]')].filter(editable);
    target = cells[cells.indexOf(input) + horizontal];
  } else {
    const rows = [...body.rows];
    for (let index = rows.indexOf(row) + vertical; index >= 0 && index < rows.length; index += vertical) {
      target = [...rows[index].querySelectorAll('input[data-score-column]')]
        .find(candidate => candidate.dataset.scoreColumn === input.dataset.scoreColumn && editable(candidate));
      if (target) break;
    }
  }
  if (!target) return;
  target.focus({ preventScroll: true });
  target.select();
  target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}
