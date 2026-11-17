import { describe, expect, test } from "bun:test";
import { INVOCATION_DEADLINE_MS, deadlineFrom, outOfTime } from "./deadline";
import { START_MARGIN_MS } from "./dispatch-whatsapp";

describe("the invocation deadline", () => {
  test("is inside the 60 seconds the routes are allowed", () => {
    expect(INVOCATION_DEADLINE_MS).toBeLessThanOrEqual(50_000);
    expect(deadlineFrom(1_000)).toBe(1_000 + INVOCATION_DEADLINE_MS);
  });

  test("a new send may begin until the safety margin is reached", () => {
    const deadline = deadlineFrom(0);
    expect(outOfTime(deadline, 0)).toBe(false);
    expect(outOfTime(deadline, deadline - START_MARGIN_MS)).toBe(false);
    expect(outOfTime(deadline, deadline - START_MARGIN_MS + 1)).toBe(true);
    expect(outOfTime(deadline, deadline + 5_000)).toBe(true);
  });
});
