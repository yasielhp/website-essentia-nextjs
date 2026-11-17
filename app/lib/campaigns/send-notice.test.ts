import { describe, expect, test } from "bun:test";
import { sendNotice } from "./send-notice";

describe("sendNotice", () => {
  test("a send that went through is done", () => {
    expect(sendNotice({ ok: true, sent: 10, failed: 1 })).toEqual({
      kind: "done",
      unrecorded: 0,
    });
  });
  test("a send that stopped with rows left is not done", () => {
    expect(
      sendNotice({ ok: true, sent: 450, failed: 0, remaining: 120 }),
    ).toEqual({
      kind: "partial",
      sent: 450,
      remaining: 120,
      unrecorded: 0,
    });
  });
  test("a send Meta kept refusing says why, and is never done", () => {
    expect(
      sendNotice({
        ok: true,
        sent: 0,
        failed: 30,
        remaining: 70,
        halted: "Template paused",
      }),
    ).toEqual({ kind: "halted", reason: "Template paused", unrecorded: 0 });
  });
  test("the halt wins over the rows left", () => {
    const notice = sendNotice({
      ok: true,
      sent: 1,
      failed: 0,
      remaining: 5,
      halted: "x",
    });
    expect(notice.kind).toBe("halted");
  });
  test("messages sent without their row updated are reported on any outcome", () => {
    expect(sendNotice({ ok: true, sent: 5, failed: 0, unrecorded: 2 })).toEqual(
      {
        kind: "done",
        unrecorded: 2,
      },
    );
    expect(
      sendNotice({ ok: true, sent: 5, failed: 0, remaining: 3, unrecorded: 2 }),
    ).toEqual({ kind: "partial", sent: 5, remaining: 3, unrecorded: 2 });
    expect(
      sendNotice({ ok: true, sent: 5, failed: 0, halted: "x", unrecorded: 2 }),
    ).toMatchObject({ kind: "halted", unrecorded: 2 });
  });
});
