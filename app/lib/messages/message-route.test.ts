import { describe, expect, test } from "bun:test";
import {
  MESSAGES_ANCHOR,
  MESSAGES_PATH,
  SETTINGS_PATH,
  WHATSAPP_TEMPLATES_ANCHOR,
  whatsappTemplatesHref,
  messageEditHref,
  messageListHref,
  messageRowLabel,
  parseMessageRoute,
} from "./message-route";
import { MESSAGE_KEYS } from "./catalog";
import { WHATSAPP_MESSAGE_KEYS } from "./whatsapp-row";

describe("parseMessageRoute", () => {
  test("every message of the catalogue is an email page, in both languages but the reminder's", () => {
    for (const key of MESSAGE_KEYS) {
      const locales: ("es" | "en")[] =
        key === "booking_reminder" ? ["es"] : ["es", "en"];
      for (const locale of locales) {
        expect(parseMessageRoute("email", key, locale)).toEqual({
          ok: true,
          channel: "email",
          key,
          locale,
        });
      }
    }
  });
  test("the reminder has no English page", () => {
    expect(parseMessageRoute("email", "booking_reminder", "en")).toEqual({
      ok: false,
    });
  });
  test("a key that is not in the catalogue, or a language that is not one, is not a page", () => {
    expect(parseMessageRoute("email", "nope", "es")).toEqual({ ok: false });
    expect(parseMessageRoute("email", "booking_confirmed", "fr")).toEqual({
      ok: false,
    });
    expect(parseMessageRoute("email", "booking_confirmed", "ES")).toEqual({
      ok: false,
    });
    expect(parseMessageRoute("email", "", "")).toEqual({ ok: false });
    expect(parseMessageRoute("email", "__proto__", "es")).toEqual({
      ok: false,
    });
    expect(parseMessageRoute("email", "constructor", "es")).toEqual({
      ok: false,
    });
  });
  test("only the messages that go out on WhatsApp have a WhatsApp page", () => {
    for (const key of MESSAGE_KEYS) {
      const out = parseMessageRoute("whatsapp", key, "es");
      expect(out.ok).toBe(WHATSAPP_MESSAGE_KEYS.includes(key));
    }
    expect(parseMessageRoute("whatsapp", "booking_reminder", "es")).toEqual({
      ok: false,
    });
    expect(parseMessageRoute("whatsapp", "booking_confirmed", "en")).toEqual({
      ok: true,
      channel: "whatsapp",
      key: "booking_confirmed",
      locale: "en",
    });
  });
  test("an unknown channel is not a page", () => {
    expect(parseMessageRoute("sms", "booking_confirmed", "es")).toEqual({
      ok: false,
    });
  });
});

describe("hrefs", () => {
  test("a row's link is its own page, and the key and language are what the page parses back", () => {
    for (const key of MESSAGE_KEYS) {
      const href = messageEditHref("email", key, "es");
      expect(href).toBe(`/dashboard/settings/messages/email/${key}/es`);
      const [, , , , channel, k, locale] = href.split("/");
      expect(parseMessageRoute(channel, k, locale)).toMatchObject({
        ok: true,
        key,
      });
    }
    expect(messageEditHref("whatsapp", "booking_paid", "en")).toBe(
      "/dashboard/settings/messages/whatsapp/booking_paid/en",
    );
  });
  test("the list and the templates are cards of Settings, found by their anchor; a message's own page is under Settings", () => {
    expect(SETTINGS_PATH).toBe("/dashboard/settings");
    expect(MESSAGES_PATH).toBe("/dashboard/settings/messages");
    expect(MESSAGES_ANCHOR).toBe("settings-messages");
    expect(WHATSAPP_TEMPLATES_ANCHOR).toBe("settings-whatsapp-templates");
    expect(whatsappTemplatesHref()).toBe(
      "/dashboard/settings#settings-whatsapp-templates",
    );
  });
  test("the way back is the card of automatic messages in Settings", () => {
    expect(messageListHref()).toBe("/dashboard/settings#settings-messages");
  });
});

describe("messageRowLabel", () => {
  test("is the message, with no language: that is chosen on its page", () => {
    expect(messageRowLabel("Reserva confirmada")).toBe("Reserva confirmada");
  });
  test("the WhatsApp notice says so after the name", () => {
    expect(messageRowLabel("Reserva confirmada", "WhatsApp")).toBe(
      "Reserva confirmada · WhatsApp",
    );
  });
});
