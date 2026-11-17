import { describe, expect, it, spyOn } from "bun:test";
import { chainDb, argsOf, filters, show } from "@/lib/campaigns/fake-db";
import { template } from "@/lib/campaigns/whatsapp-fixtures";
import type { BookingEventInput } from "@/lib/booking-events/types";
import type { WhatsAppParamSource, WhatsAppSendResult } from "./types";
import type { TemplateSend } from "./client";
import {
  bookingLocale,
  clientPhone,
  clientRecipient,
  decideClientWhatsApp,
  deliverClientWhatsApp,
  hasClientConsent,
  makeClientDeps,
  notifyClientOnWhatsApp,
  type ClientBooking,
  type ClientContact,
  type ClientWhatsAppDeps,
} from "./notify-client";

const SOURCES: WhatsAppParamSource[] = [
  { kind: "field", field: "first_name" },
  { kind: "field", field: "service" },
  { kind: "field", field: "date" },
  { kind: "field", field: "time" },
];

const TEMPLATE = template({
  id: "tpl-1",
  name: "cita_confirmada",
  category: "UTILITY",
  body: "Hola {{1}}, tu sesión de {{2}} es el {{3}} a las {{4}}.",
  param_count: 4,
});

const ROW = {
  locale: "es",
  enabled: true,
  whatsapp_template_id: "tpl-1",
  whatsapp_params: SOURCES,
};

const CONTACT: ClientContact = {
  first_name: "Ana",
  last_name: "García",
  phone: "600 11 22 33",
  preferred_language: "es",
  whatsapp_opted_in_at: "2026-11-01T00:00:00Z",
  whatsapp_opted_out_at: null,
  whatsapp_unreachable_at: null,
};

const BOOKING: ClientBooking = {
  first_name: "Ana",
  last_name: "García",
  phone: "+34 611 222 333",
  service_title: "Drenaje linfático",
  tier_label: "Sesión individual",
  date: "2026-12-10",
  time: "09:30:00",
};

const decide = (over: Record<string, unknown> = {}) =>
  decideClientWhatsApp({
    key: "booking_confirmed",
    locale: "es",
    row: ROW,
    template: TEMPLATE,
    contact: CONTACT,
    booking: BOOKING,
    phoneSuppressed: false,
    ...over,
  } as Parameters<typeof decideClientWhatsApp>[0]);

describe("bookingLocale", () => {
  it("is the payload's, then the contact's, then Spanish", () => {
    expect(bookingLocale("en", "es")).toBe("en");
    expect(bookingLocale(undefined, "en")).toBe("en");
    expect(bookingLocale(undefined, "es")).toBe("es");
    expect(bookingLocale(undefined, null)).toBe("es");
    expect(bookingLocale(undefined, "fr")).toBe("es");
    expect(bookingLocale(null, undefined)).toBe("es");
  });
});

describe("hasClientConsent", () => {
  it("needs the booking-notice opt-in and neither the opt-out nor the unreachable stamp", () => {
    expect(hasClientConsent(CONTACT)).toBe(true);
    expect(hasClientConsent(null)).toBe(false);
    expect(hasClientConsent({ ...CONTACT, whatsapp_opted_in_at: null })).toBe(
      false,
    );
    expect(
      hasClientConsent({
        ...CONTACT,
        whatsapp_opted_out_at: "2026-11-02T00:00:00Z",
      }),
    ).toBe(false);
    expect(
      hasClientConsent({
        ...CONTACT,
        whatsapp_unreachable_at: "2026-11-02T00:00:00Z",
      }),
    ).toBe(false);
  });

  it("the marketing consent is not this one", () => {
    const marketingOnly = {
      ...CONTACT,
      whatsapp_opted_in_at: null,
      whatsapp_marketing_opted_in_at: "2026-11-01T00:00:00Z",
    } as ClientContact;
    expect(hasClientConsent(marketingOnly)).toBe(false);
  });
});

