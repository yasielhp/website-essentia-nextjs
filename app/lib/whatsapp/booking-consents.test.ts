import { describe, expect, test } from "bun:test";
import {
  BOOKING_CONSENT_DEADLINE_MS,
  BOOKING_CONSENT_GRACE_MS,
  answerWithin,
  publicReply,
  writeBookingConsents,
  type BookingConsentEffects,
} from "@/lib/whatsapp/booking-consents";

/**
 * Every consent write of the booking form's details step, as ONE action with
 * ONE deadline. The stamping rules themselves (a fresh contact, no STOP) are in
 * `self-consent.test.ts`; here it is who is written, in what order, and that a
 * slow database costs the client a few seconds at most and never an error.
 */

const INPUT = {
  email: " Ana@Example.com ",
  firstName: "Ana",
  lastName: "García",
  phone: "600000000",
  language: "es" as const,
  marketing: false,
  termsAccepted: true,
};

type Session = { userId: string; email: string | null };

function effects(over: Partial<BookingConsentEffects> = {}) {
  const calls: { name: string; args: unknown[] }[] = [];
  const spy =
    <R>(name: string, result: R) =>
    (...args: unknown[]) => {
      calls.push({ name, args });
      return Promise.resolve(result);
    };
  const fx: BookingConsentEffects = {
    authenticate: spy<Session>("authenticate", {
      userId: "u1",
      email: "ANA@example.com",
    }),
    saveOwnContact: spy("contact", { ok: true }),
    stampNotice: spy("notice", { ok: true, stamped: true }),
    subscribeNewsletter: spy("newsletter", { ok: true }),
    ...over,
  };
  return { fx, calls, names: () => calls.map((c) => c.name) };
}

