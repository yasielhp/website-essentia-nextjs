import { describe, expect, test } from "bun:test";
import { createRateLimiter } from "./rate-limit";

function clock(start = 1_000_000) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("createRateLimiter", () => {
  test("lets through up to the maximum, then refuses", () => {
    const c = clock();
    const limiter = createRateLimiter({ max: 3, windowMs: 1000, now: c.now });
    expect([1, 2, 3].map(() => limiter.take("a"))).toEqual([true, true, true]);
    expect(limiter.take("a")).toBe(false);
  });

  test("a refusal does not count as a use", () => {
    const c = clock();
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, now: c.now });
    expect(limiter.take("a")).toBe(true);
    c.advance(900);
    expect(limiter.take("a")).toBe(false);
    c.advance(101);
    // Only the first use counts, so it has now left the window.
    expect(limiter.take("a")).toBe(true);
  });

  test("the window slides: each use leaves on its own time", () => {
    const c = clock();
    const limiter = createRateLimiter({ max: 2, windowMs: 1000, now: c.now });
    expect(limiter.take("a")).toBe(true); // t=0
    c.advance(600);
    expect(limiter.take("a")).toBe(true); // t=600
    c.advance(300);
    expect(limiter.take("a")).toBe(false); // t=900: both inside
    c.advance(150);
    expect(limiter.take("a")).toBe(true); // t=1050: the first left
    expect(limiter.take("a")).toBe(false); // t=1050: second + new inside
  });

  test("each key has its own allowance", () => {
    const c = clock();
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, now: c.now });
    expect(limiter.take("a")).toBe(true);
    expect(limiter.take("b")).toBe(true);
    expect(limiter.take("a")).toBe(false);
  });

  test("forgets a key once its uses have all left, so the map does not grow", () => {
    const c = clock();
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, now: c.now });
    limiter.take("a");
    expect(limiter.size()).toBe(1);
    c.advance(2000);
    limiter.take("b");
    expect(limiter.size()).toBe(1);
  });
});
