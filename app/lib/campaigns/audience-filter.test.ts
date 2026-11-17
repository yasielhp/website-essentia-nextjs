import { describe, expect, it } from "bun:test";
import { EMPTY_AUDIENCE, type CampaignAudience } from "@/types/campaign";
import { filterAudience, type ContactCandidate } from "./audience-filter";

/** 2026-09-05 at noon, so "days ago" arithmetic has a fixed anchor. */
const NOW = new Date("2026-09-05T12:00:00Z");

let seq = 0;
function c(overrides: Partial<ContactCandidate> = {}): ContactCandidate {
  seq += 1;
  return {
    id: `id-${seq}`,
    email: `person${seq}@example.com`,
    firstName: `Person ${seq}`,
    language: "en",
    newsletter: false,
    bouncedAt: null,
    unsubscribedAt: null,
    lastBookingDate: null,
    serviceIds: [],
    bookingsCount: 0,
    ...overrides,
  };
}

function audience(overrides: Partial<CampaignAudience>): CampaignAudience {
  return { ...EMPTY_AUDIENCE, ...overrides };
}

const ids = (list: { id: string }[]) => list.map((r) => r.id);

describe("filterAudience — fixed exclusions", () => {
  it("a chosen send locale overrides the contact's own language", () => {
    const en = c({ language: "en" });
    const result = filterAudience(
      [en],
      audience({ language: "any", sendLocale: "es" }),
      NOW,
    );
    expect(result.map((r) => r.language)).toEqual(["es"]);
  });

  it("hasBooked keeps only contacts with at least one booking", () => {
    const regular = c({ bookingsCount: 2 });
    const lead = c({ id: "2" });
    const result = filterAudience(
      [regular, lead],
      audience({ hasBooked: true }),
      NOW,
    );
    expect(ids(result)).toEqual([regular.id]);
  });

  it("drops a contact who unsubscribed, even when hand-picked", () => {
    const gone = c({ unsubscribedAt: "2026-08-01T10:00:00Z" });
    const result = filterAudience(
      [gone],
      audience({ manualIds: [gone.id] }),
      NOW,
    );
    expect(ids(result)).toEqual([]);
  });

  it("returns everyone sendable for the empty audience", () => {
    const a = c();
    const b = c({ language: "es", newsletter: true, bookingsCount: 3 });
    expect(ids(filterAudience([a, b], EMPTY_AUDIENCE, NOW))).toEqual([
      a.id,
      b.id,
    ]);
  });

  it("drops a bounced contact", () => {
    const ok = c();
    const bounced = c({ bouncedAt: "2026-08-01T10:00:00Z" });
    expect(ids(filterAudience([ok, bounced], EMPTY_AUDIENCE, NOW))).toEqual([
      ok.id,
    ]);
  });

  it("drops an email without an @", () => {
    const ok = c();
    const empty = c({ email: "" });
    const junk = c({ email: "not-an-email" });
    expect(ids(filterAudience([ok, empty, junk], EMPTY_AUDIENCE, NOW))).toEqual(
      [ok.id],
    );
  });

  it("drops a bounced or empty contact even when picked by hand", () => {
    const bounced = c({ bouncedAt: "2026-08-01T10:00:00Z" });
    const empty = c({ email: "" });
    const result = filterAudience(
      [bounced, empty],
      audience({ language: "es", manualIds: [bounced.id, empty.id] }),
      NOW,
    );
    expect(result).toEqual([]);
  });
});

describe("filterAudience — language", () => {
  it("maps es to es and anything else to en", () => {
    const es = c({ language: "es" });
    const en = c({ language: "en" });
    const fr = c({ language: "fr" });
    const none = c({ language: null });
    const result = filterAudience([es, en, fr, none], EMPTY_AUDIENCE, NOW);
    expect(result.map((r) => r.language)).toEqual(["es", "en", "en", "en"]);
  });

  it("keeps only the chosen locale", () => {
    const es = c({ language: "es" });
    const en = c({ language: "en" });
    const fr = c({ language: "fr" });
    expect(
      ids(filterAudience([es, en, fr], audience({ language: "es" }), NOW)),
    ).toEqual([es.id]);
    expect(
      ids(filterAudience([es, en, fr], audience({ language: "en" }), NOW)),
    ).toEqual([en.id, fr.id]);
  });
});

