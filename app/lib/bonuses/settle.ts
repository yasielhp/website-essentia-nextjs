import { getAdminClient } from "@/lib/insforge-admin";
import { recordBookingEvent } from "@/lib/booking-events/record";
import type { BookingEventActorRole } from "@/lib/booking-events/types";
import { hoursUntilSession } from "@/lib/bookings/cancellation-window";
import { bonusLabelEs } from "./label";
import {
  BONUS_LOST,
  BONUS_RETURNED,
  bonusOnCancel,
  type BonusCancelReason,
} from "./cancellation";

/**
 * After a booking drawn from a bonus has been cancelled: records whether its
 * session goes back to the bonus or is lost (`bonusOnCancel`), which is what
 * the bonus balance then counts. SERVER ONLY, not a Server Action: its callers
 * (the cancellation link, the dashboard's save, the assistants' tool) have
 * decided who is asking. `date` and `time` are the session as it stood when it
 * was cancelled. A booking not drawn from a bonus writes nothing. Never throws.
 */
export type BonusCancelOutcome =
  | { bonus: false }
  | { bonus: true; returned: boolean; reason: BonusCancelReason };

/** `con 30 h de antelación`, or after the hour when it had begun. */
function notice(hours: number): string {
  return hours < 0
    ? "después de la hora de la sesión"
    : `con ${Math.floor(hours)} h de antelación`;
}

export async function settleBonusOnCancel(input: {
  bookingId: string;
  source: "client_link" | "dashboard" | "assistant";
  actorId?: string | null;
  actorRole: BookingEventActorRole;
  date: string | null;
  time: string | null;
  /** The team's choice for a cancellation inside the last 24 hours. */
  teamReturnsLate?: boolean;
  now?: number;
}): Promise<BonusCancelOutcome> {
  try {
    const { data } = await getAdminClient()
      .database.from("bookings")
      .select("payment_mode, bonus_id, contact_bonuses(sessions_total)")
      .eq("id", input.bookingId)
      .maybeSingle();
    const row = data as unknown as {
      payment_mode: string | null;
      bonus_id: string | null;
      contact_bonuses: { sessions_total: number } | null;
    } | null;
    if (!row || row.payment_mode !== "bonus" || !row.bonus_id) {
      return { bonus: false };
    }

    const hoursBefore = hoursUntilSession(input.date, input.time, input.now);
    const by = input.source === "client_link" ? "client" : "team";
    const decision = bonusOnCancel({
      hoursBefore,
      by,
      teamReturnsLate: input.teamReturnsLate,
    });
    const label = bonusLabelEs(row.contact_bonuses?.sessions_total ?? 0);
    const team = by === "team" ? " · decisión del equipo" : "";

    await recordBookingEvent({
      bookingId: input.bookingId,
      channel: "system",
      event: decision.returned ? BONUS_RETURNED : BONUS_LOST,
      actorId: input.actorId ?? null,
      actorRole: input.actorRole,
      summary: decision.returned
        ? `Sesión devuelta al ${label} · cancelada ${notice(hoursBefore)}` +
          (decision.reason === "late_team_returns" ? team : "")
        : `Sesión perdida del ${label} · cancelada ${notice(hoursBefore)} (menos de 24 h)` +
          team,
      payload: {
        bonusId: row.bonus_id,
        hoursBefore: Math.round(hoursBefore * 10) / 10,
        source: input.source,
        reason: decision.reason,
      },
    });
    return { bonus: true, ...decision };
  } catch (err) {
    console.error("[bonuses] could not settle the cancelled session:", err);
    return { bonus: false };
  }
}
