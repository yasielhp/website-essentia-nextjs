/**
 * Where an arrow key moves inside a radio group (WAI-ARIA: the arrows move the
 * selection, wrapping at the ends; Home and End jump to them). Null for a key
 * the group does not handle, so the caller leaves it alone.
 */
export function radioTarget(
  key: string,
  index: number,
  count: number,
): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (index + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
