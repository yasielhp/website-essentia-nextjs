/**
 * Pure helpers over the text of a Meta template body.
 *
 * Meta's rules that matter here, from the template guidelines: placeholders
 * are `{{1}}`…`{{n}}`, consecutive from 1; a body may not start or end with
 * one; and every placeholder needs an example value to be reviewed.
 */

const PLACEHOLDER = /\{\{(\d+)\}\}/g;

export function countParams(body: string): number {
  let max = 0;
  for (const match of body.matchAll(PLACEHOLDER)) {
    max = Math.max(max, Number(match[1]));
  }
  return max;
}

export type ParamIssue = "paramGap" | "paramAtEdge";

export function paramIssues(body: string): ParamIssue[] {
  const issues: ParamIssue[] = [];
  const seen = new Set<number>();
  for (const match of body.matchAll(PLACEHOLDER)) seen.add(Number(match[1]));
  const max = countParams(body);
  for (let i = 1; i <= max; i += 1) {
    if (!seen.has(i)) {
      issues.push("paramGap");
      break;
    }
  }
  const trimmed = body.trim();
  if (/^\{\{\d+\}\}/.test(trimmed) || /\{\{\d+\}\}$/.test(trimmed)) {
    issues.push("paramAtEdge");
  }
  return issues;
}

/** The body with the values in; an index with no value keeps its `{{n}}`. */
export function renderPreview(body: string, values: string[]): string {
  return body.replace(PLACEHOLDER, (whole, n: string) => {
    const value = values[Number(n) - 1];
    return value === undefined || value === "" ? whole : value;
  });
}