/** A timer the test fires by hand, so nothing waits three real seconds. */
function fakeTimer() {
  const pending: { fn: () => void; ms: number; cancelled: boolean }[] = [];
  return {
    startTimer: (fn: () => void, ms: number) => {
      const timer = { fn, ms, cancelled: false };
      pending.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
    fire: () => pending.forEach((t) => !t.cancelled && t.fn()),
    pending,
  };
}

const never = () => new Promise<never>(() => undefined);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("writeBookingConsents, a guest", () => {
  test("accepting the terms stamps the notice consent on the address of the step", async () => {
    const { fx, calls, names } = effects();
    const result = await writeBookingConsents(null, INPUT, fx);
    expect(result).toEqual({ ok: true, stamped: true });
    expect(names()).toEqual(["notice"]);
    expect(calls[0].args).toEqual(["ana@example.com", "600000000"]);
  });

  test("without the terms nothing is written, and that is not an error", async () => {
    const { fx, names } = effects();
    const result = await writeBookingConsents(
      null,
      { ...INPUT, termsAccepted: false },
      fx,
    );
    expect(result).toEqual({ ok: true, stamped: false });
    expect(names()).toEqual([]);
  });

  test("an input that is not what the form sends is refused before anything is read", async () => {
    for (const input of [
      null,
      {},
      { email: "ana@example.com" },
      { ...INPUT, termsAccepted: "true" },
      { ...INPUT, marketing: "yes" },
      { ...INPUT, language: "fr" },
    ]) {
      const { fx, names } = effects();
      expect(await writeBookingConsents(null, input, fx)).toEqual({
        ok: false,
        stamped: false,
        error: "invalid",
      });
      expect(names()).toEqual([]);
    }
  });

  test("an address that is not one stamps nobody", async () => {
    for (const email of [undefined, "", "not an address", 42]) {
      const { fx, names } = effects();
      expect(await writeBookingConsents(null, { ...INPUT, email }, fx)).toEqual(
        { ok: false, stamped: false, error: "noEmail" },
      );
      expect(names()).toEqual([]);
    }
  });

  test("a failing or throwing write answers ok:false and never throws", async () => {
    for (const stampNotice of [
      () => Promise.resolve({ ok: false }),
      () => Promise.reject(new Error("raw database text")),
      () => {
        throw new Error("raw database text");
      },
    ]) {
      const { fx } = effects({ stampNotice });
      const result = await writeBookingConsents(null, INPUT, fx);
      expect(result).toEqual({ ok: false, stamped: false, error: "db" });
      expect(JSON.stringify(result)).not.toContain("raw");
    }
  });
});

describe("writeBookingConsents, a signed-in client", () => {
  test("with her own address in the form, her contact is written first, then the notice consent", async () => {
    const { fx, calls, names } = effects();
    const result = await writeBookingConsents("token", INPUT, fx);
    expect(result).toEqual({ ok: true, stamped: true });
    expect(names()).toEqual(["authenticate", "contact", "notice"]);
    expect(calls[1].args).toEqual([
      "ana@example.com",
      {
        firstName: "Ana",
        lastName: "García",
        phone: "600000000",
        language: "es",
        marketing: false,
      },
    ]);
    expect(calls[2].args).toEqual(["ana@example.com", "600000000"]);
  });

  test("the news and offers box also puts her on the list, last, with her own id and address", async () => {
    const { fx, calls, names } = effects();
    await writeBookingConsents("token", { ...INPUT, marketing: true }, fx);
    expect(names()).toEqual([
      "authenticate",
      "contact",
      "notice",
      "newsletter",
    ]);
    expect(calls[1].args[1]).toMatchObject({ marketing: true });
    expect(calls[3].args).toEqual(["u1", "ana@example.com"]);
  });

  test("without the terms her contact is still written but no notice is stamped", async () => {
    const { fx, names } = effects();
    const result = await writeBookingConsents(
      "token",
      { ...INPUT, termsAccepted: false },
      fx,
    );
    expect(result).toEqual({ ok: true, stamped: false });
    expect(names()).toEqual(["authenticate", "contact"]);
  });

  test("a token that does not verify writes nothing and never falls back to the guest's address", async () => {
    const { fx, names } = effects({
      authenticate: () => Promise.reject(new Error("Invalid session")),
    });
    const result = await writeBookingConsents("stale", INPUT, fx);
    expect(result).toEqual({ ok: false, stamped: false, error: "auth" });
    expect(names()).toEqual([]);
  });

  test("a contact that cannot be saved does not stop the notice step", async () => {
    for (const saveOwnContact of [
      () => Promise.resolve({ ok: false }),
      () => Promise.reject(new Error("boom")),
    ]) {
      const { fx, names } = effects({ saveOwnContact });
      const result = await writeBookingConsents("token", INPUT, fx);
      expect(result).toEqual({ ok: false, stamped: true, error: "db" });
      expect(names()).toEqual(["authenticate", "notice"]);
    }
  });

  test("details the contact cannot take are refused, and the notice step still runs", async () => {
    const { fx, names } = effects();
    const result = await writeBookingConsents(
      "token",
      { ...INPUT, firstName: "", phone: "1" },
      fx,
    );
    expect(result).toEqual({ ok: false, stamped: true, error: "invalid" });
    expect(names()).toEqual(["authenticate", "notice"]);
  });

  test("a list that cannot be updated is reported, with everything else done", async () => {
    const { fx } = effects({
      subscribeNewsletter: () => Promise.resolve({ ok: false }),
    });
    const result = await writeBookingConsents(
      "token",
      { ...INPUT, marketing: true },
      fx,
    );
    expect(result).toEqual({ ok: false, stamped: true, error: "newsletter" });
  });
});

describe("writeBookingConsents, signed in but booking with another address", () => {
  // Somebody booking for another person, or staff with their session open: the
  // name and the phone in the form are that other person's.
  const OTHER = { ...INPUT, email: "Client@Example.com" };

  test("the contact of the session is not touched: no contact write, no list, no stamp on it", async () => {
    const { fx, calls, names } = effects();
    const result = await writeBookingConsents(
      "token",
      { ...OTHER, marketing: true },
      fx,
    );
    expect(result).toEqual({ ok: true, stamped: true });
    expect(names()).toEqual(["authenticate", "notice"]);
    // The consent of that booking goes the way a guest's does: the address of
    // the form, under the rules of the stamp (a contact just written, no STOP).
    expect(calls[1].args).toEqual(["client@example.com", "600000000"]);
    expect(JSON.stringify(calls)).not.toContain("ana@example.com");
  });

  test("the same address in another case or with spaces is still her own", async () => {
    const { fx, names } = effects();
    await writeBookingConsents(
      "token",
      { ...INPUT, email: "  aNa@EXAMPLE.com" },
      fx,
    );
    expect(names()).toEqual(["authenticate", "contact", "notice"]);
  });

  test("without the terms there is nothing to write for the other person", async () => {
    const { fx, names } = effects();
    const result = await writeBookingConsents(
      "token",
      { ...OTHER, termsAccepted: false },
      fx,
    );
    expect(result).toEqual({ ok: true, stamped: false });
    expect(names()).toEqual(["authenticate"]);
  });

  test("a session with no address writes no contact of its own either", async () => {
    const { fx, calls, names } = effects({
      authenticate: () => Promise.resolve({ userId: "u1", email: null }),
    });
    const result = await writeBookingConsents("token", OTHER, fx);
    expect(result).toEqual({ ok: true, stamped: true });
    expect(names()).toEqual(["notice"]);
    expect(calls[0].args).toEqual(["client@example.com", "600000000"]);
  });
});

describe("writeBookingConsents: one deadline for all of it", () => {
  test("the deadline is three seconds, and one timer covers the whole action", async () => {
    expect(BOOKING_CONSENT_DEADLINE_MS).toBe(3000);
    const timer = fakeTimer();
    const { fx } = effects();
    await writeBookingConsents(
      "token",
      { ...INPUT, marketing: true },
      fx,
      timer,
    );
    expect(timer.pending).toHaveLength(1);
    expect(timer.pending[0].ms).toBe(BOOKING_CONSENT_DEADLINE_MS);
    // Finished in time: the timer is cancelled, so nothing keeps the function alive.
    expect(timer.pending[0].cancelled).toBe(true);
  });

  for (const [hung, started] of [
    ["authenticate", []],
    ["saveOwnContact", ["authenticate"]],
    ["stampNotice", ["authenticate", "contact"]],
    ["subscribeNewsletter", ["authenticate", "contact", "notice"]],
  ] as const) {
    test(`a ${hung} that never answers is given up on, and nothing is started after it`, async () => {
      const timer = fakeTimer();
      const { fx, names } = effects({ [hung]: never });
      let result: unknown = "pending";
      const run = writeBookingConsents(
        "token",
        { ...INPUT, marketing: true },
        fx,
        timer,
      ).then((r) => {
        result = r;
      });

      await tick();
      expect(result).toBe("pending");

      timer.fire();
      await run;
      expect(result).toEqual({
        ok: false,
        stamped: hung === "subscribeNewsletter",
        error: "timeout",
      });
      await tick();
      expect(names()).toEqual([...started]);
    });
  }

  test("a session check that answers after the deadline writes nothing: the deadline is checked before the contact write begins", async () => {
    const timer = fakeTimer();
    let release: (value: Session) => void = () => undefined;
    const { fx, names } = effects({
      authenticate: () =>
        new Promise<Session>((resolve) => {
          release = resolve;
        }),
    });
    const run = writeBookingConsents("token", INPUT, fx, timer);
    await tick();
    timer.fire();
    expect(await run).toEqual({ ok: false, stamped: false, error: "timeout" });
    release({ userId: "u1", email: "ana@example.com" });
    await tick();
    expect(names()).toEqual([]);
  });

  test("once her contact is being written, the notice consent is ALWAYS attempted, deadline or not", async () => {
    // Otherwise a booking would be left with a contact and no notices; and a
    // client who ticked news and offers after a STOP (which withdraws the
    // notices) would keep the news and lose the notices until she booked again.
    const timer = fakeTimer();
    let release: (value: { ok: boolean }) => void = () => undefined;
    const kept: Promise<unknown>[] = [];
    const { fx, names } = effects({
      saveOwnContact: () =>
        new Promise<{ ok: boolean }>((resolve) => {
          release = resolve;
        }),
      keepAlive: (work) => void kept.push(work),
    });
    const run = writeBookingConsents(
      "token",
      { ...INPUT, marketing: true },
      fx,
      timer,
    );
    await tick();
    timer.fire();
    // The browser is answered at the deadline all the same...
    expect(await run).toEqual({ ok: false, stamped: false, error: "timeout" });
    // ...and what was begun is handed over to be kept alive, not left loose.
    expect(kept).toHaveLength(1);

    release({ ok: true });
    await kept[0];
    // The stamp followed the contact. The list did not: it is a copy, and it
    // is not begun once time is up.
    expect(names()).toEqual(["authenticate", "notice"]);
  });

  test("a stamp still running at the deadline is kept alive too, and nothing is begun after it", async () => {
    const timer = fakeTimer();
    let release: (value: { ok: boolean; stamped: boolean }) => void = () =>
      undefined;
    const kept: Promise<unknown>[] = [];
    const { fx, names } = effects({
      stampNotice: () =>
        new Promise<{ ok: boolean; stamped: boolean }>((resolve) => {
          release = resolve;
        }),
      keepAlive: (work) => void kept.push(work),
    });
    const run = writeBookingConsents(
      "token",
      { ...INPUT, marketing: true },
      fx,
      timer,
    );
    await tick();
    timer.fire();
    expect(await run).toEqual({ ok: false, stamped: false, error: "timeout" });
    expect(kept).toHaveLength(1);
    release({ ok: true, stamped: true });
    await kept[0];
    expect(names()).toEqual(["authenticate", "contact"]);
  });

  test("a session check that hangs is not kept alive: nothing was begun", async () => {
    const timer = fakeTimer();
    const kept: Promise<unknown>[] = [];
    const { fx } = effects({
      authenticate: never,
      keepAlive: (work) => void kept.push(work),
    });
    const run = writeBookingConsents("token", INPUT, fx, timer);
    await tick();
    timer.fire();
    await run;
    expect(kept).toEqual([]);
    expect(timer.pending).toHaveLength(1);
  });

  test("what is kept alive has a grace of its own: a write that never answers is let go", async () => {
    const timer = fakeTimer();
    const kept: Promise<unknown>[] = [];
    const { fx } = effects({
      stampNotice: never,
      keepAlive: (work) => void kept.push(work),
    });
    const run = writeBookingConsents(null, INPUT, fx, timer);
    await tick();
    timer.fire();
    await run;
    expect(timer.pending).toHaveLength(2);
    expect(timer.pending[1].ms).toBe(BOOKING_CONSENT_GRACE_MS);
    timer.fire();
    await kept[0];
    expect(timer.pending[1].cancelled).toBe(true);
  });

  test("work that finished in time is not handed over to anyone", async () => {
    const kept: Promise<unknown>[] = [];
    const { fx } = effects({ keepAlive: (work) => void kept.push(work) });
    await writeBookingConsents("token", { ...INPUT, marketing: true }, fx);
    expect(kept).toEqual([]);
  });

  test("a keeper that throws does not cost the answer", async () => {
    const { fx } = effects({
      stampNotice: never,
      keepAlive: () => {
        throw new Error("outside a request");
      },
    });
    expect(
      await writeBookingConsents(null, INPUT, fx, { deadlineMs: 20 }),
    ).toEqual({ ok: false, stamped: false, error: "timeout" });
  });

  test("a write that fails after the deadline is nobody's unhandled rejection", async () => {
    const timer = fakeTimer();
    let fail: (reason: Error) => void = () => undefined;
    const { fx } = effects({
      stampNotice: () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    });
    const run = writeBookingConsents(null, INPUT, fx, timer);
    await tick();
    timer.fire();
    expect(await run).toEqual({ ok: false, stamped: false, error: "timeout" });
    fail(new Error("late"));
    await tick();
  });

  test("with a real clock, a database that hangs is answered on time and without throwing", async () => {
    const { fx } = effects({ stampNotice: never });
    const startedAt = Date.now();
    const result = await writeBookingConsents(null, INPUT, fx, {
      deadlineMs: 40,
    });
    expect(result).toEqual({ ok: false, stamped: false, error: "timeout" });
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });
});

describe("answerWithin: a consent read under the same deadline", () => {
  test("the answer, when it comes in time", async () => {
    const timer = fakeTimer();
    expect(await answerWithin(() => Promise.resolve(true), false, timer)).toBe(
      true,
    );
    expect(timer.pending[0].ms).toBe(BOOKING_CONSENT_DEADLINE_MS);
    expect(timer.pending[0].cancelled).toBe(true);
  });

  test("the fallback when the read hangs, on time and without throwing", async () => {
    const startedAt = Date.now();
    expect(await answerWithin(never, false, { deadlineMs: 40 })).toBe(false);
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });

  test("the fallback when the read throws", async () => {
    expect(
      await answerWithin(() => Promise.reject(new Error("boom")), false),
    ).toBe(false);
  });
});

describe("publicReply: what a stranger is told", () => {
  test("whether the consent was stamped never leaves the server", () => {
    expect(publicReply({ ok: true, stamped: true })).toEqual({ ok: true });
    expect(publicReply({ ok: true, stamped: false })).toEqual({ ok: true });
  });

  test("an error is about the request, and is all that is added", () => {
    expect(publicReply({ ok: false, stamped: true, error: "timeout" })).toEqual(
      { ok: false, error: "timeout" },
    );
    expect(publicReply({ ok: false, stamped: false, error: "db" })).toEqual({
      ok: false,
      error: "db",
    });
  });
});
