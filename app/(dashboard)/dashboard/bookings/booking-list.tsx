"use client";

import { BookingCards } from "./booking-cards";
import { BookingTable } from "./booking-table";
import type { Booking } from "./types";

/**
 * A page of bookings, twice over: cards on a phone, a table on a desk.
 *
 * The two are genuinely different readings of the same list — the card leads
 * with when, the row leads with when it was taken — so they are two components
 * rather than one with a breakpoint in the middle of it.
 */
export function BookingList({
  bookings,
  loading,
  locale,
  onOpen,
}: {
  bookings: Booking[];
  loading: boolean;
  locale: string;
  onOpen: (id: string) => void;
}) {
  return (
    <>
      <BookingCards
        bookings={bookings}
        loading={loading}
        locale={locale}
        onOpen={onOpen}
      />
      <BookingTable
        bookings={bookings}
        loading={loading}
        locale={locale}
        onOpen={onOpen}
      />
    </>
  );
}
