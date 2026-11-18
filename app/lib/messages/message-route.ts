import { MESSAGE_KEYS, type MessageKey } from "./catalog";
import { editableLocales } from "./editor-state";
import { WHATSAPP_MESSAGE_KEYS } from "./whatsapp-row";

/**
 * The address of a message's own page, over plain values: which pages exist,
 * where a row's link goes and what the page is called. The route segments come
 * from the URL, so everything is checked here and nothing is trusted: a key or
 * a language that is not one is no page at all.
 */

export type MessageChannel = "email" | "whatsapp";
export type MessageLocale = "es" | "en";

export type MessageRoute =
  | {
      ok: true;
      channel: MessageChannel;
      key: MessageKey;
      locale: MessageLocale;
    }
  | { ok: false };

const BAD: MessageRoute = { ok: false };

export function parseMessageRoute(
  channel: string,
  key: string,
  locale: string,
): MessageRoute {
  if (channel !== "email" && channel !== "whatsapp") return BAD;
  // `includes` on a list, not a lookup in an object: "constructor" is no key.
  const messageKey = MESSAGE_KEYS.find((candidate) => candidate === key);
  if (!messageKey) return BAD;
  const language = editableLocales(messageKey).find((l) => l === locale);
  if (!language) return BAD;
  if (channel === "whatsapp" && !WHATSAPP_MESSAGE_KEYS.includes(messageKey)) {
    return BAD;
  }
  return { ok: true, channel, key: messageKey, locale: language };
}

/**
 * Messages live in Settings. The list of automatic messages and the WhatsApp
 * templates are two CARDS of the settings page, found by their anchor; each
 * message has a page of its own under it.
 */
export const SETTINGS_PATH = "/dashboard/settings";
export const MESSAGES_PATH = "/dashboard/settings/messages";
/** The ids of the two cards (`SettingsCard` writes `settings-<id>`). */
export const MESSAGES_ANCHOR = "settings-messages";
export const WHATSAPP_TEMPLATES_ANCHOR = "settings-whatsapp-templates";

/** The WhatsApp templates card of Settings. */
export function whatsappTemplatesHref(): string {
  return `${SETTINGS_PATH}#${WHATSAPP_TEMPLATES_ANCHOR}`;
}

/** The page where one message is edited (the email) or set up (the WhatsApp notice). */
export function messageEditHref(
  channel: MessageChannel,
  key: MessageKey,
  locale: MessageLocale,
): string {
  return `${MESSAGES_PATH}/${channel}/${key}/${locale}`;
}

/** The list: the automatic messages card of Settings, which every message page comes from. */
export function messageListHref(): string {
  return `${SETTINGS_PATH}#${MESSAGES_ANCHOR}`;
}

/**
 * What the page is called in the crumbs: "Booking received", and for the
 * WhatsApp notice "Booking confirmed · WhatsApp". The language is chosen on the
 * page, so it is not part of the name.
 */
export function messageRowLabel(name: string, channelLabel?: string): string {
  return [name, channelLabel].filter(Boolean).join(" · ");
}
