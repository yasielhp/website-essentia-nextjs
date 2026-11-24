/**
 * Pure helpers behind the WhatsApp templates screen: how a state looks, what
 * to call a replacement for a rejected template, and which rows to doubt.
 *
 * They live outside the components so a test can reach them, and so the
 * exhaustive maps below make the compiler (and the i18n test) notice the day a
 * state is added to `WhatsAppTemplateStatus`.
 */

import type {
  WhatsAppTemplateStatus,
  WhatsAppTemplateUnsupportedReason,
} from "@/lib/whatsapp/types";

export type StatusTone = "neutral" | "success" | "warning" | "danger";

/** Every state a row can hold; a missing one here is a type error. */
const STATUS_TONE: Record<WhatsAppTemplateStatus, StatusTone> = {
  draft: "neutral",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  PAUSED: "warning",
  DISABLED: "danger",
  IN_APPEAL: "warning",
  PENDING_DELETION: "warning",
  DELETED: "neutral",
  LIMIT_EXCEEDED: "warning",
  ARCHIVED: "neutral",
  LOCKED: "danger",
  FLAGGED: "warning",
};

export const TEMPLATE_STATUSES = Object.keys(
  STATUS_TONE,
) as WhatsAppTemplateStatus[];

/**
 * The tone of a state. The column is text, so a state Meta adds tomorrow
 * reaches the screen before the code knows it: it gets the neutral tone
 * instead of `undefined`, and the caller shows the raw word.
 */
export function statusTone(status: string): StatusTone {
  return Object.hasOwn(STATUS_TONE, status)
    ? STATUS_TONE[status as WhatsAppTemplateStatus]
    : "neutral";
}

const UNSUPPORTED: Record<WhatsAppTemplateUnsupportedReason, true> = {
  media_header: true,
  header_variable: true,
  named_params: true,
  button_type: true,
};

export const UNSUPPORTED_REASONS = Object.keys(
  UNSUPPORTED,
) as WhatsAppTemplateUnsupportedReason[];

/** Meta's limit for a template name. */
const MAX_NAME = 512;

/**
 * A name for the rewritten copy of a rejected template: Meta will not take the
 * same name and language again. `x` becomes `x_v2`, `x_v2` becomes `x_v3`, and
 * a name already in `taken` is stepped over.
 */
export function nextTemplateName(
  name: string,
  taken: Iterable<string>,
): string {
  const used = new Set(taken);
  const base = name.replace(/_v\d+$/, "");
  for (let n = 2; ; n += 1) {
    const suffix = `_v${n}`;
    const candidate = `${base.slice(0, MAX_NAME - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** When the newest sync ran, in ms, or null if none ever did. */
export function latestSync(
  templates: { synced_at: string | null }[],
): number | null {
  let latest: number | null = null;
  for (const { synced_at } of templates) {
    if (!synced_at) continue;
    const ms = Date.parse(synced_at);
    if (!Number.isNaN(ms) && (latest === null || ms > latest)) latest = ms;
  }
  return latest;
}

/** How long ago the copy was brought, in the unit a person would say it in. */
export type SyncAge =
  | { kind: "justNow" }
  | { kind: "ago"; value: number; unit: "minute" | "hour" | "day" };

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Whole minutes under an hour, whole hours under a day, whole days after that,
 * each rounded DOWN (3 min 40 s is "3 min": the line never says more time has
 * passed than has). Under a minute, or a moment in the future (the browser's
 * clock a little behind the server's), is "a moment ago". Pure.
 */
export function syncAge(syncMs: number, nowMs: number): SyncAge {
  const age = nowMs - syncMs;
  if (age < MINUTE_MS) return { kind: "justNow" };
  if (age < HOUR_MS) {
    return { kind: "ago", value: Math.floor(age / MINUTE_MS), unit: "minute" };
  }
  if (age < DAY_MS) {
    return { kind: "ago", value: Math.floor(age / HOUR_MS), unit: "hour" };
  }
  return { kind: "ago", value: Math.floor(age / DAY_MS), unit: "day" };
}

/**
 * Whether a row deserves a "last synced" note: Meta may have deleted it.
 *
 * A sync upserts every template Meta lists, so a row it did not touch is one
 * Meta no longer has (or one in a category we skip). A row with no Meta id on
 * a configured account never reached Meta at all. A row submitted from here
 * and not yet synced has no `synced_at` and is fine until a sync passes it by.
 */
export function hasStaleSync(
  template: {
    meta_id: string | null;
    synced_at: string | null;
    updated_at: string;
  },
  lastSync: number | null,
  configured: boolean,
): boolean {
  if (!configured) return false;
  if (template.meta_id === null) return true;
  if (lastSync === null) return false;
  const touched = template.synced_at
    ? Date.parse(template.synced_at)
    : Date.parse(template.updated_at);
  return Number.isNaN(touched) ? false : touched < lastSync;
}
