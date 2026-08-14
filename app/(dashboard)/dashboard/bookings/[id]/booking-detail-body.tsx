"use client";

import type { SupportedLocale } from "@/utils/format";
import type { BookingEventRow } from "@/lib/booking-events/types";
import type {
  BookingDetail,
  ClientContact,
  CreatorProfile,
  StaffPerson,
} from "./types";
import {
  ClientCard,
  DateTimeCard,
  HistoryCard,
  LocationCard,
  MetaStrip,
  NotesCard,
  ReservedByCard,
  ServiceCard,
  StaffCard,
} from "./booking-detail-sections";
import { displayNotes } from "./booking-notes";

/**
 * Everything known about one booking: the strip along the top, then a card for
 * the service, the professional, where it happens, when, for whom, what they
 * wrote, who booked it — and last of all, the trail of everything that has
 * happened to it.
 *
 * The order they appear in is the only thing this file decides; each card reads
 * its own fields and brings its own wording.
 */
export function BookingDetailBody({
  booking,
  creator,
  contact,
  events,
  staffPerson,
  locale,
}: {
  booking: BookingDetail;
  creator: CreatorProfile | null;
  /** The client's record, when the booking is linked to one. */
  contact: ClientContact | null;
  events: BookingEventRow[];
  /** The professional assigned to it, if the booking has one. */
  staffPerson: StaffPerson | null;
  locale: SupportedLocale;
}) {
  const notes = displayNotes(booking.notes);

  return (
    <>
      <MetaStrip booking={booking} locale={locale} />

      <div className="space-y-6">
        <ServiceCard booking={booking} staffPerson={staffPerson} />
        {staffPerson && <StaffCard staffPerson={staffPerson} />}
        {booking.location && <LocationCard booking={booking} />}
        <DateTimeCard booking={booking} locale={locale} />
        <ClientCard booking={booking} contact={contact} locale={locale} />
        {notes && <NotesCard notes={notes} />}
        <ReservedByCard booking={booking} creator={creator} />
        {/* Last, and read as a trail: it is the record consulted when someone
        asks why the hour moved or says they were never told, not something to
        scroll past on the way to the client's phone number. */}
        {events.length > 0 && <HistoryCard events={events} locale={locale} />}
      </div>
    </>
  );
}
