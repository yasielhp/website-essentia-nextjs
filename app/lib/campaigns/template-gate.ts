import { getAdminClient } from "@/lib/insforge-admin";
import type { CampaignLocale, CampaignRow } from "@/types/campaign";
import { campaignTemplateIssue } from "./dispatch-whatsapp";
import type { CampaignTemplateIssue } from "./whatsapp-eligibility";

type Db = ReturnType<typeof getAdminClient>["database"];

export type TemplateGateFailure =
  | {
      ok: false;
      error: "template_unavailable";
      detail: CampaignTemplateIssue;
      /** The language whose template cannot go out. */
      locale: CampaignLocale;
    }
  | { ok: false; error: "db" };

/**
 * Whether a saved campaign may be switched on or scheduled: for WhatsApp, the
 * template of EVERY language of its audience must still be sendable. The form
 * checks this, and so does a save, but a template can be paused between that
 * and now, and the campaign sheet activates a saved campaign without going
 * through a save at all.
 *
 * An email has no template and is passed without a read. `detail` is the
 * eligibility code and `locale` the language it is about, and nothing else,
 * so both are safe to show.
 */
export async function templateGate(
  campaign: Pick<CampaignRow, "channel" | "audience" | "content" | "kind">,
  db: Db = getAdminClient().database,
): Promise<TemplateGateFailure | null> {
  if (campaign.channel !== "whatsapp") return null;
  let found;
  try {
    found = await campaignTemplateIssue(db, campaign);
  } catch (err) {
    console.error("[campaigns] template gate read failed:", err);
    return { ok: false, error: "db" };
  }
  return found
    ? {
        ok: false,
        error: "template_unavailable",
        detail: found.issue,
        locale: found.locale,
      }
    : null;
}
