import type { CampaignChannel, CampaignRecipientRow } from "@/types/campaign";

/**
 * What a recipient's row says, over plain values: who it is and what happened
 * to it last. The table and the cards of the report both read these two, so a
 * phone and an address are chosen once.
 */

/** Who the message went to: the phone on WhatsApp, the address on email. */
export function recipientIdentity(
  row: Pick<CampaignRecipientRow, "email" | "phone">,
  channel: CampaignChannel,
): string {
  if (channel === "whatsapp") return row.phone ?? "—";
  return row.email ?? row.phone ?? "—";
}

/** The most recent thing that happened to this recipient. */
export function recipientLastEvent(
  row: Pick<
    CampaignRecipientRow,
    "sent_at" | "delivered_at" | "opened_at" | "clicked_at" | "read_at"
  >,
  channel: CampaignChannel,
): string | null {
  // WhatsApp has no clicks; the read receipt is its last word.
  return channel === "whatsapp"
    ? (row.read_at ?? row.delivered_at ?? row.sent_at)
    : (row.clicked_at ?? row.opened_at ?? row.delivered_at ?? row.sent_at);
}

/** The contact's name as the report shows it, or null when the row has none. */
export function recipientName(
  row: Pick<CampaignRecipientRow, "contact_name">,
): string | null {
  const name = (row.contact_name ?? "").trim();
  return name === "" ? null : name;
}

/**
 * Whether a typed search finds this row: by name, by address, or by phone
 * (typing "600 11" finds +34600112233, as spaces are not part of a number).
 */
export function recipientMatches(
  row: Pick<CampaignRecipientRow, "contact_name" | "email" | "phone">,
  query: string,
): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  const digits = term.replace(/\s+/g, "");
  return (
    (recipientName(row) ?? "").toLowerCase().includes(term) ||
    (row.email ?? "").toLowerCase().includes(term) ||
    (digits !== "" && (row.phone ?? "").includes(digits))
  );
}
