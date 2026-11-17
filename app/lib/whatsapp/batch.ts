/**
 * The items in consecutive runs of at most `size`, in order.
 *
 * A payload from Meta can carry hundreds of states; handling them one run at a
 * time keeps the number of requests in flight bounded. A size below one is
 * treated as one so a bad argument cannot loop forever.
 */
export function inBatches<T>(items: readonly T[], size: number): T[][] {
  const step = Math.max(1, Math.floor(size));
  const runs: T[][] = [];
  for (let i = 0; i < items.length; i += step) {
    runs.push(items.slice(i, i + step));
  }
  return runs;
}
