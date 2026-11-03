"use server";

import {
  ADMIN_ROLES,
  AuthError,
  requireRole,
  type AuthContext,
} from "@/lib/auth-guard";
import { getAdminClient } from "@/lib/insforge-admin";
import { recordBookingEvent } from "@/lib/booking-events/record";
import type { BookingEventActorRole } from "@/lib/booking-events/types";
import {
  bonusBalance,
  usableBonus,
  type BonusRow,
} from "@/lib/bonuses/balance";
import { bonusExpiry, bonusToday } from "@/lib/bonuses/expiry";
import { bonusLabelEs } from "@/lib/bonuses/label";
import { bonusPlanSchema } from "@/lib/schemas";
import type {
  BonusBooking,
  BonusPaidMethod,
  BonusPlan,
  BonusSale,
  ContactBonus,
} from "@/types/bonus";

const PAID_METHODS: BonusPaidMethod[] = ["cash", "card", "transfer", "other"];

async function authorize(
  accessToken: string | null,
  roles?: Parameters<typeof requireRole>[1],
): Promise<AuthContext | null> {
  try {
    return await requireRole(accessToken, roles);
  } catch (err) {
    if (err instanceof AuthError) return null;
    throw err;
  }
}

type PlanRowDb = {
  id: string;
  tier_id: string;
  sessions: number;
  price_eur: number | string;
  validity_days: number;
  active: boolean;
  service_tiers: {
    label: string | null;
    color: string | null;
    image_url: string | null;
  } | null;
};

/**
 * Every bonus plan. Readable by any dashboard role, because the desk picks one
 * when it sells a bonus; only administrators change them.
 */
export async function fetchBonusPlans(
  accessToken: string | null,
): Promise<BonusPlan[]> {
  if (!(await authorize(accessToken))) return [];

  const { data } = await getAdminClient()
    .database.from("bonus_plans")
    .select(
      "id, tier_id, sessions, price_eur, validity_days, active, service_tiers(label, color, image_url)",
    )
    .order("created_at", { ascending: true });

  return ((data ?? []) as unknown as PlanRowDb[]).map((r) => ({
    id: r.id,
    tierId: r.tier_id,
    tierLabel: r.service_tiers?.label ?? null,
    tierColor: r.service_tiers?.color ?? null,
    tierImageUrl: r.service_tiers?.image_url ?? null,
    sessions: r.sessions,
    priceEur: Number(r.price_eur),
    validityDays: r.validity_days,
    active: r.active,
  }));
}

/** Creates a plan, or updates it when `input.id` is set. Administrators only. */
export async function upsertBonusPlan(
  accessToken: string | null,
  input: unknown,
): Promise<{ error: string | null }> {
  if (!(await authorize(accessToken, ADMIN_ROLES)))
    return { error: "forbidden" };

  const parsed = bonusPlanSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  const v = parsed.data;

  const row = {
    tier_id: v.tierId,
    sessions: v.sessions,
    price_eur: v.priceEur,
    validity_days: v.validityDays,
    active: v.active,
  };
  const db = getAdminClient().database;
  const { error } = v.id
    ? await db.from("bonus_plans").update(row).eq("id", v.id)
    : await db.from("bonus_plans").insert([row]);
  if (!error) return { error: null };
  // One plan per session type and number of sessions.
  const { code, message } = error as { code?: string; message?: string };
  if (code === "23505" || message?.includes("duplicate")) {
    return { error: "duplicate" };
  }
  return { error: message ?? "db" };
}

type ContactBonusDb = {
  id: string;
  plan_id: string | null;
  tier_id: string;
  sessions_total: number;
  price_eur: number | string;
  paid_method: BonusPaidMethod | null;
  purchased_at: string;
  expires_at: string;
  notes: string | null;
  service_tiers: { label: string | null } | null;
};

type UseRow = {
  id: string;
  date: string | null;
  time: string | null;
  status: string | null;
  bonus_id: string;
};

