import type { EmailDoc } from "@/types/campaign";
import { docIsEmpty } from "@/lib/campaigns/doc";
import type { MessageKey } from "./catalog";

/**
 * What the email editor decides over plain values, with nothing of the editor
 * itself in it (Maily, the renderer and the validator stay on the server or in
 * their own component): which languages a message is edited in, what the editor
 * opens with, and what a save has to carry.
 */

/**
 * The languages a message is written in. Every one goes out in both, except
 * the reminder: the cron sends it in Spanish always, because a booking keeps no
 * language, so an English version could never reach anyone.
 */
export function editableLocales(key: MessageKey): ("es" | "en")[] {
  return key === "booking_reminder" ? ["es"] : ["es", "en"];
}

/** A variable that stands for an address, which the body can only use as a link. */
export const isLinkVariable = (name: string) => name.endsWith("_url");

/**
 * Whether two bodies say the same thing. The editor re-emits a document it was
 * given with attributes it fills in (a null alignment, an empty list of marks),
 * which are not a change, and the order of an object's keys is not one either.
 */
function canon(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canon);
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item === undefined || item === null) continue;
      if (Array.isArray(item) && item.length === 0 && key === "marks") continue;
      const inner = canon(item);
      // `attrs: {}` is what an attribute-less node looks like once its null
      // attributes are gone.
      if (key === "attrs" && Object.keys(inner as object).length === 0)
        continue;
      out[key] = inner;
    }
    return out;
  }
  return value;
}

const nothing = (doc: EmailDoc | null | undefined) => !doc || docIsEmpty(doc);

export function sameDoc(
  a: EmailDoc | null | undefined,
  b: EmailDoc | null | undefined,
): boolean {
  if (nothing(a) || nothing(b)) return nothing(a) && nothing(b);
  return JSON.stringify(canon(a)) === JSON.stringify(canon(b));
}

/** The four things an email message has to say. */
export type EmailFields = {
  subject: string;
  preheader: string;
  title: string;
  doc: EmailDoc;
};

type Saved = {
  subject: string | null;
  preheader: string | null;
  title: string | null;
  doc: EmailDoc | null;
};

const filled = (text: string | null) =>
  text !== null && text.trim() !== "" ? text : null;

/**
 * What the editor opens with: the admin's version field by field where there
 * is one, the default text otherwise. A body replaces the default one whole
 * (the default is intro and closing in a single document, because an edited
 * body takes the closing text with it).
 */
export function openingState(
  saved: Saved | null,
  defaults: EmailFields,
): EmailFields {
  return {
    subject: filled(saved?.subject ?? null) ?? defaults.subject,
    preheader: filled(saved?.preheader ?? null) ?? defaults.preheader,
    title: filled(saved?.title ?? null) ?? defaults.title,
    doc: saved?.doc && !nothing(saved.doc) ? saved.doc : defaults.doc,
  };
}

/** What a save carries: only what changed, and `null` where the admin emptied a field. */
export type EmailChanges = {
  subject?: string | null;
  preheader?: string | null;
  title?: string | null;
  doc?: EmailDoc | null;
};

/**
 * The fields of `current` that differ from what the editor opened with. The
 * server writes only what it is sent, so a field left alone is not sent, and
 * the default text never becomes the admin's by opening and closing the editor.
 */
export function changedFields(
  opened: EmailFields,
  current: EmailFields,
): EmailChanges {
  const changes: EmailChanges = {};
  for (const field of ["subject", "preheader", "title"] as const) {
    const was = opened[field].trim();
    const now = current[field].trim();
    if (was !== now) changes[field] = now === "" ? null : now;
  }
  if (!sameDoc(opened.doc, current.doc)) {
    changes.doc = nothing(current.doc) ? null : current.doc;
  }
  return changes;
}

export type DocErrorLine = { key: string; block: number | null };

/**
 * The problems a save found in the body, as lines a person can act on: what
 * kind, and which block of the body (counting from one) it is in. A path is
 * `doc.content.2.attrs.url`: the number after the first `content` is the
 * top-level block, whatever it is nested in.
 */
export function docErrorLines(
  fieldErrors: Record<string, string>,
): DocErrorLine[] {
  const lines: DocErrorLine[] = [];
  const seen = new Set<string>();
  for (const [path, key] of Object.entries(fieldErrors)) {
    if (path !== "doc" && !path.startsWith("doc.")) continue;
    const match = /^doc\.content\.(\d+)/.exec(path);
    const block = match ? Number(match[1]) + 1 : null;
    const id = `${key}:${block}`;
    if (seen.has(id)) continue;
    seen.add(id);
    lines.push({ key, block });
  }
  return lines;
}

/** `{{name}}`, as a variable is typed into a subject, a preheader or a title. */
export const variableToken = (name: string) => `{{${name}}}`;

/**
 * Puts `token` into `value` where the selection is (replacing what is
 * selected), and says where the caret goes after it. A selection that is
 * missing or out of range is the end of the text.
 */
export function insertAtSelection(
  value: string,
  start: number | null,
  end: number | null,
  token: string,
): { value: string; caret: number } {
  const from =
    start !== null && start >= 0 && start <= value.length
      ? start
      : value.length;
  const to = end !== null && end >= from && end <= value.length ? end : from;
  return {
    value: value.slice(0, from) + token + value.slice(to),
    caret: from + token.length,
  };
}

const LINK_BUTTON_TEXT: Record<"es" | "en", Record<string, string>> = {
  es: {
    cancel_url: "Cancelar mi cita",
    consent_url: "Firmar el consentimiento",
  },
  en: {
    cancel_url: "Cancel my appointment",
    consent_url: "Sign the consent form",
  },
};

/**
 * The button a link variable is inserted as. An address cannot sit in the body
 * as text, only behind something to press, so the variable becomes a button
 * whose address is that variable; the sender fills it in per client. The
 * wording follows the message's language, not the dashboard's.
 */
export function linkButtonNode(
  variable: string,
  locale: "es" | "en",
): EmailDoc {
  return {
    type: "button",
    attrs: {
      text: LINK_BUTTON_TEXT[locale][variable] ?? variable,
      isTextVariable: false,
      url: variable,
      isUrlVariable: true,
      alignment: "left",
      variant: "filled",
      borderRadius: "round",
      buttonColor: "#103838",
      textColor: "#ffffff",
    },
  };
}
