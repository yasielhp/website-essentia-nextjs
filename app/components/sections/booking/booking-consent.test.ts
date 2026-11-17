import { describe, expect, test } from "bun:test";
import {
  contactConsentArgs,
  writeBookingConsents,
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