/** The bonuses a contact bought, with sessions counted from their bookings. */
export async function fetchContactBonuses(
  accessToken: string | null,
  contactId: string,
): Promise<ContactBonus[]> {
  if (!(await authorize(accessToken)) || !contactId) return [];

  const db = getAdminClient().database;
  const { data } = await db
    .from("contact_bonuses")
    .select(
      "id, plan_id, tier_id, sessions_total, price_eur, paid_method, purchased_at, expires_at, notes, service_tiers(label)",
    )
    .eq("contact_id", contactId)
    .order("purchased_at", { ascending: false });
  const bonuses = (data ?? []) as unknown as ContactBonusDb[];
  if (bonuses.length === 0) return [];

  const { data: useData } = await db
    .from("bookings")
    .select("id, date, time, status, bonus_id")
    .in(
      "bonus_id",
      bonuses.map((b) => b.id),
    )
    .order("date", { ascending: true });
  const uses = (useData ?? []) as UseRow[];

  return bonuses.map((b) => {
    const row: BonusRow = {
      id: b.id,
      tierId: b.tier_id,
      sessionsTotal: b.sessions_total,
      expiresAt: b.expires_at,
    };
    const mine = uses.filter((u) => u.bonus_id === b.id);
    const { used, remaining } = bonusBalance(
      row,
      mine.map((u) => ({ bonusId: u.bonus_id, status: u.status ?? "" })),
    );
    const bookings: BonusBooking[] = mine.map((u) => ({
      id: u.id,
      date: u.date,
      time: u.time,
      status: u.status,
    }));
    return {
      id: b.id,
      planId: b.plan_id,
      tierId: b.tier_id,
      tierLabel: b.service_tiers?.label ?? null,
      sessionsTotal: b.sessions_total,
      priceEur: Number(b.price_eur),
      paidMethod: b.paid_method,
      purchasedAt: b.purchased_at,
      expiresAt: b.expires_at,
      notes: b.notes,
      used,
      remaining,
      bookings,
    };
  });
}

/**
 * Sells a bonus to a contact: the plan's sessions, price and session type
 * are copied, so editing the plan later does not rewrite what was bought.
 */
export async function grantContactBonus(
  accessToken: string | null,
  input: {
    contactId: string;
    planId: string;
    paidMethod: BonusPaidMethod;
    notes?: string;
  },
): Promise<{ error: string | null }> {
  const actor = await authorize(accessToken);
  if (!actor) return { error: "forbidden" };
  if (!PAID_METHODS.includes(input.paidMethod)) return { error: "invalid" };

  const db = getAdminClient().database;
  const { data: planData } = await db
    .from("bonus_plans")
    .select("id, tier_id, sessions, price_eur, validity_days, active")
    .eq("id", input.planId)
    .maybeSingle();
  const plan = planData as {
    id: string;
    tier_id: string;
    sessions: number;
    price_eur: number | string;
    validity_days: number;
    active: boolean;
  } | null;
  if (!plan || !plan.active) return { error: "plan_unavailable" };

  const purchasedAt = bonusToday();
  const { error } = await db.from("contact_bonuses").insert([
    {
      contact_id: input.contactId,
      plan_id: plan.id,
      tier_id: plan.tier_id,
      sessions_total: plan.sessions,
      price_eur: Number(plan.price_eur),
      paid_method: input.paidMethod,
      purchased_at: purchasedAt,
      expires_at: bonusExpiry(purchasedAt, plan.validity_days),
      notes: input.notes?.trim() || null,
      created_by: actor.userId,
    },
  ]);
  return {
    error: error ? ((error as { message?: string }).message ?? "db") : null,
  };
}

type BookingForBonus = {
  contact_id: string | null;
  tier_id: string | null;
  bonus_id: string | null;
  payment_mode: string | null;
  amount_paid_eur: number | string | null;
};

/**
 * Draws one session of a bonus for an existing booking.
 *
 * Refuses a booking that already took money: swapping its payment for a bonus
 * would silently erase what was collected. The bonus must be the client's,
 * for the booking's session type, unexpired and with a session left.
 */
