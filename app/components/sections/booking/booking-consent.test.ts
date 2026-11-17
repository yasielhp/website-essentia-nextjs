import { describe, expect, test } from "bun:test";
import {
  CONSENT_DEADLINE_MS,
  contactConsentArgs,
  writeBookingConsents,
  writeBookingConsentsWithin,
  type ConsentEffects,
} from "./booking-consent";
import type { DetailsState } from "@/types";

const DETAILS: DetailsState = {
  firstName: "Ana",
  lastName: "G",
  email: "ana@example.com",
  phone: "600000000",
  consent: true,
  newsletter: false,
};

function effects(over: Partial<ConsentEffects> = {}) {
  const calls: { name: string; args: unknown[] }[] = [];
  const spy =
    <A extends unknown[]>(name: string, ret: unknown = { ok: true }) =>
    (...args: A) => {
      calls.push({ name, args });
      return Promise.resolve(ret) as never;
    };
  const fx: ConsentEffects = {
    getAccessToken: () => "token",
    updateNewsletterForUser: spy("newsletter"),
    saveOwnWhatsAppConsent: spy("contact"),
    recordBookingNoticeConsent: spy("notice"),
    log: (message, detail) =>
      calls.push({ name: "log", args: [message, detail] }),
    ...over,
  };
  return { fx, calls, names: () => calls.map((c) => c.name) };
}

describe("contactConsentArgs", () => {
  test("one ticked box turns on both the newsletter and WhatsApp marketing", () => {
    expect(contactConsentArgs({ newsletter: true })).toEqual({
      p_newsletter: true,
      p_whatsapp_marketing: true,
    });
  });

  test("unticked is null for both, never false", () => {
    for (const newsletter of [false, undefined]) {
      expect(contactConsentArgs({ newsletter })).toEqual({
        p_newsletter: null,
        p_whatsapp_marketing: null,
      });
    }
  });
});

describe("writeBookingConsents, a guest", () => {
  test("accepting the terms records the notice consent on the address of the step", async () => {
    const { fx, calls, names } = effects();
    await writeBookingConsents({
      user: null,
      locale: "es",
      details: DETAILS,
      effects: fx,
    });
    expect(names()).toEqual(["notice"]);
    expect(calls[0].args).toEqual([
      null,
      { termsAccepted: true, email: "ana@example.com" },
    ]);
  });

  test("without the terms accepted nothing is recorded", async () => {
    const { fx, names } = effects();
    await writeBookingConsents({
      user: null,
      locale: "es",
      details: { ...DETAILS, consent: false },
      effects: fx,
    });
    expect(names()).toEqual([]);
  });

  test("a failing or throwing action is logged and never thrown", async () => {
    for (const recordBookingNoticeConsent of [
      () => Promise.resolve({ ok: false, error: "db" }),
      () => Promise.reject(new Error("raw database text")),
    ]) {
      const { fx, names } = effects({ recordBookingNoticeConsent });
      await writeBookingConsents({
        user: null,
        locale: "es",
        details: DETAILS,
        effects: fx,
      });
      expect(names()).toContain("log");
    }
  });
});

describe("writeBookingConsents, a signed-in client", () => {
  const USER = { id: "u1" };

  test("her contact is written first, then the notice consent with her token and no address", async () => {
    const { fx, calls, names } = effects();
    await writeBookingConsents({
      user: USER,
      locale: "es",
      details: DETAILS,
      effects: fx,
    });
    expect(names()).toEqual(["contact", "notice"]);
    expect(calls[0].args[1]).toMatchObject({
      marketing: false,
      language: "es",
    });
    expect(calls[1].args).toEqual(["token", { termsAccepted: true }]);
  });

  test("the news and offers box turns on the list and her marketing in one go", async () => {
    const { fx, calls, names } = effects();
    await writeBookingConsents({
      user: USER,
      locale: "en",
      details: { ...DETAILS, newsletter: true },
      effects: fx,
    });
    expect(names()).toEqual(["newsletter", "contact", "notice"]);
    expect(calls[0].args).toEqual(["token", "u1", "ana@example.com", true]);
    expect(calls[1].args[1]).toMatchObject({ marketing: true, language: "en" });
  });

  test("without the terms her contact is still written but no notice is recorded", async () => {
    const { fx, names } = effects();
    await writeBookingConsents({
      user: USER,
      locale: "es",
      details: { ...DETAILS, consent: false },
      effects: fx,
    });
    expect(names()).toEqual(["contact"]);
  });

  test("a contact that cannot be saved does not stop the notice step or throw", async () => {
    const { fx, names } = effects({
      saveOwnWhatsAppConsent: () => Promise.reject(new Error("boom")),
    });
    await writeBookingConsents({
      user: USER,
      locale: "es",
      details: DETAILS,
      effects: fx,
    });
    expect(names()).toEqual(["log", "notice"]);
  });
});

