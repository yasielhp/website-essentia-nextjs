import { describe, expect, test } from "bun:test";
import { fakeDb, type Row } from "@/lib/whatsapp/fake-contacts-db";
import {
  applyMarketingConsent,
  marketingActivationPatch,
  marketingDeactivationPatch,
} from "@/lib/whatsapp/marketing-consent";

const NOW = "2026-11-17T12:00:00.000Z";
const OLD = "2026-01-05T09:00:00.000Z";
const STOP = "2026-06-01T09:00:00.000Z";

const row = (over: Row = {}): Row => ({
  id: "c1",
  email: "ana@example.com",
  newsletter_subscribed: false,
  newsletter_subscribed_at: null,
  newsletter_unsubscribed_at: null,
  whatsapp_opted_in_at: null,
  whatsapp_marketing_opted_in_at: null,
  whatsapp_opted_out_at: null,
  ...over,
});

describe("marketingActivationPatch", () => {
  test("with nothing on, both channels are stamped and the unsubscribe is cleared", () => {
    expect(marketingActivationPatch({}, NOW)).toEqual({
      newsletter_subscribed: true,
      newsletter_subscribed_at: NOW,
      newsletter_unsubscribed_at: null,
      whatsapp_marketing_opted_in_at: NOW,
      whatsapp_opted_out_at: null,
    });
  });

  test("with no STOP an existing WhatsApp date and the other use are left alone", () => {
    const patch = marketingActivationPatch(
      {
        newsletter_subscribed: true,
        newsletter_subscribed_at: OLD,
        whatsapp_marketing_opted_in_at: OLD,
        whatsapp_opted_in_at: OLD,
      },
      NOW,
    );
    expect(patch.whatsapp_marketing_opted_in_at).toBe(OLD);
    expect(patch.newsletter_subscribed_at).toBe(OLD);
    expect("whatsapp_opted_in_at" in patch).toBe(false);
  });

  test("an email unsubscribe is cleared and the subscription is stamped again", () => {
    const patch = marketingActivationPatch(
      {
        newsletter_subscribed: false,
        newsletter_subscribed_at: OLD,
        newsletter_unsubscribed_at: STOP,
      },
      NOW,
    );
    expect(patch.newsletter_unsubscribed_at).toBeNull();
    expect(patch.newsletter_subscribed).toBe(true);
    expect(patch.newsletter_subscribed_at).toBe(NOW);
  });

  test("after a STOP the WhatsApp date is new, the booking-notice consent is withdrawn and the STOP cleared", () => {
    const patch = marketingActivationPatch(
      {
        whatsapp_marketing_opted_in_at: OLD,
        whatsapp_opted_in_at: OLD,
        whatsapp_opted_out_at: STOP,
      },
      NOW,
    );
    expect(patch.whatsapp_marketing_opted_in_at).toBe(NOW);
    expect(patch.whatsapp_opted_in_at).toBeNull();
    expect(patch.whatsapp_opted_out_at).toBeNull();
  });
});

describe("marketingDeactivationPatch", () => {
  test("withdraws both consents and records neither an unsubscribe nor a STOP", () => {
    const patch = marketingDeactivationPatch();
    expect(patch).toEqual({
      newsletter_subscribed: false,
      whatsapp_marketing_opted_in_at: null,
    });
    expect("newsletter_unsubscribed_at" in patch).toBe(false);
    expect("whatsapp_opted_out_at" in patch).toBe(false);
  });
});

describe("applyMarketingConsent", () => {
  test("turning it on with nothing set turns on both channels", async () => {
    const rows = [row()];
    const result = await applyMarketingConsent(
      fakeDb(rows).db,
      "c1",
      true,
      NOW,
    );
    expect(result.ok).toBe(true);
    expect(rows[0]).toMatchObject({
      newsletter_subscribed: true,
      newsletter_subscribed_at: NOW,
      newsletter_unsubscribed_at: null,
      whatsapp_marketing_opted_in_at: NOW,
    });
    if (result.ok) expect(result.contact.email).toBe("ana@example.com");
  });

  test("a contact with only one channel gets the other completed", async () => {
    const onlyEmail = [
      row({ newsletter_subscribed: true, newsletter_subscribed_at: OLD }),
    ];
    await applyMarketingConsent(fakeDb(onlyEmail).db, "c1", true, NOW);
    expect(onlyEmail[0].whatsapp_marketing_opted_in_at).toBe(NOW);
    expect(onlyEmail[0].newsletter_subscribed_at).toBe(OLD);

    const onlyWhatsapp = [row({ whatsapp_marketing_opted_in_at: OLD })];
    await applyMarketingConsent(fakeDb(onlyWhatsapp).db, "c1", true, NOW);
    expect(onlyWhatsapp[0].newsletter_subscribed).toBe(true);
    expect(onlyWhatsapp[0].whatsapp_marketing_opted_in_at).toBe(OLD);
  });

  test("turning it on clears the contact's own email unsubscribe", async () => {
    const rows = [
      row({ newsletter_unsubscribed_at: STOP, newsletter_subscribed_at: OLD }),
    ];
    await applyMarketingConsent(fakeDb(rows).db, "c1", true, NOW);
    expect(rows[0].newsletter_unsubscribed_at).toBeNull();
    expect(rows[0].newsletter_subscribed).toBe(true);
  });

  test("after a STOP: new WhatsApp date, STOP cleared, notices consent withdrawn", async () => {
    const rows = [
      row({
        newsletter_subscribed: true,
        whatsapp_opted_in_at: OLD,
        whatsapp_marketing_opted_in_at: OLD,
        whatsapp_opted_out_at: STOP,
      }),
    ];
    await applyMarketingConsent(fakeDb(rows).db, "c1", true, NOW);
    expect(rows[0]).toMatchObject({
      whatsapp_marketing_opted_in_at: NOW,
      whatsapp_opted_in_at: null,
      whatsapp_opted_out_at: null,
    });
  });

  test("turning it off withdraws both and stamps neither an unsubscribe nor a STOP", async () => {
    const rows = [
      row({
        newsletter_subscribed: true,
        newsletter_subscribed_at: OLD,
        whatsapp_opted_in_at: OLD,
        whatsapp_marketing_opted_in_at: OLD,
      }),
    ];
    const result = await applyMarketingConsent(
      fakeDb(rows).db,
      "c1",
      false,
      NOW,
    );
    expect(result.ok).toBe(true);
    expect(rows[0]).toMatchObject({
      newsletter_subscribed: false,
      whatsapp_marketing_opted_in_at: null,
      newsletter_unsubscribed_at: null,
      whatsapp_opted_out_at: null,
      whatsapp_opted_in_at: OLD,
    });
  });

  test("an unknown contact is notFound and a failing database is quiet ok:false", async () => {
    expect(
      await applyMarketingConsent(fakeDb([row()]).db, "nope", true, NOW),
    ).toEqual({ ok: false, error: "notFound" });
    for (const failOn of ["read", "write"] as const) {
      const result = await applyMarketingConsent(
        fakeDb([row()], { failOn }).db,
        "c1",
        true,
        NOW,
      );
      expect(result).toEqual({ ok: false, error: "db" });
      expect(JSON.stringify(result)).not.toContain("boom");
    }
  });
});
