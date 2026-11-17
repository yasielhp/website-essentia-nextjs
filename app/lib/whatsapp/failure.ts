/**
 * What a failed WhatsApp delivery tells us, in terms we can act on.
 *
 * Pure, so the webhook only reads and writes.
 */

/**
 * - `unreachable`: the number will not receive messages (no WhatsApp, terms not
 *   accepted, outdated app). Worth remembering, so no campaign tries it again.
 * - `transient`: a limit on our side or Meta's (marketing frequency cap, spam
 *   limit, rate limits, generic error). The number itself is fine.
 * - `other`: anything else, including no code at all. Nothing is concluded.
 */
export type MetaFailureKind = "unreachable" | "transient" | "other";

const UNREACHABLE = new Set([131026]);
const TRANSIENT = new Set([131049, 131048, 130429, 131056, 131000]);

export function metaFailureKind(code: unknown): MetaFailureKind {
  const n =
    typeof code === "number"
      ? code
      : typeof code === "string" && code.trim() !== ""
        ? Number(code)
        : Number.NaN;
  if (UNREACHABLE.has(n)) return "unreachable";
  if (TRANSIENT.has(n)) return "transient";
  return "other";
}

/** One entry of Meta's `statuses[].errors`. */
export type MetaFailure = {
  code?: number;
  title?: string;
  message?: string;
  error_data?: { details?: string };
};

/**
 * The most a failure may weigh once written down. The text lands in
 * `campaign_recipients.error`, and Meta's wording can repeat what the customer
 * wrote, so it is kept short on purpose: do not raise it.
 */
const MAX_FAILURE_LENGTH = 300;

/**
 * `"<code>: <details>"` for the log of a failed message, the details being the
 * most specific text Meta sent, cut to `MAX_FAILURE_LENGTH`. Never empty, so a
 * failure always shows a reason.
 */
export function describeMetaFailure(failure: MetaFailure | undefined): string {
  const text = [
    failure?.error_data?.details,
    failure?.message,
    failure?.title,
  ].find((value): value is string => typeof value === "string" && value !== "");
  const code =
    typeof failure?.code === "number" || typeof failure?.code === "string"
      ? String(failure.code)
      : null;
  const described =
    code && text ? `${code}: ${text}` : (code ?? text ?? "WhatsApp error");
  if (described.length <= MAX_FAILURE_LENGTH) return described;
  const cut = described.slice(0, MAX_FAILURE_LENGTH);
  // A cut through the middle of an emoji would leave half of it behind, which
  // the database may refuse.
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}
