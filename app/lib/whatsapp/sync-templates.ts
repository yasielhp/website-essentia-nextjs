import { getAdminClient } from "@/lib/insforge-admin";
import {
  isTemplateApiConfigured,
  listRemoteTemplates,
} from "@/lib/whatsapp/client";
import { countParams, templateSupport } from "@/lib/whatsapp/templates";
import { WHATSAPP_TEMPLATE_CATEGORIES } from "@/lib/whatsapp/types";

/** The only categories the dashboard knows how to show and send. */
const KNOWN_CATEGORIES: readonly string[] = WHATSAPP_TEMPLATE_CATEGORIES;

export type SyncTemplatesResult =
  | { ok: true; count: number; skipped: number }
  | {
      ok: false;
      /** A key the dashboard translates. */
      error: "whatsapp_not_configured" | "meta" | "db";
      /** What Meta or the network said, as it came. */
      detail?: string;
    };

/**
 * Brings the account's templates from Meta into `whatsapp_templates`: every
 * template Meta lists is written over its local row (matched by name and
 * language) with its text, its status and why it was rejected. It only reads
 * Meta and writes the copy; it sends nothing and deletes nothing.
 *
 * Nobody asks for it by hand: the templates page runs it when it is opened
 * (`syncWhatsAppTemplates`, admin only) and `/api/cron/whatsapp-templates`
 * runs it every hour, so a status Meta's webhook failed to deliver, or a
 * template made in Meta's own manager, still reaches the dashboard.
 */
export async function syncTemplatesFromMeta(): Promise<SyncTemplatesResult> {
  if (!isTemplateApiConfigured()) {
    return { ok: false, error: "whatsapp_not_configured" };
  }

  let remote;
  try {
    remote = await listRemoteTemplates();
  } catch (err) {
    return {
      ok: false,
      error: "meta",
      detail: err instanceof Error ? err.message : "unknown",
    };
  }

  const known = remote.filter((t) => KNOWN_CATEGORIES.includes(t.category));
  const skipped = remote.length - known.length;
  if (known.length === 0) return { ok: true, count: 0, skipped };

  const now = new Date().toISOString();
  try {
    const { error } = await getAdminClient()
      .database.from("whatsapp_templates")
      .upsert(
        known.map((t) => ({
          meta_id: t.metaId,
          name: t.name,
          language: t.language,
          category: t.category,
          status: t.status,
          header_format: t.headerFormat,
          header_text: t.headerText,
          body: t.body,
          footer_text: t.footerText,
          buttons: t.buttons,
          param_count: countParams(t.body),
          example_params: t.exampleParams,
          rejection_reason: t.rejectionReason,
          unsupported_reason: templateSupport(t),
          synced_at: now,
          updated_at: now,
        })),
        { onConflict: "name,language" },
      );
    if (error) return { ok: false, error: "db" };
  } catch {
    return { ok: false, error: "db" };
  }
  return { ok: true, count: known.length, skipped };
}
