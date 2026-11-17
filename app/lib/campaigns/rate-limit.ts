/**
 * A sliding-window limiter over plain timestamps, with an injectable clock.
 *
 * It lives in the memory of the process. On a serverless host every instance
 * has its own, and an instance can be recycled at any time, so this is a
 * brake on a stuck button or a careless loop, not a guarantee: it cannot stop
 * somebody determined. A real limit would need a shared store.
 */
export type RateLimiter = {
  /** Records one use and returns true, or returns false (recording nothing). */
  take: (key: string) => boolean;
  /** How many keys are being remembered. */
  size: () => number;
};

export function createRateLimiter(options: {
  max: number;
  windowMs: number;
  now?: () => number;
}): RateLimiter {
  const { max, windowMs } = options;
  const now = options.now ?? Date.now;
  const uses = new Map<string, number[]>();

  /** Drops the uses that left the window, and the keys with none left. */
  function prune(at: number) {
    for (const [key, times] of uses) {
      const live = times.filter((t) => at - t < windowMs);
      if (live.length === 0) uses.delete(key);
      else if (live.length !== times.length) uses.set(key, live);
    }
  }

  return {
    take(key) {
      const at = now();
      prune(at);
      const times = uses.get(key) ?? [];
      if (times.length >= max) return false;
      uses.set(key, [...times, at]);
      return true;
    },
    size: () => uses.size,
  };
}