describe("filterAudience — newsletter", () => {
  it("keeps only subscribers when newsletter is true", () => {
    const sub = c({ newsletter: true });
    const not = c({ newsletter: false });
    expect(
      ids(filterAudience([sub, not], audience({ newsletter: true }), NOW)),
    ).toEqual([sub.id]);
  });

  it("keeps everyone when newsletter is null", () => {
    const sub = c({ newsletter: true });
    const not = c({ newsletter: false });
    expect(
      ids(filterAudience([sub, not], audience({ newsletter: null }), NOW)),
    ).toEqual([sub.id, not.id]);
  });
});

describe("filterAudience — services", () => {
  it("keeps a contact with any of the listed services", () => {
    const yoga = c({ serviceIds: ["yoga"] });
    const massage = c({ serviceIds: ["massage", "pilates"] });
    const other = c({ serviceIds: ["pilates"] });
    const none = c();
    expect(
      ids(
        filterAudience(
          [yoga, massage, other, none],
          audience({ services: ["yoga", "massage"] }),
          NOW,
        ),
      ),
    ).toEqual([yoga.id, massage.id]);
  });

  it("applies no service condition when the list is empty", () => {
    const yoga = c({ serviceIds: ["yoga"] });
    const none = c();
    expect(
      ids(filterAudience([yoga, none], audience({ services: [] }), NOW)),
    ).toEqual([yoga.id, none.id]);
  });
});

describe("filterAudience — lastBooking", () => {
  // NOW is 2026-09-05T12:00Z; ages are measured from 00:00Z of the booking day.
  const older = c({ lastBookingDate: "2026-08-01", bookingsCount: 1 }); // ~35.5 d
  const exact = c({ lastBookingDate: "2026-08-06", bookingsCount: 1 }); // 30.5 d
  const newer = c({ lastBookingDate: "2026-09-01", bookingsCount: 1 }); // ~4.5 d
  const never = c();
  const all = [older, exact, newer, never];

  it("gt keeps bookings older than N days", () => {
    expect(
      ids(
        filterAudience(
          all,
          audience({ lastBooking: { op: "gt", days: 30 } }),
          NOW,
        ),
      ),
    ).toEqual([older.id, exact.id]);
  });

  it("lt keeps bookings more recent than N days", () => {
    expect(
      ids(
        filterAudience(
          all,
          audience({ lastBooking: { op: "lt", days: 30 } }),
          NOW,
        ),
      ),
    ).toEqual([newer.id]);
  });

  it("excludes a booking exactly N days old for both ops", () => {
    // Midnight anchor: 2026-08-06T00:00Z is exactly 30 days before this NOW.
    const midnight = new Date("2026-09-05T00:00:00Z");
    const gt = filterAudience(
      [exact],
      audience({ lastBooking: { op: "gt", days: 30 } }),
      midnight,
    );
    const lt = filterAudience(
      [exact],
      audience({ lastBooking: { op: "lt", days: 30 } }),
      midnight,
    );
    expect(gt).toEqual([]);
    expect(lt).toEqual([]);
  });

  it("never matches a contact with no booking", () => {
    expect(
      filterAudience(
        [never],
        audience({ lastBooking: { op: "gt", days: 0 } }),
        NOW,
      ),
    ).toEqual([]);
    expect(
      filterAudience(
        [never],
        audience({ lastBooking: { op: "lt", days: 10_000 } }),
        NOW,
      ),
    ).toEqual([]);
  });
});

describe("filterAudience — neverBooked", () => {
  it("keeps only contacts with zero bookings", () => {
    const never = c();
    const once = c({ bookingsCount: 1, lastBookingDate: "2026-01-01" });
    expect(
      ids(filterAudience([never, once], audience({ neverBooked: true }), NOW)),
    ).toEqual([never.id]);
  });
});

