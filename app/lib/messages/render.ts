import { getAdminClient } from "@/lib/insforge-admin";
import type { CampaignLocale, EmailDoc } from "@/types/campaign";
import type { MessageKey } from "./catalog";
import {
  chooseDelivery,
  composeMessageEmail,
  type MessageRow,
  type MessageVars,
} from "./compose";

/**
 * What a caller does with a message.
 *
 * `legacy` means "send the email you have always sent, with the code you have
 * always used". It is also what every failure turns into: a database that
 * cannot be read or a render that throws must never become "send nothing" or
 * a broken email, least of all on a booking somebody has already paid for.
 */
export type RenderedMessage =
  | { kind: "legacy" }
  | { kind: "custom"; subject: string; html: string }
  | { kind: "skip" };

type RowRecord = {
  subject: string | null;
  preheader: string | null;
  title: string | null;
  doc: EmailDoc | null;
  enabled: boolean;
};

/** The saved version of one message in one language, or null if none. */
export async function loadMessageRow(
  key: MessageKey,
  locale: CampaignLocale,
): Promise<MessageRow | null> {
  const { data, error } = await getAdminClient()
    .database.from("message_templates")
    .select("subject, preheader, title, doc, enabled")
    .eq("key", key)
    .eq("channel", "email")
    .eq("locale", locale)
    .maybeSingle();
  if (error) throw error;
  const row = data as RowRecord | null;
  if (!row) return null;
  return {
    subject: row.subject,
    preheader: row.preheader,
    title: row.title,
    doc: row.doc,
    enabled: row.enabled,
  };
}

/**
 * Decides, for one email about to go out, whether the admin's version or the
 * one in code is used. SERVER ONLY.
 *
 * `fixedHtml` is a function so the fixed blocks are only built when a custom
 * email needs them: on the legacy path nothing of this module touches the
 * email.
 *
 * Never throws.
 */
export async function renderMessageEmail(
  opts: {
    key: MessageKey;
    locale: CampaignLocale;
    vars: MessageVars;
    fixedHtml: () => string;
  },
  // Injectable so the decision can be tested without a database.
  load: typeof loadMessageRow = loadMessageRow,
): Promise<RenderedMessage> {
  try {
    const row = await load(opts.key, opts.locale);
    const delivery = chooseDelivery(opts.key, row);
    if (delivery === "legacy" || !row) return { kind: "legacy" };
    if (delivery === "skip") return { kind: "skip" };
    const { subject, html } = await composeMessageEmail({
      key: opts.key,
      locale: opts.locale,
      row,
      vars: opts.vars,
      fixedHtml: opts.fixedHtml(),
    });
    return { kind: "custom", subject, html };
  } catch (err) {
    console.error(`[messages] ${opts.key}/${opts.locale} fell back:`, err);
    return { kind: "legacy" };
  }
}
