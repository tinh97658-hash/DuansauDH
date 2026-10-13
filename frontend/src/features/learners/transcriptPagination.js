// Rendering-only pagination: measured row heights, never a second data mapping.
export function paginateTranscriptRows(heights, firstCapacity, nextCapacity) {
  const pages = [[]];
  let remaining = firstCapacity;
  heights.forEach((height, index) => {
    if (pages[pages.length - 1].length && height > remaining) {
      pages.push([]); remaining = nextCapacity;
    }
    pages[pages.length - 1].push(index);
    remaining -= height;
  });
  return pages;
}
