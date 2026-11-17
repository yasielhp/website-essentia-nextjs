import { startFromParams } from "@/lib/campaigns/new-start";
import { CampaignForm } from "../_form/campaign-form";

/**
 * A new campaign. A link may name the type (`?channel=whatsapp&kind=appointment`);
 * only a pair the form itself offers is taken, anything else opens it as ever.
 */
export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{
    channel?: string | string[];
    kind?: string | string[];
  }>;
}) {
  const { channel, kind } = await searchParams;
  return <CampaignForm start={startFromParams(channel, kind) ?? undefined} />;
}
