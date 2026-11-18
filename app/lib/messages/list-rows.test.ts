import { describe, expect, test } from "bun:test";
import { MESSAGE_CATALOG, MESSAGE_KEYS } from "./catalog";
import {
  messageListRows,
  summarizeEmail,
  summarizeWhatsApp,
  type EmailListRow,
  type WhatsAppListRow,
} from "./list-rows";
import { WHATSAPP_MESSAGE_KEYS } from "./whatsapp-row";
import type { MessageCatalogEntry, MessageTemplateRowView } from "./types";

const catalog = MESSAGE_KEYS.map((key) => ({
  key,
  canDisable: MESSAGE_CATALOG[key].canDisable,
})) as unknown as MessageCatalogEntry[];

const row = (over: Partial<MessageTemplateRowView>) =>
  ({
    key: "booking_received",
    channel: "email",
    locale: "es",
    enabled: true,
    subject: null,
    preheader: null,
    title: null,
    doc: null,
    whatsapp_template_id: null,
    whatsapp_params: [],
    updated_at: "2026-11-17T10:00:00Z",
    ...over,
  }) as MessageTemplateRowView;

const emailRows = (out: ReturnType<typeof messageListRows>) =>
  out.filter((r): r is EmailListRow => r.type === "email");
const waRows = (out: ReturnType<typeof messageListRows>) =>
  out.filter((r): r is WhatsAppListRow => r.type === "whatsapp");

