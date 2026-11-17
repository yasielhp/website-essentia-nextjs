import { describe, expect, test } from "bun:test";
import type { DispatchResult } from "./dispatch";
import { sendOutcome } from "./send-outcome";

describe("sendOutcome", () => {
  test("the eligibility code of an unavailable template reaches the browser", () => {
    expect(
      sendOutcome({
        ok: false,
        error: "template_unavailable",
        detail: "template_not_approved",
      }),
    ).toEqual({
      ok: false,
      error: "template_unavailable",
      detail: "template_not_approved",
    });
  });

  test("a database error's detail, which is Postgres's own text, stays on the server", () => {
    expect(
      sendOutcome({
        ok: false,
        error: "db",
        detail: 'relation "campaign_recipients" does not exist',
      }),
    ).toEqual({ ok: false, error: "db" });
  });

  test.each([
    "not_claimable",
    "empty_audience",
    "no_api_key",
    "whatsapp_not_configured",
    "nothing_to_retry",
  ] as const)("%s never carries a detail", (error) => {
    const result: DispatchResult = { ok: false, error, detail: "internal" };
    expect(sendOutcome(result)).toEqual({ ok: false, error });
  });

  test("a template error without detail has none", () => {
    expect(sendOutcome({ ok: false, error: "template_unavailable" })).toEqual({
      ok: false,
      error: "template_unavailable",
    });
  });

  test("a plain success is just the counts", () => {
    expect(sendOutcome({ ok: true, sent: 3, failed: 1 })).toEqual({
      ok: true,
      sent: 3,
      failed: 1,
    });
  });

  test("a partial send reports what it left", () => {
    expect(
      sendOutcome({
        ok: true,
        sent: 10,
        failed: 0,
        remaining: 15,
        unrecorded: 1,
        halted: "132000: x",
      }),
    ).toEqual({
      ok: true,
      sent: 10,
      failed: 0,
      remaining: 15,
      unrecorded: 1,
      halted: "132000: x",
    });
  });

  test("zero remaining and unrecorded are left out", () => {
    expect(
      sendOutcome({
        ok: true,
        sent: 1,
        failed: 0,
        remaining: 0,
        unrecorded: 0,
      }),
    ).toEqual({ ok: true, sent: 1, failed: 0 });
  });
});
