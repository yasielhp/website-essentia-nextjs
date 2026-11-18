import { MESSAGE_KEYS, type MessageKey } from "./catalog";
import { editableLocales } from "./editor-state";
import {
  isSwitchedOff,
  rowHasText,
  summarizeSwitch,
  type SwitchSummary,
} from "./reminder-switch";
import type { MessageCatalogEntry, MessageTemplateRowView } from "./types";
import {
  WHATSAPP_MESSAGE_KEYS,
  whatsappRowState,
  type SavedWhatsAppRow,
  type WhatsAppRowState,
} from "./whatsapp-row";
import type { WhatsAppTemplateRow } from "@/lib/whatsapp/types";

/**
 * What the list of messages shows, one entry per row, over plain values. Both
 * presentations (the table on a wide screen, the cards on a phone) draw from
 * this one list, so they cannot disagree about which rows exist, in which order
 * or what each says; the components only decide how to lay it out.
 */

type Locale = "es" | "en";

/** What the languages of one email message say together. */
export type EmailStatusSummary = {
  /**
   * `default`: none is the admin's. `custom`: every language the message is sent
   * in is. `customSome`: only the ones in `languages`, named in the message's own order.
   */
  kind: "default" | "custom" | "customSome";
  languages: Locale[];
};

export function summarizeEmail(
  locales: Locale[],
  custom: Locale[],
): EmailStatusSummary {
  const edited = locales.filter((l) => custom.includes(l));
  if (edited.length === 0) return { kind: "default", languages: [] };
  return {
    kind: edited.length === locales.length ? "custom" : "customSome",
    languages: edited,
  };
}

export type EmailListRow = {
  type: "email";
  id: string;
  key: MessageKey;
  /** The languages the message is sent in. */
  locales: Locale[];
  status: EmailStatusSummary;
  /** The languages whose saved text cannot be read. */
  corrupt: Locale[];
  /** The switch of the row: both languages together. */
  switch: SwitchSummary;
  /** The most recent save among the admin's own texts, and who made it. */
  updatedAt: string | null;
  updatedByName: string | null;
  /** The reminder says it is always sent in Spanish. */
  reminderNote: boolean;
};

/** What the languages of one WhatsApp message do together. */
export type WhatsAppSummary = {
  /** How many of the languages are set up and sendable: none, some or all. */
  level: "none" | "some" | "all";
  configured: Locale[];
  /** A template that no longer works, with the language it was chosen for. */
  problems: { locale: Locale; issue: string }[];
  /** A saved template that cannot be judged because the templates could not be read. */
  unknown: Locale[];
};

export function summarizeWhatsApp(
  states: Record<Locale, WhatsAppRowState>,
): WhatsAppSummary {
  const order: Locale[] = ["es", "en"];
  const configured = order.filter((l) => states[l].kind === "configured");
  return {
    level:
      configured.length === 0
        ? "none"
        : configured.length === order.length
          ? "all"
          : "some",
    configured,
    problems: order.flatMap((locale) => {
      const state = states[locale];
      return state.kind === "invalid" ? [{ locale, issue: state.issue }] : [];
    }),
    unknown: order.filter((l) => states[l].kind === "unknown"),
  };
}

export type WhatsAppListRow = {
  type: "whatsapp";
  id: string;
  key: MessageKey;
  locales: Locale[];
  summary: WhatsAppSummary;
  /** The switch of the row: both languages together, whether or not it is set up. */
  switch: SwitchSummary;
  /** There is a saved row in some language, even if it cannot be sent: the link says "Edit". */
  saved: boolean;
  /**
   * A template is saved in some language (whether or not it can be sent). With
   * none the row is not set up, and its switch is drawn off and cannot be
   * pressed: there is nothing to switch on. Only how it is drawn: nothing is
   * written to say so.
   */
  hasTemplate: boolean;
};

export type ListRow = EmailListRow | WhatsAppListRow;

export function messageListRows(
  rows: MessageTemplateRowView[],
  _catalog: Pick<MessageCatalogEntry, "key">[],
  templates: WhatsAppTemplateRow[] | null,
): ListRow[] {
  return MESSAGE_KEYS.flatMap((key): ListRow[] => {
    const locales = editableLocales(key);
    const found = locales.map((locale) => {
      const row = rows.find(
        (r) => r.channel === "email" && r.key === key && r.locale === locale,
      );
      const corrupt = row?.corrupt === true;
      return { locale, row, corrupt, custom: !corrupt && rowHasText(row) };
    });
    const custom = found.filter((f) => f.custom);
    // The most recent save among the texts that are the admin's own.
    const latest = [...custom].sort((a, b) =>
      (b.row?.updated_at ?? "").localeCompare(a.row?.updated_at ?? ""),
    )[0];
    const email: EmailListRow = {
      type: "email",
      id: `${key}:email`,
      key,
      locales,
      status: summarizeEmail(
        locales,
        custom.map((f) => f.locale),
      ),
      corrupt: found.filter((f) => f.corrupt).map((f) => f.locale),
      switch: summarizeSwitch(
        locales,
        found.filter((f) => isSwitchedOff(f.row)).map((f) => f.locale),
      ),
      updatedAt: latest?.row?.updated_at ?? null,
      updatedByName: latest?.row?.updated_by_name ?? null,
      reminderNote: key === "booking_reminder",
    };
    if (!WHATSAPP_MESSAGE_KEYS.includes(key)) return [email];

    const saved = (locale: Locale) =>
      rows.find(
        (r) => r.channel === "whatsapp" && r.key === key && r.locale === locale,
      );
    const states = {
      es: whatsappRowState(
        saved("es") as SavedWhatsAppRow | undefined,
        templates,
        "es",
      ),
      en: whatsappRowState(
        saved("en") as SavedWhatsAppRow | undefined,
        templates,
        "en",
      ),
    };
    return [
      email,
      {
        type: "whatsapp",
        id: `wa:${key}`,
        key,
        locales: ["es", "en"],
        summary: summarizeWhatsApp(states),
        switch: summarizeSwitch(
          ["es", "en"],
          (["es", "en"] as const).filter((l) => isSwitchedOff(saved(l))),
        ),
        saved: saved("es") !== undefined || saved("en") !== undefined,
        hasTemplate: Boolean(
          saved("es")?.whatsapp_template_id ||
          saved("en")?.whatsapp_template_id,
        ),
      },
    ];
  });
}