describe("the shape of the list: one row per message and channel", () => {
  const rows = messageListRows([], catalog, []);

  test("one email row per message, in the catalogue's order, with the languages it is sent in", () => {
    const email = emailRows(rows);
    expect(email.map((r) => r.id)).toEqual(
      MESSAGE_KEYS.map((k) => `${k}:email`),
    );
    for (const r of email) {
      expect(r.locales).toEqual(
        r.key === "booking_reminder" ? ["es"] : ["es", "en"],
      );
    }
  });

  test("the messages that also go out on WhatsApp get ONE row, right after their email row, and nothing else", () => {
    for (const key of MESSAGE_KEYS) {
      const wa = waRows(rows).filter((r) => r.key === key);
      if (WHATSAPP_MESSAGE_KEYS.includes(key)) {
        expect(wa).toHaveLength(1);
        expect(wa[0].locales).toEqual(["es", "en"]);
        expect(rows.indexOf(wa[0])).toBe(
          rows.findIndex((r) => r.id === `${key}:email`) + 1,
        );
      } else {
        expect(wa).toHaveLength(0);
      }
    }
  });

  test("every row has an id of its own, so a list can key on it", () => {
    const ids = rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("there are fewer rows than there were: no row per language", () => {
    expect(rows.length).toBe(
      MESSAGE_KEYS.length + WHATSAPP_MESSAGE_KEYS.length,
    );
  });
});

describe("summarizeEmail: what the languages of one message say together", () => {
  const both = ["es", "en"] as const;
  test("none edited: by default", () => {
    expect(summarizeEmail([...both], [])).toEqual({
      kind: "default",
      languages: [],
    });
  });
  test("all edited: custom", () => {
    expect(summarizeEmail([...both], ["en", "es"])).toEqual({
      kind: "custom",
      languages: ["es", "en"],
    });
  });
  test("only some: custom, naming them in the message's own order", () => {
    expect(summarizeEmail([...both], ["es"])).toEqual({
      kind: "customSome",
      languages: ["es"],
    });
    expect(summarizeEmail([...both], ["en"])).toEqual({
      kind: "customSome",
      languages: ["en"],
    });
  });
  test("a message sent in Spanish only is custom when its Spanish is, never 'some'", () => {
    expect(summarizeEmail(["es"], ["es"])).toEqual({
      kind: "custom",
      languages: ["es"],
    });
    expect(summarizeEmail(["es"], [])).toEqual({
      kind: "default",
      languages: [],
    });
  });
});

describe("summarizeWhatsApp: what the languages of one message do together", () => {
  const ok = (name = "plantilla") =>
    ({ kind: "configured", templateName: name }) as const;
  const state = (
    es: Parameters<typeof summarizeWhatsApp>[0]["es"],
    en: Parameters<typeof summarizeWhatsApp>[0]["en"],
  ) => summarizeWhatsApp({ es, en });

  test("nothing configured in either: nothing is sent", () => {
    expect(state({ kind: "none" }, { kind: "none" })).toEqual({
      level: "none",
      configured: [],
      problems: [],
      unknown: [],
      off: [],
    });
  });
  test("both configured: configured", () => {
    expect(state(ok(), ok()).level).toBe("all");
    expect(state(ok(), ok()).configured).toEqual(["es", "en"]);
  });
  test("one configured: configured, naming it", () => {
    expect(state(ok(), { kind: "none" })).toMatchObject({
      level: "some",
      configured: ["es"],
    });
    expect(state({ kind: "none" }, ok())).toMatchObject({
      level: "some",
      configured: ["en"],
    });
  });
  test("a template that no longer works is a problem with its language, and does not count as configured", () => {
    const out = state(
      { kind: "invalid", issue: "not_approved" } as never,
      ok(),
    );
    expect(out.problems).toEqual([{ locale: "es", issue: "not_approved" }]);
    expect(out.configured).toEqual(["en"]);
    expect(out.level).toBe("some");
  });
  test("problems in both languages are both said", () => {
    const out = state(
      { kind: "invalid", issue: "paused" } as never,
      { kind: "invalid", issue: "dynamic_url" } as never,
    );
    expect(out.problems.map((p) => p.locale)).toEqual(["es", "en"]);
    expect(out.level).toBe("none");
  });
  test("a template list that could not be read is unknown for the languages that have one saved", () => {
    const out = state({ kind: "unknown" }, { kind: "none" });
    expect(out.unknown).toEqual(["es"]);
    expect(out.level).toBe("none");
  });
  test("a row switched off is said with its language", () => {
    expect(state({ kind: "none" }, { kind: "off" }).off).toEqual(["en"]);
  });
});

describe("the rows of the list", () => {
  test("an email row says which languages are the admin's, the most recent save, and who made it", () => {
    const out = emailRows(
      messageListRows(
        [
          row({
            key: "booking_confirmed",
            locale: "es",
            subject: "Mío",
            updated_at: "2026-11-16T10:00:00Z",
            updated_by_name: "Ana",
          } as never),
          row({
            key: "booking_confirmed",
            locale: "en",
            subject: "Mine",
            updated_at: "2026-11-17T10:00:00Z",
            updated_by_name: "Luis",
          } as never),
        ],
        catalog,
        [],
      ),
    );
    const r = out.find((x) => x.key === "booking_confirmed")!;
    expect(r.status).toEqual({ kind: "custom", languages: ["es", "en"] });
    expect(r.updatedAt).toBe("2026-11-17T10:00:00Z");
    expect(r.updatedByName).toBe("Luis");
  });

  test("only Spanish edited: some, and the save is that one's", () => {
    const r = emailRows(
      messageListRows(
        [row({ key: "booking_received", subject: "Mío" })],
        catalog,
        [],
      ),
    ).find((x) => x.key === "booking_received")!;
    expect(r.status).toEqual({ kind: "customSome", languages: ["es"] });
    expect(r.updatedAt).toBe("2026-11-17T10:00:00Z");
  });

  test("a default message has no save to show", () => {
    const r = emailRows(messageListRows([], catalog, [])).find(
      (x) => x.key === "booking_received",
    )!;
    expect(r).toMatchObject({
      status: { kind: "default" },
      updatedAt: null,
      updatedByName: null,
      corrupt: [],
      off: false,
    });
  });

  test("an unreadable language is said with its name, and is not counted as edited", () => {
    const r = emailRows(
      messageListRows(
        [row({ key: "booking_cancelled", locale: "en", corrupt: true })],
        catalog,
        [],
      ),
    ).find((x) => x.key === "booking_cancelled")!;
    expect(r.corrupt).toEqual(["en"]);
    expect(r.status.kind).toBe("default");
  });

  test("the reminder switched off, and the note that it goes in Spanish", () => {
    const r = emailRows(
      messageListRows(
        [row({ key: "booking_reminder", enabled: false })],
        catalog,
        [],
      ),
    ).find((x) => x.key === "booking_reminder")!;
    expect(r).toMatchObject({
      off: true,
      reminderNote: true,
      status: { kind: "default" },
    });
    const other = emailRows(messageListRows([], catalog, [])).find(
      (x) => x.key === "booking_confirmed",
    )!;
    expect(other.reminderNote).toBe(false);
  });

  test("a WhatsApp row says whether anything is saved in any language, and what each language does", () => {
    const out = waRows(
      messageListRows(
        [
          row({
            key: "booking_confirmed",
            channel: "whatsapp",
            locale: "es",
            whatsapp_template_id: "t1",
          } as never),
        ],
        catalog,
        null,
      ),
    );
    const r = out.find((x) => x.key === "booking_confirmed")!;
    expect(r.saved).toBe(true);
    expect(r.summary.unknown).toEqual(["es"]);
    const none = waRows(messageListRows([], catalog, [])).find(
      (x) => x.key === "booking_confirmed",
    )!;
    expect(none.saved).toBe(false);
    expect(none.summary.level).toBe("none");
  });

  test("an email row never reads a WhatsApp row of the same message, nor the other way round", () => {
    const out = messageListRows(
      [
        row({
          key: "booking_confirmed",
          channel: "whatsapp",
          subject: "x",
        } as never),
      ],
      catalog,
      [],
    );
    expect(
      emailRows(out).find((r) => r.key === "booking_confirmed")!.status.kind,
    ).toBe("default");
  });
});