describe("clientPhone", () => {
  it("prefers the booking's own number when it is valid", () => {
    expect(clientPhone(CONTACT, BOOKING)).toBe("+34611222333");
  });
  it("falls back to the contact's when the booking's is not a number", () => {
    expect(clientPhone(CONTACT, { ...BOOKING, phone: "no phone" })).toBe(
      "+34600112233",
    );
    expect(clientPhone(CONTACT, { ...BOOKING, phone: null })).toBe(
      "+34600112233",
    );
  });
  it("is null when neither is a number the database accepts", () => {
    expect(
      clientPhone({ ...CONTACT, phone: "123" }, { ...BOOKING, phone: "" }),
    ).toBeNull();
    expect(clientPhone(null, { ...BOOKING, phone: null })).toBeNull();
  });
});

describe("clientRecipient", () => {
  it("is the number when the client may be written to, and null when she may not", () => {
    expect(clientRecipient(CONTACT, BOOKING)).toBe("+34611222333");
    expect(clientRecipient(null, BOOKING)).toBeNull();
    expect(
      clientRecipient({ ...CONTACT, whatsapp_opted_in_at: null }, BOOKING),
    ).toBeNull();
    expect(
      clientRecipient(
        { ...CONTACT, whatsapp_opted_out_at: "2026-11-02T00:00:00Z" },
        BOOKING,
      ),
    ).toBeNull();
    expect(
      clientRecipient(
        { ...CONTACT, whatsapp_unreachable_at: "2026-11-02T00:00:00Z" },
        BOOKING,
      ),
    ).toBeNull();
    expect(
      clientRecipient({ ...CONTACT, phone: null }, { ...BOOKING, phone: null }),
    ).toBeNull();
  });
});

describe("decideClientWhatsApp — nothing to do", () => {
  it("only the messages the opt-in promises are sent", () => {
    for (const key of [
      "booking_received",
      "booking_rescheduled",
      "booking_cancelled",
      "consent_request",
      "bonus_purchase",
      // Its WhatsApp version is an appointment notice, a campaign.
      "booking_reminder",
    ] as const) {
      expect(decide({ key }).kind).toBe("none");
    }
    for (const key of ["booking_confirmed", "booking_paid"] as const) {
      expect(decide({ key }).kind).toBe("send");
    }
  });

  it("no saved row, no message", () => {
    expect(decide({ row: null }).kind).toBe("none");
  });

  it("a row without a template is not a message", () => {
    expect(decide({ row: { ...ROW, whatsapp_template_id: null } }).kind).toBe(
      "none",
    );
  });

  it("a message that cannot be switched off ignores the switch: a paid client keeps her confirmation", () => {
    const off = { ...ROW, enabled: false };
    expect(decide({ key: "booking_confirmed", row: off }).kind).toBe("send");
    expect(decide({ key: "booking_paid", row: off }).kind).toBe("send");
  });

  it("no contact, no opt-in, an opt-out or an unreachable number: nothing, and not a recorded skip", () => {
    expect(decide({ contact: null }).kind).toBe("none");
    expect(
      decide({ contact: { ...CONTACT, whatsapp_opted_in_at: null } }).kind,
    ).toBe("none");
    expect(
      decide({
        contact: { ...CONTACT, whatsapp_opted_out_at: "2026-11-05T00:00:00Z" },
      }).kind,
    ).toBe("none");
    expect(
      decide({
        contact: {
          ...CONTACT,
          whatsapp_unreachable_at: "2026-11-05T00:00:00Z",
        },
      }).kind,
    ).toBe("none");
  });

  it("no number the database accepts is nothing too", () => {
    expect(
      decide({
        contact: { ...CONTACT, phone: null },
        booking: { ...BOOKING, phone: null },
      }).kind,
    ).toBe("none");
  });

  it("without consent a broken template is still nothing: the client would not have been messaged", () => {
    expect(decide({ contact: null, template: null }).kind).toBe("none");
    expect(
      decide({
        contact: { ...CONTACT, whatsapp_opted_in_at: null },
        template: { ...TEMPLATE, status: "REJECTED" },
      }).kind,
    ).toBe("none");
  });
});

describe("decideClientWhatsApp — a number that said STOP", () => {
  it("is never written to, whoever's contact it is on, and is not a recorded skip", () => {
    expect(decide({ phoneSuppressed: true }).kind).toBe("none");
    // Not even for a broken template: the client would not have been messaged.
    expect(decide({ phoneSuppressed: true, template: null }).kind).toBe("none");
  });
});

