import { describe, expect, test } from "bun:test";
import {
  hasStaleSync,
  latestSync,
  nextTemplateName,
  statusTone,
  TEMPLATE_STATUSES,
} from "@/lib/whatsapp/template-ui";

describe("statusTone", () => {
  test("every state Meta can report has a tone", () => {
    expect(TEMPLATE_STATUSES).toHaveLength(13);
    for (const status of TEMPLATE_STATUSES) {
      expect(typeof statusTone(status)).toBe("string");
    }
  });
  test("approved is green and rejected is red", () => {
    expect(statusTone("APPROVED")).toBe("success");
    expect(statusTone("REJECTED")).toBe("danger");
    expect(statusTone("PENDING")).toBe("warning");
    expect(statusTone("draft")).toBe("neutral");
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
