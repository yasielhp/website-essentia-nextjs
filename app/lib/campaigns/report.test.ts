import { describe, expect, test } from "bun:test";
import { IntlMessageFormat } from "intl-messageformat";
import es from "../../../messages/es/dashboard.json";
import en from "../../../messages/en/dashboard.json";
import { haltMessage, haltMessageIn } from "./error-markers";
import { unrecordedMessage } from "./dispatch";
import { LATE_ERROR, RUN_FAILED_ERROR } from "./run-markers";
import { consentVerdict } from "./dispatch-whatsapp";
import {
  describeLastError,
  describeRecipientError,
  REPORT_NOTE_KEYS,
  SENT_STATUSES,
  campaignSentCount,
  reportTiles,
  sentCountOf,
  statusBreakdown,
  variantSubjects,
} from "./report";

describe("describeLastError", () => {
  test("nothing recorded, nothing to say", () => {
    expect(describeLastError(null)).toBeNull();
    expect(describeLastError("")).toBeNull();
    expect(describeLastError(undefined)).toBeNull();
  });

  test("a halt is told in our words, with Meta's text inside", () => {
    expect(
      describeLastError(haltMessage("(#132015) Template is paused")),
    ).toEqual({
      kind: "note",
      key: "haltedReason",
      values: { reason: "(#132015) Template is paused" },
    });
  });

  test("a halt with no text still says it halted", () => {
    expect(describeLastError(haltMessage(""))).toEqual({
      kind: "note",
      key: "haltedNoReason",
    });
  });

  test("any other text stays as it was written", () => {
    expect(
      describeLastError("template_unavailable: template_not_approved"),
    ).toEqual({
      kind: "raw",
      text: "template_unavailable: template_not_approved",
    });
  });

  test("one language of two stopped is said with its language, Meta's text inside", () => {
    const marker = haltMessageIn(
      "en",
      "132001: Template name does not exist in the translation",
    );
    expect(describeLastError(marker, "whatsapp", "failed")).toEqual({
      kind: "note",
      key: "haltedIn",
      values: {
        language: "en",
        reason: "132001: Template name does not exist in the translation",
      },
    });
  });

  test("while the campaign is on, that language is held and the note says so", () => {
    expect(
      describeLastError(haltMessageIn("es", "190: x"), "whatsapp", "active"),
    ).toEqual({
      kind: "note",
      key: "heldIn",
      values: { language: "es", reason: "190: x" },
    });
  });

  test("and the screen says the language in words, in both languages", () => {
    const say = (
      note: ReturnType<typeof describeLastError>,
      locale: "es" | "en",
    ) => {
      if (note?.kind !== "note") throw new Error("not a note");
      const notes = (locale === "es" ? es : en).campaigns.detail
        .notes as Record<string, string>;
      return String(
        new IntlMessageFormat(notes[note.key] as string, locale).format(
          note.values,
        ),
      );
    };
    const stopped = describeLastError(haltMessageIn("en", "132001: x"));
    expect(say(stopped, "es")).toContain("versión en inglés");
    expect(say(stopped, "es")).toContain("(132001: x)");
    expect(say(stopped, "en")).toContain("English version");
    const held = describeLastError(
      haltMessageIn("es", "132001: x"),
      "whatsapp",
      "active",
    );
    expect(say(held, "es")).toContain(
      "Los mensajes en español están retenidos",
    );
    expect(say(held, "en")).toContain("The Spanish messages are held");
  });

  test("a marker in the middle of a text is not a halt", () => {
    expect(describeLastError("x [halted] y")).toEqual({
      kind: "raw",
      text: "x [halted] y",
    });
  });
});

describe("describeRecipientError", () => {
  test("no error, no note", () => {
    expect(describeRecipientError(null)).toBeNull();
    expect(describeRecipientError("")).toBeNull();
  });

  test("a send interrupted mid-way is not retried, and says why", () => {
    expect(describeRecipientError("[unconfirmed] interrupted")).toEqual({
      kind: "note",
      key: "unconfirmedInterrupted",
    });
  });

  test("a failure that may have been delivered keeps Meta's code and text", () => {
    expect(
      describeRecipientError("[unconfirmed] Could not reach WhatsApp: timeout"),
    ).toEqual({
      kind: "note",
      key: "unconfirmed",
      values: { detail: "Could not reach WhatsApp: timeout" },
    });
  });

  test.each([
    ["opted_out", "skippedOptedOut"],
    ["unreachable", "skippedUnreachable"],
    ["no_consent", "skippedNoConsent"],
    ["no_contact", "skippedNoContact"],
    ["no_email", "skippedNoEmail"],
    ["suppressed", "skippedSuppressed"],
  ])("a skipped row for %s", (reason, key) => {
    expect(describeRecipientError(`[skipped] ${reason}`)).toEqual({
      kind: "note",
      key,
    });
  });

  test("a skip for a reason we do not know shows the reason", () => {
    expect(describeRecipientError("[skipped] something_new")).toEqual({
      kind: "note",
      key: "skippedOther",
      values: { reason: "something_new" },
    });
  });

  test("Meta's own refusal is shown as it came, code included", () => {
    expect(describeRecipientError("131026: Message undeliverable")).toEqual({
      kind: "raw",
      text: "131026: Message undeliverable",
    });
    expect(describeRecipientError("no phone")).toEqual({
      kind: "raw",
      text: "no phone",
    });
  });
});

