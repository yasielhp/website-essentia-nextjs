import { MESSAGE_KEYS, type MessageKey } from "./catalog";
import { editableLocales } from "./editor-state";
import { isSwitchedOff, rowHasText } from "./reminder-switch";
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

export type EmailListRow = {
  type: "email";
  id: string;
  key: MessageKey;
  locale: Locale;
  /** The admin's own text (a row that holds only the switch is not). */
  custom: boolean;
  corrupt: boolean;
  /** The reminder, switched off. */
  off: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
  /** The reminder says it is always sent in Spanish. */
  reminderNote: boolean;
};

export type WhatsAppListRow = {
  type: "whatsapp";
  id: string;
  key: MessageKey;
  locale: Locale;
  state: WhatsAppRowState;
  /** There is a saved row, even if it cannot be sent: the link says "Edit". */
  saved: boolean;
};

/** After the WhatsApp rows of a message: where the reminders are set up. */
export type NoteListRow = { type: "note"; id: string; key: MessageKey };

export type ListRow = EmailListRow | WhatsAppListRow | NoteListRow;

export function messageListRows(
  rows: MessageTemplateRowView[],
  catalog: Pick<MessageCatalogEntry, "key" | "canDisable">[],
  templates: WhatsAppTemplateRow[] | null,
): ListRow[] {
  return MESSAGE_KEYS.flatMap((key): ListRow[] => {
    const canDisable = Boolean(catalog.find((c) => c.key === key)?.canDisable);
    const email = editableLocales(key).map((locale): EmailListRow => {
      const row = rows.find(
        (r) => r.channel === "email" && r.key === key && r.locale === locale,
      );
      const corrupt = row?.corrupt === true;
      const custom = !corrupt && rowHasText(row);
      return {
        type: "email",
        id: `${key}:${locale}`,
        key,
        locale,
        custom,
        corrupt,
        off: isSwitchedOff(canDisable, row),
        updatedAt: custom ? (row?.updated_at ?? null) : null,
        updatedByName: custom ? (row?.updated_by_name ?? null) : null,
        reminderNote: key === "booking_reminder",
      };
    });
    if (!WHATSAPP_MESSAGE_KEYS.includes(key)) return email;

    const whatsapp = (["es", "en"] as const).map((locale): WhatsAppListRow => {
      const saved = rows.find(
        (r) => r.channel === "whatsapp" && r.key === key && r.locale === locale,
      );
      return {
        type: "whatsapp",
        id: `wa:${key}:${locale}`,
        key,
        locale,
        state: whatsappRowState(
          saved as SavedWhatsAppRow | undefined,
          templates,
          locale,
        ),
        saved: saved !== undefined,
      };
    });
    return [...email, ...whatsapp, { type: "note", id: `note:${key}`, key }];
  });
}
