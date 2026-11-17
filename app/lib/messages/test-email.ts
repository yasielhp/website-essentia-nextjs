import { defaultContent } from "@/emails/defaults";
import { renderVariables } from "@/lib/campaigns/body-html";
import type { CampaignLocale } from "@/types/campaign";
import type { MessageKey } from "./catalog";
import {
  chooseDelivery,
  composeMessageEmail,
  type MessageRow,
} from "./compose";
import { fixedBlocksHtml } from "./fixed-blocks";
import { legacySampleEmail, sampleFixed, sampleVars } from "./samples";

/**
 * The email "send me a test" delivers, built exactly as it would go out for an
 * example booking: the admin's saved version when there is one (a switched-off
 * reminder included, since the test is about what the text looks like), and
 * the email that has always gone out when there is not.
 *
 * No database and no mailer here: the caller reads the row and sends.
 */
export async function buildTestEmail(
  key: MessageKey,
  locale: CampaignLocale,
  row: MessageRow | null,
): Promise<{ subject: string; html: string }> {
  const vars = sampleVars(key, locale);
  // The switch only decides whether it is sent, not what it says.
  const shown = row ? { ...row, enabled: true } : null;
  if (shown && chooseDelivery(key, shown) === "custom") {
    return composeMessageEmail({
      key,
      locale,
      row: shown,
      vars,
      fixedHtml: fixedBlocksHtml(key, sampleFixed(key, locale)),
    });
  }
  return {
    // The default subject is the one the caller sends today (a test checks it).
    subject: renderVariables(
      defaultContent(key, locale).subject,
      vars as Record<string, string>,
      { escape: false },
    ),
    html: legacySampleEmail(key, locale),
  };
}
