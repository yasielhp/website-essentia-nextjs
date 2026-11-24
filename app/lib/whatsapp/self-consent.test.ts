import { describe, expect, test } from "bun:test";
import { fakeDb, type Row } from "@/lib/whatsapp/fake-contacts-db";
import {
  readOwnMarketing,
  recordOwnWhatsAppConsent,
  stampBookingNoticeConsent,
} from "@/lib/whatsapp/self-consent";

const NOW = new Date("2026-11-17T12:00:00.000Z");
const ago = (minutes: number) =>
  new Date(NOW.getTime() - minutes * 60_000).toISOString();
const base = (over: Row = {}): Row => ({
  id: "c1",
  email: "ana@example.com",
  phone: "+34600000000",
  created_at: ago(600),
  updated_at: ago(1),
  whatsapp_opted_in_at: null,
  whatsapp_opted_out_at: null,
  ...over,
});
/** The phone typed in the form: the contact's number, written another way. */
const TYPED = "600 000 000";

describe("stampBookingNoticeConsent", () => {
  test("stamps a contact the details step has just written", async () => {
    const rows = [base()];
    const { db } = fakeDb(rows);
    const result = await stampBookingNoticeConsent(
      db,
      "ana@example.com",
      TYPED,
      NOW,
    );
    expect(result).toEqual({ ok: true, stamped: true });
    expect(rows[0].whatsapp_opted_in_at).toBe(NOW.toISOString());
  });

  test("does not stamp a contact last written long ago", async () => {
    const rows = [base({ updated_at: ago(16), created_at: ago(900) })];
    const { db } = fakeDb(rows);
    const result = await stampBookingNoticeConsent(
      db,
      "ana@example.com",
      TYPED,
      NOW,
    );
    expect(result).toEqual({ ok: true, stamped: false });
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
  });

  test("never touches a contact who sent a STOP", async () => {
    const rows = [base({ whatsapp_opted_out_at: ago(5000) })];
    const { db } = fakeDb(rows);
    const result = await stampBookingNoticeConsent(
      db,
      "ana@example.com",
      TYPED,
      NOW,
    );
    expect(result).toEqual({ ok: true, stamped: false });
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
    expect(rows[0].whatsapp_opted_out_at).toBe(ago(5000));
  });

  test("a STOP that lands between the read and the write still wins", async () => {
    const rows = [base()];
    const { db } = fakeDb(rows, {
      beforeWrite: (all) => {
        all[0].whatsapp_opted_out_at = ago(0);
      },
    });
    const result = await stampBookingNoticeConsent(
      db,
      "ana@example.com",
      TYPED,
      NOW,
    );
    expect(result).toEqual({ ok: true, stamped: false });
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
  });

  test("keeps the date of a consent already given", async () => {
    const rows = [base({ whatsapp_opted_in_at: ago(100000) })];
    const { db } = fakeDb(rows);
    const result = await stampBookingNoticeConsent(
      db,
      "ana@example.com",
      TYPED,
      NOW,
    );
    expect(result).toEqual({ ok: true, stamped: false });
    expect(rows[0].whatsapp_opted_in_at).toBe(ago(100000));
  });

  test("a contact with no consent yet and no STOP is the case that stamps", async () => {
    const rows = [base({ created_at: ago(2), updated_at: ago(2) })];
    const { db } = fakeDb(rows);
    expect(
      (await stampBookingNoticeConsent(db, "ana@example.com", TYPED, NOW)).ok,
    ).toBe(true);
    expect(rows[0].whatsapp_opted_in_at).toBe(NOW.toISOString());
  });

  test("no contact for that address is not an error and writes nothing", async () => {
    const rows = [base()];
    const { db } = fakeDb(rows);
    const result = await stampBookingNoticeConsent(
      db,
      "other@example.com",
      TYPED,
      NOW,
    );
    expect(result).toEqual({ ok: true, stamped: false });
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
  });

  test("a phone that is not the contact's stamps nothing: a stranger cannot consent for somebody's number", async () => {
    for (const typed of ["611 222 333", "+44 7700 900123"]) {
      const rows = [base()];
      const result = await stampBookingNoticeConsent(
        fakeDb(rows).db,
        "ana@example.com",
        typed,
        NOW,
      );
      expect(result).toEqual({ ok: true, stamped: false });
      expect(rows[0].whatsapp_opted_in_at).toBeNull();
    }
  });

  test("no phone, or one that is not a number, stamps nothing and reads nothing", async () => {
    for (const typed of [null, "", "12"]) {
      const rows = [base()];
      const result = await stampBookingNoticeConsent(
        fakeDb(rows, { failOn: "read" }).db,
        "ana@example.com",
        typed,
        NOW,
      );
      expect(result).toEqual({ ok: true, stamped: false });
      expect(rows[0].whatsapp_opted_in_at).toBeNull();
    }
  });

  test("a contact with no number of its own gets no consent from a typed one", async () => {
    const rows = [base({ phone: null })];
    const result = await stampBookingNoticeConsent(
      fakeDb(rows).db,
      "ana@example.com",
      TYPED,
      NOW,
    );
    expect(result).toEqual({ ok: true, stamped: false });
  });

  test("a failing database answers ok:false with no raw text", async () => {
    for (const failOn of ["read", "write"] as const) {
      const { db } = fakeDb([base()], { failOn });
      const result = await stampBookingNoticeConsent(
        db,
        "ana@example.com",
        TYPED,
        NOW,
      );
      expect(result).toEqual({ ok: false, error: "db" });
      expect(JSON.stringify(result)).not.toContain("boom");
    }
  });
});