describe("decideClientWhatsApp — a template that cannot be sent is a misconfiguration to show", () => {
  const reason = (over: Record<string, unknown>) => {
    const out = decide(over);
    return out.kind === "skip" ? out.reason : out.kind;
  };

  it("names why", () => {
    expect(reason({ template: null })).toBe("template_missing");
    expect(reason({ template: { ...TEMPLATE, status: "PENDING" } })).toBe(
      "template_not_approved",
    );
    expect(
      reason({ template: { ...TEMPLATE, unsupported_reason: "media_header" } }),
    ).toBe("template_unsupported");
    expect(reason({ template: { ...TEMPLATE, language: "en" } })).toBe(
      "template_language",
    );
    expect(reason({ template: { ...TEMPLATE, param_count: 2 } })).toBe(
      "param_count",
    );
  });

  it("a template whose button needs a value is a skip: this sender fills none, and Meta would refuse every send", () => {
    expect(
      reason({
        template: {
          ...TEMPLATE,
          buttons: [
            {
              type: "URL",
              text: "Ver cita",
              url: "https://example.com/c/{{1}}",
            },
          ],
        },
      }),
    ).toBe("button_params");
    // A button with a fixed address, and a quick reply, need nothing.
    expect(
      decide({
        template: {
          ...TEMPLATE,
          buttons: [
            { type: "URL", text: "Web", url: "https://example.com/" },
            { type: "QUICK_REPLY", text: "Vale" },
          ],
        },
      }).kind,
    ).toBe("send");
  });

  it("a stored parameter list that is not one is a skip, not a throw", () => {
    expect(reason({ row: { ...ROW, whatsapp_params: "garbage" } })).toBe(
      "params_invalid",
    );
    expect(
      reason({ row: { ...ROW, whatsapp_params: [{ kind: "nope" }] } }),
    ).toBe("params_invalid");
  });

  it("the row's language must be the template's", () => {
    expect(reason({ locale: "en", template: TEMPLATE })).toBe(
      "template_language",
    );
  });
});

describe("decideClientWhatsApp — what is sent", () => {
  it("fills the parameters from the booking, in the client's language", () => {
    const out = decide();
    if (out.kind !== "send") throw new Error(out.kind);
    expect(out.to).toBe("+34611222333");
    expect(out.params).toEqual([
      "Ana",
      "Drenaje linfático",
      "jueves, 10 de diciembre de 2026",
      "09:30",
    ]);
    expect(out.send).toEqual({
      to: "+34611222333",
      name: "cita_confirmada",
      language: "es",
      bodyParams: out.params,
    });
    expect(out.preview).toBe(
      "Hola Ana, tu sesión de Drenaje linfático es el jueves, 10 de diciembre de 2026 a las 09:30.",
    );
  });

  it("writes the date in English for an English booking", () => {
    const out = decide({
      locale: "en",
      template: { ...TEMPLATE, language: "en" },
      row: { ...ROW, locale: "en" },
    });
    if (out.kind !== "send") throw new Error(out.kind);
    expect(out.params[2]).toBe("Thursday, 10 December 2026");
  });

  it("session type, last name and static text come out as written; an empty one is a dash", () => {
    const out = decide({
      template: { ...TEMPLATE, param_count: 3 },
      row: {
        ...ROW,
        whatsapp_params: [
          { kind: "field", field: "session_type" },
          { kind: "field", field: "last_name" },
          { kind: "static", value: "Essentia" },
        ],
      },
      booking: { ...BOOKING, tier_label: null },
      contact: { ...CONTACT, last_name: "García" },
    });
    if (out.kind !== "send") throw new Error(out.kind);
    expect(out.params).toEqual(["—", "García", "Essentia"]);
  });

  it("the name falls back to the booking's when the contact has none", () => {
    const out = decide({ contact: { ...CONTACT, first_name: "" } });
    if (out.kind !== "send") throw new Error(out.kind);
    expect(out.params[0]).toBe("Ana");
  });

  it("never reads a campaign-only field out of thin air", () => {
    const out = decide({
      template: { ...TEMPLATE, param_count: 1 },
      row: {
        ...ROW,
        whatsapp_params: [{ kind: "field", field: "post_title" }],
      },
    });
    if (out.kind !== "send") throw new Error(out.kind);
    expect(out.params).toEqual(["—"]);
  });
});

