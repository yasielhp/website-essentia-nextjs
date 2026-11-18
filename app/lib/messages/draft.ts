import type { WhatsAppParamSource } from "@/lib/whatsapp/types";
import { changedFields, type EmailFields } from "./editor-state";

/**
 * The local draft of a message page: what was typed and not yet saved, kept in
 * `sessionStorage` (one tab, gone when it closes) so that a back button or a
 * reload does not lose a long body. It lives only in the browser, holds only the
 * message's own text (with its `{{variables}}`, never a client's data) and is
 * never sent anywhere.
 *
 * Everything here is over plain values and a storage-shaped object, and every
 * access to the storage is guarded: private browsing, blocked or full storage
 * and a server render all mean "no draft", never an error.
 */

/** Past this the draft is not kept: a quota error is the browser's way of saying the same. */
export const MAX_DRAFT_BYTES = 500 * 1024;

// 2: the title became part of the document, so an earlier draft has no place here.
const VERSION = 2;

export type DraftKind = "email" | "whatsapp";

export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type WhatsAppDraft = {
  templateId: string | null;
  params: WhatsAppParamSource[];
};

export function draftKey(
  channel: DraftKind,
  key: string,
  locale: string,
): string {
  return `messages-draft:${channel}:${key}:${locale}`;
}

/** The draft as stored, or null when it is too big to keep. */
export function encodeDraft(kind: DraftKind, data: unknown): string | null {
  const raw = JSON.stringify({ v: VERSION, kind, data });
  return raw.length > MAX_DRAFT_BYTES ? null : raw;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** What was stored, if it is of this version and kind and `validate` accepts its data. */
export function decodeDraft<T>(
  raw: string | null,
  kind: DraftKind,
  validate: (data: unknown) => T | null,
): T | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(parsed) || parsed.v !== VERSION || parsed.kind !== kind) {
    return null;
  }
  return validate(parsed.data);
}

export function validateEmailDraft(data: unknown): EmailFields | null {
  if (!isObject(data)) return null;
  const { subject, preheader, doc } = data;
  if (typeof subject !== "string" || typeof preheader !== "string") {
    return null;
  }
  if (!isObject(doc) || doc.type !== "doc" || !Array.isArray(doc.content)) {
    return null;
  }
  return { subject, preheader, doc } as unknown as EmailFields;
}

export function validateWhatsAppDraft(data: unknown): WhatsAppDraft | null {
  if (!isObject(data)) return null;
  const { templateId, params } = data;
  if (templateId !== null && typeof templateId !== "string") return null;
  if (!Array.isArray(params)) return null;
  for (const source of params) {
    if (!isObject(source)) return null;
    const ok =
      (source.kind === "field" && typeof source.field === "string") ||
      (source.kind === "static" && typeof source.value === "string");
    if (!ok) return null;
  }
  return { templateId, params: params as WhatsAppParamSource[] };
}

/** The draft in storage, or null: none, unreadable, another version, or storage that fails. */
export function readDraft<T>(
  storage: DraftStorage | null,
  key: string,
  kind: DraftKind,
  validate: (data: unknown) => T | null,
): T | null {
  try {
    return storage ? decodeDraft(storage.getItem(key), kind, validate) : null;
  } catch {
    return null;
  }
}

/** Keeps the draft; false when it was not kept (too big, or storage that fails). */
export function writeDraft(
  storage: DraftStorage | null,
  key: string,
  kind: DraftKind,
  data: unknown,
): boolean {
  if (!storage) return false;
  const raw = encodeDraft(kind, data);
  try {
    if (raw === null) {
      // Too big to keep: an older, smaller draft would now be stale.
      storage.removeItem(key);
      return false;
    }
    storage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(storage: DraftStorage | null, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // Nothing to clear if the storage is not there.
  }
}

/** The tab's storage, or null where there is none (a server render, private mode, blocked). */
export function sessionDraftStorage(): DraftStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** The email draft worth offering: one that differs from what is saved. */
export function emailDraftOffer(
  draft: EmailFields | null,
  saved: EmailFields,
): EmailFields | null {
  if (!draft) return null;
  return Object.keys(changedFields(saved, draft)).length > 0 ? draft : null;
}

/** The WhatsApp draft worth offering: another template or other parameters than the saved. */
export function whatsappDraftOffer(
  draft: WhatsAppDraft | null,
  saved: WhatsAppDraft,
): WhatsAppDraft | null {
  if (!draft) return null;
  const same =
    draft.templateId === saved.templateId &&
    JSON.stringify(draft.params) === JSON.stringify(saved.params);
  return same ? null : draft;
}
