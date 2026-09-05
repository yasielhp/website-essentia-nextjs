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
    expect(result).toEqual([
      {
        id: first.id,
        email: "ana@example.com",
        firstName: first.firstName,
        language: "en",
      },
    ]);
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
