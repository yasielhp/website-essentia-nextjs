import { describe, expect, test } from "bun:test";
import {
  hasStaleSync,
  latestSync,
  syncAge,
  nextTemplateName,
  statusTone,
  TEMPLATE_STATUSES,
} from "@/lib/whatsapp/template-ui";

describe("statusTone", () => {
  test("green is only for a template that can be sent", () => {
    const green = TEMPLATE_STATUSES.filter((s) => statusTone(s) === "success");
    expect(green).toEqual(["APPROVED"]);
  });
  test("red marks the states that need somebody to look", () => {
    const red = TEMPLATE_STATUSES.filter((s) => statusTone(s) === "danger");
    expect(red.sort()).toEqual(["DISABLED", "LOCKED", "REJECTED"]);
  });
  test("waiting and at-risk states are amber, inert ones grey", () => {
    expect(statusTone("PENDING")).toBe("warning");
    expect(statusTone("PAUSED")).toBe("warning");
    expect(statusTone("draft")).toBe("neutral");
    expect(statusTone("ARCHIVED")).toBe("neutral");
  });
  test("a state we know is told apart from one we do not", () => {
    expect(statusTone("APPROVED")).not.toBe(statusTone("REJECTED"));
    expect(TEMPLATE_STATUSES).toContain("APPROVED");
    expect(TEMPLATE_STATUSES).not.toContain("SOMETHING_NEW");
  });
  test("an unknown state falls back to neutral, never undefined", () => {
    expect(statusTone("SOMETHING_NEW")).toBe("neutral");
    expect(statusTone("")).toBe("neutral");
  });
  test("an inherited property name is not a state", () => {
    expect(statusTone("constructor")).toBe("neutral");
    expect(statusTone("__proto__")).toBe("neutral");
  });
});

describe("nextTemplateName", () => {
  test("adds _v2 to a fresh name", () => {
    expect(nextTemplateName("bienvenida", [])).toBe("bienvenida_v2");
  });
  test("steps over the names already in use", () => {
    expect(
      nextTemplateName("bienvenida", ["bienvenida_v2", "bienvenida_v3"]),
    ).toBe("bienvenida_v4");
  });
  test("counts on from a version suffix instead of stacking them", () => {
    expect(nextTemplateName("bienvenida_v2", ["bienvenida_v2"])).toBe(
      "bienvenida_v3",
    );
  });
  test("keeps to Meta's 512 characters", () => {
    const long = "a".repeat(512);
    const next = nextTemplateName(long, []);
    expect(next.length).toBeLessThanOrEqual(512);
    expect(next.endsWith("_v2")).toBe(true);
  });
});

const T0 = "2026-11-17T10:00:00.000Z";
const T1 = "2026-11-17T12:00:00.000Z";

describe("latestSync", () => {
  test("is the newest synced_at, or null when nothing was synced", () => {
    expect(latestSync([{ synced_at: T0 }, { synced_at: T1 }])).toBe(
      Date.parse(T1),
    );
    expect(latestSync([{ synced_at: null }])).toBeNull();
    expect(latestSync([])).toBeNull();
  });
});

describe("hasStaleSync", () => {
  const base = { meta_id: "123", synced_at: T1, updated_at: T1 };
  test("a template the last sync touched is fine", () => {
    expect(hasStaleSync(base, Date.parse(T1), true)).toBe(false);
  });
  test("one the last sync skipped may have been deleted at Meta", () => {
    expect(hasStaleSync({ ...base, synced_at: T0 }, Date.parse(T1), true)).toBe(
      true,
    );
  });
  test("one with no Meta id on a configured account never reached Meta", () => {
    expect(hasStaleSync({ ...base, meta_id: null }, Date.parse(T1), true)).toBe(
      true,
    );
  });
  test("a template just submitted is not stale before the first sync", () => {
    expect(hasStaleSync({ ...base, synced_at: null }, null, true)).toBe(false);
  });
  test("a submitted template a later sync never returned is stale", () => {
    expect(
      hasStaleSync(
        { ...base, synced_at: null, updated_at: T0 },
        Date.parse(T1),
        true,
      ),
    ).toBe(true);
  });
  test("nothing is stale without a configured account", () => {
    expect(
      hasStaleSync({ ...base, meta_id: null }, Date.parse(T1), false),
    ).toBe(false);
  });
});

describe("syncAge: how long ago the copy was brought from Meta", () => {
  const NOW = Date.parse("2026-11-24T12:00:00.000Z");
  const ago = (ms: number) => syncAge(NOW - ms, NOW);
  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  test("under a minute is 'a moment ago'", () => {
    expect(ago(0)).toEqual({ kind: "justNow" });
    expect(ago(59 * SECOND)).toEqual({ kind: "justNow" });
  });

  test("from a minute, whole minutes, rounded down, up to an hour", () => {
    expect(ago(MINUTE)).toEqual({ kind: "ago", value: 1, unit: "minute" });
    expect(ago(3 * MINUTE + 40 * SECOND)).toEqual({
      kind: "ago",
      value: 3,
      unit: "minute",
    });
    expect(ago(59 * MINUTE + 59 * SECOND)).toEqual({
      kind: "ago",
      value: 59,
      unit: "minute",
    });
  });

  test("from an hour, whole hours, up to a day", () => {
    expect(ago(HOUR)).toEqual({ kind: "ago", value: 1, unit: "hour" });
    expect(ago(2 * HOUR + 59 * MINUTE)).toEqual({
      kind: "ago",
      value: 2,
      unit: "hour",
    });
    expect(ago(23 * HOUR + 59 * MINUTE)).toEqual({
      kind: "ago",
      value: 23,
      unit: "hour",
    });
  });

  test("from a day, whole days", () => {
    expect(ago(DAY)).toEqual({ kind: "ago", value: 1, unit: "day" });
    expect(ago(3 * DAY + 5 * HOUR)).toEqual({
      kind: "ago",
      value: 3,
      unit: "day",
    });
    expect(ago(45 * DAY)).toEqual({ kind: "ago", value: 45, unit: "day" });
  });

  test("a sync that looks like the future (the browser's clock is a little behind) is 'a moment ago', never a negative age", () => {
    expect(syncAge(NOW + 5 * MINUTE, NOW)).toEqual({ kind: "justNow" });
  });
});
