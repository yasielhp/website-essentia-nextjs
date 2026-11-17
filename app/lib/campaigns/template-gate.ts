import { getAdminClient } from "@/lib/insforge-admin";
import type { CampaignRow } from "@/types/campaign";
import {
  campaignTemplateIssue,
  loadWhatsAppTemplate,
} from "./dispatch-whatsapp";
import type { CampaignTemplateIssue } from "./whatsapp-eligibility";

type Db = ReturnType<typeof getAdminClient>["database"];

export type TemplateGateFailure =
  | { ok: false; error: "template_unavailable"; detail: CampaignTemplateIssue }
  | { ok: false; error: "db" };

/**
 * Whether a saved campaign may be switched on or scheduled: for WhatsApp, its
 * template must still be sendable. The form checks this, and so does a save,
 * but a template can be paused between that and now, and the campaign sheet
 * activates a saved campaign without going through a save at all.
 *
 * An email has no template and is passed without a read. `detail` is the
 * eligibility code and nothing else, so it is safe to show.
 */
export async function templateGate(
  campaign: Pick<CampaignRow, "channel" | "audience" | "content" | "kind">,
  db: Db = getAdminClient().database,
): Promise<TemplateGateFailure | null> {
  if (campaign.channel !== "whatsapp") return null;
  let template;
  try {
    template = await loadWhatsAppTemplate(
      db,
      campaign.content.whatsapp?.templateId,
    );
  } catch (err) {
    console.error("[campaigns] template gate read failed:", err);
    return { ok: false, error: "db" };
  }
  const issue = campaignTemplateIssue(campaign, template);
  return issue
    ? { ok: false, error: "template_unavailable", detail: issue }
    : null;
}