describe("filterAudience — manual picks", () => {
  it("adds a hand-picked contact that fails the conditions", () => {
    const es = c({ language: "es" });
    const en = c({ language: "en" });
    const result = filterAudience(
      [es, en],
      audience({ language: "es", manualIds: [en.id] }),
      NOW,
    );
    expect(ids(result)).toEqual([es.id, en.id]);
    // The campaign only has Spanish copy, so that is what the pick receives.
    expect(result.map((r) => r.language)).toEqual(["es", "es"]);
  });

  it("keeps a hand-picked contact once, in input order", () => {
    const es = c({ language: "es" });
    const result = filterAudience(
      [es],
      audience({ language: "es", manualIds: [es.id] }),
      NOW,
    );
    expect(ids(result)).toEqual([es.id]);
  });

  it("ignores manual ids that match no candidate", () => {
    const es = c({ language: "es" });
    const result = filterAudience(
      [es],
      audience({ manualIds: ["ghost"] }),
      NOW,
    );
    expect(ids(result)).toEqual([es.id]);
  });
});

describe("filterAudience — dedupe and normalisation", () => {
  it("dedupes case-insensitively and lowercases the email, first wins", () => {
    const first = c({ email: " Ana@Example.com " });
    const second = c({ email: "ana@example.com" });
    const result = filterAudience([first, second], EMPTY_AUDIENCE, NOW);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: first.id,
      email: "ana@example.com",
      firstName: first.firstName,
      language: "en",
    });
  });

  it("dedupes across a filter match and a manual pick", () => {
    const match = c({ email: "dup@example.com", language: "es" });
    const manual = c({ email: "DUP@example.com", language: "en" });
    const result = filterAudience(
      [match, manual],
      audience({ language: "es", manualIds: [manual.id] }),
      NOW,
    );
    expect(ids(result)).toEqual([match.id]);
  });

  it("keeps input order", () => {
    const a = c();
    const b = c();
    const d = c();
    expect(ids(filterAudience([d, a, b], EMPTY_AUDIENCE, NOW))).toEqual([
      d.id,
      a.id,
      b.id,
    ]);
  });
});

describe("filterAudience — combined conditions", () => {
  it("ANDs every condition together", () => {
    const hit = c({
      language: "es",
      newsletter: true,
      serviceIds: ["yoga"],
      lastBookingDate: "2026-09-01",
      bookingsCount: 2,
    });
    const wrongLanguage = c({
      ...hit,
      id: "wl",
      email: "wl@x.com",
      language: "en",
    });
    const notSubscribed = c({
      ...hit,
      id: "ns",
      email: "ns@x.com",
      newsletter: false,
    });
    const otherService = c({
      ...hit,
      id: "os",
      email: "os@x.com",
      serviceIds: ["pilates"],
    });
    const tooOld = c({
      ...hit,
      id: "to",
      email: "to@x.com",
      lastBookingDate: "2026-01-01",
    });
    const result = filterAudience(
      [hit, wrongLanguage, notSubscribed, otherService, tooOld],
      audience({
        language: "es",
        newsletter: true,
        services: ["yoga"],
        lastBooking: { op: "lt", days: 30 },
      }),
      NOW,
    );
    expect(ids(result)).toEqual([hit.id]);
  });
});

