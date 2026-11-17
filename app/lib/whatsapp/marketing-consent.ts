import type { getAdminClient } from "@/lib/insforge-admin";
import {
  whatsappActivationPatch,
  type MarketingColumns,
} from "@/lib/whatsapp/consent";
import type { MarketingContactRow } from "@/types/contact";

type Db = ReturnType<typeof getAdminClient>["database"];

/** Everything the switch reads, plus the address the Resend list is keyed by. */
const COLUMNS =
  "email, newsletter_subscribed, newsletter_subscribed_at, newsletter_unsubscribed_at, whatsapp_opted_in_at, whatsapp_marketing_opted_in_at, whatsapp_opted_out_at";

type Patch = Record<string, string | boolean | null>;

/**
 * The columns to write when staff turn "news and offers" ON, for email AND
 * WhatsApp at once.
 *
 * Email does what `upsert_contact` does when the newsletter box is ticked:
 * subscribed, stamped when it was not already (or had no date), and the
 * contact's own unsubscribe cleared. WhatsApp is `whatsappActivationPatch` for
 * the marketing use and is not repeated here: with no STOP the existing date
 * is kept; with one, the date is new, the STOP is cleared and the booking-notice
 * consent is withdrawn, so a consent given before the STOP never comes back on
 * somebody else's click.
 */
export function marketingActivationPatch(
  current: MarketingColumns & { newsletter_subscribed_at?: string | null },
  now: string,
): Patch {
  const alreadySubscribed =
    current.newsletter_subscribed === true &&
    !current.newsletter_unsubscribed_at;
  return {
    ...whatsappActivationPatch("marketing", current, now),
    newsletter_subscribed: true,
    newsletter_subscribed_at:
      alreadySubscribed && current.newsletter_subscribed_at
        ? current.newsletter_subscribed_at
        : now,
    newsletter_unsubscribed_at: null,
  };
}

/**
 * Turning it OFF withdraws both consents and nothing more. Neither
 * `newsletter_unsubscribed_at` nor `whatsapp_opted_out_at` is written: those
 * record that the CONTACT asked (the link in an email, a BAJA reply), and
 * staff withdrawing a consent is not that.
 */
export function marketingDeactivationPatch(): Patch {
  return { newsletter_subscribed: false, whatsapp_marketing_opted_in_at: null };
}

/**
 * Applies the switch to one contact and hands back the columns as they now
 * stand. Never throws and never returns the database's own text.
 */
export async function applyMarketingConsent(
  db: Db,
  contactId: string,
  enabled: boolean,
  now: string,
): Promise<
  | { ok: true; contact: MarketingContactRow }
  | { ok: false; error: "db" | "notFound" }
> {
  let patch: Patch;
  if (enabled) {
    const { data, error } = await db
      .from("contacts")
      .select(COLUMNS)
      .eq("id", contactId)
      .limit(1);
    if (error) return { ok: false, error: "db" };
    const current = (data as MarketingContactRow[] | null)?.[0];
    if (!current) return { ok: false, error: "notFound" };
    patch = marketingActivationPatch(current, now);
  } else {
    patch = marketingDeactivationPatch();
  }

  const { data, error } = await db
    .from("contacts")
    .update(patch)
    .eq("id", contactId)
    .select(COLUMNS);
  if (error) return { ok: false, error: "db" };
  const contact = (data as MarketingContactRow[] | null)?.[0];
  if (!contact) return { ok: false, error: "notFound" };
  return { ok: true, contact };
}
