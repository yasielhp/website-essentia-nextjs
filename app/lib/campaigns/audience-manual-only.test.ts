import { describe, expect, it } from "bun:test";
import { EMPTY_AUDIENCE, type CampaignAudience } from "@/types/campaign";
import { filterAudience, type ContactCandidate } from "./audience-filter";

/**
 * A segment that is a hand-made list: only the people picked, whatever the
 * filters say, and every fixed exclusion still applies. A list is a way of
 * choosing, never a way round a consent or an unsubscribe.
 */

const NOW = new Date("2026-11-17T12:00:00Z");

let seq = 0;
function c(over: Partial<ContactCandidate> = {}): ContactCandidate {
  seq += 1;
  return {
    id: `id-${seq}`,
    email: `person${seq}@example.com`,
    firstName: `Person ${seq}`,
    language: "en",
    // Subscribed: every email campaign needs it. A test of the rule says so.
    newsletter: true,
    bouncedAt: null,
    unsubscribedAt: null,
    lastBookingDate: null,
    serviceIds: [],
    bookingsCount: 0,
    phone: `+3460011${String(1000 + seq)}`,
    whatsappMarketingOptedInAt: "2026-11-01T00:00:00Z",
    whatsappOptedInAt: "2026-11-01T00:00:00Z",
    ...over,
  };
}

const manual = (ids: string[], over: Partial<CampaignAudience> = {}) => ({
  ...EMPTY_AUDIENCE,
  manualIds: ids,
  manualOnly: true,
  ...over,
});
const ids = (list: { id: string }[]) => list.map((r) => r.id);

describe("a manual-only audience, by email", () => {
  it("is the people picked, and nobody who merely matches the filters", () => {
    const picked = c();
    const matching = c({ newsletter: true, language: "es" });
    const out = filterAudience(
      [picked, matching],
      manual([picked.id], { language: "es", newsletter: true }),
      NOW,
    );
    expect(ids(out)).toEqual([picked.id]);
  });

  it("includes a person who does not meet the filters, because she was picked", () => {
    // Subscribed (an email needs it whoever picks her), but in English and
    // with no booking, against a Spanish filter of clients.
    const picked = c({ language: "en", bookingsCount: 0 });
    const out = filterAudience(
      [picked],
      manual([picked.id], {
        language: "es",
        newsletter: true,
        hasBooked: true,
      }),
      NOW,
    );
    expect(ids(out)).toEqual([picked.id]);
  });

  it("leaves out one who unsubscribed, one who bounced and one with no address", () => {
    const unsubscribed = c({ unsubscribedAt: "2026-10-01T00:00:00Z" });
    const bounced = c({ bouncedAt: "2026-10-01T00:00:00Z" });
    const noAddress = c({ email: "" });
    const fine = c();
    const out = filterAudience(
      [unsubscribed, bounced, noAddress, fine],
      manual([unsubscribed.id, bounced.id, noAddress.id, fine.id]),
      NOW,
    );
    expect(ids(out)).toEqual([fine.id]);
  });

  it("and one who never subscribed to the newsletter: being picked is not consent", () => {
    const notSubscribed = c({ newsletter: false });
    const fine = c();
    const out = filterAudience(
      [notSubscribed, fine],
      manual([notSubscribed.id, fine.id]),
      NOW,
    );
    expect(ids(out)).toEqual([fine.id]);
  });

  it("ignores an id that is no longer a contact (deleted since)", () => {
    const fine = c();
    const out = filterAudience(
      [fine],
      manual([fine.id, "deleted-contact"]),
      NOW,
    );
    expect(ids(out)).toEqual([fine.id]);
  });

  it("is empty with an empty list, never 'everybody'", () => {
    expect(filterAudience([c(), c()], manual([]), NOW)).toEqual([]);
  });

  it("collapses two contacts that share an address into one", () => {
    const a = c({ email: "same@example.com" });
    const b = c({ email: "SAME@example.com" });
    expect(ids(filterAudience([a, b], manual([a.id, b.id]), NOW))).toEqual([
      a.id,
    ]);
  });
});

describe("a manual-only audience, by WhatsApp", () => {
  const run = (
    candidates: ContactCandidate[],
    audience: CampaignAudience,
    suppressed: string[] = [],
  ) =>
    filterAudience(candidates, audience, NOW, "whatsapp", new Set(suppressed));

  it("leaves out who has no consent for news and offers, who said STOP, who is unreachable, who is on the STOP list", () => {
    const noConsent = c({ whatsappMarketingOptedInAt: null });
    const stopped = c({ whatsappOptedOutAt: "2026-11-10T00:00:00Z" });
    const unreachable = c({ whatsappUnreachableAt: "2026-11-10T00:00:00Z" });
    const noPhone = c({ phone: null });
    const listed = c({ phone: "+34600999111" });
    const fine = c();
    const out = run(
      [noConsent, stopped, unreachable, noPhone, listed, fine],
      manual([
        noConsent.id,
        stopped.id,
        unreachable.id,
        noPhone.id,
        listed.id,
        fine.id,
      ]),
      ["+34600999111"],
    );
    expect(ids(out)).toEqual([fine.id]);
  });

  it("an appointment notice's consent is not the one a list needs: news and offers is", () => {
    const onlyNotices = c({ whatsappMarketingOptedInAt: null });
    expect(ids(run([onlyNotices], manual([onlyNotices.id])))).toEqual([]);
  });

  it("two contacts that share a phone collapse into one", () => {
    const a = c({ phone: "600 11 22 33" });
    const b = c({ phone: "+34 600112233" });
    expect(ids(run([a, b], manual([a.id, b.id])))).toEqual([a.id]);
  });

  it("an appointment notice never takes a list: nobody is added to it by hand", () => {
    const picked = c();
    const out = filterAudience(
      [picked],
      manual([picked.id]),
      NOW,
      "whatsapp",
      new Set(),
      "appointment",
    );
    expect(out).toEqual([]);
  });
});

describe("without manualOnly nothing changes", () => {
  it("hand-picked contacts are still unioned with what the filter finds", () => {
    const es = c({ language: "es" });
    const en = c({ language: "en" });
    const picked = c({ language: "en" });
    const out = filterAudience(
      [es, en, picked],
      { ...EMPTY_AUDIENCE, language: "es", manualIds: [picked.id] },
      NOW,
    );
    expect(ids(out)).toEqual([es.id, picked.id]);
  });

  it("manualOnly: false is the filter as ever", () => {
    const es = c({ language: "es" });
    const en = c({ language: "en" });
    const out = filterAudience(
      [es, en],
      {
        ...EMPTY_AUDIENCE,
        language: "es",
        manualIds: [en.id],
        manualOnly: false,
      },
      NOW,
    );
    expect(ids(out)).toEqual([es.id, en.id]);
  });

  it("an audience with no list at all is everybody, as it was", () => {
    const a = c();
    const b = c();
    expect(ids(filterAudience([a, b], { ...EMPTY_AUDIENCE }, NOW))).toEqual([
      a.id,
      b.id,
    ]);
  });
});
