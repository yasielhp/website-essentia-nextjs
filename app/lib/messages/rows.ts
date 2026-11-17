import { MESSAGE_KEYS } from "./catalog";
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

const MAX_DEPTH = 200;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A node with a type and, if it has children, a list of nodes. */
function wellFormedNode(node: unknown, depth: number): boolean {
  if (depth > MAX_DEPTH || !isRecord(node)) return false;
  if (typeof node.type !== "string") return false;
  if (node.content === undefined) return true;
  if (!Array.isArray(node.content)) return false;
  return node.content.every((child) => wellFormedNode(child, depth + 1));
}

function wellFormedDoc(doc: unknown): boolean {
  return (
    isRecord(doc) &&
    doc.type === "doc" &&
    Array.isArray(doc.content) &&
    doc.content.every((child) => wellFormedNode(child, 1))
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
    const corrupt = hasDoc && !wellFormedDoc(item.doc);
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