describe("recordOwnWhatsAppConsent: the public way, with her own session", () => {
  const input = {
    firstName: "Ana",
    lastName: "G",
    phone: "600000000",
    language: "es" as const,
  };
  const existing = (over: Row = {}): Row => ({
    id: "c1",
    email: "ana@example.com",
    first_name: "Ana María",
    last_name: "García",
    phone: "+34611222333",
    preferred_language: "en",
    newsletter_subscribed: false,
    newsletter_unsubscribed_at: null,
    whatsapp_marketing_opted_in_at: null,
    whatsapp_opted_out_at: null,
    updated_at: ago(900),
    ...over,
  });

  test("a contact she does not have yet is created with what she typed, and the box she ticked", async () => {
    const rows: Row[] = [];
    const { db, calls } = fakeDb(rows);
    expect(
      await recordOwnWhatsAppConsent(db, "ana@example.com", {
        ...input,
        marketing: true,
      }),
    ).toEqual({ ok: true });
    expect(calls.rpc).toEqual([]);
    expect(rows[0]).toMatchObject({
      email: "ana@example.com",
      first_name: "Ana",
      last_name: "G",
      phone: "600000000",
      preferred_language: "es",
      newsletter_subscribed: true,
    });
    expect(rows[0].whatsapp_marketing_opted_in_at).not.toBeNull();
    // Never the booking-notice consent: that is the stamp's, with its guards.
    expect(rows[0]).not.toHaveProperty("whatsapp_opted_in_at");
  });

  test("the contact she has keeps its name, phone and language, and only gains the yes she gives", async () => {
    const rows = [existing()];
    const { db } = fakeDb(rows);
    await recordOwnWhatsAppConsent(db, "ana@example.com", {
      ...input,
      marketing: true,
    });
    expect(rows[0]).toMatchObject({
      first_name: "Ana María",
      last_name: "García",
      phone: "+34611222333",
      preferred_language: "en",
      newsletter_subscribed: true,
    });
    expect(rows[0].whatsapp_marketing_opted_in_at).not.toBeNull();
    // Touched, so the notice consent that follows finds it fresh.
    expect(rows[0].updated_at).not.toBe(ago(900));
  });

  test("unticked touches no consent and still changes nothing else", async () => {
    const rows = [existing()];
    const { db } = fakeDb(rows);
    await recordOwnWhatsAppConsent(db, "ana@example.com", {
      ...input,
      marketing: false,
    });
    expect(rows[0]).toMatchObject({
      phone: "+34611222333",
      newsletter_subscribed: false,
      whatsapp_marketing_opted_in_at: null,
    });
  });

  test("a STOP or an unsubscribe of hers stays: the box does not take back a no", async () => {
    const rows = [
      existing({
        whatsapp_opted_out_at: ago(3000),
        newsletter_unsubscribed_at: ago(3000),
      }),
    ];
    const { db } = fakeDb(rows);
    await recordOwnWhatsAppConsent(db, "ana@example.com", {
      ...input,
      marketing: true,
    });
    expect(rows[0]).toMatchObject({
      whatsapp_opted_out_at: ago(3000),
      newsletter_unsubscribed_at: ago(3000),
      newsletter_subscribed: false,
      whatsapp_marketing_opted_in_at: null,
    });
  });

  test("a database that does not answer is ok:false", async () => {
    const { db } = fakeDb([], { failOn: "read" });
    expect(
      await recordOwnWhatsAppConsent(db, "ana@example.com", {
        ...input,
        marketing: true,
      }),
    ).toEqual({ ok: false, error: "db" });
  });
});

