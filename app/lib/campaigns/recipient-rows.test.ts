import { describe, expect, test } from "bun:test";
import type { CampaignAudience } from "@/types/campaign";
import type { Recipient } from "./audience-filter";
import { conflictTarget, recipientRow } from "./recipient-rows";

const audience = (
  overrides: Partial<CampaignAudience> = {},
): Pick<CampaignAudience, "language" | "sendLocale"> => ({
  language: "any",
  sendLocale: "es",
  ...overrides,
});

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
      audience: audience(),
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
      audience: audience(),
      cycle: "",
    });
    expect(row).not.toHaveProperty("phone");
  });

  test("a WhatsApp row has a NULL email, the E.164 phone and the campaign's language", () => {
    const row = recipientRow({
      campaignId: "c1",
      recipient: whatsappRecipient,
      channel: "whatsapp",
      audience: audience({ language: "any", sendLocale: "es" }),
      cycle: "2026",
      extra: { vars: { service: "Drenaje" } },
    });
    expect(row).toEqual({
      campaign_id: "c1",
      contact_id: "contact-2",
      email: null,
      phone: "+34600112233",
      language: "es",
      status: "queued",
      cycle: "2026",
      vars: { service: "Drenaje" },
    });
  });

  test("the campaign's fixed language beats the recipient's own", () => {
    const row = recipientRow({
      campaignId: "c1",
      recipient: whatsappRecipient,
      channel: "whatsapp",
      audience: audience({ language: "en" }),
      cycle: "",
    });
    expect(row.language).toBe("en");
  });

  test("an empty email becomes NULL, never an empty string", () => {
    const row = recipientRow({
      campaignId: "c1",
      recipient: { ...whatsappRecipient, email: "" },
      channel: "whatsapp",
      audience: audience(),
      cycle: "",
    });
    expect(row.email).toBeNull();
  });
});
