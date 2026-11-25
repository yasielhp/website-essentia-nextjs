import { z } from "zod";
import { getAdminClient } from "@/lib/insforge-admin";
import type { AuthContext } from "@/lib/auth-guard";
import { writeContact } from "@/lib/contacts/write-contact";
import { normalizeEmail } from "@/utils/contact";

/**
 * The contact of a booking taken at the desk (the dashboard's "New booking"),
 * written by the server.
 *
 * The screen used to call `upsert_contact` from the browser, with the
 * signed-in member of the team's session. That function is SECURITY DEFINER
 * and anybody with the public key could call it too, for any address and with
 * any consent; its EXECUTE is the service key's alone now (migration
 * `20261124_revoke_public_definer_functions`). The action that calls this
 * (`linkDeskContact`) lets in the team only, the same roles that take a
 * booking at the desk.
 *
 * Who writes what (decided by the owner on 2026-11-24):
 *  - admin and staff: what the screen always wrote, `upsert_contact` as it
 *    was (`overwrite`): the client's name, phone, language and gender;
 *  - a partner: links an existing contact or creates a new one, but never
 *    changes an existing contact's name, phone, language or subscriptions
 *    (`link`). The booking keeps what she typed.
 *
 * The two consents, the same two switches as the contact's card (owner's
 * decision of 2026-11-25), each `true` when on and `null` ("do not touch")
 * when off, so an untouched switch never undoes an earlier yes:
 *  - "News and offers" (`marketing`): the newsletter AND WhatsApp marketing,
 *    one consent as everywhere else;
 *  - "Appointment notices" (`appointmentNotices`, on by default on the
 *    screen): the booking-notice WhatsApp consent (`whatsapp_opted_in_at`),
 *    stamped only when the contact has none. A partner gives it only to a
 *    contact she has just created.
 * The desk NEVER lifts what the person withdrew: with a STOP
 * (`whatsapp_opted_out_at`) neither consent is given, and with an email
 * unsubscribe "news and offers" is not (it is one consent for both channels). Coming back is the person's reply,
 * her own account, or the switch on her card, which asks first.
 */

export const deskContactSchema = z.strictObject({
  email: z.email().max(254),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().max(120),
  phone: z.string().trim().min(1).max(40).nullable(),
  language: z.enum(["en", "es"]),
  gender: z.enum(["female", "male", "other"]).nullable(),
  /** "News and offers": `true` when on, `null` ("do not touch") when off. */
  marketing: z.literal(true).nullable(),
  /** "Appointment notices": `true` when on, `null` ("do not touch") when off. */
  appointmentNotices: z.literal(true).nullable(),
});
export type DeskContactInput = z.input<typeof deskContactSchema>;

export type DeskContactResult =
  { ok: true; contactId: string } | { ok: false; error: "invalid" | "failed" };

/** The roles that may change an existing contact from the desk. */
const OVERWRITES = new Set(["admin", "staff"]);

type Existing = {
  id: string;
  newsletter_unsubscribed_at: string | null;
  whatsapp_opted_out_at: string | null;
};

/**
 * Stamps the booking-notice consent on a contact that has none and no STOP,
 * in one conditional write (a STOP that lands meanwhile wins). Best effort: a
 * booking is worth more than the notice, so a failure is logged, not raised.
 */
async function stampAppointmentNotices(
  db: ReturnType<typeof getAdminClient>["database"],
  contactId: string,
  nowIso: string,
): Promise<void> {
  try {
    const { error } = await db
      .from("contacts")
      .update({ whatsapp_opted_in_at: nowIso })
      .eq("id", contactId)
      .is("whatsapp_opted_in_at", null)
      .is("whatsapp_opted_out_at", null);
    if (error) {
      console.error("[desk-contact] appointment notices not stamped");
    }
  } catch {
    console.error("[desk-contact] appointment notices not stamped");
  }
}

export async function linkDeskContactCore(
  actor: Pick<AuthContext, "role">,
  raw: unknown,
  now: () => Date = () => new Date(),
): Promise<DeskContactResult> {
  const parsed = deskContactSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const input = parsed.data;
  const db = getAdminClient().database;
  const overwrites = OVERWRITES.has(actor.role);

  // Read first: what the person withdrew is not the desk's to give back, and a
  // partner gives the notice consent only to a contact she creates now.
  let existing: Existing | null;
  try {
    const { data, error } = await db
      .from("contacts")
      .select("id, newsletter_unsubscribed_at, whatsapp_opted_out_at")
      .eq("email", normalizeEmail(input.email) ?? "")
      .maybeSingle();
    if (error) return { ok: false, error: "failed" };
    existing = (data as Existing | null) ?? null;
  } catch {
    return { ok: false, error: "failed" };
  }
  const stopped = Boolean(existing?.whatsapp_opted_out_at);
  // "News and offers" is one consent: a STOP or an email unsubscribe on file
  // withdraws it whole, and the desk does not give it back on either channel.
  const marketing =
    input.marketing === true &&
    !stopped &&
    !existing?.newsletter_unsubscribed_at;

  const contactId = await writeContact(
    db,
    {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      language: input.language,
      gender: input.gender,
      newsletter: marketing ? true : null,
      whatsappMarketing: marketing ? true : null,
    },
    overwrites ? "overwrite" : "link",
  );
  if (!contactId) return { ok: false, error: "failed" };

  if (
    input.appointmentNotices === true &&
    !stopped &&
    (overwrites || !existing)
  ) {
    await stampAppointmentNotices(db, contactId, now().toISOString());
  }
  return { ok: true, contactId };
}