describe("reportTiles", () => {
  test("an email report keeps every counter it always had", () => {
    expect(reportTiles("email")).toEqual([
      "sent",
      "delivered",
      "opened",
      "clicked",
      "bounced",
      "complained",
      "failed",
    ]);
  });

  test("a WhatsApp report has no clicks and no spam complaints: Meta gives neither", () => {
    const tiles = reportTiles("whatsapp");
    expect(tiles).not.toContain("clicked");
    expect(tiles).not.toContain("complained");
    expect(tiles).toEqual(["sent", "delivered", "opened", "bounced", "failed"]);
  });
});

const row = (status: string) => ({ status }) as { status: never };

describe("sentCountOf", () => {
  test("counts the messages that left, not the ones still waiting", () => {
    const rows = [
      "queued",
      "sending",
      "sent",
      "delivered",
      "opened",
      "bounced",
      "failed",
    ].map(row);
    expect(sentCountOf(rows)).toBe(4);
  });
});

describe("statusBreakdown", () => {
  test("lists the states in the order a message goes through them, with sending", () => {
    const rows = [
      "queued",
      "queued",
      "sending",
      "sent",
      "delivered",
      "opened",
      "bounced",
      "failed",
    ].map(row);
    expect(statusBreakdown(rows)).toEqual([
      { status: "queued", count: 2 },
      { status: "sending", count: 1 },
      { status: "sent", count: 1 },
      { status: "delivered", count: 1 },
      { status: "opened", count: 1 },
      { status: "bounced", count: 1 },
      { status: "failed", count: 1 },
    ]);
  });

  test("leaves out the states nobody is in", () => {
    expect(statusBreakdown(["sent", "sent"].map(row))).toEqual([
      { status: "sent", count: 2 },
    ]);
  });

  test("no rows, no breakdown", () => {
    expect(statusBreakdown([])).toEqual([]);
  });
});

describe("REPORT_NOTE_KEYS", () => {
  test("covers every key the two describe functions can answer with", () => {
    const answers = [
      describeLastError(haltMessage("x")),
      describeLastError(haltMessage("")),
      describeLastError(haltMessageIn("en", "x")),
      describeLastError(haltMessageIn("en", "x"), "whatsapp", "active"),
      describeLastError(RUN_FAILED_ERROR),
      describeLastError(unrecordedMessage(1)),
      describeLastError(unrecordedMessage(1), "whatsapp"),
      describeRecipientError("[unconfirmed] interrupted"),
      describeRecipientError("[unconfirmed] x"),
      ...[
        "opted_out",
        "unreachable",
        "no_consent",
        "no_contact",
        "no_email",
        "suppressed",
        "late",
        "other",
      ].map((reason) => describeRecipientError(`[skipped] ${reason}`)),
      describeRecipientError("[skipped] no_consent", "appointment"),
    ];
    const keys = answers.flatMap((a) => (a?.kind === "note" ? [a.key] : []));
    expect(keys.length).toBe(18);
    for (const key of keys) {
      expect(REPORT_NOTE_KEYS as readonly string[]).toContain(key);
    }
    expect(new Set(keys).size).toBe(REPORT_NOTE_KEYS.length);
  });
});

describe("campaignSentCount", () => {
  const base = { recipients_count: 100, failed_count: 10 };

  test("a finished or email campaign: the frozen audience minus the refused", () => {
    expect(campaignSentCount(base)).toBe(90);
  });

  test("a WhatsApp campaign still sending uses the rows that really left", () => {
    expect(campaignSentCount({ ...base, sent_count: 35 })).toBe(35);
  });

  test("zero rows sent is zero, not the audience", () => {
    expect(campaignSentCount({ ...base, sent_count: 0 })).toBe(0);
  });

  test("never negative", () => {
    expect(campaignSentCount({ recipients_count: 2, failed_count: 5 })).toBe(0);
  });

  test("the states that count are the ones sentCountOf counts", () => {
    const rows = [...SENT_STATUSES, "queued", "sending", "failed"].map(row);
    expect(sentCountOf(rows)).toBe(SENT_STATUSES.length);
  });
});

