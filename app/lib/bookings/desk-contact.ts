import { z } from "zod";
import { getAdminClient } from "@/lib/insforge-admin";
import { upsertContact } from "@/lib/contacts/public-contact";

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
 * What is written is what the screen always wrote: the client's name, address,
 * phone, language and gender, and the newsletter only when its switch is on
 * (`null`, never `false`, when it is off: an untouched switch must not undo an
 * earlier yes). No WhatsApp consent of any kind: bookings the team creates
 * record none (CLAUDE.md, "WhatsApp consent rule").
 */

export const deskContactSchema = z.strictObject({
  email: z.email().max(254),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().max(120),
  phone: z.string().trim().min(1).max(40).nullable(),
  language: z.enum(["en", "es"]),
  gender: z.enum(["female", "male", "other"]).nullable(),
  /** The newsletter switch: `true` when on, `null` ("do not touch") when off. */
  newsletter: z.literal(true).nullable(),
});
export type DeskContactInput = z.input<typeof deskContactSchema>;

export type DeskContactResult =
  { ok: true; contactId: string } | { ok: false; error: "invalid" | "failed" };

export async function linkDeskContactCore(
  raw: unknown,
): Promise<DeskContactResult> {
  const parsed = deskContactSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const input = parsed.data;
  const contactId = await upsertContact(getAdminClient().database, {
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    language: input.language,
    gender: input.gender,
    newsletter: input.newsletter,
    whatsappMarketing: null,
  });
  return contactId ? { ok: true, contactId } : { ok: false, error: "failed" };
}
