import type { CampaignKind } from "@/types/campaign";

/** The value of the "start from scratch" option: no template has this id. */
export const BLANK_START = "__blank__";

export type StartChoice =
  { type: "blank" } | { type: "template"; id: string; recommended: boolean };

/**
 * What the "Starting point" select offers, in order: the blank page first (or,
 * when there is text already, keeping it: the component says which), then every
 * house template, each marked as suggested when it was made for this kind of
 * campaign. Pure.
 */
export function startChoices(
  templates: readonly { id: string; kinds: readonly CampaignKind[] }[],
  kind: CampaignKind,
): StartChoice[] {
  return [
    { type: "blank" },
    ...templates.map((template): StartChoice => ({
      type: "template",
      id: template.id,
      recommended: template.kinds.includes(kind),
    })),
  ];
}
