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
  it("with both languages, each contact is written to in her own", () => {
    const en = c({ language: "en" });
    const es = c({ id: "2", email: "es@example.com", language: "es" });
    const result = filterAudience([en, es], audience({ language: "any" }), NOW);
    expect(result.map((r) => r.language)).toEqual(["en", "es"]);
  });

  it("the send language an older campaign chose no longer overrides the contact's", () => {
    const en = c({ language: "en" });
    const result = filterAudience(
      [en],
      audience({ language: "any", sendLocale: "es" }),
      NOW,
    );
    expect(result.map((r) => r.language)).toEqual(["en"]);
  });

  it("a contact with no language reads as English, as the language filter reads her", () => {
    const unknown = c({ language: null });
    expect(
      filterAudience([unknown], audience({ language: "any" }), NOW).map(
        (r) => r.language,
      ),
    ).toEqual(["en"]);
    // The same contact is in an English segment and not in a Spanish one.
    expect(
      ids(filterAudience([unknown], audience({ language: "en" }), NOW)),
    ).toEqual([unknown.id]);
    expect(
      filterAudience([unknown], audience({ language: "es" }), NOW),
    ).toEqual([]);
  });

  it("a contact added by hand to a Spanish audience gets the Spanish version: there is no other", () => {
    const en = c({ language: "en" });
    const result = filterAudience(
      [en],
      audience({ language: "es", manualIds: [en.id] }),
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

  it("keeps the contact's own language on the email channel", () => {
    const en = c({ language: "en" });
    const es = c({ language: "es" });
    expect(
      filterAudience([en, es], EMPTY_AUDIENCE, NOW).map((r) => r.language),
    ).toEqual(["en", "es"]);
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

  it("on WhatsApp too each contact is written to in her own language, with that language's template", () => {
    const en = wa({ language: "en" });
    const es = wa({ language: "es", phone: "600112244" });
    expect(run([en, es]).map((r) => r.language)).toEqual(["en", "es"]);
    // The send language an older campaign chose decides nothing.
    expect(
      run([es], audience({ sendLocale: "en" })).map((r) => r.language),
    ).toEqual(["es"]);
    // An audience that fixes a language writes to everybody in it.
    expect(
      run([en], audience({ language: "es", manualIds: [en.id] })).map(
        (r) => r.language,
      ),
    ).toEqual(["es"]);
  });

  it("an appointment notice counts its clients by their own language too", () => {
    const en = wa({
      language: "en",
      whatsappOptedInAt: "2026-10-01T00:00:00Z",
    });
    const es = wa({
      language: "es",
      phone: "600112244",
      whatsappOptedInAt: "2026-10-01T00:00:00Z",
    });
    const out = filterAudience(
      [en, es],
      EMPTY_AUDIENCE,
      NOW,
      "whatsapp",
      new Set(),
      "appointment",
    );
    expect(out.map((r) => r.language)).toEqual(["en", "es"]);
  });

  it("leaves out a number that wrote STOP, whatever the contact's consent and however the phone is written", () => {
    const quiet = wa({ phone: "600 11 22 33" });
    const fine = wa({ phone: "611222333" });
    const out = filterAudience(
      [quiet, fine],
      EMPTY_AUDIENCE,
      NOW,
      "whatsapp",
      new Set(["+34600112233"]),
    );
    expect(ids(out)).toEqual([fine.id]);
  });

  it("and a hand-picked contact on that number too", () => {
    const quiet = wa({ phone: "34600112233" });
    const out = filterAudience(
      [quiet],
      audience({ manualIds: [quiet.id] }),
      NOW,
      "whatsapp",
      new Set(["+34600112233"]),
    );
    expect(ids(out)).toEqual([]);
  });

  it("the STOP list is a WhatsApp matter: email ignores it", () => {
    const person = c({ phone: "600112233" });
    expect(
      ids(
        filterAudience(
          [person],
          EMPTY_AUDIENCE,
          NOW,
          "email",
          new Set(["+34600112233"]),
        ),
      ),
    ).toEqual([person.id]);
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

describe("filterAudience — what 'subscribed' means per channel", () => {
  const both = (overrides: Partial<ContactCandidate> = {}) =>
    c({
      phone: "600112233",
      newsletter: true,
      subscribedAt: "2026-08-01T10:00:00.000+00:00",
      whatsappMarketingOptedInAt: "2026-11-10T09:30:00.000+00:00",
      ...overrides,
    });

  it("on WhatsApp it is the day the contact agreed to receive news there", () => {
    const [r] = filterAudience([both()], EMPTY_AUDIENCE, NOW, "whatsapp");
    expect(r.subscribedAt).toBe("2026-11-10T09:30:00.000Z");
    expect(r.subscriptionCycle).toBe("2026-11-10T09:30:00.000Z");
  });

  it("on email nothing changed: the newsletter date, and no cycle of its own", () => {
    const [r] = filterAudience([both()], EMPTY_AUDIENCE, NOW);
    expect(r.subscribedAt).toBe("2026-08-01T10:00:00.000+00:00");
    expect(r.subscriptionCycle).toBeUndefined();
  });

  it("a WhatsApp contact who never joined the newsletter still has the date", () => {
    const only = both({ subscribedAt: null, newsletter: false });
    const [r] = filterAudience([only], EMPTY_AUDIENCE, NOW, "whatsapp");
    expect(r.subscribedAt).toBe("2026-11-10T09:30:00.000Z");
  });

  it("an unreadable consent date is no date, not a crash", () => {
    const bad = both({ whatsappMarketingOptedInAt: "not a date" });
    const out = filterAudience([bad], EMPTY_AUDIENCE, NOW, "whatsapp");
    expect(out[0].subscribedAt).toBeNull();
    expect(out[0].subscriptionCycle).toBeUndefined();
  });
});

describe("filterAudience — the consent a campaign needs depends on what it is for", () => {
  const OPTED = "2026-11-01T00:00:00Z";
  const NOTICES = { whatsappOptedInAt: OPTED };
  const NEWS = { whatsappMarketingOptedInAt: OPTED };
  const person = (over: Partial<ContactCandidate> = {}) =>
    c({ email: "", phone: "600112233", ...over });
  const run = (
    list: ContactCandidate[],
    purpose: "marketing" | "appointment" | undefined,
    aud: CampaignAudience = EMPTY_AUDIENCE,
  ) => filterAudience(list, aud, NOW, "whatsapp", new Set(), purpose);

  it("a notice about her appointment needs the consent to appointment notices", () => {
    const onlyNotices = person(NOTICES);
    expect(ids(run([onlyNotices], "appointment"))).toEqual([onlyNotices.id]);
  });

  it("and not the consent to news and offers, which says nothing about it", () => {
    expect(ids(run([person(NEWS)], "appointment"))).toEqual([]);
  });

  it("a campaign of news needs the consent to news, and the notices' does not stand in", () => {
    const onlyNews = person(NEWS);
    expect(ids(run([onlyNews], "marketing"))).toEqual([onlyNews.id]);
    expect(ids(run([person(NOTICES)], "marketing"))).toEqual([]);
  });

  it("marketing is what a campaign is when nothing says otherwise", () => {
    expect(ids(run([person(NOTICES)], undefined))).toEqual([]);
    const onlyNews = person(NEWS);
    expect(ids(run([onlyNews], undefined))).toEqual([onlyNews.id]);
  });

  it("the rest is the same for both: an opt-out, an unreachable number, no valid phone, the STOP list", () => {
    for (const purpose of ["marketing", "appointment"] as const) {
      const consent = purpose === "marketing" ? NEWS : NOTICES;
      const blocked = [
        person({ ...consent, whatsappOptedOutAt: "2026-11-10T00:00:00Z" }),
        person({ ...consent, whatsappUnreachableAt: "2026-11-10T00:00:00Z" }),
        person({ ...consent, phone: null }),
        person({ ...consent, phone: "123" }),
      ];
      expect(ids(run(blocked, purpose))).toEqual([]);
      const quiet = person({ ...consent, phone: "611222333" });
      expect(
        ids(
          filterAudience(
            [quiet],
            EMPTY_AUDIENCE,
            NOW,
            "whatsapp",
            new Set(["+34611222333"]),
            purpose,
          ),
        ),
      ).toEqual([]);
    }
  });

  it("hand-picked contacts are ignored for an appointment notice: its audience is the appointments", () => {
    const stranger = person({ ...NOTICES, language: "en" });
    const out = filterAudience(
      [stranger],
      audience({ language: "es", manualIds: [stranger.id] }),
      NOW,
      "whatsapp",
      new Set(),
      "appointment",
    );
    expect(ids(out)).toEqual([]);
  });

  it("but still honoured for marketing", () => {
    const stranger = person({ ...NEWS, language: "en" });
    const out = filterAudience(
      [stranger],
      audience({ language: "es", manualIds: [stranger.id] }),
      NOW,
      "whatsapp",
      new Set(),
      "marketing",
    );
    expect(ids(out)).toEqual([stranger.id]);
  });

  it("a notice recipient carries her appointments, and a marketing one does not", () => {
    const appointments = [
      {
        id: "b1",
        serviceId: "s",
        status: "confirmed" as const,
        startsAt: "2026-12-11T09:00:00.000Z",
        endsAt: "2026-12-11T10:00:00.000Z",
        visit: {
          service: "X",
          sessionType: null,
          date: "2026-12-11",
          time: "09:00",
        },
      },
    ];
    const withThem = person({ ...NOTICES, appointments });
    expect(run([withThem], "appointment")[0]?.appointments).toEqual(
      appointments,
    );
    expect(run([person(NEWS)], "marketing")[0]).not.toHaveProperty(
      "appointments",
    );
  });

  it("and its welcome date is not the notices' consent: that one is for news", () => {
    const out = run([person({ ...NOTICES })], "appointment");
    expect(out[0]?.subscribedAt).toBeNull();
    expect(out[0]).not.toHaveProperty("subscriptionCycle");
  });
});

describe("filterAudience — email does not know about purposes", () => {
  const grid: ContactCandidate[] = [
    c({ language: "es", newsletter: true, bookingsCount: 2 }),
    c({ language: "en", bouncedAt: "2026-08-01T10:00:00Z" }),
    c({ unsubscribedAt: "2026-08-02T10:00:00Z" }),
    c({ email: "" }),
    c({
      whatsappMarketingOptedInAt: "2026-11-01T00:00:00Z",
      whatsappOptedInAt: "2026-11-01T00:00:00Z",
      phone: "600112233",
    }),
  ];

  it("gives the same recipients whatever purpose is passed, and none passed", () => {
    const base = filterAudience(grid, EMPTY_AUDIENCE, NOW);
    expect(base.length).toBeGreaterThan(0);
    for (const purpose of ["marketing", "appointment"] as const) {
      expect(
        filterAudience(grid, EMPTY_AUDIENCE, NOW, "email", new Set(), purpose),
      ).toEqual(base);
    }
  });

  it("never adds appointments to an email recipient", () => {
    const withAppointments = c({
      appointments: [
        {
          id: "b1",
          serviceId: null,
          status: "confirmed",
          startsAt: "2026-12-11T09:00:00.000Z",
          endsAt: "2026-12-11T10:00:00.000Z",
          visit: {
            service: "",
            sessionType: null,
            date: "2026-12-11",
            time: "",
          },
        },
      ],
    });
    const [out] = filterAudience(
      [withAppointments],
      EMPTY_AUDIENCE,
      NOW,
      "email",
    );
    expect(out).toBeDefined();
    expect(out).not.toHaveProperty("appointments");
  });
});