describe("filterAudience — WhatsApp channel", () => {
  const OPTED = "2026-11-01T00:00:00Z";
  const wa = (overrides: Partial<ContactCandidate> = {}) =>
    c({
      email: "",
      phone: "600112233",
      whatsappMarketingOptedInAt: OPTED,
      ...overrides,
    });
  const run = (
    list: ContactCandidate[],
    aud: CampaignAudience = EMPTY_AUDIENCE,
  ) => filterAudience(list, aud, NOW, "whatsapp");

  it("keeps a consenting contact and normalises the phone to E.164", () => {
    const ok = wa();
    const out = run([ok]);
    expect(ids(out)).toEqual([ok.id]);
    expect(out[0].phone).toBe("+34600112233");
  });

  it("hands the send no email at all, never a made-up one", () => {
    expect(run([wa()])[0].email).toBeNull();
  });

  it("needs no email, which the email channel does", () => {
    const ok = wa();
    expect(ids(run([ok]))).toEqual([ok.id]);
    expect(ids(filterAudience([ok], EMPTY_AUDIENCE, NOW))).toEqual([]);
  });

  it("drops a contact without marketing consent", () => {
    const noConsent = wa({ whatsappMarketingOptedInAt: null });
    const unset = wa({ whatsappMarketingOptedInAt: undefined });
    expect(ids(run([noConsent, unset]))).toEqual([]);
  });

  it("drops a contact who opted out", () => {
    const out = wa({ whatsappOptedOutAt: "2026-11-10T00:00:00Z" });
    expect(ids(run([out]))).toEqual([]);
  });

  it("drops a contact whose number is unreachable", () => {
    const gone = wa({ whatsappUnreachableAt: "2026-11-10T00:00:00Z" });
    expect(ids(run([gone]))).toEqual([]);
  });

  it("drops a contact without a phone or with one the database would refuse", () => {
    const none = wa({ phone: null });
    const short = wa({ phone: "1234567" });
    const text = wa({ phone: "no phone" });
    expect(ids(run([none, short, text]))).toEqual([]);
  });

  it("ignores the email-channel exclusions", () => {
    const ok = wa({
      email: "x@example.com",
      bouncedAt: "2026-08-01T10:00:00Z",
      unsubscribedAt: "2026-08-02T10:00:00Z",
    });
    expect(ids(run([ok]))).toEqual([ok.id]);
  });

  it("leaves the phone as stored on an email recipient", () => {
    const person = c({ phone: "600 11 22 33" });
    expect(filterAudience([person], EMPTY_AUDIENCE, NOW)[0].phone).toBe(
      "600 11 22 33",
    );
  });

  it("keeps the email exclusions for the email channel whatever the WhatsApp fields", () => {
    const gone = c({ whatsappOptedOutAt: "2026-11-10T00:00:00Z" });
    expect(ids(filterAudience([gone], EMPTY_AUDIENCE, NOW))).toEqual([gone.id]);
  });

  it("does not let a first contact the conditions reject block the second", () => {
    const rejected = wa({ language: "en", phone: "600112233" });
    const kept = wa({ language: "es", phone: "600 11 22 33" });
    expect(ids(run([rejected, kept], audience({ language: "es" })))).toEqual([
      kept.id,
    ]);
  });

  it("collapses two contacts sharing a number, however it is written", () => {
    const first = wa({ phone: "600112233" });
    const second = wa({ phone: "600 11 22 33" });
    const third = wa({ phone: "+34600112233" });
    expect(ids(run([first, second, third]))).toEqual([first.id]);
  });

  it("deduplicates a hand-picked contact against one the filter already kept", () => {
    const first = wa({ phone: "600112233" });
    const picked = wa({ phone: "+34 600 11 22 33" });
    expect(
      ids(run([first, picked], audience({ manualIds: [picked.id] }))),
    ).toEqual([first.id]);
  });

  it("never sends to a hand-picked contact without consent", () => {
    const noConsent = wa({ whatsappMarketingOptedInAt: null });
    const optedOut = wa({
      phone: "600112244",
      whatsappOptedOutAt: "2026-11-10T00:00:00Z",
    });
    const unreachable = wa({
      phone: "600112255",
      whatsappUnreachableAt: "2026-11-10T00:00:00Z",
    });
    const noPhone = wa({ phone: null });
    const out = run(
      [noConsent, optedOut, unreachable, noPhone],
      audience({
        manualIds: [noConsent.id, optedOut.id, unreachable.id, noPhone.id],
      }),
    );
    expect(ids(out)).toEqual([]);
  });

  it("still applies the filter conditions and unions the hand-picked", () => {
    const es = wa({ language: "es", phone: "600112244" });
    const en = wa({ language: "en", phone: "600112255" });
    const picked = wa({ language: "en", phone: "600112266" });
    const out = run(
      [es, en, picked],
      audience({ language: "es", manualIds: [picked.id] }),
    );
    expect(ids(out)).toEqual([es.id, picked.id]);
  });
});
