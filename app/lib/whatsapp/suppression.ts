import type { getAdminClient } from "@/lib/insforge-admin";
import { toCampaignPhone } from "./phone";

/**
 * The phones that wrote STOP or BAJA, kept by NUMBER and not by contact.
 *
 * Consent is recorded on a contact, but the same public booking form that
 * ticks the box also writes the phone, so a third party can book with their own
 * email, somebody else's number and the box ticked, and the centre would write
 * to that somebody. A person who answers STOP from the number has said no to
 * it, whoever's contact it sits on and whether or not any contact matches. This
 * list is what remembers that: nothing a form, a checkbox or `upsert_contact`
 * does can take a number off it. Only an administrator, from the contact's
 * card, can.
 *
 * EVERY READ FAILS CLOSED. The table is created by a migration the operator
 * applies; until then, and whenever the database cannot be reached, a read
 * throws and the callers send nothing rather than guess. Email never reads it.
 *
 * SERVER ONLY.
 */

type Db = ReturnType<typeof getAdminClient>["database"];

export const SUPPRESSED_TABLE = "whatsapp_suppressed_phones";

/**
 * The rows to write for the senders of a STOP: E.164, valid, once each.
 *
 * A sender is Meta's `messages[].from`: the whole international number, digits
 * only and without the `+`. It is NOT a number somebody typed in a form, so it
 * is given the `+` before it is normalised, as `matchByPhone` does. Without it
 * `toE164` reads nine digits as a Spanish number and adds the 34: Andorra's
 * `376312345` was stored as `+34376312345`, a number no send ever looks for.
 */
export function suppressionRows(
  senders: readonly string[],
): { phone: string; reason: "stop" }[] {
  const phones = new Set<string>();
  for (const sender of senders) {
    if (typeof sender !== "string") continue;
    const digits = sender.replace(/\D/g, "");
    if (!digits) continue;
    const phone = toCampaignPhone(`+${digits}`);
    if (phone) phones.add(phone);
  }
  return [...phones].map((phone) => ({ phone, reason: "stop" as const }));
}

/**
 * Adds the senders (Meta's `from`, see `suppressionRows`) to the list, leaving
 * those already there as they are. Returns how many rows it sent. Throws on a
 * database error.
 */
export async function suppressPhones(
  db: Db,
  senders: readonly string[],
): Promise<number> {
  const rows = suppressionRows(senders);
  if (rows.length === 0) return 0;
  const { error } = await db
    .from(SUPPRESSED_TABLE)
    .upsert(rows, { onConflict: "phone", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return rows.length;
}

/**
 * What the webhook does with a STOP: write the numbers, and never let that
 * fail the payload it arrived in (the opt-out of the matching contacts, and
 * the delivery states, still have to be processed). Logs and swallows.
 */
export async function recordOptOutSuppression(
  db: Db,
  senders: readonly string[],
): Promise<void> {
  try {
    await suppressPhones(db, senders);
  } catch (err) {
    console.error(
      "[webhooks/whatsapp] could not record the suppressed phone:",
      err,
    );
  }
}

/**
 * Which of the phones are on the list, as E.164. Throws when the list cannot
 * be read: the caller must not send.
 */
export async function loadSuppressedPhones(
  db: Db,
  phones: readonly (string | null | undefined)[],
): Promise<Set<string>> {
  const wanted = [
    ...new Set(
      phones.flatMap((raw) => {
        const phone = toCampaignPhone(raw);
        return phone ? [phone] : [];
      }),
    ),
  ];
  if (wanted.length === 0) return new Set();
  const { data, error } = await db
    .from(SUPPRESSED_TABLE)
    .select("phone")
    .in("phone", wanted);
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as { phone: string }[]).map((r) => r.phone));
}

export async function isPhoneSuppressed(
  db: Db,
  phone: string,
): Promise<boolean> {
  const listed = await loadSuppressedPhones(db, [phone]);
  const normalised = toCampaignPhone(phone);
  return normalised !== null && listed.has(normalised);
}

/** The whole list, for resolving an audience. Throws when it cannot be read. */
export async function loadAllSuppressedPhones(db: Db): Promise<Set<string>> {
  const { data, error } = await db
    .from(SUPPRESSED_TABLE)
    .select("phone")
    .range(0, 9_999);
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as { phone: string }[]).map((r) => r.phone));
}
