import { getAdminClient } from "@/lib/insforge-admin";
import type { BookingNotificationPayload } from "./notify";

/**
 * The "request received" email of the public form, which anybody may ask for
 * (a guest has no session). So nothing of it is taken from the caller but the
 * booking's id and the language: the name, the service, the session type, the
 * day, the hour and the length are read from the BOOKING, and it goes out
 * only for a booking of the form that is being booked right now (a draft or
 * a booking waiting for its payment, started or sent to the bank in the last
 * half hour), once (a `received` email already in its history is not sent
 * again). It never writes the contact (the form writes its own).
 */

/** How recent a booking must be for its "received" to go out. */
export const RECEIVED_WINDOW_MS = 30 * 60_000;

export type ReceivedRefusal =
  "not_found" | "not_open" | "too_old" | "already_sent" | "failed";

type Row = {
  id: string;
  status: string | null;
  created_at: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  service_id: string | null;
  service_title: string | null;
  date: string | null;
  time: string | null;
  duration: string | null;
  service_tiers: { label: string | null } | null;
};

const recent = (at: string | null | undefined, now: number) => {
  const t = at ? new Date(at).getTime() : Number.NaN;
  return !Number.isNaN(t) && now - t <= RECEIVED_WINDOW_MS;
};

/** The payload of the "received" email, from the booking, or why not. */
export async function receivedFromBooking(
  bookingId: string,
  locale: "en" | "es" | undefined,
  now: number = Date.now(),
): Promise<
  | { ok: true; payload: BookingNotificationPayload }
  | { ok: false; reason: ReceivedRefusal }
> {
  const db = getAdminClient().database;
  const { data, error } = await db
    .from("bookings")
    .select(
      "id, status, created_at, first_name, last_name, phone, service_id, service_title, date, time, duration, service_tiers(label)",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (error) return { ok: false, reason: "failed" };
  const row = data as unknown as Row | null;
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status !== "draft" && row.status !== "pending") {
    return { ok: false, reason: "not_open" };
  }

  const { data: history, error: historyError } = await db
    .from("booking_events")
    .select("channel, event, created_at")
    .eq("booking_id", bookingId);
  if (historyError) return { ok: false, reason: "failed" };
  const entries = (history ?? []) as {
    channel: string;
    event: string;
    created_at: string;
  }[];
  if (entries.some((e) => e.channel === "email" && e.event === "received")) {
    return { ok: false, reason: "already_sent" };
  }
  // Started in the last half hour, or sent to the bank in it.
  const opened = entries
    .filter((e) => e.channel === "payment" && e.event === "checkout")
    .map((e) => e.created_at);
  if (!recent(row.created_at, now) && !opened.some((at) => recent(at, now))) {
    return { ok: false, reason: "too_old" };
  }

  return {
    ok: true,
    payload: {
      bookingId: row.id,
      event: "received",
      clientName: [row.first_name, row.last_name]
        .filter(Boolean)
        .join(" ")
        .trim(),
      clientEmail: "",
      clientPhone: row.phone,
      service: row.service_title ?? "",
      serviceId: row.service_id,
      sessionType: row.service_tiers?.label ?? null,
      amountDueEur: null,
      date: row.date ?? "",
      time: row.time ?? "",
      duration: row.duration,
      ...(locale ? { locale } : {}),
    },
  };
}