// ── effects ────────────────────────────────────────────────────────────────

function harness(
  answer: (
    send: TemplateSend,
  ) => WhatsAppSendResult | Promise<WhatsAppSendResult> = () => ({
    status: "sent",
    providerId: "wamid.1",
  }),
) {
  const sent: TemplateSend[] = [];
  const recorded: BookingEventInput[] = [];
  const deps: Pick<ClientWhatsAppDeps, "send" | "record" | "isSuppressed"> = {
    isSuppressed: async () => false,
    send: async (s) => {
      sent.push(s);
      return answer(s);
    },
    record: async (e) => {
      recorded.push(e);
    },
  };
  return { sent, recorded, deps };
}

const ACTOR = { actorId: null, actorRole: "system" as const };
const args = (over: Record<string, unknown> = {}) =>
  ({
    bookingId: "b-1",
    key: "booking_confirmed",
    event: "confirmed",
    locale: "es",
    row: ROW,
    template: TEMPLATE,
    contact: CONTACT,
    booking: BOOKING,
    ...ACTOR,
    ...over,
  }) as Parameters<typeof deliverClientWhatsApp>[0];

describe("deliverClientWhatsApp", () => {
  it("sends and records one entry, as the client sees it", async () => {
    const h = harness();
    expect(await deliverClientWhatsApp(args(), h.deps)).toBe("sent");
    expect(h.sent).toHaveLength(1);
    expect(h.recorded).toEqual([
      {
        bookingId: "b-1",
        channel: "whatsapp",
        event: "confirmed",
        actorId: null,
        actorRole: "system",
        recipient: "+34611222333",
        summary:
          "Hola Ana, tu sesión de Drenaje linfático es el jueves, 10 de diciembre de 2026 a las 09:30.",
        status: "sent",
        providerId: "wamid.1",
        error: null,
        payload: {
          template: "cita_confirmada",
          params: [
            "Ana",
            "Drenaje linfático",
            "jueves, 10 de diciembre de 2026",
            "09:30",
          ],
          language: "es",
        },
      },
    ]);
  });

  it("does nothing, and writes nothing, when there is nothing to send", async () => {
    for (const over of [
      { row: null },
      { contact: null },
      {
        contact: { ...CONTACT, whatsapp_opted_out_at: "2026-11-05T00:00:00Z" },
      },
      {
        contact: {
          ...CONTACT,
          whatsapp_unreachable_at: "2026-11-05T00:00:00Z",
        },
      },
      { contact: { ...CONTACT, whatsapp_opted_in_at: null } },
      {
        contact: { ...CONTACT, phone: null },
        booking: { ...BOOKING, phone: null },
      },
    ]) {
      const h = harness();
      expect(await deliverClientWhatsApp(args(over), h.deps)).toBe("none");
      expect(h.sent).toHaveLength(0);
      expect(h.recorded).toHaveLength(0);
    }
  });

  it("an ineligible template is one skipped entry with the reason, and no send", async () => {
    const h = harness();
    expect(
      await deliverClientWhatsApp(
        args({ template: { ...TEMPLATE, status: "PAUSED" } }),
        h.deps,
      ),
    ).toBe("skipped");
    expect(h.sent).toHaveLength(0);
    expect(h.recorded).toHaveLength(1);
    expect(h.recorded[0]).toMatchObject({
      channel: "whatsapp",
      event: "confirmed",
      status: "skipped",
      error: "template_not_approved",
      recipient: "+34611222333",
    });
    expect(h.recorded[0]?.summary).toContain("no se envió");
  });

  it("a refusal is recorded as failed with Meta's words", async () => {
    const h = harness(() => ({
      status: "failed",
      error: "Re-engagement",
      code: 131047,
    }));
    expect(await deliverClientWhatsApp(args(), h.deps)).toBe("failed");
    expect(h.recorded[0]).toMatchObject({
      status: "failed",
      error: "Re-engagement",
      providerId: null,
    });
    expect(h.recorded[0]?.payload).not.toHaveProperty("ambiguous");
  });

  it("an ambiguous failure is recorded as failed and flagged", async () => {
    const h = harness(() => ({
      status: "failed",
      error: "timeout",
      ambiguous: true,
    }));
    expect(await deliverClientWhatsApp(args(), h.deps)).toBe("failed");
    expect(h.recorded[0]?.status).toBe("failed");
    expect(h.recorded[0]?.payload).toMatchObject({ ambiguous: true });
  });

  it("a send that throws is recorded and never propagates", async () => {
    const h = harness(() => {
      throw new Error("socket closed");
    });
    expect(await deliverClientWhatsApp(args(), h.deps)).toBe("failed");
    expect(h.recorded[0]).toMatchObject({
      status: "failed",
      error: "socket closed",
    });
    expect(h.recorded[0]?.payload).toMatchObject({ ambiguous: true });
  });

  it("a history that cannot be written does not propagate either", async () => {
    const h = harness();
    const deps = {
      ...h.deps,
      record: async () => {
        throw new Error("db down");
      },
    };
    expect(await deliverClientWhatsApp(args(), deps)).toBe("sent");
  });

  it("a send that answers 'skipped' (no WhatsApp configured) leaves no trace", async () => {
    const h = harness(() => ({ status: "skipped" }));
    expect(await deliverClientWhatsApp(args(), h.deps)).toBe("none");
    expect(h.recorded).toHaveLength(0);
  });

  it("a number on the STOP list gets nothing: no send, no history", async () => {
    const h = harness();
    const deps = { ...h.deps, isSuppressed: async () => true };
    expect(await deliverClientWhatsApp(args(), deps)).toBe("none");
    expect(h.sent).toHaveLength(0);
    expect(h.recorded).toHaveLength(0);
  });

  it("the list is asked about the number the message would go to, before anything is sent", async () => {
    const asked: string[] = [];
    const order: string[] = [];
    const h = harness();
    const deps = {
      ...h.deps,
      isSuppressed: async (phone: string) => {
        asked.push(phone);
        order.push("suppression");
        return false;
      },
      send: async (s: TemplateSend) => {
        order.push("send");
        return h.deps.send(s);
      },
    };
    await deliverClientWhatsApp(args(), deps);
    expect(asked).toEqual(["+34611222333"]);
    expect(order).toEqual(["suppression", "send"]);
  });

  it("a list that cannot be read means nothing is sent: it fails closed", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const h = harness();
    const deps = {
      ...h.deps,
      isSuppressed: async () => {
        throw new Error("relation does not exist");
      },
    };
    expect(await deliverClientWhatsApp(args(), deps)).toBe("none");
    quiet.mockRestore();
    expect(h.sent).toHaveLength(0);
    expect(h.recorded).toHaveLength(0);
  });

  it("the list is not read for a client who would not be messaged anyway", async () => {
    let asked = 0;
    const h = harness();
    const deps = {
      ...h.deps,
      isSuppressed: async () => {
        asked += 1;
        return false;
      },
    };
    await deliverClientWhatsApp(args({ contact: null }), deps);
    await deliverClientWhatsApp(args({ row: null }), deps);
    expect(asked).toBe(0);
  });
});

