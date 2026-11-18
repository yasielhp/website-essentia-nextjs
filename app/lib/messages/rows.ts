import type { EmailDoc } from "@/types/campaign";
import { MESSAGE_KEYS, type MessageKey } from "./catalog";
import { MAX_DOC_DEPTH, docDepth } from "./doc-depth";
import { structureProblems, withoutSpecialNodes } from "./email-doc";
import { findForbiddenNodes } from "./safe-doc";
import type { MessageTemplateRowView } from "./types";

/**
 * Saved rows as the dashboard list receives them.
 *
 * A row is data somebody (or something) wrote: one with a body that is not a
 * document must not take the whole list down, so it comes back with
 * `doc: null` and `corrupt: true` and the editor can say so. A row for a key,
 * channel or language the catalogue does not know (an old message, a stray
 * test row) is left out rather than shown under a name it does not have.
 * Pure.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A node with a type and, if it has children, a list of nodes. */
function wellFormedNode(node: unknown): boolean {
  if (!isRecord(node) || typeof node.type !== "string") return false;
  if (node.content === undefined) return true;
  return Array.isArray(node.content) && node.content.every(wellFormedNode);
}

/**
 * Whether a stored body is one this app would have saved and can show: a
 * document of well-formed nodes, no deeper than a save allows (checked first,
 * and without recursion, so the walk below is bounded), and nothing the
 * sanitiser refuses (raw HTML, an address that is not https, http or mailto),
 * read the way a save reads it (`withoutSpecialNodes`).
 * What is stored is not trusted just for having come from the database.
 */
function wellFormedDoc(doc: unknown, key: MessageKey): boolean {
  if (docDepth(doc) > MAX_DOC_DEPTH) return false;
  if (!isRecord(doc) || doc.type !== "doc" || !Array.isArray(doc.content)) {
    return false;
  }
  if (!doc.content.every(wellFormedNode)) return false;
  // The same reading a save makes: the title and the blocks of the system at the
  // top level are the document's own and are not the sanitiser's to judge; the
  // same nodes anywhere else still are, and are refused.
  if (findForbiddenNodes(withoutSpecialNodes(doc as EmailDoc)).length > 0) {
    return false;
  }
  // What is inside the title and the blocks is judged by their own rules: an
  // invented kind, a block with content or attributes, a title holding anything
  // but text and variables is not a body this app saved. A block that is
  // MISSING and an empty title are not: that is a document the editor opens
  // and answers with its alert, not a corrupt one.
  return !structureProblems(doc as EmailDoc, key).some(
    (problem) => problem.kind === "blockNotAllowed",
  );
}

const text = (value: unknown) => (typeof value === "string" ? value : null);

export function readRows(raw: unknown[]): MessageTemplateRowView[] {
  const keys = new Set<string>(MESSAGE_KEYS);
  const rows: MessageTemplateRowView[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const { key, channel, locale } = item;
    if (typeof key !== "string" || !keys.has(key)) continue;
    if (channel !== "email" && channel !== "whatsapp") continue;
    if (locale !== "en" && locale !== "es") continue;

    const hasDoc = item.doc !== null && item.doc !== undefined;
    const corrupt = hasDoc && !wellFormedDoc(item.doc, key as MessageKey);
    rows.push({
      key: key as MessageTemplateRowView["key"],
      channel,
      locale,
      enabled: item.enabled !== false,
      subject: text(item.subject),
      preheader: text(item.preheader),
      title: text(item.title),
      doc:
        hasDoc && !corrupt ? (item.doc as MessageTemplateRowView["doc"]) : null,
      whatsapp_template_id: text(item.whatsapp_template_id),
      whatsapp_params: Array.isArray(item.whatsapp_params)
        ? (item.whatsapp_params as MessageTemplateRowView["whatsapp_params"])
        : [],
      updated_at: text(item.updated_at) ?? "",
      ...(corrupt ? { corrupt: true } : {}),
    });
  }
  return rows;
}
