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

/** The page where one message is edited (the email) or set up (the WhatsApp notice). */
export function messageEditHref(
  channel: MessageChannel,
  key: MessageKey,
  locale: MessageLocale,
): string {
  return `/dashboard/messages/${channel}/${key}/${locale}`;
}

/** The list, on the tab the page came from. */
export function messageListHref(): string {
  return "/dashboard/messages?tab=email";
}

/**
 * What the page is called in the crumbs: "Booking received", and for the
 * WhatsApp notice "Booking confirmed · WhatsApp". The language is chosen on the
 * page, so it is not part of the name.
 */
export function messageRowLabel(name: string, channelLabel?: string): string {
  return [name, channelLabel].filter(Boolean).join(" · ");
}
