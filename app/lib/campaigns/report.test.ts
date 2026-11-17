import { describe, expect, test } from "bun:test";
import { haltMessage } from "./error-markers";
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
    expect(keys.length).toBe(13);
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
