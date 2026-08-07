import type { Metadata } from "next";

/**
 * Pages that exist but only say "Coming Soon".
 *
 * They were reachable, indexable and listed in the sitemap, and `llms.txt`
 * described them with prices and durations. Search engines indexed six thin
 * pages, and AI assistants recommended bookable services that turn out not to
 * exist — the worst outcome for a citation, since the promise is made and then
 * broken on arrival.
 *
 * One list, used by the pages themselves and by the sitemap, so a service
 * launching only has to be removed from here.
 */
export const UNLAUNCHED_ROUTES = [
  "/wellness/contrast-therapy",
  "/wellness/breathing-sessions",
  "/wellness/functional-wellbeing",
  "/wellness/red-light-therapy",
  "/medicine/hyperbaric-chambers",
  "/medicine/intravenous-therapy",
  "/medicine/regenerative-medicine",
  "/experiences/education-programs",
  "/experiences/running-club",
  "/shop",
] as const;

export function isUnlaunched(path: string): boolean {
  return (UNLAUNCHED_ROUTES as readonly string[]).includes(path);
}

/**
 * Keeps a page out of the index while still letting crawlers follow its links,
 * so the navigation around it keeps its value.
 */
export const UNLAUNCHED_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: true,
};
