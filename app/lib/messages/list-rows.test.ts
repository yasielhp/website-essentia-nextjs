import { describe, expect, test } from "bun:test";
import { MESSAGE_CATALOG, MESSAGE_KEYS } from "./catalog";
import { messageListRows, type WhatsAppListRow } from "./list-rows";
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

describe("messageListRows", () => {
  const rows = messageListRows([], catalog, []);

  test("one email row per message and language the system sends, in the catalogue's order", () => {
    const email = rows.filter((r) => r.type === "email");
    const expected = MESSAGE_KEYS.flatMap((key) =>
      (key === "booking_reminder" ? ["es"] : ["es", "en"]).map(
        (locale) => `${key}:${locale}`,
      ),
    );
    expect(email.map((r) => r.id)).toEqual(expected);
  });

  test("the messages that go out on WhatsApp get a row per language, right after their email rows, and nothing else", () => {
    for (const key of MESSAGE_KEYS) {
      const at = rows.findIndex(
        (r) => r.id === `${key}:es` || r.id === `${key}:en`,
      );
      const wa = rows.filter(
        (r): r is WhatsAppListRow => r.type === "whatsapp" && r.key === key,
      );
      if (WHATSAPP_MESSAGE_KEYS.includes(key)) {
        expect(wa.map((r) => r.locale)).toEqual(["es", "en"]);
        expect(rows.indexOf(wa[0])).toBeGreaterThan(at);
      } else {
        expect(wa).toHaveLength(0);
      }
    }
  });

  test("a row is an email row or a WhatsApp row: the list carries no notes between them", () => {
    expect(new Set(rows.map((r) => r.type))).toEqual(
      new Set(["email", "whatsapp"]),
    );
  });

  test("every row has an id of its own, so a list can key on it", () => {
    const ids = rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("a default row, a custom one, a corrupt one and a switched-off reminder read as what they are", () => {
    const out = messageListRows(
      [
        row({ key: "booking_confirmed", subject: "Mío" }),
        row({ key: "booking_cancelled", corrupt: true }),
        row({ key: "booking_reminder", enabled: false }),
      ],
      catalog,
      [],
    );
    const at = (id: string) => out.find((r) => r.id === id);
    expect(at("booking_received:es")).toMatchObject({
      custom: false,
      corrupt: false,
      off: false,
    });
    expect(at("booking_confirmed:es")).toMatchObject({
      custom: true,
      off: false,
      updatedAt: "2026-11-17T10:00:00Z",
    });
    expect(at("booking_cancelled:es")).toMatchObject({
      custom: false,
      corrupt: true,
    });
    expect(at("booking_reminder:es")).toMatchObject({
      custom: false,
      off: true,
      reminderNote: true,
    });
    expect(at("booking_confirmed:es")).toMatchObject({ reminderNote: false });
  });

  test("a WhatsApp row says whether anything is saved, and what it does", () => {
    const out = messageListRows(
      [
        row({
          key: "booking_confirmed",
          channel: "whatsapp",
          whatsapp_template_id: "t1",
        }),
      ],
      catalog,
      null,
    );
    const saved = out.find((r) => r.id === "wa:booking_confirmed:es");
    expect(saved).toMatchObject({
      type: "whatsapp",
      saved: true,
      state: { kind: "unknown" },
    });
    expect(out.find((r) => r.id === "wa:booking_confirmed:en")).toMatchObject({
      saved: false,
      state: { kind: "none" },
    });
  });

  test("an email row never reads a WhatsApp row of the same message, nor the other way round", () => {
    const out = messageListRows(
      [row({ key: "booking_confirmed", channel: "whatsapp", subject: "x" })],
      catalog,
      [],
    );
    expect(out.find((r) => r.id === "booking_confirmed:es")).toMatchObject({
      custom: false,
    });
  });
});