// ── the loader the confirmed and paid flows use ────────────────────────────

type Answers = {
  rows?: unknown[] | null;
  rowsError?: boolean;
  booking?: unknown;
  contactByEmail?: unknown;
  contactById?: unknown;
  template?: unknown;
  /** E.164 phones on the suppression list. */
  suppressed?: string[];
  /** The list cannot be read (the table does not exist yet). */
  suppressedError?: boolean;
  /** Reading the contact fails. */
  contactError?: boolean;
};

function loaderHarness(
  answers: Answers,
  send: (s: TemplateSend) => WhatsAppSendResult = () => ({
    status: "sent",
    providerId: "wamid.9",
  }),
  configured = true,
) {
  const h = harness(send);
  const { db, log } = chainDb(async (table, chain) => {
    if (table === "message_templates") {
      return answers.rowsError
        ? { data: null, error: { message: "boom" } }
        : { data: answers.rows ?? [], error: null };
    }
    if (table === "bookings")
      return { data: answers.booking ?? null, error: null };
    if (table === "contacts") {
      if (answers.contactError) {
        return { data: null, error: { message: "boom" } };
      }
      const f = filters(chain);
      return {
        data:
          "email" in f
            ? (answers.contactByEmail ?? null)
            : (answers.contactById ?? null),
        error: null,
      };
    }
    if (table === "whatsapp_templates") {
      return { data: answers.template ?? null, error: null };
    }
    if (table === "whatsapp_suppressed_phones") {
      return answers.suppressedError
        ? { data: null, error: { message: "relation does not exist" } }
        : {
            data: (answers.suppressed ?? []).map((phone) => ({ phone })),
            error: null,
          };
    }
    return { data: null, error: null };
  });
  const deps: ClientWhatsAppDeps = {
    ...makeClientDeps(db),
    db,
    send: h.deps.send,
    record: h.deps.record,
    isConfigured: () => configured,
  };
  return { ...h, deps, log };
}

