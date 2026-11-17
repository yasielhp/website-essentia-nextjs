import { describe, expect, test } from "bun:test";
import { closeDecision } from "./close-decision";

describe("closeDecision", () => {
  test("a form nobody touched just closes", () => {
    expect(closeDecision({ dirty: false, submitting: false })).toBe("close");
  });
  test("a form with something written asks first, whatever closed it: Escape, the X, Cancel", () => {
    expect(closeDecision({ dirty: true, submitting: false })).toBe("ask");
  });
  test("while it is being sent nothing closes it", () => {
    expect(closeDecision({ dirty: true, submitting: true })).toBe("ignore");
    expect(closeDecision({ dirty: false, submitting: true })).toBe("ignore");
  });
});