describe("writeBookingConsentsWithin: a consent write never holds the booking up", () => {
  /** A timer the test fires by hand, so nothing waits four real seconds. */
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

  const never = () => new Promise<{ ok: boolean }>(() => undefined);

  test("an action that never answers lets the booking go on once the deadline fires", async () => {
    const timer = fakeTimer();
    const { fx, calls } = effects({ recordBookingNoticeConsent: never });
    let done = false;
    const run = writeBookingConsentsWithin({
      user: null,
      locale: "es",
      details: DETAILS,
      effects: fx,
      startTimer: timer.startTimer,
    }).then(() => {
      done = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(done).toBe(false);
    expect(timer.pending).toHaveLength(1);
    expect(timer.pending[0].ms).toBe(CONSENT_DEADLINE_MS);

    timer.fire();
    await run;
    expect(done).toBe(true);
    const logged = calls.filter((c) => c.name === "log");
    expect(logged).toHaveLength(1);
  });

  test("the log of a late write carries no name, address or phone", async () => {
    const timer = fakeTimer();
    const { fx, calls } = effects({ recordBookingNoticeConsent: never });
    const run = writeBookingConsentsWithin({
      user: null,
      locale: "es",
      details: DETAILS,
      effects: fx,
      startTimer: timer.startTimer,
    });
    await Promise.resolve();
    timer.fire();
    await run;
    const text = JSON.stringify(calls.filter((c) => c.name === "log"));
    for (const personal of [
      DETAILS.email,
      DETAILS.phone,
      DETAILS.firstName,
      DETAILS.lastName,
    ]) {
      expect(text).not.toContain(personal);
    }
  });

  test("a signed-in client whose contact write hangs is let through too", async () => {
    const timer = fakeTimer();
    const { fx, names } = effects({ saveOwnWhatsAppConsent: never });
    const run = writeBookingConsentsWithin({
      user: { id: "u1" },
      locale: "es",
      details: DETAILS,
      effects: fx,
      startTimer: timer.startTimer,
    });
    await Promise.resolve();
    await Promise.resolve();
    timer.fire();
    await run;
    // The notice consent never started: it waits for the contact. That is the
    // price of not stamping a row that is not there, and the booking is safe.
    expect(names()).toEqual(["log"]);
    expect(names()).not.toContain("notice");
  });

  test("when the writes finish in time the timer is cancelled and nothing is logged", async () => {
    const timer = fakeTimer();
    const { fx, names } = effects();
    await writeBookingConsentsWithin({
      user: null,
      locale: "es",
      details: DETAILS,
      effects: fx,
      startTimer: timer.startTimer,
    });
    expect(names()).toEqual(["notice"]);
    expect(timer.pending.every((t) => t.cancelled)).toBe(true);
  });

  test("a throwing write is swallowed and the deadline is still cancelled", async () => {
    const timer = fakeTimer();
    const { fx } = effects({
      recordBookingNoticeConsent: () => Promise.reject(new Error("boom")),
    });
    await writeBookingConsentsWithin({
      user: null,
      locale: "es",
      details: DETAILS,
      effects: fx,
      startTimer: timer.startTimer,
    });
    expect(timer.pending.every((t) => t.cancelled)).toBe(true);
  });

  test("the deadline is about four seconds", () => {
    expect(CONSENT_DEADLINE_MS).toBe(4000);
  });
});