describe("every reason a send can skip a row for is one the report words", () => {
  const consenting = {
    id: "c",
    whatsapp_opted_out_at: null,
    whatsapp_unreachable_at: null,
    whatsapp_marketing_opted_in_at: "2026-11-01",
  };
  const verdicts = [
    consentVerdict(null),
    consentVerdict({ ...consenting, whatsapp_opted_out_at: "x" }),
    consentVerdict({ ...consenting, whatsapp_unreachable_at: "x" }),
    consentVerdict({ ...consenting, whatsapp_marketing_opted_in_at: null }),
    // The email path writes this one.
    "no_email",
  ];

  test("none falls through to the generic 'skipped' wording", () => {
    expect(verdicts.length).toBe(5);
    for (const verdict of verdicts) {
      const note = describeRecipientError(`[skipped] ${verdict}`);
      expect(note).toMatchObject({ kind: "note" });
      expect(note && note.kind === "note" && note.key).not.toBe("skippedOther");
    }
  });
});

describe("a recipient left out for consent", () => {
  test("lacks the consent of what the campaign is: news and offers, or appointment notices", () => {
    expect(describeRecipientError("[skipped] no_consent")).toEqual({
      kind: "note",
      key: "skippedNoConsent",
    });
    expect(describeRecipientError("[skipped] no_consent", "standard")).toEqual({
      kind: "note",
      key: "skippedNoConsent",
    });
    expect(
      describeRecipientError("[skipped] no_consent", "appointment"),
    ).toEqual({
      kind: "note",
      key: "skippedNoConsentAppointment",
    });
  });
  test("an appointment notice's other reasons read as everybody's", () => {
    expect(
      describeRecipientError("[skipped] opted_out", "appointment"),
    ).toEqual({ kind: "note", key: "skippedOptedOut" });
  });
  test("a notice that arrived too late says so", () => {
    expect(describeRecipientError("[skipped] late", "appointment")).toEqual({
      kind: "note",
      key: "skippedLate",
    });
  });
});

describe("the markers of the engine never reach the screen as they are stored", () => {
  test("a run that threw says it retries by itself", () => {
    expect(describeLastError(RUN_FAILED_ERROR)).toEqual({
      kind: "note",
      key: "runFailed",
    });
  });
  test("messages that left unrecorded, as the engine really writes it, with their count", () => {
    expect(describeLastError(unrecordedMessage(3))).toEqual({
      kind: "note",
      key: "unrecorded",
      values: { count: "3" },
    });
    expect(describeLastError(unrecordedMessage(12), "whatsapp")).toEqual({
      kind: "note",
      key: "unrecordedWhatsApp",
      values: { count: "12" },
    });
  });
  test("the same inside a halt is still said in our words", () => {
    expect(describeLastError(haltMessage(unrecordedMessage(2)))).toEqual({
      kind: "note",
      key: "unrecorded",
      values: { count: "2" },
    });
  });
  test("a halt that is Meta's own text keeps it, as before", () => {
    expect(describeLastError(haltMessage("(#131056) pair rate limit"))).toEqual(
      {
        kind: "note",
        key: "haltedReason",
        values: { reason: "(#131056) pair rate limit" },
      },
    );
  });
  test("a text that only looks like the count is raw", () => {
    expect(describeLastError("3 sent without being recorded, mostly")).toEqual({
      kind: "raw",
      text: "3 sent without being recorded, mostly",
    });
  });
  test("a row skipped for coming too late maps to its own message, from the real marker", () => {
    expect(describeRecipientError(LATE_ERROR)).toEqual({
      kind: "note",
      key: "skippedLate",
    });
  });
  test("every key a note can carry has a text in both languages", async () => {
    const es = (await import("../../../messages/es/dashboard.json")).default;
    const en = (await import("../../../messages/en/dashboard.json")).default;
    for (const key of REPORT_NOTE_KEYS) {
      expect(Object.hasOwn(es.campaigns.detail.notes, key)).toBe(true);
      expect(Object.hasOwn(en.campaigns.detail.notes, key)).toBe(true);
    }
  });
});

describe("variantSubjects: the two subjects of an A/B test, in each language it went out in", () => {
  const block = (subject: string, subjectB?: string) => ({
    subject,
    ...(subjectB ? { subjectB } : {}),
    preheader: "",
    title: "",
    doc: null,
  });
  const content = {
    es: block("Hola", "Hola de nuevo"),
    en: block("Hello", "Hello again"),
  };

  test("an audience of both languages: each variant's subject in Spanish and in English", () => {
    const campaign = { audience: { language: "any" as const }, content };
    expect(variantSubjects(campaign, "a")).toEqual(["Hola", "Hello"]);
    expect(variantSubjects(campaign, "b")).toEqual([
      "Hola de nuevo",
      "Hello again",
    ]);
  });

  test("an audience that fixes a language: that language's alone", () => {
    expect(
      variantSubjects({ audience: { language: "en" as const }, content }, "b"),
    ).toEqual(["Hello again"]);
  });

  test("a subject nobody wrote is left out, not shown as a blank", () => {
    expect(
      variantSubjects(
        {
          audience: { language: "any" as const },
          content: { es: block("Hola"), en: block("Hello", "Hello again") },
        },
        "b",
      ),
    ).toEqual(["Hello again"]);
  });
});
