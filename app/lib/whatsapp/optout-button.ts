import { isOptOutText } from "./optout";

/**
 * What a quick-reply button's text will do when the client taps it.
 *
 * The webhook treats a tap as an unsubscribe only when the button's text is
 * EXACTLY one of the opt-out words (`isOptOutText`, the same rule as a typed
 * reply). A button that says «Darme de baja» or «Detener promociones» sends a
 * reply that is not one, and the client stays subscribed while believing she
 * left. So the form says it, without blocking the save: such a button can be
 * perfectly legitimate (a "manage my preferences" link, say).
 *
 *  - `optOut`: the text is an opt-out word; the tap unsubscribes.
 *  - `looksLikeOptOut`: it talks about unsubscribing but is not the exact word.
 *  - `plain`: anything else.
 *
 * Pure and free of server imports, so the form can read it.
 */
export type OptOutButtonKind = "optOut" | "looksLikeOptOut" | "plain";

const LOOKS_LIKE = ["baja", "stop", "unsubscribe", "darme de baja"];

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function optOutButtonKind(text: string): OptOutButtonKind {
  if (isOptOutText(text)) return "optOut";
  const folded = fold(text);
  return LOOKS_LIKE.some((word) => folded.includes(word))
    ? "looksLikeOptOut"
    : "plain";
}
