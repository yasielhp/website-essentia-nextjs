/**
 * Pure helpers over the text of a Meta template body.
 *
 * Meta's rules that matter here, from the template guidelines: placeholders
 * are `{{1}}`…`{{n}}`, consecutive from 1; a body may not start or end with
 * one; and every placeholder needs an example value to be reviewed.
 *
 * Our own stricter policy on top of that: a placeholder is exactly `{{n}}`
 * with n an integer from 1 to 50, no leading zeros, no spaces, no text. Any
 * other `{{…}}` is malformed and is never counted nor substituted, so the
 * parameter count stays inside the `int` column and a stray `{{0}}` cannot
 * slip through to Meta.
 */

import type { WhatsAppTemplateUnsupportedReason } from "@/lib/whatsapp/types";

const MAX_PARAM = 50;

/**
 * Every `{{…}}` in the text. A function, not a constant: the `g` flag keeps
 * `lastIndex` state on a shared regex, which breaks `.test` and `.exec`.
 */
function tokens(): RegExp {
  return /\{\{([^{}]*)\}\}/g;
}

/** The index a `{{…}}` stands for, or null when it is malformed. */
function indexOf(inner: string): number | null {
  if (!/^[1-9]\d?$/.test(inner)) return null;
  const n = Number(inner);
  return n <= MAX_PARAM ? n : null;
}

/** The highest valid placeholder index, not how many there are. */
export function countParams(body: string): number {
  let max = 0;
  for (const match of body.matchAll(tokens())) {
    max = Math.max(max, indexOf(match[1]) ?? 0);
  }
  return max;
}

export type ParamIssue = "paramMalformed" | "paramGap" | "paramAtEdge";

/** What Meta, or our policy, would refuse in this body; empty when clean. */
export function paramIssues(body: string): ParamIssue[] {
  const issues: ParamIssue[] = [];
  const seen = new Set<number>();
  let malformed = false;
  for (const match of body.matchAll(tokens())) {
    const n = indexOf(match[1]);
    if (n === null) malformed = true;
    else seen.add(n);
  }
  if (malformed) issues.push("paramMalformed");

  const max = Math.max(0, ...seen);
  for (let i = 1; i <= max; i += 1) {
    if (!seen.has(i)) {
      issues.push("paramGap");
      break;
    }
  }

  const trimmed = body.trim();
  const all = [...trimmed.matchAll(tokens())];
  const first = all[0];
  const last = all[all.length - 1];
  const atStart =
    first !== undefined && first.index === 0 && indexOf(first[1]) !== null;
  const atEnd =
    last !== undefined &&
    last.index + last[0].length === trimmed.length &&
    indexOf(last[1]) !== null;
  if (atStart || atEnd) issues.push("paramAtEdge");
  return issues;
}

/**
 * The body with the values in; an index with no value (or an empty one) keeps
 * its `{{n}}`. One pass, so a value that looks like a placeholder is not
 * expanded again, and the replacer is a function so `$&` and friends in a
 * value stay literal.
 */
export function renderPreview(body: string, values: string[]): string {
  return body.replace(tokens(), (whole, inner: string) => {
    const n = indexOf(inner);
    if (n === null) return whole;
    const value = values[n - 1];
    return value === undefined || value === "" ? whole : value;
  });
}

/** The parts of a template that decide whether our client can send it. */
export type TemplateSupportInput = {
  /** `TEXT`, `IMAGE`, `VIDEO`… or null when there is no header. */
  headerFormat: string | null;
  headerText: string | null;
  body: string;
  /** The types of the buttons we cannot represent: neither URL nor quick reply. */
  unsupportedButtons: string[];
};

/**
 * Null when `sendTemplateMessage` can send this template, otherwise why not.
 *
 * Our client fills the body placeholders and the URL button suffixes, and
 * nothing else. A media header needs a file at send time, a header variable
 * needs a value, a named parameter is not `{{n}}`, and the other button kinds
 * carry data we never collect: Meta would refuse each of those sends. The first
 * reason that applies wins.
 */
export function templateSupport(
  template: TemplateSupportInput,
): WhatsAppTemplateUnsupportedReason | null {
  if (template.headerFormat !== null && template.headerFormat !== "TEXT") {
    return "media_header";
  }
  if (template.headerText?.includes("{{")) return "header_variable";
  if (paramIssues(template.body).includes("paramMalformed")) {
    return "named_params";
  }
  if (template.unsupportedButtons.length > 0) return "button_type";
  return null;
}
