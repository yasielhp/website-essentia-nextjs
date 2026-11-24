import { describe, expect, test } from "bun:test";
import type { Recipient } from "./audience-filter";
import { conflictTarget, dealVariants, recipientRow } from "./recipient-rows";

const emailRecipient: Recipient = {
  id: "contact-1",
  email: "ana@example.com",
  firstName: "Ana",
  language: "en",
  phone: "600 11 22 33",
};

const whatsappRecipient: Recipient = {
  id: "contact-2",
  email: null,
  firstName: "Luis",
  language: "en",
  phone: "+34600112233",
};

describe("conflictTarget", () => {
  test("email rows are unique on the address, WhatsApp rows on the phone", () => {
    expect(conflictTarget("email")).toBe("campaign_id,email,cycle");
    expect(conflictTarget("whatsapp")).toBe("campaign_id,phone,cycle");
  });
});

describe("recipientRow", () => {
  test("an email row is exactly what the dispatch has always written", () => {
    const row = recipientRow({
      campaignId: "c1",
      recipient: emailRecipient,
      channel: "email",
      cycle: "",
      extra: { variant: "a" },
    });
    // JSON keeps key order, which is part of what must not change.
    expect(JSON.stringify(row)).toBe(
      '{"campaign_id":"c1","contact_id":"contact-1","email":"ana@example.com","language":"en","status":"queued","cycle":"","variant":"a"}',
    );
  });

  test("an email row never carries the contact's raw phone", () => {
    const row = recipientRow({
      campaignId: "c1",
      recipient: emailRecipient,
      channel: "email",
      cycle: "",
    });
    expect(row).not.toHaveProperty("phone");
  });

  test("a WhatsApp row has a NULL email, the E.164 phone and the recipient's language", () => {
    const row = recipientRow({
      campaignId: "c1",
      recipient: whatsappRecipient,
      channel: "whatsapp",
      cycle: "2026",
      extra: { vars: { service: "Drenaje" } },
    });
    expect(row).toEqual({
      campaign_id: "c1",
      contact_id: "contact-2",
      email: null,
      phone: "+34600112233",
      // The language the resolver gave her: her own, or the audience's when
      // it fixes one. It picks the template the row goes out with.
      language: "en",
      status: "queued",
      cycle: "2026",
      vars: { service: "Drenaje" },
    });
  });

  test("on both channels the row's language is the recipient's, as the resolver set it", () => {
    for (const channel of ["email", "whatsapp"] as const) {
      for (const language of ["es", "en"] as const) {
        const row = recipientRow({
          campaignId: "c1",
          recipient: { ...whatsappRecipient, language },
          channel,
          cycle: "",
        });
        expect(row.language).toBe(language);
      }
    }
  });

  test("an empty email becomes NULL, never an empty string", () => {
    const row = recipientRow({
      campaignId: "c1",
      recipient: { ...whatsappRecipient, email: "" },
      channel: "whatsapp",
      cycle: "",
    });
    expect(row.email).toBeNull();
  });
});

describe("dealVariants", () => {
  test("alternates a and b within each language, not over the whole list", () => {
    // Languages alternating: dealt over the list, every Spanish contact would
    // get the first subject and every English one the second.
    expect(dealVariants(["es", "en", "es", "en", "es", "en"])).toEqual([
      "a",
      "a",
      "b",
      "b",
      "a",
      "a",
    ]);
  });

  test("each language ends with its two halves the same size, one apart at most", () => {
    const languages = [
      ...Array.from({ length: 7 }, () => "es" as const),
      ...Array.from({ length: 4 }, () => "en" as const),
    ].sort(() => 0.5 - Math.random());
    const variants = dealVariants(languages);
    for (const locale of ["es", "en"] as const) {
      const mine = variants.filter((_, i) => languages[i] === locale);
      const a = mine.filter((v) => v === "a").length;
      expect(Math.abs(a - (mine.length - a))).toBeLessThanOrEqual(1);
    }
  });

  test("one language is the alternation it always was", () => {
    expect(dealVariants(["es", "es", "es"])).toEqual(["a", "b", "a"]);
  });
});
