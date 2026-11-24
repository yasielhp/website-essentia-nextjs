import { describe, expect, test } from "bun:test";
import type { SessionTypeSaveResult } from "@/types/settings";
import type { FormState } from "./tier-form-state";
import { TIER_SAVE_LIMIT_MS, saveWithin, tierPayload } from "./tier-save";

/**
 * The saving side of the session-type modal: what it sends to
 * `saveSessionType`, and that it always gets the screen back.
 */

const form = (over: Partial<FormState> = {}): FormState => ({
  duration: "60",
  priceWeb: "81",
  priceCenter: "90",
  priceSuite: "120",
  discount: "10",
  color: "#6b7280",
  active: true,
  ...over,
});

describe("tierPayload", () => {
  test("the form as numbers, with the staff in their order", () => {
    expect(tierPayload(form(), ["b", "a"])).toEqual({
      duration_minutes: 60,
      price_eur: 81,
      price_center_eur: 90,
      price_suite_eur: 120,
      color: "#6b7280",
      active: true,
      staffIds: ["b", "a"],
    });
  });

  test("the discount is not sent: it is whatever the two prices say", () => {
    expect(Object.keys(tierPayload(form(), null))).toEqual([
      "duration_minutes",
      "price_eur",
      "price_center_eur",
      "price_suite_eur",
      "color",
      "active",
      "staffIds",
    ]);
  });

  test("an empty field is 'none', not zero", () => {
    expect(
      tierPayload(
        form({
          duration: "",
          priceWeb: " ",
          priceCenter: "",
          priceSuite: "",
          color: "",
          active: false,
        }),
        [],
      ),
    ).toEqual({
      duration_minutes: null,
      price_eur: null,
      price_center_eur: null,
      price_suite_eur: null,
      color: null,
      active: false,
      staffIds: [],
    });
  });

  test("cents stay cents", () => {
    expect(tierPayload(form({ priceWeb: "19.99" }), null).price_eur).toBe(
      19.99,
    );
  });

  test("what is typed wrong is sent as typed, for the server to refuse with a reason", () => {
    const sent = tierPayload(
      form({ priceWeb: "89.999", priceCenter: "-5", priceSuite: "abc" }),
      null,
    );
    expect(sent.price_eur).toBe(89.999);
    expect(sent.price_center_eur).toBe(-5);
    // Not emptied: an unreadable price must not clear the one that was there.
    expect(Number.isNaN(sent.price_suite_eur)).toBe(true);
  });

  test("staff that were never read are 'leave them', not 'nobody'", () => {
    expect(tierPayload(form(), null).staffIds).toBeNull();
  });
});

describe("saveWithin", () => {
  const OK: SessionTypeSaveResult = { ok: true };

  test("answers with what the save answered", async () => {
    expect(await saveWithin(async () => OK, 1_000)).toEqual(OK);
    expect(
      await saveWithin(async () => ({ ok: false, error: "forbidden" }), 1_000),
    ).toEqual({ ok: false, error: "forbidden" });
  });

  test("a save that never answers gives the screen back when the limit passes", async () => {
    const started = Date.now();
    const result = await saveWithin(() => new Promise(() => {}), 40);
    expect(result).toEqual({ ok: false, error: "timeout" });
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  test("a call that breaks is an answer too, never an exception in the modal", async () => {
    expect(
      await saveWithin(async () => {
        throw new Error("Failed to fetch");
      }, 1_000),
    ).toEqual({ ok: false, error: "failed" });
    expect(
      await saveWithin(() => {
        throw new Error("thrown before a promise");
      }, 1_000),
    ).toEqual({ ok: false, error: "failed" });
  });

  test("an answer that is not one (a deploy in the middle) is a failure, not a success", async () => {
    for (const odd of [undefined, null, "ok", {}, { ok: "yes" }]) {
      expect(
        await saveWithin(
          async () => odd as unknown as SessionTypeSaveResult,
          1_000,
        ),
      ).toEqual({ ok: false, error: "failed" });
    }
  });

  test("an answer that arrives after the limit changes nothing", async () => {
    let late: (value: SessionTypeSaveResult) => void = () => {};
    const waiting = saveWithin(
      () => new Promise<SessionTypeSaveResult>((resolve) => (late = resolve)),
      30,
    );
    expect(await waiting).toEqual({ ok: false, error: "timeout" });
    late(OK);
    expect(await waiting).toEqual({ ok: false, error: "timeout" });
  });

  test("the modal waits longer than the server's own deadline, so the server's answer is the one shown", async () => {
    const { SESSION_TYPE_SAVE_DEADLINE_MS } =
      await import("@/lib/session-types/save");
    expect(TIER_SAVE_LIMIT_MS).toBeGreaterThan(SESSION_TYPE_SAVE_DEADLINE_MS);
  });
});