export async function assignBookingBonus(
  accessToken: string | null,
  input: { bookingId: string; bonusId: string },
): Promise<{ error: string | null }> {
  const actor = await authorize(accessToken);
  if (!actor) return { error: "forbidden" };

  const db = getAdminClient().database;
  const { data } = await db
    .from("bookings")
    .select("contact_id, tier_id, bonus_id, payment_mode, amount_paid_eur")
    .eq("id", input.bookingId)
    .maybeSingle();
  const booking = data as BookingForBonus | null;
  if (!booking) return { error: "not_found" };
  if (!booking.contact_id || !booking.tier_id) return { error: "no_contact" };
  if (booking.bonus_id) return { error: "already_assigned" };
  if (Number(booking.amount_paid_eur ?? 0) > 0) return { error: "has_payment" };

  const bonuses = await fetchContactBonuses(accessToken, booking.contact_id);
  const rows: BonusRow[] = bonuses.map((b) => ({
    id: b.id,
    tierId: b.tierId,
    sessionsTotal: b.sessionsTotal,
    expiresAt: b.expiresAt,
  }));
  const uses = bonuses.flatMap((b) =>
    b.bookings.map((u) => ({ bonusId: b.id, status: u.status ?? "" })),
  );
  const usable = usableBonus(
    rows.filter((r) => r.id === input.bonusId),
    uses,
    booking.tier_id,
    bonusToday(),
  );
  const chosen = bonuses.find((b) => b.id === input.bonusId);
  if (!usable || !chosen) return { error: "not_usable" };

  const { error } = await db
    .from("bookings")
    .update({
      bonus_id: usable.id,
      payment_mode: "bonus",
      payment_status: "paid",
      amount_paid_eur: 0,
    })
    .eq("id", input.bookingId)
    .is("bonus_id", null);
  if (error) return { error: (error as { message?: string }).message ?? "db" };

  await recordBookingEvent({
    bookingId: input.bookingId,
    channel: "system",
    event: "edited",
    actorId: actor.userId,
    actorRole: actor.role as BookingEventActorRole,
    summary: `Sesión descontada del ${bonusLabelEs(chosen.sessionsTotal)} (${chosen.used + 1}/${chosen.sessionsTotal})`,
    payload: { bonusId: usable.id },
  });
  return { error: null };
}

/** Gives the session back: the booking goes back to unpaid and the bonus regains it. */
export async function clearBookingBonus(
  accessToken: string | null,
  bookingId: string,
): Promise<{ error: string | null }> {
  const actor = await authorize(accessToken);
  if (!actor) return { error: "forbidden" };

  const db = getAdminClient().database;
  const { data } = await db
    .from("bookings")
    .select("bonus_id, contact_bonuses(sessions_total)")
    .eq("id", bookingId)
    .maybeSingle();
  const booking = data as unknown as {
    bonus_id: string | null;
    contact_bonuses: { sessions_total: number } | null;
  } | null;
  if (!booking?.bonus_id) return { error: "not_found" };

  const { error } = await db
    .from("bookings")
    .update({
      bonus_id: null,
      payment_mode: "none",
      payment_status: "pending",
      amount_paid_eur: 0,
    })
    .eq("id", bookingId);
  if (error) return { error: (error as { message?: string }).message ?? "db" };

  await recordBookingEvent({
    bookingId,
    channel: "system",
    event: "edited",
    actorId: actor.userId,
    actorRole: actor.role as BookingEventActorRole,
    summary: `Retirado el ${bonusLabelEs(booking.contact_bonuses?.sessions_total ?? 0)} de la reserva`,
    payload: { bonusId: booking.bonus_id },
  });
  return { error: null };
}

/**
 * The latest bonus sales, for the transactions ledger. A sold bonus is income
 * on the day it is bought; the bookings that draw from it are not.
 */
export async function fetchBonusSales(
  accessToken: string | null,
): Promise<BonusSale[]> {
  if (!(await authorize(accessToken))) return [];

  const { data } = await getAdminClient()
    .database.from("contact_bonuses")
    .select(
      "id, sessions_total, price_eur, purchased_at, created_at, paid_method, created_by, contacts(first_name, last_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  type Row = {
    id: string;
    sessions_total: number;
    price_eur: number | string;
    purchased_at: string;
    created_at: string;
    paid_method: string | null;
    created_by: string | null;
    contacts: {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    } | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  // A bonus paid online came from the website; one added by hand carries the
  // role of whoever added it, as a booking does.
  const creatorIds = [
    ...new Set(rows.map((r) => r.created_by).filter(Boolean) as string[]),
  ];
  const roleById = new Map<string, string>();
  if (creatorIds.length > 0) {
    const { data: profiles } = await getAdminClient()
      .database.from("profiles")
      .select("id, role")
      .in("id", creatorIds);
    for (const p of (profiles ?? []) as { id: string; role: string | null }[]) {
      if (p.role) roleById.set(p.id, p.role);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    sessions: r.sessions_total,
    priceEur: Number(r.price_eur),
    purchasedAt: r.purchased_at,
    createdAt: r.created_at,
    clientName:
      [r.contacts?.first_name, r.contacts?.last_name]
        .filter(Boolean)
        .join(" ") || null,
    clientEmail: r.contacts?.email ?? null,
    soldBy:
      r.paid_method === "online"
        ? "anonymous"
        : ((r.created_by && roleById.get(r.created_by)) ?? "admin"),
  }));
}
