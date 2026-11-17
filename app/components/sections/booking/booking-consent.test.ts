import { describe, expect, test } from "bun:test";
import {
  contactConsentArgs,
  sendBookingConsents,
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
  const fx: ConsentEffects = {
    getAccessToken: () => "token",
    saveBookingConsents: (...args) => {
      calls.push({ name: "consents", args });
      return Promise.resolve({ ok: true, stamped: true });
    },
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

describe("sendBookingConsents: every consent write of the step is one action", () => {
  const INPUT = {
    email: "ana@example.com",
    firstName: "Ana",
    lastName: "G",
    phone: "600000000",
    language: "es",
    marketing: false,
    termsAccepted: true,
  };

  test("a guest sends one action, with no token and the address of the step", async () => {
    const { fx, calls, names } = effects();
    await sendBookingConsents({
      user: null,
      locale: "es",
      details: DETAILS,
      effects: fx,
    });
    expect(names()).toEqual(["consents"]);
    expect(calls[0].args).toEqual([null, INPUT]);
  });

  test("a guest who did not accept the terms sends nothing", async () => {
    const { fx, names } = effects();
    await sendBookingConsents({
      user: null,
      locale: "es",
      details: { ...DETAILS, consent: false },
      effects: fx,
    });
    expect(names()).toEqual([]);
  });

  test("a signed-in client sends one action too, with her token", async () => {
    const { fx, calls, names } = effects();
    await sendBookingConsents({
      user: { id: "u1" },
      locale: "en",
      details: { ...DETAILS, newsletter: true },
      effects: fx,
    });
    expect(names()).toEqual(["consents"]);
    expect(calls[0].args).toEqual([
      "token",
      { ...INPUT, language: "en", marketing: true },
    ]);
  });

  test("without the terms a signed-in client's contact is still sent, with the terms as not accepted", async () => {
    const { fx, calls, names } = effects();
    await sendBookingConsents({
      user: { id: "u1" },
      locale: "es",
      details: { ...DETAILS, consent: false },
      effects: fx,
    });
    expect(names()).toEqual(["consents"]);
    expect(calls[0].args[1]).toMatchObject({ termsAccepted: false });
  });

  test("an action that answers 'not done', or throws, is logged and never thrown", async () => {
    for (const saveBookingConsents of [
      () =>
        Promise.resolve({
          ok: false,
          stamped: false,
          error: "timeout" as const,
        }),
      () => Promise.reject(new Error("raw database text")),
    ]) {
      const { fx, names } = effects({ saveBookingConsents });
      await sendBookingConsents({
        user: null,
        locale: "es",
        details: DETAILS,
        effects: fx,
      });
      expect(names()).toEqual(["log"]);
    }
  });

  test("the log carries no name, address or phone, nor the raw error", async () => {
    for (const saveBookingConsents of [
      () =>
        Promise.resolve({ ok: false, stamped: false, error: "db" as const }),
      () => Promise.reject(new Error(`boom ${DETAILS.email} ${DETAILS.phone}`)),
    ]) {
      const { fx, calls } = effects({ saveBookingConsents });
      await sendBookingConsents({
        user: { id: "u1" },
        locale: "es",
        details: DETAILS,
        effects: fx,
      });
      const text = JSON.stringify(calls.filter((c) => c.name === "log"));
      for (const personal of [
        DETAILS.email,
        DETAILS.phone,
        DETAILS.firstName,
        "boom",
      ]) {
        expect(text).not.toContain(personal);
      }
    }
  });
});
