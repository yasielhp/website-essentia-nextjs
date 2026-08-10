import { getAppUrl } from "@/lib/env";

/**
 * What a booking looks like on a calendar.
 *
 * The events used to carry a title and nothing else — service and client name,
 * and that was the whole event. Whoever opened it on their phone between
 * sessions still had to find the booking in the dashboard to learn the phone
 * number, where it takes place, or what the client wrote in the notes.
 *
 * Everything the row holds goes in the description now, one label per line, in
 * the order somebody reads it: who, how to reach them, what and how long,
 * where, what is owed, and finally the notes and a link back.
 */
export type CalendarBooking = {
  id: string;
  service_title: string | null;
  tier_label?: string | null;
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
  phone?: string | null;
  date: string | null;
  time: string | null;
  duration: string | null;
  location?: string | null;
  location_address?: string | null;
  notes?: string | null;
  price_eur?: number | null;
  payment_status?: string | null;
  status?: string | null;
  staff_name?: string | null;
};

/** The client's name, or a stand-in so an event is never nameless. */
export function bookingClientName(booking: CalendarBooking): string {
  return (
    [booking.first_name, booking.last_name].filter(Boolean).join(" ").trim() ||
    "Cliente"
  );
}

export function bookingSummary(booking: CalendarBooking): string {
  const what = [booking.service_title, booking.tier_label]
    .filter(Boolean)
    .join(" · ");
  return `${what || "Essentia"} — ${bookingClientName(booking)}`;
}

/**
 * Where it happens, in the words the centre uses.
 *
 * `location_address` holds JSON for a hotel room or a home visit; a malformed
 * value is skipped rather than printed raw at somebody in a corridor.
 */
export function bookingLocation(booking: CalendarBooking): string | null {
  if (!booking.location) return null;

  const parsed = (() => {
    if (!booking.location_address) return null;
    try {
      return JSON.parse(booking.location_address) as Record<string, string>;
    } catch {
      return null;
    }
  })();

  if (booking.location === "habitacion") {
    const parts = [
      parsed?.reservationNumber ? `Reserva ${parsed.reservationNumber}` : null,
      parsed?.roomNumber ? `Habitación ${parsed.roomNumber}` : null,
    ].filter(Boolean);
    return ["Baobab Suites", ...parts].join(" · ");
  }

  if (booking.location === "domicilio") {
    const parts = [
      parsed?.street,
      parsed?.building,
      [parsed?.postalCode, parsed?.municipality].filter(Boolean).join(" "),
    ].filter(Boolean);
    return parts.length > 0 ? `Domicilio · ${parts.join(", ")}` : "Domicilio";
  }

  return "Centro Essentia";
}

const PAYMENT_LABELS: Record<string, string> = {
  paid: "Pagado",
  pending: "Pendiente de pago",
  failed: "Pago fallido",
  refunded: "Reembolsado",
};

export function bookingDescription(booking: CalendarBooking): string {
  const lines: (string | null)[] = [
    `Cliente: ${bookingClientName(booking)}`,
    booking.phone ? `Teléfono: ${booking.phone}` : null,
    booking.email ? `Email: ${booking.email}` : null,
    booking.service_title ? `Servicio: ${booking.service_title}` : null,
    booking.tier_label ? `Tipo de sesión: ${booking.tier_label}` : null,
    booking.duration ? `Duración: ${booking.duration}` : null,
    booking.staff_name ? `Profesional: ${booking.staff_name}` : null,
    bookingLocation(booking) ? `Ubicación: ${bookingLocation(booking)}` : null,
    booking.price_eur != null ? `Precio: ${booking.price_eur} €` : null,
    booking.payment_status
      ? `Pago: ${PAYMENT_LABELS[booking.payment_status] ?? booking.payment_status}`
      : null,
    booking.status ? `Estado: ${booking.status}` : null,
    // Last, and on its own lines: notes are prose and everything above is a
    // field, so a long note never buries the phone number.
    booking.notes?.trim() ? `\nNotas:\n${booking.notes.trim()}` : null,
    `\n${getAppUrl()}/dashboard/bookings/${booking.id}`,
  ];

  return lines.filter((line) => line !== null).join("\n");
}

/** The fields `bookingDescription` reads, for a `select()`. */
export const CALENDAR_BOOKING_FIELDS =
  "id, service_title, first_name, last_name, email, phone, date, time, duration, location, location_address, notes, price_eur, payment_status, status, service_tiers(label)";
