import { describe, expect, test } from "bun:test";
import { AUTO_SYNC_EVERY_MS, shouldAutoSync } from "./auto-sync";

const NOW = Date.parse("2026-11-18T09:00:00Z");
const MIN = 60 * 1000;

describe("when the templates page asks Meta by itself", () => {
  const ask = (over: Partial<Parameters<typeof shouldAutoSync>[0]>) =>
    shouldAutoSync({
      configured: true,
      lastSyncMs: null,
      lastAttemptMs: null,
      nowMs: NOW,
      ...over,
    });

  test("never when the server cannot reach the account", () => {
    expect(ask({ configured: false })).toBe(false);
    expect(ask({ configured: false, lastSyncMs: NOW - 60 * MIN })).toBe(false);
  });
  test("a copy that was never synced is asked for", () => {
    expect(ask({})).toBe(true);
  });
  test("a copy ten minutes old or older is asked for, a fresher one is not", () => {
    expect(ask({ lastSyncMs: NOW - AUTO_SYNC_EVERY_MS })).toBe(true);
    expect(ask({ lastSyncMs: NOW - 60 * MIN })).toBe(true);
    expect(ask({ lastSyncMs: NOW - 9 * MIN })).toBe(false);
    expect(ask({ lastSyncMs: NOW })).toBe(false);
  });
  test("it does not ask twice within ten minutes from one browser, whatever the copy says", () => {
    // An account with no templates never gets a sync date: without this it
    // would ask on every visit, and again after every answer.
    expect(ask({ lastSyncMs: null, lastAttemptMs: NOW - 1 * MIN })).toBe(false);
    expect(
      ask({ lastSyncMs: NOW - 60 * MIN, lastAttemptMs: NOW - 9 * MIN }),
    ).toBe(false);
    expect(ask({ lastSyncMs: null, lastAttemptMs: NOW - 10 * MIN })).toBe(true);
  });
});