describe("readOwnMarketing", () => {
  const on = {
    id: "c1",
    email: "ana@example.com",
    newsletter_subscribed: true,
    newsletter_unsubscribed_at: null,
    whatsapp_marketing_opted_in_at: ago(10),
    whatsapp_opted_out_at: null,
  };

  test("is on only when both channels are", async () => {
    expect(await readOwnMarketing(fakeDb([on]).db, "ana@example.com")).toBe(
      true,
    );
    expect(
      await readOwnMarketing(
        fakeDb([{ ...on, newsletter_subscribed: false }]).db,
        "ana@example.com",
      ),
    ).toBe(false);
    expect(
      await readOwnMarketing(
        fakeDb([{ ...on, whatsapp_marketing_opted_in_at: null }]).db,
        "ana@example.com",
      ),
    ).toBe(false);
  });

  test("no row, another address or a failing read is not on", async () => {
    expect(await readOwnMarketing(fakeDb([on]).db, "other@example.com")).toBe(
      false,
    );
    expect(
      await readOwnMarketing(
        fakeDb([on], { failOn: "read" }).db,
        "ana@example.com",
      ),
    ).toBe(false);
  });
});

describe("the booking after a STOP: the form takes back no no", () => {
  /**
   * A client who sent BAJA and books again, in the order the form does it:
   * 1. her contact, the public way (`recordOwnWhatsAppConsent` for her own
   *    session, `savePublicContact` for a guest: the same `writeContact`);
   * 2. `saveBookingConsents`, which stamps the notices on a contact with the
   *    same phone, no consent and no STOP.
   *
   * Until 2026-11-24 a ticked "news and offers" lifted the STOP here and the
   * notices came back with it. The owner decided otherwise: an address is not
   * proof of who types it, so no form lifts a STOP or an unsubscribe, ticked
   * or not. Coming back is a reply to WhatsApp or the centre's switch on her
   * card. Write it down if it ever changes.
   */
  const stopped = (): Row => ({
    id: "c1",
    email: "ana@example.com",
    phone: "+34600000000",
    created_at: ago(900),
    updated_at: ago(900),
    newsletter_subscribed: true,
    newsletter_unsubscribed_at: null,
    whatsapp_opted_in_at: ago(5000),
    whatsapp_marketing_opted_in_at: ago(5000),
    whatsapp_opted_out_at: ago(3000),
  });
  const input = {
    firstName: "Ana",
    lastName: "G",
    phone: TYPED,
    language: "es" as const,
  };

  test.each([true, false])(
    "with news and offers %s, the STOP stands and the notices are not stamped",
    async (marketing) => {
      const rows = [stopped()];
      const { db } = fakeDb(rows);
      await recordOwnWhatsAppConsent(db, "ana@example.com", {
        ...input,
        marketing,
      });
      const result = await stampBookingNoticeConsent(
        db,
        "ana@example.com",
        TYPED,
        // The contact was just written with the real clock.
        new Date(),
      );
      expect(result).toEqual({ ok: true, stamped: false });
      expect(rows[0]).toMatchObject({
        whatsapp_opted_out_at: ago(3000),
        whatsapp_opted_in_at: ago(5000),
        whatsapp_marketing_opted_in_at: ago(5000),
      });
    },
  );

  test("a client with no STOP and the same phone gets the notices, as before", async () => {
    const rows = [
      { ...stopped(), whatsapp_opted_out_at: null, whatsapp_opted_in_at: null },
    ];
    const { db } = fakeDb(rows);
    await recordOwnWhatsAppConsent(db, "ana@example.com", {
      ...input,
      marketing: false,
    });
    expect(
      await stampBookingNoticeConsent(db, "ana@example.com", TYPED, new Date()),
    ).toEqual({ ok: true, stamped: true });
  });
});
