import { getAdminClient } from "@/lib/insforge-admin";
import { sendEmail } from "@/emails/send";
import { bonusPurchaseEmail } from "@/emails/templates/bonus-purchase";
import { bonusExpiry, bonusToday } from "@/lib/bonuses/expiry";
import { shouldGrantBonus } from "@/lib/bonuses/orders";
import { formatLongDate, formatPrice } from "@/utils/format";

type OrderRow = {
  id: string;
  tier_id: string;
  plan_id: string | null;
  sessions: number;
  price_eur: number | string;
  validity_days: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  preferred_language: "en" | "es";
  status: string;
};

const ORDER_FIELDS =
  "id, tier_id, plan_id, sessions, price_eur, validity_days, first_name, last_name, email, phone, preferred_language, status";

/**
 * Turns a paid bonus order into a bonus on the client's file.
 *
 * Deliberately in `services/` and not `actions/`, for the same reason as
 * `handleBookingPaid`: it is only reached from the Redsys webhook after the
 * signature is verified, and as a Server Action it would be a public endpoint
 * that hands out bonuses.
 *
 * Three guards, in this order. The order must be `pending` and the bank must
 * have collected exactly its price (`shouldGrantBonus`). The claim —
 * `pending` → `paid` — is a single conditional UPDATE, so of two notifications
 * racing only one gets the row and only one bonus is made. And if anything
 * after the claim fails the order goes back to `pending` and the error
 * propagates, which makes the webhook answer KO so Redsys tries again; nobody
 * is left having paid for a bonus that was never created.
 */
export async function handleBonusPaid(
  redsysOrder: string,
  amountCents: number,
): Promise<void> {
  const db = getAdminClient().database;

  const { data } = await db
    .from("bonus_orders")
    .select(ORDER_FIELDS)
    .eq("redsys_order", redsysOrder)
    .maybeSingle();
  const order = data as OrderRow | null;
  if (!order) {
    console.error("[handleBonusPaid] no order for", redsysOrder);
    return;
  }

  const decision = shouldGrantBonus(
    { status: order.status, priceEur: Number(order.price_eur) },
    amountCents,
  );
  if (!decision.grant) {
    if (decision.reason === "amount_mismatch") {
      // Never hand over a bonus for less than it is worth: park the order for
      // somebody to look at.
      await db
        .from("bonus_orders")
        .update({ status: "failed" })
        .eq("id", order.id)
        .eq("status", "pending");
      console.error(
        `[handleBonusPaid] amount mismatch on order ${order.id}: expected ${order.price_eur} EUR, bank collected ${amountCents} cents. Needs review.`,
      );
    }
    return;
  }

  const paidEur = amountCents / 100;
  const { data: claimed } = await db
    .from("bonus_orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_amount_eur: paidEur,
    })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id");
  if (((claimed ?? []) as unknown[]).length === 0) return;

  const release = () =>
    db
      .from("bonus_orders")
      .update({ status: "pending", paid_at: null, paid_amount_eur: null })
      .eq("id", order.id);

  try {
    // Same call the booking form makes. The newsletter flag is `null`: buying
    // a bonus is not consent to a mailing list, and `null` leaves an earlier
    // yes untouched.
    const { data: contactId, error: contactError } = await db.rpc(
      "upsert_contact",
      {
        p_email: order.email,
        p_first_name: order.first_name,
        p_last_name: order.last_name,
        p_phone: order.phone,
        p_language: order.preferred_language,
        p_gender: null,
        p_newsletter: null,
      },
    );
    if (contactError || !contactId) {
      throw new Error("upsert_contact failed");
    }

    const purchasedAt = bonusToday();
    const { data: bonus, error: bonusError } = await db
      .from("contact_bonuses")
      .insert([
        {
          contact_id: contactId as string,
          plan_id: order.plan_id,
          tier_id: order.tier_id,
          sessions_total: order.sessions,
          price_eur: Number(order.price_eur),
          paid_method: "online",
          purchased_at: purchasedAt,
          expires_at: bonusExpiry(purchasedAt, order.validity_days),
        },
      ])
      .select("id")
      .single();
    const bonusId = (bonus as { id: string } | null)?.id;
    if (bonusError || !bonusId)
      throw new Error("contact_bonuses insert failed");

    await db
      .from("bonus_orders")
      .update({ contact_id: contactId as string, contact_bonus_id: bonusId })
      .eq("id", order.id);

    // Someone who has bought is a client; a failure here is not worth undoing
    // a payment for.
    try {
      await db.rpc("promote_contact_to_client", {
        p_contact_id: contactId as string,
      });
    } catch {
      // fail-open
    }

    await sendConfirmation(
      order,
      bonusExpiry(purchasedAt, order.validity_days),
    );
  } catch (err) {
    await release();
    throw err;
  }
}

/** Never throws: the bonus exists, and an email that fails is only logged. */
async function sendConfirmation(
  order: OrderRow,
  expiresOn: string,
): Promise<void> {
  try {
    const db = getAdminClient().database;
    const { data: tier } = await db
      .from("service_tiers")
      .select("label")
      .eq("id", order.tier_id)
      .maybeSingle();
    const service = (tier as { label: string | null } | null)?.label ?? "";
    const locale = order.preferred_language;

    const { error } = await sendEmail({
      to: order.email,
      subject:
        locale === "es"
          ? `Tu bono de ${order.sessions} sesiones está confirmado`
          : `Your ${order.sessions}-session voucher is confirmed`,
      html: bonusPurchaseEmail({
        name: order.first_name,
        service,
        sessions: order.sessions,
        amount: formatPrice(Number(order.price_eur), locale),
        expiresOn: formatLongDate(expiresOn, locale),
        locale,
      }),
    });
    if (error) console.error("[handleBonusPaid] email failed:", error);
  } catch (err) {
    console.error("[handleBonusPaid] email failed:", err);
  }
}
