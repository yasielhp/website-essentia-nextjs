/**
 * Whether a click on a link should be stopped to ask about unsaved changes,
 * over plain values from the event and the page.
 *
 * Only a plain click on a link that stays inside the app is ours: a link to
 * another site is left to the browser's own `beforeunload` question, and one
 * opened in a new tab or window leaves this page exactly as it is. What this
 * cannot see is the browser's back and forward buttons and a navigation that
 * code starts: those are not clicks.
 */
export type ClickFacts = {
  href: string | null;
  origin: string;
  currentPath: string;
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: string | null;
  download: boolean;
  defaultPrevented: boolean;
};

export type GuardDecision = { guard: false } | { guard: true; to: string };

export function shouldGuardClick(facts: ClickFacts): GuardDecision {
  const no: GuardDecision = { guard: false };
  if (!facts.href || facts.defaultPrevented) return no;
  if (facts.button !== 0) return no;
  if (facts.ctrlKey || facts.metaKey || facts.shiftKey || facts.altKey) {
    return no;
  }
  if (facts.download) return no;
  if (facts.target && facts.target !== "_self") return no;

  let url: URL;
  try {
    // Relative links (`#anchor`, `?x`) resolve against this page, not the root.
    url = new URL(facts.href, `${facts.origin}${facts.currentPath}`);
  } catch {
    return no;
  }
  if (url.origin !== facts.origin) return no;
  // The same page, or a place in it: nothing is left.
  if (url.pathname === facts.currentPath && url.search === "") return no;
  return { guard: true, to: `${url.pathname}${url.search}${url.hash}` };
}
