import { describe, expect, test } from "bun:test";
import { whatsappActivationPatch } from "@/lib/whatsapp/consent";
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
  created_at: ago(600),
  updated_at: ago(1),
  whatsapp_opted_in_at: null,
  whatsapp_opted_out_at: null,
  ...over,
});

describe("stampBookingNoticeConsent", () => {
  test("stamps a contact the details step has just written", async () => {
    const rows = [base()];
    const { db } = fakeDb(rows);
    const result = await stampBookingNoticeConsent(db, "ana@example.com", NOW);
    expect(result).toEqual({ ok: true, stamped: true });
    expect(rows[0].whatsapp_opted_in_at).toBe(NOW.toISOString());
  });

  test("does not stamp a contact last written long ago", async () => {
    const rows = [base({ updated_at: ago(16), created_at: ago(900) })];
    const { db } = fakeDb(rows);
    const result = await stampBookingNoticeConsent(db, "ana@example.com", NOW);
    expect(result).toEqual({ ok: true, stamped: false });
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
  });

  test("never touches a contact who sent a STOP", async () => {
    const rows = [base({ whatsapp_opted_out_at: ago(5000) })];
    const { db } = fakeDb(rows);
    const result = await stampBookingNoticeConsent(db, "ana@example.com", NOW);
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
    const result = await stampBookingNoticeConsent(db, "ana@example.com", NOW);
    expect(result).toEqual({ ok: true, stamped: false });
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
  });

  test("keeps the date of a consent already given", async () => {
    const rows = [base({ whatsapp_opted_in_at: ago(100000) })];
    const { db } = fakeDb(rows);
    const result = await stampBookingNoticeConsent(db, "ana@example.com", NOW);
    expect(result).toEqual({ ok: true, stamped: false });
    expect(rows[0].whatsapp_opted_in_at).toBe(ago(100000));
  });

  test("a contact with no consent yet and no STOP is the case that stamps", async () => {
    const rows = [base({ created_at: ago(2), updated_at: ago(2) })];
    const { db } = fakeDb(rows);
    expect(
      (await stampBookingNoticeConsent(db, "ana@example.com", NOW)).ok,
    ).toBe(true);
    expect(rows[0].whatsapp_opted_in_at).toBe(NOW.toISOString());
  });

  test("no contact for that address is not an error and writes nothing", async () => {
    const rows = [base()];
    const { db } = fakeDb(rows);
    const result = await stampBookingNoticeConsent(
      db,
      "other@example.com",
      NOW,
    );
    expect(result).toEqual({ ok: true, stamped: false });
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
  });

  test("a failing database answers ok:false with no raw text", async () => {
    for (const failOn of ["read", "write"] as const) {
      const { db } = fakeDb([base()], { failOn });
      const result = await stampBookingNoticeConsent(
        db,
        "ana@example.com",
        NOW,
      );
      expect(result).toEqual({ ok: false, error: "db" });
      expect(JSON.stringify(result)).not.toContain("boom");
    }
  });
});

describe("recordOwnWhatsAppConsent", () => {
  const input = {
    firstName: "Ana",
    lastName: "G",
    phone: "600000000",
    language: "es" as const,
  };

  test("a ticked box turns on the newsletter and WhatsApp marketing together", async () => {
    const { db, calls } = fakeDb([]);
    await recordOwnWhatsAppConsent(db, "ana@example.com", {
      ...input,
      marketing: true,
    });
    expect(calls.rpc[0].args).toMatchObject({
      p_email: "ana@example.com",
      p_newsletter: true,
      p_whatsapp: null,
      p_whatsapp_marketing: true,
    });
  });

  test("an unticked box still writes the contact but touches no consent", async () => {
    const { db, calls } = fakeDb([]);
    await recordOwnWhatsAppConsent(db, "ana@example.com", {
      ...input,
      marketing: false,
    });
    expect(calls.rpc).toHaveLength(1);
    expect(calls.rpc[0].args).toMatchObject({
      p_newsletter: null,
      p_whatsapp: null,
      p_whatsapp_marketing: null,
    });
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

describe("the booking after a STOP: the order is intentional", () => {
  /**
   * A client who sent BAJA and books again, in the order the form does it:
   * 1. `upsert_contact` from the browser. With "news and offers" ticked it
   *    clears the STOP and, because a STOP is global, withdraws the OTHER use
   *    (the booking notices). `whatsappActivationPatch("marketing")` is that
   *    rule in TypeScript, kept in step with the SQL.
   * 2. `recordBookingNoticeConsent`, which stamps the notices on a contact
   *    with no consent and no STOP.
   *
   * So ticking news and offers is an explicit new yes: she gets her booking
   * notices back along with it. Without the tick the STOP stays and nothing is
   * stamped, so booking again alone never reactivates a BAJA. This is
   * deliberate, not a leak: write it down if it ever changes.
   */
  const stopped = (): Row => ({
    id: "c1",
    email: "ana@example.com",
    created_at: ago(900),
    updated_at: ago(900),
    newsletter_subscribed: true,
    whatsapp_opted_in_at: ago(5000),
    whatsapp_marketing_opted_in_at: ago(5000),
    whatsapp_opted_out_at: ago(3000),
  });

  test("with news and offers ticked she gets the booking notices back, as a fresh consent", async () => {
    const rows = [stopped()];
    // 1. upsert_contact(p_newsletter, p_whatsapp_marketing) as the form sends it
    Object.assign(
      rows[0],
      whatsappActivationPatch("marketing", rows[0], NOW.toISOString()),
      {
        updated_at: NOW.toISOString(),
      },
    );
    expect(rows[0].whatsapp_opted_out_at).toBeNull();
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
    expect(rows[0].whatsapp_marketing_opted_in_at).toBe(NOW.toISOString());
    // 2. the notice consent after the Terms
    const result = await stampBookingNoticeConsent(
      fakeDb(rows).db,
      "ana@example.com",
      NOW,
    );
    expect(result).toEqual({ ok: true, stamped: true });
    expect(rows[0].whatsapp_opted_in_at).toBe(NOW.toISOString());
    expect(rows[0].whatsapp_opted_out_at).toBeNull();
  });

  test("without the tick the STOP stands and the notices are not stamped", async () => {
    const rows = [stopped()];
    Object.assign(rows[0], { updated_at: NOW.toISOString() }); // upsert with all nulls
    const result = await stampBookingNoticeConsent(
      fakeDb(rows).db,
      "ana@example.com",
      NOW,
    );
    expect(result).toEqual({ ok: true, stamped: false });
    expect(rows[0].whatsapp_opted_out_at).toBe(ago(3000));
    expect(rows[0].whatsapp_opted_in_at).toBe(ago(5000));
  });
});