const BOOKING_ROW = {
  email: "Ana@Example.test",
  contact_id: "c-1",
  phone: "+34 611 222 333",
  first_name: "Ana",
  last_name: "García",
  service_title: "Drenaje linfático",
  date: "2026-12-10",
  time: "09:30",
  service_tiers: { label: "Sesión individual" },
};

const full: Answers = {
  rows: [ROW],
  booking: BOOKING_ROW,
  contactByEmail: CONTACT,
  template: TEMPLATE,
};

const input = {
  bookingId: "b-1",
  key: "booking_confirmed" as const,
  event: "confirmed" as const,
  ...ACTOR,
};

describe("notifyClientOnWhatsApp", () => {
  it("with no saved row it reads that one row and stops", async () => {
    const h = loaderHarness({ rows: [] });
    await notifyClientOnWhatsApp(input, h.deps);
    expect(h.log.map((q) => q.table)).toEqual(["message_templates"]);
    expect(h.sent).toHaveLength(0);
    expect(h.recorded).toHaveLength(0);
  });

  it("with WhatsApp not configured it does not touch the database at all", async () => {
    const h = loaderHarness(full, undefined, false);
    await notifyClientOnWhatsApp(input, h.deps);
    expect(h.log).toHaveLength(0);
    expect(h.sent).toHaveLength(0);
  });

  it("a message the opt-in does not promise is not even read", async () => {
    const h = loaderHarness(full);
    await notifyClientOnWhatsApp(
      { ...input, key: "booking_cancelled" as never },
      h.deps,
    );
    expect(h.log).toHaveLength(0);
  });

  it("sends the saved template to the consenting client and records it", async () => {
    const h = loaderHarness(full);
    await notifyClientOnWhatsApp(input, h.deps);
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]?.to).toBe("+34611222333");
    expect(h.recorded).toHaveLength(1);
    expect(h.recorded[0]).toMatchObject({
      bookingId: "b-1",
      event: "confirmed",
      status: "sent",
      providerId: "wamid.9",
    });
  });

  it("finds the contact by the booking's email, lowercased", async () => {
    const h = loaderHarness(full);
    await notifyClientOnWhatsApp(input, h.deps);
    const contacts = h.log.filter((q) => q.table === "contacts");
    expect(filters(contacts[0]!.chain)).toEqual({ email: "ana@example.test" });
  });

  it("a contact read that fails is logged, and nothing is sent on a guess", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => {});
    const h = loaderHarness({ ...full, contactError: true });
    await notifyClientOnWhatsApp(input, h.deps);
    const logs = logged.mock.calls.filter((c) =>
      String(c[0]).includes("contact read failed"),
    );
    logged.mockRestore();
    expect(logs.length).toBeGreaterThan(0);
    expect(h.sent).toHaveLength(0);
    expect(h.recorded).toHaveLength(0);
  });

  it("a number on the STOP list is not written to, whatever the consent says", async () => {
    const h = loaderHarness({ ...full, suppressed: ["+34611222333"] });
    await notifyClientOnWhatsApp(input, h.deps);
    expect(h.sent).toHaveLength(0);
    expect(h.recorded).toHaveLength(0);
    // The list was asked about that number and nothing else.
    const read = h.log.find((q) => q.table === "whatsapp_suppressed_phones")!;
    expect(argsOf(read.chain, "in")).toEqual(["phone", ["+34611222333"]]);
  });

  it("a STOP list that cannot be read (no table yet) sends nothing", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const h = loaderHarness({ ...full, suppressedError: true });
    await notifyClientOnWhatsApp(input, h.deps);
    quiet.mockRestore();
    expect(h.sent).toHaveLength(0);
    expect(h.recorded).toHaveLength(0);
  });

  it("a number that is not on the list is written to", async () => {
    const h = loaderHarness({ ...full, suppressed: ["+34999999999"] });
    await notifyClientOnWhatsApp(input, h.deps);
    expect(h.sent).toHaveLength(1);
  });

  it("falls back to the contact the booking points at", async () => {
    const h = loaderHarness({
      ...full,
      contactByEmail: null,
      contactById: CONTACT,
    });
    await notifyClientOnWhatsApp(input, h.deps);
    expect(h.sent).toHaveLength(1);
    const contacts = h.log.filter((q) => q.table === "contacts");
    expect(filters(contacts[1]!.chain)).toEqual({ id: "c-1" });
  });

  it("without consent it reads no template and sends and records nothing", async () => {
    const h = loaderHarness({
      ...full,
      contactByEmail: { ...CONTACT, whatsapp_opted_in_at: null },
    });
    await notifyClientOnWhatsApp(input, h.deps);
    expect(h.log.map((q) => q.table)).not.toContain("whatsapp_templates");
    expect(h.sent).toHaveLength(0);
    expect(h.recorded).toHaveLength(0);
  });

  it("picks the row of the booking's language", async () => {
    const en = { ...ROW, locale: "en", whatsapp_template_id: "tpl-en" };
    const h = loaderHarness({
      ...full,
      rows: [ROW, en],
      template: { ...TEMPLATE, id: "tpl-en", language: "en" },
      contactByEmail: { ...CONTACT, preferred_language: "en" },
    });
    await notifyClientOnWhatsApp(input, h.deps);
    const tplRead = h.log.find((q) => q.table === "whatsapp_templates")!;
    expect(filters(tplRead.chain)).toEqual({ id: "tpl-en" });
    // Passed locale wins over the contact's.
    const h2 = loaderHarness({ ...full, rows: [ROW, en] });
    await notifyClientOnWhatsApp({ ...input, locale: "es" }, h2.deps);
    expect(
      filters(h2.log.find((q) => q.table === "whatsapp_templates")!.chain),
    ).toEqual({ id: "tpl-1" });
  });

  it("no row in the booking's language means nothing is sent", async () => {
    const h = loaderHarness({
      ...full,
      rows: [{ ...ROW, locale: "en" }],
      contactByEmail: { ...CONTACT, preferred_language: "es" },
    });
    await notifyClientOnWhatsApp(input, h.deps);
    expect(h.sent).toHaveLength(0);
    expect(h.recorded).toHaveLength(0);
  });

  it("a database that fails anywhere never throws and sends nothing", async () => {
    const h = loaderHarness({ ...full, rowsError: true });
    await notifyClientOnWhatsApp(input, h.deps);
    expect(h.sent).toHaveLength(0);

    const broken = loaderHarness(full);
    const deps = {
      ...broken.deps,
      db: {
        from() {
          throw new Error("no client");
        },
      } as unknown as ClientWhatsAppDeps["db"],
    };
    await notifyClientOnWhatsApp(input, deps);
    expect(broken.sent).toHaveLength(0);
  });

  it("a send that throws never reaches the caller", async () => {
    const h = loaderHarness(full, () => {
      throw new Error("socket closed");
    });
    await notifyClientOnWhatsApp(input, h.deps);
    expect(h.recorded[0]?.status).toBe("failed");
  });

  it("asks for nothing the booking row does not have", async () => {
    const h = loaderHarness(full);
    await notifyClientOnWhatsApp(input, h.deps);
    const booking = h.log.find((q) => q.table === "bookings")!;
    expect(filters(booking.chain)).toEqual({ id: "b-1" });
    expect(String(argsOf(booking.chain, "select")?.[0])).toContain("phone");
    expect(show(booking)).toContain("bookings");
  });
});
