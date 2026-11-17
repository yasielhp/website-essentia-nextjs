import type { CampaignLocale } from "@/types/campaign";
import type { MessageKey } from "./catalog";
import type { EmailContentWrite } from "./schema";
import { buildTestEmail } from "./test-email";

/**
 * The whole email as it would go out with a draft the admin has not saved: the
 * default text for what the draft leaves out, their words for what it changes,
 * and the fixed blocks (with the example booking) after the body.
 *
 * It is the very email "send me a test" delivers, built by the same function,
 * so what the preview shows and what arrives cannot differ. Nothing is read or
 * written; the caller validates the draft first. SERVER ONLY (it renders).
 */
export async function buildPreviewEmail(
  key: MessageKey,
  locale: CampaignLocale,
  content: EmailContentWrite | null,
): Promise<{ subject: string; html: string }> {
  const row = content
    ? {
        subject: content.subject ?? null,
        preheader: content.preheader ?? null,
        title: content.title ?? null,
        doc: content.doc ?? null,
        enabled: true,
      }
    : null;
  return buildTestEmail(key, locale, row);
}
